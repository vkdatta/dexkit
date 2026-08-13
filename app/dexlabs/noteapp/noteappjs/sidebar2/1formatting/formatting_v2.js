export const handleFormat = function (t) {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (s === e) {
      showNotification(`Please select text to ${t}!`);
      return;
    }
    const formatOptions =
      t === "italic"
        ? "MarkDown (*text*),MarkUp (<i>text</i>)"
        : t === "underline"
        ? "MarkDown (__text__),MarkUp (<u>text</u>)"
        : t === "bold"
        ? "MarkDown (**text**),MarkUp (<b>text</b>)"
        : "MarkDown (```),MarkUp (<code>)";
    const optionsArray = [
      { label: "Select option", value: "" },
      { label: formatOptions.split(",")[0], value: "1" },
      { label: formatOptions.split(",")[1], value: "2" }
    ];
    const result = await showModal({
      header: `<div class="modal-title">${
        t[0].toUpperCase() + t.slice(1)
      } Text</div>`,
      body: `<div style="display:flex;flex-direction:column;gap:10px;"><div><label class="modal-label">Choose Format</label><div class="custom-dropdown"><div id="formatType" class="custom-dropdown-trigger modal-input" data-options='${JSON.stringify(
        optionsArray
      )}'>Select option</div></div></div></div>`,
      footer: ` <button onclick="closeModal()">Cancel</button> <button onclick="handleFormatSubmit('${t}')" class="modal-btn">OK</button> `
    });
    if (!result || result.action !== "OK") return;
    const formatValue = result.format;
    if (!formatValue) return;
    const sel = v.slice(s, e);
    let formatted = "";
    if (t === "italic")
      formatted = formatValue === "2" ? `<i>${sel}</i>` : `*${sel}*`;
    else if (t === "underline")
      formatted = formatValue === "2" ? `<u>${sel}</u>` : `__${sel}__`;
    else if (t === "bold")
      formatted = formatValue === "2" ? `<b>${sel}</b>` : `**${sel}**`;
    else if (t === "code")
      formatted =
        formatValue === "2" ? `<code>${sel}</code>` : `\`\`\`\n${sel}\n\`\`\``;
    noteTextarea.value = v.slice(0, s) + formatted + v.slice(e);
    updateNoteMetadata();
    showNotification(`Text ${t} applied!`);
  })();
};

export const handleFormatSubmit = function (type) {
  const formatValue = modalScope.formatType
    ? modalScope.formatType.dataset.value
    : null;
  if (!formatValue) {
    showNotification("Please select a format!");
    return;
  }
  closeModal({ action: "OK", format: formatValue, type: type });
};

export const handleBulletList = function () {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (s === e) {
      showNotification("Please select text for bullet list!");
      return;
    }
    const optionsArray = [
      { label: "Select option", value: "" },
      { label: "MarkDown (- item)", value: "1" },
      { label: "MarkUp (&lt;ul&gt;&lt;li&gt;)", value: "2" }
    ];
    const result = await showModal({
      header: `<div class="modal-title">Bullet List</div>`,
      body: `<div style="display:flex;flex-direction:column;gap:10px;"><div><label class="modal-label">Choose Format</label><div class="custom-dropdown"><div id="listFormat" class="custom-dropdown-trigger modal-input" data-options='${JSON.stringify(
        optionsArray
      )}'>Select option</div></div></div></div>`,
      footer: ` <button onclick="closeModal()">Cancel</button> <button onclick="handleListSubmit('bullet')" class="modal-btn">OK</button> `
    });
    if (!result || result.action !== "OK") return;
    const formatValue = result.format;
    if (!formatValue) return;
    const sel = v.slice(s, e),
      lines = sel.split(/\r?\n/);
    let formatted;
    if (formatValue === "2") {
      formatted =
        "<ul>\n" +
        lines.map((t) => "<li>" + t + "</li>").join("\n") +
        "\n</ul>";
    } else {
      formatted = lines.map((t) => "- " + t).join("\n");
    }
    noteTextarea.value = v.slice(0, s) + formatted + v.slice(e);
    updateNoteMetadata();
    showNotification("Bullet list applied!");
  })();
};

