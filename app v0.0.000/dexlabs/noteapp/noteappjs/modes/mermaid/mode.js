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
    if (typeof window.dexMermaidUpdateLineCount === 'function') window.dexMermaidUpdateLineCount();
    if (typeof window.dexMermaidInitMermaid === 'function') window.dexMermaidInitMermaid();
    if (typeof window.dexMermaidSetPreviewBackground === 'function') window.dexMermaidSetPreviewBackground();
  }

  function commitCodeToBoundNote() {
    if (!state.boundNoteId) return;
    const ta = $('mermaid-code');
    const n = noteById(state.boundNoteId);
    if (!ta || !n) return;
    if (n.content === ta.value) return;
    n.content = ta.value;
    n.lastEdited = new Date().toISOString();
    n._dirty = true;
    if (typeof saveNotes === 'function') try { saveNotes(); } catch (e) {}
    if (typeof populateNoteList === 'function') try { populateNoteList(); } catch (e) {}
  }

  let codeInputWired = false;
  function wireCodeInput() {
    const ta = $('mermaid-code');
    if (!ta || codeInputWired) return;
    codeInputWired = true;
    ta.addEventListener('input', () => {
      if (!state.enabled) return;
      commitCodeToBoundNote();
    });
  }

  function showViewport() {
    const vp = $('mermaidViewport');
    if (vp) vp.style.display = 'flex';
    document.body.classList.add('mermaid-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = 'none';
    if (typeof closeSidebar === 'function') closeSidebar();
  }
  function hideViewport() {
    const vp = $('mermaidViewport');
    if (vp) vp.style.display = 'none';
    document.body.classList.remove('mermaid-fullscreen');
    const nc = document.querySelector('.note-container');
    if (nc) nc.style.display = '';
  }

  function paintBottomBar() {
    document.querySelectorAll('#mermaidBottombar .diff-topbar-button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('#mermaidBottombar .diff-topbar-button[data-target="' + state.activePane + '"]');
    if (btn) btn.classList.add('active');
  }

  function switchPane(pane) {
    state.activePane = pane;
    paintBottomBar();
    const mapped = pane === 'code' ? 'editor' : pane === 'flow' ? 'preview' : 'settings';
    if (typeof window.dexMermaidSwitchTab === 'function') window.dexMermaidSwitchTab(mapped);
  }

  window.dexMermaidBottomClick = function (target) { switchPane(target); };

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
    const sb = $('sidebar1');
    if (sb) sb.classList.add('open');
    if (typeof renderSidebar === 'function') try { renderSidebar(); } catch (e) {}
    showPickBanner();
    if (typeof showNotification === 'function') showNotification('Pick a note for Mermaid');
  }
  window.dexMermaidPickFile = function () { if (state.enabled) openPicker(); };

  function bindPicked(noteId) {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
    const n = noteById(noteId);
    if (!n) return;
    state.boundNoteId = String(n.id);
    lsSet(LS_NOTE_ID, n.id);
    const ta = $('mermaid-code');
    if (ta) {
      ta.value = n.content || '';
      if (typeof window.dexMermaidUpdateLineCount === 'function') window.dexMermaidUpdateLineCount();
    }
    const label = $('mermaidActiveFileLabel');
    if (label) label.textContent = n.title || ('note ' + n.id);
    switchPane('flow');
    if (typeof showNotification === 'function') showNotification('Mermaid ← ' + (n.title || 'note'));
  }

  window.dexMermaidCancelPick = function () {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = $('sidebar1');
    if (sb) sb.classList.remove('open');
  };

  function enter() {
    if (state.enabled) return;
    state.enabled = true;
    lsSet(LS_ENABLED, '1');

    document.body.classList.add('mode-mermaid');
    const bb = $('mermaidBottombar');
    if (bb) bb.style.display = 'flex';

    bootstrapOnce();
    wireCodeInput();

    const savedNoteId = localStorage.getItem(LS_NOTE_ID);
    if (savedNoteId && noteById(savedNoteId)) {
      state.boundNoteId = savedNoteId;
      const n = noteById(savedNoteId);
      const ta = $('mermaid-code');
      if (ta) { ta.value = n.content || ''; if (typeof window.dexMermaidUpdateLineCount === 'function') window.dexMermaidUpdateLineCount(); }
      const label = $('mermaidActiveFileLabel');
      if (label) label.textContent = n.title || ('note ' + n.id);
    }

    state.activePane = 'code';
    showViewport();
    paintBottomBar();
    if (typeof window.dexMermaidSwitchTab === 'function') window.dexMermaidSwitchTab('editor');

    if (typeof showNotification === 'function') showNotification('Mermaid Flow enabled — pick a file or type a diagram');
  }

  function exit() {
    if (!state.enabled) return;
    commitCodeToBoundNote();

    state.enabled = false;
    lsSet(LS_ENABLED, '');

    document.body.classList.remove('mode-mermaid');
    const bb = $('mermaidBottombar');
    if (bb) bb.style.display = 'none';
    hidePickBanner();
    hideViewport();

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

  function waitForNotesThenInit() {
    let tries = 0;
    (function c() {
      if (typeof notes !== 'undefined' && Array.isArray(notes) && document.getElementById('mermaid-code')) {
        ensureBottomBarWired();
        if (localStorage.getItem(LS_ENABLED) === '1') enter();
        return;
      }
      if (tries++ > 200) return;
      setTimeout(c, 40);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForNotesThenInit);
  else waitForNotesThenInit();
})();
