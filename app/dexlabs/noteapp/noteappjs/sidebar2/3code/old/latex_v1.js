// ===================== LaTeX Parser (full) =====================

export function handleLatex() {
  if (!noteTextarea) return;
  try {
    noteTextarea.value = latexToUnicode(noteTextarea.value || "");
    updateNoteMetadata();
    showNotification("LaTeX parsed and converted!");
  } catch (err) {
    console.error("handleLatex error:", err);
    showNotification("LaTeX parsing failed: " + (err && err.message ? err.message : String(err)));
  }
}

export function latexToUnicode(input) {
  // ---------- Symbol tables ----------
  const GREEK = {
    alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",
    theta:"θ",vartheta:"ϑ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",
    omicron:"ο",pi:"π",varpi:"ϖ",rho:"ρ",varrho:"ϱ",sigma:"σ",varsigma:"ς",tau:"τ",
    upsilon:"υ",phi:"φ",varphi:"φ",chi:"χ",psi:"ψ",omega:"ω",
    Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",
    Upsilon:"Υ",Phi:"Φ",Psi:"Ψ",Omega:"Ω"
  };
  const SYMBOLS = {
    leq:"≤",geq:"≥",neq:"≠",approx:"≈",equiv:"≡",times:"×",div:"÷",pm:"±",mp:"∓",
    cdot:"·",cdots:"⋯",ldots:"…",dots:"…",vdots:"⋮",ddots:"⋱",infty:"∞",partial:"∂",
    nabla:"∇",forall:"∀",exists:"∃",in:"∈",notin:"∉",subset:"⊂",subseteq:"⊆",
    supset:"⊃",supseteq:"⊇",cup:"∪",cap:"∩",emptyset:"∅",varnothing:"∅",
    rightarrow:"→",to:"→",leftarrow:"←",leftrightarrow:"↔",Rightarrow:"⇒",
    Leftarrow:"⇐",Leftrightarrow:"⇔",mapsto:"↦",propto:"∝",sim:"∼",simeq:"≃",
    cong:"≅",angle:"∠",perp:"⊥",parallel:"∥",therefore:"∴",because:"∵",
    aleph:"ℵ",hbar:"ℏ",ell:"ℓ",Re:"ℜ",Im:"ℑ",wp:"℘",prime:"′",
    circ:"∘",bullet:"∙",star:"⋆",oplus:"⊕",ominus:"⊖",otimes:"⊗",oslash:"⊘",
    wedge:"∧",vee:"∨",neg:"¬",lnot:"¬",top:"⊤",bot:"⊥",
    langle:"⟨",rangle:"⟩",lceil:"⌈",rceil:"⌉",lfloor:"⌊",rfloor:"⌋",
    degree:"°",checkmark:"✓",
    quad:"  ",qquad:"    ",",":" ",";":" ",":":" "," ":" ","!":""
  };
  const SUP = {"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹",
    "+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ","a":"ᵃ","b":"ᵇ","c":"ᶜ","x":"ˣ","y":"ʸ"};
  const SUB = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉",
    "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","e":"ₑ","i":"ᵢ","j":"ⱼ","k":"ₖ","n":"ₙ","x":"ₓ"};

  function toScript(str, map) {
    let out = "";
    let ok = true;
    for (const ch of str) {
      if (map[ch]) out += map[ch];
      else { ok = false; break; }
    }
    return ok ? out : null;
  }

  // ---------- Tokenizer ----------
  function tokenize(src) {
    const toks = [];
    let i = 0;
    const len = src.length;
    while (i < len) {
      const c = src[i];

      // % : only treat as a LaTeX comment if it's NOT glued to a number (e.g. "6.0%").
      if (c === "%") {
        const prev = i > 0 ? src[i - 1] : "\n";
        const isLiteralPercent = /[0-9]/.test(prev);
        if (isLiteralPercent) {
          toks.push({ type: "char", value: "%" });
          i++;
          continue;
        }
        while (i < len && src[i] !== "\n") i++;
        continue;
      }

      // $ : only treat as a math-mode delimiter if NOT immediately followed by a digit.
      if (c === "$") {
        if (/[0-9]/.test(src[i + 1] || "")) {
          toks.push({ type: "char", value: "$" });
          i++;
          continue;
        }
        i++; // drop as math delimiter
        continue;
      }

      if (c === "\\") {
        if (src[i + 1] === "\\") { toks.push({ type: "linebreak" }); i += 2; continue; }
        // FIX: do NOT swallow trailing whitespace after the command name.
        // Previously /^\\([a-zA-Z]+)\s*/ ate the space following e.g. "\times ",
        // which collapsed rendered symbols against the next token ("×0.940" instead of "× 0.940").
        const m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
        if (m) { toks.push({ type: "command", name: m[1] }); i += m[0].length; continue; }
        const ch = src[i + 1];
        if (ch !== undefined) { toks.push({ type: "char", value: ch }); i += 2; continue; }
        i++;
        continue;
      }
      if (c === "{") { toks.push({ type: "brace_open" }); i++; continue; }
      if (c === "}") { toks.push({ type: "brace_close" }); i++; continue; }
      if (c === "[") { toks.push({ type: "bracket_open" }); i++; continue; }
      if (c === "]") { toks.push({ type: "bracket_close" }); i++; continue; }
      if (c === "^") { toks.push({ type: "sup" }); i++; continue; }
      if (c === "_") { toks.push({ type: "sub" }); i++; continue; }
      if (c === "&") { toks.push({ type: "amp" }); i++; continue; }
      if (c === "\n") { toks.push({ type: "char", value: "\n" }); i++; continue; }
      toks.push({ type: "char", value: c });
      i++;
    }
    return toks;
  }

  // ---------- Parser: builds AST ----------
  function parse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function advance() { return tokens[pos++]; }

    function parseGroupContents(stopTypes) {
      const nodes = [];
      while (pos < tokens.length) {
        const t = peek();
        if (stopTypes && stopTypes.includes(t.type)) break;
        nodes.push(parseAtomWithScripts());
      }
      return nodes;
    }

    function parseBracedGroup() {
      advance();
      const nodes = parseGroupContents(["brace_close"]);
      if (peek() && peek().type === "brace_close") advance();
      return { kind: "group", children: nodes };
    }

    function parseBracketGroup() {
      advance();
      const nodes = parseGroupContents(["bracket_close"]);
      if (peek() && peek().type === "bracket_close") advance();
      return { kind: "group", children: nodes };
    }

    function parseSingleArg() {
      const t = peek();
      if (!t) return { kind: "group", children: [] };
      if (t.type === "brace_open") return parseBracedGroup();
      if (t.type === "command") { advance(); return parseCommand(t.name); }
      if (t.type === "char") { advance(); return { kind: "text", value: t.value }; }
      return { kind: "group", children: [] };
    }

    function commandArgCount(name) {
      const zero = new Set(["left","right"]);
      const two = new Set(["frac","binom","dfrac","tfrac"]);
      if (two.has(name)) return 2;
      if (zero.has(name)) return 0;
      return null;
    }

    function parseEnvironment() {
      let name = "";
      if (peek() && peek().type === "brace_open") {
        advance();
        while (peek() && peek().type !== "brace_close") {
          const t = advance();
          if (t.type === "char") name += t.value;
        }
        if (peek() && peek().type === "brace_close") advance();
      }
      const rows = [[[]]];
      let rowIdx = 0, cellIdx = 0;
      while (pos < tokens.length) {
        const t = peek();
        if (t.type === "command" && t.name === "end") {
          advance();
          if (peek() && peek().type === "brace_open") {
            advance();
            while (peek() && peek().type !== "brace_close") advance();
            if (peek() && peek().type === "brace_close") advance();
          }
          break;
        }
        if (t.type === "linebreak") {
          advance();
          rows.push([[]]);
          rowIdx++; cellIdx = 0;
          continue;
        }
        if (t.type === "amp") {
          // Inside a real environment, "&" IS a column separator — consume it here.
          advance();
          rows[rowIdx].push([]);
          cellIdx++;
          continue;
        }
        rows[rowIdx][cellIdx].push(parseAtomWithScripts());
      }
      return { kind: "env", name, rows };
    }

    function parseCommand(name) {
      if (name === "begin") return parseEnvironment();
      if (name === "left" || name === "right") {
        if (peek() && (peek().type === "char" || peek().type === "command")) advance();
        return { kind: "group", children: [] };
      }
      const argc = commandArgCount(name);
      if (argc === 2) {
        const a1 = parseSingleArg();
        const a2 = parseSingleArg();
        return { kind: "command", name, args: [a1, a2] };
      }
      if (name === "sqrt") {
        let opt = null;
        if (peek() && peek().type === "bracket_open") opt = parseBracketGroup();
        const arg = parseSingleArg();
        return { kind: "command", name, args: opt ? [opt, arg] : [arg] };
      }
      if (["text","mathrm","mathbf","mathit","operatorname","boldsymbol","textbf","textit","mbox"].includes(name)) {
        const arg = parseSingleArg();
        return { kind: "command", name, args: [arg] };
      }
      if (["overline","underline","vec","hat","dot","ddot","bar","tilde","widehat","widetilde"].includes(name)) {
        const arg = parseSingleArg();
        return { kind: "command", name, args: [arg] };
      }
      if (["sum","prod","int","oint","lim","max","min","log","ln","sin","cos","tan","exp"].includes(name)) {
        return { kind: "command", name, args: [] };
      }
      return { kind: "command", name, args: [] };
    }

    function parseBaseAtom() {
      const t = advance();
      if (t.type === "brace_open") { pos--; return parseBracedGroup(); }
      if (t.type === "command") return parseCommand(t.name);
      if (t.type === "char") return { kind: "text", value: t.value };
      if (t.type === "linebreak") return { kind: "text", value: "\n" };
      // FIX: a stray "&" reaching here means we're NOT inside an environment
      // (environments consume their own "&" tokens in parseEnvironment above).
      // So this is just a literal ampersand in prose, e.g. "Net P&L" — not a tab/column break.
      if (t.type === "amp") return { kind: "text", value: "&" };
      return { kind: "group", children: [] };
    }

    function parseAtomWithScripts() {
      let base = parseBaseAtom();
      let sup = null, sub = null;
      while (peek() && (peek().type === "sup" || peek().type === "sub")) {
        const t = advance();
        const arg = parseSingleArg();
        if (t.type === "sup") sup = arg; else sub = arg;
      }
      if (sup || sub) return { kind: "script", base, sup, sub };
      return base;
    }

    const nodes = parseGroupContents(null);
    return { kind: "group", children: nodes };
  }

  // ---------- Renderer: AST -> Unicode string ----------
  function render(node) {
    if (!node) return "";
    switch (node.kind) {
      case "group":
        return node.children.map(render).join("");
      case "text":
        return node.value;
      case "script": {
        const baseStr = render(node.base);
        let out = baseStr;
        if (node.sub) {
          const s = render(node.sub);
          const scripted = toScript(s, SUB);
          out += scripted !== null ? scripted : "_(" + s + ")";
        }
        if (node.sup) {
          const s = render(node.sup);
          const scripted = toScript(s, SUP);
          out += scripted !== null ? scripted : "^(" + s + ")";
        }
        return out;
      }
      case "env": {
        const lines = node.rows
          .filter((row) => row.some((cell) => cell.length))
          .map((row) => row.map((cell) => cell.map(render).join("")).join(" | "));
        return "\n" + lines.join("\n") + "\n";
      }
      case "command":
        return renderCommand(node);
      default:
        return "";
    }
  }

  function renderCommand(node) {
    const { name, args } = node;
    if (GREEK[name]) return GREEK[name];
    if (SYMBOLS[name] !== undefined) return SYMBOLS[name];

    switch (name) {
      case "frac": case "dfrac": case "tfrac":
        return "(" + render(args[0]) + "/" + render(args[1]) + ")";
      case "binom":
        return "C(" + render(args[0]) + ", " + render(args[1]) + ")";
      case "sqrt":
        if (args.length === 2) return (render(args[0]) + "√(" + render(args[1]) + ")");
        return "√(" + render(args[0]) + ")";
      case "text": case "mathrm": case "mathbf": case "mathit":
      case "operatorname": case "boldsymbol": case "textbf": case "textit": case "mbox":
        return render(args[0]);
      case "overline": case "bar": return render(args[0]) + "̄";
      case "underline": return render(args[0]) + "̲";
      case "vec": return render(args[0]) + "⃗";
      case "hat": case "widehat": return render(args[0]) + "̂";
      case "tilde": case "widetilde": return render(args[0]) + "̃";
      case "dot": return render(args[0]) + "̇";
      case "ddot": return render(args[0]) + "̈";
      case "sum": return "∑";
      case "prod": return "∏";
      case "int": return "∫";
      case "oint": return "∮";
      case "lim": return "lim";
      case "max": return "max";
      case "min": return "min";
      case "log": return "log";
      case "ln": return "ln";
      case "sin": return "sin";
      case "cos": return "cos";
      case "tan": return "tan";
      case "exp": return "exp";
      default:
        return name;
    }
  }

  const tokens = tokenize(input);
  const ast = parse(tokens);
  let out = render(ast);

  out = out.replace(/[ \t]+/g, (m) => (m.includes("\t") ? m : " "));
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/ +\n/g, "\n");
  return out.trim();
}
