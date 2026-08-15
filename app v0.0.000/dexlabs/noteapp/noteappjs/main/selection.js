(function () {
  if (window.__dexSelHandlesLoaded) return;
  window.__dexSelHandlesLoaded = true;

  var LONG_PRESS_MS = 450;
  var MOVE_CANCEL_PX = 10;

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
      el.addEventListener('touchstart', function (e) {
        e.preventDefault(); e.stopPropagation();
        beginHandleDrag(which);
      }, { passive: false });
    });

    document.addEventListener('touchmove', onHandleDragMove, { passive: false });
    document.addEventListener('touchend', endHandleDrag, { passive: false });
    document.addEventListener('touchcancel', endHandleDrag, { passive: false });
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

  var dragging = null;   
  var dragFixedPoint = null;

  function beginHandleDrag(which) {
    var cm = getCm();
    if (!cm || !cm.somethingSelected()) return;
    dragging = which;
    dragFixedPoint = (which === 'from') ? cm.getCursor('to') : cm.getCursor('from');
  }

  function onHandleDragMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var t = e.touches[0];
    if (!t) return;
    var cm = getCm();
    if (!cm) return;
    var pos = cm.coordsChar({ left: t.clientX, top: t.clientY - 32 }, 'window');
    cm.setSelection(dragFixedPoint, pos);
    positionHandles();
  }

  function endHandleDrag() {
    if (!dragging) return;
    dragging = null;
    dragFixedPoint = null;
  }

  var pressTimer = null;
  var pressStart = null;   
  var suppressNextTouchEnd = false;

  function cancelPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
  }

  function findTouch(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }

  function firePress(clientX, clientY) {
    var cm = getCm();
    if (!cm) return;
    var pos = cm.coordsChar({ left: clientX, top: clientY }, 'window');
    var word = cm.findWordAt(pos);
    cm.setSelection(word.anchor, word.head);
    cm.focus();
    positionHandles();
    suppressNextTouchEnd = true;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_e) {} }
  }

  function attachLongPress() {
    var cm = getCm();
    if (!cm) { setTimeout(attachLongPress, 300); return; }
    var wrapper = cm.getWrapperElement();
    if (wrapper.__dexLongPressBound) return;
    wrapper.__dexLongPressBound = true;

    wrapper.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { cancelPress(); return; }
      var t = e.touches[0];
      pressStart = { x: t.clientX, y: t.clientY, id: t.identifier };
      pressTimer = setTimeout(function () {
        firePress(pressStart.x, pressStart.y);
        pressTimer = null;
      }, LONG_PRESS_MS);
    }, { passive: true });

    wrapper.addEventListener('touchmove', function (e) {
      if (!pressStart) return;
      var t = findTouch(e.touches, pressStart.id);
      if (!t) return;
      var dx = t.clientX - pressStart.x, dy = t.clientY - pressStart.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPress();
    }, { passive: true });

    wrapper.addEventListener('touchend', function (e) {
      cancelPress();
      if (suppressNextTouchEnd) {
        suppressNextTouchEnd = false;
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false, capture: true });

    wrapper.addEventListener('touchcancel', cancelPress, { passive: true });
  }

  function attachCursorSync() {
    var cm = getCm();
    if (!cm) { setTimeout(attachCursorSync, 300); return; }
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
