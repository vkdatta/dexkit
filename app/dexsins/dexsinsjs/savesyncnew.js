/*!
 * SaveSync.js  v2.2.0  —  Global Auto-Save, Sync & Live Collaboration
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-config. Any cloud. Per-key micro-saving. Live polling sync.
 *
 * QUICKSTART
 *   <script src="savesync.js"></script>                          ← local only
 *   <script src="savesync.js" saveto="cloud"
 *           cloud-endpoint="https://api.you.com/ss"></script>    ← REST
 *
 *   SaveSync.useGist({ id: 'GIST_ID', token: 'PAT' });          ← GitHub Gist
 *
 * MICRO-SAVING (per-note / per-key, bypasses form field scan)
 *   await SaveSync.saveAs('note-uid-42', noteObject);
 *   const note = await SaveSync.loadAs('note-uid-42');
 *   const stop = SaveSync.watch('note-uid-42', cb); // live, call stop() to end
 *
 * FIELD CONTROL
 *   saveto="not"       → exclude field or container
 *   saveto="ui"        → opt-in UI state (aria-pressed buttons)
 *   data-saveid="key"  → override auto-generated field key
 *
 * EVENTS  (document CustomEvents)
 *   savesync:ready | saved | restored | synced | conflict | cleared | error
 *
 * PUBLIC API
 *   SaveSync.save()              — manual form-field save
 *   SaveSync.restore()           — manual form-field restore
 *   SaveSync.saveAs(key, data)   — save arbitrary data under key
 *   SaveSync.loadAs(key)         — load data for key
 *   SaveSync.watch(key, fn)      — live changes for key → returns stop()
 *   SaveSync.clear()             — wipe all data for this page
 *   SaveSync.use(adapter)        — plug in any cloud adapter
 *   SaveSync.useGist(opts)       — activate built-in GitHub Gist adapter
 *   SaveSync.on(evt, fn)         — subscribe to events
 *   SaveSync.rebind()            — re-scan DOM after programmatic changes
 *   SaveSync.destroy()           — tear down everything
 */

