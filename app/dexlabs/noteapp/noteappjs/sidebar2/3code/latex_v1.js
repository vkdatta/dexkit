// ============================================================================
// latex-n.js
// Convert the LaTeX in a <textarea> into a .docx with NATIVE, EDITABLE equation
// objects (OMML) and auto-download it. Non-destructive: the textarea is never
// touched. Import into Google Docs -> equations arrive as real, editable math.
//
// Pipeline:  LaTeX --(Temml)--> MathML --(mathml2omml)--> OMML --> OOXML .docx
//
// TWO INPUT MODES (chosen automatically):
//   • Delimited mode — when the text contains $$…$$ / \[…\] (display) or
//     \(…\) / $…$ (inline). Only delimited spans are math; the rest is prose.
//   • Auto-detect mode — when NO delimiters are present. Each line is classified:
//     LaTeX command / sub-superscript / bare "= …" equation -> display equation;
//     everything else -> prose. Force with opts.autodetect (true/false).
//
// PROSE FORMATTING: outside math, text-mode commands become real Word runs —
//   \textbf{}→bold, \textit{}/\emph{}→italic, \underline{}→underline (nesting
//   supported), \section{} etc.→bold, \text{}/\textrm{}→plain. Escapes like
//   \&, \%, \$, \_ , \{ , \} are unescaped. Unknown \cmd{x} unwraps to x.
//
// "Foolproof": ANY input yields a valid, openable .docx; unparseable math is
// written as its literal LaTeX source, never silently mangled.
//
// Drop-in: import { handleLatex } from './latex-n.js';
//          button.onclick = () => handleLatex(noteTextarea, showNotification);
// ============================================================================

// ---------------------------------------------------------------- dependencies
let _mml2omml = null;
let _JSZip = null;
let _temmlReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function loadDeps() {
  if (!window.temml) {
    _temmlReady = _temmlReady ||
      loadScript('https://cdn.jsdelivr.net/npm/temml@0.11/dist/temml.min.js');
    await _temmlReady;
  }
  if (!_mml2omml) {
    const m = await import('https://cdn.jsdelivr.net/npm/mathml2omml@0.5/+esm');
    _mml2omml = m.mml2omml || (m.default && m.default.mml2omml) || m.default;
  }
  if (!_JSZip) {
    const z = await import('https://cdn.jsdelivr.net/npm/jszip@3.10/+esm');
    _JSZip = z.default || z;
  }
}

// ------------------------------------------------------------- XML boilerplate
const CONTENT_TYPES =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
const RELS =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const DOC_RELS =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
const STYLES =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;
const DOC_OPEN =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>`;
const SECTPR =
`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
const DOC_CLOSE = SECTPR + `</w:body></w:document>`;

