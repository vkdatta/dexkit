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

  const MENU_TREE = [
    { id: 'dexTbCopy',  label: 'Copy',  icon: ICONS.copy },
    { id: 'dexTbCut',   label: 'Cut',   icon: ICONS.cut },
    { id: 'dexTbPaste', label: 'Paste', icon: ICONS.paste },
    { sep: true },
    { id: 'dexTbSelectAll', label: 'Select All', icon: ICONS.select_all },
    { sep: true },
    {
      id: 'diff', label: 'Diff', icon: ICONS.swap,
      children: [
        { id: 'dexTbDiffSwap',       label: 'Swap Raw ↔ Morph', icon: ICONS.swap },
        { sep: true },
        { id: 'dexTbDiffCopyRaw',    label: 'Copy Raw',    icon: ICONS.copy },
        { id: 'dexTbDiffCopyMorph',  label: 'Copy Morph',  icon: ICONS.copy },
        { id: 'dexTbDiffPasteRaw',   label: 'Paste to Raw',   icon: ICONS.paste },
        { id: 'dexTbDiffPasteMorph', label: 'Paste to Morph', icon: ICONS.paste },
        { sep: true },
        { id: 'dexTbDiffClearRaw',   label: 'Clear Raw',   icon: ICONS.delete, danger: true },
        { id: 'dexTbDiffClearMorph', label: 'Clear Morph', icon: ICONS.delete, danger: true }
      ]
    },
    { sep: true },
    { id: 'dexTbDelete', label: 'Delete', icon: ICONS.delete, danger: true },
    { sep: true },
    { id: 'dexTbClose',     label: 'Close menu',  icon: ICONS.close },
    { id: 'dexTbCloseDpad', label: 'Close D-Pad', icon: ICONS.close_fullscreen, danger: true }
  ];

  function renderItem(it) {
    if (it.sep) return '<div class="dex-tb-sep"></div>';
    if (it.children) {
      return '<button type="button" class="dex-tb-item dex-tb-parent" data-open-submenu="' + it.id + '">' +
               '<span class="material-symbols-rounded">' + it.icon + '</span>' +
               '<span>' + it.label + '</span>' +
               '<span class="dex-tb-chevron material-symbols-rounded">' + ICONS.chevron_right + '</span>' +
             '</button>';
    }
    return '<button type="button" class="dex-tb-item' + (it.danger ? ' dex-tb-danger' : '') + '" id="' + it.id + '">' +
             '<span class="material-symbols-rounded">' + it.icon + '</span>' +
             '<span>' + it.label + '</span>' +
           '</button>';
  }

  function renderPanel(items, panelId, isRoot) {
    const panel = document.createElement('div');
    panel.className = 'dex-tb-panel';
    panel.dataset.panel = panelId;
    if (!isRoot) panel.hidden = true;
    let html = '';
    if (!isRoot) {
      html += '<button type="button" class="dex-tb-item dex-tb-back" data-back="1">' +
                '<span class="material-symbols-rounded">' + ICONS.back + '</span>' +
                '<span>Back</span>' +
              '</button>' +
              '<div class="dex-tb-sep"></div>';
    }
    items.forEach(it => { html += renderItem(it); });
    panel.innerHTML = html;
    return panel;
  }

  function collectPanels(items, panels) {
    items.forEach(it => {
      if (!it.children) return;
      panels.push(renderPanel(it.children, it.id, false));
      collectPanels(it.children, panels);
    });
  }

  const menu = document.createElement('div');
  menu.id = 'dexToolbarMenu';
  menu.appendChild(renderPanel(MENU_TREE, 'root', true));
  (function appendSubmenus() {
    const panels = [];
    collectPanels(MENU_TREE, panels);
    panels.forEach(p => menu.appendChild(p));
  })();
  document.body.appendChild(menu);
  ctx.menu = menu;

  function menuOpen() { return menu.classList.contains('open'); }
  ctx.menuOpen = menuOpen;

  function showPanel(panelId) {
    menu.querySelectorAll('.dex-tb-panel').forEach(p => {
      p.hidden = (p.dataset.panel !== panelId);
    });
    ctx.activePanel = panelId;
  }
  ctx.showPanel = showPanel;

  function updateDiffEntryVisibility() {
    const trigger = menu.querySelector('[data-open-submenu="diff"]');
    if (!trigger) return;
    const m = /^\/note\/[^/]+\/([a-z]+)/.exec(window.location.pathname);
    trigger.style.display = (m && m[1] === 'diffusion') ? '' : 'none';
  }
  ctx.updateDiffEntryVisibility = updateDiffEntryVisibility;

  menu.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-submenu]');
    if (openBtn) { showPanel(openBtn.dataset.openSubmenu); positionMenu(); return; }
    const backBtn = e.target.closest('[data-back]');
    if (backBtn) { showPanel('root'); positionMenu(); return; }
  });

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
      left = anchor.x + ctx.MENU_GAP;
      top  = anchor.y + ctx.MENU_GAP;
    } else {
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

  let selectionTimeout = null;
  function clearSelectionTimeout() {
    if (selectionTimeout) { clearTimeout(selectionTimeout); selectionTimeout = null; }
  }
  ctx.clearSelectionTimeout = clearSelectionTimeout;
  ctx.getSelectionTimeout = () => selectionTimeout;
  ctx.setSelectionTimeout = (id) => { selectionTimeout = id; };

  function openMenu() {
    captureSelection();
    showPanel('root');
    updateDiffEntryVisibility();
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

  window.dexOpenToolbar   = openMenu;
  window.dexCloseToolbar  = closeMenu;
  window.dexToggleToolbar = toggleMenu;
})();
