/**
 * DexLabs Sidebar 2 — Revamped
 * ─────────────────────────────────────────────────────────────────────────────
 * No static function HTML in index.html.
 * Everything is driven by FunctionRegistry + GrandFunctions.
 *
 * Structure inside the sidebar:
 *   1. Search bar
 *   2. Quick-action grid  (font-size, clipboard)
 *   3. Static items       (Settings, Rename, Download) — TOP-LEVEL style
 *   4. Pinned section     (star-pinned functions from GF)
 *   5. Categories         (functions added to userDb from GF)
 *   6. [Grand Functions]  → opens GrandFunctions overlay
 *
 * FIXES vs. bugged version:
 *   - FIX 3/4: renderStaticItems() now uses secondary-sidebar-category-header
 *              (matches original non-collapse top-level items), not sub-item style
 *   - FIX 4b:  Categories groups set --vline-left and --line-top CSS vars
 *              so the original tree-line CSS renders correctly
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── Elements ──────────────────────────────────────────────────────────────
  const hamburger   = document.getElementById('secondary-sidebar-button');
  const overlay     = document.getElementById('secondary-sidebar-overlay');
  const sidebar     = document.getElementById('secondary-sidebar');
  const productCard = document.getElementById('secondary-sidebar-card');
  const cardScroll  = document.getElementById('secondary-sidebar-scroll');

  if (!hamburger || !overlay || !sidebar || !productCard || !cardScroll) return;

  // ── Open / Close ──────────────────────────────────────────────────────────
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    sidebar.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.innerHTML = '<i class="ic-icon" data-icon="close"></i>';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    sidebar.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<i class="ic-icon" data-icon="view_cozy"></i>';
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sidebar.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) closeSidebar();
  });

  // ── Pin helpers ───────────────────────────────────────────────────────────
  const PIN_KEY = 'dexPinnedFunctions';

  function loadPins() {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (e) { return []; }
  }
  function isPinned(onclick) { return loadPins().some(p => p.onclick === onclick); }

  function loadUserDb() {
    try { return new Map(JSON.parse(localStorage.getItem('dexGfUserDb') || '[]')); }
    catch (e) { return new Map(); }
  }

  // ── Search state ──────────────────────────────────────────────────────────
  let currentQuery = '';

  // ── Build entire sidebar card ─────────────────────────────────────────────
  function buildSidebar2() {
    cardScroll.innerHTML = '';

    renderSearchBar();      // 1
    renderQuickActions();   // 2
    renderStaticItems();    // 3  ← FIX: top-level style
    renderPinnedSection();  // 4
    renderCategories();     // 5  ← FIX: --vline-left / --line-top set
    renderGrandFunctionsBtn(); // 6
  }

  // ── 1. Search ─────────────────────────────────────────────────────────────
  function renderSearchBar() {
    const wrap  = document.createElement('div');
    wrap.className = 'sb2-search-wrap';

    const input = document.createElement('input');
    input.type        = 'text';
    input.id          = 'sidebar2Search';
    input.className   = 'sidebar2-search';
    input.placeholder = 'Search functions…';
    input.autocomplete = 'off';
    input.spellcheck  = false;
    input.value       = currentQuery;

    input.addEventListener('input', () => {
      currentQuery = input.value;
      applySearch(currentQuery);
    });

    wrap.appendChild(input);
    cardScroll.appendChild(wrap);
  }

  // ── 2. Quick-action grid ──────────────────────────────────────────────────
  function renderQuickActions() {
    // Font size control
    const fsc = document.createElement('div');
    fsc.className = 'secondary-sidebar-item font-size-control';
    fsc.innerHTML = `
      <button onclick="decreaseFontSize()" style="background:var(--matte)">
        <i class="ic-icon" data-icon="remove"></i>
      </button>
      <span>Font Size</span>
      <button onclick="increaseFontSize()" style="background:var(--matte)">
        <i class="ic-icon" data-icon="add"></i>
      </button>`;
    cardScroll.appendChild(fsc);

    // Clipboard icon grid
    const grid = document.createElement('div');
    grid.className = 'secondary-sidebar-grid';
    const gridItems = [
      { icon: 'select_all',    onclick: 'handleSelectAll()' },
      { icon: 'content_copy',  onclick: 'handleCopyNote()' },
      { icon: 'content_cut',   onclick: 'handleCutNote()' },
      { icon: 'clear_all',     onclick: 'handleClearNote()' },
      { icon: 'content_paste', onclick: 'handlePasteNote()' },
    ];
    gridItems.forEach(it => {
      const btn = document.createElement('div');
      btn.className = 'secondary-sidebar-grid-item';
      btn.setAttribute('onclick', it.onclick);
      btn.innerHTML = `<i class="ic-icon" data-icon="${it.icon}"></i>`;
      grid.appendChild(btn);
    });
    cardScroll.appendChild(grid);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  FIX 3 / 4 — Static items rendered as top-level category-header buttons
  //  Original sidebar2 rendered Settings/Rename/Download as non-collapse
  //  items using secondary-sidebar-category-header (no chevron).
  //  The bugged version used makeLeafButton → secondary-sidebar-sub-item
  //  which produced the wrong visual depth and "dirty" look.
  // ═════════════════════════════════════════════════════════════════════════
  function renderStaticItems() {
    const staticItems = [
      { icon: 'tune',     text: 'Settings',     onclick: 'openSettingsManager()' },
      { icon: 'edit',     text: 'Rename',        onclick: 'handleRename()' },
      { icon: 'download', text: 'Download Note', onclick: 'handleDownload()' },
    ];

    staticItems.forEach(it => {
      const group = document.createElement('div');
      group.className = 'secondary-sidebar-category-group';

      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'secondary-sidebar-category-header';
      btn.setAttribute('onclick', it.onclick);

      // Match the original left-icon + label structure exactly
      const left = document.createElement('span');
      left.className = 'secondary-sidebar-left';

      const ic = document.createElement('span');
      ic.className = 'ic-icon';
      ic.setAttribute('data-icon', it.icon);

      const label = document.createElement('span');
      label.className = 'secondary-sidebar-label';
      label.textContent = it.text;

      left.append(ic, label);
      btn.appendChild(left);
      // No chevron — these are non-collapse items
      group.appendChild(btn);
      cardScroll.appendChild(group);
    });
  }

  // ── 4. Pinned section ─────────────────────────────────────────────────────
  function renderPinnedSection() {
    let section = document.getElementById('sidebar2PinnedSection');
    if (!section) {
      section = document.createElement('div');
      section.id        = 'sidebar2PinnedSection';
      section.className = 'sidebar2-pinned-section';
      cardScroll.appendChild(section);
    }
    refreshPinnedSection(section);
  }

  function refreshPinnedSection(section) {
    if (!section) section = document.getElementById('sidebar2PinnedSection');
    if (!section) return;

    const pins = loadPins();
    const q    = currentQuery.toLowerCase().trim();
    const vis  = q ? pins.filter(p => p.text.toLowerCase().includes(q)) : pins;

    if (!vis.length) { section.style.display = 'none'; section.innerHTML = ''; return; }
    section.style.display = '';
    section.innerHTML     = '<div class="sidebar2-pinned-label">Pinned</div>';

    vis.forEach(p => {
      const btn = makeLeafButton(p.icon, p.text, p.onclick, null, true);
      btn.classList.add('sidebar2-pinned-item');

      const starBtn = document.createElement('span');
      starBtn.className = 'ic-icon sidebar2-pin-btn pinned';
      starBtn.setAttribute('data-icon', 'star');
      starBtn.title = 'Unpin';
      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = loadPins();
        const idx  = list.findIndex(x => x.onclick === p.onclick);
        if (idx !== -1) list.splice(idx, 1);
        localStorage.setItem(PIN_KEY, JSON.stringify(list));
        buildSidebar2();
      });

      btn.appendChild(starBtn);
      section.appendChild(btn);
    });
  }

  // ── 5. Categories (from userDb) ───────────────────────────────────────────
  function renderCategories() {
    let section = document.getElementById('sidebar2Categories');
    if (!section) {
      section = document.createElement('div');
      section.id        = 'sidebar2Categories';
      section.className = 'sb2-categories';
      cardScroll.appendChild(section);
    }
    refreshCategories(section);
  }

  function refreshCategories(section) {
    if (!section) section = document.getElementById('sidebar2Categories');
    if (!section) return;
    section.innerHTML = '';

    const userDb = loadUserDb();
    if (!userDb.size) return;

    const q = currentQuery.toLowerCase().trim();

    // Group by level-1
    const grouped = new Map();
    userDb.forEach(fn => {
      const l1id = (fn.under && fn.under[0]) || 'other';
      if (!grouped.has(l1id)) grouped.set(l1id, []);
      grouped.get(l1id).push(fn);
    });
    if (!grouped.size) return;

    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'sidebar2-pinned-label';
    sectionLabel.textContent = 'Categories';
    section.appendChild(sectionLabel);

    grouped.forEach((fns, l1id) => {
      const l1     = (typeof FunctionRegistry !== 'undefined') ? FunctionRegistry.getLevel1(l1id) : null;
      const l1Name = l1 ? l1.name : l1id;
      const l1Icon = l1 ? l1.icon : 'folder';

      const visFns = q ? fns.filter(f => f.name.toLowerCase().includes(q)) : fns;
      if (!visFns.length) return;

      const group   = document.createElement('div');
      group.className = 'secondary-sidebar-category-group has-line';

      const header  = document.createElement('button');
      header.type   = 'button';
      header.className = 'secondary-sidebar-category-header';
      header.innerHTML = `
        <span class="secondary-sidebar-left">
          <span class="ic-icon" data-icon="${l1Icon}"></span>
          <span class="secondary-sidebar-label">${escHtml(l1Name)}</span>
        </span>
        <span class="ic-icon secondary-sidebar-chevron" data-icon="expand_more"></span>`;

      const content = document.createElement('div');
      content.className = 'secondary-sidebar-category-content';
      content.setAttribute('aria-hidden', 'true');

      header.addEventListener('click', () => toggleGroupInline(group, content, header));

      group.appendChild(header);
      group.appendChild(content);
      section.appendChild(group);

      visFns.forEach(fn => {
        const item = makeLeafButton(fn.icon, fn.name, fn.onclick, fn.batch, false, fn.id);
        content.appendChild(item);
      });
    });

    // ── FIX 4b: set --vline-left and --line-top so tree-line CSS renders correctly ──
    requestAnimationFrame(() => {
      section.querySelectorAll('.secondary-sidebar-category-group.has-line').forEach(g => {
        const hdr = g.querySelector('.secondary-sidebar-category-header');
        if (!hdr) return;

        // --line-top: header height (where the vertical line should begin)
        const headerH = hdr.offsetHeight;
        g.style.setProperty('--line-top', headerH + 'px');

        // --vline-left: align with icon centre inside .secondary-sidebar-left
        const iconEl = hdr.querySelector('.ic-icon');
        if (iconEl) {
          const groupRect = g.getBoundingClientRect();
          const iconRect  = iconEl.getBoundingClientRect();
          const left = (iconRect.left - groupRect.left) + (iconRect.width / 2);
          g.style.setProperty('--vline-left', Math.round(left) + 'px');
        }
      });
    });
  }

  // ── 6. Grand Functions button ─────────────────────────────────────────────
  function renderGrandFunctionsBtn() {
    const divider = document.createElement('div');
    divider.className = 'sb2-divider';
    cardScroll.appendChild(divider);

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'sb2-grand-btn';
    btn.innerHTML = `
      <span class="ic-icon" data-icon="apps"></span>
      <span class="sb2-grand-btn-text">Grand Functions</span>
      <span class="ic-icon sb2-grand-btn-arrow" data-icon="open_in_full"></span>`;
    btn.addEventListener('click', () => {
      if (window.GrandFunctions) {
        closeSidebar();
        window.GrandFunctions.open();
      }
    });
    cardScroll.appendChild(btn);
  }

  // ── Leaf button factory ───────────────────────────────────────────────────
  // Used for: pinned items, category sub-items (not static top-level items)
  function makeLeafButton(icon, text, onclickJs, batch, isPinnedItem, fnId) {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'secondary-sidebar-sub-item';
    btn.dataset.search = (text || '').toLowerCase();
    if (batch)               btn.dataset.batch = batch;
    if (fnId !== undefined)  btn.dataset.fnId  = fnId;
    if (onclickJs)           btn.setAttribute('onclick', onclickJs);

    const ic = document.createElement('span');
    ic.className = 'ic-icon';
    ic.setAttribute('data-icon', icon);
    btn.appendChild(ic);
    btn.appendChild(document.createTextNode(text));

    // Star pin toggle (only on non-pinned category sub-items)
    if (onclickJs && !isPinnedItem) {
      const pinBtn = document.createElement('span');
      pinBtn.className = 'ic-icon sidebar2-pin-btn' + (isPinned(onclickJs) ? ' pinned' : '');
      pinBtn.setAttribute('data-icon', 'star');
      pinBtn.title = 'Pin / unpin';
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = loadPins();
        const idx  = list.findIndex(p => p.onclick === onclickJs);
        if (idx === -1) list.push({ onclick: onclickJs, icon, text });
        else list.splice(idx, 1);
        localStorage.setItem(PIN_KEY, JSON.stringify(list));
        pinBtn.classList.toggle('pinned', idx === -1);
        buildSidebar2();
      });
      btn.appendChild(pinBtn);
    }
    return btn;
  }

  // ── Inline collapsible toggle ─────────────────────────────────────────────
  function toggleGroupInline(group, content, header) {
    const isOpen = group.classList.contains('open');
    if (isOpen) {
      content.style.height = content.scrollHeight + 'px';
      requestAnimationFrame(() => { content.style.height = '0'; });
      group.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
      content.setAttribute('aria-hidden', 'true');
      setTimeout(() => { content.style.height = ''; }, 350);
    } else {
      group.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      content.setAttribute('aria-hidden', 'false');
      content.style.height = '0';
      requestAnimationFrame(() => { content.style.height = content.scrollHeight + 'px'; });
      setTimeout(() => { content.style.height = 'auto'; }, 350);
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────
  function applySearch(query) {
    const q = query.toLowerCase().trim();

    // Sub-items (pinned + categories)
    cardScroll.querySelectorAll('.secondary-sidebar-sub-item').forEach(item => {
      const name = item.dataset.search || '';
      item.style.display = (!q || name.includes(q)) ? '' : 'none';
    });

    // Hide category groups with no visible children
    cardScroll.querySelectorAll('.secondary-sidebar-category-group').forEach(g => {
      // Static items (no content child) — always visible
      const content = g.querySelector('.secondary-sidebar-category-content');
      if (!content) return;

      const hasVis = Array.from(content.querySelectorAll('.secondary-sidebar-sub-item'))
        .some(i => i.style.display !== 'none');
      g.style.display = hasVis ? '' : 'none';

      // Auto-expand matching groups during search
      if (hasVis && q) {
        content.style.height = 'auto';
        content.removeAttribute('aria-hidden');
        const hdr = g.querySelector('.secondary-sidebar-category-header');
        if (hdr) hdr.setAttribute('aria-expanded', 'true');
        g.classList.add('open');
      }
    });

    // Refresh pinned section (it re-filters internally)
    refreshPinnedSection();
  }

  // ── Escape HTML ───────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ── Public refresh hooks (called by GrandFunctions after pin/add changes) ─
  window.renderSidebar2PinnedSection = () => refreshPinnedSection();
  window.renderSidebar2Categories    = () => {
    const section = document.getElementById('sidebar2Categories');
    refreshCategories(section);
  };

  // ── Initial build ─────────────────────────────────────────────────────────
  buildSidebar2();

  // Expose for bootstrap.js / showHomepage()
  window.closeSidebar2 = closeSidebar;

})();
