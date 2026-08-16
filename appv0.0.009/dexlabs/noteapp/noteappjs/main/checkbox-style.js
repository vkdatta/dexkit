(function () {
  const TICK_SVG =
    '<svg fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

  const STYLE_ID = "dex-universal-checkbox-style";
  const WRAP_CLASS = "dex-check-wrap";
  const BOX_CLASS = "dex-check";
  const MARK_ATTR = "data-dex-styled";

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${WRAP_CLASS} {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 19px;
        height: 19px;
        flex-shrink: 0;
        vertical-align: middle;
      }
      .${WRAP_CLASS} > input[type="checkbox"] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 1;
      }
      .${WRAP_CLASS} .${BOX_CLASS} {
        position: absolute;
        inset: 0;
        width: 19px;
        height: 19px;
        border-radius: 5px;
        border: 1.5px solid var(--c-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--c-black);
        background: transparent;
        pointer-events: none;
        box-sizing: border-box;
      }
      .${WRAP_CLASS} .${BOX_CLASS} svg {
        width: 13px;
        height: 13px;
      }
      .${WRAP_CLASS} .${BOX_CLASS}.on {
        background: var(--c-accent);
        border-color: var(--c-accent);
      }
      .${WRAP_CLASS} > input[type="checkbox"]:disabled ~ .${BOX_CLASS} {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function syncBox(input, box) {
    const on = input.checked;
    box.classList.toggle("on", on);
    box.innerHTML = on ? TICK_SVG : "";
  }

  function styleCheckbox(input) {
    if (!input || input.type !== "checkbox") return;
    if (input.hasAttribute(MARK_ATTR)) return;
    if (input.closest("." + WRAP_CLASS)) return;

    input.setAttribute(MARK_ATTR, "true");

    const wrap = document.createElement("span");
    wrap.className = WRAP_CLASS;

    const box = document.createElement("span");
    box.className = BOX_CLASS;

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(box);

    syncBox(input, box);

    input.addEventListener("change", () => syncBox(input, box));
  }

  function styleAll(root) {
    (root || document)
      .querySelectorAll('input[type="checkbox"]')
      .forEach(styleCheckbox);
  }

  function init() {
    injectCss();
    styleAll(document);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('input[type="checkbox"]')) {
            styleCheckbox(node);
          } else if (node.querySelectorAll) {
            styleAll(node);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
