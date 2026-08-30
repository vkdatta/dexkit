/**
 * DexLabs Grand Functions
 * ─────────────────────────────────────────────────────────────────────────────
 * Fullpage overlay for browsing and pinning functions from the registry.
 * Styled to match DexLabs site style (sidebar1/sidebar2 CSS variables).
 * No external fonts, no conflicting colors — purely inherits from :root.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const PIN_KEY       = 'dexPinnedFunctions';
  const GF_OVERLAY_ID = 'grandFunctionsOverlay';

  // ── State ────────────────────────────────────────────────────────────────
  let gfState = {
    view:     'functions',  // 'functions' | 'info'
    db:       'master',     // 'master' | 'user'
    path:     [],           // [level1id, sublevel_slug, ...]
    search:   ''
  };

  // UserDB: functions pinned from the master registry — shown in Categories
  function loadUserDb() {
    try { return new Map(JSON.parse(localStorage.getItem('dexGfUserDb') || '[]')); }
    catch (e) { return new Map(); }
  }
  function saveUserDb(map) {
    localStorage.setItem('dexGfUserDb', JSON.stringify(Array.from(map.entries())));
  }

  // ── Pin helpers (userDb = "pinned into categories" in sidebar2) ──────────
  function loadPins() {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (e) { return []; }
  }
  function savePins(list) { localStorage.setItem(PIN_KEY, JSON.stringify(list)); }
  function isPinned(onclickAttr) { return loadPins().some(p => p.onclick === onclickAttr); }
  function togglePin(entry) {
    const list = loadPins();
    const idx  = list.findIndex(p => p.onclick === entry.onclick);
    if (idx === -1) list.push(entry); else list.splice(idx, 1);
    savePins(list);
    // Refresh sidebar2 pinned section if visible
    if (typeof window.renderSidebar2PinnedSection === 'function') {
      window.renderSidebar2PinnedSection();
    }
  }

  // ── Icon helper ──────────────────────────────────────────────────────────
  function icIcon(name) {
    return `<span class="ic-icon" data-icon="${name}"></span>`;
  }

  // ── Build overlay DOM (once) ──────────────────────────────────────────────
  function ensureOverlay() {
    if (document.getElementById(GF_OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id        = GF_OVERLAY_ID;
    overlay.className = 'gf-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Grand Functions');

    overlay.innerHTML = `
      <div class="gf-header">
        <div class="gf-header-left">
          ${icIcon('apps')}
          <span class="gf-title">Grand Functions</span>
        </div>
        <div class="gf-header-tabs">
          <button class="gf-tab active" data-view="functions">${icIcon('code')} Functions</button>
          <button class="gf-tab"        data-view="info">${icIcon('info')} Info</button>
        </div>
        <div class="gf-header-right">
          <button class="gf-db-btn" id="gfDbBtn" title="Switch database">
            ${icIcon('swap_horiz')}
            <span id="gfDbLabel">MASTER</span>
            <span class="gf-db-count" id="gfDbCount">0</span>
          </button>
          <button class="gf-close-btn" id="gfCloseBtn" title="Close">
            ${icIcon('close')}
          </button>
        </div>
      </div>

      <div class="gf-body">

        <!-- Left rail: Level-1 categories -->
        <nav class="gf-rail" id="gfRail" aria-label="Categories"></nav>

        <!-- Main panel -->
        <div class="gf-main" id="gfMain">

          <!-- Functions view -->
          <div class="gf-view" id="gfViewFunctions">

            <!-- Sub-level dropdowns (Level 2+) -->
            <div class="gf-dropdown-stack" id="gfDropdownStack"></div>

            <!-- Search -->
            <div class="gf-search-row">
              <span class="gf-search-icon">${icIcon('search')}</span>
              <input
                class="gf-search-input"
                id="gfSearchInput"
                type="text"
                placeholder="Search functions…"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="gf-search-clear" id="gfSearchClear" style="display:none">
                ${icIcon('close')}
              </button>
            </div>

            <!-- Breadcrumb route map -->
            <div class="gf-routemap" id="gfRouteMap"></div>

            <!-- Function list -->
            <div class="gf-list" id="gfList"></div>
          </div>

          <!-- Info view -->
          <div class="gf-view gf-view-hidden" id="gfViewInfo">
            <div class="gf-info-body">
              <div class="gf-info-row">
                <span class="gf-info-label">Active database</span>
                <span class="gf-info-val" id="gfInfoDb">Master</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">Master DB functions</span>
                <span class="gf-info-val" id="gfInfoMaster">0</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">User DB (pinned)</span>
                <span class="gf-info-val" id="gfInfoUser">0</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">Pinned to sidebar</span>
                <span class="gf-info-val" id="gfInfoPinned">0</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">Level-1 categories</span>
                <span class="gf-info-val" id="gfInfoCats">0</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    bindOverlayEvents(overlay);
  }

  // ── Bind all events ───────────────────────────────────────────────────────
  function bindOverlayEvents(overlay) {
    // Close button
    overlay.querySelector('#gfCloseBtn').addEventListener('click', close);

    // Tabs
    overlay.querySelectorAll('.gf-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // DB switcher
    overlay.querySelector('#gfDbBtn').addEventListener('click', toggleDb);

    // Search
    const searchInput = overlay.querySelector('#gfSearchInput');
    const searchClear = overlay.querySelector('#gfSearchClear');
    searchInput.addEventListener('input', (e) => {
      gfState.search = e.target.value;
      searchClear.style.display = gfState.search ? '' : 'none';
      renderList();
    });
    searchClear.addEventListener('click', () => {
      gfState.search = '';
      searchInput.value = '';
      searchClear.style.display = 'none';
      renderList();
    });
  }

  // ── Open / Close ──────────────────────────────────────────────────────────
  function open() {
    ensureOverlay();
    // Default path to first level-1 if empty
    if (!gfState.path.length) {
      const all = FunctionRegistry.getAllLevel1();
      if (all.length) gfState.path = [all[0].id];
    }
    const overlay = document.getElementById(GF_OVERLAY_ID);
    overlay.classList.add('gf-open');
    overlay.setAttribute('aria-hidden', 'false');
    renderAll();
  }

  function close() {
    const overlay = document.getElementById(GF_OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('gf-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function switchView(view) {
    gfState.view = view;
    const overlay = document.getElementById(GF_OVERLAY_ID);
    overlay.querySelectorAll('.gf-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.view === view)
    );
    overlay.querySelector('#gfViewFunctions').classList.toggle('gf-view-hidden', view !== 'functions');
    overlay.querySelector('#gfViewInfo').classList.toggle('gf-view-hidden', view !== 'info');
    if (view === 'info') renderInfo();
  }

  function toggleDb() {
    gfState.db = gfState.db === 'master' ? 'user' : 'master';
    renderAll();
  }

  // ── Render all panels ─────────────────────────────────────────────────────
  function renderAll() {
    renderDbBtn();
    renderRail();
    renderDropdowns();
    renderRouteMap();
    renderList();
  }

  function renderDbBtn() {
    const label = document.getElementById('gfDbLabel');
    const count = document.getElementById('gfDbCount');
    if (!label || !count) return;
    if (gfState.db === 'master') {
      label.textContent = 'MASTER';
      count.textContent = FunctionRegistry.getAllFunctions().length;
    } else {
      const udb = loadUserDb();
      label.textContent = 'USER';
      count.textContent = udb.size;
    }
    document.getElementById('gfDbBtn').dataset.active = gfState.db;
  }

  function renderRail() {
    const rail = document.getElementById('gfRail');
    if (!rail) return;
    const all = FunctionRegistry.getAllLevel1();
    const activeL1 = gfState.path[0];

    rail.innerHTML = all.map(l1 => `
      <button
        class="gf-rail-btn${l1.id === activeL1 ? ' active' : ''}"
        data-l1="${l1.id}"
        title="${escHtml(l1.name)}"
      >
        ${icIcon(l1.icon)}
        <span class="gf-rail-label">${escHtml(l1.name)}</span>
      </button>
    `).join('');

    rail.querySelectorAll('.gf-rail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        gfState.path   = [btn.dataset.l1];
        gfState.search = '';
        const inp = document.getElementById('gfSearchInput');
        if (inp) inp.value = '';
        const clr = document.getElementById('gfSearchClear');
        if (clr) clr.style.display = 'none';
        renderAll();
      });
    });
  }

  function renderDropdowns() {
    const stack = document.getElementById('gfDropdownStack');
    if (!stack) return;

    const tree    = FunctionRegistry.buildTree();
    const l1id    = gfState.path[0];
    const l1Node  = tree.find(n => n.id === l1id);

    if (!l1Node || !l1Node.children.length) {
      stack.innerHTML = '';
      stack.style.display = 'none';
      return;
    }

    stack.style.display = '';
    let html        = '';
    let currentNode = l1Node;

    for (let level = 0; level < gfState.path.length; level++) {
      if (!currentNode || !currentNode.children.length) break;
      const selectedId = gfState.path[level + 1] || currentNode.children[0].id;

      html += `<div class="gf-dropdown-row">
        <span class="gf-lvl-label">L${level + 2}</span>
        <select class="gf-dropdown" data-level="${level + 1}">
          ${currentNode.children.map(child =>
            `<option value="${escHtml(child.id)}" ${child.id === selectedId ? 'selected' : ''}>${escHtml(child.name)}</option>`
          ).join('')}
        </select>
      </div>`;

      currentNode = currentNode.children.find(c => c.id === selectedId) || null;
    }

    stack.innerHTML = html;

    stack.querySelectorAll('.gf-dropdown').forEach(sel => {
      sel.addEventListener('change', () => {
        const lvl = parseInt(sel.dataset.level, 10);
        const newPath = gfState.path.slice(0, lvl);
        newPath.push(sel.value);
        // Auto-dive to deepest first child
        let node = getNodeByPath(tree, newPath);
        while (node && node.children.length) {
          newPath.push(node.children[0].id);
          node = node.children[0];
        }
        gfState.path = newPath;
        renderAll();
      });
    });
  }

  function getNodeByPath(tree, pathArray) {
    let node = tree.find(n => n.id === pathArray[0]);
    for (let i = 1; i < pathArray.length; i++) {
      if (!node || !node.children) break;
      node = node.children.find(c => c.id === pathArray[i]) || null;
    }
    return node;
  }

  function renderRouteMap() {
    const el = document.getElementById('gfRouteMap');
    if (!el) return;
    const tree    = FunctionRegistry.buildTree();
    const parts   = [];
    const pathSoFar = [];

    gfState.path.forEach((id, idx) => {
      pathSoFar.push(id);
      let name = id;
      if (idx === 0) {
        const n = tree.find(n => n.id === id);
        if (n) name = n.name;
      } else {
        const n = getNodeByPath(tree, pathSoFar.slice());
        if (n) name = n.name;
      }
      const snap = pathSoFar.slice();
      parts.push({ name, snap });
    });

    el.innerHTML = parts.map((p, i) =>
      `<button class="gf-bc-node" data-snap="${escHtml(JSON.stringify(p.snap))}">${escHtml(p.name)}</button>` +
      (i < parts.length - 1 ? '<span class="gf-bc-sep">/</span>' : '')
    ).join('');

    el.querySelectorAll('.gf-bc-node').forEach(btn => {
      btn.addEventListener('click', () => {
        try { gfState.path = JSON.parse(btn.dataset.snap); renderAll(); } catch (e) {}
      });
    });
  }

  function renderList() {
    const container = document.getElementById('gfList');
    if (!container) return;

    const allFns  = FunctionRegistry.getAllFunctions();
    const userDb  = loadUserDb();
    const isUser  = gfState.db === 'user';
    const source  = isUser ? Array.from(userDb.values()) : allFns;

    let filtered = source;

    // Search overrides path filter
    if (gfState.search.trim()) {
      const q = gfState.search.toLowerCase().trim();
      filtered = allFns.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.under.join(' ').toLowerCase().includes(q)
      );
      if (isUser) filtered = filtered.filter(f => userDb.has(f.id));
    } else {
      // Filter by current path leaf
      const tree   = FunctionRegistry.buildTree();
      const leafId = gfState.path[gfState.path.length - 1];
      const node   = getNodeByPath(tree, gfState.path);

      if (node) {
        // Collect all leaves from this node downward
        const collectLeaves = (n) => {
          let leaves = [...(n.leaves || []), ...(n.directLeaves || [])];
          (n.children || []).forEach(c => { leaves = leaves.concat(collectLeaves(c)); });
          return leaves;
        };
        const nodeLeaves = collectLeaves(node);
        const leafSet = new Set(nodeLeaves.map(f => f.id));
        filtered = source.filter(f => leafSet.has(f.id));
      }
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="gf-empty">${icIcon('search_off')} No functions found.</div>`;
      return;
    }

    container.innerHTML = filtered.map(fn => {
      const pinned  = isPinned(fn.onclick);
      const inUser  = userDb.has(fn.id);
      return `
        <div class="gf-fn-item" data-id="${fn.id}">
          <span class="gf-fn-icon">${icIcon(fn.icon)}</span>
          <div class="gf-fn-info">
            <span class="gf-fn-name">${escHtml(fn.name)}</span>
            <span class="gf-fn-path">${escHtml(fn.under.join(' › '))}</span>
          </div>
          <div class="gf-fn-actions">
            <button
              class="gf-pin-btn${pinned ? ' pinned' : ''}"
              data-fn-id="${fn.id}"
              title="${pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}"
            >${icIcon(pinned ? 'star' : 'star_border')}</button>
            ${!isUser
              ? `<button class="gf-add-btn${inUser ? ' added' : ''}" data-fn-id="${fn.id}" title="${inUser ? 'In User DB' : 'Add to User DB'}" ${inUser ? 'disabled' : ''}>
                   ${icIcon(inUser ? 'check' : 'add')}
                 </button>`
              : `<button class="gf-remove-btn" data-fn-id="${fn.id}" title="Remove from User DB">
                   ${icIcon('remove')}
                 </button>`
            }
            <button
              class="gf-run-btn"
              data-onclick="${escHtml(fn.onclick)}"
              title="Run"
            >${icIcon('play_arrow')}</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind events on items
    container.querySelectorAll('.gf-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = allFns.find(f => f.id === Number(btn.dataset.fnId));
        if (!fn) return;
        togglePin({ onclick: fn.onclick, icon: fn.icon, text: fn.name });
        const nowPinned = isPinned(fn.onclick);
        btn.classList.toggle('pinned', nowPinned);
        btn.innerHTML    = icIcon(nowPinned ? 'star' : 'star_border');
        btn.title        = nowPinned ? 'Unpin from sidebar' : 'Pin to sidebar';
      });
    });

    container.querySelectorAll('.gf-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = allFns.find(f => f.id === Number(btn.dataset.fnId));
        if (!fn) return;
        const udb = loadUserDb();
        udb.set(fn.id, fn);
        saveUserDb(udb);
        btn.disabled    = true;
        btn.classList.add('added');
        btn.innerHTML   = icIcon('check');
        btn.title       = 'In User DB';
        renderDbBtn();
        // Refresh sidebar2 categories
        if (typeof window.renderSidebar2Categories === 'function') {
          window.renderSidebar2Categories();
        }
      });
    });

    container.querySelectorAll('.gf-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = allFns.find(f => f.id === Number(btn.dataset.fnId));
        if (!fn) return;
        const udb = loadUserDb();
        udb.delete(fn.id);
        saveUserDb(udb);
        renderAll();
        if (typeof window.renderSidebar2Categories === 'function') {
          window.renderSidebar2Categories();
        }
      });
    });

    container.querySelectorAll('.gf-run-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const js = btn.dataset.onclick;
        if (js) {
          try { eval(js); } catch (err) { console.warn('GF run:', err); }
          close();
        }
      });
    });
  }

  function renderInfo() {
    const allFns  = FunctionRegistry.getAllFunctions();
    const allL1   = FunctionRegistry.getAllLevel1();
    const udb     = loadUserDb();
    const pins    = loadPins();
    document.getElementById('gfInfoDb')     && (document.getElementById('gfInfoDb').textContent     = gfState.db === 'master' ? 'Master' : 'User');
    document.getElementById('gfInfoMaster') && (document.getElementById('gfInfoMaster').textContent = allFns.length);
    document.getElementById('gfInfoUser')   && (document.getElementById('gfInfoUser').textContent   = udb.size);
    document.getElementById('gfInfoPinned') && (document.getElementById('gfInfoPinned').textContent = pins.length);
    document.getElementById('gfInfoCats')   && (document.getElementById('gfInfoCats').textContent   = allL1.length);
  }

  // ── Util ──────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Expose public API ─────────────────────────────────────────────────────
  global.GrandFunctions = { open, close, loadUserDb, loadPins, isPinned, togglePin };

})(window);
