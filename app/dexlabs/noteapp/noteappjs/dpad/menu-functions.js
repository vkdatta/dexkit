/* ================================================================
   menu-functions.js
   -----------------------------------------------------------------
   Behavior for each menu item + editor bindings:
     • Copy
     • Paste
     • Select All
     • Close menu
     • Close D-Pad   (hides the whole D-Pad)
   Also owns the CodeMirror cursorActivity binding and the init
   sequence (visibility, native-selection UI suppression).
   Must load after dpad-layout.js, dpad-functions.js, menu-layout.js.
   ================================================================ */

(function () {
  const ctx = window.__dexDpad;
  if (!ctx || !ctx.menu) {
    console.error('[menu-functions] menu-layout.js must load first');
    return;
  }
  if (ctx.__menuFunctionsLoaded) return;
  ctx.__menuFunctionsLoaded = true;

  const { openMenu, closeMenu, menuOpen, notify, hideDpad, updateCenterHandle,
          updateSelectionPreview, updateToolbarVisibility } = ctx;

  const copyEl       = document.getElementById('dexTbCopy');
  const pasteEl      = document.getElementById('dexTbPaste');
  const selectAllEl  = document.getElementById('dexTbSelectAll');
  const closeEl      = document.getElementById('dexTbClose');
  const closeDpadEl  = document.getElementById('dexTbCloseDpad');

  // Prevent default so the editor keeps focus when tapping menu items
  [copyEl, pasteEl, selectAllEl, closeEl, closeDpadEl].forEach(el => {
    if (el) el.addEventListener('mousedown', (e) => e.preventDefault());
  });

  function isPosValid(cm, pos) {
    if (!pos || typeof pos.line !== 'number' || typeof pos.ch !== 'number') return false;
    const lc = cm.lineCount();
    if (pos.line < 0 || pos.line >= lc) return false;
    const lineLen = cm.getLine(pos.line).length;
    return pos.ch >= 0 && pos.ch <= lineLen;
  }

  /* ====== COPY ====== */
  copyEl.addEventListener('click', async () => {
    const ed = window.dexEditor;
    let text = '';
    const saved = ctx.getSavedSelection();
    if (saved && saved.text) text = saved.text;
    else if (ed && ed.getSelection) {
      const s = ed.getSelection();
      if (s && s.text) text = s.text;
    }
    if (!text && ed && ed.getValue) text = ed.getValue();
    if (!text) { notify('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied');
      closeMenu();
    } catch (_e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        notify('Copied');
        closeMenu();
      } catch (_e2) {
        notify('Copy failed — grant clipboard permission');
      }
    }
  });

  /* ====== PASTE ====== */
  pasteEl.addEventListener('click', async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); }
    catch (_e) { notify('Paste blocked — allow clipboard permission'); return; }
    if (!text) { notify('Clipboard is empty'); return; }

    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }

    const saved = ctx.getSavedSelection();
    let from, to;
    if (saved && isPosValid(cm, saved.from) && isPosValid(cm, saved.to)) {
      from = saved.from; to = saved.to;
    } else {
      const c = cm.getCursor();
      from = c; to = c;
    }

    cm.operation(() => {
      cm.replaceRange(text, from, to);
      const startIdx = cm.indexFromPos(from);
      const endPos = cm.posFromIndex(startIdx + text.length);
      cm.setSelection(endPos, endPos);
    });

    const startIdx = cm.indexFromPos(from);
    const endPos = cm.posFromIndex(startIdx + text.length);
    ctx.setSavedSelection({ from: endPos, to: endPos, text: '' });

    notify('Pasted ' + text.length + ' character' + (text.length === 1 ? '' : 's'));
    closeMenu();
  });

  /* ====== SELECT ALL ====== */
  selectAllEl.addEventListener('click', () => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }
    const lastLine = cm.lineCount() - 1;
    const from = { line: 0, ch: 0 };
    const to = { line: lastLine, ch: cm.getLine(lastLine).length };
    cm.setSelection(from, to);
    ctx.setSavedSelection({ from, to, text: cm.getValue() });
    notify('Selected all');
    // Menu stays open so user can immediately Copy
  });

  /* ====== CLOSE MENU ====== */
  closeEl.addEventListener('click', closeMenu);

  /* ====== CLOSE D-PAD ====== */
  closeDpadEl.addEventListener('click', () => {
    closeMenu();
    hideDpad();
    notify('D-Pad hidden — call dexShowDpad() to bring it back');
  });

  /* ====== CURSOR ACTIVITY BINDING ====== */
  function attachCursorActivity() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(attachCursorActivity, 300); return; }
    if (cm.__dexCursorActivityBound) return;
    cm.__dexCursorActivityBound = true;

    try { cm.setOption('styleSelectedText', true); } catch (_e) {}

    cm.on('cursorActivity', () => {
      if (menuOpen() && !cm.getSelection()) closeMenu();
      if (!cm.getSelection()) ctx.setSelectionAnchor(cm.getCursor('head'));
      updateCenterHandle();
      updateSelectionPreview();
    });
  }

  /* ====== SUPPRESS NATIVE SELECTION UI ====== */
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

  /* ====== INIT ====== */
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
})();
