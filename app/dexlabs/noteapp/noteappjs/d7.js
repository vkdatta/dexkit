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
   * PAGE / ROUTE
   * ------------------------------------------------------------
   */

  function isHomePage() {
    try {
      const path = window.location.pathname || '/';

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
    if (isHomePage()) {
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
      padding: 6px;
      z-index: 9998;
      display: none;
      flex-direction: column;
      min-width: 190px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.6);
      font-family: 'classy', sans-serif;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }

    #dexToolbarMenu.open {
      display: flex;
    }

    /*
     * ----------------------------------------------------------
     * CURSOR PAD
     * ----------------------------------------------------------
     */

    .dex-cursor-pad {
      display: grid;
      grid-template-columns: 42px 42px 42px;
      grid-template-rows: 42px 42px 42px;
      justify-content: center;
      align-items: center;
      margin: 4px auto 6px;
    }

    .dex-cursor-btn {
      width: 38px;
      height: 38px;
      padding: 0;
      margin: 0;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--color, #cacaca);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .dex-cursor-btn:hover,
    .dex-cursor-btn:active {
      background: rgba(255,255,255,0.08);
    }

    .dex-cursor-btn .material-symbols-rounded {
      font-size: 24px;
      pointer-events: none;
    }

    .dex-cursor-up {
      grid-column: 2;
      grid-row: 1;
    }

    .dex-cursor-left {
      grid-column: 1;
      grid-row: 2;
    }

    .dex-cursor-center {
      grid-column: 2;
      grid-row: 2;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      color: var(--color, #cacaca);
      cursor: default;
    }

    .dex-cursor-right {
      grid-column: 3;
      grid-row: 2;
    }

    .dex-cursor-down {
      grid-column: 2;
      grid-row: 3;
    }

    /*
     * ----------------------------------------------------------
     * SELECT TOGGLE
     * ----------------------------------------------------------
     */

    .dex-select-row {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px 4px 7px;
    }

    .dex-select-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--color, #cacaca);
      padding: 8px 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .dex-select-toggle:hover,
    .dex-select-toggle:active {
      background: rgba(255,255,255,0.06);
    }

    .dex-select-checkbox {
      width: 16px;
      height: 16px;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .dex-select-checkbox .material-symbols-rounded {
      font-size: 14px;
      display: none;
    }

    .dex-select-toggle.active
      .dex-select-checkbox {
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.45);
    }

    .dex-select-toggle.active
      .dex-select-checkbox
      .material-symbols-rounded {
      display: block;
    }

    /*
     * ----------------------------------------------------------
     * NORMAL MENU ITEMS
     * ----------------------------------------------------------
     */

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
     * ----------------------------------------------------------
     * IMPORTANT:
     *
     * Never disable text selection in CodeMirror.
     * This allows native mobile/tablet drag selection.
     * ----------------------------------------------------------
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
   * FLOATING BUTTON
   * ------------------------------------------------------------
   */

  const btn = document.createElement('button');

  btn.type = 'button';
  btn.id = 'dexToolbarBtn';
  btn.setAttribute(
    'aria-label',
    'Open editor toolbar'
  );

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

  menu.innerHTML = `
    <div class="dex-cursor-pad">

      <button
        type="button"
        class="dex-cursor-btn dex-cursor-up"
        data-cursor="up"
        aria-label="Move cursor up">
        <span class="material-symbols-rounded">
          keyboard_arrow_up
        </span>
      </button>

      <button
        type="button"
        class="dex-cursor-btn dex-cursor-left"
        data-cursor="left"
        aria-label="Move cursor left">
        <span class="material-symbols-rounded">
          keyboard_arrow_left
        </span>
      </button>

      <div
        class="dex-cursor-btn dex-cursor-center"
        aria-hidden="true">
        <span class="material-symbols-rounded">
          fiber_manual_record
        </span>
      </div>

      <button
        type="button"
        class="dex-cursor-btn dex-cursor-right"
        data-cursor="right"
        aria-label="Move cursor right">
        <span class="material-symbols-rounded">
          keyboard_arrow_right
        </span>
      </button>

      <button
        type="button"
        class="dex-cursor-btn dex-cursor-down"
        data-cursor="down"
        aria-label="Move cursor down">
        <span class="material-symbols-rounded">
          keyboard_arrow_down
        </span>
      </button>

    </div>

    <div class="dex-select-row">
      <button
        type="button"
        class="dex-select-toggle"
        id="dexSelectToggle"
        aria-pressed="false">

        <span class="dex-select-checkbox">
          <span class="material-symbols-rounded">
            check
          </span>
        </span>

        <span>Select</span>
      </button>
    </div>

    <div class="dex-tb-sep"></div>

    <button
      type="button"
      class="dex-tb-item"
      id="dexTbCopy">

      <span class="material-symbols-rounded">
        content_copy
      </span>

      <span>Copy</span>
    </button>

    <button
      type="button"
      class="dex-tb-item"
      id="dexTbPaste">

      <span class="material-symbols-rounded">
        content_paste
      </span>

      <span>Paste</span>
    </button>

    <div class="dex-tb-sep"></div>

    <button
      type="button"
      class="dex-tb-item"
      id="dexTbClose">

      <span class="material-symbols-rounded">
        close
      </span>

      <span>Close menu</span>
    </button>
  `;

  document.body.appendChild(menu);

  const btnIcon =
    document.getElementById(
      'dexToolbarBtnIcon'
    );

  const copyEl =
    document.getElementById(
      'dexTbCopy'
    );

  const pasteEl =
    document.getElementById(
      'dexTbPaste'
    );

  const closeEl =
    document.getElementById(
      'dexTbClose'
    );

  const selectToggle =
    document.getElementById(
      'dexSelectToggle'
    );

  const cursorButtons =
    Array.from(
      document.querySelectorAll(
        '.dex-cursor-btn[data-cursor]'
      )
    );

  /*
   * ------------------------------------------------------------
   * POSITION
   * ------------------------------------------------------------
   */

  function loadPos() {
    try {
      const raw =
        localStorage.getItem(
          LS_KEY
        );

      if (!raw) return null;

      const p =
        JSON.parse(raw);

      if (
        typeof p.left === 'number' &&
        typeof p.top === 'number'
      ) {
        return p;
      }
    } catch (_e) {}

    return null;
  }

  function savePos(
    left,
    top
  ) {
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

  function clamp(
    left,
    top
  ) {
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
        Math.min(
          maxLeft,
          left
        )
      ),

      top: Math.max(
        EDGE_MARGIN,
        Math.min(
          maxTop,
          top
        )
      )
    };
  }

  function defaultPos() {
    return clamp(
      window.innerWidth -
        TRIGGER_SIZE -
        16,

      Math.round(
        window.innerHeight *
        0.35
      )
    );
  }

  function applyPos(pos) {
    btn.style.left =
      pos.left + 'px';

    btn.style.top =
      pos.top + 'px';

    updateChevron(pos);
  }

  function chevronForPos(pos) {
    const w =
      window.innerWidth;

    const h =
      window.innerHeight;

    const distLeft =
      pos.left;

    const distRight =
      w -
      pos.left -
      TRIGGER_SIZE;

    const distTop =
      pos.top;

    const distBottom =
      h -
      pos.top -
      TRIGGER_SIZE;

    const min =
      Math.min(
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
    const dir =
      chevronForPos(pos);

    btnIcon.textContent =
      ICONS[dir];

    btn.dataset.dir =
      dir;
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
    return menu.classList.contains(
      'open'
    );
  }

  /*
   * ------------------------------------------------------------
   * BUTTON DRAG
   * ------------------------------------------------------------
   */

  let drag = null;

  btn.addEventListener(
    'pointerdown',
    (e) => {
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
        startLeft:
          btn.offsetLeft,
        startTop:
          btn.offsetTop,
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
        e.pointerId !==
          drag.pointerId
      ) {
        return;
      }

      const dx =
        e.clientX -
        drag.startX;

      const dy =
        e.clientY -
        drag.startY;

      if (
        !drag.moved &&
        Math.hypot(
          dx,
          dy
        ) <
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

      applyPos(
        clamp(
          drag.startLeft + dx,
          drag.startTop + dy
        )
      );
    }
  );

  function endDrag(e) {
    if (!drag) return;

    const wasDrag =
      drag.moved;

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
        left:
          btn.offsetLeft,
        top:
          btn.offsetTop
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
   * RESIZE
   * ------------------------------------------------------------
   */

  window.addEventListener(
    'resize',
    () => {
      const clamped =
        clamp(
          btn.offsetLeft,
          btn.offsetTop
        );

      applyPos(clamped);

      savePos(
        clamped.left,
        clamped.top
      );

      if (menuOpen()) {
        positionMenu();
      }
    }
  );

  /*
   * ------------------------------------------------------------
   * MENU POSITION
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

    menu.style.visibility =
      '';

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
      } else if (
        dir === 'right'
      ) {
        left =
          bx +
          TRIGGER_SIZE +
          MENU_GAP;

        top = by;
      } else if (
        dir === 'up'
      ) {
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
   * SELECTION
   * ------------------------------------------------------------
   */

  let savedSelection = null;

  let selectionMode = false;

  /*
   * When toolbar itself moves the cursor,
   * cursorActivity must NOT close the toolbar.
   */
  let internalEditorChange =
    false;

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
        internalEditorChange =
          true;

        ed.cm.setSelection(
          savedSelection.from,
          savedSelection.to
        );

        ed.cm.focus();

        internalEditorChange =
          false;
      }
    } catch (_e) {
      internalEditorChange =
        false;
    }
  }

  /*
   * ------------------------------------------------------------
   * CURSOR ACTIVITY
   * ------------------------------------------------------------
   *
   * Opening the toolbar and then moving the editor cursor
   * normally closes the toolbar.
   *
   * Movement through our arrow controls is marked as an
   * internal movement and therefore keeps the toolbar open.
   * ------------------------------------------------------------
   */

  let editorListenersAttached =
    false;

  function closeToolbarOnEditorMovement() {
    if (internalEditorChange) {
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

      cm.on(
        'cursorActivity',
        closeToolbarOnEditorMovement
      );

      editorListenersAttached =
        true;

      return true;
    } catch (_e) {
      return false;
    }
  }

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
   * CURSOR HELPERS
   * ------------------------------------------------------------
   */

  function getEditor() {
    const ed =
      window.dexEditor;

    if (
      !ed ||
      !ed.cm
    ) {
      return null;
    }

    return ed.cm;
  }

  /*
   * CodeMirror has no universal "desired column" API
   * exposed through getCursor/setCursor.
   *
   * This stores the horizontal target while moving
   * vertically.
   */
  let desiredColumn = null;

  function getCursorState(cm) {
    const from =
      cm.getCursor('from');

    const to =
      cm.getCursor('to');

    return {
      from,
      to
    };
  }

  function comparePos(a, b) {
    if (a.line < b.line) {
      return -1;
    }

    if (a.line > b.line) {
      return 1;
    }

    if (a.ch < b.ch) {
      return -1;
    }

    if (a.ch > b.ch) {
      return 1;
    }

    return 0;
  }

  function normalizePos(cm, pos) {
    const lineCount =
      cm.lineCount();

    let line =
      Math.max(
        0,
        Math.min(
          lineCount - 1,
          pos.line
        )
      );

    const lineLength =
      cm.getLine(line).length;

    let ch =
      Math.max(
        0,
        Math.min(
          lineLength,
          pos.ch
        )
      );

    return {
      line,
      ch
    };
  }

  function moveCursor(
    direction
  ) {
    const cm =
      getEditor();

    if (!cm) {
      notify(
        'Editor not ready'
      );

      return;
    }

    const state =
      getCursorState(cm);

    /*
     * If there is a selection and we are not in
     * selection mode, collapse it first in the
     * direction requested.
     */
    let current;

    if (
      comparePos(
        state.from,
        state.to
      ) !== 0
    ) {
      if (
        selectionMode
      ) {
        current =
          state.to;
      } else {
        if (
          direction ===
          'left' ||
          direction ===
          'up'
        ) {
          current =
            state.from;
        } else {
          current =
            state.to;
        }
      }
    } else {
      current =
        state.to;
    }

    current =
      normalizePos(
        cm,
        current
      );

    let next = {
      line: current.line,
      ch: current.ch
    };

    /*
     * ----------------------------------------------------------
     * LEFT
     * ----------------------------------------------------------
     */

    if (
      direction ===
      'left'
    ) {
      desiredColumn =
        null;

      if (current.ch > 0) {
        next.ch =
          current.ch - 1;
      } else if (
        current.line > 0
      ) {
        next.line =
          current.line - 1;

        next.ch =
          cm.getLine(
            next.line
          ).length;
      }
    }

    /*
     * ----------------------------------------------------------
     * RIGHT
     * ----------------------------------------------------------
     */

    else if (
      direction ===
      'right'
    ) {
      desiredColumn =
        null;

      const lineLength =
        cm.getLine(
          current.line
        ).length;

      if (
        current.ch <
        lineLength
      ) {
        next.ch =
          current.ch + 1;
      } else if (
        current.line <
        cm.lineCount() - 1
      ) {
        next.line =
          current.line + 1;

        next.ch = 0;
      }
    }

    /*
     * ----------------------------------------------------------
     * UP
     * ----------------------------------------------------------
     */

    else if (
      direction ===
      'up'
    ) {
      if (
        desiredColumn ===
        null
      ) {
        desiredColumn =
          current.ch;
      }

      if (
        current.line > 0
      ) {
        next.line =
          current.line - 1;

        next.ch =
          Math.min(
            desiredColumn,
            cm.getLine(
              next.line
            ).length
          );
      }
    }

    /*
     * ----------------------------------------------------------
     * DOWN
     * ----------------------------------------------------------
     */

    else if (
      direction ===
      'down'
    ) {
      if (
        desiredColumn ===
        null
      ) {
        desiredColumn =
          current.ch;
      }

      if (
        current.line <
        cm.lineCount() - 1
      ) {
        next.line =
          current.line + 1;

        next.ch =
          Math.min(
            desiredColumn,
            cm.getLine(
              next.line
            ).length
          );
      }
    }

    /*
     * ----------------------------------------------------------
     * APPLY MOVEMENT
     * ----------------------------------------------------------
     */

    internalEditorChange =
      true;

    try {
      if (selectionMode) {
        /*
         * Extend from the original anchor.
         *
         * In CodeMirror, the anchor is the "from" or "to"
         * depending on selection direction, so we preserve
         * the actual anchor rather than rebuilding it from
         * normalized positions.
         */

        let anchor;

        if (
          comparePos(
            state.from,
            state.to
          ) <= 0
        ) {
          /*
           * For an existing selection, preserve the
           * original anchor based on the active end.
           */
          anchor =
            cm.getCursor('anchor');
        } else {
          anchor =
            cm.getCursor('anchor');
        }

        /*
         * If there was no selection, the current cursor
         * becomes the anchor.
         */
        if (
          comparePos(
            state.from,
            state.to
          ) === 0
        ) {
          anchor =
            state.from;
        }

        cm.setSelection(
          anchor,
          next
        );
      } else {
        cm.setCursor(next);
      }

      cm.focus();
    } finally {
      /*
       * cursorActivity is synchronous in normal CodeMirror
       * usage, so reset after the operation.
       */
      internalEditorChange =
        false;
    }

    /*
     * Save current selection for Copy/Paste.
     */
    captureSelection();

    /*
     * Keep menu positioned relative to the new cursor.
     */
    if (menuOpen()) {
      positionMenu();
    }
  }

  /*
   * ------------------------------------------------------------
   * CURSOR BUTTON EVENTS
   * ------------------------------------------------------------
   */

  cursorButtons.forEach(
    (button) => {
      button.addEventListener(
        'mousedown',
        (e) => {
          e.preventDefault();
        }
      );

      button.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          const direction =
            button.dataset.cursor;

          moveCursor(direction);
        }
      );
    }
  );

  /*
   * ------------------------------------------------------------
   * SELECT MODE
   * ------------------------------------------------------------
   */

  function updateSelectUI() {
    selectToggle.classList.toggle(
      'active',
      selectionMode
    );

    selectToggle.setAttribute(
      'aria-pressed',
      String(selectionMode)
    );
  }

  selectToggle.addEventListener(
    'mousedown',
    (e) => {
      e.preventDefault();
    }
  );

  selectToggle.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      selectionMode =
        !selectionMode;

      updateSelectUI();

      const cm =
        getEditor();

      if (!cm) {
        return;
      }

      /*
       * When entering Select mode, use the current
       * cursor as the selection anchor.
       */
      if (selectionMode) {
        const cursor =
          cm.getCursor();

        internalEditorChange =
          true;

        try {
          cm.setSelection(
            cursor,
            cursor
          );

          cm.focus();
        } finally {
          internalEditorChange =
            false;
        }

        captureSelection();
      }
    }
  );

  updateSelectUI();

  /*
   * ------------------------------------------------------------
   * OPEN / CLOSE
   * ------------------------------------------------------------
   */

  function openMenu() {
    if (isHomePage()) {
      return;
    }

    captureSelection();

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
     * Selection mode is intentionally retained.
     * This allows the user to reopen the toolbar and
     * continue keyboard-like selection.
     */

    setTimeout(
      () => {
        if (!menuOpen()) {
          savedSelection =
            null;
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

  window.dexOpenToolbar =
    openMenu;

  window.dexCloseToolbar =
    closeMenu;

  window.dexToggleToolbar =
    toggleMenu;

  /*
   * ------------------------------------------------------------
   * COPY / PASTE / CLOSE
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

  function notify(message) {
    if (
      typeof showNotification ===
      'function'
    ) {
      showNotification(
        message
      );
    }
  }

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

      const cm =
        getEditor();

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

      internalEditorChange =
        true;

      try {
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
      } finally {
        internalEditorChange =
          false;
      }

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

  closeEl.addEventListener(
    'click',
    closeMenu
  );

  /*
   * ------------------------------------------------------------
   * MOBILE / TABLET LONG PRESS
   * ------------------------------------------------------------
   *
   * Normal drag selection is NOT blocked.
   *
   * Long press selects a word and opens the toolbar.
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

  function fireLongPress(
    clientX,
    clientY
  ) {
    const cm =
      getEditor();

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

      cm.focus();
    } catch (_e) {
      return;
    } finally {
      internalEditorChange =
        false;
    }

    savedSelection = {
      from:
        bounds.from,
      to:
        bounds.to,
      text:
        cm.getRange(
          bounds.from,
          bounds.to
        )
    };

    openMenu();
  }

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
     * DO NOT use:
     *
     * e.preventDefault()
     *
     * on selectstart or pointer movement.
     *
     * Native mobile/tablet selection must remain available.
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
           * A drag means the user wants normal
           * text selection.
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
   * SPA NAVIGATION
   * ------------------------------------------------------------
   */

  function refreshPageState() {
    updateToolbarVisibility();

    if (menuOpen()) {
      closeMenu();
    }

    editorListenersAttached =
      false;

    ensureEditorListener();

    attachLongPress();
  }

  window.addEventListener(
    'popstate',
    refreshPageState
  );

  window.addEventListener(
    'hashchange',
    refreshPageState
  );

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