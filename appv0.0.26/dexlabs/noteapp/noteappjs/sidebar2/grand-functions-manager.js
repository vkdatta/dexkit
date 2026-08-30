(function () {
  if (!window.grandFunctions || !window.grandFunctionsUserDb) return;

  let overlay = null;
  let selectedLevel1 = '';

  function refreshIcons(root = document) {
    if (typeof window.replaceIcons === 'function') window.replaceIcons(root);
  }

  function invokeFunction(fn) {
    if (!fn || !fn.action) return;
    let target = window;
    for (const part of fn.action.split('.')) target = target ? target[part] : null;
    if (typeof target === 'function') return target(...(fn.args || []));
  }

  function makeFunctionRow(fn) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'grand-functions-row';
    row.dataset.functionId = fn.id;
    row.innerHTML = '<span class="ic-icon grand-functions-row-icon"></span><span class="grand-functions-row-name"></span><span class="ic-icon grand-functions-row-pin"></span>';
    row.querySelector('.grand-functions-row-icon').dataset.icon = fn.icon;
    row.querySelector('.grand-functions-row-name').textContent = fn.name;

    const pin = row.querySelector('.grand-functions-row-pin');
    const syncPin = () => {
      const pinned = window.grandFunctionsUserDb.has(fn.id);
      pin.dataset.icon = pinned ? 'star' : 'star_border';
      pin.classList.toggle('pinned', pinned);
      pin.title = pinned ? 'Unpin' : 'Pin';
      pin.setAttribute('aria-label', pinned ? `Unpin ${fn.name}` : `Pin ${fn.name}`);
    };

    row.addEventListener('click', e => {
      if (e.target.closest('.grand-functions-row-pin')) return;
      invokeFunction(fn);
    });

    pin.addEventListener('click', e => {
      e.stopPropagation();
      window.grandFunctionsUserDb.has(fn.id)
        ? window.grandFunctionsUserDb.remove(fn.id)
        : window.grandFunctionsUserDb.add(fn.id);
      render();
    });

    syncPin();
    return row;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('section');
    overlay.id = 'grand-functions-overlay';
    overlay.className = 'grand-functions-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <header class="grand-functions-header">
        <div class="grand-functions-heading">
          <span class="ic-icon" data-icon="apps"></span>
          <span>Grand Functions</span>
        </div>
        <div class="grand-functions-header-meta">
          <div class="grand-functions-profile">
            <div class="info-avatar" id="grandFunctionsProfileAvatar"></div>
            <div class="grand-functions-profile-data">
              <div class="info-name" id="infoName">-</div>
              <div class="grand-functions-profile-stats" id="infoStats">Char (ex. Spaces): 0\nChar (in. Spaces): 0\nTotal Words: 0\nReading time: 0m\nFile Size: 0kb</div>
            </div>
          </div>
          <button type="button" class="grand-functions-close" id="grandFunctionsClose" aria-label="Close Grand Functions">
            <span class="ic-icon" data-icon="close"></span>
          </button>
        </div>
      </header>
      <div class="grand-functions-body">
        <nav class="grand-functions-nav" id="grandFunctionsNav" aria-label="Function categories"></nav>
        <main class="grand-functions-main">
          <div class="grand-functions-route" id="grandFunctionsRoute"></div>
          <div class="grand-functions-toolbar">
            <input id="grandFunctionsSearch" class="grand-functions-search" type="search" placeholder="Search grand functions…" autocomplete="off" spellcheck="false" aria-label="Search grand functions" />
            <span class="grand-functions-count" id="grandFunctionsCount"></span>
          </div>
          <div class="grand-functions-list" id="grandFunctionsList"></div>
        </main>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#grandFunctionsClose').addEventListener('click', close);
    overlay.querySelector('#grandFunctionsSearch').addEventListener('input', render);
    syncProfileMetadata();
    refreshIcons(overlay);
  }

  function syncProfileMetadata() {
    if (!overlay) return;
    const avatar = overlay.querySelector('#grandFunctionsProfileAvatar');
    const sourceAvatar = document.querySelector('.secondary-sidebar-footer #infoAvatar');
    if (avatar && sourceAvatar) avatar.innerHTML = sourceAvatar.innerHTML;
  }

  function renderNav() {
    const nav = overlay.querySelector('#grandFunctionsNav');
    nav.innerHTML = '';
    window.grandFunctions.getLevel1().forEach(level => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'grand-functions-level1' + (level.name === selectedLevel1 ? ' active' : '');
      button.innerHTML = '<span class="ic-icon"></span><span class="grand-functions-level1-name"></span>';
      button.querySelector('.ic-icon').dataset.icon = level.icon;
      button.querySelector('.grand-functions-level1-name').textContent = level.name;
      button.addEventListener('click', () => {
        selectedLevel1 = level.name;
        render();
      });
      nav.appendChild(button);
    });
    refreshIcons(nav);
  }

  function render() {
    ensureOverlay();
    if (!selectedLevel1) selectedLevel1 = window.grandFunctions.getLevel1()[0]?.name || '';
    renderNav();

    const query = overlay.querySelector('#grandFunctionsSearch').value.trim().toLowerCase();
    const all = window.grandFunctions.getAll();
    const scoped = all.filter(fn => fn.under[0] === selectedLevel1);
    const source = query
      ? all.filter(fn => `${fn.name} ${fn.under.join(' ')}`.toLowerCase().includes(query))
      : scoped;

    const route = overlay.querySelector('#grandFunctionsRoute');
    const count = overlay.querySelector('#grandFunctionsCount');
    route.textContent = query ? `Search · ${source.length} functions` : selectedLevel1;
    count.textContent = query ? `${source.length} / ${all.length}` : `${source.length}`;

    const list = overlay.querySelector('#grandFunctionsList');
    list.innerHTML = '';

    const groups = new Map();
    source.forEach(fn => {
      const path = fn.under.slice(1).join(' / ') || selectedLevel1;
      if (!groups.has(path)) groups.set(path, []);
      groups.get(path).push(fn);
    });

    groups.forEach((functions, path) => {
      const group = document.createElement('section');
      group.className = 'grand-functions-group';
      const title = document.createElement('div');
      title.className = 'grand-functions-group-title';
      title.textContent = path;
      group.appendChild(title);
      functions.forEach(fn => group.appendChild(makeFunctionRow(fn)));
      list.appendChild(group);
    });

    if (!source.length) {
      const empty = document.createElement('div');
      empty.className = 'grand-functions-empty';
      empty.textContent = query ? 'No functions found' : 'No functions registered';
      list.appendChild(empty);
    }

    syncProfileMetadata();
    refreshIcons(overlay);
  }

  function open() {
    ensureOverlay();
    selectedLevel1 = selectedLevel1 || window.grandFunctions.getLevel1()[0]?.name || '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    render();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('grandfunctions:userdbchange', () => {
    if (overlay?.classList.contains('open')) render();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) {
      e.stopPropagation();
      close();
    }
  });

  window.openGrandFunctions = open;
  window.closeGrandFunctions = close;
})();
