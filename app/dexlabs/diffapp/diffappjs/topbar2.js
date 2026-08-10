  function diffNavigate(viewId, btnElement) {
    // Re-clicking an already-active Raw/Morph button opens the sidebar to bind a note.
    if ((viewId === 'diffRawView' || viewId === 'diffMorphView') &&
        btnElement && btnElement.classList.contains('active') &&
        typeof window.diffOpenNotePicker === 'function') {
      window.diffOpenNotePicker(viewId === 'diffRawView' ? 'raw' : 'morph');
      return;
    }

    document.querySelectorAll('.diff-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.diff-topbar-button').forEach(b => b.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (btnElement) btnElement.classList.add('active');
    diffHideOverlay();

    if (diffElements.optSync.checked) {
      requestAnimationFrame(() => {
        const activeView = document.getElementById(viewId);
        const target = activeView.querySelector('.diff-editor, .diff-lines-container');
        if (target) {
          diffIsSyncing = true;
          target.scrollTop = diffGlobalScrollTop;
          target.scrollLeft = diffGlobalScrollLeft;
          requestAnimationFrame(() => { diffIsSyncing = false; });
        }
      });
    }
  }
