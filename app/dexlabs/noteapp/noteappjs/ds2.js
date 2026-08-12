(function () {
  'use strict';

  if (window.__dexToolbar2Loaded) return;
  window.__dexToolbar2Loaded = true;

  const LS_KEY = 'dexToolbarPos';
  const TRIGGER_SIZE = 40;
  const DRAG_THRESHOLD = 8;
  const EDGE_MARGIN = 8;
  const MENU_GAP = 12;

  const ICONS = {
    down: 'expand_more',
    up: 'expand_less',
    left: 'chevron_left',
    right: 'chevron_right',
    copy: 'content_copy',
    paste: 'content_paste',
    close: 'close'
  };

  /*
   * ------------------------------------------------------------
   * GLOBAL TOOLBAR / PAGE VISIBILITY
   * ------------------------------------------------------------
   */

  function isHomePage() {
    try {
      const path = window.location.pathname || '/';

      /*
       * Adjust these if your application uses a different
       * homepage route.
       *
       * Supported homepage patterns:
       * /
       * /index.html
       * /home
       * /homepage
       */
      return (
        path === '/' ||
        path === '/index.html' ||
        path === '/home' ||
        path === '/homepage'
      );
    } catch (_e) {
      return false;
    }
  }

  function updateToolbarVisibility() {
    const hidden = isHomePage();

    if (hidden) {
      btn.style.display = 'none';
      menu.classList.remove('open');
    } else {
      btn.style.display = 'flex';
    }
  }

  /*
   * ------------------------------------------------------------
   * STYLES
   * ------------------------------------------------------------
   */

  const style = document.createElement('style');
  style.id = 'dex-toolbar2-styles';

  style.textContent = `
    #dexToolbarBtn {
      position: fixed;
      width: ${TRIGGER_SIZE}px;
      height: ${TRIGGER_SIZE}px;
      border-radius: 50%;
      background: var(--matte, #181C1F);
      color: var(--color, #cacaca);
      border: 1px solid var(--border, rgba(255,255,255,0.10));
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      z-index: 9997;
      box-shadow: 0 6px 18px rgba(0,0,0,0.5);
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      font-family: 'classy', sans-serif;
      padding: 0;
      transition:
        box-shadow 0.15s ease,
        transform 0.08s ease;
    }

    #dexToolbarBtn:active {
      cursor: grabbing;
      transform: scale(0.96);
    }

    #dexToolbarBtn > * {
      pointer-events: none;
    }

    #dexToolbarBtn .material-symbols-rounded {
      font-size: 24px;
    }

    #dexToolbarBtn.dragging {
      box-shadow: 0 10px 28px rgba(0,0,0,0.65);
      opacity: 0.9;
    }

    #dexToolbarMenu {
      position: fixed;
      background: var(--matte, #181C1F);
      border: 1px solid var(--border, rgba(255,255,255,0.10));
      border-radius: 12px;
      padding: 4px;
      z-index: 9998;
      display: none;
      flex-direction: column;
      min-width: 168px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.6);
      font-family: 'classy', sans-serif;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }

    #dexToolbarMenu.open {
      display: flex;
    }

    .dex-tb-item {
      background: transparent;
      border: none;
      color: var(--color, #cacaca);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13.5px;
      text-align: left;
      width: 100%;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }

    .dex-tb-item:hover,
    .dex-tb-item:active {
      background: rgba(255,255,255,0.06);
    }

    .dex-tb-item > * {
      pointer-events: none;
    }

    .dex-tb-item .material-symbols-rounded {
      font-size: 20px;
    }

    .dex-tb-sep {
      height: 1px;
      background: var(--border, rgba(255,255,255,0.08));
      margin: 4px 6px;
    }

    /*
     * IMPORTANT:
     *
     * Do NOT disable text selection in CodeMirror.
     *
     * The previous implementation used:
     *
     *   user-select: none !important
     *
     * on CodeMirror lines and textarea. That prevents the browser's
     * native selection handles and drag-selection behavior on
     * phones/tablets.
     */

    .CodeMirror {
      -webkit-touch-callout: default;
      user-select: text;
      -webkit-user-select: text;
    }

    .CodeMirror-line,
    .CodeMirror-line *,
    .CodeMirror pre.CodeMirror-line,
    .CodeMirror pre.CodeMirror-line-like,
    .CodeMirror textarea {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
    }
  `;

  document.head.appendChild(style);

  /*
   * ------------------------------------------------------------
   * BUTTON
   * ------------------------------------------------------------
   */

  const btn = document.createElement('button');

  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute('aria-label', 'Open editor toolbar');

  btn.innerHTML =
    '<span class="material-symbols-rounded" id="dexToolbarBtnIcon">' +
    ICONS.down +
    '</span>';

  document.body.appendChild(btn);

  /*
   * ------------------------------------------------------------
   * MENU
   * ------------------------------------------------------------
   */

  const menu = document.createElement('div');

  menu.id = 'dexToolbarMenu';

  menu.innerHTML =
    '<button type="button" class="dex-tb-item" id="dexTbCopy">' +
      '<span class="material-symbols-rounded">' +
        ICONS.copy +
      '</span>' +
      '<span>Copy</span>' +
    '</button>' +

    '<button type="button" class="dex-tb-item" id="dexTbPaste">' +
      '<span class="material-symbols-rounded">' +
        ICONS.paste +
      '</span>' +
      '<span>Paste</span>' +
    '</button>' +

    '<div class="dex-tb-sep"></div>' +

    '<button type="button" class="dex-tb-item" id="dexTbClose">' +
      '<span class="material-symbols-rounded">' +
        ICONS.close +
      '</span>' +
      '<span>Close menu</span>' +
    '</button>';

  document.body.appendChild(menu);

  const btnIcon = document.getElementById('dexToolbarBtnIcon');
  const copyEl = document.getElementById('dexTbCopy');
  const pasteEl = document.getElementById('dexTbPaste');
  const closeEl = document.getElementById('dexTbClose');

  /*
   * ------------------------------------------------------------
   * POSITION
   * ------------------------------------------------------------
   */

  function loadPos() {
    try {
      const raw = localStorage.getItem(LS_KEY);

      if (!raw) return null;

      const p = JSON.parse(raw);

      if (
        typeof p.left === 'number' &&
        typeof p.top === 'number'
      ) {
        return p;
      }
    } catch (_e) {}

    return null;
  }

  function savePos(left, top) {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          left,
          top
        })
      );
    } catch (_e) {}
  }

  function clamp(left, top) {
    const maxLeft =
      window.innerWidth -
      TRIGGER_SIZE -
      EDGE_MARGIN;

    const maxTop =
      window.innerHeight -
      TRIGGER_SIZE -
      EDGE_MARGIN;

    return {
      left: Math.max(
        EDGE_MARGIN,
        Math.min(maxLeft, left)
      ),

      top: Math.max(
        EDGE_MARGIN,
        Math.min(maxTop, top)
      )
    };
  }

  function defaultPos() {
    return clamp(
      window.innerWidth -
        TRIGGER_SIZE -
        16,

      Math.round(
        window.innerHeight * 0.35
      )
    );
  }

  function applyPos(pos) {
    btn.style.left = pos.left + 'px';
    btn.style.top = pos.top + 'px';

    updateChevron(pos);
  }

  function chevronForPos(pos) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const distLeft = pos.left;
    const distRight =
      w - pos.left - TRIGGER_SIZE;

    const distTop = pos.top;
    const distBottom =
      h - pos.top - TRIGGER_SIZE;

    const min = Math.min(
      distLeft,
      distRight,
      distTop,
      distBottom
    );

    if (
      min === distTop &&
      distTop <= distLeft &&
      distTop <= distRight &&
      distTop <= distBottom
    ) {
      return 'down';
    }

    if (min === distBottom) {
      return 'up';
    }

    if (min === distLeft) {
      return 'right';
    }

    if (min === distRight) {
      return 'left';
    }

    return 'down';
  }

  function updateChevron(pos) {
    const dir = chevronForPos(pos);

    btnIcon.textContent = ICONS[dir];
    btn.dataset.dir = dir;
  }

  const initial =
    loadPos() ||
    defaultPos();

  applyPos(
    clamp(
      initial.left,
      initial.top
    )
  );

  /*
   * ------------------------------------------------------------
   * MENU STATE
   * ------------------------------------------------------------
   */

  function menuOpen() {
    return menu.classList.contains('open');
  }

  /*
   * ------------------------------------------------------------
   * TOOLBAR BUTTON DRAG
   * ------------------------------------------------------------
   */

  let drag = null;

  btn.addEventListener(
    'pointerdown',
    (e) => {
      /*
       * Ignore secondary mouse buttons.
       */
      if (
        e.pointerType === 'mouse' &&
        e.button !== 0
      ) {
        return;
      }

      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: btn.offsetLeft,
        startTop: btn.offsetTop,
        moved: false
      };

      try {
        btn.setPointerCapture(
          e.pointerId
        );
      } catch (_e) {}
    }
  );

  btn.addEventListener(
    'pointermove',
    (e) => {
      if (
        !drag ||
        e.pointerId !== drag.pointerId
      ) {
        return;
      }

      const dx =
        e.clientX - drag.startX;

      const dy =
        e.clientY - drag.startY;

      if (
        !drag.moved &&
        Math.hypot(dx, dy) <
          DRAG_THRESHOLD
      ) {
        return;
      }

      if (!drag.moved) {
        drag.moved = true;

        btn.classList.add(
          'dragging'
        );

        if (menuOpen()) {
          closeMenu();
        }
      }

      const next = clamp(
        drag.startLeft + dx,
        drag.startTop + dy
      );

      applyPos(next);
    }
  );

  function endDrag(e) {
    if (!drag) return;

    const wasDrag = drag.moved;

    try {
      btn.releasePointerCapture(
        drag.pointerId
      );
    } catch (_e) {}

    drag = null;

    btn.classList.remove(
      'dragging'
    );

    if (wasDrag) {
      const pos = {
        left: btn.offsetLeft,
        top: btn.offsetTop
      };

      savePos(
        pos.left,
        pos.top
      );

      updateChevron(pos);
    } else {
      toggleMenu();
    }
  }

  btn.addEventListener(
    'pointerup',
    endDrag
  );

  btn.addEventListener(
    'pointercancel',
    endDrag
  );

  /*
   * ------------------------------------------------------------
   * WINDOW RESIZE
   * ------------------------------------------------------------
   */

  window.addEventListener(
    'resize',
    () => {
      const clamped = clamp(
        btn.offsetLeft,
        btn.offsetTop
      );

      applyPos(clamped);

      savePos(
        clamped.left,
        clamped.top
      );
    }
  );

  /*
   * ------------------------------------------------------------
   * MENU POSITIONING
   * ------------------------------------------------------------
   */

  function positionMenu() {
    let anchor = null;

    try {
      const ed =
        window.dexEditor;

      const cm =
        ed && ed.cm
          ? ed.cm
          : null;

      if (cm) {
        const sel =
          cm.getSelection();

        if (
          sel &&
          sel.length > 0
        ) {
          const to =
            cm.getCursor('to');

          const c =
            cm.charCoords(
              to,
              'window'
            );

          anchor = {
            x: c.right,
            y: c.bottom,
            fromSelection: true
          };
        } else {
          const c =
            cm.charCoords(
              cm.getCursor(),
              'window'
            );

          anchor = {
            x: c.right,
            y: c.bottom,
            fromSelection: false
          };
        }
      }
    } catch (_e) {}

    /*
     * Temporarily show the menu so its dimensions
     * can be measured.
     */
    menu.style.visibility =
      'hidden';

    menu.classList.add(
      'open'
    );

    const menuW =
      menu.offsetWidth;

    const menuH =
      menu.offsetHeight;

    menu.classList.remove(
      'open'
    );

    menu.style.visibility = '';

    const vw =
      window.innerWidth;

    const vh =
      window.innerHeight;

    let left;
    let top;

    if (
      anchor &&
      anchor.fromSelection
    ) {
      left =
        anchor.x +
        MENU_GAP;

      top =
        anchor.y +
        MENU_GAP;
    } else if (anchor) {
      const bx =
        btn.offsetLeft;

      const by =
        btn.offsetTop;

      left =
        anchor.x < vw / 2
          ? vw -
            menuW -
            MENU_GAP -
            EDGE_MARGIN
          : MENU_GAP +
            EDGE_MARGIN;

      top =
        anchor.y < vh / 2
          ? vh -
            menuH -
            MENU_GAP -
            EDGE_MARGIN
          : MENU_GAP +
            EDGE_MARGIN;

      const dir =
        btn.dataset.dir;

      if (dir === 'left') {
        left =
          bx -
          menuW -
          MENU_GAP;
      }

      if (dir === 'right') {
        left =
          bx +
          TRIGGER_SIZE +
          MENU_GAP;
      }

      if (dir === 'up') {
        top =
          by -
          menuH -
          MENU_GAP;
      }

      if (dir === 'down') {
        top =
          by +
          TRIGGER_SIZE +
          MENU_GAP;
      }
    } else {
      const bx =
        btn.offsetLeft;

      const by =
        btn.offsetTop;

      const dir =
        btn.dataset.dir ||
        'down';

      if (dir === 'left') {
        left =
          bx -
          menuW -
          MENU_GAP;

        top = by;
      } else if (dir === 'right') {
        left =
          bx +
          TRIGGER_SIZE +
          MENU_GAP;

        top = by;
      } else if (dir === 'up') {
        left = bx;

        top =
          by -
          menuH -
          MENU_GAP;
      } else {
        left = bx;

        top =
          by +
          TRIGGER_SIZE +
          MENU_GAP;
      }
    }

    left = Math.max(
      EDGE_MARGIN,
      Math.min(
        vw -
          menuW -
          EDGE_MARGIN,
        left
      )
    );

    top = Math.max(
      EDGE_MARGIN,
      Math.min(
        vh -
          menuH -
          EDGE_MARGIN,
        top
      )
    );

    menu.style.left =
      left + 'px';

    menu.style.top =
      top + 'px';
  }

  /*
   * ------------------------------------------------------------
   * SELECTION STATE
   * ------------------------------------------------------------
   */

  let savedSelection = null;

  /*
   * Used to prevent our own CodeMirror operations
   * from immediately closing the toolbar.
   */
  let internalEditorChange = false;

  function captureSelection() {
    try {
      const ed =
        window.dexEditor;

      if (
        ed &&
        ed.cm
      ) {
        const cm = ed.cm;

        const from =
          cm.getCursor('from');

        const to =
          cm.getCursor('to');

        const text =
          cm.getSelection();

        savedSelection = {
          from,
          to,
          text
        };
      }
    } catch (_e) {}
  }

  function restoreSelection() {
    try {
      const ed =
        window.dexEditor;

      if (
        ed &&
        ed.cm &&
        savedSelection
      ) {
        ed.cm.setSelection(
          savedSelection.from,
          savedSelection.to
        );

        ed.cm.focus();
      }
    } catch (_e) {}
  }

  /*
   * ------------------------------------------------------------
   * CURSOR / SELECTION CHANGE DETECTION
   *
   * Requirement:
   *
   * Once toolbar is open, moving the editor cursor
   * or changing the editor selection closes it.
   * ------------------------------------------------------------
   */

  let editorListenersAttached = false;

  function closeToolbarOnEditorMovement() {
    if (
      internalEditorChange
    ) {
      return;
    }

    if (!menuOpen()) {
      return;
    }

    closeMenu();
  }

  function attachEditorChangeListener() {
    if (
      editorListenersAttached
    ) {
      return true;
    }

    try {
      const ed =
        window.dexEditor;

      const cm =
        ed && ed.cm
          ? ed.cm
          : null;

      if (!cm) {
        return false;
      }

      /*
       * CodeMirror fires cursorActivity whenever the
       * cursor or selection changes.
       *
       * This is exactly what is needed here.
       */
      cm.on(
        'cursorActivity',
        closeToolbarOnEditorMovement
      );

      editorListenersAttached = true;

      return true;
    } catch (_e) {
      return false;
    }
  }

  /*
   * Editor may be initialized after this toolbar script.
   * Keep trying until the editor becomes available.
   */
  function ensureEditorListener() {
    if (
      attachEditorChangeListener()
    ) {
      return;
    }

    setTimeout(
      ensureEditorListener,
      300
    );
  }

  /*
   * ------------------------------------------------------------
   * OPEN / CLOSE / TOGGLE
   * ------------------------------------------------------------
   */

  function openMenu() {
    if (isHomePage()) {
      return;
    }

    /*
     * Capture selection BEFORE opening the menu.
     */
    captureSelection();

    /*
     * Make sure cursorActivity is connected.
     */
    attachEditorChangeListener();

    positionMenu();

    menu.classList.add(
      'open'
    );
  }

  function closeMenu() {
    menu.classList.remove(
      'open'
    );

    /*
     * Keep the selection briefly so copy/paste can still
     * use the captured selection after the menu closes.
     */
    setTimeout(
      () => {
        if (!menuOpen()) {
          savedSelection = null;
        }
      },
      300
    );
  }

  function toggleMenu() {
    if (menuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /*
   * Global API.
   *
   * Other parts of NoteApp can call:
   *
   *   window.dexOpenToolbar()
   *   window.dexCloseToolbar()
   *   window.dexToggleToolbar()
   */
  window.dexOpenToolbar =
    openMenu;

  window.dexCloseToolbar =
    closeMenu;

  window.dexToggleToolbar =
    toggleMenu;

  /*
   * ------------------------------------------------------------
   * MENU BUTTON MOUSE BEHAVIOR
   * ------------------------------------------------------------
   */

  [
    copyEl,
    pasteEl,
    closeEl
  ].forEach(
    (el) => {
      el.addEventListener(
        'mousedown',
        (e) => {
          e.preventDefault();
        }
      );
    }
  );

  /*
   * ------------------------------------------------------------
   * NOTIFICATION
   * ------------------------------------------------------------
   */

  function notify(m) {
    if (
      typeof showNotification ===
      'function'
    ) {
      showNotification(m);
    }
  }

  /*
   * ------------------------------------------------------------
   * COPY
   * ------------------------------------------------------------
   */

  copyEl.addEventListener(
    'click',
    async () => {
      const ed =
        window.dexEditor;

      let text = '';

      if (
        savedSelection &&
        savedSelection.text
      ) {
        text =
          savedSelection.text;
      } else if (
        ed &&
        ed.getSelection
      ) {
        const s =
          ed.getSelection();

        if (
          s &&
          s.text
        ) {
          text = s.text;
        }
      }

      if (
        !text &&
        ed &&
        ed.getValue
      ) {
        text =
          ed.getValue();
      }

      if (!text) {
        notify(
          'Nothing to copy'
        );
        return;
      }

      try {
        await navigator.clipboard.writeText(
          text
        );

        notify('Copied');
      } catch (_e) {
        try {
          const ta =
            document.createElement(
              'textarea'
            );

          ta.value = text;

          ta.style.position =
            'fixed';

          ta.style.opacity =
            '0';

          document.body.appendChild(
            ta
          );

          ta.focus();
          ta.select();

          document.execCommand(
            'copy'
          );

          document.body.removeChild(
            ta
          );

          notify('Copied');
        } catch (_e2) {
          notify(
            'Copy failed — grant clipboard permission'
          );
        }
      }
    }
  );

  /*
   * ------------------------------------------------------------
   * PASTE
   * ------------------------------------------------------------
   */

  pasteEl.addEventListener(
    'click',
    async () => {
      let text = '';

      try {
        text =
          await navigator.clipboard.readText();
      } catch (_e) {
        notify(
          'Paste blocked — allow clipboard permission'
        );

        return;
      }

      if (!text) {
        notify(
          'Clipboard is empty'
        );

        return;
      }

      const ed =
        window.dexEditor;

      const cm =
        ed && ed.cm
          ? ed.cm
          : null;

      if (!cm) {
        notify(
          'Editor not ready'
        );

        return;
      }

      let from;
      let to;

      if (
        savedSelection &&
        isPosValid(
          cm,
          savedSelection.from
        ) &&
        isPosValid(
          cm,
          savedSelection.to
        )
      ) {
        from =
          savedSelection.from;

        to =
          savedSelection.to;
      } else {
        const c =
          cm.getCursor();

        from = c;
        to = c;
      }

      /*
       * Prevent cursorActivity from closing
       * the toolbar because this is an intentional
       * toolbar operation.
       */
      internalEditorChange = true;

      cm.operation(
        () => {
          cm.replaceRange(
            text,
            from,
            to
          );

          const startIdx =
            cm.indexFromPos(
              from
            );

          const endPos =
            cm.posFromIndex(
              startIdx +
              text.length
            );

          cm.setSelection(
            endPos,
            endPos
          );
        }
      );

      internalEditorChange = false;

      const startIdx =
        cm.indexFromPos(
          from
        );

      const endPos =
        cm.posFromIndex(
          startIdx +
          text.length
        );

      savedSelection = {
        from: endPos,
        to: endPos,
        text: ''
      };

      notify(
        'Pasted ' +
        text.length +
        ' character' +
        (
          text.length === 1
            ? ''
            : 's'
        )
      );
    }
  );

  /*
   * ------------------------------------------------------------
   * POSITION VALIDATION
   * ------------------------------------------------------------
   */

  function isPosValid(
    cm,
    pos
  ) {
    if (
      !pos ||
      typeof pos.line !==
        'number' ||
      typeof pos.ch !==
        'number'
    ) {
      return false;
    }

    const lc =
      cm.lineCount();

    if (
      pos.line < 0 ||
      pos.line >= lc
    ) {
      return false;
    }

    const lineLen =
      cm.getLine(
        pos.line
      ).length;

    return (
      pos.ch >= 0 &&
      pos.ch <= lineLen
    );
  }

  /*
   * ------------------------------------------------------------
   * CLOSE BUTTON
   * ------------------------------------------------------------
   */

  closeEl.addEventListener(
    'click',
    closeMenu
  );

  /*
   * ------------------------------------------------------------
   * MOBILE / TABLET SELECTION
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Do not block pointer events on the editor.
   *
   * Normal browser/CodeMirror touch selection is allowed.
   *
   * Long press is still supported as an enhancement.
   * ------------------------------------------------------------
   */

  const LONG_PRESS_MS = 500;
  const MOVE_TOLERANCE = 10;

  function wordBoundsAt(
    cm,
    pos
  ) {
    const line =
      cm.getLine(
        pos.line
      ) || '';

    const isWord =
      (c) =>
        c &&
        /[\w$@#-]/.test(c);

    let s = pos.ch;
    let e = pos.ch;

    while (
      s > 0 &&
      isWord(
        line[s - 1]
      )
    ) {
      s--;
    }

    while (
      e < line.length &&
      isWord(
        line[e]
      )
    ) {
      e++;
    }

    if (s === e) {
      if (
        e < line.length
      ) {
        e = s + 1;
      }
    }

    return {
      from: {
        line: pos.line,
        ch: s
      },

      to: {
        line: pos.line,
        ch: e
      }
    };
  }

  /*
   * ------------------------------------------------------------
   * LONG PRESS
   * ------------------------------------------------------------
   */

  function fireLongPress(
    clientX,
    clientY
  ) {
    const ed =
      window.dexEditor;

    const cm =
      ed && ed.cm
        ? ed.cm
        : null;

    if (!cm) {
      return;
    }

    let pos;

    try {
      pos =
        cm.coordsChar(
          {
            left: clientX,
            top: clientY
          },
          'window'
        );
    } catch (_e) {
      return;
    }

    if (!pos) {
      return;
    }

    const bounds =
      wordBoundsAt(
        cm,
        pos
      );

    try {
      internalEditorChange =
        true;

      cm.setSelection(
        bounds.from,
        bounds.to
      );

      internalEditorChange =
        false;
    } catch (_e) {
      internalEditorChange =
        false;

      return;
    }

    savedSelection = {
      from: bounds.from,
      to: bounds.to,
      text: cm.getRange(
        bounds.from,
        bounds.to
      )
    };

    openMenu();
  }

  /*
   * ------------------------------------------------------------
   * TOUCH / PEN LONG PRESS
   * ------------------------------------------------------------
   *
   * We deliberately do NOT call preventDefault().
   *
   * This is important for:
   *
   * - Android text selection handles
   * - iOS/iPadOS selection handles
   * - Windows pen selection
   * - tablet drag selection
   * - CodeMirror's normal selection system
   *
   * A long press selects a word and opens the toolbar.
   * A normal drag remains a normal editor selection.
   * ------------------------------------------------------------
   */

  function attachLongPress() {
    const cmEl =
      document.querySelector(
        '.CodeMirror'
      );

    if (!cmEl) {
      setTimeout(
        attachLongPress,
        200
      );

      return;
    }

    if (
      cmEl.__dexLongPressBound
    ) {
      return;
    }

    cmEl.__dexLongPressBound =
      true;

    /*
     * Do not suppress the native context menu here.
     *
     * More importantly, do not suppress selectstart.
     *
     * Native selection is required for mobile/tablet.
     */

    cmEl.addEventListener(
      'pointerdown',
      (e) => {
        if (
          e.pointerType !==
            'touch' &&
          e.pointerType !==
            'pen'
        ) {
          return;
        }

        const startX =
          e.clientX;

        const startY =
          e.clientY;

        let cancelled =
          false;

        const timer =
          setTimeout(
            () => {
              if (cancelled) {
                return;
              }

              /*
               * The user held the pointer without dragging.
               * Treat it as a long press.
               */
              cleanup();

              fireLongPress(
                startX,
                startY
              );
            },
            LONG_PRESS_MS
          );

        function onMove(ev) {
          if (cancelled) {
            return;
          }

          const dx =
            ev.clientX -
            startX;

          const dy =
            ev.clientY -
            startY;

          /*
           * The moment the user starts dragging,
           * cancel long-press handling and allow
           * CodeMirror/browser selection to proceed.
           */
          if (
            Math.hypot(
              dx,
              dy
            ) >
            MOVE_TOLERANCE
          ) {
            cancelled = true;

            clearTimeout(
              timer
            );

            cleanup();
          }
        }

        function onEnd() {
          if (cancelled) {
            return;
          }

          cancelled = true;

          clearTimeout(
            timer
          );

          cleanup();
        }

        function cleanup() {
          document.removeEventListener(
            'pointermove',
            onMove
          );

          document.removeEventListener(
            'pointerup',
            onEnd
          );

          document.removeEventListener(
            'pointercancel',
            onEnd
          );
        }

        document.addEventListener(
          'pointermove',
          onMove,
          {
            passive: true
          }
        );

        document.addEventListener(
          'pointerup',
          onEnd,
          {
            passive: true
          }
        );

        document.addEventListener(
          'pointercancel',
          onEnd,
          {
            passive: true
          }
        );
      },
      {
        passive: true
      }
    );
  }

  /*
   * ------------------------------------------------------------
   * GLOBAL SPA NAVIGATION HANDLING
   * ------------------------------------------------------------
   *
   * The toolbar is global to NoteApp, but it must not appear
   * on the homepage.
   *
   * These hooks handle applications that navigate without
   * doing a full page reload.
   * ------------------------------------------------------------
   */

  function refreshPageState() {
    updateToolbarVisibility();

    /*
     * The editor may be recreated after navigation.
     * Try to connect cursorActivity again.
     */
    editorListenersAttached =
      false;

    ensureEditorListener();

    attachLongPress();
  }

  /*
   * Browser back/forward/hash changes.
   */
  window.addEventListener(
    'popstate',
    refreshPageState
  );

  window.addEventListener(
    'hashchange',
    refreshPageState
  );

  /*
   * Patch history methods so SPA route changes
   * also update toolbar visibility.
   */
  try {
    const originalPushState =
      history.pushState;

    history.pushState =
      function () {
        const result =
          originalPushState.apply(
            this,
            arguments
          );

        setTimeout(
          refreshPageState,
          0
        );

        return result;
      };

    const originalReplaceState =
      history.replaceState;

    history.replaceState =
      function () {
        const result =
          originalReplaceState.apply(
            this,
            arguments
          );

        setTimeout(
          refreshPageState,
          0
        );

        return result;
      };
  } catch (_e) {}

  /*
   * ------------------------------------------------------------
   * INITIALIZATION
   * ------------------------------------------------------------
   */

  function initialize() {
    updateToolbarVisibility();

    attachLongPress();

    ensureEditorListener();
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

})();