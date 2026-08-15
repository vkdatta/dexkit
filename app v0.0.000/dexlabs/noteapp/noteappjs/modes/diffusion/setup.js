  function diffCommit(type) { if (typeof diffCommitPane === 'function') diffCommitPane(type); }

  function diffHandleFile(input, type) {
    const file = input.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      if (type === 'raw') diffElements.raw.value = e.target.result;
      else diffElements.morph.value = e.target.result;
      diffusion();
      diffCommit(type);
      if (typeof showNotification === "function") showNotification("Loaded file into " + (type === "raw" ? "Raw" : "Morph") + "");
    };
    r.readAsText(file);
    input.value = '';
  }

  function diffSwapTexts() {
    const temp = diffElements.raw.value;
    diffElements.raw.value = diffElements.morph.value;
    diffElements.morph.value = temp;
    diffusion();
    if (typeof diffSwapBindings === 'function') diffSwapBindings();
    if (typeof showNotification === "function") showNotification("Swapped Raw and Morph");
  }

  function diffClearText(type) {
    if (type === 'raw') diffElements.raw.value = '';
    else diffElements.morph.value = '';
    diffusion();
    diffCommit(type);
    if (typeof showNotification === "function") showNotification("Cleared " + (type === "raw" ? "Raw" : "Morph") + "");
  }

async function diffCopyText(type) {
  const label = type === 'raw' ? 'Raw' : 'Morph';
  const ta = type === 'raw' ? diffElements.raw : diffElements.morph;
  if (!ta.value) return;

  try {
    await navigator.clipboard.writeText(ta.value);
    if (typeof showNotification === "function") showNotification("Copied " + label);
    return;
  } catch (err) {
  }

  ta.focus();
  ta.select();
  let legacyOk = false;
  try { legacyOk = document.execCommand('copy'); } catch (err2) { legacyOk = false; }
  if (typeof showNotification === "function") {
    showNotification(legacyOk
      ? "Copied " + label
      : label + " selected — clipboard blocked, copy manually (long-press or Ctrl/Cmd+C)");
  }
}

async function diffPasteText(type) {
  const label = type === 'raw' ? 'Raw' : 'Morph';
  const ta = type === 'raw' ? diffElements.raw : diffElements.morph;

  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    ta.value = text;
    diffusion();
    diffCommit(type);
    if (typeof showNotification === "function") showNotification("Pasted into " + label);
    return;
  } catch (err) {
  }

  ta.focus();
  if (typeof showNotification === "function") {
    showNotification("Clipboard blocked — tap " + label + " and paste manually (long-press or Ctrl/Cmd+V)");
  }
}
