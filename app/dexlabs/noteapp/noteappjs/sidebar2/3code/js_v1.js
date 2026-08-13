// ===================== Robust JS comment remover / minifier =====================
//
// Single-pass lexer. It tracks the previous *significant token* (not just the
// previous character) so a `/` is correctly classified as a regex literal vs a
// division operator — the thing that broke the old character-level version.
// Strings, template literals (with nested `${ ... }` and nested templates),
// regex literals (with character classes + escapes), and both comment kinds are
// all handled.
//
// Line comments  -> removed (the trailing newline is kept).
// Block comments -> replaced with a newline if multi-line, else a space
//                   (preserves ASI / token separation).

export function removeComments(src) {
  const N = src.length;
  let i = 0;
  let out = "";

  let regexAllowed = true;   // can a `/` here begin a regex literal?
  let lastWord = "";
  let lastKind = "op";       // 'op' | 'name' | 'value'
  let afterDot = false;      // previous significant token was `.` / `?.`
  let pendingBlock = false;  // next `{` is a block (after `=>` or a control `)`)

  const parenStack = [];     // true if `(` followed if/for/while/with/switch/catch
  const braceStack = [];     // 'block' | 'object'

  const CONTROL = new Set(["if", "for", "while", "with", "switch", "catch"]);
  const VALUE_KW = new Set(["this", "super", "true", "false", "null"]);
  const KEYWORDS = new Set([
    "break", "case", "catch", "class", "const", "continue", "debugger",
    "default", "delete", "do", "else", "export", "extends", "finally", "for",
    "function", "if", "import", "in", "instanceof", "new", "return", "switch",
    "throw", "try", "typeof", "var", "void", "while", "with", "yield", "await",
    "let",
  ]);

  const emit = (s) => { out += s; };
  const isIdStart = (c) =>
    c !== undefined && (/[A-Za-z_$#]/.test(c) || c.charCodeAt(0) > 127);
  const isIdPart = (c) =>
    c !== undefined && (/[A-Za-z0-9_$]/.test(c) || c.charCodeAt(0) > 127);

  function scanString(q) {
    emit(q); i++;
    while (i < N) {
      const c = src[i];
      if (c === "\\") { emit(c); if (i + 1 < N) { emit(src[i + 1]); i += 2; } else i++; continue; }
      emit(c); i++;
      if (c === q) return;
      if (c === "\n") return; // unterminated; bail defensively
    }
  }

  function scanRegex() {
    emit("/"); i++;
    let inClass = false;
    while (i < N) {
      const c = src[i];
      if (c === "\\") { emit(c); if (i + 1 < N) { emit(src[i + 1]); i += 2; } else i++; continue; }
      if (c === "\n") return;                       // unterminated; bail
      if (c === "[") { inClass = true; emit(c); i++; continue; }
      if (c === "]") { inClass = false; emit(c); i++; continue; }
      if (c === "/" && !inClass) { emit(c); i++; break; }
      emit(c); i++;
    }
    while (i < N && isIdPart(src[i])) { emit(src[i]); i++; } // flags
    regexAllowed = false;
  }

  function scanNumber() {
    while (i < N) {
      const c = src[i];
      if (/[0-9a-zA-Z_.$]/.test(c)) { emit(c); i++; }
      else if ((c === "+" || c === "-") && /[eE]/.test(src[i - 1])) { emit(c); i++; }
      else break;
    }
    regexAllowed = false;
  }

  function scanTemplate() {
    emit("`"); i++;
    while (i < N) {
      const c = src[i];
      if (c === "\\") { emit(c); if (i + 1 < N) { emit(src[i + 1]); i += 2; } else i++; continue; }
      if (c === "`") { emit("`"); i++; return; }
      if (c === "$" && src[i + 1] === "{") {
        emit("${"); i += 2;
        regexAllowed = true; lastKind = "op"; afterDot = false; pendingBlock = false;
        scanCode(true);                              // scans until matching }
        if (src[i] === "}") { emit("}"); i++; }
        regexAllowed = false; lastKind = "value"; afterDot = false;
        continue;
      }
      emit(c); i++;
    }
  }

  // When inSubst is true, returns at the `}` that closes the enclosing `${ ... }`.
  function scanCode(inSubst) {
    let depth = 0; // nesting of code braces local to this call
    while (i < N) {
      const ch = src[i];

      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" ||
          ch === "\v" || ch === "\f" || ch === "\u00a0") { emit(ch); i++; continue; }

      if (ch === "/" && src[i + 1] === "/") {          // line comment -> remove
        i += 2;
        while (i < N && src[i] !== "\n") i++;
        continue;
      }
      if (ch === "/" && src[i + 1] === "*") {          // block comment -> space/newline
        i += 2;
        let nl = false;
        while (i < N && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") nl = true; i++; }
        i += 2;
        emit(nl ? "\n" : " ");
        continue;
      }

      const pb = pendingBlock; pendingBlock = false;

      if (ch === "'" || ch === '"') { scanString(ch); regexAllowed = false; lastKind = "value"; afterDot = false; continue; }
      if (ch === "`") { scanTemplate(); regexAllowed = false; lastKind = "value"; afterDot = false; continue; }

      if (ch === "/") {
        if (regexAllowed) { scanRegex(); lastKind = "value"; afterDot = false; }
        else {
          emit("/"); i++;
          if (src[i] === "=") { emit("="); i++; }     // /=
          regexAllowed = true; lastKind = "op"; afterDot = false;
        }
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1]))) { scanNumber(); lastKind = "value"; afterDot = false; continue; }

      if (isIdStart(ch)) {
        const s = i; i++;
        while (i < N && isIdPart(src[i])) i++;
        const word = src.slice(s, i);
        emit(word);
        if (afterDot) regexAllowed = false;            // property name
        else if (KEYWORDS.has(word)) regexAllowed = !VALUE_KW.has(word);
        else regexAllowed = false;                     // identifier
        lastWord = word; lastKind = "name"; afterDot = false;
        continue;
      }

      if (ch === "=" && src[i + 1] === ">") { emit("=>"); i += 2; regexAllowed = true; pendingBlock = true; lastKind = "op"; afterDot = false; continue; }
      if (ch === "?" && src[i + 1] === "." && !/[0-9]/.test(src[i + 2] || "")) { emit("?."); i += 2; regexAllowed = true; lastKind = "op"; afterDot = false; continue; }
      if ((ch === "+" && src[i + 1] === "+") || (ch === "-" && src[i + 1] === "-")) { emit(ch + ch); i += 2; regexAllowed = false; lastKind = "op"; afterDot = false; continue; }
      if (ch === ".") { emit("."); i++; afterDot = true; regexAllowed = false; lastKind = "op"; continue; }

      if (ch === "(") { emit("("); i++; parenStack.push(lastKind === "name" && CONTROL.has(lastWord)); regexAllowed = true; lastKind = "op"; afterDot = false; continue; }
      if (ch === ")") { emit(")"); i++; const c = parenStack.pop(); regexAllowed = !!c; if (c) pendingBlock = true; lastKind = "value"; afterDot = false; continue; }
      if (ch === "[") { emit("["); i++; regexAllowed = true; lastKind = "op"; afterDot = false; continue; }
      if (ch === "]") { emit("]"); i++; regexAllowed = false; lastKind = "value"; afterDot = false; continue; }
      if (ch === "{") {
        const kind = pb ? "block" : (regexAllowed ? "object" : "block");
        braceStack.push(kind); depth++;
        emit("{"); i++; regexAllowed = true; lastKind = "op"; afterDot = false;
        continue;
      }
      if (ch === "}") {
        if (inSubst && depth === 0) return;            // closes ${ ... }
        const kind = braceStack.pop(); depth--;
        emit("}"); i++; regexAllowed = kind === "block"; lastKind = "value"; afterDot = false;
        continue;
      }

      emit(ch); i++;                                   // = == ! < > & | ^ % * , ; : ? etc.
      regexAllowed = true; lastKind = "op"; afterDot = false;
    }
  }

  if (src[0] === "#" && src[1] === "!") { while (i < N && src[i] !== "\n") { emit(src[i]); i++; } } // shebang
  scanCode(false);
  return out;
}

