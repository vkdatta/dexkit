(function () {
  if (window.__dexSelHandlesLoaded) return;
  window.__dexSelHandlesLoaded = true;

  var LONG_PRESS_MS = 450;
  var MOVE_CANCEL_PX = 10;
  var ATTACH_MAX_TRIES = 200;

  function isTouchLike(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  function getCm() {
    var ed = window.dexEditor;
    return ed && ed.cm ? ed.cm : null;
  }

  var handleStart = null, handleEnd = null;
  function ensureHandles() {
    if (handleStart) return;
    handleStart = document.createElement('div');
    handleStart.className = 'dex-sel-handle dex-sel-handle-start';
    handleEnd = document.createElement('div');
    handleEnd.className = 'dex-sel-handle dex-sel-handle-end';
    document.body.appendChild(handleStart);
    document.body.appendChild(handleEnd);

    [[handleStart, 'from'], [handleEnd, 'to']].forEach(function (pair) {
      var el = pair[0], which = pair[1];
      el.addEventListener('pointerdown', function (e) {
        if (!isTouchLike(e)) return;
        e.preventDefault(); e.stopPropagation();
        try { el.setPointerCapture(e.pointerId); } catch (_e) {}
        beginHandleDrag(which, e.pointerId);
      }, { passive: false });
    });

    document.addEventListener('pointermove', onHandleDragMove, { passive: false });
    document.addEventListener('pointerup', endHandleDrag, { passive: false });
    document.addEventListener('pointercancel', endHandleDrag, { passive: false });
  }

  function placeHandle(el, coords) {
    el.style.left = coords.left + 'px';
    el.style.top = coords.top + 'px';
    el.style.setProperty('--dex-sel-stem-h', Math.max(4, coords.bottom - coords.top) + 'px');
    el.style.display = 'block';
  }

  function positionHandles() {
    var cm = getCm();
    if (!cm || !cm.somethingSelected()) { hideHandles(); return; }
    ensureHandles();
    var from = cm.getCursor('from'), to = cm.getCursor('to');
    placeHandle(handleStart, cm.charCoords(from, 'window'));
    placeHandle(handleEnd, cm.charCoords(to, 'window'));
  }

  function hideHandles() {
    if (handleStart) handleStart.style.display = 'none';
    if (handleEnd) handleEnd.style.display = 'none';
  }
  // Exposed so the router's shared teardown step (exitActiveMode, in
  // dexlabs.txt) can hide any lingering handles on navigation, mirroring
  // window.dexCloseNativeMenu.
  window.dexHideSelectionHandles = hideHandles;
  // Self-contained partial coverage: browser back/forward navigation.
  // In-app pushState navigation (Home/File Manager/note links) still needs
  // exitActiveMode() to call window.dexHideSelectionHandles() directly.
  window.addEventListener('popstate', hideHandles);

  var dragging = null, dragPointerId = null;
  var dragFixedPoint = null;

  function beginHandleDrag(which, pointerId) {
    var cm = getCm();
    if (!cm || !cm.somethingSelected()) return;
    dragging = which;
    dragPointerId = pointerId;
    dragFixedPoint = (which === 'from') ? cm.getCursor('to') : cm.getCursor('from');
  }

  function onHandleDragMove(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    e.preventDefault();
    var cm = getCm();
    if (!cm) return;
    var pos = cm.coordsChar({ left: e.clientX, top: e.clientY - 32 }, 'window');
    cm.setSelection(dragFixedPoint, pos);
    positionHandles();
  }

  function endHandleDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = null;
    dragPointerId = null;
    dragFixedPoint = null;
  }

  var pressTimer = null;
  var pressStart = null;
  var suppressNextPointerUp = false;

  function cancelPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
  }

  function posEq(a, b) { return a.line === b.line && a.ch === b.ch; }

  function firePress(clientX, clientY) {
    var cm = getCm();
    if (!cm) return;
    var pos = cm.coordsChar({ left: clientX, top: clientY }, 'window');
    var word = cm.findWordAt(pos);
    if (posEq(word.anchor, word.head)) return;
    cm.setSelection(word.anchor, word.head);
    cm.focus();
    positionHandles();
    suppressNextPointerUp = true;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_e) {} }
  }

  function attachLongPress(tries) {
    var cm = getCm();
    if (!cm) {
      tries = tries || 0;
      if (tries < ATTACH_MAX_TRIES) setTimeout(function () { attachLongPress(tries + 1); }, 300);
      return;
    }
    var wrapper = cm.getWrapperElement();
    if (wrapper.__dexLongPressBound) return;
    wrapper.__dexLongPressBound = true;

    wrapper.addEventListener('pointerdown', function (e) {
      if (!isTouchLike(e)) return;
      if (pressStart) { cancelPress(); return; }
      pressStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
      pressTimer = setTimeout(function () {
        firePress(pressStart.x, pressStart.y);
        pressTimer = null;
      }, LONG_PRESS_MS);
    }, { passive: true });

    wrapper.addEventListener('pointermove', function (e) {
      if (!pressStart || e.pointerId !== pressStart.id) return;
      var dx = e.clientX - pressStart.x, dy = e.clientY - pressStart.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPress();
    }, { passive: true });

    wrapper.addEventListener('pointerup', function (e) {
      if (!pressStart || e.pointerId !== pressStart.id) return;
      cancelPress();
      if (suppressNextPointerUp) {
        suppressNextPointerUp = false;
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false, capture: true });

    wrapper.addEventListener('pointercancel', function (e) {
      if (pressStart && e.pointerId === pressStart.id) cancelPress();
    }, { passive: true });
  }

  function attachCursorSync(tries) {
    var cm = getCm();
    if (!cm) {
      tries = tries || 0;
      if (tries < ATTACH_MAX_TRIES) setTimeout(function () { attachCursorSync(tries + 1); }, 300);
      return;
    }
    if (cm.__dexSelHandlesSynced) return;
    cm.__dexSelHandlesSynced = true;
    cm.on('cursorActivity', positionHandles);
    cm.on('scroll', positionHandles);
    window.addEventListener('resize', positionHandles);
  }

  function init() {
    attachLongPress();
    attachCursorSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
