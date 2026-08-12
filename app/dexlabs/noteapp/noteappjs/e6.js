(function () {
  'use strict';
  if (window.__dexToolbar2Loaded) return;
  window.__dexToolbar2Loaded = true;

  const LS_KEY = 'dexToolbarPos';
  const CURSOR_KEY = 'dexCursorPos';
  const TRIGGER_SIZE = 40;
  const DRAG_THRESHOLD = 8;
  const EDGE_MARGIN = 8;
  const MENU_GAP = 12;

  const ICONS = {
    down: 'expand_more', up: 'expand_less',
    left: 'chevron_left', right: 'chevron_right',
    copy: 'content_copy', paste: 'content_paste',
    close: 'close',
    dbl_up: 'keyboard_double_arrow_up',
    dbl_down: 'keyboard_double_arrow_down',
    dbl_left: 'keyboard_double_arrow_left',
    dbl_right: 'keyboard_double_arrow_right'
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

    /* ====== CURSOR CONTROLS – PERFECT CIRCLE ====== */
    #dexCursorControls {
      position: fixed;
      z-index: 9996;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: var(--matte, #181C1F);
      border: 1px solid var(--border, rgba(255,255,255,0.10));
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none;
      cursor: grab;
      padding: 6px;
    }
    #dexCursorControls.dragging {
      cursor: grabbing;
      opacity: 0.9;
    }
    #dexCursorControls .dex-cursor-row {
      display: flex;
      gap: 2px;
      align-items: center;
      justify-content: center;
    }
    #dexCursorControls .dex-cursor-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      color: var(--color, #cacaca);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-family: 'classy', sans-serif;
      padding: 0;
      transition: background 0.1s ease, transform 0.06s ease;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    #dexCursorControls .dex-cursor-btn:active {
      background: rgba(255,255,255,0.10);
      transform: scale(0.92);
    }
    #dexCursorControls .dex-cursor-btn .material-symbols-rounded {
      font-size: 16px;
    }
  `;
  document.head.appendChild(style);

  /* ====== TOOLBAR BUTTON ====== */
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute('aria-label', 'Open editor toolbar');
  btn.innerHTML = '<span class="material-symbols-rounded" id="dexToolbarBtnIcon">' + ICONS.down + '</span>';
  document.body.appendChild(btn);

  /* ====== MENU ====== */
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

  /* ====== CURSOR CONTROLS (circular) ====== */
  const cursorControls = document.createElement('div');
  cursorControls.id = 'dexCursorControls';
  cursorControls.innerHTML =
    '<div class="dex-cursor-row">' +
      '<button type="button" class="dex-cursor-btn" id="dexCurDblUp" aria-label="Double up">' +
        '<span class="material-symbols-rounded">' + ICONS.dbl_up + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="dex-cursor-row">' +
      '<button type="button" class="dex-cursor-btn" id="dexCurUp" aria-label="Up">' +
        '<span class="material-symbols-rounded">' + ICONS.up + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="dex-cursor-row">' +
      '<button type="button" class="dex-cursor-btn" id="dexCurDblLeft" aria-label="Double left">' +
        '<span class="material-symbols-rounded">' + ICONS.dbl_left + '</span>' +
      '</button>' +
      '<button type="button" class="dex-cursor-btn" id="dexCurLeft" aria-label="Left">' +
        '<span class="material-symbols-rounded">' + ICONS.left + '</span>' +
      '</button>' +
      '<button type="button" class="dex-cursor-btn" id="dexCurRight" aria-label="Right">' +
        '<span class="material-symbols-rounded">' + ICONS.right + '</span>' +
      '</button>' +
      '<button type="button" class="dex-cursor-btn" id="dexCurDblRight" aria-label="Double right">' +
        '<span class="material-symbols-rounded">' + ICONS.dbl_right + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="dex-cursor-row">' +
      '<button type="button" class="dex-cursor-btn" id="dexCurDown" aria-label="Down">' +
        '<span class="material-symbols-rounded">' + ICONS.down + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="dex-cursor-row">' +
      '<button type="button" class="dex-cursor-btn" id="dexCurDblDown" aria-label="Double down">' +
        '<span class="material-symbols-rounded">' + ICONS.dbl_down + '</span>' +
      '</button>' +
    '</div>';
  document.body.appendChild(cursorControls);

  const btnIcon = document.getElementById('dexToolbarBtnIcon');
  const copyEl  = document.getElementById('dexTbCopy');
  const pasteEl = document.getElementById('dexTbPaste');
  const closeEl = document.getElementById('dexTbClose');

  const curUp      = document.getElementById('dexCurUp');
  const curDown    = document.getElementById('dexCurDown');
  const curLeft    = document.getElementById('dexCurLeft');
  const curRight   = document.getElementById('dexCurRight');
  const curDblUp   = document.getElementById('dexCurDblUp');
  const curDblDown = document.getElementById('dexCurDblDown');
  const curDblLeft = document.getElementById('dexCurDblLeft');
  const curDblRight= document.getElementById('dexCurDblRight');

  /* ====== HOMEPAGE DETECTION ====== */
  function isHomepage() {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html' || path === '/home' || path === '';
  }

  function updateToolbarVisibility() {
    if (isHomepage()) {
      btn.style.display = 'none';
      closeMenu();
      cursorControls.style.display = 'none';
    } else {
      btn.style.display = '';
      cursorControls.style.display = 'flex';
    }
  }

  /* ====== POSITION / DRAG for toolbar button ====== */
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
    clearSelectionTimeout(); // cancel auto-open timer
  }
  function closeMenu() {
    menu.classList.remove('open');
    setTimeout(() => { savedSelection = null; }, 300);
    clearSelectionTimeout();
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

  /* ====== CURSOR CONTROLS POSITION & DRAG ====== */
  function loadCursorPos() {
    try {
      const raw = localStorage.getItem(CURSOR_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch (e) {}
    return null;
  }
  function saveCursorPos(left, top) {
    try { localStorage.setItem(CURSOR_KEY, JSON.stringify({ left, top })); } catch (e) {}
  }
  function clampCursor(left, top) {
    const cw = cursorControls.offsetWidth || 150;
    const ch = cursorControls.offsetHeight || 150;
    const maxLeft = window.innerWidth  - cw - EDGE_MARGIN;
    const maxTop  = window.innerHeight - ch - EDGE_MARGIN;
    return {
      left: Math.max(EDGE_MARGIN, Math.min(maxLeft, left)),
      top:  Math.max(EDGE_MARGIN, Math.min(maxTop,  top))
    };
  }
  function defaultCursorPos() {
    return clampCursor(
      window.innerWidth  - 160,
      Math.round(window.innerHeight * 0.55)
    );
  }
  function applyCursorPos(pos) {
    cursorControls.style.left = pos.left + 'px';
    cursorControls.style.top  = pos.top  + 'px';
  }

  function positionCursorControls() {
    const pos = loadCursorPos() || defaultCursorPos();
    applyCursorPos(clampCursor(pos.left, pos.top));
  }

  positionCursorControls();

  let cursorDrag = null;

  cursorControls.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.dex-cursor-btn')) return;
    cursorDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: cursorControls.offsetLeft,
      startTop:  cursorControls.offsetTop,
      moved: false
    };
    try { cursorControls.setPointerCapture(e.pointerId); } catch (_e) {}
  });

  cursorControls.addEventListener('pointermove', (e) => {
    if (!cursorDrag || e.pointerId !== cursorDrag.pointerId) return;
    const dx = e.clientX - cursorDrag.startX;
    const dy = e.clientY - cursorDrag.startY;
    if (!cursorDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!cursorDrag.moved) {
      cursorDrag.moved = true;
      cursorControls.classList.add('dragging');
    }
    const next = clampCursor(cursorDrag.startLeft + dx, cursorDrag.startTop + dy);
    applyCursorPos(next);
  });

  function endCursorDrag(e) {
    if (!cursorDrag || e.pointerId !== cursorDrag.pointerId) return;
    const wasDrag = cursorDrag.moved;
    try { cursorControls.releasePointerCapture(cursorDrag.pointerId); } catch (_e) {}
    cursorDrag = null;
    cursorControls.classList.remove('dragging');
    if (wasDrag) {
      const pos = { left: cursorControls.offsetLeft, top: cursorControls.offsetTop };
      saveCursorPos(pos.left, pos.top);
    }
  }
  cursorControls.addEventListener('pointerup',     endCursorDrag);
  cursorControls.addEventListener('pointercancel', endCursorDrag);

  window.addEventListener('resize', () => {
    const clamped = clampCursor(cursorControls.offsetLeft, cursorControls.offsetTop);
    applyCursorPos(clamped);
    saveCursorPos(clamped.left, clamped.top);
  });

  /* ====== CURSOR MOVEMENT ====== */
  function moveCursor(dir, multiplier) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;

    const from = cm.getCursor('from');   // anchor point
    let head = cm.getCursor('to');       // current head
    const isVertical = (dir === 'up' || dir === 'down');
    const step = (dir === 'up' || dir === 'left') ? -multiplier : multiplier;

    for (let i = 0; i < Math.abs(step); i++) {
      const delta = step > 0 ? 1 : -1;
      head = isVertical
        ? cm.findPosV(head, delta, 'line')
        : cm.findPosH(head, delta, 'char');
    }
    cm.setSelection(from, head);
  }

  curUp.addEventListener('click',    () => moveCursor('up',    1));
  curDown.addEventListener('click',  () => moveCursor('down',  1));
  curLeft.addEventListener('click',  () => moveCursor('left',  1));
  curRight.addEventListener('click', () => moveCursor('right', 1));
  curDblUp.addEventListener('click',    () => moveCursor('up',    10));
  curDblDown.addEventListener('click',  () => moveCursor('down',  10));
  curDblLeft.addEventListener('click',  () => moveCursor('left',  10));
  curDblRight.addEventListener('click', () => moveCursor('right', 10));

  /* ====== AUTO-OPEN MENU AFTER 5 SECONDS OF INACTIVITY ====== */
  let selectionTimeout = null;

  function clearSelectionTimeout() {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
      selectionTimeout = null;
    }
  }

  function scheduleMenuOpen() {
    clearSelectionTimeout();
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;
    const sel = cm.getSelection();
    if (sel && sel.length > 0 && !menuOpen()) {
      selectionTimeout = setTimeout(() => {
        if (cm.getSelection() && !menuOpen()) {
          openMenu();
        }
        selectionTimeout = null;
      }, 5000);   // 5 seconds delay
    }
  }

  function attachCursorActivity() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(attachCursorActivity, 300); return; }
    if (cm.__dexCursorActivityBound) return;
    cm.__dexCursorActivityBound = true;

    cm.on('cursorActivity', () => {
      if (menuOpen() && !cm.getSelection()) {
        closeMenu();
      }
      scheduleMenuOpen();
    });
  }

  /* ====== LONG-TAP – SELECT FROM CURRENT CURSOR TO TAPPED POSITION ====== */
  function fireLongPress(clientX, clientY) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;

    let pos;
    try {
      pos = cm.coordsChar({ left: clientX, top: clientY }, 'window');
    } catch (_e) {
      return;
    }
    if (!pos) return;

    const from = cm.getCursor('from');
    const to   = pos;

    try {
      cm.setSelection(from, to);
    } catch (_e) {
      return;
    }

    savedSelection = {
      from: cm.getCursor('from'),
      to:   cm.getCursor('to'),
      text: cm.getSelection()
    };
    // Do NOT open the menu here – let the 5‑second inactivity timer handle it.
  }

  /* ====== DRAG-TO-SELECT FOR MOBILE/TABLET ====== */
  const LONG_PRESS_MS  = 500;
  const MOVE_TOLERANCE = 10;

  function attachMobileDragSelect() {
    const cmEl = document.querySelector('.CodeMirror');
    if (!cmEl) { setTimeout(attachMobileDragSelect, 200); return; }
    if (cmEl.__dexMobileDragBound) return;
    cmEl.__dexMobileDragBound = true;

    cmEl.addEventListener('contextmenu', (e) => {});
    cmEl.addEventListener('selectstart', (e) => {});

    let dragSelectState = null;

    cmEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

      const ed = window.dexEditor;
      const cm = ed && ed.cm ? ed.cm : null;
      if (!cm) return;

      const startX = e.clientX, startY = e.clientY;
      const longPressTimer = setTimeout(() => {
        if (dragSelectState && dragSelectState.isDragging) return;
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

      if (!dragSelectState.isDragging && dist > MOVE_TOLERANCE) {
        dragSelectState.isDragging = true;
        clearTimeout(dragSelectState.longPressTimer);
        dragSelectState.cancelled = true;
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
            scheduleMenuOpen();
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
    attachCursorActivity();
    attachMobileDragSelect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('popstate', updateToolbarVisibility);
  window.addEventListener('hashchange', updateToolbarVisibility);

})();