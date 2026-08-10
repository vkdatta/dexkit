export function openfindbackdrop() {
    function normalizeNewlines(s) {
        if (!s) return "";
        s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        s = s.replace(/\u2028|\u2029/g, "\n");
        return s;
    }
    function getElements() {
        const findBackdrop = document.getElementById("findBackdrop");
        const noteTextarea = document.getElementById("noteTextarea");
        return { findBackdrop, noteTextarea };
    }
    const { findBackdrop, noteTextarea } = getElements();
    if (!findBackdrop || !noteTextarea) {
        console.error("Required elements 'findBackdrop' or 'noteTextarea' not found.");
        return;
    }
    function ensureBackdropWhiteSpace() {
        findBackdrop.style.whiteSpace = 'pre-wrap';
        findBackdrop.style.wordWrap = 'break-word';
    }
    function updateBackdrop() {
        let text = noteTextarea.value || "";
        text = normalizeNewlines(text);
        if (text.endsWith("\n")) {
            text += "\u200B";
        }
        findBackdrop.textContent = text;
        syncBackdropScroll();
    }
    function syncBackdropScroll() {
        try {
            findBackdrop.scrollTop = noteTextarea.scrollTop;
            findBackdrop.scrollLeft = noteTextarea.scrollLeft;
        } catch (err) {
        }
    }
    function syncStyles() {
        const computed = window.getComputedStyle(noteTextarea);
        try {
            findBackdrop.style.font = computed.font || "";
        } catch (e) {  }
        findBackdrop.style.fontFamily = computed.fontFamily;
        findBackdrop.style.fontSize = computed.fontSize;
        findBackdrop.style.fontWeight = computed.fontWeight;
        findBackdrop.style.lineHeight = computed.lineHeight;
        findBackdrop.style.letterSpacing = computed.letterSpacing;
        findBackdrop.style.paddingTop = computed.paddingTop;
        findBackdrop.style.paddingRight = computed.paddingRight;
        findBackdrop.style.paddingBottom = computed.paddingBottom;
        findBackdrop.style.paddingLeft = computed.paddingLeft;
        findBackdrop.style.boxSizing = computed.boxSizing;
        findBackdrop.style.width = computed.width;
        findBackdrop.style.minHeight = computed.minHeight;
        findBackdrop.style.border = computed.border;
        findBackdrop.style.overflowWrap = computed.overflowWrap || 'break-word';
        ensureBackdropWhiteSpace();
        if (noteTextarea.style && noteTextarea.style.fontSize) {
            findBackdrop.style.fontSize = noteTextarea.style.fontSize;
        }
    }
    let styleObserver;
    function setupStyleObserver() {
        if (styleObserver) {
            styleObserver.disconnect();
        }
        styleObserver = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    syncStyles();
                }
            }
        });
        styleObserver.observe(noteTextarea, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
    let classObserver;
    function setupClassObserver() {
        if (classObserver) {
            classObserver.disconnect();
        }
        classObserver = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    setTimeout(syncStyles, 10);
                }
            }
        });
        classObserver.observe(noteTextarea, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    function handleTabKey(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = noteTextarea.selectionStart;
            const end = noteTextarea.selectionEnd;
            const value = noteTextarea.value;
            const before = value.substring(0, start);
            const after = value.substring(end);
            const tab = '\t';
            noteTextarea.value = before + tab + after;
            const newPos = start + tab.length;
            noteTextarea.selectionStart = noteTextarea.selectionEnd = newPos;
            updateBackdrop();
        }
    }
    function handleCompositionEnd() {
        updateBackdrop();
    }
    function monitorFontSizeButtons() {
        document.addEventListener('click', function(e) {
            const target = e.target;
            try {
                if (!target) return;
                const tag = target.tagName;
                const onclickAttr = target.getAttribute && target.getAttribute('onclick');
                const classes = target.classList && Array.from(target.classList).join(' ').toLowerCase();
                if (tag === 'BUTTON' ||
                    (onclickAttr && onclickAttr.toLowerCase().includes('font')) ||
                    (classes && classes.includes('font'))) {
                    setTimeout(syncStyles, 50);
                }
            } catch (err) {
            }
        }, true);
    }
    noteTextarea.addEventListener('compositionend', handleCompositionEnd);
    noteTextarea.addEventListener('scroll', syncBackdropScroll, { passive: true });
    noteTextarea.addEventListener('keydown', handleTabKey);
    ['paste', 'cut'].forEach(event => {
        noteTextarea.addEventListener(event, () => {
            setTimeout(updateBackdrop, 10);
        });
    });
    window.addEventListener('resize', syncStyles);
    noteTextarea.addEventListener('focus', syncStyles);
    noteTextarea.addEventListener('blur', syncStyles);
    syncStyles();
    updateBackdrop();
    setupStyleObserver();
    setupClassObserver();
    monitorFontSizeButtons();
    const originalOpenNote = window.openNote;
    if (originalOpenNote) {
        window.openNote = function(e) {
            originalOpenNote(e);
            setTimeout(() => {
                setupStyleObserver();
                setupClassObserver();
                syncStyles();
                updateBackdrop();
            }, 50);
        };
    }
    const originalHandleRenameSubmit = window.handleRenameSubmit;
    if (originalHandleRenameSubmit) {
        window.handleRenameSubmit = function() {
            originalHandleRenameSubmit();
            setTimeout(() => {
                syncStyles();
                updateBackdrop();
            }, 50);
        };
    }
}

