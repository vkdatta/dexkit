// ============================================================================
// DexLabs — Undo/redo shim. All real work lives in CodeMirror's native
// history; this file just wires the topbar Undo / Redo buttons to it and
// exposes the per-note API (rebindUndoForNote / clearUndoHistoryForNote)
// that openNote() calls.
//
// CM's history is per-instance, but we maintain a per-note view by saving
// and restoring history on note switch — dexEditor.loadHistoryFor(id, str)
// does the heavy lifting.
// ============================================================================
(function () {
  function whenReady(fn) {
    if (window.dexEditor && window.dexEditor.cm) return fn();
    let tries = 0;
    (function retry() {
      if (window.dexEditor && window.dexEditor.cm) return fn();
      if (tries++ > 250) return;
      setTimeout(retry, 40);
    })();
  }

  window.rebindUndoForNote = function (noteId, content) {
    whenReady(() => window.dexEditor.loadHistoryFor(noteId, content));
  };
  window.clearUndoHistoryForNote = function (noteId) {
    whenReady(() => window.dexEditor.clearHistoryFor(noteId));
  };
  window.performUndo = function () {
    whenReady(() => window.dexEditor.cm.undo());
  };
  window.performRedo = function () {
    whenReady(() => window.dexEditor.cm.redo());
  };
  window.clearUndoHistory = function () {
    whenReady(() => window.dexEditor.cm.clearHistory());
  };
  // Legacy shims — older callers used these names.
  window.recordState = function () {};
  window.serializeUndoHistory = function () {
    if (!window.dexEditor || !window.dexEditor.cm) return null;
    try { return JSON.stringify(window.dexEditor.cm.getHistory()); } catch (e) { return null; }
  };

  // Wire topbar Undo / Redo buttons. Ctrl+Z / Cmd+Z / Ctrl+Y are handled by
  // CodeMirror's default keymap — no keydown listener needed.
  function wireTopbarButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn && !undoBtn.__dexWired) {
      undoBtn.__dexWired = true;
      undoBtn.addEventListener('click', () => window.performUndo());
    }
    if (redoBtn && !redoBtn.__dexWired) {
      redoBtn.__dexWired = true;
      redoBtn.addEventListener('click', () => window.performRedo());
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireTopbarButtons);
  else wireTopbarButtons();
})();
