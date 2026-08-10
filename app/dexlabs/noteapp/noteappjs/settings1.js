// ============================================================================
// DexLabs — Settings manager. Opened from sidebar2 → "Settings".
//
// Full-screen overlay in the style of debug.js. Two sections:
//
//   Common Settings (multi-select checkboxes):
//     - Show line numbers
//     - Enable Prism highlighting
//
//   Exclusive Settings (only one can be active at a time):
//     - Enable Diffusion algorithm
//
// Toggling "Enable Diffusion algorithm" calls window.enterDiffusionMode() or
// exitDiffusionMode() from mode.js. Toggling line-numbers / prism toggles
// their respective LS keys and dispatches a 'dexSettingsChanged' event so
// prism.js and the line-number renderer can react.
// ============================================================================
export function createSettingsManager() {
  if (window.settingsInitialized) return null;
  window.settingsInitialized = true;

  const LS = {
    LINENUM: 'showLineNumbers',
    PRISM:   'prismEnabled',
    DIFFUSION: 'diffusionEnabled'
  };

  function lsBool(k, def) {
    const v = localStorage.getItem(k);
    if (v == null) return !!def;
    return v === '1' || v === 'true';
  }
  function lsSet(k, v) { if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); }
  function fire(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {} }

  // ----- Styles ------------------------------------------------------------
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
    .settings-footnote { font-size:11px; color:#55555c; text-align:center; margin-top:16px; }
  `;
  document.head.appendChild(style);

  // ----- Overlay DOM -------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.id = 'settingsoverlay';
  overlay.style.display = 'none';
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
            <div class="settings-item-desc">Renders a gutter beside the editor. Merges line-number behaviour between note and diffusion modes.</div>
          </div>
          <div class="settings-toggle" aria-hidden="true"></div>
        </div>
        <div class="settings-item" data-key="PRISM">
          <div class="settings-item-text">
            <div class="settings-item-label">Enable syntax highlighting</div>
            <div class="settings-item-desc">CodeMirror syntax highlighting driven by each note's file extension. When off, notes render as plain text.</div>
          </div>
          <div class="settings-toggle" aria-hidden="true"></div>
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

  function paint() {
    overlay.querySelectorAll('.settings-item').forEach(item => {
      const key = item.getAttribute('data-key');
      const on = lsBool(LS[key]);
      item.classList.toggle('on', on);
    });
  }

  // Toggle handlers.
  overlay.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-item');
    if (!item) return;
    const key = item.getAttribute('data-key');
    const cur = lsBool(LS[key]);
    const next = !cur;

    if (key === 'DIFFUSION') {
      // Exclusive: enter/exit diffusion.
      if (next) {
        lsSet(LS.DIFFUSION, true);
        if (typeof window.enterDiffusionMode === 'function') window.enterDiffusionMode();
      } else {
        lsSet(LS.DIFFUSION, false);
        if (typeof window.exitDiffusionMode === 'function') window.exitDiffusionMode();
      }
    } else {
      lsSet(LS[key], next);
      fire('dexSettingsChanged', { key: LS[key], value: next });
    }
    paint();
  });

  return function openSettingsManager() {
    paint();
    overlay.style.display = 'flex';
    return {
      hide: () => { overlay.style.display = 'none'; },
      show: () => { overlay.style.display = 'flex'; paint(); }
    };
  };
}
