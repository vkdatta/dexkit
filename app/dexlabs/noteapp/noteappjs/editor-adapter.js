// ============================================================================
// DexLabs — Editor adapter (CodeMirror 5).
//
// Mounts CM5 in place of #noteTextarea. The <textarea> element itself is
// kept in DOM (CM hides it) so any code holding a reference to `noteTextarea`
// (there's a const capturing it in index.html) still points to a valid node.
// A property facade routes reads/writes on that node into CM:
//
//   noteTextarea.value               → cm.getValue()
//   noteTextarea.value = X           → cm.setValue(X) (undo-atomic)
//   noteTextarea.setRangeText(...)   → cm.replaceRange(...)
//   noteTextarea.selectionStart / End → cm.indexFromPos(getCursor())
//   noteTextarea.setSelectionRange   → cm.setSelection(...)
//   noteTextarea.focus()             → cm.focus()
//
// CM `change` events dispatch a synthetic 'input' event on the textarea so
// existing 'input' listeners (updateNoteMetadata, populateNoteList,
// voldemort trigger check, mode.js shadow-sync) still fire — nothing else
// in the codebase has to know CM exists.
//
// Per-note history is preserved by cm.getHistory() / cm.setHistory().
// window.dexEditor.loadHistoryFor(id, content) is called by undo.js's shim
// on every openNote(); the shim in turn is called from index.html's openNote.
// ============================================================================
(function () {
  function boot() {
    const nt = document.getElementById('noteTextarea');
    if (!nt) { setTimeout(boot, 40); return; }
    if (typeof CodeMirror === 'undefined') { setTimeout(boot, 40); return; }
    if (window.dexEditor) return; // already mounted

    // Preserve native descriptors BEFORE we redefine anything.
    const proto = HTMLTextAreaElement.prototype;
    const valueDesc = Object.getOwnPropertyDescriptor(proto, 'value') || {};
    const nativeSetValue = valueDesc.set ? valueDesc.set.bind(nt) : (v) => { proto.value = v; };
    const nativeGetValue = valueDesc.get ? valueDesc.get.bind(nt) : () => proto.value;
    const nativeSetRangeText = nt.setRangeText ? nt.setRangeText.bind(nt) : null;
    const nativeSetSelectionRange = nt.setSelectionRange ? nt.setSelectionRange.bind(nt) : null;
    const nativeFocus = nt.focus ? nt.focus.bind(nt) : null;

    // Configure the lazy mode-loader BEFORE creating the editor.
    if (CodeMirror.modeURL !== undefined) {
      CodeMirror.modeURL = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/%N/%N.min.js";
    }

    // Mount CodeMirror using fromTextArea — this hides #noteTextarea via
    // display:none and inserts a .CodeMirror wrapper right after it.
    const cm = CodeMirror.fromTextArea(nt, {
      theme: 'dracula',
      mode: 'text/plain',
      lineNumbers: localStorage.getItem('showLineNumbers') === '1',
      lineWrapping: false,       // wrap OFF per your spec
      matchBrackets: true,
      styleActiveLine: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      autofocus: false,
      inputStyle: 'contenteditable', // better IME on mobile
      spellcheck: false,
      autocorrect: false,
      autocapitalize: false,
      viewportMargin: 50         // render a bit above/below for smoother scroll
    });

    // Style the fresh CM instance to match the app's font stack + size.
    const savedFont = parseInt(localStorage.getItem('fontSize') || '14', 10);
    cm.getWrapperElement().style.fontFamily = "'Source Code Pro', monospace";
    cm.getWrapperElement().style.fontSize = savedFont + 'px';

    // Suppress flag — used to silence the change → 'input' bridge during
    // programmatic operations (openNote loads, Voldemort intermediate clear).
    let suppress = false;
    let dispatching = false;

    // On CM change: mirror into the underlying textarea AND emit 'input' so
    // every existing listener (updateNoteMetadata, mode.js shadow-sync, the
    // voldemort trigger check) keeps working as before.
    cm.on('change', () => {
      if (suppress) return;
      dispatching = true;
      try { nativeSetValue(cm.getValue()); } catch (e) {}
      try { nt.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      dispatching = false;
    });

    // Mirror CM cursor movements too so 'select' listeners (rare, but the
    // find-replace code touches selection) see up-to-date offsets.
    cm.on('cursorActivity', () => {
      if (suppress) return;
      try { nt.dispatchEvent(new Event('select', { bubbles: true })); } catch (e) {}
    });

    // ─── Property facade ────────────────────────────────────────────────────
    // .value
    Object.defineProperty(nt, 'value', {
      configurable: true,
      enumerable: true,
      get() { return cm.getValue(); },
      set(v) {
        const str = v == null ? '' : String(v);
        if (str === cm.getValue()) return;
        cm.operation(() => { cm.setValue(str); });
        // Native textarea keeps a mirror so any direct native reads (extremely rare)
        // don't diverge. We already synced in the change listener, but being
        // explicit here helps when suppress is on.
        try { nativeSetValue(str); } catch (e) {}
      }
    });

    // .selectionStart / .selectionEnd / .selectionDirection
    Object.defineProperty(nt, 'selectionStart', {
      configurable: true,
      get() { return cm.indexFromPos(cm.getCursor('from')); },
      set(v) {
        const pos = cm.posFromIndex(Math.max(0, v | 0));
        cm.setSelection(pos, pos);
      }
    });
    Object.defineProperty(nt, 'selectionEnd', {
      configurable: true,
      get() { return cm.indexFromPos(cm.getCursor('to')); },
      set(v) {
        const from = cm.getCursor('from');
        cm.setSelection(from, cm.posFromIndex(Math.max(0, v | 0)));
      }
    });
    Object.defineProperty(nt, 'selectionDirection', {
      configurable: true,
      get() { return 'forward'; },
      set() {}
    });

    // .setSelectionRange(start, end, dir?)
    nt.setSelectionRange = function (start, end) {
      cm.setSelection(cm.posFromIndex(start | 0), cm.posFromIndex(end | 0));
    };

    // .setRangeText(text, start?, end?, mode?)
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/setRangeText
    nt.setRangeText = function (text, start, end, selMode) {
      const cur = cm.getValue();
      if (start == null) start = cm.indexFromPos(cm.getCursor('from'));
      if (end == null)   end   = cm.indexFromPos(cm.getCursor('to'));
      const s = Math.max(0, Math.min(cur.length, start | 0));
      const e = Math.max(s,  Math.min(cur.length, end   | 0));
      const from = cm.posFromIndex(s), to = cm.posFromIndex(e);
      const insertStr = text == null ? '' : String(text);
      cm.replaceRange(insertStr, from, to);
      // Post-insertion selection per selMode.
      const newEnd = s + insertStr.length;
      const applyRange = (a, b) => cm.setSelection(cm.posFromIndex(a), cm.posFromIndex(b));
      switch ((selMode || 'preserve').toLowerCase()) {
        case 'select':   applyRange(s, newEnd); break;
        case 'start':    applyRange(s, s); break;
        case 'end':      applyRange(newEnd, newEnd); break;
        case 'preserve':
        default:
          applyRange(newEnd, newEnd);
      }
    };

    // .focus()
    nt.focus = function () { cm.focus(); };

    // ─── Public API — window.dexEditor ─────────────────────────────────────
    const histories = {}; // in-memory, keyed by note id

    function extToMode(ext) {
      const key = String(ext || '').toLowerCase().replace(/^\./, '');
      // Fast-path aliases the CM meta table doesn't list on its own.
      const aliases = { txt: 'text/plain', log: 'text/plain', ini: 'properties' };
      if (aliases[key]) return { mode: aliases[key] === 'text/plain' ? 'null' : aliases[key], mime: aliases[key] };
      if (typeof CodeMirror.findModeByExtension === 'function') {
        const info = CodeMirror.findModeByExtension(key);
        if (info) return { mode: info.mode, mime: info.mime };
      }
      return { mode: 'null', mime: 'text/plain' };
    }

    function applyLanguageForCurrentNote() {
      const prismOn = localStorage.getItem('prismEnabled') === '1';
      const ext = (typeof currentNote !== 'undefined' && currentNote && currentNote.extension) || 'txt';
      if (!prismOn) { cm.setOption('mode', 'text/plain'); return; }
      const { mode, mime } = extToMode(ext);
      cm.setOption('mode', mime);
      if (mode !== 'null' && typeof CodeMirror.autoLoadMode === 'function') {
        try { CodeMirror.autoLoadMode(cm, mode); } catch (e) {}
      }
    }

    window.dexEditor = {
      cm: cm,
      textarea: nt,

      getValue: () => cm.getValue(),

      setValue: function (str, opts) {
        const silent = !!(opts && opts.silent);
        const s = str == null ? '' : String(str);
        if (silent) suppress = true;
        cm.operation(() => { cm.setValue(s); });
        try { nativeSetValue(s); } catch (e) {}
        if (silent) suppress = false;
      },

      getSelection: () => ({
        start: cm.indexFromPos(cm.getCursor('from')),
        end:   cm.indexFromPos(cm.getCursor('to')),
        text:  cm.getSelection()
      }),

      setSelection: (start, end) => {
        cm.setSelection(cm.posFromIndex(start | 0), cm.posFromIndex((end == null ? start : end) | 0));
      },

      replaceSelection: (s) => { cm.replaceSelection(s == null ? '' : String(s)); },

      insertAt: (pos, s) => { cm.replaceRange(String(s || ''), cm.posFromIndex(pos | 0)); },

      focus: () => cm.focus(),

      refresh: () => cm.refresh(),

      on: (event, fn) => { cm.on(event, fn); return () => cm.off(event, fn); },

      // Explicit setLanguage(ext) — mode.js calls this on openNote and on the
      // Prism-toggle Settings change.
      setLanguage: function (ext) {
        const prismOn = localStorage.getItem('prismEnabled') === '1';
        if (!prismOn || !ext) { cm.setOption('mode', 'text/plain'); return; }
        const { mode, mime } = extToMode(ext);
        cm.setOption('mode', mime);
        if (mode !== 'null' && typeof CodeMirror.autoLoadMode === 'function') {
          try { CodeMirror.autoLoadMode(cm, mode); } catch (e) {}
        }
      },

      applyLanguageForCurrentNote: applyLanguageForCurrentNote,

      setLineNumbers: (on) => cm.setOption('lineNumbers', !!on),

      setWrap: (on) => cm.setOption('lineWrapping', !!on),

      // ── Per-note history ──
      saveHistoryFor: (noteId) => {
        if (noteId == null) return;
        histories[String(noteId)] = cm.getHistory();
      },
      loadHistoryFor: function (noteId, content) {
        const id = noteId == null ? null : String(noteId);
        const str = content == null ? '' : String(content);
        suppress = true;
        cm.operation(() => {
          cm.setValue(str);
        });
        try { nativeSetValue(str); } catch (e) {}
        const saved = id ? histories[id] : null;
        if (saved) { try { cm.setHistory(saved); } catch (e) { cm.clearHistory(); } }
        else       { cm.clearHistory(); }
        suppress = false;
      },
      clearHistoryFor: (noteId) => {
        if (noteId != null) delete histories[String(noteId)];
      },

      // ── Diff-mode helpers ──
      _internal: { suppressFlagSetter: (v) => { suppress = !!v; } }
    };

    // Signal readiness so anything waiting on dexEditor can proceed.
    try { window.dispatchEvent(new Event('dexEditorReady')); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
