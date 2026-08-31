(() => {
  const TRIGGER_PHRASE = 'darklord...';
  const WORKER_URL = "https://voldemort.klines.workers.dev";
  let isActive = false, isProcessing = false;
  const textarea = document.getElementById('noteTextarea');
  const toggleBtn = document.getElementById('voldemortToggle');
  const loadingOverlay = document.getElementById('loadingOverlay');
  let firstNotificationShown = false;

  function cmEl() { return document.querySelector('.CodeMirror'); }
  function cmInst() { return window.dexEditor && window.dexEditor.cm; }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const wasActive = isActive;
      isActive = !isActive;
      toggleBtn.classList.toggle('active', isActive);
      if (textarea) textarea.placeholder = isActive ? "The diary is open..." : "Type here...";
      const cm = cmInst();
      if (cm) try { cm.setOption('placeholder', isActive ? "The diary is open..." : ""); } catch (e) {}
      if (!wasActive && isActive) {
        showNotification("Welcome to Tom Riddle's Diary");
        firstNotificationShown = true;
        setTimeout(() => { if (isActive && firstNotificationShown) { showNotification("Summon him by whispering 'darklord...'"); firstNotificationShown = false; } }, 5000);
      }
      if (wasActive && !isActive) firstNotificationShown = false;
    });
  }

  textarea?.addEventListener('input', async () => {
    if (!isActive || isProcessing) return;
    const content = (window.dexEditor ? window.dexEditor.getValue() : textarea.value) || '';
    if (!content.toLowerCase().endsWith(TRIGGER_PHRASE)) return;

    isProcessing = true;
    const query = content.slice(0, -TRIGGER_PHRASE.length).trim();
    const el = cmEl();
    const cm = cmInst();

    if (cm) try { cm.setOption('readOnly', 'nocursor'); } catch (e) {}
    if (el) { el.classList.remove('ink-appear'); el.classList.add('ink-vanish'); }
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    let data;
    try {
      const [resp] = await Promise.all([
        fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: query }] })
        }).then(r => r.json()),
        new Promise(r => setTimeout(r, 2100))
      ]);
      data = resp;
    } catch (err) {
      data = { response: 'The Dark Magic failed.' };
    }

    if (loadingOverlay) loadingOverlay.style.display = 'none';
    const answer = (data && data.response) || 'The diary is empty.';

    if (window.dexEditor) window.dexEditor.setValue(answer);
    else textarea.value = answer;

    if (el) { el.classList.remove('ink-vanish'); void el.offsetWidth; el.classList.add('ink-appear'); }
    await new Promise(r => setTimeout(r, 2100));
    if (el) el.classList.remove('ink-appear');

    if (cm) {
      try { cm.setOption('readOnly', false); } catch (e) {}
      cm.focus();
      cm.setCursor(cm.lineCount(), 0);
    }
    isProcessing = false;
  });
})();
