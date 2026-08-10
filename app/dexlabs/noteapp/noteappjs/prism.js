import {
extensionMap,
dependencies,
languageNames
} from './languagemap.js';

(() => {
    async function forceSyntaxHighlightUpdate() {
        if (currentNote && currentNote.extension) {
            const filename = `file.${currentNote.extension}`;
            const detectedLanguage = languageLoader.detectLanguageFromFilename(filename);
            window.currentHighlightLanguage = detectedLanguage;
        } else {
            window.currentHighlightLanguage = "none";
        }
        if (typeof window.immediatePlainRender === "function") {
            window.immediatePlainRender();
        }
        if (typeof window.scheduleUpdate === "function") {
            window.scheduleUpdate(true);
        } else if (typeof window.updateBackdrop === "function") {
            await window.updateBackdrop();
        }
        noteBackdrop.offsetHeight;
    }
    const observer = new MutationObserver(() => {
        setTimeout(() => { forceSyntaxHighlightUpdate(); }, 10);
    });
    observer.observe(noteTextarea, {
        characterData: true,
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value']
    });
    document.addEventListener('click', async e => {
        if (e.target.closest('button')) {
            setTimeout(async () => {
                await forceSyntaxHighlightUpdate();
                updateNoteMetadata();
            }, 50);
        }
    });
    const originalExecCommand = document.execCommand;
    document.execCommand = function(...args) {
        const result = originalExecCommand.apply(this, args);
        setTimeout(async () => {
            await forceSyntaxHighlightUpdate();
            updateNoteMetadata();
        }, 10);
        return result;
    };
    let lastTextareaValue = noteTextarea.value;
    setInterval(async () => {
        if (noteTextarea.value !== lastTextareaValue) {
            lastTextareaValue = noteTextarea.value;
            await forceSyntaxHighlightUpdate();
        }
    }, 50);
})();

