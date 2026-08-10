(function () {
  'use strict';

  const STORAGE_KEY = 'autosave_generated:' + encodeURIComponent(location.origin + location.pathname + location.search);
  const STATIC_KEY = 'autosave_static:' + encodeURIComponent(location.origin + location.pathname + location.search);
  const COUNTER_KEY = 'autosave_id_counter:' + encodeURIComponent(location.origin + location.pathname + location.search);
  const EXCLUDE_KEY = 'autosave_exclude:' + encodeURIComponent(location.origin + location.pathname + location.search);
  const ID_PREFIX = 'webURLLINK';
  const SAVE_DELAY = 120;

  const STATIC_SELECTOR = 'input:not([type=password]), textarea, select, button, [contenteditable]';

  let DEBUG = false;
  function dlog() {
    if (DEBUG) { try { console.log.apply(console, ['[autosave]'].concat([].slice.call(arguments))); } catch (e) {} }
  }

  function debounce(fn, wait) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), wait);
    };
  }

  /* ------------------------------------------------------------------ *
   * Exclude list
   * A list of CSS selectors ('#x-id', '.no-save', etc.). Any element
   * that matches one of these selectors is never saved or restored.
   * The list is persisted so exclusions survive page reloads, and it is
   * (re-)read from storage before anything is saved.
   * ------------------------------------------------------------------ */
  let excludeSelectors = [];

  function loadExclude() {
    try {
      const raw = localStorage.getItem(EXCLUDE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      excludeSelectors = Array.isArray(arr) ? arr.filter(s => typeof s === 'string') : [];
    } catch (e) {
      excludeSelectors = [];
    }
    return excludeSelectors;
  }

  function persistExclude() {
    try {
      localStorage.setItem(EXCLUDE_KEY, JSON.stringify(excludeSelectors));
    } catch (e) {
      console.warn('Autosave: could not write exclude list', e);
    }
  }

  // Accepts any mix of selector strings and/or arrays of selector strings:
  //   dexsins.autosave.exclude('#x-id', '#y-id')
  //   dexsins.autosave.exclude(['#x-id', '#y-id'])
  function addExclude(...selectors) {
    loadExclude(); // start from the current, persisted list
    selectors.flat(Infinity).forEach(sel => {
      if (typeof sel !== 'string') return;
      sel = sel.trim();
      if (sel && excludeSelectors.indexOf(sel) === -1) excludeSelectors.push(sel);
    });
    persistExclude();
    // NOTE: intentionally NOT saving here. Registering an exclusion must
    // not write to storage on the spot — doing so during page load can
    // overwrite good data with a not-yet-settled snapshot. Restore and
    // every future save already skip excluded fields, so exclusion takes
    // effect without a purge.
    return excludeSelectors.slice();
  }

  // Reverse of exclude: stop excluding one or more selectors.
  function removeExclude(...selectors) {
    loadExclude();
    const toRemove = selectors.flat(Infinity).map(s => (typeof s === 'string' ? s.trim() : s));
    excludeSelectors = excludeSelectors.filter(s => toRemove.indexOf(s) === -1);
    persistExclude();
    return excludeSelectors.slice();
  }

  function getExcludes() {
    loadExclude();
    return excludeSelectors.slice();
  }

  function clearExcludes() {
    excludeSelectors = [];
    persistExclude();
    return excludeSelectors.slice();
  }

  // True if the element matches any excluded selector. Relies on the
  // in-memory excludeSelectors, which callers refresh via loadExclude()
  // before a save pass.
  function isExcluded(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!excludeSelectors.length) return false;
    for (const sel of excludeSelectors) {
      try {
        if (el.matches && el.matches(sel)) return true;
      } catch (e) { /* invalid selector, ignore */ }
    }
    return false;
  }

  function getCounter() {
    return parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0;
  }

  function incrementCounter() {
    const n = getCounter() + 1;
    try { localStorage.setItem(COUNTER_KEY, String(n)); } catch (e) {}
    return n;
  }

  function makeId() {
    return ID_PREFIX + '-' + incrementCounter();
  }

  function ensureId(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && String(el.id).trim() !== '') return el.id;
    if (el.dataset && el.dataset.autosaveId) {
      const cand = el.dataset.autosaveId;
      if (!document.getElementById(cand)) {
        try { el.id = cand; } catch (e) {}
      }
      return el.dataset.autosaveId;
    }
    const id = makeId();
    try { el.id = id; } catch (e) { /* ignore */ }
    try { if (el.dataset) el.dataset.autosaveId = id; } catch (e) {}
    return id;
  }

  function getState(el) {
    if (!el) return null;
    if (el.isContentEditable) {
      return el.innerHTML;
    } else if (el.tagName === 'SELECT') {
      return el.value;
    } else if (el.tagName === 'TEXTAREA') {
      return el.value;
    } else if (el.tagName === 'INPUT') {
      switch (el.type) {
        case 'checkbox':
        case 'radio':
          return el.checked;
        default:
          return el.value;
      }
    } else if (el.tagName === 'BUTTON') {
      if (el.hasAttribute('aria-pressed')) {
        return el.getAttribute('aria-pressed') === 'true';
      }
    }
    return null;
  }

  function setState(el, state) {
    if (state == null) return;
    if (el.isContentEditable) {
      el.innerHTML = state;
    } else if (el.tagName === 'SELECT') {
      el.value = state;
    } else if (el.tagName === 'TEXTAREA') {
      el.value = state;
    } else if (el.tagName === 'INPUT') {
      switch (el.type) {
        case 'checkbox':
        case 'radio':
          el.checked = !!state;
          break;
        default:
          el.value = String(state);
      }
    } else if (el.tagName === 'BUTTON') {
      if (!!state) {
        el.setAttribute('aria-pressed', 'true');
      } else {
        el.removeAttribute('aria-pressed');
      }
    }
  }

  function readStored(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeStored(key, arr) {
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.warn('Autosave: could not write to localStorage', e);
    }
  }

  function snapshotDynamic(containerEl) {
    if (!containerEl) return [];
    return Array.from(containerEl.children)
      .filter(n => n.nodeType === 1)
      .filter(n => !isExcluded(n))
      .map(btn => {
        const id = ensureId(btn);
        const label = (btn.textContent || '').trim();
        const pressed = btn.getAttribute('aria-pressed') === 'true';
        return { id: id, label: label, pressed: pressed };
      });
  }

  function saveNowDynamic() {
    loadExclude(); // read exclude list before saving anything
    const cont = document.getElementById('generated');
    if (!cont) return;
    const arr = snapshotDynamic(cont);
    writeStored(STORAGE_KEY, arr);
  }

  const saveDebouncedDynamic = debounce(saveNowDynamic, SAVE_DELAY);

  function updateStyle(btn) {
    if (!btn) return;
    btn.style.boxShadow = btn.hasAttribute('aria-pressed') ? '0 4px 10px rgba(2,6,23,0.08)' : '';
  }

  function attachToggleToRestored(btn) {
    if (!btn) return;
    if (btn.dataset && btn.dataset.autosaveToggleAttached === '1') return;
    btn.addEventListener('click', () => {
      btn.toggleAttribute('aria-pressed');
      updateStyle(btn);
    });
    try { if (btn.dataset) btn.dataset.autosaveToggleAttached = '1'; } catch (e) {}
    updateStyle(btn);
  }

  function restoreDynamic() {
    loadExclude(); // honour exclusions on restore too
    const cont = document.getElementById('generated');
    if (!cont) return;
    const arr = readStored(STORAGE_KEY);
    if (!Array.isArray(arr) || arr.length === 0) return;
    arr.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '').trim();
      const label = String(item.label || '').trim();
      const pressed = !!item.pressed;
      if (!id) return;
      let el = document.getElementById(id);
      if (!el) {
        el = Array.from(cont.children).find(c => c.dataset && c.dataset.autosaveId === id);
      }
      if (el) {
        if (isExcluded(el)) return; // skip excluded existing element
        if ((el.textContent || '').trim() !== label) el.textContent = label;
        const currentPressed = el.getAttribute('aria-pressed') === 'true';
        if (pressed !== currentPressed) {
          if (pressed) {
            el.setAttribute('aria-pressed', 'true');
          } else {
            el.removeAttribute('aria-pressed');
          }
        }
        attachToggleToRestored(el);
        updateStyle(el);
        el.dispatchEvent(new CustomEvent('autosave:restored', { bubbles: true, detail: { state: pressed } }));
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gen-btn';
        b.textContent = label;
        try { b.id = id; } catch (e) {}
        try { if (b.dataset) b.dataset.autosaveId = id; } catch (e) {}
        if (pressed) b.setAttribute('aria-pressed', 'true');
        if (isExcluded(b)) return; // don't recreate an excluded element
        attachToggleToRestored(b);
        updateStyle(b);
        b.dispatchEvent(new CustomEvent('autosave:restored', { bubbles: true, detail: { state: pressed } }));
        cont.appendChild(b);
      }
    });
    Array.from(cont.children).forEach(c => ensureId(c));
  }

  function observeDynamic() {
    const cont = document.getElementById('generated');
    if (!cont) return;
    Array.from(cont.children).forEach(n => ensureId(n));
    const mo = new MutationObserver(muts => {
      let changed = false;
      for (const m of muts) {
        if (m.type === 'childList' || m.type === 'characterData') { changed = true; }
        if (m.type === 'attributes') { changed = true; }
      }
      if (changed) saveDebouncedDynamic();
    });
    mo.observe(cont, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'data-autosave-id', 'aria-pressed']
    });
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => { setTimeout(saveNowDynamic, 30); }, true);
    }
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        setTimeout(() => { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }, 30);
      }, true);
    }
  }

  function snapshotStatic() {
    const els = document.querySelectorAll('input:not([type=password]), textarea, select, button, [contenteditable]');
    return Array.from(els)
      .filter(el => !isExcluded(el))
      .map(el => {
        const id = ensureId(el);
        const state = getState(el);
        if (state == null) return null;
        return { id, state };
      }).filter(Boolean);
  }

  function saveNowStatic() {
    loadExclude(); // read exclude list before saving anything
    const arr = snapshotStatic();
    writeStored(STATIC_KEY, arr);
    dlog('saved', arr.length, 'fields', arr);
  }

  const saveDebouncedStatic = debounce(saveNowStatic, SAVE_DELAY);

  function restoreStatic() {
    loadExclude(); // honour exclusions on restore too
    const arr = readStored(STATIC_KEY);
    if (!Array.isArray(arr) || arr.length === 0) return;
    arr.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '').trim();
      const state = item.state;
      if (!id) return;
      let el = document.getElementById(id);
      if (!el) {
        el = document.querySelector(`[data-autosave-id="${id}"]`);
      }
      if (el) {
        if (isExcluded(el)) return; // skip excluded element
        setState(el, state);
        el.dispatchEvent(new CustomEvent('autosave:restored', { bubbles: true, detail: { state } }));
      }
    });
  }

  // Delegated handler: works no matter when a field appears or gets
  // re-rendered/moved by the page (e.g. Blogger), because it listens on
  // document rather than on each element once at load.
  function onStaticEvent(e) {
    const t = e.target;
    if (!t || t.nodeType !== 1) return;
    const el = t.closest ? t.closest(STATIC_SELECTOR) : null;
    if (!el) return;
    ensureId(el);
    dlog(e.type, '->', el.id || '(no id)');
    saveDebouncedStatic();
  }

  function observeStatic() {
    // Capture phase (true) so nothing can stop these from firing.
    document.addEventListener('input', onStaticEvent, true);
    document.addEventListener('change', onStaticEvent, true);
    document.addEventListener('click', onStaticEvent, true);
    // Assign ids to whatever is present right now.
    document.querySelectorAll(STATIC_SELECTOR).forEach(ensureId);
  }

  function init() {
    try {
      loadExclude();
      restoreDynamic();
      restoreStatic();
      observeDynamic();
      observeStatic();
    } catch (e) {
      console.error('Autosave: unexpected error', e);
    }
    window.addEventListener('beforeunload', () => {
      saveNowDynamic();
      saveNowStatic();
    });
  }

  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Public API
  window.dexsins = window.dexsins || {};
  window.dexsins.autosave = window.dexsins.autosave || {};
  window.dexsins.autosave.exclude = addExclude;      // exclude('#x-id', '#y-id')
  window.dexsins.autosave.include = removeExclude;   // stop excluding
  window.dexsins.autosave.getExcludes = getExcludes; // current exclude list
  window.dexsins.autosave.clearExcludes = clearExcludes;
  window.dexsins.autosave.save = () => { saveNowDynamic(); saveNowStatic(); };
  window.dexsins.autosave.debug = (on) => { DEBUG = (on !== false); dlog('debug', DEBUG ? 'on' : 'off'); return DEBUG; };

  window.__autosave_force_restore_generated = restoreDynamic;
  window.__autosave_force_restore_static = restoreStatic;
})();
