// ============================================================================
// DexLabs — Custom editor toolbar (v1).
//
// Two purposes:
//   1. Replace the browser's native long-press popup (Cut/Copy/Paste) in the
//      editor with our own, styled to match the app.
//   2. Live as a persistent navigation drawer pinned to the top-right of the
//      screen — a chevron sticks out when closed, the full toolbar slides
//      in when opened. Contents: Copy, Paste (extendable later).
//
// Persistence rule: opening from either entry point (long-press or the
// chevron tab) shows the same drawer. It STAYS open across any editor
// activity (typing, tapping, scrolling) until the user explicitly clicks
// the chevron to close it. No outside-click auto-close.
//
// Icons: material-symbols-rounded glyphs (already loaded elsewhere in the
// app). Kept as strings here so the icon set is defined in one place and
// easy to swap for SVGs later if needed.
// ============================================================================
(function () {
  'use strict';
  if (window.__dexToolbarLoaded) return;
  window.__dexToolbarLoaded = true;

  // ── icons (kept in one place so they're trivial to replace with SVG) ──
  const ICONS = {
    toggle:      'chevron_left',
    toggleOpen:  'chevron_right',
    copy:        'content_copy',
    paste:       'content_paste',
    cut:         'content_cut',       // reserved for future
    selectAll:   'select_all'         // reserved for future
  };

  // ── stylesheet ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'dex-toolbar-styles';
  style.textContent = `
    #dexToolbar {
      position: fixed;
      top: calc(var(--topbar-height, 60px) + 2vh + 8px);
      right: 0;
      z-index: 9998;
      display: flex;
      align-items: stretch;
      transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
      pointer-events: none;
      transform: translateX(calc(100% - 38px));
    }
    #dexToolbar.open { transform: translateX(0); }

    #dexToolbarToggle {
      background: var(--matte, #181C1F);
      border: 1px solid var(--border, rgba(255,255,255,0.06));
      border-right: none;
      color: var(--color, #cacaca);
      width: 38px;
      height: 44px;
      cursor: pointer;
      border-radius: 10px 0 0 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      padding: 0;
      font-family: 'classy', sans-serif;
    }
    #dexToolbarToggle > * { pointer-events: none; }
    #dexToolbarToggle .material-symbols-rounded { font-size: 22px; }

    #dexToolbarContent {
      background: var(--matte, #181C1F);
      border: 1px solid var(--border, rgba(255,255,255,0.06));
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      pointer-events: auto;
      box-shadow: -8px 4px 20px rgba(0,0,0,0.5);
    }

    .dex-toolbar-btn {
      background: transparent;
      border: none;
      color: var(--color, #cacaca);
      min-width: 52px;
      height: 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 8px;
      font-family: 'classy', sans-serif;
      font-size: 10px;
      gap: 1px;
      padding: 0 4px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    .dex-toolbar-btn > * { pointer-events: none; }
    .dex-toolbar-btn:hover, .dex-toolbar-btn:active {
      background: rgba(255,255,255,0.06);
    }
    .dex-toolbar-btn .material-symbols-rounded {
      font-size: 20px;
      color: var(--color, #cacaca);
    }

    /* Suppress the browser's default long-press callout on the CM editor so
       our custom toolbar is the only one that appears. */
    .CodeMirror {
      -webkit-touch-callout: none;
    }

    @media (max-width: 480px) {
      .dex-toolbar-btn { min-width: 44px; font-size: 9px; }
      #dexToolbar { top: calc(var(--topbar-height, 60px) + 1vh); }
    }
  `;
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.id = 'dexToolbar';
  toolbar.innerHTML =
    '<button type="button" id="dexToolbarToggle" aria-label="Toggle toolbar">' +
      '<span class="material-symbols-rounded" id="dexToolbarChevron">' + ICONS.toggle + '</span>' +
    '</button>' +
    '<div id="dexToolbarContent">' +
      '<button type="button" class="dex-toolbar-btn" id="dexToolbarCopy" aria-label="Copy">' +
        '<span class="material-symbols-rounded">' + ICONS.copy + '</span>' +
        '<span>Copy</span>' +
      '</button>' +
      '<button type="button" class="dex-toolbar-btn" id="dexToolbarPaste" aria-label="Paste">' +
        '<span class="material-symbols-rounded">' + ICONS.paste + '</span>' +
        '<span>Paste</span>' +
      '</button>' +
    '</div>';
  document.body.appendChild(toolbar);

  const chevron = document.getElementById('dexToolbarChevron');
  const toggleBtn = document.getElementById('dexToolbarToggle');
  const copyBtn = document.getElementById('dexToolbarCopy');
  const pasteBtn = document.getElementById('dexToolbarPaste');

  // ── open/close ────────────────────────────────────────────────────────────
  function isOpen() { return toolbar.classList.contains('open'); }
  function openToolbar() {
    toolbar.classList.add('open');
    chevron.textContent = ICONS.toggleOpen;
  }
  function closeToolbar() {
    toolbar.classList.remove('open');
    chevron.textContent = ICONS.toggle;
  }
  function toggleToolbar() { isOpen() ? closeToolbar() : openToolbar(); }

  // Deliberately NO document-wide click listener — the drawer persists across
  // any user activity in the editor. Only the chevron button toggles it.
  toggleBtn.addEventListener('click', toggleToolbar);

  window.dexOpenToolbar  = openToolbar;
  window.dexCloseToolbar = closeToolbar;
  window.dexToggleToolbar = toggleToolbar;

  // ── Copy handler ─────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    const ed = window.dexEditor;
    if (!ed) { notify('Editor not ready'); return; }
    let text = '';
    try {
      const sel = ed.getSelection ? ed.getSelection() : null;
      text = (sel && sel.text) ? sel.text : (ed.getValue ? ed.getValue() : '');
    } catch (e) {}
    if (!text) { notify('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard');
    } catch (err) {
      // Fallback: create a temporary textarea and use execCommand.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        notify('Copied to clipboard');
      } catch (e2) {
        notify('Copy failed — grant clipboard permission');
      }
    }
  });

  // ── Paste handler ────────────────────────────────────────────────────────
  pasteBtn.addEventListener('click', async () => {
    const ed = window.dexEditor;
    if (!ed) { notify('Editor not ready'); return; }
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      notify('Paste blocked — allow clipboard permission');
      return;
    }
    if (!text) return;
    try {
      if (ed.replaceSelection) ed.replaceSelection(text);
      else if (ed.insertAt && ed.getSelection) {
        const s = ed.getSelection();
        ed.insertAt(s ? s.start : 0, text);
      }
      if (ed.focus) ed.focus();
      notify('Pasted');
    } catch (e) {
      notify('Paste failed');
    }
  });

  function notify(msg) {
    if (typeof showNotification === 'function') showNotification(msg);
  }

  // ── Long-press hook on the CM editor ─────────────────────────────────────
  // Mobile browsers fire `contextmenu` on long-press. Intercept it, prevent
  // the browser's own callout, and open our drawer instead. This also
  // handles desktop right-click.
  function attachLongPressHook() {
    const cmEl = document.querySelector('.CodeMirror');
    if (!cmEl) { setTimeout(attachLongPressHook, 200); return; }
    if (cmEl.__dexToolbarHooked) return;
    cmEl.__dexToolbarHooked = true;
    cmEl.addEventListener('contextmenu', (e) => {
      // If the user long-presses in the editor to summon a menu, show ours.
      e.preventDefault();
      openToolbar();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachLongPressHook, { once: true });
  } else {
    attachLongPressHook();
  }
})();
