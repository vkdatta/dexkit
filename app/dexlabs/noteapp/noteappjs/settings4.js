// ============================================================================
// DexLabs — Settings manager v2.
//
// Opened from sidebar2 → "Settings". Full-screen overlay in the style of
// debug.js.
//
//   Common (multi-select checkboxes):
//     - Show line numbers
//     - Enable syntax highlighting
//     - Wrap text
//     - Light theme                          ← v2
//
//   CM Theme picker (v2):
//     - Dropdown of every theme shipped with CM5.
//
//   Exclusive:
//     - Enable Diffusion algorithm
//
// Toggles persist to localStorage and fire a 'dexSettingsChanged' event so
// editor-adapter / mode.js / fontsize.js can react without a page reload.
// ============================================================================
export function createSettingsManager() {
  if (window.settingsInitialized) return null;
  window.settingsInitialized = true;

  const LS = {
    LINENUM:  'showLineNumbers',
    PRISM:    'prismEnabled',
    WRAP:     'wrapText',
    THEME:    'appTheme',       // 'light' | 'dark'
    CMTHEME:  'cmTheme',        // e.g. 'dracula', 'monokai'
    DIFFUSION:'diffusionEnabled'
  };

  // All CM5 themes shipped at cdnjs, split by tone. The tone drives (a) the
  // grouped picker display and (b) the editor/gutter background overrides
  // — dark themes force #000/#272727, light themes force #cacaca/#ffffff
  // (see index.html [data-cm-tone] rules).
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

  const style = document.createElement('style');
  style.id = 'settings-overlay-styles';
  style.textContent = `
    #settingsoverlay { position:fixed; inset:0; background:rgba(0,0,0,0.96); color:#e0e0e0; z-index:99999; display:flex; flex-direction:column; font-family:'classy', sans-serif; -webkit-font-smoothing:antialiased; box-sizing:border-box; }
    #settingsheader { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #222; background:#050505; }
    #settingstitle { font-weight:600; font-size:14px; color:#fff; letter-spacing:0.3px; }
    #settingsclose { background:none; border:1px solid #444; color:#fff; padding:6px 12px; cursor:pointer; font-size:13px; border-radius:4px; font-family:inherit; }
    #settingsbody { flex:1; overflow:auto; padding:20px 18px 32px; max-width:640px; width:100%; margin:0 auto; }

    /* Top-level Common/Exclusive tabs */
    .settings-tabs { display:flex; gap:0; margin-bottom:22px; border-bottom:1px solid #1e1e26; user-select:none; }
    .settings-tab { flex:1; background:transparent; border:none; padding:12px 16px; color:#7a7a82; cursor:pointer; font-family:inherit; font-size:13.5px; border-bottom:2px solid transparent; margin-bottom:-1px; letter-spacing:0.3px; transition:color .15s ease, border-color .15s ease; }
    .settings-tab:hover { color:#c8c8d0; }
    .settings-tab.active { color:#fff; border-bottom-color:#9ab0ff; }
    .settings-tab-panel { display:none; }
    .settings-tab-panel.active { display:block; }

    .settings-section { margin-bottom:28px; }
    .settings-section-title { font-size:11px; text-transform:uppercase; letter-spacing:1.8px; color:#666; margin-bottom:12px; padding-left:2px; }
    .settings-section-hint { font-size:11.5px; color:#666; margin:-6px 0 12px; padding-left:2px; }

    .settings-item { display:flex; align-items:center; justify-content:space-between; padding:16px 16px; background:#0e0e12; border:1px solid #1e1e26; border-radius:10px; margin-bottom:10px; cursor:pointer; user-select:none; transition:background .15s ease, border-color .15s ease; }
    .settings-item:hover { background:#14141a; border-color:#2a2a34; }
    .settings-item-text { flex:1; }
    .settings-item-label { font-size:14px; color:#e8e8ec; margin-bottom:3px; }
    .settings-item-desc { font-size:12px; color:#7a7a82; line-height:1.5; }
    .settings-toggle { width:44px; height:24px; border-radius:12px; background:#26262e; border:1px solid #33333c; position:relative; flex-shrink:0; transition:background .18s ease, border-color .18s ease; margin-left:16px; }
    .settings-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#8a8a94; transition:transform .18s ease, background .18s ease; }
    .settings-item.on .settings-toggle { background:#9ab0ff; border-color:#9ab0ff; }
    .settings-item.on .settings-toggle::after { transform:translateX(20px); background:#0c0c0e; }
    .settings-row-value { font-size:12px; color:#9ab0ff; white-space:nowrap; margin-left:16px; font-family:'Source Code Pro', monospace; }
    .settings-row-chevron { color:#55555c; font-size:20px; line-height:1; margin-left:8px; }
    .settings-footnote { font-size:11px; color:#55555c; text-align:center; margin-top:16px; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'settingsoverlay';
  overlay.style.display = 'none';

  // Build the overlay markup. The CM theme picker is a clickable row that
  // opens the app's own modal (showModal) — matches the site's styling
  // instead of the browser's native <select>.
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

  // Tab switching.
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
      // Skip the theme row — its toggle style doesn't apply.
      if (key === 'CMTHEME') return;
      let on = false;
      if (key === 'THEME') on = currentAppTheme() === 'light';
      else on = lsBool(LS[key]);
      item.classList.toggle('on', on);
    });
    const cur = overlay.querySelector('#cmThemeCurrent');
    if (cur) cur.textContent = currentCmTheme();
  }

  // Toggle / picker handlers.
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
      fire('dexSettingsChanged', { key: LS.THEME, value: next });
    } else {
      const cur = lsBool(LS[key]);
      const next = !cur;
      lsSet(LS[key], next);
      fire('dexSettingsChanged', { key: LS[key], value: next });
    }
    paint();
  });

  // ── Editor-theme modal picker ─────────────────────────────────────────────
  // Uses the app's own showModal utility (loaded via modal4.js). We hide the
  // settings overlay while the modal is open to avoid stacking-context glitches,
  // and restore it when the modal resolves.
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
      <style>
        .theme-pick { display:block; width:100%; text-align:left; padding:10px 12px;
          background:transparent; color:var(--color, #e8e8ec);
          border:1px solid var(--border, #2a2a34); border-radius:8px;
          font-family:'Source Code Pro', monospace; font-size:13px;
          cursor:pointer; margin-bottom:6px; }
        .theme-pick:hover { background:var(--matte, #14141a); }
        .theme-pick-active { background:#1f2a3a; color:#fff; border-color:#3854a0; }
        .theme-group-title { font-size:11px; text-transform:uppercase;
          letter-spacing:1.5px; color:#888; margin:8px 0 6px; padding-left:2px; }
      </style>
      <div style="display:flex;flex-direction:column;max-height:60vh;overflow:auto;padding-right:4px;">
        <div class="theme-group-title">Dark</div>
        ${buildRows(DARK_THEMES)}
        <div class="theme-group-title" style="margin-top:12px;">Light</div>
        ${buildRows(LIGHT_THEMES)}
      </div>
    `;
    // Hide settings overlay while the modal is open — prevents same-z-index
    // stacking issues where the settings overlay could otherwise cover the modal.
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
