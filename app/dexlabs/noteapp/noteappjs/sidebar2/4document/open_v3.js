// Open files OR an entire folder into the notes app.
// Files/folders are imported into whatever folder the sidebar is currently in
// (currentFolderId), or root. Uses the dynamic crypto-id model (genNoteId /
// genFolderId / notes[] / folders[]) — no more fixed slots.

const OPEN_ACCEPT =
  ".txt,.md,.csv,.json,.xml,.yml,.yaml,.js,.ts,.jsx,.tsx,.html,.css,.py,.java,.c,.cpp,.h,.go,.rb,.php,.rs,.swift,.sh,.bat,Dockerfile,Makefile,.env,.ini,.toml,.conf,.log,.dockerignore";

function dexReadText(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => resolve("");
    try { r.readAsText(file); } catch (e) { resolve(""); }
  });
}

function dexSplitName(name) {
  const parts = String(name || "untitled").split(".");
  if (parts.length > 1) {
    const ext = parts.pop().toLowerCase() || "txt";
    return { base: parts.join(".") || name, ext };
  }
  return { base: name, ext: "txt" };
}

function dexMakeNote(base, content, ext, folderId) {
  const note = {
    id: genNoteId(),
    title: base || "untitled",
    content: content || "",
    extension: ext || "txt",
    folderId: folderId || null,
    lastEdited: new Date().toISOString(),
    _created: true,
    _dirty: true
  };
  notes.push(note);
  return note;
}

function dexRefreshSidebar() {
  if (typeof populateNoteList === "function") populateNoteList();
  else if (typeof renderSidebar === "function") renderSidebar();
}

async function dexImportFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const parentId = (typeof currentFolderId !== "undefined" && currentFolderId) ? currentFolderId : null;
  let first = null, count = 0;
  for (const file of files) {
    const { base, ext } = dexSplitName(file.name);
    const content = await dexReadText(file);
    const note = dexMakeNote(base, content, ext, parentId);
    if (!first) first = note;
    count++;
  }
  saveNotes();
  dexRefreshSidebar();
  showNotification("Opened " + count + " file" + (count === 1 ? "" : "s"));
  if (first) showNoteApp(first.id);
  if (typeof isSignedIn === "function" && isSignedIn()) syncWithDrive(false);
}

async function dexImportFolder(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const rootParent = (typeof currentFolderId !== "undefined" && currentFolderId) ? currentFolderId : null;

  // key = "dir/dir2" relative to the import root; value = folderId
  const folderMap = { "": rootParent };

  function ensureFolderPath(segments) {
    let parentId = rootParent, keyAcc = "";
    for (const seg of segments) {
      keyAcc = keyAcc ? keyAcc + "/" + seg : seg;
      if (folderMap[keyAcc] !== undefined) { parentId = folderMap[keyAcc]; continue; }
      const fid = genFolderId();
      folders.push({ id: fid, name: seg, parentId: parentId });
      folderMap[keyAcc] = fid;
      parentId = fid;
    }
    return parentId;
  }

  let first = null, noteCount = 0;
  for (const file of files) {
    const rel = file.webkitRelativePath || file.name;      // e.g. "project/src/main.js"
    const parts = rel.split("/").filter(Boolean);
    const fname = parts.pop();
    const folderId = ensureFolderPath(parts);              // rebuilds the folder tree
    const { base, ext } = dexSplitName(fname);
    const content = await dexReadText(file);
    const note = dexMakeNote(base, content, ext, folderId);
    if (!first) first = note;
    noteCount++;
  }

  const folderCount = Object.keys(folderMap).length - 1;   // minus the "" root entry
  if (typeof saveFolders === "function") saveFolders();
  saveNotes();
  dexRefreshSidebar();
  showNotification("Imported " + noteCount + " file" + (noteCount === 1 ? "" : "s") + " in " + folderCount + " folder" + (folderCount === 1 ? "" : "s"));
  if (first) showNoteApp(first.id);
  if (typeof isSignedIn === "function" && isSignedIn()) syncWithDrive(false);
}

function dexOpenPicker(kind) {
  const input = document.createElement("input");
  input.type = "file";
  if (kind === "folder") {
    input.webkitdirectory = true;
    input.directory = true;
    input.multiple = true;
  } else {
    input.multiple = true;
    input.accept = OPEN_ACCEPT;
  }
  input.onchange = (ev) => {
    const list = ev.target.files;
    if (kind === "folder") dexImportFolder(list);
    else dexImportFiles(list);
  };
  input.click();
}

// Called from the modal footer buttons.
window.dexOpenPick = function (kind) {
  closeModal();
  dexOpenPicker(kind);
};

export function handleOpenFile() {
  const where = (typeof currentFolderId !== "undefined" && currentFolderId)
    ? ((folderById(currentFolderId) || {}).name || "this folder")
    : "root";
  showModal({
    header: `<div class="modal-title">Open</div>`,
    body: `
      <div>
        <label class="modal-label">Import into <b>${where}</b>. Choose files, or a whole folder (its structure is kept).</label>
      </div>
    `,
    footer: `
      <button onclick="closeModal()">Cancel</button>
      <button onclick="dexOpenPick('file')" class="modal-btn">File(s)</button>
      <button onclick="dexOpenPick('folder')" class="modal-btn">Folder</button>
    `
  });
}
