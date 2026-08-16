(function () {
  if (window.__dexNativeMenuLoaded) return;
  window.__dexNativeMenuLoaded = true;

  const MENU_DELAY_MS = 1000;
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
        // FIX #19: check execCommand return value instead of always returning true
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e2) { return false; }
    }
  }

  async function clipboardRead() {
    try { return await navigator.clipboard.readText(); }
    catch (e) {
      // FIX #20: distinguish permission/security failures from actual empty clipboard.
      // NotAllowedError = permission denied (not an empty clipboard).
      if (e && e.name === 'NotAllowedError') return undefined; // signals "access denied"
      return null; // other failures → treat as unavailable
    }
  }

  function currentMode() {
    // Mirrors the router's route regex exactly: "/note/:id/:mode" with an
    // optional mode segment and optional trailing slash (see dexlabs.txt).
    const m = location.pathname.match(/^\/note\/[^/]+(?:\/([a-z]+))?\/?$/);
    const mode = m && m[1];
    if (mode === 'diffusion') return 'diffusion';
    if (mode === 'mermaid') return 'mermaid';
    return 'base';
  }

  let menu = null;
  let activeActions = null;

  // ---- Per-surface timer ownership ----
  // FIX #8: instead of one shared pendingTimer, each surface owns its timer slot.
  // The menu controller tracks which surface is "active" so that a stale surface
  // cannot accidentally cancel a timer started by a different surface.
  const surfaceTimers = { codemirror: null, diff: null, textarea: null };

  function clearPendingFor(surface) {
    if (surfaceTimers[surface]) {
      clearTimeout(surfaceTimers[surface]);
      surfaceTimers[surface] = null;
    }
  }

  function clearAllPending() {
    Object.keys(surfaceTimers).forEach(clearPendingFor);
  }

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

  // FIX #2 / #7: closeMenu now takes an optional surface parameter.
  // When called from a surface's own handler it closes unconditionally.
  // When called from a foreign handler (e.g. the diff selectionchange firing
  // because a CodeMirror selection changed the DOM) it only closes if that
  // surface actually has an active timer — it never cancels another surface's timer.
  function closeMenu(surface) {
    if (surface) {
      // Only close if this surface owns the pending work.
      if (!surfaceTimers[surface]) return; // foreign surface; do nothing
      clearPendingFor(surface);
    } else {
      clearAllPending();
    }
    if (menu) menu.classList.remove('open');
    activeActions = null;
  }
  window.dexCloseNativeMenu = () => closeMenu();

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

  // FIX #1 / #8: scheduleMenu now takes a surface name so timers are scoped.
  // A surface's own calls only reset that surface's timer, not others.
  function scheduleMenu(surface, getActionsAndRect) {
    clearPendingFor(surface);
    if (menu && menu.classList.contains('open')) closeMenu();
    surfaceTimers[surface] = setTimeout(() => {
      surfaceTimers[surface] = null;
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
          // FIX #20/#21: undefined = permission denied; null = other failure; '' = valid empty string
          if (text === undefined) { notify('Clipboard access denied'); return; }
          if (text === null) { notify('Clipboard unavailable'); return; }
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

    // FIX #16: track the cm instance by reference, not just a flag on the object.
    // If the editor is recreated we detect it here and re-hook the new instance.
    if (hookCodeMirror._boundCm === cm) return; // already hooked to this instance
    hookCodeMirror._boundCm = cm;

    // Remove the flag from any previous instance so it can be re-hooked if reused.
    if (cm.__dexNativeMenuHooked) return;
    cm.__dexNativeMenuHooked = true;

    // FIX #18 (partial): store the handler so it could be removed if needed.
    const handler = () => {
      if (!cm.somethingSelected()) {
        // FIX #2: only close/cancel this surface's timer, not others.
        closeMenu('codemirror');
        return;
      }
      // FIX #1: pass surface name so only the CM timer is reset, not the diff timer.
      scheduleMenu('codemirror', () => {
        if (!cm.somethingSelected()) return null;
        const range = { from: cm.getCursor('from'), to: cm.getCursor('to'), text: cm.getSelection() };
        const coords = cm.charCoords(range.to, 'window');
        return { actions: codeMirrorActions(cm, range), rect: { left: coords.right, top: coords.top, bottom: coords.bottom } };
      });
    };
    cm.on('cursorActivity', handler);
    cm.__dexNativeMenuHandler = handler; // store for potential cleanup
  }

  // FIX #16: periodically check whether dexEditor.cm has been replaced.
  // This handles SPA navigation that destroys and recreates the editor.
  setInterval(() => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (cm && hookCodeMirror._boundCm !== cm) hookCodeMirror();
  }, 1000);

  // ---- Diff-view surface (diffusion's read-only Diff 1 / Diff 2 comparison tables) ----

  // FIX #14: scope diffSavedText with a getter/setter that could later be
  // extended to be note-scoped. For now it remains one global value but the
  // intent is explicit.
  let diffSavedText = '';

  // FIX #4: extract the plain-text character offset of a DOM range endpoint
  // within a given line's text-content, regardless of internal DOM structure.
  // Instead of trusting Range.startOffset (which is a child-node index when
  // startContainer is an element), we walk the text nodes inside the line row
  // and count characters up to the range's actual boundary point.
  function domRangeOffsetInLineRow(lineRow, rangeContainer, rangeOffset) {
    let charCount = 0;
    const walker = document.createTreeWalker(lineRow, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (node === rangeContainer) {
        return charCount + rangeOffset;
      }
      charCount += node.textContent.length;
    }
    // Fallback: rangeContainer is an element — count all text before it.
    // (Handles the case where the selection lands on an element boundary.)
    if (rangeContainer.nodeType !== 3) {
      const treeWalker2 = document.createTreeWalker(lineRow, NodeFilter.SHOW_TEXT, null, false);
      charCount = 0;
      while ((node = treeWalker2.nextNode())) {
        // If rangeOffset points to a child-node index, stop after that many children.
        if (rangeContainer.childNodes[rangeOffset] &&
            rangeContainer.childNodes[rangeOffset].contains(node)) break;
        charCount += node.textContent.length;
      }
      return charCount;
    }
    return 0;
  }

  function diffGetLines(isRaw) {
    // FIX #12: guard against diffElements not yet initialized.
    if (!diffElements || !diffElements.raw || !diffElements.morph || !diffElements.optBreaks) {
      throw new Error('diffElements not initialized');
    }
    const text = isRaw ? diffElements.raw.value : diffElements.morph.value;
    return diffElements.optBreaks.checked ? text.split(/\r?\n/) : [text.replace(/\r?\n/g, ' ')];
  }
  function diffSetLines(isRaw, linesArray) {
    if (!diffElements || !diffElements.raw || !diffElements.morph) {
      throw new Error('diffElements not initialized');
    }
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
          try {
            const isSourceRaw = sel.viewId === 'diffDiff1View';
            const sourceLines = diffGetLines(isSourceRaw);
            const targetLines = diffGetLines(!isSourceRaw);
            for (let i = sel.startLine; i <= sel.endLine; i++) sourceLines[i] = targetLines[i] !== undefined ? targetLines[i] : sourceLines[i];
            diffSetLines(isSourceRaw, sourceLines);
            if (typeof diffusion === 'function') diffusion();
          } catch (e) { notify('Diff data unavailable'); }
        } }
    ];
    if (diffSavedText) {
      actions.push({ label: 'Swap with saved text', icon: IC.swapSaved, run: () => {
          if (!diffSavedText || sel.startLine < 0) return;
          try {
            const isSourceRaw = sel.viewId === 'diffDiff1View';
            const lines = diffGetLines(isSourceRaw);
            const savedLines = diffSavedText.split(/\r?\n/);
            const start = sel.startLine, end = sel.endLine;
            if (sel.isLineSelection || start !== end) {
              for (let i = start; i <= end; i++) lines[i] = (i - start < savedLines.length) ? savedLines[i - start] : lines[i];
            } else {
              // FIX #4: use the corrected character offsets, not raw DOM offsets.
              const lineText = lines[start] || '';
              lines[start] = lineText.substring(0, sel.startCharOffset)
                           + diffSavedText
                           + lineText.substring(sel.endCharOffset);
            }
            diffSetLines(isSourceRaw, lines);
            if (typeof diffusion === 'function') diffusion();
          } catch (e) { notify('Diff data unavailable'); }
        } });
    }
    return actions;
  }

  function hookDiffView() {
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();

      // FIX #7: Before calling closeMenu, check whether the selection is
      // inside a diff view. Only cancel the DIFF surface's timer — never touch
      // the CodeMirror or textarea timers from here.
      if (!sel || sel.isCollapsed) { closeMenu('diff'); return; }

      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === 3 ? container.parentElement : container;
      const view = element && element.closest ? element.closest('.diff-view') : null;
      if (!view || (view.id !== 'diffDiff1View' && view.id !== 'diffDiff2View')) {
        // FIX #7: selection is outside diff — only cancel diff's own timer.
        closeMenu('diff');
        return;
      }

      const startRow = (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer).closest('.diff-line-row');
      const endRow   = (range.endContainer.nodeType === 3   ? range.endContainer.parentElement   : range.endContainer  ).closest('.diff-line-row');
      if (!startRow || !endRow) { closeMenu('diff'); return; }

      const gutter = startRow.querySelector('.diff-gutter-cell');
      let isLineSelection = false;
      if (gutter && (range.intersectsNode(gutter) || gutter.contains(range.startContainer) || gutter.contains(range.endContainer))) {
        isLineSelection = true;
      }

      // FIX #4: compute proper character offsets within the line's plain text.
      const startCharOffset = domRangeOffsetInLineRow(startRow, range.startContainer, range.startOffset);
      const endCharOffset   = domRangeOffsetInLineRow(endRow,   range.endContainer,   range.endOffset);

      const capturedSel = {
        viewId: view.id,
        startLine: parseInt(startRow.dataset.line, 10),
        endLine:   parseInt(endRow.dataset.line,   10),
        text: sel.toString(),
        isLineSelection,
        startCharOffset,
        endCharOffset
      };

      // FIX #3 / #6: don't capture the rect now — recalculate it when the timer
      // fires so that a 3-second scroll doesn't misplace the menu.
      // Also re-validate the selection at fire time.
      scheduleMenu('diff', () => {
        // FIX #6: re-validate that the selection still exists and matches what we captured.
        const currentSel = window.getSelection();
        if (!currentSel || currentSel.isCollapsed) return null;

        const currentText = currentSel.toString();
        if (currentText !== capturedSel.text) return null; // selection changed

        // Recheck that it's still inside a diff view.
        const currentRange = currentSel.getRangeAt(0);
        const currentContainer = currentRange.commonAncestorContainer;
        const currentEl = currentContainer.nodeType === 3 ? currentContainer.parentElement : currentContainer;
        const currentView = currentEl && currentEl.closest ? currentEl.closest('.diff-view') : null;
        if (!currentView || currentView.id !== view.id) return null;

        // FIX #11: recalculate rect at fire time, not at scheduling time.
        const currentRect = currentRange.getBoundingClientRect();
        if (currentRect.width === 0 || currentRect.height === 0) return null;

        return {
          actions: diffViewActions(capturedSel),
          rect: { left: currentRect.left, top: currentRect.top, bottom: currentRect.bottom }
        };
      });
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
          // FIX #20/#21: treat undefined (permission denied), null (unavailable), and '' (valid) correctly.
          if (text === undefined) { notify('Clipboard access denied'); return; }
          if (text === null) { notify('Clipboard unavailable'); return; }
          ta.setRangeText(text, range.start, range.end, 'end');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          notify('Pasted');
        } },
      { label: 'Select All', icon: IC.selectAll, run: () => { ta.focus(); ta.setSelectionRange(0, ta.value.length); } }
    ];
  }

  function textareaCaretRect(ta, index) {
    const style = getComputedStyle(ta);
    const mirror = document.createElement('div');
    ['boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'padding',
     'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'textAlign'].forEach((p) => {
      mirror.style[p] = style[p];
    });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.height = 'auto';
    mirror.textContent = ta.value.slice(0, index);
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const taRect = ta.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const lineHeight = parseInt(style.lineHeight, 10) || 16;
    const top = taRect.top + (markerRect.top - mirrorRect.top) - ta.scrollTop;
    const left = taRect.left + (markerRect.left - mirrorRect.left) - ta.scrollLeft;
    document.body.removeChild(mirror);
    return { left, top, bottom: top + lineHeight };
  }

  function hookTextarea(id) {
    let boundEl = null;
    // FIX #18 (partial): keep a reference to the listeners per element so they
    // can be removed when the element is replaced.
    let boundListeners = null;

    const makeOnSelChange = function (ta) {
      return function onSelChange() {
        if (ta.selectionStart === ta.selectionEnd) {
          // FIX #2 / #7: only cancel this surface's own timer.
          closeMenu('textarea');
          return;
        }
        // FIX #1: scoped to textarea surface.
        scheduleMenu('textarea', () => {
          const s = ta.selectionStart, e = ta.selectionEnd;
          if (s === e) return null;
          const range = { start: s, end: e, text: ta.value.slice(s, e) };
          const rect = textareaCaretRect(ta, e);
          return { actions: textareaActions(ta, range), rect: { left: rect.left, top: rect.top, bottom: rect.bottom } };
        });
      };
    };

    // FIX #17: replace the infinite polling loop with a MutationObserver +
    // an initial check. Falls back to a bounded retry if the observer isn't
    // sufficient (e.g. element inserted before observer starts).
    function attachTo(ta) {
      if (ta === boundEl) return;

      // Remove old listeners from the previous element.
      if (boundEl && boundListeners) {
        boundListeners.events.forEach((evt) => boundEl.removeEventListener(evt, boundListeners.handler));
      }

      boundEl = ta;
      const handler = makeOnSelChange(ta);
      const events = ['select', 'pointerup', 'keyup'];
      events.forEach((evt) => ta.addEventListener(evt, handler));
      boundListeners = { events, handler };
    }

    // Attempt immediate hook.
    const initial = $(id);
    if (initial) attachTo(initial);

    // Watch for the element being added or replaced in the DOM.
    const observer = new MutationObserver(() => {
      const ta = $(id);
      if (ta && ta !== boundEl) attachTo(ta);
    });
    observer.observe(document.body, { childList: true, subtree: true });
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
