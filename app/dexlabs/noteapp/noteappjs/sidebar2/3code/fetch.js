// ===================== Fetch Website Source =====================

export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function handleFetchSubmit() {
  closeModal({
    action: "submit",
    fetchUrl: modalScope && modalScope.fetchUrlInput ? modalScope.fetchUrlInput.value.trim() : ""
  });
}

export async function fetchUrlToCurrentNote(url) {
  const API_URL = "https://fetch-300199660511.us-central1.run.app/fetch";
  if (!currentNote || !noteTextarea) {
    showNotification("No note selected or editor missing");
    return;
  }
  if (!url) {
    showNotification("Please enter a URL");
    return;
  }
  showNotification("Fetching...");
  try {
    const resp = await window.fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() })
    });
    if (!resp.ok) {
      showNotification("Fetch failed: " + resp.status + " " + resp.statusText);
      return;
    }
    const data = await resp.json();
    const source = data.source_url || data.source || data.html || null;
    if (!source) {
      showNotification("No source returned");
      return;
    }
    const temp = document.createElement("div");
    temp.innerHTML = source || "";
    const html = temp.textContent || temp.innerText || "";
    noteTextarea.value = (noteTextarea.value || "") + "\n\n<!-- appended from fetch -->\n\n" + html;
    currentNote.extension = "html";
    currentNote.lastEdited = new Date().toISOString();
    const idx = notes.findIndex((n) => n.id === currentNote.id);
    if (idx !== -1) {
      notes[idx].extension = currentNote.extension;
      notes[idx].lastEdited = currentNote.lastEdited;
    }
    if (typeof updateNoteMetadata === "function") updateNoteMetadata();
    if (typeof populateNoteList === "function") populateNoteList();
    if (typeof updateDocumentInfo === "function") updateDocumentInfo();
    if (typeof immediatePlainRender === "function") immediatePlainRender();
    if (typeof scheduleUpdate === "function") scheduleUpdate(true);
    showNotification("Fetched and appended. Note extension set to .html");
  } catch (err) {
    showNotification("Request failed: " + (err && err.message ? err.message : err));
  }
}

export function openFetchModal() {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) {
      showNotification("No note selected or editor missing");
      return;
    }
    const r = await showModal({
      header: '<div class="modal-title">Fetch Website Source</div>',
      body:
        '<div style="display:flex;flex-direction:column;gap:8px;"><div><label class="modal-label">URL</label><input type="text" id="fetchUrlInput" placeholder="https://example.com" class="modal-input" /></div></div>',
      footer: '<button onclick="closeModal()">Cancel</button><button onclick="handleFetchSubmit()" class="modal-btn">Fetch</button>',
      html: true
    });
    if (!r || r.action !== "submit") return;
    const url = (r.fetchUrl || "").trim();
    if (!url) {
      showNotification("Please enter a URL");
      return;
    }
    await fetchUrlToCurrentNote(url);
  })();
}
