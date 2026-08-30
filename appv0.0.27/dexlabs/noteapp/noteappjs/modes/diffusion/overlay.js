document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('#diffDiff1View') ||
        e.target.closest('#diffDiff2View')) {
      e.preventDefault();
    }
  });
});