(function (global, doc) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // § 1.  BOOTSTRAP
  // ═══════════════════════════════════════════════════════════════════════════

  const SCRIPT = (function () {
    if (doc.currentScript) return doc.currentScript;
    return doc.querySelector('script[saveto]') ||
           doc.querySelector('script[src*="savesync"]') || null;
  })();

  const _a = (name, fb) => SCRIPT?.getAttribute(name) ?? fb;

  const CFG = Object.freeze({
    saveMode:         _a('saveto', 'local').toLowerCase(),
    cloudEndpoint:    _a('cloud-endpoint', ''),
    authCheckFn:      _a('auth-check', ''),
    syncInterval:     +_a('sync-interval', '5000'),
    debounceDelay:    +_a('debounce', '350'),
    conflictMs:       +_a('conflict-threshold', '2000'),
    conflictStrategy: _a('conflict', 'newest'),
    restoreOnLoad:    _a('restore', 'true') !== 'false',
    indicatorSel:     _a('sync-indicator', ''),
    ns:               _a('namespace', 'savesync'),
    debug:            _a('debug', 'false') === 'true',
    version: '2.2.0',
  });

  const PAGE_KEY = `${CFG.ns}::${location.hostname}${location.pathname}${location.search}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // § 2.  SESSION
  // ═══════════════════════════════════════════════════════════════════════════

  const SESSION_ID = (function () {
    const KEY = `${CFG.ns}::session`;
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = 'ss_' + (crypto.randomUUID?.() ||
           Math.random().toString(36).slice(2) + '_' + Date.now());
      sessionStorage.setItem(KEY, id);
    }
    return id;
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // § 3.  UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function emit(name, detail) {
    doc.dispatchEvent(new CustomEvent(`savesync:${name}`, { detail, bubbles: true }));
  }

  const log = CFG.debug
    ? (...a) => console.log('%c[SaveSync]', 'color:#6c63ff;font-weight:bold', ...a)
    : () => {};

  function makeQueue() {
    let chain = Promise.resolve();
    return fn => { chain = chain.then(fn, fn); return chain; };
  }
  const queue = makeQueue();

  function shallowEq(a, b) {
    if (a === b) return true;
    const ka = Object.keys(a || {}), kb = Object.keys(b || {});
    if (ka.length !== kb.length) return false;
    return ka.every(k => a[k] === b[k]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 4.  FIELD CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONTENT_SELECTOR =
    'input:not([type=password]):not([type=file]):not([type=button])' +
    ':not([type=submit]):not([type=reset]):not([type=image]),' +
    'textarea, select,' +
    '[contenteditable="true"], [contenteditable=""]';

  const UI_SELECTOR =
    'button[aria-pressed], [role=switch], [role=checkbox],' +
    'input[type=button][aria-pressed]';

  function isExcluded(el) {
    let node = el;
    while (node && node !== doc.body) {
      if (node.getAttribute?.('saveto') === 'not') return true;
      node = node.parentElement;
    }
    return false;
  }

  function isSaveableContent(el) {
    if (el.disabled || el.readOnly) return false;
    return !isExcluded(el);
  }

  function isSaveableUI(el) {
    if (isExcluded(el)) return false;
    return el.getAttribute('saveto') === 'ui';
  }

  function getFields() {
    const content = Array.from(doc.querySelectorAll(CONTENT_SELECTOR)).filter(isSaveableContent);
    const ui      = Array.from(doc.querySelectorAll(UI_SELECTOR)).filter(isSaveableUI);
    return [...content, ...ui];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 5.  FIELD KEYING
  // ═══════════════════════════════════════════════════════════════════════════

  const COUNTER_KEY = `${CFG.ns}::idctr::${PAGE_KEY}`;
  function nextId() {
    const n = (parseInt(localStorage.getItem(COUNTER_KEY) || '0') || 0) + 1;
    try { localStorage.setItem(COUNTER_KEY, String(n)); } catch (_) {}
    return `${CFG.ns}-${n}`;
  }

  function ensureId(el) {
    if (el.id && el.id.trim()) return el.id;
    if (el.dataset?.saveid) {
      try { el.id = el.dataset.saveid; } catch (_) {}
      return el.dataset.saveid;
    }
    const id = nextId();
    try { el.id = id; } catch (_) {}
    try { if (el.dataset) el.dataset.saveid = id; } catch (_) {}
    return id;
  }

  function keyOf(el) {
    const custom = el.getAttribute('data-saveid') || el.getAttribute('data-save-id');
    if (custom) return `c::${custom}`;
    const id = ensureId(el);
    if (id) return `id::${id}`;
    if (el.name) {
      const siblings = doc.querySelectorAll(`[name="${CSS.escape(el.name)}"]`);
      return `nm::${el.name}::${Array.from(siblings).indexOf(el)}`;
    }
    return `xp::${xpathOf(el)}`;
  }

  function xpathOf(el) {
    const segs = [];
    while (el && el !== doc.body) {
      const tag = el.tagName.toLowerCase();
      const idx = Array.from(el.parentElement?.children || [])
        .filter(c => c.tagName === el.tagName).indexOf(el) + 1;
      segs.unshift(`${tag}[${idx}]`);
      el = el.parentElement;
    }
    return segs.join('/');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 6.  VALUE READ / WRITE
  // ═══════════════════════════════════════════════════════════════════════════

  function readValue(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    if (el.contentEditable === 'true' || el.contentEditable === '') return el.innerHTML;
    if (el.tagName === 'SELECT' && el.multiple)
      return Array.from(el.selectedOptions).map(o => o.value);
    if (el.hasAttribute('aria-pressed'))
      return el.getAttribute('aria-pressed') === 'true';
    return el.value;
  }

  function writeValue(el, value, preserveCursor = false) {
    if (value === null || value === undefined) return;

    let savedStart, savedEnd, savedLen;
    const isActive     = doc.activeElement === el;
    const hasSelection = isActive && el.setSelectionRange && el.selectionStart !== undefined;

    if (preserveCursor && hasSelection) {
      savedStart = el.selectionStart;
      savedEnd   = el.selectionEnd;
      savedLen   = el.value?.length || 0;
    }

    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked === !!value) return;
      el.checked = !!value;
    } else if (el.contentEditable === 'true' || el.contentEditable === '') {
      if (el.innerHTML === value) return;
      el.innerHTML = value;
    } else if (el.tagName === 'SELECT' && el.multiple && Array.isArray(value)) {
      Array.from(el.options).forEach(o => { o.selected = value.includes(o.value); });
    } else if (el.hasAttribute('aria-pressed')) {
      el.setAttribute('aria-pressed', String(!!value));
    } else {
      const strVal = String(value);
      if (el.value === strVal) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      if (nativeSetter) nativeSetter.call(el, strVal);
      else el.value = strVal;
    }

    if (preserveCursor && hasSelection) {
      const newLen = el.value?.length || 0;
      if (savedStart === savedLen && savedEnd === savedLen) {
        el.setSelectionRange(newLen, newLen);
      } else {
        el.setSelectionRange(Math.min(savedStart, newLen), Math.min(savedEnd, newLen));
      }
    }

    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 7.  SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  function captureState() {
    const state = {};
    getFields().forEach(el => { state[keyOf(el)] = readValue(el); });
    return state;
  }

  function makeSnapshot(state) {
    return { v: CFG.version, ts: Date.now(), url: location.href, session: SESSION_ID, state };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.  LOCAL STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  const Local = {
    save(snap) {
      try {
        localStorage.setItem(PAGE_KEY, JSON.stringify(snap));
        log('Local ✓', snap.ts);
      } catch (err) {
        if (err.name === 'QuotaExceededError') Local._prune();
        try { localStorage.setItem(PAGE_KEY, JSON.stringify(snap)); } catch (_) {}
        emit('error', { mode: 'local', err });
      }
    },
    load() {
      try { const raw = localStorage.getItem(PAGE_KEY); return raw ? JSON.parse(raw) : null; }
      catch (_) { return null; }
    },
    // Arbitrary key storage (for saveAs/loadAs)
    saveRaw(key, snap) {
      try { localStorage.setItem(`${CFG.ns}::raw::${key}`, JSON.stringify(snap)); } catch (_) {}
    },
    loadRaw(key) {
      try {
        const raw = localStorage.getItem(`${CFG.ns}::raw::${key}`);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },
    clearRaw(key) { localStorage.removeItem(`${CFG.ns}::raw::${key}`); },
    clear() { localStorage.removeItem(PAGE_KEY); },
    _prune() {
      const entries = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(CFG.ns)) continue;
        try { entries.push({ k, ts: JSON.parse(localStorage.getItem(k))?.ts || 0 }); }
        catch (_) { entries.push({ k, ts: 0 }); }
      }
      entries.sort((a, b) => a.ts - b.ts)
        .slice(0, Math.ceil(entries.length / 2))
        .forEach(e => localStorage.removeItem(e.k));
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.  CLOUD ADAPTER INTERFACE
  //
  //  Required:  save(key, snap) → bool
  //             load(key)       → snap | null
  //             clear(key)      → void
  //  Optional:  subscribe(key, cb) → unsubscribeFn   ← enables live sync
  // ═══════════════════════════════════════════════════════════════════════════

  const RestAdapter = {
    _url(path) { return `${CFG.cloudEndpoint.replace(/\/$/, '')}${path}`; },
    _hdr() {
      const token = Auth._token();
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-SaveSync-Session': SESSION_ID,
      };
    },
    async save(key, snap) {
      if (!CFG.cloudEndpoint || !navigator.onLine) return false;
      try {
        const res = await fetch(RestAdapter._url('/save'), {
          method: 'POST', headers: RestAdapter._hdr(),
          body: JSON.stringify({ key, snapshot: snap }),
          signal: AbortSignal.timeout(8000),
        });
        return res.ok;
      } catch (_) { return false; }
    },
    async load(key) {
      if (!CFG.cloudEndpoint || !navigator.onLine) return null;
      try {
        const res = await fetch(
          RestAdapter._url(`/load?key=${encodeURIComponent(key)}`),
          { headers: RestAdapter._hdr(), signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return null;
        return (await res.json()).snapshot || null;
      } catch (_) { return null; }
    },
    subscribe: null,
    async clear(key) {
      if (!CFG.cloudEndpoint) return;
      try {
        await fetch(RestAdapter._url('/clear'), {
          method: 'DELETE', headers: RestAdapter._hdr(),
          body: JSON.stringify({ key }), signal: AbortSignal.timeout(5000),
        });
      } catch (_) {}
    },
  };

  let _adapter = RestAdapter;
  let _unsubscribeRealtime = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10. AUTH DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const Auth = {
    isLoggedIn() {
      if (CFG.authCheckFn && typeof global[CFG.authCheckFn] === 'function')
        return !!global[CFG.authCheckFn]();
      if (global.user?.id || global.currentUser?.id || global.USER?.id ||
          global.App?.user?.id) return true;
      const meta = doc.querySelector(
        'meta[name="user-id"],meta[name="current-user-id"],meta[name="x-user-id"]'
      );
      if (meta?.content) return true;
      if (Auth._token()) return true;
      if (doc.cookie.match(/\b(session|auth|logged_in|user_id)=/i)) return true;
      return false;
    },
    _token() {
      return localStorage.getItem('token')           ||
             localStorage.getItem('access_token')    ||
             localStorage.getItem('auth_token')      ||
             localStorage.getItem('jwt')             ||
             localStorage.getItem('sb-access-token') ||
             sessionStorage.getItem('token')         ||
             sessionStorage.getItem('access_token')  ||
             doc.cookie.match(/\b(?:token|access_token|auth_token)=([^;]+)/i)?.[1] ||
             null;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // § 11. CONFLICT RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  async function resolveConflict(local, cloud) {
    if (!local && !cloud) return null;
    if (!local)  return cloud;
    if (!cloud)  return local;
    if (Math.abs(local.ts - cloud.ts) <= CFG.conflictMs) return local;
    switch (CFG.conflictStrategy) {
      case 'local': return local;
      case 'cloud': return cloud;
      case 'ask': {
        return new Promise(resolve => {
          emit('conflict', {
            local, cloud,
            useLocal:  () => resolve(local),
            useCloud:  () => resolve(cloud),
            useNewest: () => resolve(local.ts >= cloud.ts ? local : cloud),
          });
          setTimeout(() => resolve(local.ts >= cloud.ts ? local : cloud), 15_000);
        });
      }
      default: return local.ts >= cloud.ts ? local : cloud;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 12. EFFECTIVE MODE + OFFLINE QUEUE
  // ═══════════════════════════════════════════════════════════════════════════

  let _mode = 'local';
  let _offlineQueue = [];

  async function determineMode() {
    if (CFG.saveMode === 'local')  return 'local';
    if (CFG.saveMode === 'cloud')  return Auth.isLoggedIn() ? 'cloud' : 'local';
    if (CFG.saveMode === 'both')   return Auth.isLoggedIn() ? 'both'  : 'local';
    return 'local';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 13. SYNC ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  let _lastState = null;
  let _saving    = false;

  const Indicator = {
    _el: null,
    _init() { if (CFG.indicatorSel) this._el = doc.querySelector(CFG.indicatorSel); },
    set(state) {
      if (!this._el) return;
      this._el.classList.remove('savesync-syncing', 'savesync-synced', 'savesync-error');
      if (state) this._el.classList.add(`savesync-${state}`);
    },
    flash(state, ms = 1500) { this.set(state); setTimeout(() => this.set(''), ms); },
  };

  async function _doSave(force = false) {
    if (_saving) return;
    _saving = true;
    try {
      const state = captureState();
      if (!force && _lastState && shallowEq(state, _lastState)) return;
      _lastState = state;
      const snap = makeSnapshot(state);
      _mode = await determineMode();
      Local.save(snap);
      if (_mode === 'cloud' || _mode === 'both') {
        if (!navigator.onLine) {
          _offlineQueue.push(snap);
        } else {
          Indicator.set('syncing');
          const ok = await _adapter.save(PAGE_KEY, snap);
          Indicator.flash(ok ? 'synced' : 'error', 1200);
          if (!ok) emit('error', { mode: 'cloud', err: new Error('Save failed') });
        }
      }
      _channel?.postMessage({ type: 'saved', ts: snap.ts, key: PAGE_KEY });
      emit('saved', { mode: _mode, snap });
      log('Saved', { mode: _mode, ts: snap.ts });
    } finally {
      _saving = false;
    }
  }

  async function _doRestore() {
    _mode = await determineMode();
    const local = Local.load();
    let cloud = null;
    if (_mode !== 'local' && Auth.isLoggedIn()) {
      Indicator.set('syncing');
      cloud = await _adapter.load(PAGE_KEY);
      Indicator.flash(cloud ? 'synced' : '', 800);
    }
    const resolved = await resolveConflict(local, cloud);
    if (!resolved) { log('Nothing to restore'); return; }
    _applySnapshot(resolved, false);
    emit('restored', { mode: cloud ? 'cloud' : 'local', snap: resolved });
    log('Restored from', cloud ? 'cloud' : 'local', resolved.ts);
  }

  function _applySnapshot(snap, skipActive) {
    if (!snap?.state) return;
    const fields = getFields();
    const byKey  = new Map(fields.map(el => [keyOf(el), el]));
    Object.entries(snap.state).forEach(([k, v]) => {
      const el = byKey.get(k);
      if (!el) return;
      if (skipActive && doc.activeElement === el) return;
      writeValue(el, v, skipActive);
    });
  }

  function _applyExternal(snap) {
    if (!snap) return;
    if (snap.session === SESSION_ID) return;
    _applySnapshot(snap, true);
    emit('synced', { source: 'realtime', snap });
    Indicator.flash('synced', 800);
    log('Real-time sync applied', snap.ts);
  }

  async function _flushOfflineQueue() {
    if (!_offlineQueue.length) return;
    const batch  = _offlineQueue.splice(0);
    const latest = batch.reduce((a, b) => (a.ts > b.ts ? a : b));
    log(`Flushing ${batch.length} offline save(s)`);
    await _adapter.save(PAGE_KEY, latest);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 14. FIELD BINDING
  // ═══════════════════════════════════════════════════════════════════════════

  const _dSave = debounce(() => queue(_doSave), CFG.debounceDelay);
  const _iSave = () => queue(_doSave);

  function _bindField(el) {
    if (el._ssBound) return;
    el._ssBound = true;
    el.addEventListener('input',  _dSave, { passive: true });
    el.addEventListener('change', _iSave, { passive: true });
    el.addEventListener('paste',  _dSave, { passive: true });
    el.addEventListener('cut',    _dSave, { passive: true });
    if (el.tagName === 'BUTTON') el.addEventListener('click', _iSave, { passive: true });
  }

  function bindAllFields() { getFields().forEach(_bindField); }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 15. MUTATION OBSERVER
  // ═══════════════════════════════════════════════════════════════════════════

  const _mutObs = new MutationObserver(muts => {
    for (const m of muts) if (m.addedNodes.length) { bindAllFields(); break; }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // § 16. CROSS-TAB SYNC
  // ═══════════════════════════════════════════════════════════════════════════

  let _channel = null;

  function _initChannel() {
    if (!global.BroadcastChannel) return;
    _channel = new BroadcastChannel(`${CFG.ns}::live`);
    _channel.onmessage = e => {
      if (e.data?.type === 'saved' && e.data.key === PAGE_KEY) {
        const snap = Local.load();
        if (snap) _applyExternal(snap);
      }
    };
  }

  function _initRealtime() {
    if (!_adapter.subscribe) return;
    _unsubscribeRealtime?.();
    _unsubscribeRealtime = _adapter.subscribe(PAGE_KEY, snap => {
      _applyExternal(snap);
      if (snap) Local.save(snap);
    });
    log('Real-time subscription active');
  }

  let _syncTimer = null;
  function _startSync() {
    if (_syncTimer) return;
    _syncTimer = setInterval(() => queue(_doSave), CFG.syncInterval);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // § 17. LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      queue(() => _doSave(true));
    } else {
      if (_mode !== 'local' && Auth.isLoggedIn() && !_adapter.subscribe)
        _adapter.load(PAGE_KEY).then(snap => snap && _applyExternal(snap));
    }
  });

  global.addEventListener('beforeunload', () => {
    try { localStorage.setItem(PAGE_KEY, JSON.stringify(makeSnapshot(captureState()))); } catch (_) {}
    if (CFG.cloudEndpoint && Auth.isLoggedIn() && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          `${CFG.cloudEndpoint.replace(/\/$/, '')}/save`,
          new Blob([JSON.stringify({ key: PAGE_KEY, snapshot: makeSnapshot(captureState()) })],
                   { type: 'application/json' })
        );
      } catch (_) {}
    }
  });

  global.addEventListener('pagehide', () => {
    try { localStorage.setItem(PAGE_KEY, JSON.stringify(makeSnapshot(captureState()))); } catch (_) {}
  });

  global.addEventListener('online', () => {
    log('Back online');
    _flushOfflineQueue();
    if (_mode !== 'local') queue(_doSave);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // § 18. TOAST
  // ═══════════════════════════════════════════════════════════════════════════

  const Toast = {
    _el: null,
    show(text, color = '#111') {
      if (doc.body?.dataset.savesyncNoui === 'true') return;
      if (!this._el) {
        this._el = doc.createElement('div');
        Object.assign(this._el.style, {
          position: 'fixed', bottom: '16px', right: '20px',
          padding: '6px 14px', borderRadius: '6px', color: '#fff', fontSize: '13px',
          fontFamily: 'system-ui,sans-serif', zIndex: '2147483647', opacity: '0',
          transition: 'opacity .25s', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,.25)',
        });
        doc.body?.appendChild(this._el);
      }
      this._el.textContent = text;
      this._el.style.background = color;
      this._el.style.opacity = '1';
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (this._el) this._el.style.opacity = '0'; }, 2000);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // § 19. PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  const SaveSync = {
    version: CFG.version,
    config:  { ...CFG },

    // ── Form-field auto-save ─────────────────────────────────────────────────
    save(force = true)  { return queue(() => _doSave(force)); },
    restore()           { return queue(_doRestore); },

    async clear() {
      Local.clear();
      if (_mode !== 'local') await _adapter.clear(PAGE_KEY);
      _lastState = null;
      emit('cleared', {});
    },

    getState:    captureState,
    getMode()    { return _mode; },
    isLoggedIn() { return Auth.isLoggedIn(); },
    getSession() { return SESSION_ID; },

    on(event, fn) {
      doc.addEventListener(`savesync:${event}`, e => fn(e.detail));
      return SaveSync;
    },
    off(event, fn) {
      doc.removeEventListener(`savesync:${event}`, fn);
      return SaveSync;
    },

    // ── Micro-saving (per-key, arbitrary data) ───────────────────────────────

    /**
     * Save any object under a custom key — bypasses form-field scan.
     * Data is saved locally and to cloud if adapter is active.
     * Automatically stamps session + ts for conflict resolution.
     */
    async saveAs(key, data) {
      const snap = { v: CFG.version, ts: Date.now(), session: SESSION_ID, state: data };
      Local.saveRaw(key, snap);
      if (_adapter !== RestAdapter || CFG.cloudEndpoint) {
        if (Auth.isLoggedIn() && navigator.onLine) {
          return _adapter.save(key, snap);
        }
      }
      return true;
    },

    /**
     * Load data for a custom key.
     * Checks cloud first (if logged in), falls back to localStorage.
     */
    async loadAs(key) {
      if (Auth.isLoggedIn() && navigator.onLine) {
        try {
          const snap = await _adapter.load(key);
          if (snap) {
            Local.saveRaw(key, snap); // keep local in sync
            return snap.state ?? snap;
          }
        } catch (_) {}
      }
      const local = Local.loadRaw(key);
      return local?.state ?? null;
    },

    /**
     * Subscribe to live changes for a specific key.
     * Works with any adapter that implements subscribe().
     * Returns an unsubscribe function — call it to stop watching.
     *
     * Callback receives the raw state data (not the snapshot wrapper).
     */
    watch(key, cb) {
      if (!_adapter?.subscribe) {
        log('watch(): adapter has no subscribe method — polling not available');
        return () => {};
      }
      return _adapter.subscribe(key, snap => {
        if (!snap) return;
        if (snap.session === SESSION_ID) return; // ignore own writes
        cb(snap.state ?? snap);
      });
    },

    // ── Adapter management ───────────────────────────────────────────────────

    use(adapter) {
      _unsubscribeRealtime?.();
      _adapter = adapter;
      if (_mode !== 'local' && Auth.isLoggedIn()) _initRealtime();
      log('Adapter set');
      return SaveSync;
    },

    /** Alias */
    setAdapter(adapter) { return SaveSync.use(adapter); },

    /**
     * Activate the built-in GitHub Gist adapter.
     *
     * Features:
     *   - Per-key files in a single Gist (micro-saving)
     *   - ETag-based polling for live sync (no wasted bandwidth)
     *   - Single shared poller serves all watch() subscribers
     *   - Offline-safe (queued until back online)
     *
     * @param {string} opts.id       — Gist ID (from gist.github.com)
     * @param {string} opts.token    — GitHub PAT with gist scope
     * @param {number} [opts.pollMs] — polling interval in ms (default 2000)
     *
     * ⚠️ For production: proxy requests through your backend to hide the token.
     */
    useGist({ id, token, pollMs = 2000 }) {
      if (!id || !token) {
        console.warn('[SaveSync] useGist: id and token are required');
        return SaveSync;
      }

      const BASE = `https://api.github.com/gists/${id}`;
      const hdr  = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      /** Convert any key to a valid Gist filename */
      function keyToFile(key) {
        return 'ss-' + key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) + '.json';
      }

      // ── Shared poller state ──────────────────────────────────────────────
      // One fetch per pollMs interval serves ALL watch() subscribers.
      // ETag ensures we only download if something actually changed.
      const _subs      = new Map();   // filename → Set<callback>
      const _lastSeen  = new Map();   // filename → last JSON string
      let   _pollerRef = null;
      let   _etag      = null;

      function _startPoller() {
        if (_pollerRef) return;
        _pollerRef = setInterval(async () => {
          if (!_subs.size || !navigator.onLine) return;
          try {
            const fetchHdr = { ...hdr };
            if (_etag) fetchHdr['If-None-Match'] = _etag;

            const res = await fetch(BASE, { headers: fetchHdr });
            if (res.status === 304) return; // nothing changed → free pass

            if (!res.ok) return;
            const newEtag = res.headers.get('ETag');
            if (newEtag) _etag = newEtag;

            const data = await res.json();

            for (const [filename, callbacks] of _subs) {
              const file = data.files?.[filename];
              if (!file?.content) continue;

              // Only fire if content actually changed
              if (file.content === _lastSeen.get(filename)) continue;
              _lastSeen.set(filename, file.content);

              let snap;
              try { snap = JSON.parse(file.content); }
              catch (_) { continue; }

              callbacks.forEach(cb => { try { cb(snap); } catch (_) {} });
            }
          } catch (_) {}
        }, pollMs);
      }

      function _stopPoller() {
        if (_pollerRef) { clearInterval(_pollerRef); _pollerRef = null; }
      }

      // ── Gist adapter implementation ──────────────────────────────────────
      const GistAdapter = {

        async save(key, snap) {
          if (!navigator.onLine) return false;
          const filename = keyToFile(key);
          const content  = JSON.stringify(snap);
          try {
            const res = await fetch(BASE, {
              method:  'PATCH',
              headers: hdr,
              body:    JSON.stringify({ files: { [filename]: { content } } }),
              signal:  AbortSignal.timeout(10000),
            });
            if (res.ok) {
              _lastSeen.set(filename, content); // update local cache so poller skips it
              _etag = null; // invalidate ETag so next poll gets fresh data
            }
            log(`Gist save [${filename}]`, res.ok ? '✓' : '✗');
            return res.ok;
          } catch (_) { return false; }
        },

        async load(key) {
          if (!navigator.onLine) return null;
          const filename = keyToFile(key);
          try {
            const res = await fetch(BASE, { headers: hdr, signal: AbortSignal.timeout(10000) });
            if (!res.ok) return null;
            _etag = res.headers.get('ETag') ?? _etag;
            const data = await res.json();
            const file = data.files?.[filename];
            if (!file?.content) return null;
            _lastSeen.set(filename, file.content);
            return JSON.parse(file.content);
          } catch (_) { return null; }
        },

        /**
         * Subscribe to live changes for a key via polling.
         * All subscriptions share one poller — only one Gist fetch per interval.
         */
        subscribe(key, cb) {
          const filename = keyToFile(key);
          if (!_subs.has(filename)) _subs.set(filename, new Set());
          _subs.get(filename).add(cb);
          _startPoller();
          log(`Gist watch started [${filename}]`);

          return function unsubscribe() {
            const set = _subs.get(filename);
            if (set) {
              set.delete(cb);
              if (!set.size) _subs.delete(filename);
            }
            if (!_subs.size) _stopPoller();
            log(`Gist watch stopped [${filename}]`);
          };
        },

        async clear(key) {
          const filename = keyToFile(key);
          try {
            await fetch(BASE, {
              method:  'PATCH',
              headers: hdr,
              body:    JSON.stringify({ files: { [filename]: { content: '{}' } } }),
              signal:  AbortSignal.timeout(8000),
            });
            _lastSeen.delete(filename);
          } catch (_) {}
        },
      };

      return SaveSync.use(GistAdapter);
    },

    rebind:  bindAllFields,

    destroy() {
      clearInterval(_syncTimer);
      _mutObs.disconnect();
      _channel?.close();
      _unsubscribeRealtime?.();
    },
  };

  SaveSync.on('saved',    () => Toast.show('✓ Saved'));
  SaveSync.on('synced',   () => Toast.show('⇄ Synced', '#1a1a2e'));
  SaveSync.on('error',    d  => Toast.show(`⚠ ${d.err?.message || 'Error'}`, '#7f1d1d'));
  SaveSync.on('conflict', () => Toast.show('⚡ Conflict resolved', '#3b1f00'));

  global.SaveSync = SaveSync;

  // ═══════════════════════════════════════════════════════════════════════════
  // § 20. INIT
  // ═══════════════════════════════════════════════════════════════════════════

  async function _init() {
    _mode = await determineMode();
    Indicator._init();
    _mutObs.observe(doc.body, { childList: true, subtree: true });
    bindAllFields();
    _initChannel();
    _startSync();
    if (_mode !== 'local' && Auth.isLoggedIn()) _initRealtime();
    if (CFG.restoreOnLoad) setTimeout(_doRestore, 150);
    emit('ready', { mode: _mode, version: CFG.version, session: SESSION_ID });
    log('Ready', { mode: _mode, session: SESSION_ID });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    _init();
  }

})(window, document);

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER RECIPES (for other providers)
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Supabase ─────────────────────────────────────────────────────────────────
//  SaveSync.use({
//    async save(key, snap) {
//      const { error } = await supabase.from('saves')
//        .upsert({ key, snapshot: snap, user_id: currentUser.id });
//      return !error;
//    },
//    async load(key) {
//      const { data } = await supabase.from('saves')
//        .select('snapshot').eq('key', key).single();
//      return data?.snapshot || null;
//    },
//    async clear(key) { await supabase.from('saves').delete().eq('key', key); },
//    subscribe(key, cb) {
//      const ch = supabase.channel('ss')
//        .on('postgres_changes', { event: '*', schema: 'public', table: 'saves',
//             filter: `key=eq.${key}` }, p => cb(p.new?.snapshot))
//        .subscribe();
//      return () => supabase.removeChannel(ch);
//    },
//  });
//
// ── PocketBase ───────────────────────────────────────────────────────────────
//  SaveSync.use({
//    async save(key, snap) {
//      const rec = await pb.collection('saves').getFirstListItem(`key="${key}"`).catch(() => null);
//      if (rec) await pb.collection('saves').update(rec.id, { snapshot: snap });
//      else      await pb.collection('saves').create({ key, snapshot: snap });
//      return true;
//    },
//    async load(key) {
//      const rec = await pb.collection('saves').getFirstListItem(`key="${key}"`).catch(() => null);
//      return rec?.snapshot || null;
//    },
//    async clear(key) {
//      const rec = await pb.collection('saves').getFirstListItem(`key="${key}"`).catch(() => null);
//      if (rec) await pb.collection('saves').delete(rec.id);
//    },
//  });
//
// ── REST BACKEND CONTRACT ─────────────────────────────────────────────────────
//  POST   /save     { key, snapshot }  →  200 | 401
//  GET    /load?key=                   →  200 { snapshot } | 401
//  DELETE /clear    { key }            →  200 | 401
// ─────────────────────────────────────────────────────────────────────────────
