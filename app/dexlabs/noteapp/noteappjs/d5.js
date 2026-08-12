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
    close: 'close',
    arrowUp: 'arrow_upward',
    arrowDown: 'arrow_downward',
    selectOff: 'select_all',
    selectOn: 'text_select_end'
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

    .dex-tb-arrow {
      background: transparent;
      border: none;
      color: var(--color, #cacaca);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .dex-tb-arrow:hover, .dex-tb-arrow:active { background: rgba(255,255,255,0.08); }
    .dex-tb-arrow > * { pointer-events: none; }
    .dex-tb-arrow .material-symbols-rounded { font-size: 22px; }

    .dex-tb-select-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      color: var(--color, #cacaca);
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .dex-tb-select-toggle:hover, .dex-tb-select-toggle:active {
      background: rgba(255,255,255,0.06);
    }
    .dex-tb-select-toggle.active {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute('aria-label', 'Open editor toolbar');
  btn.innerHTML = '<span class="material-symbols-rounded" id="dexToolbarBtnIcon">' + ICONS.down + '</span>';
  document.body.appendChild(btn);

  // Build menu with arrows and select toggle
  const menu = document.createElement('div');
  menu.id = 'dexToolbarMenu';
  menu.innerHTML = `
    <button type="button" class="dex-tb-item" id="dexTbCopy">
      <span class="material-symbols-rounded">${ICONS.copy}</span>
      <span>Copy</span>
    </button>
    <button type="button" class="dex-tb-item" id="dexTbPaste">
      <span class="material-symbols-rounded">${ICONS.paste}</span>
      <span>Paste</span>
    </button>
    <div class="dex-tb-sep"></div>
    <div style="display:flex; gap:6px; padding:4px 8px; justify-content:space-around;">
      <button type="button" class="dex-tb-arrow" data-dir="left"><span class="material-symbols-rounded">${ICONS.left}</span></button>
      <button type="button" class="dex-tb-arrow" data-dir="right"><span class="material-symbols-rounded">${ICONS.right}</span></button>
      <button type="button" class="dex-tb-arrow" data-dir="up"><span class="material-symbols-rounded">${ICONS.arrowUp}</span></button>
      <button type="button" class="dex-tb-arrow" data-dir="down"><span class="material-symbols-rounded">${ICONS.arrowDown}</span></button>
    </div>
    <div style="display:flex; padding:2px 8px 6px; justify-content:center;">
      <button type="button" class="dex-tb-select-toggle" id="dexTbSelectToggle">
        <span class="material-symbols-rounded" id="dexTbSelectIcon">${ICONS.selectOff}</span>
        <span id="dexTbSelectLabel">Select</span>
      </button>
    </div>
    <div class="dex-tb-sep"></div>
    <button type="button" class="dex-tb-item" id="dexTbClose">
      <span class="material-symbols-rounded">${ICONS.close}</span>
      <span>Close menu</span>
    </button>
  `;
  document.body.appendChild(menu);

  const btnIcon = document.getElementById('dexToolbarBtnIcon');
  const copyEl  = document.getElementById('dexTbCopy');
  const pasteEl = document.getElementById('dexTbPaste');
  const closeEl = document.getElementById('dexTbClose');
  const selectToggle = document.getElementById('dexTbSelectToggle');
  const selectIcon = document.getElementById('dexTbSelectIcon');
  const selectLabel = document.getElementById('dexTbSelectLabel');

  let selectMode = false;

  // Toggle select mode
  selectToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectMode = !selectMode;
    selectToggle.classList.toggle('active', selectMode);
    selectIcon.textContent = selectMode ? ICONS.selectOn : ICONS.selectOff;
    selectLabel.textContent = selectMode ? 'Select on' : 'Select';
  });

  // Arrow button handler
  function handleArrow(dir) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm;
    if (!cm) return;

    // Suppress auto-close during this operation
    window._dexSuppressAutoClose = true;
    setTimeout(() => { window._dexSuppressAutoClose = false; }, 100);

    const cursor = cm.getCursor();
    let anchor = cm.getCursor('from'); // start of selection or cursor
    let head = { line: cursor.line, ch: cursor.ch };

    // Compute new head based on direction
    const line = cm.getLine(head.line);
    const lastCh = line ? line.length : 0;
    switch (dir) {
      case 'left':
        if (head.ch > 0) head.ch--;
        else if (head.line > 0) { head.line--; head.ch = cm.getLine(head.line).length; }
        break;
      case 'right':
        if (head.ch < lastCh) head.ch++;
        else if (head.line < cm.lineCount() - 1) { head.line++; head.ch = 0; }
        break;
      case 'up':
        if (head.line > 0) {
          head.line--;
          const newLine = cm.getLine(head.line);
          head.ch = Math.min(head.ch, newLine.length);
        }
        break;
      case 'down':
        if (head.line < cm.lineCount() - 1) {
          head.line++;
          const newLine = cm.getLine(head.line);
          head.ch = Math.min(head.ch, newLine.length);
        }
        break;
    }

    if (selectMode) {
      // Extend selection: keep anchor fixed, move head
      cm.setSelection(anchor, head);
    } else {
      // Just move cursor, clear selection
      cm.setCursor(head);
    }

    // Update savedSelection for copy/paste
    const sel = cm.getSelection();
    if (sel) {
      savedSelection = { from: cm.getCursor('from'), to: cm.getCursor('to'), text: sel };
    } else {
      savedSelection = null;
    }

    // Reposition menu to stay near selection/cursor
    if (menuOpen()) positionMenu();
  }

  // Attach arrow listeners
  document.querySelectorAll('.dex-tb-arrow').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = el.dataset.dir;
      handleArrow(dir);
    });
    // Prevent menu close on touch/pointer
    el.addEventListener('mousedown', e => e.preventDefault());
  });

  // ----------------------------------------
  //  Homepage detection and visibility
  // ----------------------------------------
  let toolbarVisible = true;

  function hideToolbar() {
    toolbarVisible = false;
    btn.style.display = 'none';
    menu.style.display = 'none';
    menu.classList.remove('open');
  }

  function showToolbar() {
    toolbarVisible = true;
    btn.style.display = '';
    menu.style.display = '';
  }

  function isEditorPage() {
    return !!(window.dexEditor && window.dexEditor.cm);
  }

  let editorCheckAttempts = 0;
  function checkEditorPresence() {
    if (isEditorPage()) {
      showToolbar();
      attachEditorListeners();
      return;
    }
    if (++editorCheckAttempts > 10) {
      hideToolbar();
      return;
    }
    setTimeout(checkEditorPresence, 300);
  }

  // ----------------------------------------
  //  Positioning & drag logic
  // ----------------------------------------
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

  // ----------------------------------------
  //  Menu open/close / positioning
  // ----------------------------------------
  function menuOpen() { return menu.classList.contains('open'); }

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

  function openMenu() {
    if (!toolbarVisible) return;
    captureSelection();
    positionMenu();
    menu.classList.add('open');
  }

  function closeMenu() {
    menu.classList.remove('open');
    setTimeout(() => { savedSelection = null; }, 300);
  }

  function toggleMenu() {
    if (!toolbarVisible) return;
    menuOpen() ? closeMenu() : openMenu();
  }

  window.dexOpenToolbar   = openMenu;
  window.dexCloseToolbar  = closeMenu;
  window.dexToggleToolbar = toggleMenu;

  // ----------------------------------------
  //  Editor listeners: auto-open on selection, close on cursor move (with suppress flag)
  // ----------------------------------------
  function attachEditorListeners() {
    const cm = window.dexEditor && window.dexEditor.cm;
    if (!cm) {
      setTimeout(attachEditorListeners, 300);
      return;
    }

    if (cm.__dexCursorListener) {
      cm.off('cursorActivity', cm.__dexCursorListener);
    }

    const handler = function() {
      // If suppressed, skip auto-close
      if (window._dexSuppressAutoClose) return;

      if (!menuOpen()) {
        const sel = cm.getSelection();
        if (sel && sel.length > 0) {
          openMenu();
        }
        return;
      }

      // Menu is open
      const sel = cm.getSelection();
      if (sel && sel.length > 0) {
        // Selection still there – reposition menu
        positionMenu();
      } else {
        // Selection cleared – close menu
        closeMenu();
      }
    };

    cm.on('cursorActivity', handler);
    cm.__dexCursorListener = handler;
  }

  // ----------------------------------------
  //  Copy / Paste / Close actions
  // ----------------------------------------
  function notify(m) {
    if (typeof showNotification === 'function') showNotification(m);
  }

  function isPosValid(cm, pos) {
    if (!pos || typeof pos.line !== 'number' || typeof pos.ch !== 'number') return false;
    const lc = cm.lineCount();
    if (pos.line < 0 || pos.line >= lc) return false;
    const lineLen = cm.getLine(pos.line).length;
    return pos.ch >= 0 && pos.ch <= lineLen;
  }

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

  closeEl.addEventListener('click', closeMenu);

  // Prevent context menu on editor (optional)
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.CodeMirror')) e.preventDefault();
  });

  // ----------------------------------------
  //  Initialize
  // ----------------------------------------
  checkEditorPresence();
})();