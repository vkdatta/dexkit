// ===================== JS Optimizer / Minifier =====================

export const optimisejs = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  try {
    const src = noteTextarea.value || "";
    const len = src.length;
    let i = 0;
    let out = "";
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inRegex = false;
    let inLineComment = false;
    let inBlockComment = false;
    let prevChar = "";
    let prevNonWS = "";
    const canStartRegex = (c) => {
      return c === "" || /[=(:,!&|?{};\n\t\0\[\-+*~^<>%]/.test(c);
    };
    const appendChar = (ch) => {
      out += ch;
      if (!/\s/.test(ch)) prevNonWS = ch;
      prevChar = ch;
    };
    while (i < len) {
      const ch = src[i];
      const next = src[i + 1];
      if (inLineComment) {
        if (ch === "\n") {
          inLineComment = false;
          appendChar("\n");
        }
        i++;
        continue;
      }
      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (inRegex) {
        if (ch === "\\" && i + 1 < len) {
          appendChar(ch);
          appendChar(src[i + 1]);
          i += 2;
          continue;
        }
        if (ch === "/" && prevChar !== "\\") {
          appendChar(ch);
          i++;
          while (i < len && /[a-zA-Z]/.test(src[i])) {
            appendChar(src[i]);
            i++;
          }
          inRegex = false;
          continue;
        }
        appendChar(ch);
        i++;
        continue;
      }
      if (inSingle || inDouble) {
        if (ch === "\\" && i + 1 < len) {
          appendChar(ch);
          appendChar(src[i + 1]);
          i += 2;
          continue;
        }
        if ((inSingle && ch === "'") || (inDouble && ch === '"')) {
          appendChar(ch);
          if (inSingle) inSingle = false;
          else inDouble = false;
          i++;
          continue;
        }
        appendChar(ch);
        i++;
        continue;
      }
      if (inTemplate) {
        if (ch === "$" && next === "{") {
          appendChar(ch);
          appendChar("{");
          i += 2;
          let depth = 1;
          while (i < len && depth > 0) {
            const c = src[i], n = src[i + 1];
            if (c === "/" && n === "/") {
              i += 2;
              while (i < len && src[i] !== "\n") i++;
              continue;
            }
            if (c === "/" && n === "*") {
              i += 2;
              while (i + 1 < len && !(src[i] === "*" && src[i + 1] === "/")) i++;
              if (i + 1 < len) i += 2;
              continue;
            }
            if (c === "'" || c === '"') {
              const q = c;
              appendChar(c);
              i++;
              while (i < len) {
                const cc = src[i];
                appendChar(cc);
                if (cc === "\\" && i + 1 < len) {
                  appendChar(src[i + 1]);
                  i += 2;
                  continue;
                }
                i++;
                if (cc === q) break;
              }
              continue;
            }
            if (c === "/") {
              const prev = (out && out.slice(-1)) || prevNonWS || "";
              if (canStartRegex(prev) && src[i + 1] !== "/" && src[i + 1] !== "*") {
                appendChar("/");
                i++;
                while (i < len) {
                  const rc = src[i];
                  appendChar(rc);
                  if (rc === "\\" && i + 1 < len) {
                    appendChar(src[i + 1]);
                    i += 2;
                    continue;
                  }
                  if (rc === "/") {
                    i++;
                    break;
                  }
                  i++;
                }
                while (i < len && /[a-zA-Z]/.test(src[i])) {
                  appendChar(src[i]);
                  i++;
                }
                continue;
              }
            }
            if (c === "{") {
              appendChar(c);
              i++;
              depth++;
              continue;
            }
            if (c === "}") {
              appendChar(c);
              i++;
              depth--;
              continue;
            }
            appendChar(c);
            i++;
          }
          continue;
        }
        if (ch === "`" && prevChar !== "\\") {
          appendChar(ch);
          inTemplate = false;
          i++;
          continue;
        }
        appendChar(ch);
        i++;
        continue;
      }
      if (ch === "/" && next === "/") {
        if (prevNonWS === ":") {
          appendChar(ch);
          i++;
          continue;
        } else {
          inLineComment = true;
          i += 2;
          continue;
        }
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingle = true;
        appendChar(ch);
        i++;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        appendChar(ch);
        i++;
        continue;
      }
      if (ch === "`") {
        inTemplate = true;
        appendChar(ch);
        i++;
        continue;
      }
      if (ch === "/") {
        if (next !== "/" && next !== "*" && canStartRegex(prevNonWS)) {
          inRegex = true;
          appendChar(ch);
          i++;
          continue;
        } else {
          appendChar(ch);
          i++;
          continue;
        }
      }
      appendChar(ch);
      i++;
    }
    const cleaned =
      out
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/g, ""))
        .filter((line) => line.trim() !== "")
        .join("\n") + "\n";
    noteTextarea.value = cleaned;
    updateNoteMetadata();
    showNotification("Comments removed and code compacted.");
  } catch (err) {
    console.error("removeJsCommentsAndCompact error:", err);
    showNotification("Failed to remove comments");
  }
});

export const minifyjs = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  const originalShowNotification = window.showNotification;
  window.showNotification = () => {};
  try {
    if (typeof optimisejs === "function") {
      await optimisejs();
    } else {
      throw new Error("optimisejs is not defined");
    }
    noteTextarea.value = noteTextarea.value
      .replace(/\r\n|\r|\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (err) {
    console.error("minifyjs error:", err);
  } finally {
    window.showNotification = originalShowNotification;
  }
  showNotification("Minified JS");
});
