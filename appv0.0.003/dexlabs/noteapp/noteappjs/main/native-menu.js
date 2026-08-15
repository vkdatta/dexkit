(function () {
  if (window.__dexNativeMenuLoaded) return;
  window.__dexNativeMenuLoaded = true;

  const MENU_DELAY_MS = 3000;
  const IC = {
    copy: 'content_copy', cut: 'content_cut', paste: 'content_paste',
    selectAll: 'select_all', delete: 'delete', swap: 'swap_horiz',
    bookmark: 'bookmark', swapSaved: 'content_paste'
  };

  function $(id) { return document.getElementById(id); }

  function notify(m) { if (typeof showNotification === 'function') showNotification(m); }

  async function clipboardWrite(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e2) { return false; }
    }
  }
  async function clipboardRead() {
    try { return await navigator.clipboard.readText(); }
    catch (e) { return null; }
  }

  function currentMode() {
    if (document.body.classList.contains('mode-diffusion')) return 'diffusion';
    if (document.body.classList.contains('mode-mermaid')) return 'mermaid';
    return 'base';
  }

  let menu = null;
  let pendingTimer = null;
  let activeActions = null;

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'dexNativeMenu';
    document.body.appendChild(menu);
    document.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target)) closeMenu();
    });
    return menu;
  }

  function clearPending() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  function closeMenu() {
    clearPending();
    if (menu) menu.classList.remove('open');
    activeActions = null;
  }
  window.dexCloseNativeMenu = closeMenu;

  function renderMenu(actions, rect) {
    ensureMenu();
    activeActions = actions;
    let html = '';
    actions.forEach((a, i) => {
      if (a.sep) { html += '<div class="dex-nm-sep"></div>'; return; }
      html += '<button type="button" class="dex-nm-item' + (a.danger ? ' dex-nm-danger' : '') + '" data-nm-idx="' + i + '">' +
              '<span class="material-symbols-rounded">' + a.icon + '</span><span>' + a.label + '</span></button>';
    });
    menu.innerHTML = html;
    menu.querySelectorAll('[data-nm-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.nmIdx, 10);
        const action = activeActions && activeActions[idx];
        closeMenu();
        if (action && typeof action.run === 'function') action.run();
      });
    });

    menu.style.visibility = 'hidden';
    menu.classList.add('open');
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = rect ? rect.left : (vw - mw) / 2;
    let top  = rect ? rect.bottom + 8 : (vh - mh) / 2;
    if (rect && top + mh > vh - 8) top = rect.top - mh - 8;
    left = Math.max(8, Math.min(vw - mw - 8, left));
    top  = Math.max(8, Math.min(vh - mh - 8, top));
    menu.style.left = left + 'px';
    menu.style.top  = top + 'px';
    menu.style.visibility = '';
  }

  function scheduleMenu(getActionsAndRect) {
    clearPending();
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      const result = getActionsAndRect();
      if (!result || !result.actions || !result.actions.length) return;
      renderMenu(result.actions, result.rect);
    }, MENU_DELAY_MS);
  }

  // ---- CodeMirror surface (base-mode textarea, diffusion's raw/morph editing panes) ----

  function codeMirrorActions(cm, range) {
    const actions = [
      { label: 'Copy', icon: IC.copy, run: async () => { notify((await clipboardWrite(range.text)) ? 'Copied' : 'Copy failed'); } },
      { label: 'Cut', icon: IC.cut, run: async () => {
          if (!(await clipboardWrite(range.text))) { notify('Cut failed'); return; }
          cm.operation(() => { cm.replaceRange('', range.from, range.to); });
          notify('Cut');
        } },
      { label: 'Paste', icon: IC.paste, run: async () => {
          const text = await clipboardRead();
          if (!text) { notify('Clipboard is empty'); return; }
          cm.operation(() => { cm.replaceRange(text, range.from, range.to); });
          notify('Pasted');
        } },
      { label: 'Select All', icon: IC.selectAll, run: () => {
          const lastLine = cm.lineCount() - 1;
          cm.setSelection({ line: 0, ch: 0 }, { line: lastLine, ch: cm.getLine(lastLine).length });
        } },
      { label: 'Delete', icon: IC.delete, danger: true, run: () => {
          cm.operation(() => { cm.replaceRange('', range.from, range.to); });
          notify('Deleted');
        } }
    ];
    if (currentMode() === 'diffusion') {
      actions.push({ sep: true });
      actions.push({ label: 'Swap Raw ↔ Morph', icon: IC.swap, run: () => { if (typeof diffSwapTexts === 'function') diffSwapTexts(); } });
      actions.push({ label: 'Copy Raw', icon: IC.copy, run: () => { if (typeof diffCopyText === 'function') diffCopyText('raw'); } });
      actions.push({ label: 'Copy Morph', icon: IC.copy, run: () => { if (typeof diffCopyText === 'function') diffCopyText('morph'); } });
    }
    return actions;
  }

  function hookCodeMirror() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(hookCodeMirror, 300); return; }
    if (cm.__dexNativeMenuHooked) return;
    cm.__dexNativeMenuHooked = true;
    cm.on('cursorActivity', () => {
      if (!cm.somethingSelected()) { closeMenu(); return; }
      scheduleMenu(() => {
        if (!cm.somethingSelected()) return null;
        const range = { from: cm.getCursor('from'), to: cm.getCursor('to'), text: cm.getSelection() };
        const coords = cm.charCoords(range.to, 'window');
        return { actions: codeMirrorActions(cm, range), rect: { left: coords.right, top: coords.top, bottom: coords.bottom } };
      });
    });
  }

  // ---- Diff-view surface (diffusion's read-only Diff 1 / Diff 2 comparison tables) ----

  let diffSavedText = '';

  function diffGetLines(isRaw) {
    const text = isRaw ? diffElements.raw.value : diffElements.morph.value;
    return diffElements.optBreaks.checked ? text.split(/\r?\n/) : [text.replace(/\r?\n/g, ' ')];
  }
  function diffSetLines(isRaw, linesArray) {
    const result = linesArray.join('\n');
    if (isRaw) diffElements.raw.value = result; else diffElements.morph.value = result;
  }

  function diffViewActions(sel) {
    const actions = [
      { label: 'Save selection', icon: IC.bookmark, run: () => {
          diffSavedText = sel.text;
          const st = $('diffStatSaved');
          if (st) st.textContent = diffSavedText;
        } },
      { label: 'Swap corresponding line(s)', icon: IC.swap, run: () => {
          if (sel.startLine < 0) return;
          const isSourceRaw = sel.viewId === 'diffDiff1View';
          const sourceLines = diffGetLines(isSourceRaw);
          const targetLines = diffGetLines(!isSourceRaw);
          for (let i = sel.startLine; i <= sel.endLine; i++) sourceLines[i] = targetLines[i] !== undefined ? targetLines[i] : '';
          diffSetLines(isSourceRaw, sourceLines);
          if (typeof diffusion === 'function') diffusion();
        } }
    ];
    if (diffSavedText) {
      actions.push({ label: 'Swap with saved text', icon: IC.swapSaved, run: () => {
          if (!diffSavedText || sel.startLine < 0) return;
          const isSourceRaw = sel.viewId === 'diffDiff1View';
          const lines = diffGetLines(isSourceRaw);
          const savedLines = diffSavedText.split(/\r?\n/);
          const start = sel.startLine, end = sel.endLine;
          if (sel.isLineSelection || start !== end) {
            for (let i = start; i <= end; i++) lines[i] = (i - start < savedLines.length) ? savedLines[i - start] : '';
          } else {
            const lineText = lines[start] || '';
            lines[start] = lineText.substring(0, sel.startOffset) + diffSavedText + lineText.substring(sel.endOffset);
          }
          diffSetLines(isSourceRaw, lines);
          if (typeof diffusion === 'function') diffusion();
        } });
    }
    return actions;
  }

  function hookDiffView() {
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { closeMenu(); return; }

      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === 3 ? container.parentElement : container;
      const view = element && element.closest ? element.closest('.diff-view') : null;
      if (!view || (view.id !== 'diffDiff1View' && view.id !== 'diffDiff2View')) { closeMenu(); return; }

      const startRow = (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer).closest('.diff-line-row');
      const endRow = (range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer).closest('.diff-line-row');
      if (!startRow || !endRow) { closeMenu(); return; }

      const gutter = startRow.querySelector('.diff-gutter-cell');
      let isLineSelection = false;
      if (gutter && (range.intersectsNode(gutter) || gutter.contains(range.startContainer) || gutter.contains(range.endContainer))) {
        isLineSelection = true;
      }

      const capturedSel = {
        viewId: view.id,
        startLine: parseInt(startRow.dataset.line, 10),
        endLine: parseInt(endRow.dataset.line, 10),
        text: sel.toString(),
        isLineSelection,
        startOffset: range.startOffset,
        endOffset: range.endOffset
      };

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      scheduleMenu(() => ({ actions: diffViewActions(capturedSel), rect: { left: rect.left, top: rect.top, bottom: rect.bottom } }));
    });
  }

  // ---- Plain-textarea surface (mermaid's #mermaid-code) ----

  function textareaActions(ta, range) {
    return [
      { label: 'Copy', icon: IC.copy, run: async () => { notify((await clipboardWrite(range.text)) ? 'Copied' : 'Copy failed'); } },
      { label: 'Cut', icon: IC.cut, run: async () => {
          if (!(await clipboardWrite(range.text))) { notify('Cut failed'); return; }
          ta.setRangeText('', range.start, range.end, 'end');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          notify('Cut');
        } },
      { label: 'Paste', icon: IC.paste, run: async () => {
          const text = await clipboardRead();
          if (!text) { notify('Clipboard is empty'); return; }
          ta.setRangeText(text, range.start, range.end, 'end');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          notify('Pasted');
        } },
      { label: 'Select All', icon: IC.selectAll, run: () => { ta.focus(); ta.setSelectionRange(0, ta.value.length); } }
    ];
  }

  function hookTextarea(id) {
    const ta = $(id);
    if (!ta) { setTimeout(() => hookTextarea(id), 300); return; }
    if (ta.__dexNativeMenuHooked) return;
    ta.__dexNativeMenuHooked = true;
    const onSelChange = () => {
      if (ta.selectionStart === ta.selectionEnd) { closeMenu(); return; }
      scheduleMenu(() => {
        const s = ta.selectionStart, e = ta.selectionEnd;
        if (s === e) return null;
        const range = { start: s, end: e, text: ta.value.slice(s, e) };
        const rect = ta.getBoundingClientRect();
        return { actions: textareaActions(ta, range), rect: { left: rect.left + 12, top: rect.top + 12, bottom: rect.top + 40 } };
      });
    };
    ['select', 'mouseup', 'touchend', 'keyup'].forEach((evt) => ta.addEventListener(evt, onSelChange));
  }

  function init() {
    hookCodeMirror();
    hookDiffView();
    hookTextarea('mermaid-code');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
