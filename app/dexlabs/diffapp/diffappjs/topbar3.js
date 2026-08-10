// Legacy diff-app topbar handler. Bottom-bar wiring now lives in mode.js;
// this shim keeps a global `diffNavigate` around only so any inline handlers
// that survived from the old markup don't throw.
function diffNavigate(viewId, btnElement) {
  if (viewId === 'diffRawView' || viewId === 'diffMorphView') {
    const pane = viewId === 'diffRawView' ? 'raw' : 'morph';
    if (typeof window.switchDiffusionPane === 'function') window.switchDiffusionPane(pane);
    return;
  }
  // For diff1/diff2/options: delegate to the bottom bar click flow.
  const btn = document.querySelector('#diffBottombar .diff-topbar-button[data-target="' + viewId + '"]');
  if (btn) btn.click();
}
