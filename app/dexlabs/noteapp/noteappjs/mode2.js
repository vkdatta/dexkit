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
    if (immediate) { clearTimeout(diffusionTimer); diffusionTimer = null; diffusion(); return; }
    clearTimeout(diffusionTimer);
    diffusionTimer = setTimeout(() => { diffusionTimer = null; try { diffusion(); } catch (e) {} }, 120);
  }
  window.scheduleDiffusion = scheduleDiffusion;

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
    bb.addEventListener('click', (e) => {
      const btn = e.target.closest('.diff-topbar-button');
      if (!btn) return;
      const target = btn.getAttribute('data-target');
      if (!target) return;
      handleBottomClick(target, btn);
    });
  }

  function handleBottomClick(target, btn) {
    if (!state.enabled) return;
    if (target === 'raw' || target === 'morph') {
      // Re-clicking the already-active pane triggers the picker (rebind).
      const alreadyActive = !state.activeDiffView && state.activePane === target;
      if (alreadyActive) { openPicker(target); return; }
      // Leaving a diff view for the editor → drop browser fullscreen.
      exitBrowserFullscreen();
      switchPane(target);
      applyScrollTo(target);
      return;
    }
    // diff1 / diff2 / options — fullscreen the diff view; hide topbar + editor.
    showDiffView(target);
    paintBottomBar();
    applyScrollTo(target);
    // Browser fullscreen is reserved for the two diff panes (per spec).
    if (target === 'diffDiff1View' || target === 'diffDiff2View') requestBrowserFullscreen();
    else exitBrowserFullscreen();
  }

  // ---------------------------------------------------------------------------
  // Bootstrap.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Line-number gutter (optional; toggled by the "Show line numbers" setting).
  //
  // Render approach mirrors the original diff-app gutter (`i + '<br>'` via
  // innerHTML) — it produces the browser's own inline line-box positioning
  // which lines up exactly with a textarea's own line boxes when font-size,
  // line-height and padding match. `<div><br>` and textareas both wrap at
  // font-size × line-height per row, so alignment stays stable during scroll.
  //
  // The gutter's WIDTH scales with the current font-size and the digit count
  // of the largest visible line number, exposed as --gutter-width so the CSS
  // can shift the textarea + backdrops accordingly.
  //
  // When line numbers are on we also force the textarea to `wrap="off"` so
  // long lines don't produce more visual rows than logical lines — otherwise
  // the gutter shows one number per logical line but the textarea occupies
  // several visual rows for it and the alignment drifts.
  // ---------------------------------------------------------------------------
  let gutterRAF = null;
  function renderGutter() {
    const nt = $('noteTextarea');
    const g  = $('noteLineGutter');
    if (!nt || !g) return;
    if (gutterRAF) return;
    gutterRAF = requestAnimationFrame(() => {
      gutterRAF = null;
      // Copy typography + vertical padding so gutter rows align with text rows.
      const cs = getComputedStyle(nt);
      g.style.fontFamily    = cs.fontFamily;
      g.style.fontSize      = cs.fontSize;
      g.style.lineHeight    = cs.lineHeight;
      g.style.paddingTop    = cs.paddingTop;
      g.style.paddingBottom = cs.paddingBottom;
      const lines = (nt.value || '').split('\n').length;
      // Dynamic width: (digits × approximate monospace char-width) + horiz padding.
      const digits = Math.max(2, String(lines).length);
      const fontPx = parseFloat(cs.fontSize) || 14;
      const width  = Math.ceil(digits * fontPx * 0.62 + 22);
      g.style.width = width + 'px';
      document.documentElement.style.setProperty('--gutter-width', width + 'px');
      // Render numbers using <br> for browser-native inline line boxes.
      let html = '';
      for (let i = 1; i <= lines; i++) html += i + '<br>';
      g.innerHTML = html;
      g.scrollTop = nt.scrollTop;
    });
  }
  function applyLineNumberState(on) {
    document.body.classList.toggle('show-line-numbers', !!on);
    const nt = $('noteTextarea');
    if (nt) {
      // wrap="off" (hard-off) so long lines don't wrap into extra visual rows.
      // "soft" restores the default note-app behaviour.
      nt.setAttribute('wrap', on ? 'off' : 'soft');
    }
    if (on) renderGutter();
  }
  function wireLineNumberGutter() {
    const nt = $('noteTextarea');
    if (!nt || nt.__dexGutterWired) return;
    nt.__dexGutterWired = true;
    nt.addEventListener('input',  () => { if (document.body.classList.contains('show-line-numbers')) renderGutter(); });
    nt.addEventListener('scroll', () => {
      const g = $('noteLineGutter');
      if (g && document.body.classList.contains('show-line-numbers')) g.scrollTop = nt.scrollTop;
    });
    window.addEventListener('dexNoteOpened', () => {
      if (document.body.classList.contains('show-line-numbers')) renderGutter();
    });
    // React to inline style changes on the textarea (fontsize.js writes fontSize).
    if (window.MutationObserver && !nt.__dexFontObs) {
      nt.__dexFontObs = new MutationObserver(() => {
        if (document.body.classList.contains('show-line-numbers')) renderGutter();
      });
      nt.__dexFontObs.observe(nt, { attributes: true, attributeFilter: ['style'] });
    }
  }

  // ---------------------------------------------------------------------------
  // Predictive sync-scroll — tracks the current scroll position across the
  // editor (raw/morph) and the two diff views, so switching Views via the
  // bottom bar lands you at the same scroll position on the other side.
  // Respects the Options-view checkbox #diffOptSyncScroll.
  // ---------------------------------------------------------------------------
  const scroll = { top: 0, left: 0, syncing: false };
  function scrollElFor(target) {
    if (target === 'raw' || target === 'morph') return $('noteTextarea');
    if (target === 'diffDiff1View') return $('diffDiff1Scroll');
    if (target === 'diffDiff2View') return $('diffDiff2Scroll');
    return null;
  }
  function syncEnabled() {
    const cb = $('diffOptSyncScroll');
    return !!(cb && cb.checked);
  }
  function wireSyncScroll() {
    ['noteTextarea', 'diffDiff1Scroll', 'diffDiff2Scroll'].forEach(id => {
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
    const el = scrollElFor(target);
    if (!el) return;
    scroll.syncing = true;
    requestAnimationFrame(() => {
      el.scrollTop  = scroll.top;
      el.scrollLeft = scroll.left;
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
  // Options-view (Upload / Paste / Clear / Swap) — setup3.js writes to the
  // shadow textareas, which by themselves aren't the source of truth. Wrap
  // each function so the change also flows back into the underlying notes
  // and, if the edited pane is currently active, into #noteTextarea.
  // ---------------------------------------------------------------------------
  function commitShadowToNote(type) {
    if (!state.enabled) return;
    const shadow = type === 'raw' ? diffElements.raw : diffElements.morph;
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
    // If this pane is the active editor, mirror into #noteTextarea. Use the
    // undo manager if available so the change lands in the note's undo stack.
    if (state.activePane === type) {
      const nt = $('noteTextarea');
      if (nt) {
        if (typeof window.rebindUndoForNote === 'function') window.rebindUndoForNote(n.id, n.content);
        else nt.value = n.content;
      }
    }
  }

  function wrap(fnName, after) {
    const orig = window[fnName];
    if (typeof orig !== 'function' || orig.__dexWrapped) return;
    const wrapped = function () { const r = orig.apply(this, arguments); try { after.apply(null, arguments); } catch (e) {} return r; };
    wrapped.__dexWrapped = true;
    window[fnName] = wrapped;
  }

  function wireSetupWrappers() {
    // setup3.js loads asynchronously; poll briefly, then wrap.
    let tries = 0;
    (function attempt() {
      if (typeof window.diffHandleFile === 'function' &&
          typeof window.diffPasteText  === 'function' &&
          typeof window.diffClearText  === 'function' &&
          typeof window.diffSwapTexts  === 'function') {
        wrap('diffHandleFile', (_input, type) => commitShadowToNote(type));
        wrap('diffPasteText',  (type)         => commitShadowToNote(type));
        wrap('diffClearText',  (type)         => commitShadowToNote(type));
        wrap('diffSwapTexts',  ()             => {
          // Swap the two panes' bindings AND commit both shadows.
          const tmp = state.rawNoteId;
          state.rawNoteId = state.morphNoteId;
          state.morphNoteId = tmp;
          lsSet(LS.RAW_ID, state.rawNoteId || '');
          lsSet(LS.MORPH_ID, state.morphNoteId || '');
          commitShadowToNote('raw');
          commitShadowToNote('morph');
        });
        return;
      }
      if (tries++ > 100) return;
      setTimeout(attempt, 60);
    })();
  }

  function init() {
    wireEditor();
    ensureBottomBarWired();
    wireLineNumberGutter();
    wireSyncScroll();
    wireSetupWrappers();

    // Apply persisted checkbox settings (line numbers + prism).
    const wantLineNumbers = localStorage.getItem(LS.LINENUM) === '1';
    applyLineNumberState(wantLineNumbers);

    const prismDisabled = localStorage.getItem('prismEnabled') !== '1';
    document.body.classList.toggle('prism-off', prismDisabled);

    // React to Settings-modal changes without a page reload.
    window.addEventListener('dexSettingsChanged', (e) => {
      if (!e || !e.detail) return;
      if (e.detail.key === LS.LINENUM) {
        applyLineNumberState(!!e.detail.value);
      }
      if (e.detail.key === 'prismEnabled') {
        document.body.classList.toggle('prism-off', !e.detail.value);
        if (typeof window.immediatePlainRender === 'function' && !e.detail.value) window.immediatePlainRender();
        try { window.dispatchEvent(new CustomEvent('dexNoteOpened', { detail: { note: (typeof currentNote !== 'undefined' ? currentNote : null) } })); } catch (err) {}
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

    // Diffusion persistence: if the last session left diffusion enabled and a
    // valid raw binding, resume it. Otherwise start in note mode.
    const wasEnabled = lsGet(LS.ENABLED) === '1';
    const savedRaw   = lsGet(LS.RAW_ID);
    if (wasEnabled && savedRaw && noteById(savedRaw)) {
      // Silent restore — no notification.
      state.rawNoteId   = savedRaw;
      state.morphNoteId = (lsGet(LS.MORPH_ID) && noteById(lsGet(LS.MORPH_ID))) ? lsGet(LS.MORPH_ID) : null;
      state.activePane  = (lsGet(LS.ACTIVE) === 'morph') ? 'morph' : 'raw';
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
    }
  }

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
