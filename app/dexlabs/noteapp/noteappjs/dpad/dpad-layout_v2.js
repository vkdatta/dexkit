/* ================================================================
   dpad-layout.js
   -----------------------------------------------------------------
   Basic D-Pad layout + lifecycle.
     • Creates the D-Pad DOM (container, center dragger, snap dot,
       selection preview, particle canvas).
     • Manages D-Pad state: expanded / collapsed / hidden.
     • Handles the whole-D-Pad drag-to-reposition.
     • Detects the double-tap on the center circle.
     • Runs the inactivity auto-collapse timer (10 seconds).
     • Exposes toolmenu show/hide helpers that delegate into
       menu-layout.js via the shared window.__dexDpad context.
     • Provides `hideDpad` for the "Close D-Pad" menu item.
   Direction-button behavior lives in  dpad-functions.js
   Menu DOM and menu actions live in    menu-layout.js / menu-functions.js
   ================================================================ */

if (window.__dexToolbar2Loaded) {
  // No-op if already installed (same guard as the original IIFE).
} else {
  window.__dexToolbar2Loaded = true;

  /* ====== SHARED CONTEXT ======
     Every dpad-*.js file reads and writes through this single object.
     Kept on window so the four scripts stay loosely coupled. */
  const ctx = (window.__dexDpad = window.__dexDpad || {});

  /* ====== CONSTANTS ====== */
  ctx.LS_KEY = 'dexToolbarPos';
  ctx.CURSOR_KEY = 'dexCursorPos';
  ctx.CENTER_KEY = 'dexCenterPos';
  ctx.TRIGGER_SIZE = 40;
  ctx.DRAG_THRESHOLD = 8;
  ctx.EDGE_MARGIN = 8;
  ctx.MENU_GAP = 12;
  ctx.DBL_TAP_WINDOW = 300;          // ms between taps to count as double-tap
  ctx.INACTIVITY_TIMEOUT = 10000;    // 10 s of no D-Pad use → auto-collapse
                                     // (was 60000 ms; user requested 10 s)

  // Long-press auto-repeat tuning (used by dpad-functions.js)
  ctx.HOLD_START_DELAY = 350;
  ctx.HOLD_INITIAL_INTERVAL = 90;
  ctx.HOLD_MIN_INTERVAL = 20;
  ctx.HOLD_ACCEL_STEP = 4;

  ctx.ICONS = {
    down: 'expand_more', up: 'expand_less',
    left: 'chevron_left', right: 'chevron_right',
    copy: 'content_copy', paste: 'content_paste',
    close: 'close',
    close_fullscreen: 'close_fullscreen', // used for "Close D-Pad"
    dbl_up: 'keyboard_double_arrow_up',
    dbl_down: 'keyboard_double_arrow_down',
    dbl_left: 'keyboard_double_arrow_left',
    dbl_right: 'keyboard_double_arrow_right',
    drag: 'drag_indicator',
    select_all: 'select_all'
  };

  /* ====== THEME (kept for JS references; CSS values are baked into dpad.css) */
  ctx.THEME = {
    matte: '#181C1F',
    accent: '#00D4AA',
    accentGlow: 'rgba(0, 212, 170, 0.35)',
    accentDim: 'rgba(0, 212, 170, 0.12)',
    text: '#E8ECF0'
  };
  const THEME = ctx.THEME;
  const ICONS = ctx.ICONS;

  /* ====== PARTICLE SYSTEM ====== */
  const particleCanvas = document.createElement('canvas');
  particleCanvas.id = 'dexParticleCanvas';
  document.body.appendChild(particleCanvas);
  const pCtx = particleCanvas.getContext('2d');
  const particles = [];

  function resizeParticleCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
  resizeParticleCanvas();
  window.addEventListener('resize', resizeParticleCanvas);

  function spawnParticle(x, y, color) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2 - 1,
      life: 1,
      decay: 0.03 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color: color || THEME.accent
    });
  }

  function updateParticles() {
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.vy += 0.05;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      pCtx.globalAlpha = p.life * 0.6;
      pCtx.fillStyle = p.color;
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      pCtx.fill();
    }
    pCtx.globalAlpha = 1;
    requestAnimationFrame(updateParticles);
  }
  requestAnimationFrame(updateParticles);

  ctx.spawnParticle = spawnParticle;

  /* ====== LEGACY HIDDEN TOOLBAR BUTTON (kept as no-op stub) ====== */
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute('aria-label', 'Open editor toolbar');
  btn.innerHTML = '<span class="material-symbols-rounded" id="dexToolbarBtnIcon">' + ICONS.down + '</span>';
  btn.style.display = 'none';
  document.body.appendChild(btn);
  ctx.btn = btn;

  /* ====== CURSOR CONTROLS (D-Pad container + compass + center dragger) ====== */
  const cursorControls = document.createElement('div');
  cursorControls.id = 'dexCursorControls';
  cursorControls.innerHTML =
    '<button type="button" class="dex-cursor-btn cmp-n"  id="dexCurUp"       aria-label="Up">'         + '<span class="material-symbols-rounded">' + ICONS.up         + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-ne" id="dexCurDblUp"    aria-label="Fast up">'    + '<span class="material-symbols-rounded">' + ICONS.dbl_up     + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-e"  id="dexCurRight"    aria-label="Right">'      + '<span class="material-symbols-rounded">' + ICONS.right      + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-se" id="dexCurDblRight" aria-label="Fast right">' + '<span class="material-symbols-rounded">' + ICONS.dbl_right  + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-s"  id="dexCurDown"     aria-label="Down">'       + '<span class="material-symbols-rounded">' + ICONS.down       + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-sw" id="dexCurDblDown"  aria-label="Fast down">'  + '<span class="material-symbols-rounded">' + ICONS.dbl_down   + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-w"  id="dexCurLeft"     aria-label="Left">'       + '<span class="material-symbols-rounded">' + ICONS.left       + '</span></button>' +
    '<button type="button" class="dex-cursor-btn cmp-nw" id="dexCurDblLeft"  aria-label="Fast left">'  + '<span class="material-symbols-rounded">' + ICONS.dbl_left   + '</span></button>' +
    '<div class="dex-center-drag" id="dexCenterDrag" aria-label="Drag to select"></div>';
  document.body.appendChild(cursorControls);

  const centerHandle = document.getElementById('dexCenterDrag');
  ctx.cursorControls = cursorControls;
  ctx.centerHandle = centerHandle;

  /* ====== SELECTION PREVIEW ====== */
  const selectionPreview = document.createElement('div');
  selectionPreview.id = 'dexSelectionPreview';
  document.body.appendChild(selectionPreview);
  ctx.selectionPreview = selectionPreview;

  /* ====== SNAP INDICATOR ====== */
  const snapIndicator = document.createElement('div');
  snapIndicator.id = 'dexSnapIndicator';
  document.body.appendChild(snapIndicator);
  ctx.snapIndicator = snapIndicator;

  /* ====== HOMEPAGE / VISIBILITY ====== */
  function isHomepage() {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html' || path === '/home' || path === '';
  }

  function updateToolbarVisibility() {
    if (isHomepage()) {
      if (ctx.closeMenu) ctx.closeMenu();
      cursorControls.style.display = 'none';
    } else {
      cursorControls.style.display = 'flex';
      updateCenterHandle();
    }
  }
  ctx.isHomepage = isHomepage;
  ctx.updateToolbarVisibility = updateToolbarVisibility;

  /* ====== D-PAD POSITION HELPERS ====== */
  function loadCursorPos() {
    try {
      const raw = localStorage.getItem(ctx.CURSOR_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch (e) {}
    return null;
  }
  function saveCursorPos(left, top) {
    try { localStorage.setItem(ctx.CURSOR_KEY, JSON.stringify({ left, top })); } catch (e) {}
  }
  function clampCursor(left, top) {
    const cw = cursorControls.offsetWidth || 165;
    const ch = cursorControls.offsetHeight || 165;
    const maxLeft = window.innerWidth  - cw - ctx.EDGE_MARGIN;
    const maxTop  = window.innerHeight - ch - ctx.EDGE_MARGIN;
    return {
      left: Math.max(ctx.EDGE_MARGIN, Math.min(maxLeft, left)),
      top:  Math.max(ctx.EDGE_MARGIN, Math.min(maxTop,  top))
    };
  }
  function defaultCursorPos() {
    return clampCursor(
      window.innerWidth  - 185,
      Math.round(window.innerHeight * 0.5)
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
  ctx.saveCursorPos = saveCursorPos;
  ctx.clampCursor = clampCursor;
  ctx.applyCursorPos = applyCursorPos;

  /* ====== D-PAD STATE MANAGEMENT ======
     'collapsed' → center circle only, draggable, double-tap to expand
     'expanded'  → full D-Pad, double-tap center to open menu
     'hidden'    → whole widget hidden (via "Close D-Pad" menu item) */
  ctx.dpadState = 'collapsed';
  let inactivityTimer = null;
  let centerLastTap = 0;

  // Start collapsed
  cursorControls.classList.add('dpad-collapsed');
  positionCursorControls();

  function clearInactivityTimer() {
    if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
  }
  function resetInactivityTimer() {
    clearInactivityTimer();
    if (ctx.dpadState === 'expanded') {
      inactivityTimer = setTimeout(collapseDpad, ctx.INACTIVITY_TIMEOUT);
    }
  }

  /* Shift constant so the *visible center of the drag circle* stays put
     when the container swaps between 40x40 (collapsed) and 165x165
     (expanded). Collapsed visible center = containerLeft+20; expanded
     visible center = containerLeft+82.5. Difference = 62.5. */
  const CENTER_SHIFT = 62.5;

  function collapseDpad() {
    if (ctx.dpadState === 'collapsed') return;
    ctx.dpadState = 'collapsed';
    // Compensate BEFORE the CSS shrinks the container so the visible circle
    // stays fixed on screen: shift container right/down by CENTER_SHIFT.
    const shifted = {
      left: cursorControls.offsetLeft + CENTER_SHIFT,
      top:  cursorControls.offsetTop  + CENTER_SHIFT
    };
    cursorControls.classList.add('dpad-collapsed');
    clearInactivityTimer();
    if (ctx.menuOpen && ctx.menuOpen()) ctx.closeMenu();
    const clamped = clampCursor(shifted.left, shifted.top);
    applyCursorPos(clamped);
    saveCursorPos(clamped.left, clamped.top);
  }

  function expandDpad() {
    if (ctx.dpadState === 'expanded') { resetInactivityTimer(); return; }
    ctx.dpadState = 'expanded';
    // Shift container left/up by CENTER_SHIFT so the visible center circle
    // stays put on screen while the container grows around it.
    const shifted = {
      left: cursorControls.offsetLeft - CENTER_SHIFT,
      top:  cursorControls.offsetTop  - CENTER_SHIFT
    };
    cursorControls.classList.remove('dpad-collapsed');
    requestAnimationFrame(() => {
      const clamped = clampCursor(shifted.left, shifted.top);
      applyCursorPos(clamped);
      saveCursorPos(clamped.left, clamped.top);
    });
    resetInactivityTimer();
  }

  /* "Close D-Pad" — collapse back to the initial state (just the small
     green-glow dragger). Does NOT remove the widget: user can still see
     and tap the dragger to bring the full D-Pad back. */
  function hideDpad() {
    if (ctx.menuOpen && ctx.menuOpen()) ctx.closeMenu();
    collapseDpad();
  }
  // Kept for API symmetry / any external callers.
  function showDpad() {
    cursorControls.style.display = 'flex';
    if (ctx.dpadState !== 'expanded') {
      ctx.dpadState = 'collapsed';
      cursorControls.classList.add('dpad-collapsed');
    }
    const clamped = clampCursor(cursorControls.offsetLeft, cursorControls.offsetTop);
    applyCursorPos(clamped);
  }

  ctx.collapseDpad = collapseDpad;
  ctx.expandDpad = expandDpad;
  ctx.hideDpad = hideDpad;
  ctx.showDpad = showDpad;
  ctx.resetInactivityTimer = resetInactivityTimer;
  ctx.clearInactivityTimer = clearInactivityTimer;

  window.dexHideDpad = hideDpad;
  window.dexShowDpad = showDpad;

  /* Handle a confirmed double-tap on the center circle */
  function handleCenterDoubleTap() {
    if (ctx.dpadState === 'collapsed') {
      expandDpad();
    } else if (ctx.menuOpen && ctx.openMenu && ctx.closeMenu) {
      // Expanded: toggle menu via delegated menu-layout functions
      ctx.menuOpen() ? ctx.closeMenu() : ctx.openMenu();
    }
  }

  /* Called on every pointer-up on the center that wasn't a drag.
     Returns true if this was the 2nd tap of a double-tap. */
  function recordCenterTap() {
    const now = Date.now();
    if (now - centerLastTap < ctx.DBL_TAP_WINDOW) {
      centerLastTap = 0;
      handleCenterDoubleTap();
      return true;
    }
    centerLastTap = now;
    return false;
  }
  ctx.recordCenterTap = recordCenterTap;
  ctx.handleCenterDoubleTap = handleCenterDoubleTap;

  /* ====== TOOLMENU SHOW / HIDE (delegates to menu-layout) ======
     Kept here so callers inside dpad-layout / dpad-functions can trigger
     the menu without importing menu-layout directly. */
  ctx.showToolMenu = function () { if (ctx.openMenu) ctx.openMenu(); };
  ctx.hideToolMenu = function () { if (ctx.closeMenu) ctx.closeMenu(); };
  ctx.toggleToolMenu = function () {
    if (ctx.toggleMenu) ctx.toggleMenu();
    else if (ctx.menuOpen && ctx.menuOpen()) ctx.closeMenu();
    else if (ctx.openMenu) ctx.openMenu();
  };

  /* ====== COLLAPSED-MODE CENTER DRAG (repositions the whole D-Pad) ====== */
  let collapsedCenterDrag = null;
  let collapsedCenterTouchId = null;

  function startCollapsedCenterDrag(clientX, clientY) {
    collapsedCenterDrag = {
      startX: clientX,
      startY: clientY,
      startLeft: cursorControls.offsetLeft,
      startTop:  cursorControls.offsetTop,
      moved: false,
      pointerId: null
    };
  }
  function moveCollapsedCenterDrag(clientX, clientY) {
    if (!collapsedCenterDrag) return;
    const dx = clientX - collapsedCenterDrag.startX;
    const dy = clientY - collapsedCenterDrag.startY;
    if (!collapsedCenterDrag.moved && Math.hypot(dx, dy) < ctx.DRAG_THRESHOLD) return;
    collapsedCenterDrag.moved = true;
    const next = clampCursor(collapsedCenterDrag.startLeft + dx, collapsedCenterDrag.startTop + dy);
    applyCursorPos(next);
    centerHandle.classList.add('dragging');
  }
  function endCollapsedCenterDrag() {
    if (!collapsedCenterDrag) return false;
    const wasDrag = collapsedCenterDrag.moved;
    collapsedCenterDrag = null;
    centerHandle.classList.remove('dragging');
    if (wasDrag) saveCursorPos(cursorControls.offsetLeft, cursorControls.offsetTop);
    return !wasDrag; // true = tap
  }

  // Expose for dpad-functions.js
  ctx.startCollapsedCenterDrag = startCollapsedCenterDrag;
  ctx.moveCollapsedCenterDrag = moveCollapsedCenterDrag;
  ctx.endCollapsedCenterDrag = endCollapsedCenterDrag;
  ctx.getCollapsedCenterDrag = () => collapsedCenterDrag;
  ctx.setCollapsedPointerId = (id) => { if (collapsedCenterDrag) collapsedCenterDrag.pointerId = id; };
  ctx.getCollapsedCenterTouchId = () => collapsedCenterTouchId;
  ctx.setCollapsedCenterTouchId = (id) => { collapsedCenterTouchId = id; };

  /* ====== EXPANDED-MODE WHOLE-DPAD DRAG (grab the ring, not a button) ====== */
  let cursorDrag = null;

  cursorControls.addEventListener('pointerdown', (e) => {
    if (ctx.dpadState !== 'expanded') return; // collapsed drag lives on the center
    if (e.target.closest('.dex-cursor-btn')) return;
    if (e.target.closest('.dex-center-drag')) return;
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
    if (!cursorDrag.moved && Math.hypot(dx, dy) < ctx.DRAG_THRESHOLD) return;
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
      saveCursorPos(cursorControls.offsetLeft, cursorControls.offsetTop);
    }
  }
  cursorControls.addEventListener('pointerup',     endCursorDrag);
  cursorControls.addEventListener('pointercancel', endCursorDrag);

  window.addEventListener('resize', () => {
    const clamped = clampCursor(cursorControls.offsetLeft, cursorControls.offsetTop);
    applyCursorPos(clamped);
    saveCursorPos(clamped.left, clamped.top);
  });

  /* ====== SELECTION ANCHOR / PREVIEW / UTILS ====== */
  let selectionAnchor = null;
  ctx.getSelectionAnchor = () => selectionAnchor;
  ctx.setSelectionAnchor = (v) => { selectionAnchor = v; };
  ctx.ensureAnchor = function (cm) {
    if (selectionAnchor) return selectionAnchor;
    selectionAnchor = cm.getSelection() ? cm.getCursor('anchor') : cm.getCursor('head');
    return selectionAnchor;
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  ctx.escapeHtml = escapeHtml;

  function updateCenterHandle() {
    // Center dragger is fixed inside the D-Pad. No-op stub for legacy callers.
  }
  ctx.updateCenterHandle = updateCenterHandle;

  function updateSelectionPreview() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { selectionPreview.classList.remove('visible'); return; }
    const sel = cm.getSelection();
    if (!sel || sel.length === 0) { selectionPreview.classList.remove('visible'); return; }
    const preview = sel.length > 30 ? sel.slice(0, 30) + '...' : sel;
    selectionPreview.innerHTML =
      '<span>' + escapeHtml(preview) + '</span>' +
      '<span class="dex-preview-count">' + sel.length + ' chars</span>';
    const toCoords = cm.charCoords(cm.getCursor('to'), 'window');
    const px = toCoords.right + 8;
    const py = toCoords.top - 40;
    selectionPreview.style.left = Math.max(4, Math.min(window.innerWidth - 250, px)) + 'px';
    selectionPreview.style.top  = Math.max(4, py) + 'px';
    selectionPreview.classList.add('visible');
  }
  ctx.updateSelectionPreview = updateSelectionPreview;

  function setDragDirection(dir) {
    centerHandle.classList.remove('dragging-right', 'dragging-left', 'dragging-up', 'dragging-down');
    if (dir) centerHandle.classList.add('dragging-' + dir);
    if (dir && dir !== ctx._lastDragDir) {
      const rect = centerHandle.getBoundingClientRect();
      for (let i = 0; i < 5; i++) {
        spawnParticle(rect.left + rect.width / 2, rect.top + rect.height / 2, THEME.accent);
      }
      ctx._lastDragDir = dir;
    }
  }
  ctx.setDragDirection = setDragDirection;

  ctx.notify = function (m) {
    if (typeof window.showNotification === 'function') window.showNotification(m);
  };

  /* ====== SAVED-SELECTION STORAGE ====== */
  let savedSelection = null;
  ctx.getSavedSelection = () => savedSelection;
  ctx.setSavedSelection = (v) => { savedSelection = v; };
  ctx.clearSavedSelection = () => { savedSelection = null; };
}
