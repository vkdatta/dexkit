function applyFontSize() {
  noteTextarea.style.fontSize = `${fontSize}px`;
  noteBackdrop.style.fontSize = `${fontSize}px`;
  findBackdrop.style.fontSize = `${fontSize}px`;
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

// Original script applied the current font size immediately on load.
applyFontSize();