// Factory that builds and wires up the find/replace feature.
// Calling this performs the same setup the original IIFE did immediately
// on load, and returns the toggle function (previously assigned straight
// to window.findandreplace).
export function createFindAndReplace() {
  let isOpen = false;
  const state = {
    matches: [],
    currentIndex: -1,
    searchText: "",
    isCaseSensitive: false,
    isRegex: false,
    mode: "find",
    replaceMode: 0,
    metrics: {},
    suspendSearch: false,
    preferredAnchor: null
  };
  const modeIconMap = { find: "location_searching", replace: "cached" };
  const replaceBtnTexts = ["Replace", "Range", "Replace All"];
  let searchDebounceTimer = null;
  let contentDebounceTimer = null;
  let lastSearchRunId = 0;
  let queuedPerform = false;
  let userScrolling = false;
  let userScrollTimer = null;
  const CARET_COLOR_NORMAL = "#cacaca";
  const CARET_COLOR_MATCH = "#000000";
  const CARET_COLOR_CURRENT = "#000000";

  function getElements() {
    return {
      menu: document.getElementById("find-replace-menu"),
      backdrop: document.getElementById("findBackdrop"),
      noteBackdrop: document.getElementById("noteBackdrop"),
      textarea: document.getElementById("noteTextarea"),
      overlay: document.getElementById("find-replace-overlay"),
      findInput: document.getElementById("find-replace-find-input"),
      replaceInput: document.getElementById("find-replace-replace-input"),
      modeSwitch: document.getElementById("find-replace-mode-switch-button"),
      modeIcon: document.getElementById("find-replace-icon-mode"),
      closeButton: document.getElementById("find-replace-close-button"),
      prevButton: document.getElementById("find-replace-prev-match-button"),
      nextButton: document.getElementById("find-replace-next-match-button"),
      prevReplaceButton: document.getElementById(
        "find-replace-prev-replace-button"
      ),
      nextReplaceButton: document.getElementById(
        "find-replace-next-replace-button"
      ),
      matchCount: document.getElementById("find-replace-match-count"),
      replaceCount: document.getElementById("find-replace-replace-count"),
      findControls: document.getElementById("find-replace-find-controls"),
      replaceControls: document.getElementById("find-replace-replace-controls"),
      replaceInstanceControls: document.getElementById(
        "find-replace-replace-instance-controls"
      ),
      replaceRangeControls: document.getElementById(
        "find-replace-replace-range-controls"
      ),
      replaceAllControls: document.getElementById(
        "find-replace-replace-all-controls"
      ),
      rangeInput: document.getElementById("find-replace-range-input"),
      matchCaseBtn: document.getElementById("find-replace-match-case-button"),
      regexBtn: document.getElementById("find-replace-regex-button"),
      replaceSettingsBtn: document.getElementById(
        "find-replace-replace-settings-button"
      ),
      executeReplaceBtn: document.getElementById(
        "find-replace-execute-replace-button"
      ),
      menuContainer: document.getElementById("find-replace-menu")
    };
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function performSearch() {
    if (state.suspendSearch) {
      queuedPerform = true;
      return;
    }
    const runId = ++lastSearchRunId;
    const els = getElements();
    if (!els.textarea || !els.findInput) return;
    const content = els.textarea.value;
    const query = els.findInput.value;
    state.searchText = query;
    if (!query) {
      state.matches = [];
      state.currentIndex = -1;
      renderMatches();
      return;
    }
    let matches = [];
    try {
      let flags = "g";
      if (!state.isCaseSensitive) flags += "i";
      if (state.isMultiline) flags += "m";
      if (state.isDotAll) flags += "s";
      if (state.isUnicode) flags += "u";
      const pattern = state.isRegex ? query : escapeRegExp(query);
      const re = new RegExp(pattern, flags);
      let match;
      while ((match = re.exec(content)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
        if (match.index === re.lastIndex) re.lastIndex++;
      }
    } catch (err) {
      console.error("Regex error:", err);
      matches = [];
    }
    if (runId !== lastSearchRunId) return;
    const prevAnchor = state.matches[state.currentIndex]?.start ?? null;
    state.matches = matches;
    let newIndex = -1;
    if (state.preferredAnchor != null) {
      newIndex = matches.findIndex((m) => m.start >= state.preferredAnchor);
      state.preferredAnchor = null;
    } else if (prevAnchor != null) {
      newIndex = matches.findIndex((m) => m.start >= prevAnchor);
    }
    if (newIndex === -1) {
      newIndex = matches.length ? 0 : -1;
    }
    state.currentIndex = newIndex;
    renderMatches();
  }

  function renderMatches() {
    const els = getElements();
    if (!els.backdrop || !els.textarea) return;
    const rawText = els.textarea.value || "";
    const normalizedForCheck = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u2028|\u2029/g, "\n");
    let html = "";
    let cursor = 0;
    if (els.matchCount) {
      const total = state.matches.length;
      const currentDisplay = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
      els.matchCount.textContent = `${currentDisplay}/${total}`;
    }
    if (els.replaceCount) {
      const total = state.matches.length;
      const currentDisplay = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
      els.replaceCount.textContent = `${currentDisplay}/${total}`;
    }
    state.matches.forEach((m, idx) => {
      html += escapeHtml(rawText.substring(cursor, m.start));
      const spanClass = idx === state.currentIndex ? "hl-match hl-current" : "hl-match";
      html += `<span class="${spanClass}">${escapeHtml(m.text)}</span>`;
      cursor = m.end;
    });
    html += escapeHtml(rawText.substring(cursor));
    if (normalizedForCheck.endsWith("\n")) {
      html += "&#8203;";
    }
    try {
      els.backdrop.innerHTML = html;
    } catch (e) {
      try {
        els.backdrop.textContent = html;
      } catch (e2) {}
    }
    syncBackdropStyles();
    updateCaretColor();
  }

  function focusCurrentMatch() {
    if (state.currentIndex < 0 || !state.matches.length) return;
    const els = getElements();
    if (!els.textarea) return;
    const cur = state.matches[state.currentIndex];
    const linesBefore =
      els.textarea.value.substring(0, cur.start).split("\n").length - 1;
    const lineHeightValue = getComputedStyle(els.textarea).lineHeight;
    const parsed = parseInt(lineHeightValue, 10);
    const lineHeight = Number.isFinite(parsed) ? parsed : 22;
    const targetScrollTop = linesBefore * lineHeight;
    const rectTop = targetScrollTop;
    const rectBottom = targetScrollTop + lineHeight;
    const currentScrollBottom =
      els.textarea.scrollTop + els.textarea.clientHeight;
    if (rectTop < els.textarea.scrollTop || rectBottom > currentScrollBottom) {
      els.textarea.scrollTop =
        targetScrollTop - els.textarea.clientHeight / 2 + lineHeight / 2;
    }
    if (els.backdrop) {
      els.backdrop.scrollTop = els.textarea.scrollTop;
      els.backdrop.scrollLeft = els.textarea.scrollLeft;
    }
    updateCaretColor();
  }

  function updateCaretColor() {
    const els = getElements();
    if (!els.textarea || !isOpen) {
      if (els.textarea) els.textarea.style.caretColor = CARET_COLOR_NORMAL;
      return;
    }
    const pos = els.textarea.selectionStart;
    const end = els.textarea.selectionEnd;
    if (pos !== end) {
      els.textarea.style.caretColor = CARET_COLOR_NORMAL;
      return;
    }
    let newColor = CARET_COLOR_NORMAL;
    for (const [i, m] of state.matches.entries()) {
      if (pos >= m.start && pos <= m.end) {
        newColor =
          i === state.currentIndex ? CARET_COLOR_CURRENT : CARET_COLOR_MATCH;
        break;
      }
    }
    els.textarea.style.caretColor = newColor;
  }
  function syncBackdropStyles() {
    const els = getElements();
    if (!els.textarea || !els.backdrop) return;
    const cs = getComputedStyle(els.textarea);
    els.backdrop.style.fontSize = cs.fontSize;
  }

  function clearPendingDebounces() {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (contentDebounceTimer) {
      clearTimeout(contentDebounceTimer);
      contentDebounceTimer = null;
    }
  }
  function moveIndex(delta) {
    if (!state.matches.length) return;
    clearPendingDebounces();
    state.suspendSearch = true;
    queuedPerform = false;
    const SUSPEND_MS = 350;
    setTimeout(() => {
      state.suspendSearch = false;
      if (queuedPerform) {
        queuedPerform = false;
        setTimeout(performSearch, 0);
      }
    }, SUSPEND_MS);
    state.currentIndex += delta;
    if (state.currentIndex >= state.matches.length) {
      state.currentIndex = 0;
    } else if (state.currentIndex < 0) {
      state.currentIndex = state.matches.length - 1;
    }
    renderMatches();
    focusCurrentMatch();
  }
  function updateReplaceModeUI() {
    const els = getElements();
    if (
      !els.replaceInstanceControls ||
      !els.replaceRangeControls ||
      !els.replaceAllControls ||
      !els.executeReplaceBtn
    )
      return;
    els.replaceInstanceControls.classList.toggle(
      "find-replace-hidden",
      state.replaceMode !== 0
    );
    els.replaceRangeControls.classList.toggle(
      "find-replace-hidden",
      state.replaceMode !== 1
    );
    els.replaceAllControls.classList.toggle(
      "find-replace-hidden",
      state.replaceMode !== 2
    );
    els.executeReplaceBtn.textContent = replaceBtnTexts[state.replaceMode];
  }
  function toggleMode() {
    state.mode = state.mode === "find" ? "replace" : "find";
    updateUI();
    const els = getElements();
    if (state.mode === "find" && els.findInput) {
      try {
        els.findInput.focus();
      } catch (e) {}
    } else if (els.replaceInput) {
      try {
        els.replaceInput.focus();
      } catch (e) {}
    }
  }
  function executeReplace() {
    const els = getElements();
    if (
      !els.textarea ||
      !els.replaceInput ||
      !state.matches.length ||
      !state.searchText
    )
      return;
    let content = els.textarea.value;
    const replacement = els.replaceInput.value;
    let targets = [];
    if (state.replaceMode === 0) {
      if (state.currentIndex >= 0) targets.push(state.currentIndex);
    } else if (state.replaceMode === 2) {
      targets = state.matches.map((_, i) => i);
    } else if (state.replaceMode === 1) {
      const raw =
        els.rangeInput && els.rangeInput.value
          ? els.rangeInput.value.trim()
          : "";
      if (!raw) return;
      const parts = raw.split(",").map((p) => p.trim());
      const desired = new Set();
      parts.forEach((p) => {
        if (p.includes("-")) {
          const [sRaw, eRaw] = p.split("-").map((v) => v.trim());
          const s = parseInt(sRaw, 10);
          const e = parseInt(eRaw, 10);
          if (!isNaN(s) && !isNaN(e) && s <= e) {
            for (let k = s; k <= e; k++) desired.add(k);
          }
        } else {
          const n = parseInt(p, 10);
          if (!isNaN(n)) desired.add(n);
        }
      });
      state.matches.forEach((m, idx) => {
        if (desired.has(idx + 1)) targets.push(idx);
      });
    }
    if (targets.length === 0) return;
    if (
      state.replaceMode === 0 &&
      state.currentIndex >= 0 &&
      state.matches[state.currentIndex]
    ) {
      const curMatch = state.matches[state.currentIndex];
      const replLen =
        els.replaceInput && els.replaceInput.value
          ? els.replaceInput.value.length
          : curMatch.end - curMatch.start;
      state.preferredAnchor = curMatch.start + replLen;
    } else {
      state.preferredAnchor = null;
    }
    targets.sort((a, b) => b - a);

    targets.forEach((idx) => {
      const m = state.matches[idx];
      let repl = replacement;
      if (state.isRegex) {
        try {
          const flags = state.isCaseSensitive ? "g" : "gi";
          const regex = new RegExp(state.searchText, flags);
          repl = m.text.replace(regex, replacement);
        } catch (e) {}
      }
      content = content.substring(0, m.start) + repl + content.substring(m.end);
    });
    els.textarea.value = content;
    performSearch();
  }
  function updateUI() {
    const els = getElements();
    if (!els.menuContainer) return;
    els.menuContainer.classList.toggle(
      "find-replace-mode-find",
      state.mode === "find"
    );
    els.menuContainer.classList.toggle(
      "find-replace-mode-replace",
      state.mode === "replace"
    );
    if (els.modeIcon) els.modeIcon.textContent = modeIconMap[state.mode];
    if (els.findControls)
      els.findControls.classList.toggle(
        "find-replace-hidden",
        state.mode === "replace"
      );
    if (els.replaceControls)
      els.replaceControls.classList.toggle(
        "find-replace-hidden",
        state.mode === "find"
      );
    if (els.matchCaseBtn)
      els.matchCaseBtn.classList.toggle(
        "find-replace-hidden",
        state.mode === "replace"
      );
    if (els.regexBtn)
      els.regexBtn.classList.toggle(
        "find-replace-hidden",
        state.mode === "replace"
      );
    if (els.replaceSettingsBtn)
      els.replaceSettingsBtn.classList.toggle(
        "find-replace-hidden",
        state.mode === "find"
      );
    updateReplaceModeUI();
  }
  function attachEventListeners() {
    const els = getElements();
    if (!els.textarea || !els.backdrop) {
      console.warn("Find/replace: required elements not found");
      return;
    }
    if (els.findInput) {
      els.findInput.addEventListener("input", () => {
        clearPendingDebounces();
        searchDebounceTimer = setTimeout(performSearch, 50);
      });
    }
    if (els.prevButton)
      els.prevButton.addEventListener("click", () => moveIndex(-1));
    if (els.nextButton)
      els.nextButton.addEventListener("click", () => moveIndex(1));
    if (els.prevReplaceButton)
      els.prevReplaceButton.addEventListener("click", () => moveIndex(-1));
    if (els.nextReplaceButton)
      els.nextReplaceButton.addEventListener("click", () => moveIndex(1));
    if (els.closeButton)
      els.closeButton.addEventListener("click", () => window.findandreplace());
    if (els.modeSwitch) els.modeSwitch.addEventListener("click", toggleMode);
    if (els.matchCaseBtn) {
      els.matchCaseBtn.addEventListener("click", () => {
        state.isCaseSensitive = !state.isCaseSensitive;
        els.matchCaseBtn.classList.toggle("active", state.isCaseSensitive);
        performSearch();
      });
    }
    if (els.regexBtn) {
      els.regexBtn.addEventListener("click", () => {
        state.isRegex = !state.isRegex;
        els.regexBtn.classList.toggle("active", state.isRegex);
        performSearch();
      });
    }
    if (els.replaceSettingsBtn) {
      els.replaceSettingsBtn.addEventListener("click", () => {
        state.replaceMode = (state.replaceMode + 1) % 3;
        updateReplaceModeUI();
      });
    }
    if (els.executeReplaceBtn)
      els.executeReplaceBtn.addEventListener("click", executeReplace);
    els.textarea.addEventListener("input", function () {
      const fb = getElements().backdrop;
      if (fb) {
        fb.scrollTop = this.scrollTop;
        fb.scrollLeft = this.scrollLeft;
      }
      if (isOpen) {
        clearPendingDebounces();
        contentDebounceTimer = setTimeout(performSearch, 10);
      }
    });
    els.textarea.addEventListener("scroll", function () {
      const fb = getElements().backdrop;
      if (fb) {
        fb.scrollTop = this.scrollTop;
        fb.scrollLeft = this.scrollLeft;
      }
      if (!isOpen) return;
      userScrolling = true;
      if (userScrollTimer) clearTimeout(userScrollTimer);
      userScrollTimer = setTimeout(() => {
        userScrolling = false;
        userScrollTimer = null;
      }, 50);
    });
    els.textarea.addEventListener("click", updateCaretColor);
    els.textarea.addEventListener("keyup", updateCaretColor);
    els.textarea.addEventListener("keydown", updateCaretColor);
    els.textarea.addEventListener("input", () =>
      setTimeout(updateCaretColor, 0)
    );
    document.addEventListener("selectionchange", () => {
      const els = getElements();
      if (document.activeElement === els.textarea && isOpen) updateCaretColor();
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "f" &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const els = getElements();
        if (!els.menu) return;
        const isCurrentlyOpen = !els.menu.classList.contains(
          "find-replace-hidden"
        );
        if (!isCurrentlyOpen) {
          window.findandreplace();
        } else {
          const inputToFocus =
            state.mode === "find" ? els.findInput : els.replaceInput;
          if (inputToFocus) {
            try {
              inputToFocus.focus();
              if (inputToFocus === els.findInput) {
                inputToFocus.select();
              }
            } catch (err) {}
          }
        }
      }
    });
  }
  attachEventListeners();
  window.__findandreplace_renderMatches = renderMatches;
  return function () {
    const els = getElements();
    if (!els.menu) {
      console.debug("[find] toggle called but #find-replace-menu not found");
      return;
    }
    isOpen = !isOpen;
    els.menu.classList.toggle("find-replace-hidden", !isOpen);
    els.menu.classList.toggle("find-replace-on-top", isOpen);

    if (isOpen) {
      openfindbackdrop();
      document
        .querySelectorAll(".sidebar, .secondary-sidebar, .topbar")
        .forEach((el) => (el.style.display = "none"));
      clearPendingDebounces();
      state.suspendSearch = false;
      queuedPerform = false;

      if (els.textarea && els.findInput) {
        const start = els.textarea.selectionStart;
        const end = els.textarea.selectionEnd;
        if (start !== end && start >= 0 && end >= 0) {
          const selectedText = els.textarea.value.substring(start, end);
          if (selectedText.trim().length > 0) {
            els.findInput.value = selectedText;
          }
        }
      }
      syncBackdropStyles();
      performSearch();
      updateUI();
      if (state.mode === "find" && els.findInput) {
        try {
          els.findInput.focus();
          els.findInput.select();
        } catch (e) {}
      } else if (els.replaceInput) {
        try {
          els.replaceInput.focus();
        } catch (e) {}
      }
      console.debug("[find] opened");
    } else {
      document
        .querySelectorAll(".sidebar, .secondary-sidebar, .topbar")
        .forEach((el) => (el.style.display = ""));
      if (els.noteBackdrop && typeof window.scheduleUpdate === "function") {
        try {
          window.scheduleUpdate(true);
        } catch (e) {}
      }
      if (els.textarea) {
        try {
          els.textarea.setSelectionRange(0, 0);
        } catch (e) {}
      }
      if (els.overlay) els.overlay.innerHTML = "";
      state.matches = [];
      state.currentIndex = -1;
      renderMatches();
      console.debug("[find] closed");
    }
  };
}
