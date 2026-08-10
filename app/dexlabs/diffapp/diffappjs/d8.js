// ============================================================================
// Shared file architecture between the Note App and the Diff Checker.
// Raw and Morph panes are backed by real notes: editing a pane edits a note
// (autosaved, synced, and visible in the sidebar tree, exactly like any note).
// Re-clicking an already-active Raw/Morph button opens the sidebar in "pick"
// mode so the user can bind an existing note to that pane.
// Depends on globals from main.js (notes, saveNotes, populateNoteList,
// isSignedIn, syncWithDrive, showNotification, showDiffChecker) and
// sidebar1.js (genNoteId, currentFolderId, renderSidebar), and on diffElements
// / diffusion from diffusionv3.js.
// ============================================================================
(function () {
  function el(pane) { return pane === "raw" ? diffElements.raw : diffElements.morph; }
  function boundKey(pane) { return pane === "raw" ? "diffRawNoteId" : "diffMorphNoteId"; }

  window.diffGetBoundId = function (pane) { return localStorage.getItem(boundKey(pane)) || null; };
  window.diffSetBoundId = function (pane, id) { localStorage.setItem(boundKey(pane), id || ""); };
  function diffNoteById(id) { return (typeof notes !== "undefined" && Array.isArray(notes)) ? notes.find(n => String(n.id) === String(id)) : null; }

  function makeNote(pane, content) {
    const firstLine = (String(content || "").split("\n").find(l => l.trim()) || "").trim().slice(0, 50);
    const note = {
      id: genNoteId(),
      title: firstLine || (pane === "raw" ? "Raw" : "Morph"),
      content: content || "",
      extension: "txt",
      folderId: (typeof currentFolderId !== "undefined" && currentFolderId) ? currentFolderId : null,
      lastEdited: new Date().toISOString(),
      _created: true, _dirty: true
    };
    notes.push(note);
    return note;
  }

  let syncTimer = null;
  function scheduleSync() {
    if (typeof isSignedIn !== "function" || !isSignedIn()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { try { syncWithDrive(false); } catch (e) {} }, 1500);
  }

  // Commit a pane's current text into its bound note (creating one on first write).
  window.diffCommitPane = function (pane) {
    const t = el(pane);
    if (!t) return;
    const val = t.value;
    const id = window.diffGetBoundId(pane);
    let note = id ? diffNoteById(id) : null;
    if (!note) {
      if (!val.trim()) return;                 // don't create empty notes
      note = makeNote(pane, val);
      window.diffSetBoundId(pane, note.id);
    } else {
      if (note.content === val) return;
      note.content = val;
      note.lastEdited = new Date().toISOString();
      note._dirty = true;
    }
    if (typeof saveNotes === "function") saveNotes();
    try { if (typeof populateNoteList === "function") populateNoteList(); } catch (e) { console.error("sidebar render failed during diff commit", e); }
    scheduleSync();
  };

  const saveTimers = { raw: null, morph: null };
  const pendingEdit = { raw: false, morph: false };
  function saveBack(pane) {
    pendingEdit[pane] = true;
    clearTimeout(saveTimers[pane]);
    saveTimers[pane] = setTimeout(() => { pendingEdit[pane] = false; window.diffCommitPane(pane); }, 250);
  }
  function flushPending(pane) {
    if (pendingEdit[pane]) { clearTimeout(saveTimers[pane]); pendingEdit[pane] = false; window.diffCommitPane(pane); }
  }

  function wireInputListeners() {
    if (typeof diffElements === "undefined") return;
    ["raw", "morph"].forEach(pane => {
      const t = el(pane);
      if (!t || t.__diffShareWired) return;
      t.addEventListener("input", () => saveBack(pane));
      t.__diffShareWired = true;
    });
  }

  // Load bound notes' content into the panes (on entering the Diff Checker / on load).
  window.diffLoadBoundNotes = function () {
    wireInputListeners();   // re-attach if the pane elements were recreated since last time
    ["raw", "morph"].forEach(pane => {
      flushPending(pane);                              // commit any in-flight edit before reloading
      const t = el(pane);
      if (!t) return;
      const id = window.diffGetBoundId(pane);
      const note = id ? diffNoteById(id) : null;
      if (note) t.value = note.content || "";
      else if (id) window.diffSetBoundId(pane, "");   // stale binding (note was deleted)
    });
    if (typeof diffusion === "function") diffusion();
  };

  // Swap bindings when the user swaps the two panes (content is already swapped).
  window.diffSwapBindings = function () {
    const r = window.diffGetBoundId("raw"), m = window.diffGetBoundId("morph");
    window.diffSetBoundId("raw", m);
    window.diffSetBoundId("morph", r);
  };

  // ---- note picker (opened by re-clicking an already-active Raw/Morph button) ----
  function showPickBanner(pane) {
    hidePickBanner();
    const sb = document.getElementById("sidebar1");
    if (!sb) return;
    const b = document.createElement("div");
    b.id = "diffPickBanner";
    b.className = "diff-pick-banner";
    b.innerHTML = "<span>Pick a note for <b>" + (pane === "raw" ? "Raw" : "Morph") + "</b></span>" +
                  '<button onclick="diffCancelPick()">Cancel</button>';
    sb.insertBefore(b, sb.firstChild);
  }
  function hidePickBanner() { const b = document.getElementById("diffPickBanner"); if (b) b.remove(); }

  window.diffOpenNotePicker = function (pane) {
    window.__dexNotePick = function (noteId) { bindPicked(pane, noteId); };
    const sb = document.getElementById("sidebar1");
    if (sb) sb.classList.add("open");
    if (typeof renderSidebar === "function") renderSidebar();
    showPickBanner(pane);
    if (typeof showNotification === "function") showNotification("Pick a note for " + (pane === "raw" ? "Raw" : "Morph"));
  };

  function bindPicked(pane, noteId) {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = document.getElementById("sidebar1");
    if (sb) sb.classList.remove("open");
    const note = diffNoteById(noteId);
    if (!note) return;
    window.diffSetBoundId(pane, note.id);
    const t = el(pane);
    if (t) t.value = note.content || "";
    if (typeof diffusion === "function") diffusion();
    if (typeof showNotification === "function") showNotification((pane === "raw" ? "Raw" : "Morph") + " \u2190 " + (note.title || "note"));
  }

  window.diffCancelPick = function () {
    window.__dexNotePick = null;
    hidePickBanner();
    const sb = document.getElementById("sidebar1");
    if (sb) sb.classList.remove("open");
  };

  // ---- wiring ----
  function init() {
    // The sidebar lives inside the note-app container (display:none while in the
    // Diff Checker). Reparent it to <body> so it can overlay either app.
    const sb = document.getElementById("sidebar1");
    if (sb && sb.parentElement !== document.body) document.body.appendChild(sb);

    wireInputListeners();

    // Reload bound content whenever the Diff Checker is opened.
    if (typeof window.showDiffChecker === "function") {
      const orig = window.showDiffChecker;
      window.showDiffChecker = function () { const r = orig.apply(this, arguments); try { window.diffLoadBoundNotes(); } catch (e) {} return r; };
    }

    // Flush any in-flight (debounced) pane edit into its bound note.
    window.diffFlushAll = function () { flushPending("raw"); flushPending("morph"); };

    // If the note currently open in the Note App is bound to a pane, its
    // textarea can go stale (the underlying note object gets updated by
    // diffCommitPane, but the visible <textarea> is never re-read). Reopen
    // it so the editor reflects what was just typed in the Diff Checker.
    function refreshOpenNoteIfBound() {
      if (typeof currentNote === "undefined" || !currentNote) return;
      const boundRaw = window.diffGetBoundId("raw");
      const boundMorph = window.diffGetBoundId("morph");
      if (String(currentNote.id) === String(boundRaw) || String(currentNote.id) === String(boundMorph)) {
        if (typeof openNote === "function") openNote(currentNote.id);
      }
    }

    // Flush pending diff edits whenever the user navigates away from the
    // Diff Checker (into the Note App or the homepage), before anything
    // else runs, so the note data is current before it's displayed.
    if (typeof window.showNoteApp === "function") {
      const origShowNoteApp = window.showNoteApp;
      window.showNoteApp = function () {
        try { window.diffFlushAll(); } catch (e) {}
        const r = origShowNoteApp.apply(this, arguments);
        try { refreshOpenNoteIfBound(); } catch (e) {}
        return r;
      };
    }
    if (typeof window.showHomepage === "function") {
      const origShowHomepage = window.showHomepage;
      window.showHomepage = function () {
        try { window.diffFlushAll(); } catch (e) {}
        return origShowHomepage.apply(this, arguments);
      };
    }

    if (!document.getElementById("diffShareStyles")) {
      const st = document.createElement("style");
      st.id = "diffShareStyles";
      st.textContent =
        ".diff-pick-banner{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 14px;margin-top:25px;background:#0e1a18;border-bottom:1px solid rgba(144,209,200,.3);color:#cfeee9;font-size:13.5px;box-shadow:0 6px 16px rgba(0,0,0,.45);}" +
        ".diff-pick-banner b{color:#90d1c8;}" +
        ".diff-pick-banner button{background:#1a1a1f;border:1px solid #2a2a32;color:#c8c8d0;border-radius:7px;padding:6px 12px;font-family:inherit;font-size:12.5px;cursor:pointer;}" +
        ".diff-pick-banner button:hover{background:#24242c;color:#fff;}" +
        ".diff-settings-row input[type=\"checkbox\"]{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:5px;border:1.5px solid #3a3a44;background:transparent;cursor:pointer;position:relative;flex-shrink:0;margin:0;}" +
        ".diff-settings-row input[type=\"checkbox\"]:checked{background:#9ab0ff;border-color:#9ab0ff;}" +
        ".diff-settings-row input[type=\"checkbox\"]:checked::after{content:'';position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #0c0c0e;border-width:0 2px 2px 0;transform:rotate(45deg);}";
      document.head.appendChild(st);
    }

    // If the page boots straight into the Diff Checker, load once notes are ready.
    setTimeout(() => { try { window.diffLoadBoundNotes(); } catch (e) {} }, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