// ------------------------------------------------------------------ utilities
function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Prose formatting: LaTeX text commands -> formatted Word runs -----------
const FMT = {
  textbf:{bold:1}, bf:{bold:1}, textit:{italic:1}, emph:{italic:1}, textsl:{italic:1},
  underline:{underline:1}, uline:{underline:1}, texttt:{}, textrm:{}, textnormal:{},
  text:{}, mbox:{}, textsc:{},
  section:{bold:1}, subsection:{bold:1}, subsubsection:{bold:1}, paragraph:{bold:1}, title:{bold:1},
};
function readBraceGroup(str, pos) {          // str[pos] === '{'; returns {inner,end}
  let depth = 0, i = pos, inner = '';
  for (; i < str.length; i++) {
    const c = str[i];
    if (c === '{') { depth++; if (depth === 1) continue; }
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    inner += c;
  }
  return { inner, end: i };
}
function mergeCtx(a, b) {
  return { bold: a.bold || b.bold, italic: a.italic || b.italic, underline: a.underline || b.underline };
}
function parseProse(str, ctx, out) {
  let i = 0, buf = '';
  const push = () => { if (buf) { out.push({ text: buf, ...ctx }); buf = ''; } };
  while (i < str.length) {
    const c = str[i];
    if (c === '\\') {
      if (str[i + 1] === '\\') { i += 2; continue; }                    // \\ -> drop
      const m = /^\\([a-zA-Z]+)\*?/.exec(str.slice(i));
      if (m) {
        const name = m[1]; let j = i + m[0].length;
        while (str[j] === ' ') j++;                                      // allow "\textbf {..}"
        if (str[j] === '{') {
          const { inner, end } = readBraceGroup(str, j);
          push();
          parseProse(inner, mergeCtx(ctx, FMT[name] || {}), out);        // known->format, unknown->unwrap
          i = end; continue;
        }
        i = j; continue;                                                 // command w/o arg -> drop
      }
      const ch = str[i + 1];                                             // \& \% \_ \$ \{ \} etc.
      if (ch !== undefined) { buf += ch; i += 2; continue; }
      i++; continue;
    }
    buf += c; i++;
  }
  push();
}
function runXml(r) {
  const p = [];
  if (r.bold) p.push('<w:b/>');
  if (r.italic) p.push('<w:i/>');
  if (r.underline) p.push('<w:u w:val="single"/>');
  const rPr = p.length ? `<w:rPr>${p.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(r.text)}</w:t></w:r>`;
}
function proseToXml(text) {                    // -> run XML (may be empty string)
  const out = [];
  parseProse(text, { bold: 0, italic: 0, underline: 0 }, out);
  return out.map(runXml).join('');
}
function literalRun(text) {                     // untouched literal text (foolproof fallback)
  return `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

// ---- Math -------------------------------------------------------------------
function mathToOmml(tex, display) {
  let mml = window.temml.renderToString(tex, { displayMode: display, throwOnError: false });
  // Temml encodes shrink factors for nested math (fractions, scripts, roots) as
  // relative `mathsize` hints; mathml2omml bakes those into ABSOLUTE font sizes
  // that compound per level. Remove the hint before conversion.
  mml = mml.replace(/\s+mathsize="[^"]*"/g, '');
  let omml = _mml2omml(mml);
  if (!omml || omml.indexOf('<m:oMath') === -1) return null;
  // Drop every explicit run size the converter emits — BOTH the self-closing
  // form <w:sz w:val=".."/> and the paired form <w:sz ..></w:sz> (the paired
  // form is what shrinks fraction numerators/denominators). Word then sizes all
  // levels natively.
  omml = omml
    .replace(/<w:sz\b[^>]*\/>/g, '')
    .replace(/<w:sz\b[^>]*>[\s\S]*?<\/w:sz>/g, '')
    .replace(/<w:szCs\b[^>]*\/>/g, '')
    .replace(/<w:szCs\b[^>]*>[\s\S]*?<\/w:szCs>/g, '');
  return omml;
}

// ---- Delimiter detection & splitting ---------------------------------------
const DELIM_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\d)([\s\S]+?)\$/;
function hasDelimiters(input) { return new RegExp(DELIM_RE.source).test(input); }
function segment(input) {
  const RE = new RegExp(DELIM_RE.source, 'g');
  const segs = []; let last = 0, m;
  while ((m = RE.exec(input)) !== null) {
    if (m.index > last) segs.push({ type: 'text', value: input.slice(last, m.index) });
    if (m[1] !== undefined)      segs.push({ type: 'math', display: true,  tex: m[1], raw: m[0] });
    else if (m[2] !== undefined) segs.push({ type: 'math', display: true,  tex: m[2], raw: m[0] });
    else if (m[3] !== undefined) segs.push({ type: 'math', display: false, tex: m[3], raw: m[0] });
    else                         segs.push({ type: 'math', display: false, tex: m[4], raw: m[0] });
    last = RE.lastIndex;
  }
  if (last < input.length) segs.push({ type: 'text', value: input.slice(last) });
  return segs;
}

// ---- Auto-detect: is this delimiter-free line an equation? ------------------
// Text-formatting commands are stripped first so a bold heading isn't seen as math.
const TEXT_CMDS = /\\(?:textbf|textit|emph|textsl|underline|uline|texttt|textrm|textnormal|text|mbox|textsc|section|subsection|subsubsection|paragraph|title)\b/g;
function isMathLine(line) {
  const s = line.replace(TEXT_CMDS, '');
  if (/\\[a-zA-Z]/.test(s)) return true;      // some OTHER LaTeX command remains
  if (/[_^]/.test(s)) return true;            // sub/superscript
  const t = s.trim();
  if (t.includes('=') && /\d/.test(t) && !/[A-Za-z]{3,}/.test(t)) return true;  // bare equation
  return false;
}

// ------------------------------------------------------------------ body builders
function buildBodyDelimited(segs, stats) {
  const paras = []; let cur = '';
  const flush = () => { paras.push(`<w:p>${cur}</w:p>`); cur = ''; };
  for (const s of segs) {
    if (s.type === 'text') {
      const parts = s.value.split('\n');
      parts.forEach((p, i) => { cur += proseToXml(p); if (i < parts.length - 1) flush(); });
      continue;
    }
    let o = null; try { o = mathToOmml(s.tex, s.display); } catch (_) { o = null; }
    if (o) {
      stats.ok++;
      if (s.display) { if (cur.length) flush(); paras.push(`<w:p><m:oMathPara>${o}</m:oMathPara></w:p>`); }
      else cur += o;
    } else { stats.fail++; cur += literalRun(s.raw); }
  }
  if (cur.length) flush();
  if (!paras.length) paras.push('<w:p></w:p>');
  return paras.join('');
}
function buildBodyAuto(input, stats) {
  const paras = [];
  for (const line of input.split('\n')) {
    if (line.trim() === '') { paras.push('<w:p></w:p>'); continue; }
    if (isMathLine(line)) {
      let o = null; try { o = mathToOmml(line.trim(), true); } catch (_) { o = null; }
      if (o) { stats.ok++; paras.push(`<w:p><m:oMathPara>${o}</m:oMathPara></w:p>`); }
      else { stats.fail++; paras.push(`<w:p>${literalRun(line)}</w:p>`); }
    } else {
      paras.push(`<w:p>${proseToXml(line)}</w:p>`);        // prose -> formatted runs (bold etc.)
    }
  }
  if (!paras.length) paras.push('<w:p></w:p>');
  return paras.join('');
}

// ------------------------------------------------------------------- public API
export async function latexToDocxBlob(latex, opts = {}) {
  await loadDeps();
  const input = latex ?? '';
  const stats = { ok: 0, fail: 0 };
  const auto = (opts.autodetect !== undefined) ? opts.autodetect : !hasDelimiters(input);
  const body = auto ? buildBodyAuto(input, stats) : buildBodyDelimited(segment(input), stats);
  const documentXml = DOC_OPEN + body + DOC_CLOSE;

  const zip = new _JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/document.xml', documentXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return { blob, stats, mode: auto ? 'auto' : 'delimited' };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function handleLatex(textarea, notify, opts = {}) {
  const ta = textarea
    || (typeof window !== 'undefined' && window.noteTextarea)
    || document.querySelector('textarea#noteTextarea, textarea[data-note], textarea');
  const say = notify
    || (typeof window !== 'undefined' && window.showNotification)
    || ((msg) => console.log('[latex-n]', msg));

  if (!ta) { say('LaTeX export: no textarea found.'); return; }
  try {
    say('Building .docx…');
    const { blob, stats } = await latexToDocxBlob(ta.value || '', opts);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    triggerDownload(blob, `latex-notes-${stamp}.docx`);
    const tail = stats.fail ? ` (${stats.fail} left as literal text)` : '';
    say(`Downloaded .docx — ${stats.ok} equation${stats.ok === 1 ? '' : 's'} converted${tail}.`);
  } catch (err) {
    console.error('handleLatex error:', err);
    say('LaTeX export failed: ' + (err && err.message ? err.message : String(err)));
  }
}

export default handleLatex;
