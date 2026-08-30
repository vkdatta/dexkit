(function () {
  const hamburger = document.getElementById('secondary-sidebar-button');
  const overlay = document.getElementById('secondary-sidebar-overlay');
  const sidebar = document.getElementById('secondary-sidebar');
  const card = document.getElementById('secondary-sidebar-card');
  const scroll = document.getElementById('secondary-sidebar-scroll');
  if (!hamburger || !overlay || !sidebar || !card || !scroll || !window.grandFunctions) return;

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  function getTransitionMs() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').trim();
    return Math.round((parseFloat(value) || 0.32) * 1000);
  }

  function refreshIcons(root = document) {
    if (typeof window.replaceIcons === 'function') window.replaceIcons(root);
  }

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    sidebar.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.innerHTML = '<i class="ic-icon" data-icon="close"></i>';
    renderCategories();
    refreshIcons();
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    sidebar.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<i class="ic-icon" data-icon="view_cozy"></i>';
    closeGrandFunctions();
  }

  hamburger.addEventListener('click', e => {
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sidebar.addEventListener('click', e => e.stopPropagation());
  overlay.addEventListener('click', closeSidebar);

  function invokeFunction(fn) {
    if (!fn || !fn.action) return;
    let target = window;
    const parts = fn.action.split('.');
    for (const part of parts) target = target ? target[part] : null;
    if (typeof target === 'function') return target(...(fn.args || []));
    if (fn.action === 'window.openChainPanel' && typeof window.openChainPanel === 'function') return window.openChainPanel();
  }

  function makeFunctionButton(fn, compact = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = compact ? 'sidebar2-function-item sidebar2-compact-function' : 'sidebar2-function-item';
    button.dataset.search = `${fn.name} ${fn.under.join(' ')}`.toLowerCase();
    button.dataset.functionId = fn.id;
    button.innerHTML = `<span class="ic-icon" data-icon="${fn.icon}"></span><span class="sidebar2-function-name"></span><span class="ic-icon sidebar2-pin-btn" data-icon="star" title="Pin / unpin"></span>`;
    button.querySelector('.sidebar2-function-name').textContent = fn.name;
    const pin = button.querySelector('.sidebar2-pin-btn');
    const syncPin = () => {
      const pinned = window.grandFunctionsUserDb.has(fn.id);
      pin.classList.toggle('pinned', pinned);
      pin.setAttribute('data-icon', pinned ? 'star' : 'star_border');
      pin.title = pinned ? 'Unpin' : 'Pin';
    };
    button.addEventListener('click', e => {
      if (e.target.closest('.sidebar2-pin-btn')) return;
      invokeFunction(fn);
    });
    pin.addEventListener('click', e => {
      e.stopPropagation();
      if (window.grandFunctionsUserDb.has(fn.id)) window.grandFunctionsUserDb.remove(fn.id);
      else window.grandFunctionsUserDb.add(fn.id);
      syncPin();
      renderCategories();
      refreshIcons();
    });
    syncPin();
    return button;
  }

  function renderCategories(query = '') {
    const list = document.getElementById('sidebar2CategoryList');
    if (!list) return;
    const q = String(query).trim().toLowerCase();
    const pinned = window.grandFunctionsUserDb.get();
    const visible = pinned.filter(fn => !q || `${fn.name} ${fn.under.join(' ')}`.toLowerCase().includes(q));
    list.innerHTML = '';
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'sidebar2-category-empty';
      empty.textContent = q ? 'No matching pinned functions' : 'No pinned functions';
      list.appendChild(empty);
      return;
    }
    visible.forEach(fn => list.appendChild(makeFunctionButton(fn, true)));
    refreshIcons(list);
  }

  function buildSearch() {
    const host = document.getElementById('sidebar2FunctionSearch');
    if (!host || host.querySelector('#sidebar2Search')) return;
    host.innerHTML = '<input id="sidebar2Search" class="sidebar2-search" type="search" placeholder="Search pinned functions…" autocomplete="off" spellcheck="false">';
    const input = host.querySelector('#sidebar2Search');
    input.addEventListener('input', () => renderCategories(input.value));
  }

  buildSearch();
  document.getElementById('sidebar2GrandButton')?.addEventListener('click', () => {
    if (typeof window.openGrandFunctions === 'function') window.openGrandFunctions();
  });
  renderCategories();

  document.addEventListener('grandfunctions:userdbchange', () => {
    renderCategories(document.getElementById('sidebar2Search')?.value || '');
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (typeof window.closeGrandFunctions === 'function' && document.getElementById('grand-functions-overlay')?.classList.contains('open')) {
      window.closeGrandFunctions();
      e.stopPropagation();
      return;
    }
    if (sidebar.classList.contains('open')) closeSidebar();
  });
})();
