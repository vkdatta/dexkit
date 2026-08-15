(function () {
  if (window.__dexGraphLoaded) return;
  window.__dexGraphLoaded = true;

  const LINK_RE = /\{\{([^}]+)\}\}/g;
  const LINK_DISTANCE = 90;
  const REPULSION = 1800;
  const SPRING = 0.02;
  const CENTER_PULL = 0.01;
  const DAMPING = 0.85;
  const NODE_R = 7;

  let overlay = null, canvas = null, ctx = null, countEl = null, emptyEl = null;
  let nodes = [], edges = [];
  let rafId = null;
  let dragNode = null;

  function ensureDom() {
    if (overlay) return;
    overlay = document.getElementById('asteroidOverlay');
    canvas = document.getElementById('asteroidCanvas');
    countEl = document.getElementById('asteroidCount');
    emptyEl = document.getElementById('asteroidEmpty');
    if (!overlay || !canvas) return;
    ctx = canvas.getContext('2d');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', sizeCanvas);
  }

  function token(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function findNoteByTitle(title) {
    const t = title.trim().toLowerCase();
    if (!t) return null;
    return (notes || []).find((n) => (n.title || '').trim().toLowerCase() === t) || null;
  }

  function buildGraph() {
    const list = Array.isArray(notes) ? notes : [];
    nodes = list.map((n) => ({
      id: n.id,
      title: n.title || ('note ' + n.id),
      x: (canvas.width / 2) + (Math.random() - 0.5) * 200,
      y: (canvas.height / 2) + (Math.random() - 0.5) * 200,
      vx: 0, vy: 0
    }));
    const byId = new Map(nodes.map((n) => [String(n.id), n]));
    const seen = new Set();
    edges = [];
    list.forEach((n) => {
      const content = n.content || '';
      let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(content))) {
        const target = findNoteByTitle(m[1]);
        if (!target || String(target.id) === String(n.id)) continue;
        const key = [String(n.id), String(target.id)].sort().join('::');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a: byId.get(String(n.id)), b: byId.get(String(target.id)) });
      }
    });
  }

  function sizeCanvas() {
    if (!canvas || !overlay) return;
    canvas.width = overlay.clientWidth;
    canvas.height = overlay.clientHeight;
  }

  function step() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) distSq = 1;
        const force = REPULSION / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
    edges.forEach((e) => {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const diff = (dist - LINK_DISTANCE) * SPRING;
      const fx = (dx / dist) * diff, fy = (dy / dist) * diff;
      e.a.vx += fx; e.a.vy += fy;
      e.b.vx -= fx; e.b.vy -= fy;
    });
    const cx = canvas.width / 2, cy = canvas.height / 2;
    nodes.forEach((n) => {
      if (n === dragNode) return;
      n.vx += (cx - n.x) * CENTER_PULL;
      n.vy += (cy - n.y) * CENTER_PULL;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx; n.y += n.vy;
    });
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const edgeColor = token('--c-border', 'rgba(255,255,255,0.15)');
    const nodeColor = token('--c-accent', '#9ab0ff');
    const textColor = token('--c-text-dim', '#999');

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    edges.forEach((e) => {
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    });

    ctx.font = '11px sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(n.title, n.x, n.y + NODE_R + 13);
    });
  }

  function loop() {
    step();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function nodeAt(x, y) {
    return nodes.find((n) => Math.hypot(n.x - x, n.y - y) <= NODE_R + 6) || null;
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e) {
    const p = canvasPoint(e);
    const n = nodeAt(p.x, p.y);
    if (n) { dragNode = n; dragNode.__moved = false; }
  }
  function onPointerMove(e) {
    if (!dragNode) return;
    const p = canvasPoint(e);
    dragNode.x = p.x; dragNode.y = p.y;
    dragNode.vx = 0; dragNode.vy = 0;
    dragNode.__moved = true;
  }
  function onPointerUp(e) {
    if (!dragNode) return;
    const moved = dragNode.__moved;
    const n = dragNode;
    dragNode = null;
    if (!moved) {
      closeAsteroidBelt();
      if (typeof showNoteApp === 'function') showNoteApp(n.id);
    }
  }

  function closeAsteroidBelt() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (overlay) overlay.classList.remove('open');
  }
  window.closeAsteroidBelt = closeAsteroidBelt;

  window.openAsteroidBelt = function () {
    ensureDom();
    if (!overlay || !canvas) { if (typeof showNotification === 'function') showNotification('Asteroid belt unavailable'); return; }
    overlay.classList.add('open');
    sizeCanvas();
    buildGraph();
    if (emptyEl) emptyEl.style.display = edges.length ? 'none' : '';
    if (countEl) countEl.textContent = nodes.length + ' note' + (nodes.length === 1 ? '' : 's') + ' · ' + edges.length + ' link' + (edges.length === 1 ? '' : 's');
    if (rafId) cancelAnimationFrame(rafId);
    loop();
  };
})();