export const handleNumberedList = function () {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (s === e) {
      showNotification("Please select text for numbered list!");
      return;
    }
    const optionsArray = [
      { label: "Select option", value: "" },
      { label: "MarkDown (1. item)", value: "1" },
      { label: "MarkUp (&lt;ol&gt;&lt;li&gt;)", value: "2" }
    ];
    const result = await showModal({
      header: `<div class="modal-title">Numbered List</div>`,
      body: `<div style="display:flex;flex-direction:column;gap:10px;"><div><label class="modal-label">Choose Format</label><div class="custom-dropdown"><div id="listFormat" class="custom-dropdown-trigger modal-input" data-options='${JSON.stringify(
        optionsArray
      )}'>Select option</div></div></div></div>`,
      footer: ` <button onclick="closeModal()">Cancel</button> <button onclick="handleListSubmit('numbered')" class="modal-btn">OK</button> `
    });
    if (!result || result.action !== "OK") return;
    const formatValue = result.format;
    if (!formatValue) return;
    const sel = v.slice(s, e),
      lines = sel.split(/\r?\n/);
    let formatted;
    if (formatValue === "2") {
      formatted =
        "<ol>\n" +
        lines.map((t) => "<li>" + t + "</li>").join("\n") +
        "\n</ol>";
    } else {
      formatted = lines.map((t, i) => i + 1 + ". " + t).join("\n");
    }
    noteTextarea.value = v.slice(0, s) + formatted + v.slice(e);
    updateNoteMetadata();
    showNotification("Numbered list applied!");
  })();
};

export const handleListSubmit = function (type) {
  const formatValue = modalScope.listFormat
    ? modalScope.listFormat.dataset.value
    : null;
  if (!formatValue) {
    showNotification("Please select a format!");
    return;
  }
  closeModal({ action: "OK", format: formatValue, listType: type });
};

export const handleInsertLink = function () {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    const formatOptionsArray = [
      { label: "Select option", value: "" },
      { label: "Markdown", value: "markdown" },
      { label: "MarkUp", value: "markup" }
    ];
    const result = await showModal({
      header: `<div class="modal-title">Insert Link</div>`,
      body: ` <div style="display: flex; gap: 10px; align-items: center;"> <div style="flex: 1;"> <label class="modal-label">URL</label> <input type="url" id="linkUrl" placeholder="Enter URL"> </div> </div> <div style="display: flex; gap: 10px; align-items: center;"> <div style="flex: 1;"> <label class="modal-label">Link Text</label> <input type="text" id="linkText" placeholder="Enter link text"> </div> </div> <div style="display: flex; gap: 10px; align-items: center;"> <div style="flex: 1;"> <label class="modal-label">Format</label> <div class="custom-dropdown"> <div id="linkFormat" class="custom-dropdown-trigger modal-input" data-options='${JSON.stringify(
        formatOptionsArray
      )}'>Select option</div> </div> </div> </div> `,
      footer: ` <button onclick="closeModal()">Cancel</button> <button onclick="handleLinkSubmit()" class="modal-btn">Submit</button> `
    });
    if (!result || result.action !== "submit") return;
    const url = result.url;
    const text = result.text;
    const format = result.format;
    if (!url || !text || !format) return;
    const link =
      format === "markup"
        ? `<a href="${url}">${text}</a>`
        : `[${text}](${url})`;
    noteTextarea.value = v.slice(0, s) + link + v.slice(e);
    updateNoteMetadata();
    showNotification("Link inserted!");
  })();
};

export const handleLinkSubmit = function () {
  const url = modalScope.linkUrl ? modalScope.linkUrl.value.trim() : "";
  const text = modalScope.linkText ? modalScope.linkText.value.trim() : "";
  const format = modalScope.linkFormat
    ? modalScope.linkFormat.dataset.value
    : "";
  if (!url || !text || !format) {
    showNotification("Please fill in all fields!");
    return;
  }
  closeModal({ action: "submit", url: url, text: text, format: format });
};

export const handleInsertImage = function () {
  return preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    const formatOptionsArray = [
      { label: "Select option", value: "" },
      { label: "Markdown", value: "markdown" },
      { label: "MarkUp", value: "markup" }
    ];
    const result = await showModal({
      header: `<div class="modal-title">Insert Image</div>`,
      body: ` <div style="display: flex; gap: 10px; align-items: center;"> <div style="flex: 1;"> <label class="modal-label">Image URL</label> <input type="url" id="imageUrl" placeholder="Enter image URL"> </div> </div> <div style="display: flex; gap: 10px; align-items: center;"> <div style="flex: 1;"> <label class="modal-label">Format</label> <div class="custom-dropdown"> <div id="imageFormat" class="custom-dropdown-trigger modal-input" data-options='${JSON.stringify(
        formatOptionsArray
      )}'>Select option</div> </div> </div> </div> `,
      footer: ` <button onclick="closeModal()">Cancel</button> <button onclick="handleImageSubmit()" class="modal-btn">Insert</button> `
    });
    if (!result || result.action !== "submit") return;
    const url = result.url;
    const format = result.format;
    if (!url || !format) return;
    const image =
      format === "markup"
        ? `<img src="${url}" alt="Image" />`
        : `![Image](${url})`;
    noteTextarea.value =
      s === e ? v + image : v.slice(0, s) + image + v.slice(e);
    updateNoteMetadata();
    showNotification("Image inserted!");
  })();
};

