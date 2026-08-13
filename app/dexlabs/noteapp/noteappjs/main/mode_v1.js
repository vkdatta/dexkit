// ============================================================================
// DexLabs — Mode switcher (note ⇄ diffusion) and pane orchestration.
//
// In note mode:
//   The visible editable textarea is #noteTextarea. currentNote is set by
//   openNote(). Nothing here does anything.
//
// In diffusion mode:
//   The visible editable textarea is STILL #noteTextarea. currentNote is
//   whichever pane is active: raw-bound-note or morph-bound-note.
//   Two hidden "shadow" textareas (#diffRawInput and #diffMorphInput) hold
//   the raw and morph contents so diffusion() can compare them without
//   being modified.
//
//   Switching Raw ↔ Morph via the bottom bar is literally openNote(otherId).
//   All existing note-app plumbing (updateNoteMetadata, saveNotes, undo,
//   voldemort, sidebar2 handlers, find/replace, sidebar1 highlight,
//   Drive sync) works with zero changes because the operative element
//   is always #noteTextarea and the operative object is always currentNote.
//
// Exiting diffusion: bindings are CLEARED (per spec). Editor reloads the
// most-recently-modified note.
// ============================================================================
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
    activePane:'raw',        // 'raw' | 'morph'
    rawNoteId: null,
    morphNoteId: null,
    activeDiffView: null     // when non-null: 'diffDiff1View' | 'diffDiff2View' | 'diffOptionsView'
  };
  window.dexMode = state;

  function $(id) { return document.getElementById(id); }
  function noteById(id) { return (typeof notes !== 'undefined' && Array.isArray(notes)) ? notes.find(n => String(n.id) === String(id)) : null; }
  function lsSet(k, v) { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, String(v)); }
  function lsGet(k) { return localStorage.getItem(k); }

  // ---------------------------------------------------------------------------
  // Shadow-textarea sync — mirror #noteTextarea into whichever pane is active
  // so diffusion() can compare against the inactive pane's shadow.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Diff-cell syntax highlighting (v2). CM's runMode addon tokenises text
  // outside of a full editor instance; we post-process each .diff-content-cell
  // that doesn't already contain inline diff spans (.tok-add / .tok-del)
  // and rewrite it with token <span>s. Cells with inline diff markers are
  // left alone — they retain diff colour but skip syntax colour.
  //
  // Which mode? Whichever CM mode is currently active (i.e. the raw-bound
  // note's extension governs). If syntax highlighting is disabled in
  // Settings, this is a no-op.
  // ---------------------------------------------------------------------------
  function highlightVisibleDiffView() {
    if (typeof CodeMirror === 'undefined' || typeof CodeMirror.runMode !== 'function') return;
    if (localStorage.getItem('prismEnabled') !== '1') return;
    if (!state.activeDiffView) return;
    if (state.activeDiffView !== 'diffDiff1View' && state.activeDiffView !== 'diffDiff2View') return;
    const view = $(state.activeDiffView);
    if (!view) return;

    // Tag the container with the current CM theme's class so runMode's
    // cm-keyword / cm-string / cm-number ... spans pick up the theme's colours.
    if (window.dexEditor && window.dexEditor.cm) {
      const theme = window.dexEditor.cm.getOption('theme') || 'dracula';
      // Strip any prior cm-s-* classes, then add the current one.
      view.classList.forEach(c => { if (c.startsWith('cm-s-')) view.classList.remove(c); });
      view.classList.add('cm-s-' + theme.replace(/\s+/g, '-'));
    }

    // Prefer raw-bound note's extension; fall back to morph.
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
      if (cell.querySelector('.tok-add, .tok-del')) return; // inline diff spans present — skip
      const text = cell.textContent;
      if (!text) return;
      if (cell.dataset.dexHl === text + '::' + mode) return;
      cell.textContent = '';
      try { CodeMirror.runMode(text, mode, cell); } catch (e) { cell.textContent = text; }
      cell.dataset.dexHl = text + '::' + mode;
    });
  }
  window.highlightVisibleDiffView = highlightVisibleDiffView;

  // Wire the editor's input event ONCE. On every keystroke in diffusion mode
  // we push the value into the active pane's shadow and re-run diffusion.
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

  // ---------------------------------------------------------------------------
  // View orchestration — the .note-container is visible when Raw or Morph is
  // active; a .diff-view (Diff1 / Diff2 / Options) is visible when one of
  // those is active on the bottom bar (topbar hidden in that case).
  // ---------------------------------------------------------------------------
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
    // Fullscreen — hide topbar and sidebar1
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

  // ---------------------------------------------------------------------------
  // Bottom-bar UI helpers.
  // ---------------------------------------------------------------------------
  function paintBottomBar() {
    document.querySelectorAll('#diffBottombar .diff-topbar-button').forEach(b => b.classList.remove('active'));
    let selector;
    if (state.activeDiffView) selector = '#diffBottombar .diff-topbar-button[data-target="' + state.activeDiffView + '"]';
    else selector = '#diffBottombar .diff-topbar-button[data-target="' + state.activePane + '"]';
    const btn = document.querySelector(selector);
    if (btn) btn.classList.add('active');
  }

  // ---------------------------------------------------------------------------
  // Pane switching (Raw ⇄ Morph). Loads the pane's bound note into the editor
  // via openNote() — that single call handles: setting currentNote, setting
  // noteTextarea.value, rebinding undo history, refreshing sidebar1 highlight,
  // updating document info, and re-rendering prism highlight.
  // ---------------------------------------------------------------------------
  function switchPane(pane) {
    if (!state.enabled) return;
    if (pane !== 'raw' && pane !== 'morph') return;

    // Flush editor into currentNote (belt-and-braces; input listener already does it debounced).
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}
    // Mirror current editor value into the outgoing pane's shadow before we lose it.
    syncActiveShadowFromEditor();

    state.activePane = pane;
    lsSet(LS.ACTIVE, pane);

    const targetId = pane === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (!targetId) {
      // Unbound pane → open picker. The editor keeps showing whatever was last there.
      openPicker(pane);
      paintBottomBar();
      showEditor();
      return;
    }

    const n = noteById(targetId);
    if (!n) {
      // Stale binding (note was deleted). Clear and prompt.
      if (pane === 'raw') { state.rawNoteId = null; lsSet(LS.RAW_ID, ''); }
      else                { state.morphNoteId = null; lsSet(LS.MORPH_ID, ''); }
      openPicker(pane);
      paintBottomBar();
      showEditor();
      return;
    }

    // Load the bound note as the current editable note.
    if (typeof openNote === 'function') openNote(n.id);

    // Refresh shadows: the newly-active pane's shadow tracks live editor; the
    // inactive pane's shadow gets seeded from its bound note's stored content.
    const inactive = pane === 'raw' ? 'morph' : 'raw';
    seedShadow(inactive);
    syncActiveShadowFromEditor();

    showEditor();
    paintBottomBar();
    scheduleDiffusion(true);
  }
  window.switchDiffusionPane = switchPane;

  // ---------------------------------------------------------------------------
  // Note picker (sidebar1 in "pick" mode) — reused when the user clicks an
  // unbound pane, or re-clicks an already-active pane.
  // ---------------------------------------------------------------------------
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
    // Load it into the editor immediately.
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

  // ---------------------------------------------------------------------------
  // Enter / exit diffusion mode. On enter: raw ← currentNote, morph ← unset.
  // On exit: bindings cleared, editor loads the most-recently-modified note.
  // ---------------------------------------------------------------------------
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

    // Seed both shadows so diffusion() has something to compare from t=0.
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
    exitBrowserFullscreen();
    const bb = $('diffBottombar');
    if (bb) bb.style.display = 'none';
    hidePickBanner();
    hideAllDiffViews();
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';

    // Load most recently modified note (if any).
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

  // ---------------------------------------------------------------------------
  // Bottom-bar click wiring.
  // ---------------------------------------------------------------------------
  function ensureBottomBarWired() {
    const bb = $('diffBottombar');
    if (!bb || bb.__dexWired) return;
    bb.__dexWired = true;
    // Delegated fallback — the primary path is inline onclick on each button
    // (via window.dexBottomClick below), but this catches anything that
    // somehow slips through (dynamic re-injection, etc.).
    bb.addEventListener('click', (e) => {
      const btn = e.target.closest('.diff-topbar-button');
      if (!btn) return;
      const target = btn.getAttribute('data-target');
      if (!target) return;
      handleBottomClick(target, btn);
    });
  }

  // Public — inline onclick handlers on the bottom-bar buttons call this
  // directly. Using an inline attribute pattern (matching the topbar) fires
  // synchronously on the button and pre-empts Chrome mobile's Touch to Search
  // gesture, which was intercepting the delegated-click path.
  window.dexBottomClick = function (target, btn) {
    handleBottomClick(target, btn);
  };

  function handleBottomClick(target, btn) {
    if (!state.enabled) return;
    if (target === 'raw' || target === 'morph') {
      // Re-clicking the already-active pane triggers the picker (rebind).
      const alreadyActive = !state.activeDiffView && state.activePane === target;
      if (alreadyActive) { openPicker(target); return; }
      // Only Raw / Morph exit browser fullscreen — Options keeps it (v2).
      exitBrowserFullscreen();
      switchPane(target);
      applyScrollTo(target);
      return;
    }
    // diff1 / diff2 / options — fullscreen the diff view; hide topbar + editor.
    showDiffView(target);
    paintBottomBar();
    applyScrollTo(target);
    // Browser fullscreen is entered when navigating to ANY of the three diff
    // views and persists across the diff1↔diff2↔options triad (v2). Only a
    // click on Raw or Morph (above) exits it.
    requestBrowserFullscreen();
  }

  // ---------------------------------------------------------------------------
  // Bootstrap.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Line-numbers: routed to CodeMirror's native gutter (option `lineNumbers`).
  // No more custom-gutter code — CM owns rendering, sync, and font-size math.
  // ---------------------------------------------------------------------------
  function applyLineNumberState(on) {
    document.body.classList.toggle('show-line-numbers', !!on);
    if (window.dexEditor && typeof window.dexEditor.setLineNumbers === 'function') {
      window.dexEditor.setLineNumbers(!!on);
    }
  }

  // ---------------------------------------------------------------------------
  // Predictive sync-scroll — tracks the current scroll position across the
  // editor (CM instance) and the two diff views, so switching Views via the
  // bottom bar lands you at the same scroll position on the other side.
  // Respects the Options-view checkbox #diffOptSyncScroll.
  // ---------------------------------------------------------------------------
  const scroll = { top: 0, left: 0, syncing: false };

  function scrollElFor(target) {
    if (target === 'raw' || target === 'morph') {
      // CM scroller is what actually scrolls in the editor.
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
    // CM scroll (raw/morph share this scroller).
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
    // Diff1 / Diff2 scroll containers.
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

  // ---------------------------------------------------------------------------
  // Browser fullscreen (requestFullscreen) — engaged for Diff 1 and Diff 2 only.
  // Raw / Morph / Options fall back to the app-level fullscreen (topbar hidden,
  // #diffViewport pinned). Fullscreen requests must be inside a user-gesture
  // handler; handleBottomClick() below satisfies that.
  // ---------------------------------------------------------------------------
  function isBrowserFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }
  function requestBrowserFullscreen() {
    if (isBrowserFullscreen()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) try { req.call(el); } catch (e) {}
  }
  function exitBrowserFullscreen() {
    if (!isBrowserFullscreen()) return;
    const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (ex) try { ex.call(document); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Options-view (Upload / Paste / Clear / Swap) hooks.
  //
  // setup3.js already calls `diffCommitPane(type)` after each op and
  // `diffSwapBindings()` inside `diffSwapTexts()` — these were originally
  // exported by the deleted d8.js. Now we define them here as the canonical
  // hooks. When they exist, setup3's operations flow through to the
  // underlying notes automatically — no polling + wrapping needed.
  // ---------------------------------------------------------------------------
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
    // If this pane is the active editor, mirror into the CM editor (via the
    // facade) so the user sees the change immediately.
    if (state.activePane === type) {
      if (window.dexEditor && typeof window.dexEditor.loadHistoryFor === 'function') {
        try { window.dexEditor.loadHistoryFor(n.id, n.content); } catch (e) {}
      } else if (window.dexEditor && typeof window.dexEditor.setValue === 'function') {
        try { window.dexEditor.setValue(n.content); } catch (e) {}
      }
    }
  }

  // Expose the hooks setup3.js is already looking for.
  window.diffCommitPane = function (type) { commitShadowToNote(type); };

  window.diffSwapBindings = function () {
    const tmp = state.rawNoteId;
    state.rawNoteId = state.morphNoteId;
    state.morphNoteId = tmp;
    lsSet(LS.RAW_ID, state.rawNoteId || '');
    lsSet(LS.MORPH_ID, state.morphNoteId || '');
    // The shadow values were already swapped by setup3. Persist both into
    // the (now-swapped) notes.
    commitShadowToNote('raw');
    commitShadowToNote('morph');
    // If a pane is currently active in the editor, reload it against the
    // newly-bound note.
    const activeId = state.activePane === 'raw' ? state.rawNoteId : state.morphNoteId;
    if (activeId && typeof openNote === 'function') try { openNote(activeId); } catch (e) {}
    paintBottomBar();
  };

  // Legacy no-op — setup3.js still calls this via `if (typeof diffSwapBindings…)`
  // pattern; kept for anyone who inspects window for it.
  function wireSetupWrappers() { /* no-op — hooks above replace the polling wrap */ }

  function init() {
    wireEditor();
    ensureBottomBarWired();
    wireSyncScroll();
    wireSetupWrappers();
    ensureBottomBarWired();
    wireSyncScroll();
    wireSetupWrappers();

    // If the editor hadn't finished mounting when we first wired sync-scroll,
    // wire it again once dexEditor is ready (CM scroller comes into being then).
    window.addEventListener('dexEditorReady', () => {
      wireSyncScroll();
      // Also apply the persisted syntax language for whatever note is open.
      if (window.dexEditor && typeof window.dexEditor.applyLanguageForCurrentNote === 'function') {
        try { window.dexEditor.applyLanguageForCurrentNote(); } catch (e) {}
      }
    });

    // Apply persisted settings (line numbers, syntax highlighting, wrap, app theme).
    const wantLineNumbers = localStorage.getItem(LS.LINENUM) === '1';
    applyLineNumberState(wantLineNumbers);

    const prismEnabled = localStorage.getItem('prismEnabled') === '1';
    document.body.classList.toggle('prism-off', !prismEnabled);

    // App theme (dark/light) — dark is the default; light is opt-in.
    const appThemeInit = localStorage.getItem('appTheme') === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = appThemeInit;

    // React to Settings-modal changes without a page reload.
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
        // Re-highlight (or clear highlight from) any currently-visible diff cells.
        if (!e.detail.value && state.activeDiffView) {
          const view = $(state.activeDiffView);
          if (view) view.querySelectorAll('.diff-content-cell').forEach(c => { delete c.dataset.dexHl; });
          // A re-render will happen on next scheduleDiffusion; force one now.
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
        // If the user hasn't picked a CM theme, follow the app theme's default.
        const cmExplicit = localStorage.getItem('cmTheme');
        if (!cmExplicit && window.dexEditor && typeof window.dexEditor.setTheme === 'function') {
          window.dexEditor.setTheme(next === 'light' ? 'eclipse' : 'dracula');
        }
      }
    });

    // Intercept sidebar1 toggle: in diffusion mode with a pane active, opening
    // sidebar1 goes straight to picker mode for that pane (per spec).
    const t = $('sidebar1Toggle');
    if (t && !t.__dexInterceptWired) {
      t.__dexInterceptWired = true;
      // We can't wrap the existing listener; instead, run BEFORE it in capture.
      t.addEventListener('click', (e) => {
        if (state.enabled && !state.activeDiffView) {
          // Only intercept "open" clicks — if sidebar1 is currently open, let default close it.
          const sb = $('sidebar1');
          if (sb && !sb.classList.contains('open')) {
            e.stopImmediatePropagation();
            openPicker(state.activePane);
          }
        }
      }, true);
    }

    // Restore diffusion state from a prior session — but only if we're
    // currently in the note app. On the homepage, don't restore; showNoteApp
    // calls this again after routing so late-navigators still get it.
    if (typeof currentApp === 'undefined' || currentApp === 'notes') {
      window.dexRestoreDiffusionIfSaved();
    }
  }

  // Public — index.html's showNoteApp() should call this after routing so a
  // user coming from the homepage into a note picks up their prior diffusion
  // session. Also called from init() when the page loads directly on the
  // note-app URL.
  //
  // Three cases handled:
  //   (a) state.enabled is already true (came back from homepage after
  //       showHomepage hid the UI without wiping state) — just re-show the
  //       bottom bar and mode-diffusion class.
  //   (b) state.enabled is false but LS says enabled AND notes are loaded —
  //       do the full restore.
  //   (c) LS says enabled but notes aren't loaded yet — retry shortly.
  //       This handles the refresh race where mode.js runs before loadNotes()
  //       populates the notes array.
  let _restoreRetries = 0;
  window.dexRestoreDiffusionIfSaved = function () {
    // Case (a) — state is already enabled in memory
    if (state.enabled) {
      document.body.classList.add('mode-diffusion');
      const bb = $('diffBottombar');
      if (bb) bb.style.display = 'flex';
      paintBottomBar();
      return;
    }

    // Fresh restore path
    const wasEnabled = localStorage.getItem(LS.ENABLED) === '1';
    const savedRaw   = localStorage.getItem(LS.RAW_ID);
    if (!wasEnabled || !savedRaw) { _restoreRetries = 0; return; }

    // Case (c) — notes not yet loaded from LS/Drive
    const notesReady = typeof notes !== 'undefined' && Array.isArray(notes) && notes.length > 0;
    if (!notesReady) {
      if (_restoreRetries++ < 40) {
        setTimeout(window.dexRestoreDiffusionIfSaved, 150);
      }
      return;
    }
    _restoreRetries = 0;

    // Case (b) — full restore
    if (!noteById(savedRaw)) return; // note was deleted between sessions

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
