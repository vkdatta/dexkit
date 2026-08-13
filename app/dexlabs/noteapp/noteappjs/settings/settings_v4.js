export function createSettingsManager() {
  if (window.settingsInitialized) return null;
  window.settingsInitialized = true;
  const LS = {
    LINENUM:  'showLineNumbers',
    PRISM:    'prismEnabled',
    WRAP:     'wrapText',
    THEME:    'appTheme',
    CMTHEME:  'cmTheme',
    DIFFUSION:'diffusionEnabled'
  };
  const DARK_THEMES = [
    '3024-night','abbott','abcdef','ambiance','ayu-dark','ayu-mirage','base16-dark',
    'bespin','blackboard','cobalt','colorforth','darcula','dracula','duotone-dark',
    'erlang-dark','gruvbox-dark','hopscotch','icecoder','isotope','juejin','lesser-dark',
    'liquibyte','lucario','material','material-darker','material-ocean','material-palenight',
    'mbo','midnight','monokai','moxer','night','nord','oceanic-next','panda-syntax',
    'paraiso-dark','pastel-on-dark','railscasts','rubyblue','seti','shadowfox',
    'solarized dark','the-matrix','tomorrow-night-bright','tomorrow-night-eighties',
    'twilight','vibrant-ink','xq-dark','yonce','zenburn'
  ];
  const LIGHT_THEMES = [
    '3024-day','base16-light','duotone-light','eclipse','elegant','idea','mdn-like',
    'neat','neo','paraiso-light','solarized light','ssms','ttcn','xq-light','yeti'
  ];
  const DEFAULT_CM_DARK  = 'dracula';
  const DEFAULT_CM_LIGHT = 'eclipse';
  function lsBool(k, def) {
    const v = localStorage.getItem(k);
    if (v == null) return !!def;
    return v === '1' || v === 'true';
  }
  function lsSet(k, v) { if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); }
  function fire(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {} }

  /* ─── Theme wiring ───────────────────────────────────────────────
     Applies the light/dark theme by toggling html[data-theme="light"],
     which is what main_v2.css keys its light palette off of.
     Also syncs html[data-cm-tone] so editor backgrounds flip automatically.
     Called on init (to restore last choice) and on every toggle. */
  function applyTheme(theme) {
    const html = document.documentElement;
    if (!html) return;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      html.setAttribute('data-cm-tone', 'light');
    } else {
      html.removeAttribute('data-theme');
      html.setAttribute('data-cm-tone', 'dark');
    }
  }
  // Apply on init so a page load respects the persisted choice without a refresh loop.
  applyTheme(localStorage.getItem(LS.THEME) === 'light' ? 'light' : 'dark');
  // Also react to the same event we fire ourselves — lets external code
  // change the theme by dispatching dexSettingsChanged { key:'appTheme', value:'light'|'dark' }.
  window.addEventListener('dexSettingsChanged', (e) => {
    if (!e || !e.detail || e.detail.key !== LS.THEME) return;
    applyTheme(e.detail.value === 'light' ? 'light' : 'dark');
  });

  function ensureSettingsStyles() {
    if (document.getElementById('settings-overlay-styles')) return;
    const link = document.createElement('link');
    link.id   = 'settings-overlay-styles';
    link.rel  = 'stylesheet';
    link.href = 'settings4.css';
    document.head.appendChild(link);
  }
  ensureSettingsStyles();
  if (!document.getElementById('terminal-styles')) {
    const link = document.createElement('link');
    link.id = 'terminal-styles';
    link.rel = 'stylesheet';
    link.href = 'terminal.css';
    document.head.appendChild(link);
  }

  const overlay = document.createElement('div');
  overlay.id = 'settingsoverlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div id="settingsheader">
      <div id="settingstitle">Settings</div>
      <button id="settingsclose">Close</button>
    </div>
    <div id="settingsbody">
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="common" type="button">Common</button>
        <button class="settings-tab" data-tab="exclusive" type="button">Exclusive</button>
      </div>
      <!-- ═══ COMMON TAB ═══ -->
      <div class="settings-tab-panel active" data-panel="common">
        <div class="settings-section">
          <div class="settings-section-title">Syntax</div>
          <div class="settings-item" data-key="CMTHEME" id="cmThemeRow">
            <div class="settings-item-text">
              <div class="settings-item-label">Editor theme</div>
              <div class="settings-item-desc">CodeMirror colour scheme. Editor background stays uniform (#000 for dark themes, #cacaca for light).</div>
            </div>
            <div class="settings-row-value" id="cmThemeCurrent">dracula</div>
            <div class="settings-row-chevron">›</div>
          </div>
          <div class="settings-item" data-key="PRISM">
            <div class="settings-item-text">
              <div class="settings-item-label">Enable syntax highlighting</div>
              <div class="settings-item-desc">Colors code based on the note's file extension. When off, notes render as plain text.</div>
            </div>
            <div class="settings-toggle" aria-hidden="true"></div>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Text</div>
          <div class="settings-item" data-key="LINENUM">
            <div class="settings-item-text">
              <div class="settings-item-label">Show line numbers</div>
              <div class="settings-item-desc">Renders a native CodeMirror gutter beside the editor.</div>
            </div>
            <div class="settings-toggle" aria-hidden="true"></div>
          </div>
          <div class="settings-item" data-key="WRAP">
            <div class="settings-item-text">
              <div class="settings-item-label">Wrap text</div>
              <div class="settings-item-desc">When off, long lines scroll horizontally (best for code). When on, lines wrap to the viewport (best for prose).</div>
            </div>
            <div class="settings-toggle" aria-hidden="true"></div>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Theme</div>
          <div class="settings-item" data-key="THEME">
            <div class="settings-item-text">
              <div class="settings-item-label">Light theme</div>
              <div class="settings-item-desc">Switches the app between dark (default) and light appearance. Editor theme adjusts automatically if you haven't picked one.</div>
            </div>
            <div class="settings-toggle" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <!-- ═══ EXCLUSIVE TAB ═══ -->
      <div class="settings-tab-panel" data-panel="exclusive">
        <div class="settings-section">
          <div class="settings-section-hint">Only one exclusive mode can be active.</div>
          <div class="settings-item" data-key="DIFFUSION">
            <div class="settings-item-text">
              <div class="settings-item-label">Enable Diffusion algorithm</div>
              <div class="settings-item-desc">Adds Raw / Morph / Diff 1 / Diff 2 / Options to a bottom bar. Raw is seeded from the current note; Morph is chosen via the file picker.</div>
            </div>
            <div class="settings-toggle" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <div class="settings-footnote">Changes save automatically.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      overlay.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t === tab));
      overlay.querySelectorAll('.settings-tab-panel').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-panel') === target);
      });
    });
  });
  const closeBtn = overlay.querySelector('#settingsclose');
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') overlay.style.display = 'none';
  });
  function currentAppTheme() { return localStorage.getItem(LS.THEME) === 'light' ? 'light' : 'dark'; }
  function currentCmTheme() {
    return localStorage.getItem(LS.CMTHEME) || (currentAppTheme() === 'light' ? DEFAULT_CM_LIGHT : DEFAULT_CM_DARK);
  }
  function paint() {
    overlay.querySelectorAll('.settings-item').forEach(item => {
      const key = item.getAttribute('data-key');
      if (key === 'CMTHEME') return;
      let on = false;
      if (key === 'THEME') on = currentAppTheme() === 'light';
      else on = lsBool(LS[key]);
      item.classList.toggle('on', on);
    });
    const cur = overlay.querySelector('#cmThemeCurrent');
    if (cur) cur.textContent = currentCmTheme();
  }
  overlay.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-item');
    if (!item) return;
    const key = item.getAttribute('data-key');
    if (key === 'CMTHEME') { openThemeModal(); return; }
    if (key === 'DIFFUSION') {
      const cur = lsBool(LS.DIFFUSION);
      const next = !cur;
      if (next) {
        lsSet(LS.DIFFUSION, true);
        if (typeof window.enterDiffusionMode === 'function') window.enterDiffusionMode();
      } else {
        lsSet(LS.DIFFUSION, false);
        if (typeof window.exitDiffusionMode === 'function') window.exitDiffusionMode();
      }
    } else if (key === 'THEME') {
      const cur = currentAppTheme();
      const next = cur === 'light' ? 'dark' : 'light';
      if (next === 'dark') localStorage.removeItem(LS.THEME);
      else localStorage.setItem(LS.THEME, 'light');
      applyTheme(next);                 // <-- actually flip html[data-theme] + html[data-cm-tone]
      fire('dexSettingsChanged', { key: LS.THEME, value: next });
    } else {
      const cur = lsBool(LS[key]);
      const next = !cur;
      lsSet(LS[key], next);
      fire('dexSettingsChanged', { key: LS[key], value: next });
    }
    paint();
  });
  window.__selectCmTheme = function (name) {
    if (typeof window.closeModal === 'function') {
      window.closeModal({ action: 'submit', theme: name });
    }
  };
  async function openThemeModal() {
    if (typeof window.showModal !== 'function') {
      console.warn('[settings] showModal not available; cannot open theme picker');
      return;
    }
    const cur = currentCmTheme();
    const esc = s => String(s).replace(/'/g, "\\'");
    const buildRows = (arr) => arr.map(t => {
      const active = (t === cur);
      return `<button class="theme-pick${active ? ' theme-pick-active' : ''}" onclick="__selectCmTheme('${esc(t)}')">${t}</button>`;
    }).join('');
    const bodyHtml = `
      <div>
        <div class="theme-group-title">Dark</div>
        ${buildRows(DARK_THEMES)}
        <div class="theme-group-title">Light</div>
        ${buildRows(LIGHT_THEMES)}
      </div>
    `;
    const prevDisplay = overlay.style.display;
    overlay.style.display = 'none';
    let r = null;
    try {
      r = await window.showModal({
        header: `<div class="modal-title">Editor theme</div>`,
        body: bodyHtml,
        footer: `<button onclick="closeModal()">Cancel</button>`,
        html: true
      });
    } finally {
      overlay.style.display = prevDisplay;
    }
    if (!r || r.action !== 'submit' || !r.theme) return;
    localStorage.setItem(LS.CMTHEME, r.theme);
    fire('dexSettingsChanged', { key: LS.CMTHEME, value: r.theme });
    paint();
  }
  return function openSettingsManager() {
    paint();
    overlay.style.display = 'flex';
    return {
      hide: () => { overlay.style.display = 'none'; },
      show: () => { overlay.style.display = 'flex'; paint(); }
    };
  };
}
