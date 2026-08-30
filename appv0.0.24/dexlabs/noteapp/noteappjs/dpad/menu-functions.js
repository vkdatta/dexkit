(function () {
  const ctx = window.__dexDpad;
  if (!ctx || !ctx.cursorControls) {
    console.error('[menu-functions] dpad-layout.js must load first');
    return;
  }
  if (ctx.__menuFunctionsLoaded) return;
  ctx.__menuFunctionsLoaded = true;

  const { menuOpen, closeMenu, updateCenterHandle, updateSelectionPreview, updateToolbarVisibility } = ctx;

  // Issue 6: copy/cut/paste/delete/select-all/diff actions used to be wired
  // here against the dpad's own #dexToolbarMenu buttons. That menu is gone —
  // native-menu.js's codeMirrorActions() now covers the same ground (plus
  // the diff-mode extras) for whatever the dpad selects, so this file is
  // left with only the selection-tracking/native-UI-suppression plumbing
  // that isn't menu-specific.

  function attachCursorActivity() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(attachCursorActivity, 300); return; }

    // FIX (editor replacement / bug #25 mirror): remove the cursorActivity
    // handler from the previous CM instance before attaching to the new one.
    // The previous instance is tracked on the function itself, mirroring
    // native-menu.js's hookCodeMirror._boundCm pattern. Without removal the
    // old handler stays alive on the stale CM object and can re-show D-pad UI
    // (updateCenterHandle, updateSelectionPreview) for a discarded editor.
    const prevCm = attachCursorActivity._boundCm;
    if (prevCm && prevCm !== cm && typeof prevCm.off === 'function'
        && prevCm.__dexMenuFnHandler) {
      try { prevCm.off('cursorActivity', prevCm.__dexMenuFnHandler); } catch (_e) {}
      prevCm.__dexMenuFnHandler = null;
      prevCm.__dexCursorActivityBound = false;
    }
    attachCursorActivity._boundCm = cm;

    if (cm.__dexCursorActivityBound) return;
    cm.__dexCursorActivityBound = true;

    // FIX (perf): styleSelectedText adds a CM overlay that rewrites DOM on
    // every selection change — costly with no visible benefit over CM's built-
    // in selection rendering. Removed.

    const menuFnHandler = () => {
      const hasSel = cm.somethingSelected();
      // FIX (perf / bug #5): only run menu/preview work when there is actually
      // a selection. Plain cursor moves (every keystroke) used to burn through
      // menuOpen() DOM queries, setSelectionAnchor, updateCenterHandle, and a
      // charCoords() layout reflow unconditionally.
      if (!hasSel) {
        // FIX (bug #9 / surface isolation): pass 'codemirror' so we only cancel
        // the CM surface's pending timer — not the diff or generic timers that
        // native-menu.js carefully scopes by surface. Calling closeMenu() with
        // no argument nukes all three surface timers simultaneously, which is a
        // regression against the surface-isolation work in native-menu.js.
        if (menuOpen()) closeMenu('codemirror');
        ctx.setSelectionAnchor(cm.getCursor('head'));
        // FIX (C1 / P0): hide the selection preview explicitly when there is no
        // longer a selection. Previously this path returned without calling any
        // preview-hide function, so the D-pad preview bubble persisted on screen
        // indefinitely after the selection was collapsed or the D-pad was closed.
        // updateSelectionPreview() is idempotent — when called with no active CM
        // selection it hides itself, so every code path now gets correct behaviour
        // without callers needing to know the preview's internal state.
        if (typeof ctx.hideSelectionPreview === 'function') {
          ctx.hideSelectionPreview();
        } else {
          updateSelectionPreview();
        }
        return;
      }

      // FIX (bug #14): if Find is open, its focusCurrentMatch() drives the CM
      // selection — we must not update the D-pad center handle or selection
      // preview in response, because collapseDpad() was already called when
      // Find opened. Doing so would re-show D-pad UI that was intentionally
      // suppressed. Native-menu.js already guards this path; mirror it here.
      const findMenu = document.getElementById('find-replace-menu');
      if (findMenu && !findMenu.classList.contains('find-replace-hidden')) return;

      // FIX (bug #5 / C3): skip D-pad UI updates while the joystick center drag
      // is active. The drag loop calls updateCenterHandle/updateSelectionPreview
      // itself on every tick; a redundant call here from cursorActivity causes
      // double-updates and, more critically, the native-menu scheduleMenu()
      // fires because cursorActivity is emitted by every cm.setSelection() in
      // the drag loop. Returning early here is cheap and correct.
      const dpad = window.__dexDpad;
      if (dpad) {
        // Guard both the collapsed-centre drag (already guarded in native-menu)
        // and the normal expanded-centre drag exposed via ctx.startCenterDrag.
        const collapsedDragging = typeof dpad.getCollapsedCenterDrag === 'function'
          && dpad.getCollapsedCenterDrag();
        const normalDragging = typeof dpad.isCenterDragging === 'function'
          && dpad.isCenterDragging();
        if (collapsedDragging || normalDragging) return;
      }

      updateCenterHandle();
      updateSelectionPreview();
    };
    cm.on('cursorActivity', menuFnHandler);
    // Store for removal when the editor is replaced (see prevCm cleanup above).
    cm.__dexMenuFnHandler = menuFnHandler;
  }

  function suppressNativeSelectionUI() {
    const attach = () => {
      const cmEl = document.querySelector('.CodeMirror');
      if (!cmEl) { setTimeout(attach, 200); return; }
      if (cmEl.__dexNoNativeUI) return;
      cmEl.__dexNoNativeUI = true;

      cmEl.style.webkitTouchCallout = 'none';
      const scroller = cmEl.querySelector('.CodeMirror-scroll');
      if (scroller) scroller.style.webkitTouchCallout = 'none';

      cmEl.addEventListener('contextmenu', (e) => e.preventDefault());
      cmEl.addEventListener('selectstart', (e) => e.preventDefault());
    };
    attach();
  }

  function init() {
    updateToolbarVisibility();
    attachCursorActivity();
    suppressNativeSelectionUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('popstate',   updateToolbarVisibility);
  window.addEventListener('hashchange', updateToolbarVisibility);
  window.addEventListener('dexEditorReady', attachCursorActivity);

  // FIX (editor replacement / bug #25 mirror): periodically detect whether
  // dexEditor.cm has been replaced by SPA navigation. dexEditorReady covers the
  // case where the editor fires the event itself; this poll covers silent
  // replacements (e.g. a router that recreates the CM instance without firing
  // the event). Matches the setInterval pattern in native-menu.js.
  setInterval(() => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (cm && attachCursorActivity._boundCm !== cm) attachCursorActivity();
  }, 1000);
})();
