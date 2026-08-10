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

  // All CM5 themes shipped at cdnjs. Ordered alphabetically within light/dark
  // groups so the picker feels navigable. Each theme value is the string CM
  // expects in `cm.setOption('theme', ...)`; the CSS filename is <value>.min.css
  // *except* for "solarized dark" / "solarized light" which both use solarized.
  const CM_THEMES = [
    { group: 'Dark', values: [
      '3024-night','abbott','abcdef','ambiance','ayu-dark','ayu-mirage','base16-dark',
      'bespin','blackboard','cobalt','colorforth','darcula','dracula','duotone-dark',
      'erlang-dark','gruvbox-dark','hopscotch','icecoder','isotope','juejin','lesser-dark',
      'liquibyte','lucario','material','material-darker','material-ocean','material-palenight',
      'mbo','midnight','monokai','moxer','night','nord','oceanic-next','panda-syntax',
      'paraiso-dark','pastel-on-dark','railscasts','rubyblue','seti','shadowfox',
      'solarized dark','the-matrix','tomorrow-night-bright','tomorrow-night-eighties',
      'twilight','vibrant-ink','xq-dark','yonce','zenburn'
    ]},
    { group: 'Light', values: [
      '3024-day','base16-light','duotone-light','eclipse','elegant','idea','mdn-like',
      'neat','neo','paraiso-light','solarized light','ssms','ttcn','xq-light','yeti'
    ]}
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
    #settingsbody { flex:1; overflow:auto; padding:24px 18px 32px; max-width:640px; width:100%; margin:0 auto; }
    .settings-section { margin-bottom:32px; }
    .settings-section-title { font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:#888; margin-bottom:14px; padding-left:2px; }
    .settings-section-hint { font-size:11.5px; color:#666; margin:-8px 0 14px; padding-left:2px; }
    .settings-item { display:flex; align-items:center; justify-content:space-between; padding:16px 16px; background:#0e0e12; border:1px solid #1e1e26; border-radius:10px; margin-bottom:10px; cursor:pointer; user-select:none; transition:background .15s ease, border-color .15s ease; }
    .settings-item:hover { background:#14141a; border-color:#2a2a34; }
    .settings-item-text { flex:1; }
    .settings-item-label { font-size:14px; color:#e8e8ec; margin-bottom:3px; }
    .settings-item-desc { font-size:12px; color:#7a7a82; line-height:1.5; }
    .settings-toggle { width:44px; height:24px; border-radius:12px; background:#26262e; border:1px solid #33333c; position:relative; flex-shrink:0; transition:background .18s ease, border-color .18s ease; margin-left:16px; }
    .settings-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#8a8a94; transition:transform .18s ease, background .18s ease; }
    .settings-item.on .settings-toggle { background:#9ab0ff; border-color:#9ab0ff; }
    .settings-item.on .settings-toggle::after { transform:translateX(20px); background:#0c0c0e; }
    .settings-picker { display:flex; flex-direction:column; padding:16px; background:#0e0e12; border:1px solid #1e1e26; border-radius:10px; margin-bottom:10px; }
    .settings-picker-label { font-size:14px; color:#e8e8ec; margin-bottom:4px; }
    .settings-picker-desc { font-size:12px; color:#7a7a82; line-height:1.5; margin-bottom:10px; }
    .settings-picker select { background:#171720; color:#e8e8ec; border:1px solid #2a2a34; padding:9px 10px; font-family:inherit; font-size:13px; border-radius:8px; width:100%; -webkit-appearance:none; appearance:none; }
    .settings-picker select:focus { outline:2px solid #9ab0ff; outline-offset:1px; }
    .settings-footnote { font-size:11px; color:#55555c; text-align:center; margin-top:16px; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'settingsoverlay';
  overlay.style.display = 'none';

  // Build CM theme <option>s.
  let themeOptions = '';
  CM_THEMES.forEach(g => {
    themeOptions += `<optgroup label="${g.group}">`;
    g.values.forEach(v => { themeOptions += `<option value="${v}">${v}</option>`; });
    themeOptions += `</optgroup>`;
  });

  overlay.innerHTML = `
    <div id="settingsheader">
      <div id="settingstitle">Settings</div>
      <button id="settingsclose">Close</button>
    </div>
    <div id="settingsbody">
      <div class="settings-section">
        <div class="settings-section-title">Common</div>
        <div class="settings-section-hint">Any combination can be enabled.</div>

        <div class="settings-item" data-key="LINENUM">
          <div class="settings-item-text">
            <div class="settings-item-label">Show line numbers</div>
            <div class="settings-item-desc">Renders a native CodeMirror gutter beside the editor.</div>
          </div>
          <div class="settings-toggle" aria-hidden="true"></div>
        </div>

        <div class="settings-item" data-key="PRISM">
          <div class="settings-item-text">
            <div class="settings-item-label">Enable syntax highlighting</div>
            <div class="settings-item-desc">Colors code based on the note's file extension. When off, notes render as plain text.</div>
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

        <div class="settings-item" data-key="THEME">
          <div class="settings-item-text">
            <div class="settings-item-label">Light theme</div>
            <div class="settings-item-desc">Switches the app between dark (default) and light appearance. Editor theme adjusts automatically if you haven't picked one.</div>
          </div>
          <div class="settings-toggle" aria-hidden="true"></div>
        </div>

        <div class="settings-picker">
          <div class="settings-picker-label">Editor theme</div>
          <div class="settings-picker-desc">CodeMirror colour scheme for syntax highlighting. Editor background stays your app primary regardless of choice.</div>
          <select id="cmThemePicker">${themeOptions}</select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Exclusive</div>
        <div class="settings-section-hint">Only one exclusive mode can be active.</div>

        <div class="settings-item" data-key="DIFFUSION">
          <div class="settings-item-text">
            <div class="settings-item-label">Enable Diffusion algorithm</div>
            <div class="settings-item-desc">Adds Raw / Morph / Diff 1 / Diff 2 / Options to a bottom bar. Raw is seeded from the current note; Morph is chosen via the file picker.</div>
          </div>
          <div class="settings-toggle" aria-hidden="true"></div>
        </div>
      </div>

      <div class="settings-footnote">Changes save automatically.</div>
    </div>
  `;
  document.body.appendChild(overlay);

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
      let on = false;
      if (key === 'THEME') on = currentAppTheme() === 'light';
      else on = lsBool(LS[key]);
      item.classList.toggle('on', on);
    });
    const sel = overlay.querySelector('#cmThemePicker');
    if (sel) sel.value = currentCmTheme();
  }

  // Toggle handlers.
  overlay.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-item');
    if (!item) return;
    const key = item.getAttribute('data-key');

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

  // CM theme picker.
  const themeSel = overlay.querySelector('#cmThemePicker');
  if (themeSel) {
    themeSel.addEventListener('change', () => {
      const v = themeSel.value;
      localStorage.setItem(LS.CMTHEME, v);
      fire('dexSettingsChanged', { key: LS.CMTHEME, value: v });
    });
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