export const handleImageSubmit = function () {
  const url = modalScope.imageUrl ? modalScope.imageUrl.value.trim() : "";
  const format = modalScope.imageFormat
    ? modalScope.imageFormat.dataset.value
    : "";
  if (!url || !format) {
    showNotification("Please fill in all fields!");
    return;
  }
  closeModal({ action: "submit", url: url, format: format });
};

export const handleUppercase = function () {
  const r = preserveSelection(function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (!v) return;
    const f =
      s === e
        ? v.toUpperCase()
        : v.slice(0, s) + v.slice(s, e).toUpperCase() + v.slice(e);
    noteTextarea.value = f;
    updateNoteMetadata();
    showNotification("Converted to uppercase!");
  });
  return typeof r === "function" ? r() : r;
};

export const handleLowercase = function () {
  const r = preserveSelection(function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (!v) return;
    const f =
      s === e
        ? v.toLowerCase()
        : v.slice(0, s) + v.slice(s, e).toLowerCase() + v.slice(e);
    noteTextarea.value = f;
    updateNoteMetadata();
    showNotification("Converted to lowercase!");
  });
  return typeof r === "function" ? r() : r;
};

export const handleAlignLeft = function () {
  if (!noteTextarea) return;
  noteTextarea.style.textAlign = "left";
  showNotification("Text aligned left!");
};

export const handleAlignCenter = function () {
  if (!noteTextarea) return;
  noteTextarea.style.textAlign = "center";
  showNotification("Text aligned center!");
};

export const handleAlignRight = function () {
  if (!noteTextarea) return;
  noteTextarea.style.textAlign = "right";
  showNotification("Text aligned right!");
};

export const increaseIndentation = function () {
  const r = preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd;
    if (s === e) {
      showNotification("Please select text to indent!");
      return;
    }
    const t = noteTextarea.value.slice(s, e),
      i = "\t" + t.replace(/\n/g, "\n\t");
    noteTextarea.value =
      noteTextarea.value.slice(0, s) + i + noteTextarea.value.slice(e);
    updateNoteMetadata();
    showNotification("Text indented!");
  });
  return "function" == typeof r ? r() : r;
};

export const decreaseIndentation = function () {
  const r = preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd;
    if (s === e) {
      showNotification("Please select text to un-indent!");
      return;
    }
    const t = noteTextarea.value.slice(s, e).split("\n"),
      i = t
        .map((e) =>
          e.startsWith("\t") ? e.slice(1) : e.startsWith(" ") ? e.slice(4) : e
        )
        .join("\n");
    noteTextarea.value =
      noteTextarea.value.slice(0, s) + i + noteTextarea.value.slice(e);
    updateNoteMetadata();
    showNotification("Indentation removed!");
  });
  return "function" == typeof r ? r() : r;
};

export const handleSelectAll = function () {
  if (!currentNote || !noteTextarea) return;
  noteTextarea.setSelectionRange(0, noteTextarea.value.length);
  noteTextarea.blur();
  showNotification("All text selected!");
};

export const handleCopyNote = function () {
  if (!currentNote || !noteTextarea) return;
  const s = noteTextarea.selectionStart,
    e = noteTextarea.selectionEnd,
    t = s === e ? noteTextarea.value : noteTextarea.value.slice(s, e);
  navigator.clipboard
    .writeText(t)
    .then(() => showNotification("Copied to clipboard!"))
    .catch(() => showNotification("Copy failed (clipboard not available)."));
};

