(function (global) {
  const USER_DB_KEY = "dexGrandFunctionsUserDB";

  class GrandFunctionRegistry {
    constructor() {
      this.level1 = new Map();
      this.functions = new Map();
    }

    addLevel1({ id, name, icon }) {
      const key = String(id || name).trim();
      if (!key) throw new Error("Grand Functions level 1 requires an id or name");
      this.level1.set(key, { id: key, name: String(name || key), icon: String(icon || "category") });
      return this;
    }

    addFunction({ id, name, icon, under = [], action, args = [], batch = null, description = "" }) {
      const key = String(id || name).trim();
      if (!key) throw new Error("Grand Function requires an id or name");
      const levels = Array.isArray(under) ? under.map(v => String(v).trim()).filter(Boolean) : [String(under).trim()].filter(Boolean);
      if (!levels.length) throw new Error(`Grand Function ${key} requires at least one level`);
      const level1Name = levels[0];
      if (!this.level1.has(this.slug(level1Name))) {
        const existing = [...this.level1.values()].find(v => v.name.toLowerCase() === level1Name.toLowerCase());
        if (!existing) throw new Error(`Level 1 "${level1Name}" is not registered`);
      }
      this.functions.set(key, {
        id: key,
        name: String(name || key),
        icon: String(icon || "code"),
        under: levels,
        action: typeof action === "string" ? action : "",
        args: Array.isArray(args) ? args : [],
        batch: batch == null ? null : String(batch),
        description: String(description || "")
      });
      return this;
    }

    add(entry) { return this.addFunction(entry); }

    remove(id) { this.functions.delete(id); return this; }

    get(id) { return this.functions.get(id) || null; }

    getAll() { return [...this.functions.values()]; }

    getLevel1() { return [...this.level1.values()]; }

    slug(value) {
      return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    getLevel1Entry(name) {
      const key = this.slug(name);
      return this.level1.get(key) || [...this.level1.values()].find(v => this.slug(v.name) === key) || null;
    }

    getTree() {
      const roots = this.getLevel1().map(level => ({ id: level.id, name: level.name, icon: level.icon, children: [] }));
      const rootMap = new Map(roots.map(root => [root.id, root]));
      for (const fn of this.functions.values()) {
        const level1 = this.getLevel1Entry(fn.under[0]);
        if (!level1) continue;
        let node = rootMap.get(level1.id);
        for (let i = 1; i < fn.under.length; i++) {
          const name = fn.under[i];
          let child = node.children.find(c => c.name === name);
          if (!child) { child = { id: this.slug(level1.name + "-" + fn.under.slice(1, i + 1).join("-")), name, children: [] }; node.children.push(child); }
          node = child;
        }
        node.functions.push ? node.functions.push(fn) : node.functions = [fn];
      }
      return roots;
    }

    getByPath(path) {
      const target = path.map(v => String(v).toLowerCase());
      return this.getAll().filter(fn => fn.under.map(v => v.toLowerCase()).join("/") === target.join("/"));
    }
  }

  const registry = new GrandFunctionRegistry();
  registry
    .addLevel1({ id: "general", name: "General", icon: "tune" })
    .addLevel1({ id: "formatting", name: "Formatting", icon: "format_color_fill" })
    .addLevel1({ id: "operations", name: "Operations", icon: "discover_tune" })
    .addLevel1({ id: "code", name: "Code", icon: "code" })
    .addLevel1({ id: "document", name: "Document", icon: "description" });

  const add = entry => registry.addFunction(entry);
  add({ id:"settings", name:"Settings", icon:"tune", under:["General"], action:"openSettingsManager", batch:"app" });
  add({ id:"rename", name:"Rename", icon:"edit", under:["General"], action:"handleRename", batch:"file" });
  add({ id:"download-note", name:"Download Note", icon:"download", under:["General"], action:"handleDownload", batch:"file" });

  add({ id:"uppercase", name:"Uppercase", icon:"uppercase", under:["Formatting","Basic"], action:"handleUppercase", batch:"file" });
  add({ id:"lowercase", name:"Lowercase", icon:"lowercase", under:["Formatting","Basic"], action:"handleLowercase", batch:"file" });
  add({ id:"capitalize-words", name:"Capitalise Words", icon:"match_case", under:["Formatting","Basic"], action:"capitalizeWords", batch:"file" });
  add({ id:"capitalize-sentences", name:"Capitalise Sentences", icon:"text_up", under:["Formatting","Basic"], action:"capitalizeSentences", batch:"file" });
  add({ id:"reverse-words", name:"Reverse Words", icon:"arrow_left", under:["Formatting","Basic"], action:"reverseWords", batch:"file" });
  add({ id:"reverse-all", name:"Reverse All", icon:"fast_rewind", under:["Formatting","Basic"], action:"reverseText", batch:"file" });
  add({ id:"align-left", name:"Align Left", icon:"format_align_left", under:["Formatting","Alignment"], action:"handleAlignLeft", batch:"file" });
  add({ id:"align-center", name:"Align Center", icon:"format_align_center", under:["Formatting","Alignment"], action:"handleAlignCenter", batch:"file" });
  add({ id:"align-right", name:"Align Right", icon:"format_align_right", under:["Formatting","Alignment"], action:"handleAlignRight", batch:"file" });
  add({ id:"decrease-indent", name:"Decrease Indentation", icon:"format_indent_decrease", under:["Formatting","Alignment"], action:"decreaseIndentation", batch:"file" });
  add({ id:"increase-indent", name:"Increase Indentation", icon:"format_indent_increase", under:["Formatting","Alignment"], action:"increaseIndentation", batch:"file" });
  add({ id:"bold", name:"Bold", icon:"format_bold", under:["Formatting","Markup/Markdown"], action:"handleFormat", args:["bold"] });
  add({ id:"italic", name:"Italic", icon:"format_italic", under:["Formatting","Markup/Markdown"], action:"handleFormat", args:["italic"] });
  add({ id:"underline", name:"Underline", icon:"format_underlined", under:["Formatting","Markup/Markdown"], action:"handleFormat", args:["underline"] });
  add({ id:"bullet-list", name:"Bullet List", icon:"format_list_bulleted", under:["Formatting","Markup/Markdown"], action:"handleBulletList", batch:"file" });
  add({ id:"numbered-list", name:"Numbered List", icon:"format_list_numbered", under:["Formatting","Markup/Markdown"], action:"handleNumberedList", batch:"file" });
  add({ id:"code-format", name:"Code", icon:"code", under:["Formatting","Markup/Markdown"], action:"handleFormat", args:["code"] });
  add({ id:"insert-link", name:"Insert Link", icon:"link", under:["Formatting","Markup/Markdown"], action:"handleInsertLink", batch:"exclude" });
  add({ id:"insert-image", name:"Insert Image", icon:"image", under:["Formatting","Markup/Markdown"], action:"handleInsertImage", batch:"exclude" });
  add({ id:"designer-fonts", name:"Designer Fonts", icon:"slab_serif", under:["Formatting"], action:"openFontPickerModal", batch:"once:font" });

  add({ id:"find-replace", name:"Find and Replace", icon:"find_replace", under:["Operations"], action:"findandreplace", batch:"app" });
  add({ id:"chains", name:"Chains", icon:"link", under:["Operations"], action:"window.openChainPanel", batch:"app" });
  add({ id:"cleanup-text", name:"Cleanup Text", icon:"cleaning_services", under:["Operations"], action:"handleCleanupText", batch:"exclude" });
  add({ id:"pattern-replacement", name:"Pattern Replacement", icon:"swap_horiz", under:["Operations"], action:"handlePattern", batch:"exclude" });
  add({ id:"add-text", name:"Add Text", icon:"add", under:["Operations"], action:"handleAdd", batch:"exclude" });

  add({ id:"cipher", name:"Cipher", icon:"key", under:["Code"], action:"cipher", batch:"once:cipher" });
  add({ id:"md5", name:"MD5 Hash", icon:"encrypted", under:["Code"], action:"MD5", batch:"file" });
  add({ id:"sha256", name:"SHA256 Hash", icon:"encrypted", under:["Code"], action:"SHA256", batch:"file" });
  add({ id:"remove-html", name:"Remove HTML", icon:"html", under:["Code"], action:"handleRemoveHtml", batch:"file" });
  add({ id:"escape-html", name:"Escape HTML", icon:"html", under:["Code"], action:"handleEscapeHtml", batch:"file" });
  add({ id:"unescape-html", name:"Unescape HTML", icon:"html", under:["Code"], action:"handleUnescapeHtml", batch:"file" });
  add({ id:"text-to-html-table", name:"Text To HTML Table", icon:"table", under:["Code"], action:"handleTextToTable", batch:"once:tabletext" });
  add({ id:"optimise-css", name:"Optimise CSS", icon:"css", under:["Code"], action:"optimisecss", batch:"file" });
  add({ id:"minify-css", name:"Minify CSS", icon:"css", under:["Code"], action:"minifycss", batch:"file" });
  add({ id:"optimise-js", name:"Optimise JS", icon:"javascript", under:["Code"], action:"optimisejs", batch:"file" });
  add({ id:"minify-js", name:"Minify JS", icon:"javascript", under:["Code"], action:"minifyjs", batch:"file" });
  add({ id:"handle-latex", name:"Handle Latex", icon:"data_object", under:["Code"], action:"handleLatex", batch:"file" });

  add({ id:"fetch-url", name:"Fetch URL", icon:"data_object", under:["Document"], action:"openFetchModal", batch:"exclude" });
  add({ id:"open-file", name:"Open File", icon:"folder_open", under:["Document"], action:"handleOpenFile", batch:"app" });
  add({ id:"debug", name:"Debug", icon:"bug_report", under:["Document"], action:"debug", batch:"app" });
  add({ id:"force-sync", name:"Force Sync to Cloud", icon:"cloud_upload", under:["Document"], action:"forceSyncToCloud", batch:"app" });

  function loadUserIds() {
    try { const value = JSON.parse(localStorage.getItem(USER_DB_KEY) || "[]"); return new Set(Array.isArray(value) ? value : []); }
    catch (e) { return new Set(); }
  }
  function saveUserIds(ids) { localStorage.setItem(USER_DB_KEY, JSON.stringify([...ids])); }
  function addToUserDb(id) { const ids = loadUserIds(); ids.add(id); saveUserIds(ids); return ids; }
  function removeFromUserDb(id) { const ids = loadUserIds(); ids.delete(id); saveUserIds(ids); return ids; }
  function isInUserDb(id) { return loadUserIds().has(id); }
  function getUserFunctions() { const ids = loadUserIds(); return registry.getAll().filter(fn => ids.has(fn.id)); }
  function notify() { document.dispatchEvent(new CustomEvent("grandfunctions:userdbchange")); }
  function addAndNotify(id) { const ids = addToUserDb(id); notify(); return ids; }
  function removeAndNotify(id) { const ids = removeFromUserDb(id); notify(); return ids; }

  global.GrandFunctionRegistry = GrandFunctionRegistry;
  global.grandFunctions = registry;
  global.GRAND_FUNCTIONS_USER_DB_KEY = USER_DB_KEY;
  global.grandFunctionsUserDb = { load: loadUserIds, save: saveUserIds, add: addAndNotify, remove: removeAndNotify, has: isInUserDb, get: getUserFunctions };
})(window);
