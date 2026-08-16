(function () {
  const LS_ENABLED = 'mermaidEnabled';
  const LS_NOTE_ID = 'mermaidBoundNoteId';

  const state = {
    enabled: false,
    boundNoteId: null,
    activePane: 'code'
  };
  window.dexMermaidMode = state;

  function $(id) { return document.getElementById(id); }
  function noteById(id) { return (typeof notes !== 'undefined' && Array.isArray(notes)) ? notes.find(n => String(n.id) === String(id)) : null; }
  function lsSet(k, v) { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, String(v)); }

  let bootstrapped = false;
  function bootstrapOnce() {
    if (bootstrapped) return;
    bootstrapped = true;
    if (typeof window.dexMermaidInitColorPickers === 'function') window.dexMermaidInitColorPickers();
    if (typeof window.dexMermaidInitFontUI === 'function') window.dexMermaidInitFontUI();
    if (typeof window.dexMermaidSyncUI === 'function') window.dexMermaidSyncUI();
    if (typeof window.dexMermaidInitMermaid === 'function') window.dexMermaidInitMermaid();
    if (typeof window.dexMermaidSetPreviewBackground === 'function') window.dexMermaidSetPreviewBackground();
  }

  // The code pane is now just the shared CodeMirror editor (window.dexEditor)
  // showing whatever note is bound — the exact same surface base mode and
  // diffusion's raw/morph use. Saving happens through the app's existing
  // noteTextarea "input" listener (bootstrap.js -> updateNoteMetadata()),
  // same as any other note; mermaid needs no bespoke commit/save logic.
  function currentCode() {
    // Guard against leaking whatever note the shared editor last showed:
    // with nothing bound, the code pane is a readOnly empty state and the
    // preview should render nothing, not stale/unrelated text underneath it.
    if (!state.boundNoteId) return '';
    return (window.dexEditor && typeof window.dexEditor.getValue === 'function') ? window.dexEditor.getValue() : '';
  }

  function showCodeEditor() {
    const vp = $('mermaidViewport');
    if (vp) vp.style.display = 'none';
    document.body.classList.remove('mermaid-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';
  }
  function showMermaidViewport() {
    const vp = $('mermaidViewport');
    if (vp) vp.style.display = 'flex';
    document.body.classList.add('mermaid-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = 'none';
    if (typeof closeSidebar === 'function') closeSidebar();
  }
  function hideMermaidViewport() {
    const vp = $('mermaidViewport');
    if (vp) vp.style.display = 'none';
    document.body.classList.remove('mermaid-fullscreen');
  }

  function paintBottomBar() {
    document.querySelectorAll('#mermaidBottombar .diff-topbar-button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('#mermaidBottombar .diff-topbar-button[data-target="' + state.activePane + '"]');
    if (btn) btn.classList.add('active');
  }

  // Topbar (label + active filename + Clear/Sample/Select file) and the
  // "no active selection" empty state for the code pane — same pattern as
  // diffusion's raw/morph pane header, sharing the .diff-pane-header /
  // .pane-empty-state CSS and the #textAreaWrapper.pane-empty toggle.
  function paintCodePaneHeader() {
    const header = $('mermaidPaneHeader');
    const fileEl = $('mermaidPaneHeaderFile');
    const empty  = $('mermaidCodeEmpty');
    const wrap   = $('textAreaWrapper');
    if (!header) return;

    const showHeader = state.enabled && state.activePane === 'code';
    header.classList.toggle('active', showHeader);
    if (!showHeader) { if (empty) empty.classList.remove('show'); if (wrap) wrap.classList.remove('pane-empty'); return; }

    const n = state.boundNoteId ? noteById(state.boundNoteId) : null;
    if (fileEl) fileEl.textContent = n ? (n.title || ('note ' + n.id)) : 'No active selection';

    const isEmpty = !n;
    if (empty) empty.classList.toggle('show', isEmpty);
    if (wrap) wrap.classList.toggle('pane-empty', isEmpty);
    if (window.dexEditor && window.dexEditor.cm) {
      try { window.dexEditor.cm.setOption('readOnly', isEmpty); } catch (e) {}
    }
  }

  function switchPane(pane) {
    if (!state.enabled) return;
    state.activePane = pane;
    paintBottomBar();
    if (pane === 'code') {
      showCodeEditor();
      paintCodePaneHeader();
      return;
    }
    showMermaidViewport();
    paintCodePaneHeader();
    const mapped = pane === 'flow' ? 'preview' : 'settings';
    if (typeof window.dexMermaidSwitchTab === 'function') window.dexMermaidSwitchTab(mapped, currentCode());
  }

  window.dexMermaidBottomClick = function (target) { switchPane(target); };
  window.dexMermaidPickFile = function () { if (state.enabled) openPicker(); };
  window.dexMermaidCurrentCode = currentCode;

  function showPickBanner() {
    hidePickBanner();
    const sb = $('sidebar1');
    if (!sb) return;
    const b = document.createElement('div');
    b.id = 'mermaidPickBanner';
    b.className = 'diff-pick-banner';
    b.innerHTML = '<span>Pick a note for <b>Mermaid</b></span><button onclick="dexMermaidCancelPick()">Cancel</button>';
    sb.insertBefore(b, sb.firstChild);
  }
  function hidePickBanner() { const b = $('mermaidPickBanner'); if (b) b.remove(); }

  function openPicker() {
    window.__dexNotePick = function (noteId) { bindPicked(noteId); };
    // Issue 5c (shared with diffusion): highlight the currently-bound note.
    window.__dexPickActiveNoteId = state.boundNoteId;
    const sb = $('sidebar1');
    if (sb) sb.classList.add('open');
    if (typeof renderSidebar === 'function') try { renderSidebar(); } catch (e) {}
    showPickBanner();
    if (typeof showNotification === 'function') showNotification('Pick a note for Mermaid');
  }

  function bindPicked(noteId) {
    if (!state.enabled) return;
    window.__dexNotePick = null;
    window.__dexPickActiveNoteId = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
    const n = noteById(noteId);
    if (!n) return;
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}
    state.boundNoteId = String(n.id);
    lsSet(LS_NOTE_ID, n.id);
    if (typeof openNote === 'function') openNote(n.id);
    try { history.pushState({ page: 'note', noteId: n.id, mode: 'mermaid' }, '', '/note/' + n.id + '/mermaid'); } catch (e) {}
    switchPane('code');
    if (typeof showNotification === 'function') showNotification('Mermaid ← ' + (n.title || 'note'));
  }

  window.dexMermaidCancelPick = function () {
    window.__dexNotePick = null;
    window.__dexPickActiveNoteId = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
  };

  function enter() {
    if (state.enabled) return;
    if (typeof window.exitDiffusionMode === 'function') try { window.exitDiffusionMode(); } catch (e) {}
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}

    state.enabled = true;
    lsSet(LS_ENABLED, '1');

    document.body.classList.add('mode-mermaid');
    const bb = $('mermaidBottombar');
    if (bb) bb.style.display = 'flex';
    ensureBottomBarWired();
    bootstrapOnce();

    const liveNoteId = (typeof currentNote !== 'undefined' && currentNote) ? String(currentNote.id) : null;
    const boundId = (liveNoteId && noteById(liveNoteId)) ? liveNoteId
                  : (localStorage.getItem(LS_NOTE_ID) && noteById(localStorage.getItem(LS_NOTE_ID)))
                    ? localStorage.getItem(LS_NOTE_ID) : null;
    state.boundNoteId = boundId || null;
    lsSet(LS_NOTE_ID, state.boundNoteId || '');
    if (state.boundNoteId && typeof openNote === 'function') openNote(state.boundNoteId);

    state.activePane = 'code';
    showCodeEditor();
    paintBottomBar();
    paintCodePaneHeader();

    if (typeof showNotification === 'function') {
      showNotification(state.boundNoteId ? 'Mermaid Flow enabled' : 'Mermaid Flow enabled — select a file to begin');
    }
  }

  function exit() {
    if (!state.enabled) return;
    if (typeof updateNoteMetadata === 'function') try { updateNoteMetadata(); } catch (e) {}

    state.enabled = false;
    state.boundNoteId = null;
    state.activePane = 'code';
    lsSet(LS_ENABLED, '');

    document.body.classList.remove('mode-mermaid', 'mermaid-fullscreen');
    const bb = $('mermaidBottombar');
    if (bb) bb.style.display = 'none';
    if (window.__dexNotePick) window.__dexNotePick = null;
    window.__dexPickActiveNoteId = null;
    hidePickBanner();
    hideMermaidViewport();

    const header = $('mermaidPaneHeader');
    if (header) header.classList.remove('active');
    const empty = $('mermaidCodeEmpty');
    if (empty) empty.classList.remove('show');
    const wrap = $('textAreaWrapper');
    if (wrap) wrap.classList.remove('pane-empty');
    if (window.dexEditor && window.dexEditor.cm) {
      try { window.dexEditor.cm.setOption('readOnly', false); } catch (e) {}
    }
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';

    if (typeof showNotification === 'function') showNotification('Mermaid Flow disabled');
  }

  window.enterMermaidMode = enter;
  window.exitMermaidMode = exit;

  function ensureBottomBarWired() {
    const bb = $('mermaidBottombar');
    if (!bb || bb.__dexWired) return;
    bb.__dexWired = true;
    bb.addEventListener('click', (e) => {
      const btn = e.target.closest('.diff-topbar-button');
      if (!btn) return;
      const target = btn.getAttribute('data-target');
      if (target) switchPane(target);
    });
  }

  function ensureHeaderButtonsWired() {
    const clearBtn = $('mermaidHeaderClearBtn');
    const sampleBtn = $('mermaidHeaderSampleBtn');
    if (clearBtn && !clearBtn.__dexWired) {
      clearBtn.__dexWired = true;
      clearBtn.addEventListener('click', () => {
        if (!state.enabled || !state.boundNoteId) return;
        if (window.dexEditor) window.dexEditor.setValue('');
        if (typeof window.dexMermaidClearPreview === 'function') window.dexMermaidClearPreview();
      });
    }
    if (sampleBtn && !sampleBtn.__dexWired) {
      sampleBtn.__dexWired = true;
      sampleBtn.addEventListener('click', () => {
        if (!state.enabled || !state.boundNoteId) return;
        if (window.dexEditor && typeof window.dexMermaidSample === 'string') window.dexEditor.setValue(window.dexMermaidSample);
      });
    }
  }

  // Ctrl/Cmd+Enter jumps to the rendered preview while editing mermaid code —
  // parity with the old textarea's keyboard shortcut, now wired against the
  // shared CodeMirror instance instead of a dedicated <textarea>.
  function wireRenderShortcut() {
    const ed = window.dexEditor;
    const cm = ed && ed.cm ? ed.cm : null;
    if (!cm) { setTimeout(wireRenderShortcut, 300); return; }
    if (cm.__dexMermaidShortcutBound) return;
    cm.__dexMermaidShortcutBound = true;
    cm.on('keydown', (instance, e) => {
      if (!state.enabled || state.activePane !== 'code') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        switchPane('flow');
      }
    });
  }

  function waitForNotesThenInit() {
    let tries = 0;
    (function c() {
      if (typeof notes !== 'undefined' && Array.isArray(notes) && document.getElementById('mermaidBottombar')) {
        ensureBottomBarWired();
        ensureHeaderButtonsWired();
        wireRenderShortcut();
        return;
      }
      if (tries++ > 200) return;
      setTimeout(c, 40);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForNotesThenInit);
  else waitForNotesThenInit();
})();
