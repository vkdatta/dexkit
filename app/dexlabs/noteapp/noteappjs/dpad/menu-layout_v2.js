/* ================================================================
   menu-layout.js
   -----------------------------------------------------------------
   Layout / DOM for the tool menu that hangs off the D-Pad.
   Menu items:
     • Copy
     • Paste
     • Select All
     • Close menu         (closes the menu, D-Pad stays)
     • Close D-Pad        (fully hides the D-Pad — added per request)
   Also owns menu positioning + open / close / toggle.
   The click handlers for each item live in menu-functions.js.
   ================================================================ */

(function () {
  const ctx = window.__dexDpad;
  if (!ctx || !ctx.cursorControls) {
    console.error('[menu-layout] dpad-layout.js must load first');
    return;
  }
  if (ctx.__menuLayoutLoaded) return;
  ctx.__menuLayoutLoaded = true;

  const ICONS = ctx.ICONS;
  const cursorControls = ctx.cursorControls;

  /* ====== MENU DOM ====== */
  const menu = document.createElement('div');
  menu.id = 'dexToolbarMenu';
  menu.innerHTML =
    '<button type="button" class="dex-tb-item" id="dexTbCopy">' +
      '<span class="material-symbols-rounded">' + ICONS.copy + '</span>' +
      '<span>Copy</span>' +
    '</button>' +
    '<button type="button" class="dex-tb-item" id="dexTbPaste">' +
      '<span class="material-symbols-rounded">' + ICONS.paste + '</span>' +
      '<span>Paste</span>' +
    '</button>' +
    '<div class="dex-tb-sep"></div>' +
    '<button type="button" class="dex-tb-item" id="dexTbSelectAll">' +
      '<span class="material-symbols-rounded">' + ICONS.select_all + '</span>' +
      '<span>Select All</span>' +
    '</button>' +
    '<div class="dex-tb-sep"></div>' +
    '<button type="button" class="dex-tb-item" id="dexTbClose">' +
      '<span class="material-symbols-rounded">' + ICONS.close + '</span>' +
      '<span>Close menu</span>' +
    '</button>' +
    '<button type="button" class="dex-tb-item dex-tb-danger" id="dexTbCloseDpad">' +
      '<span class="material-symbols-rounded">' + ICONS.close_fullscreen + '</span>' +
      '<span>Close D-Pad</span>' +
    '</button>';
  document.body.appendChild(menu);
  ctx.menu = menu;

  /* ====== MENU STATE ====== */
  function menuOpen() { return menu.classList.contains('open'); }
  ctx.menuOpen = menuOpen;

  /* ====== POSITIONING ====== */
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

    // Measure while invisible
    menu.style.visibility = 'hidden';
    menu.classList.add('open');
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    menu.classList.remove('open');
    menu.style.visibility = '';

    const vw = window.innerWidth, vh = window.innerHeight;
    let left, top;

    if (anchor && anchor.fromSelection) {
      left = anchor.x + ctx.MENU_GAP;
      top  = anchor.y + ctx.MENU_GAP;
    } else {
      // Anchor menu to the center of the cursorControls circle
      const ccLeft = cursorControls.offsetLeft;
      const ccTop  = cursorControls.offsetTop;
      const ccW    = cursorControls.offsetWidth  || 165;
      const ccH    = cursorControls.offsetHeight || 165;
      const cx = ccLeft + ccW / 2;
      const cy = ccTop  + ccH / 2;
      left = cx - menuW / 2;
      if (cy > vh / 2) top = ccTop - menuH - ctx.MENU_GAP;
      else             top = ccTop + ccH + ctx.MENU_GAP;
    }

    left = Math.max(ctx.EDGE_MARGIN, Math.min(vw - menuW - ctx.EDGE_MARGIN, left));
    top  = Math.max(ctx.EDGE_MARGIN, Math.min(vh - menuH - ctx.EDGE_MARGIN, top));

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }
  ctx.positionMenu = positionMenu;

  /* ====== CAPTURE / RESTORE SELECTION ====== */
  function captureSelection() {
    try {
      const ed = window.dexEditor;
      if (ed && ed.cm) {
        const cm = ed.cm;
        ctx.setSavedSelection({
          from: cm.getCursor('from'),
          to:   cm.getCursor('to'),
          text: cm.getSelection()
        });
      }
    } catch (_e) {}
  }
  function restoreSelection() {
    try {
      const ed = window.dexEditor;
      const saved = ctx.getSavedSelection();
      if (ed && ed.cm && saved) {
        ed.cm.setSelection(saved.from, saved.to);
        ed.cm.focus();
      }
    } catch (_e) {}
  }
  ctx.captureSelection = captureSelection;
  ctx.restoreSelection = restoreSelection;

  /* ====== OPEN / CLOSE / TOGGLE ====== */
  let selectionTimeout = null;
  function clearSelectionTimeout() {
    if (selectionTimeout) { clearTimeout(selectionTimeout); selectionTimeout = null; }
  }
  ctx.clearSelectionTimeout = clearSelectionTimeout;
  ctx.getSelectionTimeout = () => selectionTimeout;
  ctx.setSelectionTimeout = (id) => { selectionTimeout = id; };

  function openMenu() {
    captureSelection();
    positionMenu();
    menu.classList.add('open');
    clearSelectionTimeout();
  }
  function closeMenu() {
    menu.classList.remove('open');
    setTimeout(() => { ctx.clearSavedSelection(); }, 300);
    clearSelectionTimeout();
  }
  function toggleMenu() { menuOpen() ? closeMenu() : openMenu(); }

  ctx.openMenu = openMenu;
  ctx.closeMenu = closeMenu;
  ctx.toggleMenu = toggleMenu;

  // Public API mirrors the original names for backwards compatibility.
  window.dexOpenToolbar   = openMenu;
  window.dexCloseToolbar  = closeMenu;
  window.dexToggleToolbar = toggleMenu;
})();
