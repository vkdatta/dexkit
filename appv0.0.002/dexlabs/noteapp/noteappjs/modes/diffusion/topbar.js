function diffNavigate(viewId, btnElement) {
  if (viewId === 'diffRawView' || viewId === 'diffMorphView') {
    const pane = viewId === 'diffRawView' ? 'raw' : 'morph';
    if (typeof window.switchDiffusionPane === 'function') window.switchDiffusionPane(pane);
    return;
  }
  const btn = document.querySelector('#diffBottombar .diff-topbar-button[data-target="' + viewId + '"]');
  if (btn) btn.click();
}
