function setupEventListeners() {
  safeAddListener(sidebar1Toggle, "click", e => {
    e.stopPropagation();
    if (document.body.classList.contains("mode-filemanager")) {
      document.body.classList.toggle("fm-sidebar-collapsed");
      refreshDpadVisibility();
      return;
    }
    const willOpen = !sidebar1.classList.contains("open");
    if (willOpen) {
      sidebar1.classList.add("open");
      sidebar1Toggle.innerHTML = '<i class="material-symbols-rounded">close</i>';
    } else if (typeof closeSidebar === "function") {
      closeSidebar();
    }
    refreshDpadVisibility();
  });

  const debouncedUpdate = debounce(updateNoteMetadata, 100);
  safeAddListener(noteTextarea, "input", debouncedUpdate);
  safeAddListener(noteTextarea, "input", () => populateNoteList());
  safeAddListener(noteTextarea, "focus", () => { if (currentNote) updateNoteMetadata(); });

  safeAddListener(noteAppBtn, "click", () => { showFileManager(); });
  safeAddListener(docsBtn, "click", () => { if (docsOverlay) docsOverlay.classList.add("open"); });
  safeAddListener(docsCloseBtn, "click", () => { if (docsOverlay) docsOverlay.classList.remove("open"); });
  safeAddListener(asteroidCloseBtn, "click", () => { if (typeof window.closeAsteroidBelt === "function") window.closeAsteroidBelt(); });

  document.querySelectorAll('input').forEach(input => {
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
  });

  safeAddListener(loginBtn, 'click', () => signIn());
  safeAddListener(logoutBtn, 'click', () => signOut());

  window.addEventListener("popstate", handlePopState);
}

function waitForSidebar(timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function c() {
      if (window.__dexSidebarReady) return resolve(true);
      if (Date.now() - start > timeout) return resolve(false);
      setTimeout(c, 30);
    })();
  });
}

async function init() {
  await waitForSidebar();
  migrateNotesToCrypto();
  folders = loadFolders();
  notes = await loadNotes();
  if (!Array.isArray(notes)) notes = [];
  buildSidebar();
  if (Array.isArray(notes)) { populateNoteList(); updateNoteVisibility(); updateDocumentInfo(); }

  setupEventListeners();
  handlePopState();
  updateAuthUI();

  const savedUser = localStorage.getItem("dexUser");
  if (localStorage.getItem("dexSignedIn") === "1" && savedUser) {
    try { currentUser = JSON.parse(savedUser); } catch (e) { currentUser = null; }
    if (currentUser) {
      updateAuthUI();
      waitForGis().then(() => afterSignIn(true));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { init(); });
