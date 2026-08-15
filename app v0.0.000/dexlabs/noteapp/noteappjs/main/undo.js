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
  window.recordState = function () {};
  window.serializeUndoHistory = function () {
    if (!window.dexEditor || !window.dexEditor.cm) return null;
    try { return JSON.stringify(window.dexEditor.cm.getHistory()); } catch (e) { return null; }
  };

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