export const handleCutNote = function () {
  if (!currentNote || !noteTextarea) return;
  const s = noteTextarea.selectionStart,
    e = noteTextarea.selectionEnd,
    t = s === e ? noteTextarea.value : noteTextarea.value.slice(s, e);
  navigator.clipboard
    .writeText(t)
    .then(() => {
      noteTextarea.value =
        s === e
          ? ""
          : noteTextarea.value.slice(0, s) + noteTextarea.value.slice(e);
      noteTextarea.selectionStart = noteTextarea.selectionEnd = s;
      updateNoteMetadata();
      showNotification("Cut to clipboard!");
    })
    .catch(() => showNotification("Cut failed (clipboard not available)."));
};

export const handleClearNote = function () {
  const r = preserveSelection(async function () {
    if (!currentNote || !noteTextarea) return;
    const s = noteTextarea.selectionStart,
      e = noteTextarea.selectionEnd,
      v = noteTextarea.value;
    if (s === e) {
      noteTextarea.value = "";
    } else {
      noteTextarea.value = v.slice(0, s) + v.slice(e);
    }
    updateNoteMetadata();
    showNotification("Note cleared!");
  });
  return "function" == typeof r ? r() : r;
};

export const handlePasteNote = function () {
  const r = async function () {
    if (!currentNote || !noteTextarea) return;
    if (!navigator.clipboard || !navigator.permissions) {
      showNotification("Paste not supported in this browser.");
      return;
    }
    try {
      const perm = await navigator.permissions.query({
        name: "clipboard-read"
      });
      if (perm.state === "denied") {
        showNotification(
          "Clipboard access denied. Please allow it in your browser settings."
        );
        return;
      }
      const clip = await navigator.clipboard.readText();
      const s = noteTextarea.selectionStart,
        e = noteTextarea.selectionEnd;
      noteTextarea.value =
        noteTextarea.value.slice(0, s) + clip + noteTextarea.value.slice(e);
      const n = s + clip.length;
      noteTextarea.selectionStart = noteTextarea.selectionEnd = n;
      updateNoteMetadata();
      showNotification("Pasted from clipboard!");
    } catch {
      showNotification("Paste failed (permission denied or empty clipboard).");
    }
  };
  r();
};

// The following were immediately-invoked in the original script (i.e. they
// call preserveSelection(...) right away at definition time, rather than
// returning a handler to be called later). That behavior is preserved here.

export const reverseText = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  let s = noteTextarea.selectionStart,
    e = noteTextarea.selectionEnd;
  if (s === e)
    noteTextarea.value = noteTextarea.value.split("").reverse().join("");
  else {
    let t = noteTextarea.value,
      n = t.substring(s, e),
      r = n.split("").reverse().join("");
    noteTextarea.value = t.substring(0, s) + r + t.substring(e);
  }
  try {
    updateNoteMetadata();
    showNotification("Text reversed!");
  } catch (err) {
    console.error("Error updating note metadata:", err);
    showNotification("Failed to update note metadata");
  }
});

export const reverseWords = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  const s = noteTextarea.selectionStart;
  const e = noteTextarea.selectionEnd;
  if (s === e) {
    noteTextarea.value = noteTextarea.value.split(/\s+/).reverse().join(" ");
  } else {
    const t = noteTextarea.value;
    const n = t.substring(s, e);
    const r = n.split(/\s+/).reverse().join(" ");
    noteTextarea.value = t.substring(0, s) + r + t.substring(e);
  }
  updateNoteMetadata();
  showNotification("Words reversed!");
});

export const capitalizeWords = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  const s = noteTextarea.selectionStart;
  const e = noteTextarea.selectionEnd;
  if (s === e) {
    noteTextarea.value = noteTextarea.value.replace(
      /\b\w+/g,
      (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    );
  } else {
    const t = noteTextarea.value;
    const n = t.substring(s, e);
    const r = n.replace(
      /\b\w+/g,
      (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    );
    noteTextarea.value = t.substring(0, s) + r + t.substring(e);
  }
  updateNoteMetadata();
  showNotification("Words capitalized!");
});

export const capitalizeSentences = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  const s = noteTextarea.selectionStart;
  const e = noteTextarea.selectionEnd;
  if (s === e) {
    noteTextarea.value = noteTextarea.value
      .toLowerCase()
      .replace(/(^\s*[a-z])|([.!?]\s*[a-z])/g, (t) => t.toUpperCase());
  } else {
    const t = noteTextarea.value;
    const n = t.substring(s, e).toLowerCase();
    const r = n.replace(/(^\s*[a-z])|([.!?]\s*[a-z])/g, (t) => t.toUpperCase());
    noteTextarea.value = t.substring(0, s) + r + t.substring(e);
  }
  updateNoteMetadata();
  showNotification("Sentences capitalized!");
});