class CompletePrismLanguageLoader {
  constructor() {
    this.extensionMap = extensionMap;
    this.dependencies = dependencies;
    this.languageNames = languageNames;  
    this.loadedLanguages = new Set(["markup", "css", "clike", "javascript"]);
    this.loadingLanguages = new Set();
    this.loadPromises = new Map();
 }
  detectLanguageFromFilename(filename) {
    if (!filename || !filename.includes(".")) {
      return "none";
    }
    const extension = filename.split(".").pop().toLowerCase();
    return this.extensionMap[extension] || "none";
  }
  getLanguageDisplayName(language) {
    return (
      this.languageNames[language] ||
      language.charAt(0).toUpperCase() + language.slice(1)
    );
  }
  async loadLanguage(language) {
    if (!language || language === "none") {
      return Promise.resolve();
    }
    if (this.loadedLanguages.has(language)) {
      return Promise.resolve();
    }
    if (this.loadPromises.has(language)) {
      return this.loadPromises.get(language);
    }
    const loadPromise = this._loadLanguageWithDependencies(language);
    this.loadPromises.set(language, loadPromise);
    return loadPromise;
  }
  async _loadLanguageWithDependencies(language) {
    try {
      if (this.dependencies[language]) {
        for (const dep of this.dependencies[language]) {
          await this.loadLanguage(dep);
        }
      }
      if (
        this.loadedLanguages.has(language) ||
        this.loadingLanguages.has(language)
      ) {
        return;
      }
      this.loadingLanguages.add(language);
      const script = document.createElement("script");
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${language}.min.js`;
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = () => {
          this.loadedLanguages.add(language);
          this.loadingLanguages.delete(language);
          console.log(`Loaded language: ${language}`);
          resolve();
        };
        script.onerror = () => {
          this.loadingLanguages.delete(language);
          console.warn(`Failed to load language: ${language}`);
          reject(new Error(`Failed to load language: ${language}`));
        };
        setTimeout(() => {
          if (this.loadingLanguages.has(language)) {
            this.loadingLanguages.delete(language);
            reject(new Error(`Timeout loading language: ${language}`));
          }
        }, 5000);
      });
      document.head.appendChild(script);
      return loadPromise;
    } catch (error) {
      this.loadingLanguages.delete(language);
      console.error(`Error loading language ${language}:`, error);
      throw error;
    }
  }
  isLanguageLoaded(language) {
    return this.loadedLanguages.has(language);
  }
  isLanguageLoading(language) {
    return this.loadingLanguages.has(language);
  }
}
window.currentHighlightLanguage = "none";
window.prismInitialized = !1;
window.updateTimeout = null;
window.debounceTimer = null;
const LARGE_TEXT_THRESHOLD = 1e5;
function fastEscapeHtml(e) {
  return e
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.syncScroll = function () {
  noteBackdrop &&
    noteTextarea &&
    ((noteBackdrop.scrollTop = noteTextarea.scrollTop),
    (noteBackdrop.scrollLeft = noteTextarea.scrollLeft),
    noteBackdrop.offsetHeight,
    noteTextarea.offsetHeight);
};
window.immediatePlainRender = function () {
  const e = noteTextarea.value;
  let t = e;
  e.endsWith("\n") && (t += " "),
    (noteBackdrop.innerHTML = fastEscapeHtml(t)),
    (noteBackdrop.style.color = "var(--color)"),
    noteBackdrop.offsetHeight,
    noteTextarea.offsetHeight,
    window.syncScroll();
};
window.scheduleUpdate = function (e = !1) {
  window.debounceTimer && clearTimeout(window.debounceTimer),
    window.updateTimeout && cancelAnimationFrame(window.updateTimeout),
    e
      ? requestAnimationFrame(window.updateBackdrop)
      : (window.debounceTimer = setTimeout(() => {
          requestAnimationFrame(window.updateBackdrop);
        }, 800));
};
window.updateBackdrop = async function () {
  (window.updateTimeout = null), (window.debounceTimer = null);
  if (!noteTextarea || !noteBackdrop) return;
  const e = noteTextarea.scrollTop,
    t = noteTextarea.scrollLeft,
    o = noteTextarea.selectionStart,
    n = noteTextarea.selectionEnd,
    l = document.activeElement === noteTextarea;
  const a = noteTextarea.value;
  if (!a) return void (noteBackdrop.innerHTML = "");
  let i = a;
  a.endsWith("\n") && (i = a + " ");
  if (a.length > LARGE_TEXT_THRESHOLD) return;
  let d = "none";
  if (currentNote && currentNote.extension) {
    const e = `file.${currentNote.extension}`;
    d = languageLoader.detectLanguageFromFilename(e);
  }
  d !== window.currentHighlightLanguage &&
    (window.currentHighlightLanguage = d),
    window.currentHighlightLanguage &&
      "none" !== window.currentHighlightLanguage &&
      (languageLoader.isLanguageLoaded(window.currentHighlightLanguage) ||
        languageLoader.isLanguageLoading(window.currentHighlightLanguage) ||
        (await languageLoader
          .loadLanguage(window.currentHighlightLanguage)
          .catch((e) => {
            console.warn(
              "Failed to load language:",
              window.currentHighlightLanguage
            ),
              (window.currentHighlightLanguage = "none");
          })),
      languageLoader.isLanguageLoaded(window.currentHighlightLanguage) &&
        window.Prism &&
        Prism.languages[window.currentHighlightLanguage] &&
        (() => {
          try {
            const e = Prism.highlight(
              i,
              Prism.languages[window.currentHighlightLanguage],
              window.currentHighlightLanguage
            );
            (noteBackdrop.innerHTML = e),
              noteBackdrop.offsetHeight,
              noteTextarea.offsetHeight;
          } catch (e) {
            console.warn("Prism highlighting failed:", e);
          }
        })()),
    (noteTextarea.scrollTop = e),
    (noteTextarea.scrollLeft = t),
    (noteBackdrop.scrollTop = e),
    (noteBackdrop.scrollLeft = t),
    l && (noteTextarea.focus(), noteTextarea.setSelectionRange(o, n));
};
(async function () {
  function e() {
    let e = document.getElementById("noteBackdrop"),
      t = document.getElementById("noteTextarea");
    return (
      e ||
        ((e = document.createElement("pre")),
        (e.id = "noteBackdrop"),
        (e.className = "note-backdrop"),
        e.setAttribute("aria-hidden", "true"),
        (
          document.querySelector(".text-area-wrapper") || document.body
        ).insertBefore(e, null)),
      t ||
        ((t = document.createElement("textarea")),
        (t.id = "noteTextarea"),
        (t.className = "note-textarea"),
        t.setAttribute("spellcheck", "false"),
        t.setAttribute("autocomplete", "off"),
        t.setAttribute("autocorrect", "off"),
        t.setAttribute("autocapitalize", "off"),
        (
          document.querySelector(".text-area-wrapper") || document.body
        ).appendChild(t)),
      { noteBackdrop: e, noteTextarea: t }
    );
  }
  const { noteBackdrop: t, noteTextarea: o } = e();
  (window.noteBackdrop = t), (window.noteTextarea = o);
  const n = document.querySelector('script[src*="prism"]');
  n && n.remove(),
    window.Prism ||
      (await new Promise((e, t) => {
        const o = document.createElement("script");
        (o.src =
          "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"),
          o.setAttribute("data-manual", "true"),
          (o.onload = e),
          (o.onerror = t),
          document.head.appendChild(o);
      }).catch((e) => console.error("Could not load Prism core:", e))),
    window.languageLoader ||
      ((window.languageLoader = new CompletePrismLanguageLoader()),
      (window.prismInitialized = !0)),
    o.addEventListener("input", () => {
      window.immediatePlainRender(), window.scheduleUpdate();
    }),
    o.addEventListener("scroll", window.syncScroll, { passive: !0 }),
    o.addEventListener("keydown", (e) => {
      if ("Tab" === e.key) {
        e.preventDefault();
        const t = o.selectionStart,
          n = o.selectionEnd;
        (o.value = o.value.substring(0, t) + "\t" + o.value.substring(n)),
          (o.selectionStart = o.selectionEnd = t + 1),
          window.immediatePlainRender();
      } else setTimeout(window.immediatePlainRender, 0);
      window.scheduleUpdate();
    }),
    o.addEventListener("paste", () =>
      setTimeout(() => {
        window.immediatePlainRender(), window.scheduleUpdate();
      }, 10)
    ),
    o.addEventListener("cut", () =>
      setTimeout(() => {
        window.immediatePlainRender(), window.scheduleUpdate();
      }, 10)
    ),
    o.addEventListener("change", () => {
      window.immediatePlainRender(), window.scheduleUpdate();
    });
  const l = window.openNote;
  window.openNote = function (e) {
    l && l(e),
      setTimeout(() => {
        (window.currentHighlightLanguage = "none"),
          window.immediatePlainRender(),
          window.scheduleUpdate(!0);
      }, 50);
  };
  const a = window.handleRenameSubmit;
  window.handleRenameSubmit = function () {
    a && a(),
      setTimeout(() => {
        (window.currentHighlightLanguage = "none"),
          window.immediatePlainRender(),
          window.scheduleUpdate(!0);
      }, 50);
  };
  const i = document.createElement("style");
  (i.textContent =
    ".text-area-wrapper{position:relative;width:100%;height:100%;overflow:hidden;contain:layout style paint;}#noteBackdrop pre{margin:0;pointer-events:none;}"),
    document.head.appendChild(i),
    setTimeout(() => window.scheduleUpdate(!0), 100),
    console.log("Prism syntax highlighting initialized - auto-update enabled");
})();
