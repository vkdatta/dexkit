/**
 * DexLabs Sidebar 2 — Revamped
 * ─────────────────────────────────────────────────────────────────────────────
 * No static function HTML in index.html.
 * Everything is driven by FunctionRegistry + GrandFunctions.
 *
 * Structure inside the sidebar card — matches OG sidebar order:
 *   1. Search bar              ← top (restored to OG position)
 *   2. Quick-action grid       (font-size, clipboard)
 *   3. Static items            (Settings, Rename, Download) — top-level style
 *   4. Categories              (functions added to userDb from GF)
 *   5. [Grand Functions]       → opens GrandFunctions overlay
 *
 * Fixes vs. broken version:
 *   - FIX 1: Search moved back to top (OG: insertSearchAndPinnedUI ran first)
 *   - FIX 2: Pins section removed entirely (never existed in OG sidebar)
 *   - FIX 3: Static item headers get paddingLeft: 12px (OG depth-0 indent)
 *   - FIX 4: Category headers get paddingLeft: 12px (depth-0 indent)
 *   - FIX 5: Sub-items get paddingLeft: 32px (depth-1: 12 + 20)
 *   - FIX 6: --vline-left hardcoded to 19px (OG formula: totalLeft + 7 = 19)
 *            instead of rAF getBoundingClientRect which fires too late
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

  // ── UserDb loader ─────────────────────────────────────────────────────────
  function loadUserDb() {
    try { return new Map(JSON.parse(localStorage.getItem('dexGfUserDb') || '[]')); }
    catch (e) { return new Map(); }
  }

  // ── Search state ──────────────────────────────────────────────────────────
  let currentQuery = '';

  // ── Build entire sidebar card ─────────────────────────────────────────────
  // FIX 1: Search is rendered FIRST, matching the OG insertSearchAndPinnedUI
  //        call which prepended search to cardScroll before buildTopLevel ran.
  function buildSidebar2() {
    cardScroll.innerHTML = '';
    renderSearchBar();         // 1  search — top (OG position)
    renderQuickActions();      // 2  font-size + clipboard grid
    renderStaticItems();       // 3  Settings / Rename / Download — top-level style
    renderCategories();        // 4  userDb additions grouped by L1
    renderGrandFunctionsBtn(); // 5  Grand Functions launch row
  }

  // ── 1. Search ─────────────────────────────────────────────────────────────
  function renderSearchBar() {
    const wrap = document.createElement('div');
    wrap.className = 'sb2-search-wrap';

    const input = document.createElement('input');
    input.type         = 'text';
    input.id           = 'sidebar2Search';
    input.className    = 'sidebar2-search';
    input.placeholder  = 'Search functions…';
    input.autocomplete = 'off';
    input.spellcheck   = false;
    input.value        = currentQuery;

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

  // ── 3. Static items ───────────────────────────────────────────────────────
  // FIX 3: paddingLeft: 12px matches OG depth-0 indent
  //        (baseLeft=12, depth=0, so totalLeft=12).
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
      btn.type              = 'button';
      btn.className         = 'secondary-sidebar-category-header';
      btn.style.paddingLeft = '12px'; // FIX 3
      btn.setAttribute('onclick', it.onclick);

      const left = document.createElement('span');
      left.className = 'secondary-sidebar-left';

      const ic = document.createElement('span');
      ic.className = 'ic-icon';
      ic.setAttribute('data-icon', it.icon);

      const label = document.createElement('span');
      label.className   = 'secondary-sidebar-label';
      label.textContent = it.text;

      left.append(ic, label);
      btn.appendChild(left);
      // No chevron — non-collapse items
      group.appendChild(btn);
      cardScroll.appendChild(group);
    });
  }

  // ── 4. Categories (from userDb) ───────────────────────────────────────────
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

    grouped.forEach((fns, l1id) => {
      const l1     = (typeof FunctionRegistry !== 'undefined') ? FunctionRegistry.getLevel1(l1id) : null;
      const l1Name = l1 ? l1.name : l1id;
      const l1Icon = l1 ? l1.icon : 'folder';

      const visFns = q ? fns.filter(f => f.name.toLowerCase().includes(q)) : fns;
      if (!visFns.length) return;

      // FIX 4 + 6: depth-0 header → paddingLeft 12px; vline-left = 12+7 = 19px
      const group = document.createElement('div');
      group.className = 'secondary-sidebar-category-group has-line';
      group.style.setProperty('--vline-left', '19px'); // FIX 6: OG formula, set immediately

      const header = document.createElement('button');
      header.type              = 'button';
      header.className         = 'secondary-sidebar-category-header';
      header.style.paddingLeft = '12px'; // FIX 4
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

      // FIX 5: depth-1 sub-items → paddingLeft = 12 + 20 = 32px
      visFns.forEach(fn => {
        content.appendChild(makeLeafButton(fn.icon, fn.name, fn.onclick, fn.batch, fn.id, 32));
      });
    });

    // Set --line-top after layout (header height only — vline-left already set above)
    requestAnimationFrame(() => {
      section.querySelectorAll('.secondary-sidebar-category-group.has-line').forEach(g => {
        const hdr = g.querySelector('.secondary-sidebar-category-header');
        if (hdr) g.style.setProperty('--line-top', hdr.offsetHeight + 'px');
      });
    });
  }

  // ── 5. Grand Functions button ─────────────────────────────────────────────
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
  // Used for category sub-items only (no pin buttons — pins removed).
  // indentPx: inline paddingLeft override for correct tree depth alignment.
  function makeLeafButton(icon, text, onclickJs, batch, fnId, indentPx) {
    const btn = document.createElement('button');
    btn.type           = 'button';
    btn.className      = 'secondary-sidebar-sub-item';
    btn.dataset.search = (text || '').toLowerCase();
    if (batch !== undefined && batch !== null) btn.dataset.batch = batch;
    if (fnId  !== undefined)                  btn.dataset.fnId  = fnId;
    if (onclickJs)    btn.setAttribute('onclick', onclickJs);
    if (indentPx !== undefined) btn.style.paddingLeft = indentPx + 'px';

    const ic = document.createElement('span');
    ic.className = 'ic-icon';
    ic.setAttribute('data-icon', icon);
    btn.appendChild(ic);
    btn.appendChild(document.createTextNode(text));

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

    // Filter sub-items
    cardScroll.querySelectorAll('.secondary-sidebar-sub-item').forEach(item => {
      const name = item.dataset.search || '';
      item.style.display = (!q || name.includes(q)) ? '' : 'none';
    });

    // Show/hide category groups; auto-expand matching ones during search
    cardScroll.querySelectorAll('.secondary-sidebar-category-group').forEach(g => {
      const content = g.querySelector('.secondary-sidebar-category-content');
      if (!content) return; // static items — always visible, no content child

      const hasVis = Array.from(content.querySelectorAll('.secondary-sidebar-sub-item'))
        .some(i => i.style.display !== 'none');
      g.style.display = hasVis ? '' : 'none';

      if (hasVis && q) {
        content.style.height = 'auto';
        content.removeAttribute('aria-hidden');
        const hdr = g.querySelector('.secondary-sidebar-category-header');
        if (hdr) hdr.setAttribute('aria-expanded', 'true');
        g.classList.add('open');
      }
    });
  }

  // ── Escape HTML ───────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ── Public refresh hooks (called by GrandFunctions after add/remove) ──────
  window.renderSidebar2Categories = () => {
    const section = document.getElementById('sidebar2Categories');
    refreshCategories(section);
  };

  // ── Initial build ─────────────────────────────────────────────────────────
  buildSidebar2();

  // Expose for bootstrap.js / showHomepage()
  window.closeSidebar2 = closeSidebar;

})();
