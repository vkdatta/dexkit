(function () {
  const LS = {
    ENABLED:   'diffusionEnabled',
    ACTIVE:    'diffusionActivePane',
    RAW_ID:    'diffRawNoteId',
    MORPH_ID:  'diffMorphNoteId',
    LINENUM:   'showLineNumbers',
    PRISM:     'prismEnabled'
  };

  const state = {
    enabled:   false,
    activePane:'raw',        
    rawNoteId: null,
    morphNoteId: null,
    activeDiffView: null     
  };
  window.dexMode = state;

  function $(id) { return document.getElementById(id); }
  function noteById(id) { return (typeof notes !== 'undefined' && Array.isArray(notes)) ? notes.find(n => String(n.id) === String(id)) : null; }
  function lsSet(k, v) { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, String(v)); }
  function lsGet(k) { return localStorage.getItem(k); }

  function shadowFor(pane) {
    if (typeof diffElements === 'undefined') return null;
    return pane === 'raw' ? diffElements.raw : diffElements.morph;
  }

  function seedShadow(pane) {
    const sh = shadowFor(pane);
    if (!sh) return;
    const nid = pane === 'raw' ? state.rawNoteId : state.morphNoteId;
    const n = nid ? noteById(nid) : null;
    sh.value = n ? (n.content || '') : '';
  }

  function syncActiveShadowFromEditor() {
    if (!state.enabled) return;
    const nt = $('noteTextarea');
    const sh = shadowFor(state.activePane);
    if (nt && sh && sh !== nt) sh.value = nt.value;
  }

  let diffusionTimer = null;
  function scheduleDiffusion(immediate) {
    if (!state.enabled) return;
    if (typeof diffusion !== 'function') return;
    if (immediate) {
      clearTimeout(diffusionTimer); diffusionTimer = null;
      try { diffusion(); } catch (e) {}
      highlightVisibleDiffView();
      return;
    }
    clearTimeout(diffusionTimer);
    diffusionTimer = setTimeout(() => {
      diffusionTimer = null;
      try { diffusion(); } catch (e) {}
      highlightVisibleDiffView();
    }, 120);
  }
  window.scheduleDiffusion = scheduleDiffusion;

  function highlightVisibleDiffView() {
    if (typeof CodeMirror === 'undefined' || typeof CodeMirror.runMode !== 'function') return;
    if (localStorage.getItem('prismEnabled') !== '1') return;
    if (!state.activeDiffView) return;
    if (state.activeDiffView !== 'diffDiff1View' && state.activeDiffView !== 'diffDiff2View') return;
    const view = $(state.activeDiffView);
    if (!view) return;

    if (window.dexEditor && window.dexEditor.cm) {
      const theme = window.dexEditor.cm.getOption('theme') || 'dracula';
      view.classList.forEach(c => { if (c.startsWith('cm-s-')) view.classList.remove(c); });
      view.classList.add('cm-s-' + theme.replace(/\s+/g, '-'));
    }

    const rawNote   = state.rawNoteId   ? noteById(state.rawNoteId)   : null;
    const morphNote = state.morphNoteId ? noteById(state.morphNoteId) : null;
    const ext = (rawNote && rawNote.extension) || (morphNote && morphNote.extension) || 'txt';
    let mode = 'text/plain';
    if (typeof CodeMirror.findModeByExtension === 'function') {
      const info = CodeMirror.findModeByExtension(String(ext).replace(/^\./, '').toLowerCase());
      if (info) {
        mode = info.mime || info.mode;
        if (info.mode && info.mode !== 'null' && typeof CodeMirror.autoLoadMode === 'function' && window.dexEditor && window.dexEditor.cm) {
          try { CodeMirror.autoLoadMode(window.dexEditor.cm, info.mode); } catch (e) {}
        }
      }
    }
    if (mode === 'null' || mode === 'text/plain') return;
    const cells = view.querySelectorAll('.diff-content-cell');
    cells.forEach(cell => {
      if (cell.querySelector('.tok-add, .tok-del')) return; 
      const text = cell.textContent;
      if (!text) return;
      if (cell.dataset.dexHl === text + '::' + mode) return;
      cell.textContent = '';
      try { CodeMirror.runMode(text, mode, cell); } catch (e) { cell.textContent = text; }
      cell.dataset.dexHl = text + '::' + mode;
    });
  }
  window.highlightVisibleDiffView = highlightVisibleDiffView;

  function wireEditor() {
    const nt = $('noteTextarea');
    if (!nt || nt.__dexModeWired) return;
    nt.__dexModeWired = true;
    nt.addEventListener('input', () => {
      if (!state.enabled) return;
      syncActiveShadowFromEditor();
      scheduleDiffusion();
    });
  }

  function hideAllDiffViews() {
    document.querySelectorAll('.diff-view').forEach(v => v.classList.remove('active'));
    const vp = $('diffViewport');
    if (vp) vp.style.display = 'none';
  }

  function showDiffView(viewId) {
    hideAllDiffViews();
    const vp = $('diffViewport');
    const v = $(viewId);
    if (vp) vp.style.display = 'block';
    if (v) v.classList.add('active');
    state.activeDiffView = viewId;
    document.body.classList.add('diff-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = 'none';
    if (typeof closeSidebar === 'function') closeSidebar();
    if (viewId === 'diffDiff1View' || viewId === 'diffDiff2View') scheduleDiffusion(true);
  }

  function showEditor() {
    hideAllDiffViews();
    state.activeDiffView = null;
    document.body.classList.remove('diff-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';
  }

  function paintBottomBar() {
    document.querySelectorAll('#diffBottombar .diff-topbar-button').forEach(b => b.classList.remove('active'));
    let selector;
    if (state.activeDiffView) selector = '#diffBottombar .diff-topbar-button[data-target="' + state.activeDiffView + '"]';
    else selector = '#diffBottombar .diff-topbar-button[data-target="' + state.activePane + '"]';
    const btn = document.querySelector(selector);
    if (btn) btn.classList.add('active');
  }

  function switchPane(pane) {
    if (!state.enabled) return;
    if (pane !== 'raw' && pane !== 'morph') return;

    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}
    syncActiveShadowFromEditor();

    state.activePane = pane;
    lsSet(LS.ACTIVE, pane);

    const targetId = pane === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (!targetId) {
      openPicker(pane);
      paintBottomBar();
      showEditor();
      return;
    }

    const n = noteById(targetId);
    if (!n) {
      if (pane === 'raw') { state.rawNoteId = null; lsSet(LS.RAW_ID, ''); }
      else                { state.morphNoteId = null; lsSet(LS.MORPH_ID, ''); }
      openPicker(pane);
      paintBottomBar();
      showEditor();
      return;
    }

    if (typeof openNote === 'function') openNote(n.id);

    const inactive = pane === 'raw' ? 'morph' : 'raw';
    seedShadow(inactive);
    syncActiveShadowFromEditor();

    showEditor();
    paintBottomBar();
    scheduleDiffusion(true);
  }
  window.switchDiffusionPane = switchPane;

  function showPickBanner(pane) {
    hidePickBanner();
    const sb = $('sidebar1');
    if (!sb) return;
    const b = document.createElement('div');
    b.id = 'diffPickBanner';
    b.className = 'diff-pick-banner';
    b.innerHTML = '<span>Pick a note for <b>' + (pane === 'raw' ? 'Raw' : 'Morph') + '</b></span>' +
                  '<button onclick="dexCancelPick()">Cancel</button>';
    sb.insertBefore(b, sb.firstChild);
  }
  function hidePickBanner() { const b = $('diffPickBanner'); if (b) b.remove(); }

  function openPicker(pane) {
    window.__dexNotePick = function (noteId) { bindPicked(pane, noteId); };
    const sb = $('sidebar1');
    if (sb) sb.classList.add('open');
    if (typeof renderSidebar === 'function') try { renderSidebar(); } catch (e) {}
    showPickBanner(pane);
    if (typeof showNotification === 'function') showNotification('Pick a note for ' + (pane === 'raw' ? 'Raw' : 'Morph'));
  }

  function bindPicked(pane, noteId) {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
    const n = noteById(noteId);
    if (!n) return;
    if (pane === 'raw')  { state.rawNoteId   = String(n.id); lsSet(LS.RAW_ID,   n.id); }
    else                 { state.morphNoteId = String(n.id); lsSet(LS.MORPH_ID, n.id); }
    state.activePane = pane;
    lsSet(LS.ACTIVE, pane);
    if (typeof openNote === 'function') openNote(n.id);
    const inactive = pane === 'raw' ? 'morph' : 'raw';
    seedShadow(inactive);
    syncActiveShadowFromEditor();
    showEditor();
    paintBottomBar();
    scheduleDiffusion(true);
    if (typeof showNotification === 'function') showNotification((pane === 'raw' ? 'Raw' : 'Morph') + ' ← ' + (n.title || 'note'));
  }

  window.dexCancelPick = function () {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
  };

  function enter() {
    if (state.enabled) return;
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}

    state.rawNoteId   = (typeof currentNote !== 'undefined' && currentNote) ? String(currentNote.id) : null;
    state.morphNoteId = null;
    state.activePane  = 'raw';
    state.enabled     = true;
    state.activeDiffView = null;

    lsSet(LS.ENABLED, '1');
    lsSet(LS.ACTIVE, 'raw');
    lsSet(LS.RAW_ID, state.rawNoteId || '');
    lsSet(LS.MORPH_ID, '');

    document.body.classList.add('mode-diffusion');
    const bb = $('diffBottombar');
    if (bb) bb.style.display = 'flex';
    ensureBottomBarWired();

    seedShadow('raw');
    seedShadow('morph');
    syncActiveShadowFromEditor();
    showEditor();
    paintBottomBar();
    scheduleDiffusion(true);

    if (typeof showNotification === 'function') showNotification('Diffusion mode enabled — pick Morph to compare');
  }

  function exit() {
    if (!state.enabled) return;
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}

    state.rawNoteId   = null;
    state.morphNoteId = null;
    state.enabled     = false;
    state.activePane  = 'raw';
    state.activeDiffView = null;

    lsSet(LS.ENABLED, '');
    lsSet(LS.ACTIVE, '');
    lsSet(LS.RAW_ID, '');
    lsSet(LS.MORPH_ID, '');

    document.body.classList.remove('mode-diffusion', 'diff-fullscreen');
    const bb = $('diffBottombar');
    if (bb) bb.style.display = 'none';
    hidePickBanner();
    hideAllDiffViews();
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';

    if (typeof notes !== 'undefined' && Array.isArray(notes) && notes.length) {
      const sorted = notes.slice().sort((a, b) => {
        const ta = new Date(a.lastEdited || 0).getTime();
        const tb = new Date(b.lastEdited || 0).getTime();
        return tb - ta;
      });
      const latest = sorted[0];
      if (latest && typeof openNote === 'function') openNote(latest.id);
    }

    if (typeof showNotification === 'function') showNotification('Diffusion mode disabled');
  }

  window.enterDiffusionMode = enter;
  window.exitDiffusionMode = exit;

  function ensureBottomBarWired() {
    const bb = $('diffBottombar');
    if (!bb || bb.__dexWired) return;
    bb.__dexWired = true;
    bb.addEventListener('click', (e) => {
      const btn = e.target.closest('.diff-topbar-button');
      if (!btn) return;
      const target = btn.getAttribute('data-target');
      if (!target) return;
      handleBottomClick(target, btn);
    });
  }

  window.dexBottomClick = function (target, btn) {
    handleBottomClick(target, btn);
  };

  function handleBottomClick(target, btn) {
    if (!state.enabled) return;
    if (target === 'raw' || target === 'morph') {
      const alreadyActive = !state.activeDiffView && state.activePane === target;
      if (alreadyActive) { openPicker(target); return; }
      switchPane(target);
      applyScrollTo(target);
      return;
    }
    showDiffView(target);
    paintBottomBar();
    applyScrollTo(target);
  }

  function applyLineNumberState(on) {
    document.body.classList.toggle('show-line-numbers', !!on);
    if (window.dexEditor && typeof window.dexEditor.setLineNumbers === 'function') {
      window.dexEditor.setLineNumbers(!!on);
    }
  }

  const scroll = { top: 0, left: 0, syncing: false };

  function scrollElFor(target) {
    if (target === 'raw' || target === 'morph') {
      return (window.dexEditor && window.dexEditor.cm) ? window.dexEditor.cm.getScrollerElement() : null;
    }
    if (target === 'diffDiff1View') return $('diffDiff1Scroll');
    if (target === 'diffDiff2View') return $('diffDiff2Scroll');
    return null;
  }
  function syncEnabled() {
    const cb = $('diffOptSyncScroll');
    return !!(cb && cb.checked);
  }
  function wireSyncScroll() {
    if (window.dexEditor && window.dexEditor.cm) {
      const scroller = window.dexEditor.cm.getScrollerElement();
      if (scroller && !scroller.__dexScrollWired) {
        scroller.__dexScrollWired = true;
        window.dexEditor.cm.on('scroll', () => {
          if (scroll.syncing) return;
          if (!syncEnabled()) return;
          const info = window.dexEditor.cm.getScrollInfo();
          scroll.top  = info.top;
          scroll.left = info.left;
        });
      }
    }
    ['diffDiff1Scroll', 'diffDiff2Scroll'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.__dexScrollWired) return;
      el.__dexScrollWired = true;
      el.addEventListener('scroll', () => {
        if (scroll.syncing) return;
        if (!syncEnabled()) return;
        scroll.top  = el.scrollTop;
        scroll.left = el.scrollLeft;
      });
    });
  }
  function applyScrollTo(target) {
    if (!syncEnabled()) return;
    scroll.syncing = true;
    requestAnimationFrame(() => {
      if (target === 'raw' || target === 'morph') {
        if (window.dexEditor && window.dexEditor.cm) window.dexEditor.cm.scrollTo(scroll.left, scroll.top);
      } else {
        const el = scrollElFor(target);
        if (el) { el.scrollTop = scroll.top; el.scrollLeft = scroll.left; }
      }
      requestAnimationFrame(() => { scroll.syncing = false; });
    });
  }

  function commitShadowToNote(type) {
    if (!state.enabled) return;
    const shadow = type === 'raw' ? (typeof diffElements !== 'undefined' && diffElements.raw)
                                  : (typeof diffElements !== 'undefined' && diffElements.morph);
    if (!shadow) return;
    const nid = type === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (!nid) return;
    const n = noteById(nid);
    if (!n) return;
    if (n.content === shadow.value) return;
    n.content = shadow.value;
    n.lastEdited = new Date().toISOString();
    n._dirty = true;
    if (typeof saveNotes === 'function') try { saveNotes(); } catch (e) {}
    if (typeof populateNoteList === 'function') try { populateNoteList(); } catch (e) {}
    if (state.activePane === type) {
      if (window.dexEditor && typeof window.dexEditor.loadHistoryFor === 'function') {
        try { window.dexEditor.loadHistoryFor(n.id, n.content); } catch (e) {}
      } else if (window.dexEditor && typeof window.dexEditor.setValue === 'function') {
        try { window.dexEditor.setValue(n.content); } catch (e) {}
      }
    }
  }

  window.diffCommitPane = function (type) { commitShadowToNote(type); };

  window.diffSwapBindings = function () {
    const tmp = state.rawNoteId;
    state.rawNoteId = state.morphNoteId;
    state.morphNoteId = tmp;
    lsSet(LS.RAW_ID, state.rawNoteId || '');
    lsSet(LS.MORPH_ID, state.morphNoteId || '');
    commitShadowToNote('raw');
    commitShadowToNote('morph');
    const activeId = state.activePane === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (activeId && typeof openNote === 'function') try { openNote(activeId); } catch (e) {}
    paintBottomBar();
  };

  function wireSetupWrappers() {  }

  function init() {
    wireEditor();
    ensureBottomBarWired();
    wireSyncScroll();
    wireSetupWrappers();
    ensureBottomBarWired();
    wireSyncScroll();
    wireSetupWrappers();

    window.addEventListener('dexEditorReady', () => {
      wireSyncScroll();
      if (window.dexEditor && typeof window.dexEditor.applyLanguageForCurrentNote === 'function') {
        try { window.dexEditor.applyLanguageForCurrentNote(); } catch (e) {}
      }
    });

    const wantLineNumbers = localStorage.getItem(LS.LINENUM) === '1';
    applyLineNumberState(wantLineNumbers);

    const prismEnabled = localStorage.getItem('prismEnabled') === '1';
    document.body.classList.toggle('prism-off', !prismEnabled);

    const appThemeInit = localStorage.getItem('appTheme') === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = appThemeInit;

    window.addEventListener('dexSettingsChanged', (e) => {
      if (!e || !e.detail) return;
      const k = e.detail.key;
      if (k === LS.LINENUM) {
        applyLineNumberState(!!e.detail.value);
      }
      if (k === 'prismEnabled') {
        document.body.classList.toggle('prism-off', !e.detail.value);
        if (window.dexEditor && typeof window.dexEditor.applyLanguageForCurrentNote === 'function') {
          try { window.dexEditor.applyLanguageForCurrentNote(); } catch (err) {}
        }
        if (!e.detail.value && state.activeDiffView) {
          const view = $(state.activeDiffView);
          if (view) view.querySelectorAll('.diff-content-cell').forEach(c => { delete c.dataset.dexHl; });
          try { if (typeof diffusion === 'function') diffusion(); } catch (err) {}
        } else {
          highlightVisibleDiffView();
        }
      }
      if (k === 'wrapText') {
        if (window.dexEditor && typeof window.dexEditor.setWrap === 'function') {
          window.dexEditor.setWrap(!!e.detail.value);
        }
      }
      if (k === 'cmTheme') {
        if (window.dexEditor && typeof window.dexEditor.setTheme === 'function') {
          window.dexEditor.setTheme(e.detail.value);
        }
      }
      if (k === 'appTheme') {
        const next = e.detail.value === 'light' ? 'light' : 'dark';
        document.body.dataset.theme = next;
        const cmExplicit = localStorage.getItem('cmTheme');
        if (!cmExplicit && window.dexEditor && typeof window.dexEditor.setTheme === 'function') {
          window.dexEditor.setTheme(next === 'light' ? 'eclipse' : 'dracula');
        }
      }
    });

    const t = $('sidebar1Toggle');
    if (t && !t.__dexInterceptWired) {
      t.__dexInterceptWired = true;
      t.addEventListener('click', (e) => {
        if (state.enabled && !state.activeDiffView) {
          const sb = $('sidebar1');
          if (sb && !sb.classList.contains('open')) {
            e.stopImmediatePropagation();
            openPicker(state.activePane);
          }
        }
      }, true);
    }

    if (typeof currentApp === 'undefined' || currentApp === 'notes') {
      window.dexRestoreDiffusionIfSaved();
    }
  }

  let _restoreRetries = 0;
  window.dexRestoreDiffusionIfSaved = function () {
    if (state.enabled) {
      document.body.classList.add('mode-diffusion');
      const bb = $('diffBottombar');
      if (bb) bb.style.display = 'flex';
      paintBottomBar();
      return;
    }

    const wasEnabled = localStorage.getItem(LS.ENABLED) === '1';
    const savedRaw   = localStorage.getItem(LS.RAW_ID);
    if (!wasEnabled || !savedRaw) { _restoreRetries = 0; return; }

    const notesReady = typeof notes !== 'undefined' && Array.isArray(notes) && notes.length > 0;
    if (!notesReady) {
      if (_restoreRetries++ < 40) {
        setTimeout(window.dexRestoreDiffusionIfSaved, 150);
      }
      return;
    }
    _restoreRetries = 0;

    if (!noteById(savedRaw)) return; 

    state.rawNoteId   = savedRaw;
    state.morphNoteId = (localStorage.getItem(LS.MORPH_ID) && noteById(localStorage.getItem(LS.MORPH_ID)))
                       ? localStorage.getItem(LS.MORPH_ID) : null;
    state.activePane  = (localStorage.getItem(LS.ACTIVE) === 'morph') ? 'morph' : 'raw';
    state.enabled     = true;
    document.body.classList.add('mode-diffusion');
    const bb = $('diffBottombar');
    if (bb) bb.style.display = 'flex';
    seedShadow('raw');
    seedShadow('morph');
    const activeId = state.activePane === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (activeId && typeof openNote === 'function') openNote(activeId);
    syncActiveShadowFromEditor();
    showEditor();
    paintBottomBar();
    scheduleDiffusion(true);
  };

  function waitForNotesThenInit() {
    let tries = 0;
    (function c() {
      if (typeof notes !== 'undefined' && Array.isArray(notes) && document.getElementById('noteTextarea')) return init();
      if (tries++ > 200) return init();
      setTimeout(c, 40);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForNotesThenInit);
  else waitForNotesThenInit();
})();
