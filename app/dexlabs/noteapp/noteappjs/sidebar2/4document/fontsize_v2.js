// Font-size control. Writes size to CodeMirror's wrapper element and calls
// cm.refresh() so its internal char-width cache updates immediately. Also
// keeps the legacy noteTextarea / noteBackdrop / findBackdrop font-size in
// sync (harmless — those elements are hidden in CM mode — but preserves
// behaviour for any other code that reads them via computed style).
function applyFontSize() {
  const cmEl = document.querySelector('.CodeMirror');
  if (cmEl) {
    cmEl.style.fontSize = fontSize + 'px';
    if (window.dexEditor && window.dexEditor.cm) window.dexEditor.cm.refresh();
  }
  // Publish to :root so Diff 1 / Diff 2 cells (which use var(--user-font-size))
  // resize alongside the editor (v2).
  try { document.documentElement.style.setProperty('--user-font-size', fontSize + 'px'); } catch (e) {}
  try { if (typeof noteTextarea !== 'undefined' && noteTextarea) noteTextarea.style.fontSize = fontSize + 'px'; } catch (e) {}
  try { if (typeof noteBackdrop !== 'undefined' && noteBackdrop) noteBackdrop.style.fontSize = fontSize + 'px'; } catch (e) {}
  try { if (typeof findBackdrop !== 'undefined' && findBackdrop) findBackdrop.style.fontSize = fontSize + 'px'; } catch (e) {}
  localStorage.setItem("fontSize", fontSize);
}

export const increaseFontSize = () => {
  fontSize = Math.min(fontSize + 2, 42);
  applyFontSize();
  showNotification(`Font size increased to ${fontSize}px`);
};

export const decreaseFontSize = () => {
  fontSize = Math.max(fontSize - 2, 10);
  applyFontSize();
  showNotification(`Font size decreased to ${fontSize}px`);
};

// Apply on load. CM may not be mounted yet — the querySelector will just
// no-op if .CodeMirror doesn't exist; editor-adapter.js applies the
// persisted fontSize itself when it mounts, so nothing is lost.
applyFontSize();
