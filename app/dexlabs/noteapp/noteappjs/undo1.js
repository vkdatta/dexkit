// ============================================================================
// DexLabs — Undo/redo history (per-note).
//
// One HistoryManager is bound to #noteTextarea. Undo stacks are kept per
// note-id in an in-memory Map and persisted as a single blob under
// 'myapp_undo_by_note_v1'. On openNote(id), call window.rebindUndoForNote(
// id, content) — it stashes the outgoing note's stacks, loads the incoming
// note's stacks (or creates a fresh single-frame stack), and applies the
// content to the textarea with recording suppressed.
//
// Legacy single-key data ('myapp_undo_data_v5') is ignored — starting fresh
// per note yields cleaner behaviour than trying to attribute pre-migration
// history to whichever note happened to be open at the time.
// ============================================================================
(function () {
  const DEFAULTS = {
    maxEntries: 50,
    powerWindowMs: 3000,
    coalesceMs: 500,
    memoryBudgetBytes: 200000,
    persistKey: "myapp_undo_by_note_v1",
    persistTTL: 864e5,
    imeDebounce: 50
  };

  function approxBytes(e) { try { return new Blob([JSON.stringify(e)]).size; } catch (t) { return JSON.stringify(e).length; } }
  function now() { return Date.now(); }
  function shallowEqual(e, t) { return (e && t && e.value === t.value && e.start === t.start && e.end === t.end); }
  function clamp(e, t, n) { return Math.max(t, Math.min(n, e)); }
  function getSelectionState(e) {
    if (!e) return { start: 0, end: 0, dir: "forward" };
    try { return { start: e.selectionStart || 0, end: e.selectionEnd || 0, dir: e.selectionDirection || "forward" }; }
    catch (t) { return { start: 0, end: 0, dir: "forward" }; }
  }
  function restoreSelectionState(e, t) { if (!e || !t) return; try { e.setSelectionRange(t.start, t.end, t.dir); } catch (n) {} }
  function snapshot(e) { return { value: e.value, ...getSelectionState(e), ts: now() }; }
  function diffIsSmall(e, t) {
    if (!e || !t) return false;
    const n = e.value || "", r = t.value || "";
    if (Math.abs(n.length - r.length) > 5) return false;
    let i = 0;
    for (let o = 0, a = 0; o < n.length || a < r.length;) {
      if (n[o] !== r[a]) { i++; if (i > 2) return false; o++; a++; }
      else { o++; a++; }
    }
    return true;
  }

  class HistoryManager {
    constructor(target, opts) {
      this.opts = Object.assign({}, DEFAULTS, opts || {});
      this.maxEntries = this.opts.maxEntries;
      this.powerWindowMs = this.opts.powerWindowMs;
      this.coalesceMs = this.opts.coalesceMs;
      this.persistKey = this.opts.persistKey;
      this.persistTTL = this.opts.persistTTL;
      this.imeDebounce = this.opts.imeDebounce;
      this.target = null;

      // Per-note storage.
      this._boundNoteId = null;             // note whose stacks are currently in _undo/_redo
      this._allHistories = this._loadAll(); // { noteId: { undo:[], redo:[], _ts: number } }

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
      if (target) this.init(target);
    }

    // ------------------------------------------------------------------------
    // Setup / teardown
    // ------------------------------------------------------------------------
    init(target) {
      if (!target || target.tagName.toUpperCase() !== "TEXTAREA") throw new Error("target must be textarea");
      this.destroy();
      this.target = target;
      this._installListeners();
      this._wrapProgrammatics();
      // Do NOT auto-load or commit — bindings happen through loadForNote() so
      // there's a note-id to key against.
    }

    destroy() {
      this._uninstallListeners();
      this._unwrapProgrammatics();
      this._disconnectObserver();
      this._undo = [];
      this._redo = [];
      this._boundNoteId = null;
      this.target = null;
      this._suppress = false;
    }

    // ------------------------------------------------------------------------
    // Per-note load / stash.
    // ------------------------------------------------------------------------
    loadForNote(noteId, initialValue) {
      if (!this.target) return;
      const id = String(noteId);

      // Stash outgoing note's stacks.
      if (this._boundNoteId && this._boundNoteId !== id) {
        this._allHistories[this._boundNoteId] = { undo: this._undo, redo: this._redo, _ts: now() };
      }
      this._boundNoteId = id;

      const stored = this._allHistories[id];
      if (stored && Array.isArray(stored.undo)) {
        this._undo = stored.undo.slice();
        this._redo = Array.isArray(stored.redo) ? stored.redo.slice() : [];
      } else {
        this._undo = [];
        this._redo = [];
      }

      // Set the textarea value with recording suppressed — this note-swap
      // itself should not enter either note's undo history.
      this._suppress = true;
      try { this.target.value = initialValue == null ? '' : String(initialValue); }
      catch (e) {}
      this._suppress = false;

      // Seed a single initial frame if the note has no prior history.
      if (this._undo.length === 0) {
        this._undo.push(this._createFrame(snapshot(this.target)));
      }
      this._trim();
      this._persistAll();
      this._resetPowerCounters();
    }

    clearNote(noteId) {
      const id = String(noteId);
      if (this._allHistories[id]) delete this._allHistories[id];
      if (this._boundNoteId === id) { this._undo = []; this._redo = []; }
      this._persistAll();
    }

    // ------------------------------------------------------------------------
    // Public undo / redo.
    // ------------------------------------------------------------------------
    performUndo() {
      if (!this.target) return;
      if (this._undo.length <= 1) { this._notify("Nothing to undo"); return; }
      let steps = Math.min(this._undoPower, this._undo.length - 1);
      this._suppress = true;
      for (let t = 0; t < steps; t++) { this._redo.push(this._undo.pop()); }
      const frame = this._undo[this._undo.length - 1];
      if (frame) this._applyFrame(frame);
      this._suppress = false;
      this._notify(`Undo performed (${steps} step(s))`);
      this._persist();
    }
    performRedo() {
      if (!this.target) return;
      if (this._redo.length === 0) { this._notify("Nothing to redo"); return; }
      let steps = Math.min(this._redoPower, this._redo.length);
      this._suppress = true;
      for (let t = 0; t < steps; t++) { this._undo.push(this._redo.pop()); }
      const frame = this._undo[this._undo.length - 1];
      if (frame) this._applyFrame(frame);
      this._suppress = false;
      this._notify(`Redo performed (${steps} step(s))`);
      this._persist();
    }
    clear() {
      this._undo = [];
      this._redo = [];
      this._persist();
    }
    recordNow(reason) { if (this.target) this._commitImmediate(reason || "manual"); }
    serialize() { return JSON.stringify({ undo: this._undo, redo: this._redo, ts: now(), note: this._boundNoteId }); }

    // ------------------------------------------------------------------------
    // Internals.
    // ------------------------------------------------------------------------
    _resetPowerCounters() { this._undoPower = 1; this._redoPower = 1; this._lastUndoClick = 0; this._lastRedoClick = 0; }
    _notify(m) { try { showNotification && showNotification(m); } catch (e) { console.log(m); } }
    _applyFrame(frame) {
      if (!this.target) return;
      this._suppress = true;
      this.target.value = frame.value;
      restoreSelectionState(this.target, frame);
      if (typeof currentNote !== 'undefined' && currentNote && String(currentNote.id) === String(this._boundNoteId)) {
        currentNote.content = frame.value;
      }
      if (typeof updateNoteMetadata === "function") updateNoteMetadata();
      // If diffusion mode is on, keep the shadow textarea and diff() in sync too.
      if (window.dexMode && window.dexMode.enabled) {
        try {
          const pane = window.dexMode.activePane;
          const shadow = pane === 'raw'
            ? (typeof diffElements !== 'undefined' && diffElements.raw)
            : (typeof diffElements !== 'undefined' && diffElements.morph);
          if (shadow && shadow !== this.target) shadow.value = frame.value;
          if (typeof window.scheduleDiffusion === 'function') window.scheduleDiffusion();
        } catch (e) {}
      }
      this._suppress = false;
    }
    _createFrame(s) { return { value: s.value, start: s.start, end: s.end, dir: s.dir, ts: s.ts }; }
    _undoPush(f) {
      if (this._undo.length && shallowEqual(this._undo[this._undo.length - 1], f)) return;
      this._undo.push(f);
      this._trim();
      this._persist();
    }
    _trim() {
      const cap = this.maxEntries;
      while (this._undo.length > cap) this._undo.shift();
      while (this._redo.length > cap) this._redo.shift();
      if (this.opts.memoryBudgetBytes) {
        let bytes = approxBytes({ undo: this._undo, redo: this._redo });
        while (bytes > this.opts.memoryBudgetBytes && this._undo.length > 1) {
          this._undo.shift();
          bytes = approxBytes({ undo: this._undo, redo: this._redo });
        }
      }
    }
    _persist() {
      // Persist just the current note's stacks into the shared blob.
      if (!this._boundNoteId) return;
      this._allHistories[this._boundNoteId] = { undo: this._undo, redo: this._redo, _ts: now() };
      this._persistAll();
    }
    _persistAll() {
      try {
        // Drop expired entries opportunistically.
        const cutoff = now() - this.persistTTL;
        Object.keys(this._allHistories).forEach(k => {
          const h = this._allHistories[k];
          if (!h || !h._ts || h._ts < cutoff) delete this._allHistories[k];
        });
        localStorage.setItem(this.persistKey, JSON.stringify(this._allHistories));
      } catch (e) {}
    }
    _loadAll() {
      try {
        const raw = localStorage.getItem(this.persistKey);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
      } catch (n) { return {}; }
    }

    _installListeners() {
      if (!this.target) return;
      this.target.addEventListener("input", this._onInput);
      this.target.addEventListener("paste", this._onCutPaste);
      this.target.addEventListener("cut", this._onCutPaste);
      this.target.addEventListener("keydown", this._onKeydown);
      this.target.addEventListener("compositionstart", this._onCompositionStart);
      this.target.addEventListener("compositionend", this._onCompositionEnd);
      this._observer = new MutationObserver(() => { if (this._suppress) return; this._scheduleCommit(); });
      this._observer.observe(this.target, { characterData: true, childList: true, subtree: true });

      // Toolbar buttons.
      if (typeof undoBtn !== 'undefined' && undoBtn) {
        undoBtn.addEventListener("click", () => {
          const t = now();
          if (t - this._lastUndoClick <= this.powerWindowMs) this._undoPower = clamp(this._undoPower + 1, 1, this.maxEntries);
          else this._undoPower = 1;
          this._lastUndoClick = t;
          this._redoPower = 1;
          this._lastRedoClick = 0;
          this.performUndo();
        });
      }
      if (typeof redoBtn !== 'undefined' && redoBtn) {
        redoBtn.addEventListener("click", () => {
          const t = now();
          if (t - this._lastRedoClick <= this.powerWindowMs) this._redoPower = clamp(this._redoPower + 1, 1, this.maxEntries);
          else this._redoPower = 1;
          this._lastRedoClick = t;
          this._undoPower = 1;
          this._lastUndoClick = 0;
          this.performRedo();
        });
      }
    }
    _uninstallListeners() {
      if (!this.target) return;
      try {
        this.target.removeEventListener("input", this._onInput);
        this.target.removeEventListener("paste", this._onCutPaste);
        this.target.removeEventListener("cut", this._onCutPaste);
        this.target.removeEventListener("keydown", this._onKeydown);
        this.target.removeEventListener("compositionstart", this._onCompositionStart);
        this.target.removeEventListener("compositionend", this._onCompositionEnd);
      } catch (e) {}
      this._disconnectObserver();
    }
    _disconnectObserver() { if (this._observer) { try { this._observer.disconnect(); } catch (e) {} this._observer = null; } }
    _onInput() { if (this._suppress) return; if (this._composition) return this._scheduleCommit(); this._scheduleCommit(); }
    _onCutPaste() { if (this._suppress) return; this._scheduleCommit(0); }
    _onKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" || e.key === "Z") {
          if (e.shiftKey) { e.preventDefault(); this.performRedo(); }
          else { e.preventDefault(); this.performUndo(); }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault(); this.performRedo();
        }
      }
    }
    _onCompositionStart() { this._composition = true; }
    _onCompositionEnd() { this._composition = false; setTimeout(() => this._scheduleCommit(0), this.imeDebounce); }
    _scheduleCommit(immediate) {
      clearTimeout(this._coalesceTimer);
      if (immediate === 0) { this._commitImmediate("immediate"); return; }
      this._coalesceTimer = setTimeout(() => this._commitImmediate("coalesced"), this.coalesceMs);
    }
    _commitImmediate() {
      clearTimeout(this._coalesceTimer);
      if (!this.target || !this._boundNoteId) return;
      const s = snapshot(this.target);
      if (this._suppress) return;
      const last = this._undo[this._undo.length - 1];
      if (last && shallowEqual(last, s)) return;
      if (last && diffIsSmall(last, s) && now() - last.ts < this.coalesceMs && !this._composition) {
        this._undo[this._undo.length - 1] = this._createFrame(s);
        this._undo[this._undo.length - 1].ts = now();
      } else {
        this._undoPush(this._createFrame(s));
      }
      this._redo = [];
      this._persist();
    }
    _wrapProgrammatics() {
      if (!this.target) return;
      const el = this.target, self = this;
      try {
        if (!el.__undov_value_wrapped) {
          const desc = Object.getOwnPropertyDescriptor(el, "value")
                       || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
          const getter = desc.get || function () { return this.value; };
          const setter = desc.set || function (v) { this.value = v; };
          Object.defineProperty(el, "value", {
            configurable: true,
            enumerable: desc.enumerable,
            get: function () { return getter.call(this); },
            set: function (v) {
              if (self._suppress) return setter.call(this, v);
              setter.call(this, v);
              self.recordNow("setter");
            }
          });
          el.__undov_value_wrapped = true;
          this._wrapped.value = true;
        }
      } catch (e) {}
      try {
        if (typeof el.setRangeText === "function" && !el.__undov_setRangeText_wrapped) {
          const orig = el.setRangeText;
          el.setRangeText = function () {
            if (self._suppress) return orig.apply(this, arguments);
            const r = orig.apply(this, arguments);
            self.recordNow("setRangeText");
            return r;
          };
          el.__undov_setRangeText_wrapped = true;
          this._wrapped.setRangeText = true;
        }
      } catch (e) {}
    }
    _unwrapProgrammatics() {
      const el = this.target;
      try {
        if (el && el.__undov_value_wrapped) delete el.__undov_value_wrapped;
        if (el && el.__undov_setRangeText_wrapped) delete el.__undov_setRangeText_wrapped;
      } catch (t) {}
    }
  }

  function autoWire() {
    const t = document.getElementById("noteTextarea") || document.querySelector("textarea");
    if (!t) return null;
    if (window.__HistoryManagerInstance) window.__HistoryManagerInstance.destroy();
    const hm = new HistoryManager(t);
    window.__HistoryManagerInstance = hm;

    window.performUndo = () => hm.performUndo();
    window.performRedo = () => hm.performRedo();
    window.clearUndoHistory = () => hm.clear();
    window.recordState = (r) => hm.recordNow(r);
    window.serializeUndoHistory = () => hm.serialize();

    // Public per-note API — called by openNote().
    window.rebindUndoForNote = (noteId, content) => hm.loadForNote(noteId, content);
    window.clearUndoHistoryForNote = (noteId) => hm.clearNote(noteId);

    return hm;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoWire, { once: true });
  else setTimeout(autoWire, 0);

  window.HistoryManager = HistoryManager;
})();
