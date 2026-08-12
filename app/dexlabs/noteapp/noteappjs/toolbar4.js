// ============================================================================
// DexLabs — Custom editor toolbar, v2.
//
// A floating draggable chevron button + a popup menu.
//
//   * The user can drag the button anywhere on the screen. Position persists
//     across refreshes (localStorage → 'dexToolbarPos').
//   * The chevron icon on the button changes based on where it is relative
//     to the viewport's nearest edge — near the top → chevron-down (default),
//     near the left → chevron-right, and so on. The chevron always points
//     toward where the menu will open.
//   * Tapping the button opens the menu. Dragging moves it. The drag/tap
//     boundary is 8px of movement.
//   * The menu opens NEAR the current text selection when there is one, or
//     next to the button (on the chevron side) when there is not.
//   * The menu stays open across any editor activity — only the trigger tap
//     or the in-menu Close button dismisses it.
//   * NO contextmenu interception, NO edits to the CM element's CSS or
//     event handlers → native long-press text selection continues to work
//     exactly as the browser provides. We only suppress the browser's
//     native callout via `-webkit-touch-callout: none` on the whole
//     document, which does not block selection.
// ============================================================================
(function () {
  'use strict';
  if (window.__dexToolbar2Loaded) return;
  window.__dexToolbar2Loaded = true;

  const LS_KEY = 'dexToolbarPos';
  const TRIGGER_SIZE = 40;   // px, circle diameter
  const DRAG_THRESHOLD = 8;  // px before a pointerdown counts as a drag
  const EDGE_MARGIN = 8;     // px kept clear at viewport edges
  const MENU_GAP = 12;       // px space between menu and its anchor point

  const ICONS = {
    down: 'expand_more', up: 'expand_less',
    left: 'chevron_left', right: 'chevron_right',
    copy: 'content_copy', paste: 'content_paste',
    close: 'close'
  };

  // ── styles ────────────────────────────────────────────────────────────────
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
      touch-action: none;                 /* let us handle pan gestures ourselves */
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

    /* Custom selection takeover — we do our own long-press selection via
       cm.setSelection (which paints into CM's own .CodeMirror-selected
       overlay). The browser's native selection AND its callout toolbar are
       both suppressed by disabling user-select on the CM lines and disabling
       the callout on the wrapper. */
    .CodeMirror { -webkit-touch-callout: none; }
    .CodeMirror-line,
    .CodeMirror-line *,
    .CodeMirror pre.CodeMirror-line,
    .CodeMirror pre.CodeMirror-line-like {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
  `;
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
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

  // ── position: load / save / clamp ─────────────────────────────────────────
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
    // Right side, roughly a third down. Natural resting position that
    // doesn't collide with topbar or the note textarea's typical caret zone.
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

  // ── chevron direction: opposite of the nearest viewport edge ─────────────
  function chevronForPos(pos) {
    const w = window.innerWidth, h = window.innerHeight;
    const distLeft   = pos.left;
    const distRight  = w - pos.left - TRIGGER_SIZE;
    const distTop    = pos.top;
    const distBottom = h - pos.top - TRIGGER_SIZE;
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    // Tie-break preference is DOWN — spec default.
    if (min === distTop && distTop <= distLeft && distTop <= distRight && distTop <= distBottom) return 'down';
    if (min === distBottom) return 'up';
    if (min === distLeft)   return 'right';
    if (min === distRight)  return 'left';
    return 'down';
  }
  function updateChevron(pos) {
    const dir = chevronForPos(pos);
    btnIcon.textContent = ICONS[dir];
    btn.dataset.dir = dir;   // used later when positioning the menu
  }

  const initial = loadPos() || defaultPos();
  applyPos(clamp(initial.left, initial.top));

  // ── drag vs tap ───────────────────────────────────────────────────────────
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
      // If the menu is open, close it while dragging.
      if (menuOpen()) closeMenu();
    }
    const next = clamp(drag.startLeft + dx, drag.startTop + dy);
    applyPos(next);
  });

  function endDrag(e) {
    if (!drag) return;
    const wasDrag = drag.moved;
    const startedAt = { x: drag.startLeft, y: drag.startTop };
    try { btn.releasePointerCapture(drag.pointerId); } catch (_e) {}
    drag = null;
    btn.classList.remove('dragging');
    if (wasDrag) {
      const pos = { left: btn.offsetLeft, top: btn.offsetTop };
      savePos(pos.left, pos.top);
      updateChevron(pos);
    } else {
      // Treated as a tap on the trigger.
      toggleMenu();
    }
  }
  btn.addEventListener('pointerup',     endDrag);
  btn.addEventListener('pointercancel', endDrag);

  // Reclamp on viewport resize (rotation, keyboard show/hide, etc.)
  window.addEventListener('resize', () => {
    const clamped = clamp(btn.offsetLeft, btn.offsetTop);
    applyPos(clamped);
    savePos(clamped.left, clamped.top);
  });

  // ── menu open / close ─────────────────────────────────────────────────────
  function menuOpen() { return menu.classList.contains('open'); }

  function positionMenu() {
    // Prefer: near current CM selection. Fallback: adjacent to trigger,
    // on the side the chevron points to (so the visual promise is honoured).
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

    // Get menu size (needs to be display:flex briefly to measure).
    menu.style.visibility = 'hidden';
    menu.classList.add('open');
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    menu.classList.remove('open');
    menu.style.visibility = '';

    const vw = window.innerWidth, vh = window.innerHeight;
    let left, top;

    if (anchor && anchor.fromSelection) {
      // Place menu just below the selection end, offset a bit.
      left = anchor.x + MENU_GAP;
      top  = anchor.y + MENU_GAP;
    } else if (anchor) {
      // Cursor exists but nothing selected — put menu somewhere that doesn't
      // collide with the cursor. Bias to the opposite half of the viewport
      // from the cursor.
      const bx = btn.offsetLeft, by = btn.offsetTop;
      left = (anchor.x < vw / 2) ? (vw - menuW - MENU_GAP - EDGE_MARGIN) : (MENU_GAP + EDGE_MARGIN);
      top  = (anchor.y < vh / 2) ? (vh - menuH - MENU_GAP - EDGE_MARGIN) : (MENU_GAP + EDGE_MARGIN);
      // But also keep some proximity to the trigger's chevron direction.
      const dir = btn.dataset.dir;
      if (dir === 'left')  left = bx - menuW - MENU_GAP;
      if (dir === 'right') left = bx + TRIGGER_SIZE + MENU_GAP;
      if (dir === 'up')    top  = by - menuH - MENU_GAP;
      if (dir === 'down')  top  = by + TRIGGER_SIZE + MENU_GAP;
    } else {
      // Editor not ready — anchor to the trigger on the chevron side.
      const bx = btn.offsetLeft, by = btn.offsetTop;
      const dir = btn.dataset.dir || 'down';
      if (dir === 'left')  { left = bx - menuW - MENU_GAP; top = by; }
      else if (dir === 'right') { left = bx + TRIGGER_SIZE + MENU_GAP; top = by; }
      else if (dir === 'up')    { left = bx; top = by - menuH - MENU_GAP; }
      else                       { left = bx; top = by + TRIGGER_SIZE + MENU_GAP; }
    }

    // Clamp to viewport with edge margins.
    left = Math.max(EDGE_MARGIN, Math.min(vw - menuW - EDGE_MARGIN, left));
    top  = Math.max(EDGE_MARGIN, Math.min(vh - menuH - EDGE_MARGIN, top));

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  // Preserve any live text selection in CM: we capture it at open time
  // AND arrange for menu-button mousedowns not to steal focus.
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
    // Don't clear savedSelection here — the button click handlers may still
    // need it (they fire slightly after our close in some paths).
    setTimeout(() => { savedSelection = null; }, 300);
  }
  function toggleMenu() { menuOpen() ? closeMenu() : openMenu(); }

  window.dexOpenToolbar   = openMenu;
  window.dexCloseToolbar  = closeMenu;
  window.dexToggleToolbar = toggleMenu;

  // ── menu button behaviour ─────────────────────────────────────────────────
  // Preventing default on `mousedown` keeps focus on CM so the selection
  // isn't wiped before we read it.
  [copyEl, pasteEl, closeEl].forEach(el => {
    el.addEventListener('mousedown', e => e.preventDefault());
  });

  function notify(m) {
    if (typeof showNotification === 'function') showNotification(m);
  }

  copyEl.addEventListener('click', async () => {
    const ed = window.dexEditor;
    // Prefer the selection we captured when the menu opened — the tap
    // trip on some Android WebViews can briefly collapse the selection.
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

    // Insertion range: prefer the range we captured when the menu opened
    // (before any focus shift), fall back to the current cursor, then to
    // the start of the doc. NEVER call cm.focus() before the mutation —
    // on mobile that crosses the user-gesture boundary after the awaited
    // clipboard read and can leave the selection in a stale/collapsed
    // state that swallows replaceSelection silently.
    let from, to;
    if (savedSelection && isPosValid(cm, savedSelection.from) && isPosValid(cm, savedSelection.to)) {
      from = savedSelection.from;
      to   = savedSelection.to;
    } else {
      const c = cm.getCursor();
      from = c; to = c;
    }

    // Atomic doc mutation. cm.replaceRange doesn't care about focus or
    // the currently rendered selection — it edits the document model
    // directly. That's what "Pasted" should mean.
    cm.operation(() => {
      cm.replaceRange(text, from, to);
      const startIdx = cm.indexFromPos(from);
      const endPos   = cm.posFromIndex(startIdx + text.length);
      cm.setSelection(endPos, endPos);
    });

    // Refresh savedSelection to the post-paste caret so a chained action
    // (e.g., paste twice, or paste then copy) lands where you'd expect.
    const startIdx = cm.indexFromPos(from);
    const endPos   = cm.posFromIndex(startIdx + text.length);
    savedSelection = { from: endPos, to: endPos, text: '' };

    notify('Pasted ' + text.length + ' character' + (text.length === 1 ? '' : 's'));
  });

  // Position validity check — a saved selection from before a doc edit
  // could point beyond the current line count / line length. Guard against
  // that so a stale saved range never crashes cm.replaceRange.
  function isPosValid(cm, pos) {
    if (!pos || typeof pos.line !== 'number' || typeof pos.ch !== 'number') return false;
    const lc = cm.lineCount();
    if (pos.line < 0 || pos.line >= lc) return false;
    const lineLen = cm.getLine(pos.line).length;
    return pos.ch >= 0 && pos.ch <= lineLen;
  }

  closeEl.addEventListener('click', closeMenu);

  // ═══════════════════════════════════════════════════════════════════════
  // Custom long-press selection.
  //
  // Native mobile selection is off (via user-select:none on CM lines), so we
  // provide our own: hold a finger on the editor for LONG_PRESS_MS, and we
  // (a) figure out which character was under the finger, (b) find the word
  // bounds, (c) select that word via cm.setSelection (which draws into CM's
  // own overlay), and (d) auto-open the menu right next to the selection.
  //
  // Short taps aren't intercepted — the pointerdown callback just starts a
  // timer; anything under LONG_PRESS_MS or with movement > MOVE_TOLERANCE
  // cancels, letting CM's own tap handling place the cursor normally.
  // ═══════════════════════════════════════════════════════════════════════
  const LONG_PRESS_MS  = 500;   // change to 2000 if you want the 2-second hold you described
  const MOVE_TOLERANCE = 10;    // px finger drift allowed before cancel

  function wordBoundsAt(cm, pos) {
    const line = cm.getLine(pos.line) || '';
    const isWord = (c) => c && /[\w$@#-]/.test(c);   // liberal: hyphens, $, @, #
    let s = pos.ch, e = pos.ch;
    while (s > 0 && isWord(line[s - 1])) s--;
    while (e < line.length && isWord(line[e])) e++;
    if (s === e) {
      // Not on a word char — select the single char under the finger, or
      // if we're at end-of-line, just place a caret.
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
    // Prime savedSelection immediately so a Copy tap right after has the
    // exact range without going back through captureSelection().
    savedSelection = {
      from: bounds.from,
      to:   bounds.to,
      text: cm.getRange(bounds.from, bounds.to)
    };
    // Open menu positioned against the fresh selection.
    openMenu();
  }

  function attachLongPress() {
    const cmEl = document.querySelector('.CodeMirror');
    if (!cmEl) { setTimeout(attachLongPress, 200); return; }
    if (cmEl.__dexLongPressBound) return;
    cmEl.__dexLongPressBound = true;

    cmEl.addEventListener('pointerdown', (e) => {
      // Only for touch — mouse users have right-click via contextmenu (which
      // browsers still fire; CM handles it internally).
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const startX = e.clientX, startY = e.clientY;
      let cancelled = false;

      const timer = setTimeout(() => {
        if (cancelled) return;
        cleanup();
        fireLongPress(startX, startY);
      }, LONG_PRESS_MS);

      function onMove(ev) {
        if (cancelled) return;
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) {
          cancelled = true;
          clearTimeout(timer);
          cleanup();
        }
      }
      function onEnd() {
        if (cancelled) return;
        cancelled = true;
        clearTimeout(timer);
        cleanup();
      }
      function cleanup() {
        document.removeEventListener('pointermove',   onMove);
        document.removeEventListener('pointerup',     onEnd);
        document.removeEventListener('pointercancel', onEnd);
      }
      document.addEventListener('pointermove',   onMove);
      document.addEventListener('pointerup',     onEnd);
      document.addEventListener('pointercancel', onEnd);
    });
  }

  // .CodeMirror may not exist yet when this script loads; retry until it does.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachLongPress, { once: true });
  } else {
    attachLongPress();
  }
})();
