(function () {
  'use strict';
  if (window.__dexToolbar2Loaded) return;
  window.__dexToolbar2Loaded = true;

  const LS_KEY = 'dexToolbarPos';
  const CURSOR_KEY = 'dexCursorPos';
  const CENTER_KEY = 'dexCenterPos';
  const TRIGGER_SIZE = 40;
  const DRAG_THRESHOLD = 8;
  const EDGE_MARGIN = 8;
  const MENU_GAP = 12;

  // Long-press auto-repeat tuning
  const HOLD_START_DELAY = 350;   // ms before repeat kicks in
  const HOLD_INITIAL_INTERVAL = 90; // ms between repeats at start
  const HOLD_MIN_INTERVAL = 20;    // ms between repeats at max speed
  const HOLD_ACCEL_STEP = 4;       // ms subtracted per tick (ramp-up)

  const ICONS = {
    down: 'expand_more', up: 'expand_less',
    left: 'chevron_left', right: 'chevron_right',
    copy: 'content_copy', paste: 'content_paste',
    close: 'close',
    dbl_up: 'keyboard_double_arrow_up',
    dbl_down: 'keyboard_double_arrow_down',
    dbl_left: 'keyboard_double_arrow_left',
    dbl_right: 'keyboard_double_arrow_right',
    drag: 'drag_indicator',
    select_all: 'select_all'
  };

  /* ================================================================
     THEME & VISUAL TOKENS — Gaming Aesthetic
     ================================================================ */
  const THEME = {
    matte: '#181C1F',
    surface: '#1E2327',
    surfaceHover: '#252B30',
    accent: '#00D4AA',      /* Gaming teal */
    accentGlow: 'rgba(0, 212, 170, 0.35)',
    accentDim: 'rgba(0, 212, 170, 0.12)',
    danger: '#FF4757',
    dangerGlow: 'rgba(255, 71, 87, 0.35)',
    text: '#E8ECF0',
    textMuted: '#8A9199',
    border: 'rgba(255,255,255,0.08)',
    borderActive: 'rgba(0, 212, 170, 0.4)',
    shadow: '0 8px 32px rgba(0,0,0,0.55)',
    shadowGlow: '0 0 20px rgba(0, 212, 170, 0.15), 0 8px 32px rgba(0,0,0,0.55)',
    shadowDanger: '0 0 20px rgba(255, 71, 87, 0.15), 0 8px 32px rgba(0,0,0,0.55)'
  };

  const style = document.createElement('style');
  style.id = 'dex-toolbar2-styles';
  style.textContent = `
    /* ====== BASE ====== */
    #dexToolbarBtn {
      position: fixed;
      width: ${TRIGGER_SIZE}px;
      height: ${TRIGGER_SIZE}px;
      border-radius: 50%;
      background: ${THEME.matte};
      color: ${THEME.text};
      border: 1px solid ${THEME.border};
      display: flex; align-items: center; justify-content: center;
      cursor: grab;
      z-index: 9997;
      box-shadow: ${THEME.shadow};
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none;
      font-family: 'classy', sans-serif;
      padding: 0;
      transition: box-shadow 0.2s ease, transform 0.1s ease, border-color 0.2s ease;
    }
    #dexToolbarBtn:hover {
      border-color: ${THEME.borderActive};
      box-shadow: ${THEME.shadowGlow};
    }
    #dexToolbarBtn:active { cursor: grabbing; transform: scale(0.94); }
    #dexToolbarBtn > * { pointer-events: none; }
    #dexToolbarBtn .material-symbols-rounded { font-size: 24px; }
    #dexToolbarBtn.dragging {
      box-shadow: 0 12px 36px rgba(0,0,0,0.7);
      opacity: 0.85;
      border-color: ${THEME.accent};
    }

    /* ====== MENU ====== */
    #dexToolbarMenu {
      position: fixed;
      background: ${THEME.matte};
      border: 1px solid ${THEME.border};
      border-radius: 14px;
      padding: 6px;
      z-index: 9998;
      display: none;
      flex-direction: column;
      min-width: 180px;
      box-shadow: ${THEME.shadow};
      font-family: 'classy', sans-serif;
      -webkit-touch-callout: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    #dexToolbarMenu.open { display: flex; animation: dexMenuIn 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes dexMenuIn {
      from { opacity: 0; transform: scale(0.92) translateY(-4px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .dex-tb-item {
      background: transparent;
      border: none;
      color: ${THEME.text};
      display: flex; align-items: center; gap: 12px;
      padding: 11px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13.5px;
      text-align: left;
      width: 100%;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      transition: background 0.12s ease, color 0.12s ease;
      position: relative;
      overflow: hidden;
    }
    .dex-tb-item::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
      transform: translateX(-100%);
      transition: transform 0.4s ease;
    }
    .dex-tb-item:hover::before { transform: translateX(100%); }
    .dex-tb-item:hover, .dex-tb-item:active {
      background: ${THEME.surfaceHover};
      color: ${THEME.accent};
    }
    .dex-tb-item > * { pointer-events: none; }
    .dex-tb-item .material-symbols-rounded { font-size: 20px; }
    .dex-tb-sep {
      height: 1px;
      background: ${THEME.border};
      margin: 4px 8px;
    }

    /* ====== CURSOR CONTROLS — Gaming D-Pad ====== */
    #dexCursorControls {
      position: fixed;
      z-index: 9996;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      width: 152px;
      height: 152px;
      border-radius: 50%;
      background: ${THEME.matte};
      border: 1px solid ${THEME.border};
      box-shadow: ${THEME.shadow};
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none;
      cursor: grab;
      padding: 8px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #dexCursorControls:hover {
      border-color: ${THEME.borderActive};
      box-shadow: ${THEME.shadowGlow};
    }
    #dexCursorControls.dragging {
      cursor: grabbing;
      opacity: 0.9;
      border-color: ${THEME.accent};
    }
    #dexCursorControls .dex-cursor-row {
      display: flex;
      gap: 3px;
      align-items: center;
      justify-content: center;
    }
    #dexCursorControls .dex-cursor-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: ${THEME.surface};
      border: 1px solid ${THEME.border};
      color: ${THEME.textMuted};
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-family: 'classy', sans-serif;
      padding: 0;
      transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      position: relative;
    }
    #dexCursorControls .dex-cursor-btn:hover {
      background: ${THEME.surfaceHover};
      color: ${THEME.text};
      border-color: ${THEME.borderActive};
      transform: scale(1.08);
    }
    #dexCursorControls .dex-cursor-btn:active,
    #dexCursorControls .dex-cursor-btn.holding {
      background: ${THEME.accentDim};
      color: ${THEME.accent};
      border-color: ${THEME.accent};
      transform: scale(0.92);
      box-shadow: 0 0 12px ${THEME.accentGlow};
    }
    #dexCursorControls .dex-cursor-btn .material-symbols-rounded {
      font-size: 16px;
    }

    /* ====== CENTER DRAG HANDLE — Gaming Grade ====== */
    #dexCenterHandle {
      position: fixed;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: ${THEME.matte};
      border: 2px solid ${THEME.border};
      color: ${THEME.textMuted};
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999; /* above everything so it's always the touch target */
      cursor: grab;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      user-select: none; -webkit-user-select: none;
      box-shadow: ${THEME.shadow};
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
      font-family: 'classy', sans-serif;
    }
    /* Invisible larger hit area for easier grabbing on mobile */
    #dexCenterHandle::before {
      content: '';
      position: absolute;
      inset: -12px;
      border-radius: 50%;
    }
    #dexCenterHandle.visible {
      opacity: 1;
      pointer-events: auto;
    }
    #dexCenterHandle:hover {
      border-color: ${THEME.borderActive};
      color: ${THEME.text};
      box-shadow: ${THEME.shadowGlow};
      transform: scale(1.05);
    }
    #dexCenterHandle.dragging {
      cursor: grabbing;
      border-color: ${THEME.accent};
      color: ${THEME.accent};
      box-shadow: 0 0 24px ${THEME.accentGlow}, 0 8px 32px rgba(0,0,0,0.6);
      transform: scale(1.1);
      opacity: 1;
    }
    #dexCenterHandle .material-symbols-rounded {
      font-size: 20px;
      transition: transform 0.2s ease;
    }
    #dexCenterHandle.dragging .material-symbols-rounded {
      transform: scale(1.2);
    }

    /* Direction indicator ring */
    #dexCenterHandle::after {
      content: '';
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      border: 2px solid transparent;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      pointer-events: none;
    }
    #dexCenterHandle.dragging-right::after {
      border-color: ${THEME.accent};
      border-left-color: transparent;
      border-top-color: transparent;
      border-bottom-color: transparent;
      box-shadow: 0 0 12px ${THEME.accentGlow};
    }
    #dexCenterHandle.dragging-left::after {
      border-color: ${THEME.accent};
      border-right-color: transparent;
      border-top-color: transparent;
      border-bottom-color: transparent;
      box-shadow: 0 0 12px ${THEME.accentGlow};
    }
    #dexCenterHandle.dragging-up::after {
      border-color: ${THEME.accent};
      border-left-color: transparent;
      border-right-color: transparent;
      border-bottom-color: transparent;
      box-shadow: 0 0 12px ${THEME.accentGlow};
    }
    #dexCenterHandle.dragging-down::after {
      border-color: ${THEME.accent};
      border-left-color: transparent;
      border-right-color: transparent;
      border-top-color: transparent;
      box-shadow: 0 0 12px ${THEME.accentGlow};
    }

    /* ====== SELECTION MAGNIFIER / PREVIEW ====== */
    #dexSelectionPreview {
      position: fixed;
      z-index: 9994;
      background: ${THEME.matte};
      border: 1px solid ${THEME.borderActive};
      border-radius: 10px;
      padding: 8px 14px;
      font-family: 'classy', monospace;
      font-size: 12px;
      color: ${THEME.accent};
      box-shadow: ${THEME.shadowGlow};
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px) scale(0.95);
      transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 240px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    #dexSelectionPreview.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    #dexSelectionPreview .dex-preview-count {
      color: ${THEME.textMuted};
      font-size: 10px;
      margin-left: 6px;
    }

    /* ====== PARTICLE TRAIL CANVAS ====== */
    #dexParticleCanvas {
      position: fixed;
      inset: 0;
      z-index: 9993;
      pointer-events: none;
    }

    /* ====== CODEMIRROR 5 SELECTION COLORS ====== */
    .CodeMirror-selected { background: #606060 !important; }
    .CodeMirror-focused .CodeMirror-selected { background: #606060 !important; }
    .CodeMirror-line ::selection,
    .CodeMirror-line > span ::selection,
    .CodeMirror-line > span > span ::selection { background: #606060 !important; color: #000000 !important; }
    .CodeMirror-line ::-moz-selection,
    .CodeMirror-line > span ::-moz-selection,
    .CodeMirror-line > span > span ::-moz-selection { background: #606060 !important; color: #000000 !important; }
    /* Force text color of selected characters — CM5 paints selection behind text,
       so we tint the text via a stacked overlay class CM adds to selected spans. */
    .CodeMirror .CodeMirror-selectedtext { color: #000000 !important; }

    /* ====== SNAP INDICATOR ====== */
    #dexSnapIndicator {
      position: fixed;
      z-index: 9992;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: ${THEME.accent};
      box-shadow: 0 0 8px ${THEME.accentGlow}, 0 0 16px ${THEME.accentGlow};
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.1s ease;
    }
    #dexSnapIndicator.visible { opacity: 1; }
  `;
  document.head.appendChild(style);

  /* ====== PARTICLE SYSTEM ====== */
  const particleCanvas = document.createElement('canvas');
  particleCanvas.id = 'dexParticleCanvas';
  document.body.appendChild(particleCanvas);
  const pCtx = particleCanvas.getContext('2d');
  let particles = [];

  function resizeParticleCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
  resizeParticleCanvas();
  window.addEventListener('resize', resizeParticleCanvas);

  function spawnParticle(x, y, color = THEME.accent) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2 - 1,
      life: 1,
      decay: 0.03 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color
    });
  }

  function updateParticles() {
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.vy += 0.05; // gravity
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
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
    '<button type="button" class="dex-tb-item" id="dexTbSelectAll">' +
      '<span class="material-symbols-rounded">' + ICONS.select_all + '</span>' +
      '<span>Select All</span>' +
    '</button>' +
    '<div class="dex-tb-sep"></div>' +
    '<button type="button" class="dex-tb-item" id="dexTbClose">' +
      '<span class="material-symbols-rounded">' + ICONS.close + '</span>' +
      '<span>Close menu</span>' +
    '</button>';
  document.body.appendChild(menu);

  /* ====== CURSOR CONTROLS (circular D-Pad) ====== */
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

  /* ====== CENTER DRAG HANDLE ====== */
  const centerHandle = document.createElement('div');
  centerHandle.id = 'dexCenterHandle';
  centerHandle.innerHTML = '<span class="material-symbols-rounded">' + ICONS.drag + '</span>';
  centerHandle.setAttribute('aria-label', 'Drag to expand selection');
  document.body.appendChild(centerHandle);

  /* ====== SELECTION PREVIEW ====== */
  const selectionPreview = document.createElement('div');
  selectionPreview.id = 'dexSelectionPreview';
  document.body.appendChild(selectionPreview);

  /* ====== SNAP INDICATOR ====== */
  const snapIndicator = document.createElement('div');
  snapIndicator.id = 'dexSnapIndicator';
  document.body.appendChild(snapIndicator);

  /* ====== ELEMENT REFERENCES ====== */
  const btnIcon = document.getElementById('dexToolbarBtnIcon');
  const copyEl  = document.getElementById('dexTbCopy');
  const pasteEl = document.getElementById('dexTbPaste');
  const selectAllEl = document.getElementById('dexTbSelectAll');
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
      centerHandle.classList.remove('visible');
    } else {
      btn.style.display = '';
      cursorControls.style.display = 'flex';
      updateCenterHandle();
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
    clearSelectionTimeout();
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

  [copyEl, pasteEl, selectAllEl, closeEl].forEach(el => {
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

  /* ====== SELECT ALL ====== */
  selectAllEl.addEventListener('click', () => {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { notify('Editor not ready'); return; }
    const lastLine = cm.lineCount() - 1;
    const from = { line: 0, ch: 0 };
    const to = { line: lastLine, ch: cm.getLine(lastLine).length };
    cm.setSelection(from, to);
    savedSelection = { from, to, text: cm.getValue() };
    notify('Selected all');
    closeMenu();
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
    const cw = cursorControls.offsetWidth || 152;
    const ch = cursorControls.offsetHeight || 152;
    const maxLeft = window.innerWidth  - cw - EDGE_MARGIN;
    const maxTop  = window.innerHeight - ch - EDGE_MARGIN;
    return {
      left: Math.max(EDGE_MARGIN, Math.min(maxLeft, left)),
      top:  Math.max(EDGE_MARGIN, Math.min(maxTop,  top))
    };
  }
  function defaultCursorPos() {
    return clampCursor(
      window.innerWidth  - 170,
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

  /* ====== UNIFIED SELECTION ANCHOR ======
     Single source of truth for both the D-Pad and the center handle.
     Seeded on cursorActivity (when caret moves with no selection) and
     kept in sync whenever either method commits a new selection. */
  let selectionAnchor = null;

  function ensureAnchor(cm) {
    if (selectionAnchor) return selectionAnchor;
    // Prefer the current selection's anchor if there is one; otherwise the caret.
    selectionAnchor = cm.getSelection() ? cm.getCursor('anchor') : cm.getCursor('head');
    return selectionAnchor;
  }

  function moveCursor(dir, multiplier) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;

    const anchor = ensureAnchor(cm);
    const isVertical = (dir === 'up' || dir === 'down');
    const amount = (dir === 'up' || dir === 'left') ? -multiplier : multiplier;

    let head = cm.getCursor('head');
    head = isVertical
      ? cm.findPosV(head, amount, 'line')
      : cm.findPosH(head, amount, 'char');
    cm.setSelection(anchor, head);
    updateCenterHandle();
    updateSelectionPreview();
  }

  /* ====== LONG-PRESS AUTO-REPEAT FOR CURSOR BUTTONS ======
     Behavior: single tap -> one movement. Press-and-hold -> after
     HOLD_START_DELAY ms, keeps moving on an accelerating interval until
     the pointer is released, cancelled, or leaves the button. Works with
     touch, pen, and mouse via Pointer Events. Uses pointer capture so a
     finger sliding slightly off the button still counts as held.
  */
  function attachHoldRepeat(el, dir, multiplier) {
    // State kept on the element so repeated pointerdown/up cycles don't leak.
    let holdState = null;

    function stopHold(reason) {
      if (!holdState) return;
      clearTimeout(holdState.startTimer);
      clearInterval(holdState.intervalId);
      try { el.releasePointerCapture(holdState.pointerId); } catch (_e) {}
      el.classList.remove('holding');
      const wasRepeating = holdState.repeating;
      const pid = holdState.pointerId;
      holdState = null;
      // If the pointer never repeated (short tap), the click handler below
      // will fire the single move. If we DID repeat, suppress the trailing
      // click so we don't do one extra move.
      if (wasRepeating) {
        el.__dexSuppressNextClick = true;
        // Clear the suppression after a tick in case click never fires.
        setTimeout(() => { el.__dexSuppressNextClick = false; }, 300);
      }
      return pid;
    }

    el.addEventListener('pointerdown', (e) => {
      // Only start a hold for primary button / touch / pen.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // If a previous hold somehow wasn't cleaned up, kill it first.
      if (holdState) stopHold('restart');

      holdState = {
        pointerId: e.pointerId,
        repeating: false,
        interval: HOLD_INITIAL_INTERVAL,
        startTimer: null,
        intervalId: null
      };

      try { el.setPointerCapture(e.pointerId); } catch (_e) {}
      el.classList.add('holding');

      holdState.startTimer = setTimeout(() => {
        if (!holdState) return;
        holdState.repeating = true;
        // Fire first repeat immediately so the hold feels responsive.
        moveCursor(dir, multiplier);
        const tick = () => {
          if (!holdState) return;
          moveCursor(dir, multiplier);
          // Accelerate: shrink interval down to HOLD_MIN_INTERVAL.
          const nextInterval = Math.max(HOLD_MIN_INTERVAL, holdState.interval - HOLD_ACCEL_STEP);
          if (nextInterval !== holdState.interval) {
            holdState.interval = nextInterval;
            clearInterval(holdState.intervalId);
            holdState.intervalId = setInterval(tick, holdState.interval);
          }
        };
        holdState.intervalId = setInterval(tick, holdState.interval);
      }, HOLD_START_DELAY);
    });

    el.addEventListener('pointerup', (e) => {
      if (!holdState || e.pointerId !== holdState.pointerId) return;
      stopHold('pointerup');
    });
    el.addEventListener('pointercancel', (e) => {
      if (!holdState || e.pointerId !== holdState.pointerId) return;
      stopHold('pointercancel');
    });
    // pointerleave only fires when NOT pointer-captured, which is fine —
    // it's a fallback safety net.
    el.addEventListener('pointerleave', (e) => {
      if (!holdState || e.pointerId !== holdState.pointerId) return;
      stopHold('pointerleave');
    });

    // Single-tap fallback via click. Suppressed when a hold-repeat ran,
    // otherwise fires exactly one movement.
    el.addEventListener('click', (e) => {
      if (el.__dexSuppressNextClick) {
        el.__dexSuppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      moveCursor(dir, multiplier);
    });
  }

  attachHoldRepeat(curUp,       'up',    1);
  attachHoldRepeat(curDown,     'down',  1);
  attachHoldRepeat(curLeft,     'left',  1);
  attachHoldRepeat(curRight,    'right', 1);
  attachHoldRepeat(curDblUp,    'up',    10);
  attachHoldRepeat(curDblDown,  'down',  10);
  attachHoldRepeat(curDblLeft,  'left',  10);
  attachHoldRepeat(curDblRight, 'right', 10);

  /* ================================================================
     CENTER DRAG — GAMING GRADE
     ================================================================ */

  let centerDrag = null;
  let lastDragDir = null;

  // Rate-based joystick tuning
  const JOY_DEAD_ZONE = 15;      // px from start before movement begins
  const JOY_MAX_DIST  = 80;      // px beyond which we're at max speed
  const JOY_MIN_INTERVAL = 20;   // ms between ticks at max speed
  const JOY_MAX_INTERVAL = 90;   // ms between ticks at edge of dead zone

  function getSelectionMidpoint(cm) {
    const from = cm.getCursor('from');
    const to = cm.getCursor('to');
    const startCoords = cm.charCoords(from, 'window');
    const endCoords = cm.charCoords(to, 'window');
    return {
      x: (startCoords.left + endCoords.right) / 2,
      y: (startCoords.top + startCoords.bottom + endCoords.top + endCoords.bottom) / 4,
      from: from,
      to: to
    };
  }

  function updateCenterHandle() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm || isHomepage()) {
      centerHandle.classList.remove('visible');
      return;
    }

    const sel = cm.getSelection();
    if (!sel || sel.length === 0) {
      centerHandle.classList.remove('visible');
      return;
    }

    const mid = getSelectionMidpoint(cm);
    const toCoords = cm.charCoords(cm.getCursor('to'), 'window');
    const x = mid.x - 22; // half of 44px
    const y = toCoords.bottom + 6;

    centerHandle.style.left = `${Math.max(4, Math.min(window.innerWidth - 48, x))}px`;
    centerHandle.style.top = `${Math.max(4, Math.min(window.innerHeight - 48, y))}px`;
    centerHandle.classList.add('visible');
  }

  function updateSelectionPreview() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) {
      selectionPreview.classList.remove('visible');
      return;
    }

    const sel = cm.getSelection();
    if (!sel || sel.length === 0) {
      selectionPreview.classList.remove('visible');
      return;
    }

    const preview = sel.length > 30 ? sel.slice(0, 30) + '...' : sel;
    selectionPreview.innerHTML = `<span>${escapeHtml(preview)}</span><span class="dex-preview-count">${sel.length} chars</span>`;

    const toCoords = cm.charCoords(cm.getCursor('to'), 'window');
    const px = toCoords.right + 8;
    const py = toCoords.top - 40;

    selectionPreview.style.left = `${Math.max(4, Math.min(window.innerWidth - 250, px))}px`;
    selectionPreview.style.top = `${Math.max(4, py)}px`;
    selectionPreview.classList.add('visible');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setDragDirection(dir) {
    centerHandle.classList.remove('dragging-right', 'dragging-left', 'dragging-up', 'dragging-down');
    if (dir) centerHandle.classList.add('dragging-' + dir);
    if (dir && dir !== lastDragDir) {
      // Direction change feedback
      const rect = centerHandle.getBoundingClientRect();
      for (let i = 0; i < 5; i++) {
        spawnParticle(rect.left + rect.width/2, rect.top + rect.height/2, THEME.accent);
      }
      lastDragDir = dir;
    }
  }

  function snapToWordBoundary(cm, pos) {
    const line = cm.getLine(pos.line) || '';
    const isWord = (c) => c && /[\w$@#-]/.test(c);
    let s = pos.ch, e = pos.ch;
    while (s > 0 && isWord(line[s - 1])) s--;
    while (e < line.length && isWord(line[e])) e++;
    if (s === e) {
      if (e < line.length) e = s + 1;
      else if (s > 0) s = e - 1;
    }
    return { line: pos.line, ch: s };
  }

  /* ================================================================
     CENTER HANDLE DRAG — dual pathway (touch + mouse/pointer)

     Mobile browsers on the CodeMirror area often refuse to hand us clean
     pointer events because native text selection wins the gesture. Instead
     of fighting that on the editor, we bind a dedicated touch pathway to
     the center handle itself. Touch events fire BEFORE the browser's
     selection heuristic and we preventDefault() immediately, which locks
     the gesture to us for its entire lifetime.

     Desktop (mouse) uses pointer events as before.
     ================================================================ */

  function startCenterDrag(clientX, clientY, pointerId) {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return false;

    // Lock in the unified anchor. If there's a selection, use its far end
    // (the one opposite the current head) so head-motion feels natural.
    if (cm.getSelection()) {
      selectionAnchor = cm.getCursor('anchor');
    } else {
      ensureAnchor(cm);
    }
    lastDragDir = null;

    centerDrag = {
      pointerId: pointerId,
      startX: clientX,
      startY: clientY,
      curX: clientX,
      curY: clientY,
      moved: false,
      tickId: null
    };

    centerHandle.classList.add('dragging');

    for (let i = 0; i < 8; i++) {
      spawnParticle(clientX, clientY, THEME.accent);
    }

    // Kick off the rate-based tick loop.
    startJoystickLoop();
    return true;
  }

  function startJoystickLoop() {
    if (!centerDrag) return;
    if (centerDrag.tickId) clearTimeout(centerDrag.tickId);

    const tick = () => {
      if (!centerDrag) return;
      const dx = centerDrag.curX - centerDrag.startX;
      const dy = centerDrag.curY - centerDrag.startY;
      const dist = Math.hypot(dx, dy);

      if (dist < JOY_DEAD_ZONE) {
        setDragDirection(null);
        centerDrag.tickId = setTimeout(tick, JOY_MAX_INTERVAL);
        return;
      }

      const absDx = Math.abs(dx), absDy = Math.abs(dy);
      let dir;
      if (absDx > absDy) dir = dx > 0 ? 'right' : 'left';
      else               dir = dy > 0 ? 'down'  : 'up';
      setDragDirection(dir);

      // Move head one step in that direction using CM primitives.
      const ed = window.dexEditor;
      const cm = ed && ed.cm ? ed.cm : null;
      if (cm) {
        const anchor = ensureAnchor(cm);
        let head = cm.getCursor('head');
        if (dir === 'up' || dir === 'down') {
          head = cm.findPosV(head, dir === 'up' ? -1 : 1, 'line');
        } else {
          head = cm.findPosH(head, dir === 'left' ? -1 : 1, 'char');
        }
        cm.setSelection(anchor, head);
        centerDrag.moved = true;
        updateCenterHandle();
        updateSelectionPreview();

        // Snap indicator glow on the moving head.
        try {
          const c = cm.charCoords(head, 'window');
          snapIndicator.style.left = (c.left - 2) + 'px';
          snapIndicator.style.top  = (c.top + c.bottom) / 2 - 2 + 'px';
          snapIndicator.classList.add('visible');
        } catch (_e) {}

        // Occasional particle for feedback.
        if (Math.random() > 0.7) {
          spawnParticle(centerDrag.curX, centerDrag.curY, THEME.accentDim);
        }
      }

      // Interval scales inversely with distance past the dead zone.
      const t = Math.min(1, (dist - JOY_DEAD_ZONE) / (JOY_MAX_DIST - JOY_DEAD_ZONE));
      const interval = JOY_MAX_INTERVAL - t * (JOY_MAX_INTERVAL - JOY_MIN_INTERVAL);
      centerDrag.tickId = setTimeout(tick, interval);
    };

    centerDrag.tickId = setTimeout(tick, JOY_MAX_INTERVAL);
  }

  function moveCenterDrag(clientX, clientY) {
    if (!centerDrag) return;
    // Rate-based: just record where the finger is; the joystick loop reads this.
    centerDrag.curX = clientX;
    centerDrag.curY = clientY;
  }

  // ---------- TOUCH pathway (mobile) ----------
  let centerTouchId = null;

  centerHandle.addEventListener('touchstart', (e) => {
    if (centerDrag) return; // already dragging
    const t = e.changedTouches[0];
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    centerTouchId = t.identifier;
    startCenterDrag(t.clientX, t.clientY, t.identifier);
  }, { passive: false, capture: true });

  centerHandle.addEventListener('touchmove', (e) => {
    if (!centerDrag || centerTouchId === null) return;
    // Find the touch matching our tracked id
    let t = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === centerTouchId) { t = e.changedTouches[i]; break; }
    }
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    moveCenterDrag(t.clientX, t.clientY);
  }, { passive: false, capture: true });

  // touchmove also has to be caught on document once the finger leaves the
  // small circle — because touchmove events on iOS follow the ORIGINAL
  // target (the circle) only if we preventDefault the touchstart, which we
  // do. But for safety on Android where behaviors differ, also mirror on
  // document.
  document.addEventListener('touchmove', (e) => {
    if (!centerDrag || centerTouchId === null) return;
    let t = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === centerTouchId) { t = e.changedTouches[i]; break; }
    }
    if (!t) return;
    e.preventDefault();
    moveCenterDrag(t.clientX, t.clientY);
  }, { passive: false, capture: true });

  function endCenterTouch(e) {
    if (!centerDrag || centerTouchId === null) return;
    let matched = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === centerTouchId) { matched = true; break; }
    }
    if (!matched) return;
    e.preventDefault();
    finishCenterDrag();
    centerTouchId = null;
  }
  centerHandle.addEventListener('touchend',    endCenterTouch, { passive: false, capture: true });
  centerHandle.addEventListener('touchcancel', endCenterTouch, { passive: false, capture: true });
  document.addEventListener('touchend',        endCenterTouch, { passive: false, capture: true });
  document.addEventListener('touchcancel',     endCenterTouch, { passive: false, capture: true });

  // ---------- POINTER pathway (mouse / pen) ----------
  centerHandle.addEventListener('pointerdown', (e) => {
    // Skip touch — the touch pathway above handles it. This avoids double-fire.
    if (e.pointerType === 'touch') return;
    if (centerDrag) return;

    e.preventDefault();
    e.stopPropagation();

    if (!startCenterDrag(e.clientX, e.clientY, e.pointerId)) return;
    try { centerHandle.setPointerCapture(e.pointerId); } catch (_e) {}
  });

  centerHandle.addEventListener('pointermove', (e) => {
    if (!centerDrag || e.pointerType === 'touch') return;
    if (e.pointerId !== centerDrag.pointerId) return;
    moveCenterDrag(e.clientX, e.clientY);
  });

  function finishCenterDrag() {
    if (!centerDrag) return;
    if (centerDrag.tickId) clearTimeout(centerDrag.tickId);
    const wasDrag = centerDrag.moved;
    centerDrag = null;
    centerHandle.classList.remove('dragging');
    setDragDirection(null);
    snapIndicator.classList.remove('visible');
    afterCenterDrag(wasDrag);
  }

  function endCenterDrag(e) {
    if (!centerDrag || e.pointerType === 'touch') return;
    if (e.pointerId !== centerDrag.pointerId) return;

    try { centerHandle.releasePointerCapture(centerDrag.pointerId); } catch (_e) {}
    if (centerDrag.tickId) clearTimeout(centerDrag.tickId);
    const wasDrag = centerDrag.moved;
    centerDrag = null;
    centerHandle.classList.remove('dragging');
    setDragDirection(null);
    snapIndicator.classList.remove('visible');
    afterCenterDrag(wasDrag);
  }

  function afterCenterDrag(wasDrag) {
    if (!wasDrag) return;
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) return;

    // Keep the raw selection — no word-snap rewrite (it was overriding the drag).
    const finalSel = cm.getSelection();
    if (finalSel && finalSel.length > 0) {
      savedSelection = {
        from: cm.getCursor('from'),
        to: cm.getCursor('to'),
        text: finalSel
      };
      // Burst particles on release
      const rect = centerHandle.getBoundingClientRect();
      for (let i = 0; i < 12; i++) {
        spawnParticle(
          rect.left + rect.width/2 + (Math.random()-0.5)*30,
          rect.top + rect.height/2 + (Math.random()-0.5)*30,
          THEME.accent
        );
      }
      scheduleMenuOpen();
    }
  }

  centerHandle.addEventListener('pointerup', endCenterDrag);
  centerHandle.addEventListener('pointercancel', endCenterDrag);

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
      }, 5000);
    }
  }

  function attachCursorActivity() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(attachCursorActivity, 300); return; }
    if (cm.__dexCursorActivityBound) return;
    cm.__dexCursorActivityBound = true;

    // Enable per-character selection styling so text color in .CodeMirror-selectedtext
    // actually applies. No-op if the addon isn't loaded.
    try { cm.setOption('styleSelectedText', true); } catch (_e) {}

    cm.on('cursorActivity', () => {
      if (menuOpen() && !cm.getSelection()) {
        closeMenu();
      }
      // Seed the unified anchor whenever the caret moves with no selection.
      if (!cm.getSelection()) {
        selectionAnchor = cm.getCursor('head');
      }
      scheduleMenuOpen();
      updateCenterHandle();
      updateSelectionPreview();
    });
  }

  /* ====== INITIALIZATION ====== */
  function init() {
    updateToolbarVisibility();
    attachCursorActivity();
    // NOTE: attachMobileDragSelect intentionally not called.
    // It was hijacking touch-action and killing native editor scroll.
    // Selection is now Method 1 (D-Pad) + Method 3 (center handle), both
    // sharing the unified selectionAnchor.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('popstate', updateToolbarVisibility);
  window.addEventListener('hashchange', updateToolbarVisibility);

})();
