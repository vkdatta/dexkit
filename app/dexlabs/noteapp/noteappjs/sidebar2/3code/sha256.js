// ===================== SHA-256 =====================

export async function SHA256() {
  if (!noteTextarea) return;
  const encoder = new TextEncoder();
  const data = encoder.encode(noteTextarea.value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  noteTextarea.value = hashHex;
  updateNoteMetadata();
  showNotification("SHA-256 Generated!");
}
