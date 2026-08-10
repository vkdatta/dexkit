(function () {
  const DEFAULTS = {
    maxEntries: 50,
    powerWindowMs: 3000,
    coalesceMs: 500,
    memoryBudgetBytes: 200000,
    persistKey: "myapp_undo_data_v5",
    persistTTL: 864e5,
    imeDebounce: 50
  };
  function approxBytes(e) {
    try {
      return new Blob([JSON.stringify(e)]).size;
    } catch (t) {
      return JSON.stringify(e).length;
    }
  }
  function now() {
    return Date.now();
  }
  function shallowEqual(e, t) {
    return (
      e && t && e.value === t.value && e.start === t.start && e.end === t.end
    );
  }
  function clamp(e, t, n) {
    return Math.max(t, Math.min(n, e));
  }
  function getSelectionState(e) {
    if (!e) return { start: 0, end: 0, dir: "forward" };
    try {
      return {
        start: e.selectionStart || 0,
        end: e.selectionEnd || 0,
        dir: e.selectionDirection || "forward"
      };
    } catch (t) {
      return { start: 0, end: 0, dir: "forward" };
    }
  }
  function restoreSelectionState(e, t) {
    if (!e || !t) return;
    try {
      e.setSelectionRange(t.start, t.end, t.dir);
    } catch (n) {}
  }
  function snapshot(e) {
    return { value: e.value, ...getSelectionState(e), ts: now() };
  }
  function diffIsSmall(e, t) {
    if (!e || !t) return false;
    const n = e.value || "",
      r = t.value || "";
    if (Math.abs(n.length - r.length) > 5) return false;
    let i = 0;
    for (let o = 0, a = 0; o < n.length || a < r.length; ) {
      if (n[o] !== r[a]) {
        i++;
        if (i > 2) return false;
        o++;
        a++;
      } else {
        o++;
        a++;
      }
    }
    return true;
  }
  class HistoryManager {
    constructor(e, t) {
      this.opts = Object.assign({}, DEFAULTS, t || {});
      this.maxEntries = this.opts.maxEntries;
      this.powerWindowMs = this.opts.powerWindowMs;
      this.coalesceMs = this.opts.coalesceMs;
      this.persistKey = this.opts.persistKey;
      this.persistTTL = this.opts.persistTTL;
      this.imeDebounce = this.opts.imeDebounce;
      this.target = null;
      this._onInput = this._onInput.bind(this);
      this._onCutPaste = this._onCutPaste.bind(this);
      this._onKeydown = this._onKeydown.bind(this);
      this._onCompositionStart = this._onCompositionStart.bind(this);
      this._onCompositionEnd = this._onCompositionEnd.bind(this);
      this._observer = null;
      this._composition = false;
      this._coalesceTimer = null;
      this._undo = [];
      this._redo = [];
      this._suppress = false;
      this._wrapped = {};
      this._lastUndoClick = 0;
      this._lastRedoClick = 0;
      this._undoPower = 1;
      this._redoPower = 1;
      if (e) this.init(e);
    }
    init(e) {
      if (!e || "TEXTAREA" !== e.tagName.toUpperCase())
        throw new Error("target must be textarea");
      this.destroy();
      this.target = e;
      this._loadPersist();
      this._installListeners();
      this._wrapProgrammatics();
      this._commitInitial();
    }
    destroy() {
      this._uninstallListeners();
      this._unwrapProgrammatics();
      this._disconnectObserver();
      this._undo = [];
      this._redo = [];
      this.target = null;
      this._suppress = false;
    }
    performUndo() {
      if (!this.target) return;
      if (this._undo.length <= 1) {
        this._notify("Nothing to undo");
        return;
      }
      let e = Math.min(this._undoPower, this._undo.length - 1);
      this._suppress = true;
      for (let t = 0; t < e; t++) {
        let e = this._undo.pop();
        this._redo.push(e);
      }
      let t = this._undo[this._undo.length - 1];
      t && this._applyFrame(t);
      this._suppress = false;
      this._notify(`Undo performed (${e} step(s))`);
      this._persist();
    }
    performRedo() {
      if (!this.target) return;
      if (this._redo.length === 0) {
        this._notify("Nothing to redo");
        return;
      }
      let e = Math.min(this._redoPower, this._redo.length);
      this._suppress = true;
      for (let t = 0; t < e; t++) {
        let e = this._redo.pop();
        this._undo.push(e);
      }
      let t = this._undo[this._undo.length - 1];
      t && this._applyFrame(t);
      this._suppress = false;
      this._notify(`Redo performed (${e} step(s))`);
      this._persist();
    }
    clear() {
      this._undo = [];
      this._redo = [];
      this._persist();
    }
    recordNow(e) {
      if (!this.target) return;
      this._commitImmediate(e || "manual");
    }
    serialize() {
      return JSON.stringify({ undo: this._undo, redo: this._redo, ts: now() });
    }
    deserialize(e) {
      try {
        const t = typeof e === "string" ? JSON.parse(e) : e;
        this._undo = t.undo || [];
        this._redo = t.redo || [];
        this._trim();
        this._persist();
        return true;
      } catch (n) {
        return false;
      }
    }
    _notify(e) {
      try {
        showNotification && showNotification(e);
      } catch (t) {
        console.log(e);
      }
    }
    _applyFrame(e) {
      if (!this.target) return;
      this._suppress = true;
      this.target.value = e.value;
      restoreSelectionState(this.target, e);
      if (currentNote) currentNote.content = e.value;
      if (typeof updateNoteMetadata === "function") updateNoteMetadata();
      this._suppress = false;
    }
    _createFrame(e) {
      return {
        value: e.value,
        start: e.start,
        end: e.end,
        dir: e.dir,
        ts: e.ts
      };
    }
    _undoPush(e) {
      if (
        this._undo.length &&
        shallowEqual(this._undo[this._undo.length - 1], e)
      )
        return;
      this._undo.push(e);
      this._trim();
      this._persist();
    }
    _redoPush(e) {
      if (
        this._redo.length &&
        shallowEqual(this._redo[this._redo.length - 1], e)
      )
        return;
      this._redo.push(e);
      this._trim();
      this._persist();
    }
    _trim() {
      const e = this.maxEntries;
      while (this._undo.length > e) this._undo.shift();
      while (this._redo.length > e) this._redo.shift();
      if (this.opts.memoryBudgetBytes) {
        let t = approxBytes({ undo: this._undo, redo: this._redo });
        while (t > this.opts.memoryBudgetBytes && this._undo.length > 1) {
          this._undo.shift();
          t = approxBytes({ undo: this._undo, redo: this._redo });
        }
      }
    }
    _persist() {
      try {
        localStorage.setItem(
          this.persistKey,
          JSON.stringify({
            undo: this._undo,
            redo: this._redo,
            expires: now() + this.persistTTL
          })
        );
      } catch (e) {}
    }
    _loadPersist() {
      try {
        const e = localStorage.getItem(this.persistKey);
        if (!e) return;
        const t = JSON.parse(e);
        if (t.expires && t.expires > now()) {
          this._undo = (t.undo || []).slice(-this.maxEntries);
          this._redo = (t.redo || []).slice(-this.maxEntries);
        }
      } catch (n) {}
    }
    _commitInitial() {
      if (!this.target) return;
      const e = snapshot(this.target);
      this._undo = [this._createFrame(e)];
      this._redo = [];
      this._persist();
    }
    _installListeners() {
      if (!this.target) return;
      this.target.addEventListener("input", this._onInput);
      this.target.addEventListener("paste", this._onCutPaste);
      this.target.addEventListener("cut", this._onCutPaste);
      this.target.addEventListener("keydown", this._onKeydown);
      this.target.addEventListener(
        "compositionstart",
        this._onCompositionStart
      );
      this.target.addEventListener("compositionend", this._onCompositionEnd);
      this._observer = new MutationObserver(() => {
        if (this._suppress) return;
        this._scheduleCommit();
      });
      this._observer.observe(this.target, {
        characterData: true,
        childList: true,
        subtree: true
      });
      if (undoBtn)
        undoBtn.addEventListener("click", () => {
          const e = now();
          if (e - this._lastUndoClick <= this.powerWindowMs) {
            this._undoPower = clamp(this._undoPower + 1, 1, this.maxEntries);
          } else {
            this._undoPower = 1;
          }
          this._lastUndoClick = e;
          this._redoPower = 1;
          this._lastRedoClick = 0;
          this.performUndo();
        });
      if (redoBtn)
        redoBtn.addEventListener("click", () => {
          const e = now();
          if (e - this._lastRedoClick <= this.powerWindowMs) {
            this._redoPower = clamp(this._redoPower + 1, 1, this.maxEntries);
          } else {
            this._redoPower = 1;
          }
          this._lastRedoClick = e;
          this._undoPower = 1;
          this._lastUndoClick = 0;
          this.performRedo();
        });
    }
    _uninstallListeners() {
      if (!this.target) return;
      try {
        this.target.removeEventListener("input", this._onInput);
        this.target.removeEventListener("paste", this._onCutPaste);
        this.target.removeEventListener("cut", this._onCutPaste);
        this.target.removeEventListener("keydown", this._onKeydown);
        this.target.removeEventListener(
          "compositionstart",
          this._onCompositionStart
        );
        this.target.removeEventListener(
          "compositionend",
          this._onCompositionEnd
        );
      } catch (e) {}
      this._disconnectObserver();
      if (undoBtn) undoBtn.removeEventListener("click", this.performUndo);
      if (redoBtn) redoBtn.removeEventListener("click", this.performRedo);
    }
    _disconnectObserver() {
      if (this._observer) {
        try {
          this._observer.disconnect();
        } catch (e) {}
        this._observer = null;
      }
    }
    _onInput(e) {
      if (this._suppress) return;
      if (this._composition) return this._scheduleCommit();
      this._scheduleCommit();
    }
    _onCutPaste(e) {
      if (this._suppress) return;
      this._scheduleCommit(0);
    }
    _onKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" || e.key === "Z") {
          if (e.shiftKey) {
            e.preventDefault();
            this.performRedo();
          } else {
            e.preventDefault();
            this.performUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          this.performRedo();
        }
      }
    }
    _onCompositionStart() {
      this._composition = true;
    }
    _onCompositionEnd() {
      this._composition = false;
      setTimeout(() => {
        this._scheduleCommit(0);
      }, this.imeDebounce);
    }
    _scheduleCommit(e) {
      clearTimeout(this._coalesceTimer);
      if (e === 0) {
        this._commitImmediate("immediate");
        return;
      }
      this._coalesceTimer = setTimeout(() => {
        this._commitImmediate("coalesced");
      }, this.coalesceMs);
    }
    _commitImmediate(e) {
      clearTimeout(this._coalesceTimer);
      if (!this.target) return;
      const t = snapshot(this.target);
      if (this._suppress) return;
      const n = this._undo[this._undo.length - 1];
      if (n && shallowEqual(n, t)) return;
      if (
        n &&
        diffIsSmall(n, t) &&
        now() - n.ts < this.coalesceMs &&
        !this._composition
      ) {
        this._undo[this._undo.length - 1] = this._createFrame(t);
        this._undo[this._undo.length - 1].ts = now();
      } else {
        this._undoPush(this._createFrame(t));
      }
      this._redo = [];
      this._persist();
    }
    _wrapProgrammatics() {
      if (!this.target) return;
      const e = this.target,
        t = this;
      try {
        if (!e.__undov_value_wrapped) {
          const n =
            Object.getOwnPropertyDescriptor(e, "value") ||
            Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype,
              "value"
            );
          const r =
            n.get ||
            function () {
              return this.value;
            };
          const i =
            n.set ||
            function (e) {
              this.value = e;
            };
          Object.defineProperty(e, "value", {
            configurable: true,
            enumerable: n.enumerable,
            get: function () {
              return r.call(this);
            },
            set: function (e) {
              if (t._suppress) return i.call(this, e);
              i.call(this, e);
              t.recordNow("setter");
            }
          });
          e.__undov_value_wrapped = true;
          this._wrapped.value = true;
        }
      } catch (n) {}
      try {
        if (
          typeof e.setRangeText === "function" &&
          !e.__undov_setRangeText_wrapped
        ) {
          const n = e.setRangeText;
          e.setRangeText = function () {
            if (t._suppress) return n.apply(this, arguments);
            const e = snapshot(this);
            const r = n.apply(this, arguments);
            t.recordNow("setRangeText");
            return r;
          };
          e.__undov_setRangeText_wrapped = true;
          this._wrapped.setRangeText = true;
        }
      } catch (n) {}
    }
    _unwrapProgrammatics() {
      const e = this.target;
      try {
        if (e && e.__undov_value_wrapped) delete e.__undov_value_wrapped;
        if (e && e.__undov_setRangeText_wrapped)
          delete e.__undov_setRangeText_wrapped;
      } catch (t) {}
    }
  }
  function autoWire() {
    const e =
      document.getElementById("noteTextarea") ||
      document.querySelector("textarea");
    if (!e) return null;
    window.__HistoryManagerInstance &&
      window.__HistoryManagerInstance.destroy();
    window.__HistoryManagerInstance = new HistoryManager(e);
    window.performUndo = () => window.__HistoryManagerInstance.performUndo();
    window.performRedo = () => window.__HistoryManagerInstance.performRedo();
    window.clearUndoHistory = () => window.__HistoryManagerInstance.clear();
    window.recordState = (e) => window.__HistoryManagerInstance.recordNow(e);
    window.serializeUndoHistory = () =>
      window.__HistoryManagerInstance.serialize();
    window.deserializeUndoHistory = (e) =>
      window.__HistoryManagerInstance.deserialize(e);
    return window.__HistoryManagerInstance;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoWire, { once: true });
  } else {
    setTimeout(autoWire, 0);
  }
  window.HistoryManager = HistoryManager;
})();
