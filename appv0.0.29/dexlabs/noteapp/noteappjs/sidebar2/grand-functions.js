/**
 * DexLabs Grand Functions
 * ─────────────────────────────────────────────────────────────────────────────
 * Fullpage overlay for browsing and running functions from the registry.
 * Styled to match DexLabs site style (sidebar1/sidebar2 CSS variables).
 *
 * FIXES applied (vs. bugged version):
 *   1. L1 rail — icon only, no text label
 *   2. Whole gf-fn-item row is clickable (runs function); action btns stop propagation
 *   3. renderStaticItems uses top-level category-header style, not sub-item
 *   4. --vline-left / --line-top set on category groups
 *   5. Level 2+ navigation uses .custom-dropdown/.custom-dropdown-trigger (not <select>)
 *   6. ensureInfoElements() injects hidden #infoName/#infoStats/#infoDexLabs on DOM ready
 *      so existing JS always finds them; Info tab mirrors their values + download meta
 *   7. Route map (breadcrumbs) removed entirely
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  const PIN_KEY       = 'dexPinnedFunctions';
  const GF_OVERLAY_ID = 'grandFunctionsOverlay';

  // ── State ─────────────────────────────────────────────────────────────────
  let gfState = {
    view:   'functions',  // 'functions' | 'info'
    db:     'master',     // 'master'    | 'user'
    path:   [],           // [l1id, l2slug, l3slug, ...]
    search: ''
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  FIX 6 — Inject hidden DOM holder so existing JS always finds these IDs
  //  (infoName / infoStats / infoDexLabs were deleted from the sidebar footer)
  // ═══════════════════════════════════════════════════════════════════════════
  function ensureInfoElements() {
    if (document.getElementById('infoName')) return; // already present
    const holder = document.createElement('div');
    holder.id = 'gf-info-holder';
    holder.setAttribute('aria-hidden', 'true');
    // Visually hidden but in the DOM — existing code can update by ID
    holder.style.cssText = 'display:none !important; position:absolute; pointer-events:none;';
    holder.innerHTML =
      '<div id="infoDexLabs">Dex Labs | Local</div>' +
      '<div id="infoName">-</div>' +
      '<div id="infoStats" style="white-space:pre-line">' +
        'Char (ex. Spaces): 0\n' +
        'Char (in. Spaces): 0\n' +
        'Total Words: 0\n' +
        'Reading time: 0m\n' +
        'File Size: 0kb' +
      '</div>';
    document.body.appendChild(holder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInfoElements);
  } else {
    ensureInfoElements();
  }

  // ── UserDB helpers ────────────────────────────────────────────────────────
  function loadUserDb() {
    try { return new Map(JSON.parse(localStorage.getItem('dexGfUserDb') || '[]')); }
    catch (e) { return new Map(); }
  }
  function saveUserDb(map) {
    localStorage.setItem('dexGfUserDb', JSON.stringify(Array.from(map.entries())));
  }

  // ── Pin helpers ───────────────────────────────────────────────────────────
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
    if (typeof window.renderSidebar2PinnedSection === 'function') {
      window.renderSidebar2PinnedSection();
    }
  }

  // ── Icon helper ───────────────────────────────────────────────────────────
  function icIcon(name) {
    return `<span class="ic-icon" data-icon="${name}"></span>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Build overlay DOM (once, lazily)
  // ═══════════════════════════════════════════════════════════════════════════
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

        <!-- FIX 1: Left rail — icon only, no label text -->
        <nav class="gf-rail" id="gfRail" aria-label="Categories"></nav>

        <div class="gf-main" id="gfMain">

          <!-- Functions view -->
          <div class="gf-view" id="gfViewFunctions">

            <!-- FIX 5: Level 2+ navigation — custom-dropdown rows (no <select>) -->
            <!-- FIX 7: gf-routemap div removed entirely                          -->
            <div class="gf-dropdown-stack" id="gfDropdownStack" style="display:none"></div>

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

            <div class="gf-list" id="gfList"></div>
          </div>

          <!-- FIX 6: Info view — Note metadata + registry stats -->
          <div class="gf-view gf-view-hidden" id="gfViewInfo">
            <div class="gf-info-body">

              <!-- Note section -->
              <div class="gf-info-section-label">Note</div>
              <div class="gf-info-row">
                <span class="gf-info-label">Status</span>
                <span class="gf-info-val" id="gfNoteInfoDex">Dex Labs | Local</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">File</span>
                <span class="gf-info-val" id="gfNoteInfoName">-</span>
              </div>
              <!-- Stats rows injected by renderInfo() -->
              <div id="gfNoteInfoStats"></div>

              <!-- Registry section -->
              <div class="gf-info-section-label" style="margin-top:14px">Registry</div>
              <div class="gf-info-row">
                <span class="gf-info-label">Active database</span>
                <span class="gf-info-val" id="gfInfoDb">Master</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">Master DB functions</span>
                <span class="gf-info-val" id="gfInfoMaster">0</span>
              </div>
              <div class="gf-info-row">
                <span class="gf-info-label">User DB (added)</span>
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

  // ── Bind overlay-level events (runs once after DOM creation) ──────────────
  function bindOverlayEvents(overlay) {
    overlay.querySelector('#gfCloseBtn').addEventListener('click', close);

    overlay.querySelectorAll('.gf-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    overlay.querySelector('#gfDbBtn').addEventListener('click', toggleDb);

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
  // FIX 7: renderRouteMap() removed from call-list
  function renderAll() {
    renderDbBtn();
    renderRail();
    renderDropdowns();
    renderList();
  }

  // ── DB badge ──────────────────────────────────────────────────────────────
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
    const dbBtn = document.getElementById('gfDbBtn');
    if (dbBtn) dbBtn.dataset.active = gfState.db;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FIX 1 — Rail: icon only, no gf-rail-label span
  // ═══════════════════════════════════════════════════════════════════════════
  function renderRail() {
    const rail = document.getElementById('gfRail');
    if (!rail) return;
    const all      = FunctionRegistry.getAllLevel1();
    const activeL1 = gfState.path[0];

    rail.innerHTML = all.map(l1 => `
      <button
        class="gf-rail-btn${l1.id === activeL1 ? ' active' : ''}"
        data-l1="${l1.id}"
        title="${escHtml(l1.name)}"
      >${icIcon(l1.icon)}</button>
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  FIX 5 — Level 2+ dropdowns: .custom-dropdown + .custom-dropdown-trigger
  //  MutationObserver watches data-value changes (set by the site dropdown system)
  // ═══════════════════════════════════════════════════════════════════════════
  function renderDropdowns() {
    const stack = document.getElementById('gfDropdownStack');
    if (!stack) return;

    const tree   = FunctionRegistry.buildTree();
    const l1id   = gfState.path[0];
    const l1Node = tree.find(n => n.id === l1id);

    if (!l1Node || !l1Node.children.length) {
      stack.innerHTML     = '';
      stack.style.display = 'none';
      return;
    }

    stack.style.display = '';

    // Build row descriptors
    const rows = [];
    let currentNode = l1Node;

    for (let level = 0; level < gfState.path.length; level++) {
      if (!currentNode || !currentNode.children.length) break;

      const selectedId   = gfState.path[level + 1] || currentNode.children[0].id;
      const selectedNode = currentNode.children.find(c => c.id === selectedId)
                           || currentNode.children[0];
      const options      = currentNode.children.map(c => ({ label: c.name, value: c.id }));

      rows.push({
        // level here is the GF path index (0 = L1 slot, so this dropdown is L(level+2))
        gfLevel:      level + 1,   // used to slice gfState.path on change
        displayLabel: `L${level + 2}`,
        options,
        selectedId:   selectedNode.id,
        selectedName: selectedNode.name
      });

      currentNode = selectedNode;
    }

    // Render using site's custom-dropdown pattern (same as cleanup.js / handleCleanupText)
    stack.innerHTML = rows.map(r => `
      <div class="gf-dropdown-row">
        <span class="gf-lvl-label">${r.displayLabel}</span>
        <div class="custom-dropdown">
          <div
            class="custom-dropdown-trigger modal-input gf-lvl-dropdown"
            data-options='${JSON.stringify(r.options).replace(/'/g, "&#39;")}'
            data-value="${escHtml(r.selectedId)}"
            data-gf-level="${r.gfLevel}"
          >${escHtml(r.selectedName)}</div>
        </div>
      </div>
    `).join('');

    // Watch each trigger for data-value changes (set by site dropdown system on select)
    stack.querySelectorAll('.gf-lvl-dropdown').forEach(trigger => {
      observeDropdownChange(trigger, parseInt(trigger.dataset.gfLevel, 10));
    });
  }

  /**
   * MutationObserver on a custom-dropdown-trigger.
   * When data-value changes (user picked an option), rebuild path + re-render.
   * @param {HTMLElement} trigger
   * @param {number}      level   — the gfState.path slice index this dropdown controls
   */
  function observeDropdownChange(trigger, level) {
    const obs = new MutationObserver(() => {
      const selectedValue = trigger.dataset.value;
      if (!selectedValue) return;

      // Rebuild path up to this level, then push new selection
      const newPath = gfState.path.slice(0, level);
      newPath.push(selectedValue);

      // Auto-dive to deepest first child (same logic as old select handler)
      const tree = FunctionRegistry.buildTree();
      let node   = getNodeByPath(tree, newPath);
      while (node && node.children && node.children.length) {
        newPath.push(node.children[0].id);
        node = node.children[0];
      }

      if (JSON.stringify(newPath) === JSON.stringify(gfState.path)) return; // no change
      obs.disconnect(); // prevent re-entry during renderAll
      gfState.path = newPath;
      renderAll();
    });
    obs.observe(trigger, { attributes: true, attributeFilter: ['data-value'] });
  }

  // ── Tree navigation helper ────────────────────────────────────────────────
  function getNodeByPath(tree, pathArray) {
    let node = tree.find(n => n.id === pathArray[0]);
    for (let i = 1; i < pathArray.length; i++) {
      if (!node || !node.children) break;
      node = node.children.find(c => c.id === pathArray[i]) || null;
    }
    return node;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FIX 2 — Function list: whole row clickable; action buttons stop propagation
  // ═══════════════════════════════════════════════════════════════════════════
  function renderList() {
    const container = document.getElementById('gfList');
    if (!container) return;

    const allFns  = FunctionRegistry.getAllFunctions();
    const userDb  = loadUserDb();
    const isUser  = gfState.db === 'user';
    const source  = isUser ? Array.from(userDb.values()) : allFns;

    let filtered = source;

    if (gfState.search.trim()) {
      const q = gfState.search.toLowerCase().trim();
      filtered = allFns.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.under.join(' ').toLowerCase().includes(q)
      );
      if (isUser) filtered = filtered.filter(f => userDb.has(f.id));
    } else {
      const tree = FunctionRegistry.buildTree();
      const node = getNodeByPath(tree, gfState.path);

      if (node) {
        const collectLeaves = (n) => {
          let leaves = [...(n.leaves || []), ...(n.directLeaves || [])];
          (n.children || []).forEach(c => { leaves = leaves.concat(collectLeaves(c)); });
          return leaves;
        };
        const leafSet = new Set(collectLeaves(node).map(f => f.id));
        filtered = source.filter(f => leafSet.has(f.id));
      }
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="gf-empty">${icIcon('search_off')} No functions found.</div>`;
      return;
    }

    container.innerHTML = filtered.map(fn => {
      const pinned = isPinned(fn.onclick);
      const inUser = userDb.has(fn.id);
      return `
        <div class="gf-fn-item" data-id="${fn.id}">
          <span class="gf-fn-icon">${icIcon(fn.icon)}</span>
          <div class="gf-fn-info">
            <span class="gf-fn-name">${escHtml(fn.name)}</span>
            <span class="gf-fn-path">${escHtml(fn.under.join(' › '))}</span>
          </div>
          <div class="gf-fn-actions">
            <button class="gf-pin-btn${pinned ? ' pinned' : ''}" data-fn-id="${fn.id}"
              title="${pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}"
            >${icIcon(pinned ? 'star' : 'star_border')}</button>
            ${!isUser
              ? `<button class="gf-add-btn${inUser ? ' added' : ''}" data-fn-id="${fn.id}"
                   title="${inUser ? 'In User DB' : 'Add to User DB'}"${inUser ? ' disabled' : ''}
                 >${icIcon(inUser ? 'check' : 'add')}</button>`
              : `<button class="gf-remove-btn" data-fn-id="${fn.id}"
                   title="Remove from User DB"
                 >${icIcon('remove')}</button>`
            }
            <button class="gf-run-btn" data-fn-id="${fn.id}" title="Run">
              ${icIcon('play_arrow')}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // ── Helper: run a function by id and close overlay ─────────────────────
    function runFnById(id) {
      const fn = allFns.find(f => f.id === Number(id));
      if (!fn || !fn.onclick) return;
      try { (0, eval)(fn.onclick); } catch (err) { console.warn('GF run:', err); }
      close();
    }

    // ── FIX 2a: Whole row click → run (skip .gf-fn-actions area) ──────────
    container.querySelectorAll('.gf-fn-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.gf-fn-actions')) return; // let action buttons handle themselves
        runFnById(item.dataset.id);
      });
    });

    // ── Pin buttons ────────────────────────────────────────────────────────
    container.querySelectorAll('.gf-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = allFns.find(f => f.id === Number(btn.dataset.fnId));
        if (!fn) return;
        togglePin({ onclick: fn.onclick, icon: fn.icon, text: fn.name });
        const nowPinned = isPinned(fn.onclick);
        btn.classList.toggle('pinned', nowPinned);
        btn.innerHTML = icIcon(nowPinned ? 'star' : 'star_border');
        btn.title     = nowPinned ? 'Unpin from sidebar' : 'Pin to sidebar';
      });
    });

    // ── Add buttons ────────────────────────────────────────────────────────
    container.querySelectorAll('.gf-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = allFns.find(f => f.id === Number(btn.dataset.fnId));
        if (!fn) return;
        const udb = loadUserDb();
        udb.set(fn.id, fn);
        saveUserDb(udb);
        btn.disabled  = true;
        btn.classList.add('added');
        btn.innerHTML = icIcon('check');
        btn.title     = 'In User DB';
        renderDbBtn();
        if (typeof window.renderSidebar2Categories === 'function') {
          window.renderSidebar2Categories();
        }
      });
    });

    // ── Remove buttons (user DB view) ──────────────────────────────────────
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

    // ── Run buttons ────────────────────────────────────────────────────────
    container.querySelectorAll('.gf-run-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        runFnById(btn.dataset.fnId);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FIX 6 — Info view: Note metadata + registry stats
  // ═══════════════════════════════════════════════════════════════════════════
  function renderInfo() {
    const allFns = FunctionRegistry.getAllFunctions();
    const allL1  = FunctionRegistry.getAllLevel1();
    const udb    = loadUserDb();
    const pins   = loadPins();

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // Registry stats
    set('gfInfoDb',     gfState.db === 'master' ? 'Master' : 'User');
    set('gfInfoMaster', allFns.length);
    set('gfInfoUser',   udb.size);
    set('gfInfoPinned', pins.length);
    set('gfInfoCats',   allL1.length);

    // Note info — read from hidden holder injected by ensureInfoElements()
    const nameEl  = document.getElementById('infoName');
    const dexEl   = document.getElementById('infoDexLabs');
    const statsEl = document.getElementById('infoStats');

    set('gfNoteInfoName', nameEl ? (nameEl.textContent.trim() || '-')                : '-');
    set('gfNoteInfoDex',  dexEl  ? (dexEl.textContent.trim()  || 'Dex Labs | Local') : 'Dex Labs | Local');

    // Stats: parse multi-line text → individual gf-info-row entries
    // Covers chars, words, reading time, file size (download meta)
    const statsContainer = document.getElementById('gfNoteInfoStats');
    if (statsContainer) {
      const raw   = statsEl ? (statsEl.textContent || '').trim() : '';
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length) {
        statsContainer.innerHTML = lines.map(line => {
          const colon = line.indexOf(':');
          const label = colon !== -1 ? line.slice(0, colon).trim()  : line;
          const val   = colon !== -1 ? line.slice(colon + 1).trim() : '';
          return `
            <div class="gf-info-row">
              <span class="gf-info-label">${escHtml(label)}</span>
              <span class="gf-info-val">${escHtml(val)}</span>
            </div>`;
        }).join('');
      } else {
        statsContainer.innerHTML = '';
      }
    }
  }

  // ── Escape HTML ───────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────
  global.GrandFunctions = { open, close, loadUserDb, loadPins, isPinned, togglePin };

})(window);
