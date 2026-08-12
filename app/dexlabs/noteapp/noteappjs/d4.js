(function () {
  'use strict';
  if (window.__dexToolbar2Loaded) return;
  window.__dexToolbar2Loaded = true;

  const LS_KEY = 'dexToolbarPos';
  const TRIGGER_SIZE = 40;
  const DRAG_THRESHOLD = 8;
  const EDGE_MARGIN = 8;
  const MENU_GAP = 12;

  const ICONS = {
    down: 'expand_more', up: 'expand_less',
    left: 'chevron_left', right: 'chevron_right',
    copy: 'content_copy', paste: 'content_paste',
    close: 'close'
  };

  const style = document.createElement('style');
  style.id = 'dex-toolbar2-styles';
  style.textContent = `
    #dexToolbarBtn {
      position: fixed;
      width: ${TRIGGER_SIZE}px;
      height: ${TRIGGER_SIZE}px;
      border-radius: 50%;
      background: var(--matte, #181C1F);
      color: var(--color, #cacaca);
      border: 1px solid var(--border, rgba(255,255,255,0.10));
      display: flex; align-items: center; justify-content: center;
      cursor: grab;
      z-index: 9997;
      box-shadow: 0 6px 18px rgba(0,0,0,0.5);
      touch-action: none;                 
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none;
      font-family: 'classy', sans-serif;
      padding: 0;
      transition: box-shadow 0.15s ease, transform 0.08s ease;
    }
    #dexToolbarBtn:active { cursor: grabbing; transform: scale(0.96); }
    #dexToolbarBtn > * { pointer-events: none; }
    #dexToolbarBtn .material-symbols-rounded { font-size: 24px; }
    #dexToolbarBtn.dragging {
      box-shadow: 0 10px 28px rgba(0,0,0,0.65);
      opacity: 0.9;
    }

    #dexToolbarMenu {
      position: fixed;
      background: var(--matte, #181C1F);
      border: 1px solid var(--border, rgba(255,255,255,0.10));
      border-radius: 12px;
      padding: 4px;
      z-index: 9998;
      display: none;
      flex-direction: column;
      min-width: 168px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.6);
      font-family: 'classy', sans-serif;
      -webkit-touch-callout: none;
    }
    #dexToolbarMenu.open { display: flex; }

    .dex-tb-item {
      background: transparent;
      border: none;
      color: var(--color, #cacaca);
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13.5px;
      text-align: left;
      width: 100%;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
    }
    .dex-tb-item:hover, .dex-tb-item:active { background: rgba(255,255,255,0.06); }
    .dex-tb-item > * { pointer-events: none; }
    .dex-tb-item .material-symbols-rounded { font-size: 20px; }
    .dex-tb-sep {
      height: 1px;
      background: var(--border, rgba(255,255,255,0.08));
      margin: 4px 6px;
    }

    .CodeMirror { -webkit-touch-callout: none; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute('aria-label', 'Open editor toolbar');
  btn.innerHTML = '<span class="material-symbols-rounded" id="dexToolbarBtnIcon">' + ICONS.down + '</span>';
  document.body.appendChild(btn);

  const menu = document.createElement('div');
  menu.id = 'dexToolbarMenu';
  menu.innerHTML =
    '<button type="button" class="dex-tb-item" id="dexTbCopy">'  +
      '<span class="material-symbols-rounded">' + ICONS.copy  + '</span>' +
      '<span>Copy</span>' +
    '</button>' +
    '<button type="button" class="dex-tb-item" id="dexTbPaste">' +
      '<span class="material-symbols-rounded">' + ICONS.paste + '</span>' +
      '<span>Paste</span>' +
    '</button>' +
    '<div class="dex-tb-sep"></div>' +
    '<button type="button" class="dex-tb-item" id="dexTbClose">' +
      '<span class="material-symbols-rounded">' + ICONS.close + '</span>' +
      '<span>Close menu</span>' +
    '</button>';
  document.body.appendChild(menu);

  const btnIcon = document.getElementById('dexToolbarBtnIcon');
  const copyEl  = document.getElementById('dexTbCopy');
  const pasteEl = document.getElementById('dexTbPaste');
  const closeEl = document.getElementById('dexTbClose');

  /* ====== HOMEPAGE DETECTION ====== */
  function isHomepage() {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html' || path === '/home' || path === '';
  }

  function updateToolbarVisibility() {
    if (isHomepage()) {
      btn.style.display = 'none';
      closeMenu();
    } else {
      btn.style.display = '';
    }
  }

  /* ====== POSITION / DRAG ====== */
  function loadPos() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch (e) {}
    return null;
  }
  function savePos(left, top) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ left, top })); } catch (e) {}
  }
  function clamp(left, top) {
    const maxLeft = window.innerWidth  - TRIGGER_SIZE - EDGE_MARGIN;
    const maxTop  = window.innerHeight - TRIGGER_SIZE - EDGE_MARGIN;
    return {
      left: Math.max(EDGE_MARGIN, Math.min(maxLeft, left)),
      top:  Math.max(EDGE_MARGIN, Math.min(maxTop,  top))
    };
  }
  function defaultPos() {
    return clamp(
      window.innerWidth  - TRIGGER_SIZE - 16,
      Math.round(window.innerHeight * 0.35)
    );
  }
  function applyPos(pos) {
    btn.style.left = pos.left + 'px';
    btn.style.top  = pos.top  + 'px';
    updateChevron(pos);
  }

  function chevronForPos(pos) {
    const w = window.innerWidth, h = window.innerHeight;
    const distLeft   = pos.left;
    const distRight  = w - pos.left - TRIGGER_SIZE;
    const distTop    = pos.top;
    const distBottom = h - pos.top - TRIGGER_SIZE;
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    if (min === distTop && distTop <= distLeft && distTop <= distRight && distTop <= distBottom) return 'down';
    if (min === distBottom) return 'up';
    if (min === distLeft)   return 'right';
    if (min === distRight)  return 'left';
    return 'down';
  }
  function updateChevron(pos) {
    const dir = chevronForPos(pos);
    btnIcon.textContent = ICONS[dir];
    btn.dataset.dir = dir;
  }

  const initial = loadPos() || defaultPos();
  applyPos(clamp(initial.left, initial.top));

  /* ====== BUTTON DRAG ====== */
  let drag = null;

  btn.addEventListener('pointerdown', (e) => {
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: btn.offsetLeft,
      startTop:  btn.offsetTop,
      moved: false
    };
    try { btn.setPointerCapture(e.pointerId); } catch (_e) {}
  });

  btn.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      btn.classList.add('dragging');
      if (menuOpen()) closeMenu();
    }
    const next = clamp(drag.startLeft + dx, drag.startTop + dy);
    applyPos(next);
  });

  function endDrag(e) {
    if (!drag) return;
    const wasDrag = drag.moved;
    try { btn.releasePointerCapture(drag.pointerId); } catch (_e) {}
    drag = null;
    btn.classList.remove('dragging');
    if (wasDrag) {
      const pos = { left: btn.offsetLeft, top: btn.offsetTop };
      savePos(pos.left, pos.top);
      updateChevron(pos);
    } else {
      toggleMenu();
    }
  }
  btn.addEventListener('pointerup',     endDrag);
  btn.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => {
    const clamped = clamp(btn.offsetLeft, btn.offsetTop);
    applyPos(clamped);
    savePos(clamped.left, clamped.top);
  });

  /* ====== MENU ====== */
  function menuOpen() { return menu.classList.contains('open'); }

  function positionMenu() {
    let anchor = null;
    try {
      const ed = window.dexEditor;
      const cm = ed && ed.cm ? ed.cm : null;
      if (cm) {
        const sel = cm.getSelection();
        if (sel && sel.length > 0) {
          const to = cm.getCursor('to');
          const c = cm.charCoords(to, 'window');
          anchor = { x: c.right, y: c.bottom, fromSelection: true };
        } else {
          const c = cm.charCoords(cm.getCursor(), 'window');
          anchor = { x: c.right, y: c.bottom, fromSelection: false };
        }
      }
    } catch (_e) {}

    menu.style.visibility = 'hidden';
    menu.classList.add('open');
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    menu.classList.remove('open');
    menu.style.visibility = '';

    const vw = window.innerWidth, vh = window.innerHeight;
    let left, top;

    if (anchor && anchor.fromSelection) {
      left = anchor.x + MENU_GAP;
      top  = anchor.y + MENU_GAP;
    } else if (anchor) {
      const bx = btn.offsetLeft, by = btn.offsetTop;
      left = (anchor.x < vw / 2) ? (vw - menuW - MENU_GAP - EDGE_MARGIN) : (MENU_GAP + EDGE_MARGIN);
      top  = (anchor.y < vh / 2) ? (vh - menuH - MENU_GAP - EDGE_MARGIN) : (MENU_GAP + EDGE_MARGIN);
      const dir = btn.dataset.dir;
      if (dir === 'left')  left = bx - menuW - MENU_GAP;
      if (dir === 'right') left = bx + TRIGGER_SIZE + MENU_GAP;
      if (dir === 'up')    top  = by - menuH - MENU_GAP;
      if (dir === 'down')  top  = by + TRIGGER_SIZE + MENU_GAP;
    } else {
      const bx = btn.offsetLeft, by = btn.offsetTop;
      const dir = btn.dataset.dir || 'down';
      if (dir === 'left')  { left = bx - menuW - MENU_GAP; top = by; }
      else if (dir === 'right') { left = bx + TRIGGER_SIZE + MENU_GAP; top = by; }
      else if (dir === 'up')    { left = bx; top = by - menuH - MENU_GAP; }
      else                       { left = bx; top = by + TRIGGER_SIZE + MENU_GAP; }
    }

    left = Math.max(EDGE_MARGIN, Math.min(vw - menuW - EDGE_MARGIN, left));
    top  = Math.max(EDGE_MARGIN, Math.min(vh - menuH - EDGE_MARGIN, top));

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  let savedSelection = null;

  function captureSelection() {
    try {
      const ed = window.dexEditor;
      if (ed && ed.cm) {
        const cm = ed.cm;
        const from = cm.getCursor('from');
        const to   = cm.getCursor('to');
        const text = cm.getSelection();
        savedSelection = { from, to, text };
      }
    } catch (_e) {}
  }
  function restoreSelection() {
    try {
      const ed = window.dexEditor;
      if (ed && ed.cm && savedSelection) {
        ed.cm.setSelection(savedSelection.from, savedSelection.to);
        ed.cm.focus();
      }
    } catch (_e) {}
  }

  function openMenu()  {
    captureSelection();
    positionMenu();
    menu.classList.add('open');
  }
  function closeMenu() {
    menu.classList.remove('open');
    setTimeout(() => { savedSelection = null; }, 300);
  }
  function toggleMenu() { menuOpen() ? closeMenu() : openMenu(); }

  window.dexOpenToolbar   = openMenu;
  window.dexCloseToolbar  = closeMenu;
  window.dexToggleToolbar = toggleMenu;

  [copyEl, pasteEl, closeEl].forEach(el => {
    el.addEventListener('mousedown', e => e.preventDefault());
  });

  function notify(m) {
    if (typeof showNotification === 'function') showNotification(m);
  }

  /* ====== COPY ====== */
  copyEl.addEventListener('click', async () => {
    const ed = window.dexEditor;
    let text = '';
    if (savedSelection && savedSelection.text) text = savedSelection.text;
    else if (ed && ed.getSelection) {
      const s = ed.getSelection();
      if (s && s.text) text = s.text;
    }
    if (!text && ed && ed.getValue) text = ed.getValue();
    if (!text) { notify('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied');
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
      } catch (_e2) {
        notify('Copy failed — grant clipboard permission');
      }
    }
  });

  /* ====== PASTE ====== */
  pasteEl.addEventListener('click', async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (_e) {
      notify('Paste blocked — allow clipboard permission');
      return;
    }
    if (!text) { notify('Clipboard is empty'); return; }

    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }

    let from, to;
    if (savedSelection && isPosValid(cm, savedSelection.from) && isPosValid(cm, savedSelection.to)) {
      from = savedSelection.from;
      to   = savedSelection.to;
    } else {
      const c = cm.getCursor();
      from = c; to = c;
    }

    cm.operation(() => {
      cm.replaceRange(text, from, to);
      const startIdx = cm.indexFromPos(from);
      const endPos   = cm.posFromIndex(startIdx + text.length);
      cm.setSelection(endPos, endPos);
    });

    const startIdx = cm.indexFromPos(from);
    const endPos   = cm.posFromIndex(startIdx + text.length);
    savedSelection = { from: endPos, to: endPos, text: '' };

    notify('Pasted ' + text.length + ' character' + (text.length === 1 ? '' : 's'));
  });

  function isPosValid(cm, pos) {
    if (!pos || typeof pos.line !== 'number' || typeof pos.ch !== 'number') return false;
    const lc = cm.lineCount();
    if (pos.line < 0 || pos.line >= lc) return false;
    const lineLen = cm.getLine(pos.line).length;
    return pos.ch >= 0 && pos.ch <= lineLen;
  }

  closeEl.addEventListener('click', closeMenu);

  /* ====== CURSOR MOVE → CLOSE MENU ====== */
  function attachCursorClose() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(attachCursorClose, 300); return; }
    if (cm.__dexCursorCloseBound) return;
    cm.__dexCursorCloseBound = true;

    cm.on('cursorActivity', () => {
      if (menuOpen()) {
        closeMenu();
      }
    });
  }

  /* ====== DRAG-TO-SELECT FOR MOBILE/TABLET ====== */
  const LONG_PRESS_MS  = 500;
  const MOVE_TOLERANCE = 10;

  function wordBoundsAt(cm, pos) {
    const line = cm.getLine(pos.line) || '';
    const isWord = (c) => c && /[\w$@#-]/.test(c);
    let s = pos.ch, e = pos.ch;
    while (s > 0 && isWord(line[s - 1])) s--;
    while (e < line.length && isWord(line[e])) e++;
    if (s === e) {
      if (e < line.length) e = s + 1;
    }
    return { from: { line: pos.line, ch: s }, to: { line: pos.line, ch: e } };
  }

  function fireLongPress(clientX, clientY) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;
    let pos;
    try { pos = cm.coordsChar({ left: clientX, top: clientY }, 'window'); }
    catch (_e) { return; }
    if (!pos) return;
    const bounds = wordBoundsAt(cm, pos);
    try {
      cm.setSelection(bounds.from, bounds.to);
    } catch (_e) { return; }
    savedSelection = {
      from: bounds.from,
      to:   bounds.to,
      text: cm.getRange(bounds.from, bounds.to)
    };
    openMenu();
  }

  /* ====== MOBILE DRAG SELECTION ====== */
  function attachMobileDragSelect() {
    const cmEl = document.querySelector('.CodeMirror');
    if (!cmEl) { setTimeout(attachMobileDragSelect, 200); return; }
    if (cmEl.__dexMobileDragBound) return;
    cmEl.__dexMobileDragBound = true;

    /* Allow native context menu to show on long press */
    cmEl.addEventListener('contextmenu', (e) => {
      /* Allow default context menu for native selection */
    });

    /* Prevent default selectstart to avoid double selection */
    cmEl.addEventListener('selectstart', (e) => {
      /* Allow default selection for drag-to-select */
    });

    let dragSelectState = null;

    cmEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

      const ed = window.dexEditor;
      const cm = ed && ed.cm ? ed.cm : null;
      if (!cm) return;

      const startX = e.clientX, startY = e.clientY;

      /* Start a timer for long press (word select + menu) */
      const longPressTimer = setTimeout(() => {
        if (dragSelectState && dragSelectState.isDragging) return; /* Already dragging, skip long press */
        fireLongPress(startX, startY);
        if (dragSelectState) dragSelectState.cancelled = true;
      }, LONG_PRESS_MS);

      dragSelectState = {
        pointerId: e.pointerId,
        startX: startX,
        startY: startY,
        cancelled: false,
        isDragging: false,
        longPressTimer: longPressTimer,
        startPos: null,
        lastPos: null
      };

      try {
        dragSelectState.startPos = cm.coordsChar({ left: startX, top: startY }, 'window');
        dragSelectState.lastPos = dragSelectState.startPos;
      } catch (_e) {}

      try { cmEl.setPointerCapture(e.pointerId); } catch (_e) {}
    });

    cmEl.addEventListener('pointermove', (e) => {
      if (!dragSelectState || e.pointerId !== dragSelectState.pointerId) return;
      if (dragSelectState.cancelled) return;

      const dx = e.clientX - dragSelectState.startX;
      const dy = e.clientY - dragSelectState.startY;
      const dist = Math.hypot(dx, dy);

      /* If moved beyond tolerance, start drag selection */
      if (!dragSelectState.isDragging && dist > MOVE_TOLERANCE) {
        dragSelectState.isDragging = true;
        clearTimeout(dragSelectState.longPressTimer);

        /* Cancel any pending long press menu open */
        dragSelectState.cancelled = true;

        /* Start selection from initial position */
        if (dragSelectState.startPos) {
          cm.setSelection(dragSelectState.startPos, dragSelectState.startPos);
        }
      }

      if (dragSelectState.isDragging) {
        e.preventDefault();
        let currentPos;
        try {
          currentPos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
        } catch (_e) { return; }

        if (currentPos) {
          cm.setSelection(dragSelectState.startPos, currentPos);
          dragSelectState.lastPos = currentPos;
        }
      }
    });

    function endDragSelect(e) {
      if (!dragSelectState || e.pointerId !== dragSelectState.pointerId) return;

      clearTimeout(dragSelectState.longPressTimer);

      const wasDragging = dragSelectState.isDragging;
      const state = dragSelectState;
      dragSelectState = null;

      try { cmEl.releasePointerCapture(e.pointerId); } catch (_e) {}

      if (wasDragging) {
        /* Selection completed via drag — don't open menu, just save selection */
        const ed = window.dexEditor;
        const cm = ed && ed.cm ? ed.cm : null;
        if (cm && state.startPos && state.lastPos) {
          const selText = cm.getSelection();
          if (selText && selText.length > 0) {
            savedSelection = {
              from: cm.getCursor('from'),
              to: cm.getCursor('to'),
              text: selText
            };
          }
        }
      }
    }

    cmEl.addEventListener('pointerup', endDragSelect);
    cmEl.addEventListener('pointercancel', endDragSelect);
  }

  /* ====== INITIALIZATION ====== */
  function init() {
    updateToolbarVisibility();
    attachCursorClose();
    attachMobileDragSelect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* Re-check visibility on navigation (for SPAs) */
  window.addEventListener('popstate', updateToolbarVisibility);
  window.addEventListener('hashchange', updateToolbarVisibility);

})();