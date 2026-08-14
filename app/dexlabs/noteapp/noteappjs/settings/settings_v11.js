export function createSettingsManager() {
  // Guard: if already initialized, return the existing API (don't create null).
  if (window.settingsInitialized) {
    return window.__settingsManagerAPI || null;
  }

  const LS = {
    LINENUM:   'showLineNumbers',
    PRISM:     'prismEnabled',
    WRAP:      'wrapText',
    THEME:     'appTheme',
    CMTHEME:   'cmTheme',
    DIFFUSION: 'diffusionEnabled'
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
  const ALL_THEMES = new Set([...DARK_THEMES, ...LIGHT_THEMES]);
  const DEFAULT_CM_DARK  = 'dracula';
  const DEFAULT_CM_LIGHT = 'eclipse';

  // ─── Safe localStorage wrappers ─────────────────────────────────
  function lsRead(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsWrite(k, v) {
    try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) {}
  }
  function lsBool(k, def) {
    const v = lsRead(k);
    if (v == null) return !!def;
    return v === '1' || v === 'true';
  }
  function lsSet(k, v) { lsWrite(k, v ? '1' : null); }

  // fire() logs errors in dev for debugging; still non-fatal.
  function fire(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) {
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        console.error('[settings] event dispatch failed:', name, e);
      }
    }
  }

  /* ─── Theme helpers ────────────────────────────────────────────── */
  function currentAppTheme() {
    return lsRead(LS.THEME) === 'light' ? 'light' : 'dark';
  }

  // Return the themes available for the current app theme.
  function themesForAppTheme(theme) {
    return theme === 'light' ? LIGHT_THEMES : DARK_THEMES;
  }

  /* currentCmTheme() — validates stored theme against the APP THEME's
     available list, not just ALL_THEMES. This prevents a stored dark theme
     from being returned when the app is in light mode (and vice versa).  */
  function currentCmTheme() {
    const appTheme = currentAppTheme();
    const available = themesForAppTheme(appTheme);
    const explicit = lsRead(LS.CMTHEME);
    // Only use explicit if it belongs to the current app theme's set.
    if (explicit && available.includes(explicit)) return explicit;
    return (appTheme === 'light' ? DEFAULT_CM_LIGHT : DEFAULT_CM_DARK);
  }

  // Return only the themes that match the current app theme.
  function availableThemesForCurrentAppTheme() {
    return themesForAppTheme(currentAppTheme());
  }

  // Return the default theme for the current app theme.
  function defaultThemeForCurrentAppTheme() {
    return currentAppTheme() === 'light' ? DEFAULT_CM_LIGHT : DEFAULT_CM_DARK;
  }

  /* ─── App theme wiring ───────────────────────────────────────────
     applyTheme ONLY touches data-theme (app-wide light/dark).
     It NEVER touches data-cm-tone — that is managed by the CM theme
     selection path (applyCmToneAttr in editor_v1.js) and by
     reconcileCmThemeWithAppTheme when falling back to defaults.  */
  function applyTheme(theme) {
    const html = document.documentElement;
    if (!html) return;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  }

  // Apply persisted app theme immediately on init.
  applyTheme(lsRead(LS.THEME) === 'light' ? 'light' : 'dark');

  // Named listener so it can be removed on destroy.
  function onDexSettingsChanged(e) {
    if (!e || !e.detail) return;
    const k = e.detail.key;
    if (k === LS.THEME) {
      applyTheme(e.detail.value === 'light' ? 'light' : 'dark');
      // When app theme changes, ensure CM theme matches the available set.
      reconcileCmThemeWithAppTheme();
      paint();
    }
    if (k === LS.LINENUM) {
      applyLineNumbersToEditor(!!e.detail.value);
      paint();
    }
    if (k === LS.WRAP) {
      applyWrapToEditor(!!e.detail.value);
      paint();
    }
    if (k === LS.PRISM) {
      applyPrismToEditor(!!e.detail.value);
      paint();
    }
    if (k === LS.CMTHEME) {
      applyCmThemeToEditor(e.detail.value);
      paint();
    }
    if (k === LS.DIFFUSION) {
      applyDiffusionToApp(!!e.detail.value);
      paint();
    }
  }
  window.addEventListener('dexSettingsChanged', onDexSettingsChanged);

  /* ─── Immediate runtime application helpers ──────────────────────
     These bridge persisted settings → the live CodeMirror instance.
     They are idempotent: safe to call any time, even before CM mounts.  */

  function applyLineNumbersToEditor(on) {
    if (window.dexEditor && typeof window.dexEditor.setLineNumbers === 'function') {
      try { window.dexEditor.setLineNumbers(!!on); } catch (e) {}
    }
  }

  function applyWrapToEditor(on) {
    if (window.dexEditor && typeof window.dexEditor.setWrap === 'function') {
      try { window.dexEditor.setWrap(!!on); } catch (e) {}
    }
  }

  function applyPrismToEditor(on) {
    if (window.dexEditor && typeof window.dexEditor.applyLanguageForCurrentNote === 'function') {
      try { window.dexEditor.applyLanguageForCurrentNote(); } catch (e) {}
    }
    document.body.classList.toggle('prism-off', !on);
  }

  function applyCmThemeToEditor(name) {
    if (!name) return;
    if (window.dexEditor && typeof window.dexEditor.setTheme === 'function') {
      try { window.dexEditor.setTheme(name); } catch (e) {}
    }
  }

  function applyDiffusionToApp(on) {
    if (on) {
      if (typeof window.enterDiffusionMode === 'function') {
        try { window.enterDiffusionMode(); } catch (e) {}
      }
    } else {
      if (typeof window.exitDiffusionMode === 'function') {
        try { window.exitDiffusionMode(); } catch (e) {}
      }
    }
  }

  /* ─── Reconcile CM theme with app theme ──────────────────────────
     If the user switches app light/dark and the current CM theme is
     from the "wrong" list (e.g. a dark theme while app is light),
     auto-switch to the default for the new app theme.

     This also syncs data-cm-tone to match the new default.  */
  function reconcileCmThemeWithAppTheme() {
    const appTheme = currentAppTheme();
    const cmTheme = currentCmTheme();
    const available = themesForAppTheme(appTheme);
    const html = document.documentElement;

    // If current CM theme is not in the available set for this app theme,
    // switch to the default and update storage.
    if (!available.includes(cmTheme)) {
      const fallback = appTheme === 'light' ? DEFAULT_CM_LIGHT : DEFAULT_CM_DARK;
      lsWrite(LS.CMTHEME, fallback);
      applyCmThemeToEditor(fallback);
      if (html) html.setAttribute('data-cm-tone', appTheme);
      fire('dexSettingsChanged', { key: LS.CMTHEME, value: fallback });
    }
  }

  /* ─── Bulk restore: apply all persisted settings to live editor ──
     Called once at init (if editor already mounted) and again on
     dexEditorReady in case editor mounted later than this manager.  */
  function restoreAllSettingsToEditor() {
    applyLineNumbersToEditor(lsBool(LS.LINENUM));
    applyWrapToEditor(lsBool(LS.WRAP));
    applyPrismToEditor(lsBool(LS.PRISM));
    // Reconcile first: ensures stored CM theme matches current app theme.
    reconcileCmThemeWithAppTheme();
    const cmTheme = currentCmTheme();
    applyCmThemeToEditor(cmTheme);
    if (lsBool(LS.DIFFUSION)) {
      applyDiffusionToApp(true);
    }
  }

  // Attempt immediate restore; if editor isn't ready yet, dexEditorReady catches it.
  restoreAllSettingsToEditor();
  window.addEventListener('dexEditorReady', restoreAllSettingsToEditor);

  /* ─── Styles ───────────────────────────────────────────────────── */
  function ensureSettingsStyles() {
    if (document.getElementById('settings-overlay-styles')) return;
    const link = document.createElement('link');
    link.id   = 'settings-overlay-styles';
    link.rel  = 'stylesheet';
    link.href = 'settings4.css';
    if (document.head) document.head.appendChild(link);
    else if (document.documentElement) document.documentElement.appendChild(link);
  }
  ensureSettingsStyles();
  if (!document.getElementById('terminal-styles')) {
    const link = document.createElement('link');
    link.id = 'terminal-styles';
    link.rel = 'stylesheet';
    link.href = 'terminal.css';
    if (document.head) document.head.appendChild(link);
    else if (document.documentElement) document.documentElement.appendChild(link);
  }

  /* ─── DOM ──────────────────────────────────────────────────────── */
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
      <div class="settings-tab-panel active" data-panel="common">
        <div class="settings-section">
          <div class="settings-section-title">Syntax</div>
          <div class="settings-item" data-key="CMTHEME" id="cmThemeRow">
            <div class="settings-item-text">
              <div class="settings-item-label">Editor theme</div>
              <div class="settings-item-desc">CodeMirror colour scheme. Editor background stays uniform.</div>
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
  if (document.body) document.body.appendChild(overlay);
  else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { if (document.body) document.body.appendChild(overlay); });
    }
  }

  // Tab switching
  const tabListeners = [];
  overlay.querySelectorAll('.settings-tab').forEach(tab => {
    const fn = () => {
      const target = tab.getAttribute('data-tab');
      overlay.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t === tab));
      overlay.querySelectorAll('.settings-tab-panel').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-panel') === target);
      });
    };
    tab.addEventListener('click', fn);
    tabListeners.push({ el: tab, fn });
  });

  // Close button
  const closeBtn = overlay.querySelector('#settingsclose');
  const onCloseClick = () => { overlay.style.display = 'none'; };
  closeBtn.addEventListener('click', onCloseClick);

  // Escape key — named so it can be removed on destroy.
  function onKeydown(e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') overlay.style.display = 'none';
  }
  document.addEventListener('keydown', onKeydown);

  /* ─── paint() ────────────────────────────────────────────────────
     Syncs the settings UI to reflect ACTUAL runtime state where
     possible, falling back to persisted state.  */
  function paint() {
    overlay.querySelectorAll('.settings-item').forEach(item => {
      const key = item.getAttribute('data-key');
      if (key === 'CMTHEME') return;

      let on = false;
      if (key === 'THEME') {
        on = currentAppTheme() === 'light';
      } else if (key === 'LINENUM' && window.dexEditor && window.dexEditor.cm) {
        on = !!window.dexEditor.cm.getOption('lineNumbers');
      } else if (key === 'WRAP' && window.dexEditor && window.dexEditor.cm) {
        on = !!window.dexEditor.cm.getOption('lineWrapping');
      } else if (key === 'PRISM') {
        on = lsBool(LS.PRISM);
      } else if (key === 'DIFFUSION') {
        on = lsBool(LS.DIFFUSION);
      } else {
        on = lsBool(LS[key]);
      }
      item.classList.toggle('on', on);
    });

    const cur = overlay.querySelector('#cmThemeCurrent');
    if (cur) {
      let displayed = currentCmTheme();
      if (window.dexEditor && window.dexEditor.cm) {
        const actualTheme = window.dexEditor.cm.getOption('theme');
        if (actualTheme) displayed = actualTheme;
      }
      cur.textContent = displayed;
    }
  }

  /* ─── Theme picker: scoped event delegation, FILTERED by app theme ─
     Only themes matching the current app theme are shown.  */
  function makeThemePickerHtml(current) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const themes = availableThemesForCurrentAppTheme();
    const buildRows = (arr) => arr.map(t => {
      const active = (t === current);
      return `<button class="theme-pick${active ? ' theme-pick-active' : ''}" data-theme="${esc(t)}">${esc(t)}</button>`;
    }).join('');
    return `
      <div id="theme-picker-container">
        ${buildRows(themes)}
      </div>
    `;
  }

  async function openThemeModal() {
    if (typeof window.showModal !== 'function') {
      console.warn('[settings] showModal not available; cannot open theme picker');
      return;
    }
    const cur = currentCmTheme();
    const bodyHtml = makeThemePickerHtml(cur);

    const prevDisplay = overlay.style.display;
    overlay.style.display = 'none';
    let r = null;

    function onThemePick(e) {
      const btn = e.target.closest('.theme-pick');
      if (!btn) return;
      const theme = btn.getAttribute('data-theme');
      if (!theme) return;
      e.stopPropagation();
      if (typeof window.closeModal === 'function') {
        window.closeModal({ action: 'submit', theme });
      }
    }
    document.addEventListener('click', onThemePick, true);

    try {
      r = await window.showModal({
        header: `<div class="modal-title">Editor theme</div>`,
        body: bodyHtml,
        footer: `<button id="theme-picker-cancel">Cancel</button>`,
        html: true
      });
    } finally {
      document.removeEventListener('click', onThemePick, true);
      if (overlay.style.display === 'none') {
        overlay.style.display = prevDisplay;
      }
    }
    if (!r || r.action !== 'submit' || !r.theme) return;

    const chosen = String(r.theme).trim();
    if (!ALL_THEMES.has(chosen)) {
      console.warn('[settings] Ignoring unknown theme:', chosen);
      return;
    }

    lsWrite(LS.CMTHEME, chosen);
    applyCmThemeToEditor(chosen);
    fire('dexSettingsChanged', { key: LS.CMTHEME, value: chosen });
    paint();
  }

  /* ─── Click handler ──────────────────────────────────────────────
     Every path now:
       1. Persists the setting
       2. Applies it immediately to the live editor/app
       3. Fires the event for other components
       4. Re-paints the UI  */
  function onOverlayClick(e) {
    const item = e.target.closest('.settings-item');
    if (!item) return;
    const key = item.getAttribute('data-key');

    if (key === 'CMTHEME') {
      openThemeModal();
      return;
    }

    if (key === 'DIFFUSION') {
      const cur = lsBool(LS.DIFFUSION);
      const next = !cur;
      if (next) {
        if (typeof window.enterDiffusionMode !== 'function') {
          console.warn('[settings] enterDiffusionMode not available');
          return;
        }
        try { window.enterDiffusionMode(); } catch (e) {
          console.error('[settings] enterDiffusionMode failed:', e);
          return;
        }
        lsSet(LS.DIFFUSION, true);
        fire('dexSettingsChanged', { key: LS.DIFFUSION, value: true });
      } else {
        if (typeof window.exitDiffusionMode !== 'function') {
          console.warn('[settings] exitDiffusionMode not available');
          return;
        }
        try { window.exitDiffusionMode(); } catch (e) {
          console.error('[settings] exitDiffusionMode failed:', e);
          return;
        }
        lsSet(LS.DIFFUSION, false);
        fire('dexSettingsChanged', { key: LS.DIFFUSION, value: false });
      }

    } else if (key === 'THEME') {
      const cur = currentAppTheme();
      const next = cur === 'light' ? 'dark' : 'light';
      if (next === 'dark') lsWrite(LS.THEME, null);
      else lsWrite(LS.THEME, 'light');
      applyTheme(next);
      // reconcileCmThemeWithAppTheme() is called by the event listener above
      fire('dexSettingsChanged', { key: LS.THEME, value: next });

    } else if (key === 'LINENUM') {
      const cur = lsBool(LS.LINENUM);
      const next = !cur;
      lsSet(LS.LINENUM, next);
      applyLineNumbersToEditor(next);
      fire('dexSettingsChanged', { key: LS.LINENUM, value: next });

    } else if (key === 'WRAP') {
      const cur = lsBool(LS.WRAP);
      const next = !cur;
      lsSet(LS.WRAP, next);
      applyWrapToEditor(next);
      fire('dexSettingsChanged', { key: LS.WRAP, value: next });

    } else if (key === 'PRISM') {
      const cur = lsBool(LS.PRISM);
      const next = !cur;
      lsSet(LS.PRISM, next);
      applyPrismToEditor(next);
      fire('dexSettingsChanged', { key: LS.PRISM, value: next });
    }

    paint();
  }
  overlay.addEventListener('click', onOverlayClick);

  /* ─── Destroy / cleanup lifecycle ──────────────────────────────── */
  function destroy() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    window.removeEventListener('dexSettingsChanged', onDexSettingsChanged);
    window.removeEventListener('dexEditorReady', restoreAllSettingsToEditor);
    document.removeEventListener('keydown', onKeydown);
    overlay.removeEventListener('click', onOverlayClick);
    tabListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    closeBtn.removeEventListener('click', onCloseClick);
    window.settingsInitialized = false;
    window.__settingsManagerAPI = null;
  }

  /* ─── Public API ───────────────────────────────────────────────── */
  const api = {
    hide: () => { overlay.style.display = 'none'; },
    show: () => { overlay.style.display = 'flex'; paint(); },
    destroy,
    paint,
    restoreAllSettingsToEditor
  };
  window.__settingsManagerAPI = api;

  // Mark as initialized only after everything succeeded.
  window.settingsInitialized = true;

  return function openSettingsManager() {
    paint();
    overlay.style.display = 'flex';
    return api;
  };
}
