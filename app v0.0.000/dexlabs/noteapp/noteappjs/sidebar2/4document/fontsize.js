function applyFontSize() {
  const cmEl = document.querySelector('.CodeMirror');
  if (cmEl) {
    cmEl.style.fontSize = fontSize + 'px';
    if (window.dexEditor && window.dexEditor.cm) window.dexEditor.cm.refresh();
  }
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

applyFontSize();
