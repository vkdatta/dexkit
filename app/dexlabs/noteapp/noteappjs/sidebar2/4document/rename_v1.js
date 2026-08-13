// ============================================================================
// DexLabs — Rename modal, v2 (CM5-era).
//
// The previous rename.js ended with Prism-era calls (immediatePlainRender,
// noteBackdrop.style, scheduleUpdate, currentHighlightLanguage) that are all
// no-ops after the CM5 migration — so a rename that changed the extension
// (e.g. .txt → .js) never updated syntax highlighting.
//
// This version:
//   - keeps the same modal + submission flow
//   - after applying the new extension, calls window.dexEditor.setLanguage(ext)
//     to switch CM's mode immediately
//   - calls cm.refresh() to force a redraw
//   - drops all dead Prism calls
// ============================================================================
export function handleRename() {
  const e = preserveSelection(async function () {
    if (!currentNote) return void showNotification("No note selected");
    const t = currentNote.title || "";
    const n = currentNote.extension || "";
    const o = await showModal({
      header: '<div class="modal-title">Rename Note</div>',
      body:
        '<div style="display:flex;gap:10px;align-items:center;">' +
          '<div style="flex:1;">' +
            '<label class="modal-label">Name</label>' +
            '<input type="text" id="newTitle" placeholder="Enter Name" value="' +
              String(t).replace(/"/g, "&quot;") + '">' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
          '<div style="flex:1;">' +
            '<label class="modal-label">Extension</label>' +
            '<input type="text" id="newExtension" placeholder="Enter Extension" value="' +
              String(n).replace(/"/g, "&quot;") + '">' +
          '</div>' +
        '</div>',
      footer:
        '<button onclick="closeModal()">Cancel</button>' +
        '<button onclick="handleRenameSubmit()" class="modal-btn">Rename</button>'
    });
    if (!o || o.action !== "OK") return;

    let a = String(o.newTitle || "").trim();
    let i = String(o.newExtension || "").trim();
    if (!a && !i) return;
    a = a || t;
    i = i || n;

    const newExt = i.replace(/^\./, "").toLowerCase();
    const extensionChanged = newExt !== (currentNote.extension || "").toLowerCase();

    currentNote.title = a;
    currentNote.extension = newExt;
    currentNote.lastEdited = new Date().toISOString();

    const l = notes.findIndex((e) => e.id === currentNote.id);
    if (l !== -1) {
      notes[l].title = a;
      notes[l].extension = newExt;
      notes[l].lastEdited = currentNote.lastEdited;
    }

    updateNoteMetadata();
    populateNoteList();
    updateDocumentInfo();
    showNotification("Note updated!");

    // Retarget CM's language mode if the extension changed. This is the piece
    // that was missing in the Prism-era rename.js — without it, changing
    // a note from .txt → .js required a refresh to see syntax colouring.
    if (extensionChanged && window.dexEditor && typeof window.dexEditor.setLanguage === "function") {
      try { window.dexEditor.setLanguage(newExt); } catch (err) {}
    }
    // Force a redraw so the new mode's tokens paint immediately.
    if (window.dexEditor && window.dexEditor.cm && typeof window.dexEditor.cm.refresh === "function") {
      try { window.dexEditor.cm.refresh(); } catch (err) {}
    }
    // Notify anything else that cares (line-number gutter, prism-off toggle, etc.)
    try { window.dispatchEvent(new CustomEvent("dexNoteOpened", { detail: { note: currentNote } })); } catch (err) {}
  });
  return typeof e === "function" ? e() : e;
}

export function handleRenameSubmit() {
  closeModal({
    action: "OK",
    newTitle: modalScope.newTitle ? modalScope.newTitle.value : "",
    newExtension: modalScope.newExtension ? modalScope.newExtension.value : ""
  });
  // No post-close refresh needed — handleRename above now retargets CM's
  // mode and refreshes the editor as part of its own flow.
}
