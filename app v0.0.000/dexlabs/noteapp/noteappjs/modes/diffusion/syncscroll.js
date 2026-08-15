  const diffScrollTargets = [diffElements.raw, diffElements.morph, diffElements.scrollD1, diffElements.scrollD2];
  let diffIsSyncing = false;
  let diffGlobalScrollTop = 0;
  let diffGlobalScrollLeft = 0;

  diffScrollTargets.forEach(target => {
    target.addEventListener('scroll', (e) => {
      if (e.target === diffElements.raw) diffElements.gRaw.scrollTop = diffElements.raw.scrollTop;
      if (e.target === diffElements.morph) diffElements.gMorph.scrollTop = diffElements.morph.scrollTop;

      if (!diffElements.optSync.checked || diffIsSyncing) return;
      diffIsSyncing = true;
      
      diffGlobalScrollTop = e.target.scrollTop;
      diffGlobalScrollLeft = e.target.scrollLeft;

      diffScrollTargets.forEach(t => {
        if (t !== e.target && t.offsetParent !== null) {
          t.scrollTop = diffGlobalScrollTop;
          t.scrollLeft = diffGlobalScrollLeft;
        }
      });

      requestAnimationFrame(() => { diffIsSyncing = false; });
    });
  });
