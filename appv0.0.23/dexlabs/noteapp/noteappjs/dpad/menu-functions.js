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
    if (cm.__dexCursorActivityBound) return;
    cm.__dexCursorActivityBound = true;

    // FIX (perf): styleSelectedText adds a CM overlay that rewrites DOM on
    // every selection change — costly with no visible benefit over CM's built-
    // in selection rendering. Removed.

    cm.on('cursorActivity', () => {
      const hasSel = cm.somethingSelected();
      // FIX (perf / bug #5): only run menu/preview work when there is actually
      // a selection. Plain cursor moves (every keystroke) used to burn through
      // menuOpen() DOM queries, setSelectionAnchor, updateCenterHandle, and a
      // charCoords() layout reflow unconditionally.
      if (!hasSel) {
        if (menuOpen()) closeMenu();
        ctx.setSelectionAnchor(cm.getCursor('head'));
        return; // skip preview update — nothing to preview
      }
      updateCenterHandle();
      updateSelectionPreview();
    });
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
})();
