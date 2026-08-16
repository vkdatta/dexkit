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
  const cutEl        = document.getElementById('dexTbCut');
  const pasteEl      = document.getElementById('dexTbPaste');
  const selectAllEl  = document.getElementById('dexTbSelectAll');
  const deleteEl     = document.getElementById('dexTbDelete');
  const closeEl      = document.getElementById('dexTbClose');
  const closeDpadEl  = document.getElementById('dexTbCloseDpad');

  function on(el, type, fn) { if (el) el.addEventListener(type, fn); }

  const diffSwapEl       = document.getElementById('dexTbDiffSwap');
  const diffSaveEl       = document.getElementById('dexTbDiffSave');
  const diffCopyRawEl    = document.getElementById('dexTbDiffCopyRaw');
  const diffCopyMorphEl  = document.getElementById('dexTbDiffCopyMorph');
  const diffPasteRawEl   = document.getElementById('dexTbDiffPasteRaw');
  const diffPasteMorphEl = document.getElementById('dexTbDiffPasteMorph');
  const diffClearRawEl   = document.getElementById('dexTbDiffClearRaw');
  const diffClearMorphEl = document.getElementById('dexTbDiffClearMorph');

  ctx.menu.addEventListener('mousedown', (e) => {
    if (e.target.closest('.dex-tb-item')) e.preventDefault();
  });

  function isPosValid(cm, pos) {
    if (!pos || typeof pos.line !== 'number' || typeof pos.ch !== 'number') return false;
    const lc = cm.lineCount();
    if (pos.line < 0 || pos.line >= lc) return false;
    const lineLen = cm.getLine(pos.line).length;
    return pos.ch >= 0 && pos.ch <= lineLen;
  }

  on(copyEl, 'click', async () => {
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

  function activeSelectionRange(cm) {
    const saved = ctx.getSavedSelection();
    if (saved && saved.text && isPosValid(cm, saved.from) && isPosValid(cm, saved.to)) {
      return { from: saved.from, to: saved.to, text: saved.text };
    }
    if (cm.getSelection()) {
      return { from: cm.getCursor('from'), to: cm.getCursor('to'), text: cm.getSelection() };
    }
    return null;
  }

  on(cutEl, 'click', async () => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }
    const range = activeSelectionRange(cm);
    if (!range) { notify('Nothing selected to cut'); return; }

    try {
      await navigator.clipboard.writeText(range.text);
    } catch (_e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = range.text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_e2) {
        notify('Cut failed — grant clipboard permission');
        return;
      }
    }

    cm.operation(() => { cm.replaceRange('', range.from, range.to); });
    ctx.setSavedSelection({ from: range.from, to: range.from, text: '' });
    notify('Cut ' + range.text.length + ' character' + (range.text.length === 1 ? '' : 's'));
    closeMenu();
  });

  on(deleteEl, 'click', () => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }
    const range = activeSelectionRange(cm);
    if (!range) { notify('Nothing selected to delete'); return; }

    cm.operation(() => { cm.replaceRange('', range.from, range.to); });
    ctx.setSavedSelection({ from: range.from, to: range.from, text: '' });
    notify('Deleted');
    closeMenu();
  });

  function wireDiffAction(el, fn) {
    if (!el) return; 
    el.addEventListener('click', () => { fn(); closeMenu(); });
  }
  wireDiffAction(diffSwapEl,       () => { if (typeof diffSwapTexts === 'function') diffSwapTexts(); });
  wireDiffAction(diffSaveEl,       () => {
    if (typeof diffCommitPane === 'function') {
      diffCommitPane(window.dexMode ? window.dexMode.activePane : 'raw');
      notify('Saved');
    }
  });
  wireDiffAction(diffCopyRawEl,    () => { if (typeof diffCopyText === 'function') diffCopyText('raw'); });
  wireDiffAction(diffCopyMorphEl,  () => { if (typeof diffCopyText === 'function') diffCopyText('morph'); });
  wireDiffAction(diffPasteRawEl,   () => { if (typeof diffPasteText === 'function') diffPasteText('raw'); });
  wireDiffAction(diffPasteMorphEl, () => { if (typeof diffPasteText === 'function') diffPasteText('morph'); });
  wireDiffAction(diffClearRawEl,   () => { if (typeof diffClearText === 'function') diffClearText('raw'); });
  wireDiffAction(diffClearMorphEl, () => { if (typeof diffClearText === 'function') diffClearText('morph'); });

  on(pasteEl, 'click', async () => {
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

  on(selectAllEl, 'click', () => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }
    const lastLine = cm.lineCount() - 1;
    const from = { line: 0, ch: 0 };
    const to = { line: lastLine, ch: cm.getLine(lastLine).length };
    cm.setSelection(from, to);
    ctx.setSavedSelection({ from, to, text: cm.getValue() });
    notify('Selected all');
    closeMenu();
  });

  on(closeEl, 'click', closeMenu);

  on(closeDpadEl, 'click', () => {
    closeMenu();
    hideDpad();
    notify('D-Pad closed — double-tap the dragger to reopen');
  });

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