// ---- Optional: collapse blank lines + trim trailing whitespace (comment-free compaction) ----
export function compact(code) {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => line.trim() !== "")
    .join("\n") + "\n";
}

// ===================== App wiring (your original shape) =====================

export const optimisejs = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  try {
    const cleaned = compact(removeComments(noteTextarea.value || ""));
    noteTextarea.value = cleaned;
    updateNoteMetadata();
    showNotification("Comments removed and code compacted.");
  } catch (err) {
    console.error("optimisejs error:", err);
    showNotification("Failed to remove comments");
  }
});

// NOTE ON MINIFY: replacing every newline with a space can CHANGE program
// meaning via Automatic Semicolon Insertion. e.g. `b\n++c` means `b; ++c`,
// but `b ++c` parses as `b++ c`. So the safe minify keeps line breaks and only
// collapses horizontal whitespace. If you truly need newlines gone, you must
// insert semicolons correctly, which requires a full parser.
export const minifyjs = preserveSelection(async () => {
  if (!currentNote || !noteTextarea) return;
  const original = window.showNotification;
  window.showNotification = () => {};
  try {
    const cleaned = removeComments(noteTextarea.value || "");
    noteTextarea.value = cleaned
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").replace(/^ | $/g, ""))
      .filter((l) => l !== "")
      .join("\n");            // keeps newlines -> ASI-safe
  } catch (err) {
    console.error("minifyjs error:", err);
  } finally {
    window.showNotification = original;
  }
  showNotification("Minified JS");
});
