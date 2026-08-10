//<![CDATA[
import {
  extensionMap,
  dependencies,
  languageNames
} from "https://cdn.jsdelivr.net/gh/vkdatta/web@main/app/dexlabs/noteapp/noteappjs/languagemap.js";

(function () {
  "use strict";
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href =
    "https://cdn.jsdelivr.net/gh/vkdatta/web@main/app/dexsins/dexsinscss/codeblock.css";

  document.head.appendChild(styleLink);
  const fontsLink = document.createElement("link");
  fontsLink.href =
    "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&display=swap";
  fontsLink.rel = "stylesheet";
  document.head.appendChild(fontsLink);
  const iconsLink = document.createElement("link");
  iconsLink.href =
    "https://fonts.googleapis.com/icon?family=Material+Icons+Round";
  iconsLink.rel = "stylesheet";
  document.head.appendChild(iconsLink);
  class CompletePrismLanguageLoader {
    constructor() {
      this.loadedLanguages = new Set(["markup", "css", "clike", "javascript"]);
      this.loadingLanguages = new Set();
      this.loadPromises = new Map();
      this.extensionMap = extensionMap;
      this.dependencies = dependencies;
      this.languageNames = languageNames;
      this.primaryExtensionMap = {};
      this.buildPrimaryExtensionMap();
    }
    buildPrimaryExtensionMap() {
      for (const [ext, lang] of Object.entries(this.extensionMap)) {
        if (!this.primaryExtensionMap[lang]) {
          this.primaryExtensionMap[lang] = ext;
        }
      }
    }
    detectLanguageFromExtension(ext) {
      return this.extensionMap[ext.toLowerCase()] || "none";
    }
    getLanguageDisplayName(langAttr) {
      const lang = this.detectLanguageFromExtension(langAttr);
      return this.primaryExtensionMap[lang] || langAttr.toLowerCase();
    }
    async loadLanguage(lang) {
      if (!lang || lang === "none") return Promise.resolve();
      if (this.loadedLanguages.has(lang)) return Promise.resolve();
      if (this.loadPromises.has(lang)) return this.loadPromises.get(lang);
      const loadPromise = this._loadLanguage(lang);
      this.loadPromises.set(lang, loadPromise);
      return loadPromise;
    }
    async _loadLanguage(lang) {
      if (this.loadedLanguages.has(lang) || this.loadingLanguages.has(lang))
        return;
      this.loadingLanguages.add(lang);
      const script = document.createElement("script");
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
      return new Promise((resolve, reject) => {
        script.onload = () => {
          this.loadedLanguages.add(lang);
          this.loadingLanguages.delete(lang);
          resolve();
        };
        script.onerror = () => {
          this.loadingLanguages.delete(lang);
          reject(new Error(`Failed to load language: ${lang}`));
        };
        document.head.appendChild(script);
      });
    }
    isLanguageLoaded(lang) {
      return this.loadedLanguages.has(lang);
    }
  }
  const languageLoader = new CompletePrismLanguageLoader();
  function fastEscapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  async function highlightCodeBlock(originalCode, newCodeElement) {
    const langAttr = originalCode.getAttribute("lang") || "txt";
    const lang = languageLoader.detectLanguageFromExtension(langAttr);
    const displayName = languageLoader.getLanguageDisplayName(langAttr);
    const codeText = originalCode.textContent.trim();
    const lineCount = codeText.split("\n").length;
    newCodeElement.textContent = codeText;
    if (lang !== "none") {
      try {
        await languageLoader.loadLanguage(lang);
        if (window.Prism && languageLoader.isLanguageLoaded(lang)) {
          newCodeElement.className = `code-content language-${lang}`;
          Prism.highlightElement(newCodeElement);
        }
      } catch (error) {
        console.warn(`Failed to highlight ${lang}:`, error);
        newCodeElement.innerHTML = fastEscapeHtml(codeText);
      }
    } else {
      newCodeElement.innerHTML = fastEscapeHtml(codeText);
    }
    return { displayName, lineCount };
  }
  function createCodeBlockStructure(
    originalCode,
    codeContent,
    displayName,
    lineCount
  ) {
    const container = document.createElement("div");
    container.className = "code-container";
    const header = document.createElement("div");
    header.className = "code-header";
    const languageBadge = document.createElement("span");
    languageBadge.className = "language-badge";
    languageBadge.textContent = displayName;
    header.appendChild(languageBadge);
    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";
    const collapseBtn = document.createElement("span");
    collapseBtn.className = "code-btn collapse-btn";
    collapseBtn.title = "Collapse code block";
    collapseBtn.innerHTML = '<i class="material-icons-round">unfold_less</i>';
    let isCollapsed = false;
    toolbar.appendChild(collapseBtn);
    const wrapBtn = document.createElement("span");
    wrapBtn.className = "code-btn wrap-btn";
    wrapBtn.title = "Toggle line wrap";
    wrapBtn.innerHTML = '<i class="material-icons-round">wrap_text</i>';
    let isWrapped = false;
    toolbar.appendChild(wrapBtn);
    const copyBtn = document.createElement("span");
    copyBtn.className = "code-btn copy-btn";
    copyBtn.title = "Copy code";
    copyBtn.innerHTML = '<i class="material-icons-round">content_copy</i>';
    toolbar.appendChild(copyBtn);
    header.appendChild(toolbar);
    container.appendChild(header);
    const pre = document.createElement("pre");
    pre.className = "code-pre";
    pre.appendChild(codeContent);
    container.appendChild(pre);
    const hiddenLinesIndicator = document.createElement("div");
    hiddenLinesIndicator.className = "hidden-lines-indicator";
    hiddenLinesIndicator.innerHTML = `<span>${lineCount} lines hidden</span>`;
    container.appendChild(hiddenLinesIndicator);
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const codeToCopy = codeContent.textContent;
      navigator.clipboard
        .writeText(codeToCopy)
        .then(() => {
          const icon = copyBtn.querySelector("i");
          const originalHTML = icon.innerHTML;
          icon.innerHTML = "check";
          copyBtn.parentNode.parentNode.parentNode.classList.add(
            "copy-success"
          );
          setTimeout(() => {
            icon.innerHTML = originalHTML;
            copyBtn.parentNode.parentNode.parentNode.classList.remove(
              "copy-success"
            );
          }, 2000);
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
        });
    });
    wrapBtn.addEventListener("click", () => {
      isWrapped = !isWrapped;
      pre.classList.toggle("line-wrap", isWrapped);
      wrapBtn.innerHTML = isWrapped
        ? '<i class="material-icons-round">code</i>'
        : '<i class="material-icons-round">wrap_text</i>';
      wrapBtn.title = isWrapped ? "Unwrap lines" : "Wrap lines";
    });
    collapseBtn.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      container.classList.toggle("collapsed", isCollapsed);
      if (isCollapsed) {
        collapseBtn.innerHTML =
          '<i class="material-icons-round">unfold_more</i>';
        collapseBtn.title = "Expand code block";
      } else {
        collapseBtn.innerHTML =
          '<i class="material-icons-round">unfold_less</i>';
        collapseBtn.title = "Collapse code block";
      }
    });
    return container;
  }
  async function initCodeBlocks() {
    if (!window.Prism) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const codeElements = document.querySelectorAll("code");
    for (const originalCode of codeElements) {
      if (originalCode.parentNode.classList.contains("code-container"))
        continue;
      try {
        const newCodeElement = document.createElement("code");
        const { displayName, lineCount } = await highlightCodeBlock(
          originalCode,
          newCodeElement
        );
        const container = createCodeBlockStructure(
          originalCode,
          newCodeElement,
          displayName,
          lineCount
        );
        originalCode.parentNode.replaceChild(container, originalCode);
      } catch (error) {
        console.error("Error processing code block:", error);
        const container = document.createElement("div");
        container.className = "code-container";
        container.innerHTML = ` <div class="code-header"> <span class="language-badge">txt</span> <div class="code-toolbar"> <span class="code-btn collapse-btn" title="Collapse code block"> <i class="material-icons-round">unfold_less</i> </span> <span class="code-btn wrap-btn" title="Toggle line wrap"> <i class="material-icons-round">wrap_text</i> </span> <span class="code-btn copy-btn" title="Copy code"> <i class="material-icons-round">content_copy</i> </span> </div> </div> <pre class="code-pre">${fastEscapeHtml(
          originalCode.textContent
        )}</pre> <div class="hidden-lines-indicator"> <span>${
          originalCode.textContent.trim().split("\n").length
        } lines hidden</span> </div> `;
        originalCode.parentNode.replaceChild(container, originalCode);
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCodeBlocks);
  } else {
    setTimeout(initCodeBlocks, 0);
  }
})();
//]]>
