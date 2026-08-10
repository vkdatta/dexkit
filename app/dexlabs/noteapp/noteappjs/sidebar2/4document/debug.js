export function createDebugTool() {
  if (window.debuginitialized) return null;
  window.debuginitialized = true;
  const state = {
    MAX_AGE_MS: 30 * 60 * 1000,
    PRUNE_INTERVAL_MS: 60 * 1000,
    logs: [],
    networkLogs: [],
    originalConsole: {},
    initializedAt: Date.now(),
    activeTab: 'console'
  };

  const style = document.createElement('style');
  style.id = 'debug-overlay-styles';
  style.textContent = `
    #debugoverlay { position:fixed; top:0; left:0; right:0; height:100dvh; background:rgba(0,0,0,0.96); color:#e0e0e0; z-index:99999; display:flex; flex-direction:column; font-family: source code pro; -webkit-font-smoothing:antialiased; box-sizing:border-box; }
    #debugheader { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #222; background:#050505; font-size:13px; }
    #debugtitle { font-weight:600; font-size:13px; color:#fff; }
    #debugtoolbar { display:flex; gap:10px; align-items:center; }
    #debugclose { background:none; border:1px solid #444; color:#fff; padding:6px 10px; cursor:pointer; font-size:13px; }
    #debugtabs { display:flex; gap:6px; padding:8px 14px; border-bottom:1px solid #222; background:#080808; }
    .debugtab { background:none; border:1px solid #444; color:#999; padding:5px 12px; cursor:pointer; font-size:12px; border-radius:3px; }
    .debugtab.active { color:#fff; border-color:#8ab4f8; background:rgba(138,180,248,0.1); }
    #debugconsole, #debugnetwork { flex:1; overflow:auto; padding:10px; font-size:12px; line-height:1.45; word-break:break-word; }
    .debugentry { padding:4px 0; white-space:pre-wrap; }
    .debugtime { color:#777; margin-right:8px; }
    .debuglog { color:#8ab4f8; }
    .debuginfo { color:#A1F39E; }
    .debugwarn { color:#fbbc04; }
    .debugerror { color:#f28b82; }
    .netentry { display:flex; flex-wrap:wrap; column-gap:8px; row-gap:2px; padding:6px 0; border-bottom:1px solid #151515; align-items:center; font-size:11.5px; }
    .netmethod { color:#c58af9; flex-shrink:0; order:1; }
    .netstatus { flex-shrink:0; order:2; }
    .netstatus.ok { color:#A1F39E; }
    .netstatus.bad { color:#f28b82; }
    .netstatus.na { color:#666; }
    .nettype { color:#fbbc04; flex-shrink:0; order:3; }
    .neturl { order:5; flex:1 1 100%; width:100%; color:#e0e0e0; overflow-wrap:anywhere; margin-top:2px; }
    .netmeta { color:#777; flex-shrink:0; order:4; white-space:nowrap; margin-left:auto; }
    #debugfooter { padding:8px 12px; border-top:1px solid #222; background:linear-gradient(180deg, rgba(0,0,0,0.02), transparent); font-size:12px; color:#999; display:flex; justify-content:space-between; align-items:center; }
    #debugactions button { background:none; border:1px solid #444; color:#fff; padding:4px 8px; cursor:pointer; font-size:12px; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'debugoverlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div id="debugheader" role="region" aria-label="Developer console header">
      <div id="debugtitle">Developer Console (read-only)</div>
      <div id="debugtoolbar">
        <div id="debugmeta" style="color:#999;font-size:12px">logs: 0 · net: 0</div>
        <button id="debugclose" title="Close debugger">Close</button>
      </div>
    </div>
    <div id="debugtabs">
      <button class="debugtab active" id="tabconsole">Console</button>
      <button class="debugtab" id="tabnetwork">Network</button>
    </div>
    <div id="debugconsole" role="log" aria-live="polite" aria-relevant="additions"></div>
    <div id="debugnetwork" role="log" aria-live="polite" aria-relevant="additions" style="display:none"></div>
    <div id="debugfooter">
      <div id="debugretention">Retention: 30 minutes (rolling)</div>
      <div id="debugactions">
        <button id="debugclear">Clear</button>
        <button id="debugexport">Export</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const panel = document.getElementById('debugconsole');
  const netPanel = document.getElementById('debugnetwork');
  const closeBtn = document.getElementById('debugclose');
  const clearBtn = document.getElementById('debugclear');
  const exportBtn = document.getElementById('debugexport');
  const metaSpan = document.getElementById('debugmeta');
  const tabConsole = document.getElementById('tabconsole');
  const tabNetwork = document.getElementById('tabnetwork');

  function safeStringify(obj) {
    const seen = new WeakSet();
    try {
      return JSON.stringify(obj, function (k, v) {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        if (typeof v === 'bigint') return String(v) + 'n';
        return v;
      }, 2);
    } catch (e) { return String(obj); }
  }

  // ---- console logs ----
  function pruneLogs() {
    const cutoff = Date.now() - state.MAX_AGE_MS;
    let changed = false;
    while (state.logs.length && state.logs[0].time < cutoff) { state.logs.shift(); changed = true; }
    if (changed) renderConsole();
  }
  function renderConsole() {
    panel.innerHTML = '';
    for (const entry of state.logs) appendEntryToPanel(entry, false);
    updateMeta();
    panel.scrollTop = panel.scrollHeight;
  }
  function appendEntryToPanel(entry, scroll = true) {
    const line = document.createElement('div');
    line.className = 'debugentry ' + (entry.type === 'log' ? 'debuglog' : 'debug' + entry.type);
    const time = document.createElement('span');
    time.className = 'debugtime';
    time.textContent = new Date(entry.time).toLocaleTimeString();
    const content = document.createElement('span');
    content.textContent = entry.message;
    line.appendChild(time);
    line.appendChild(content);
    panel.appendChild(line);
    if (scroll) panel.scrollTop = panel.scrollHeight;
  }
  function record(type, args) {
    const messageParts = args.map(v => {
      if (v instanceof Error) {
        let str = (v.name || 'Error') + (v.message ? ': ' + v.message : '');
        if (v.stack) str += '\n' + v.stack.trim();
        return str;
      } else if (typeof v === 'object' && v !== null) {
        return safeStringify(v);
      } else if (v === undefined) {
        return 'undefined';
      } else {
        return String(v);
      }
    });
    const message = messageParts.join(' ');
    const entry = { type: (type === 'debug' ? 'log' : type), message, time: Date.now() };
    state.logs.push(entry);
    pruneLogs();
    if (overlay.style.display !== 'none' && state.activeTab === 'console') appendEntryToPanel(entry);
    updateMeta();
  }

  // ---- network logs ----
  function pruneNetworkLogs() {
    const cutoff = Date.now() - state.MAX_AGE_MS;
    let changed = false;
    while (state.networkLogs.length && state.networkLogs[0].time < cutoff) { state.networkLogs.shift(); changed = true; }
    if (changed) renderNetwork();
  }
  function formatBytes(n) {
    if (!n || n <= 0) return '—';
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
    return (n / (1024 * 1024)).toFixed(1) + 'MB';
  }
  function renderNetwork() {
    netPanel.innerHTML = '';
    for (const entry of state.networkLogs) appendNetEntryToPanel(entry, false);
    updateMeta();
    netPanel.scrollTop = netPanel.scrollHeight;
  }
  function appendNetEntryToPanel(entry, scroll = true) {
    const line = document.createElement('div');
    line.className = 'netentry';
    const statusClass = entry.status === '—' ? 'na' : (entry.status >= 400 ? 'bad' : 'ok');
    line.innerHTML = `
      <span class="debugtime">${new Date(entry.time).toLocaleTimeString()}</span>
      <span class="netmethod">${entry.method}</span>
      <span class="netstatus ${statusClass}">${entry.status}</span>
      <span class="nettype">${entry.initiatorType}</span>
      <span class="netmeta">${Math.round(entry.duration)}ms · ${formatBytes(entry.transferSize)}</span>
      <span class="neturl">${entry.url}</span>
    `;
    netPanel.appendChild(line);
    if (scroll) netPanel.scrollTop = netPanel.scrollHeight;
  }
  function recordNetwork(data) {
    const entry = {
      method: data.method || 'GET',
      status: data.status != null ? data.status : '—',
      initiatorType: data.initiatorType || 'other',
      url: data.url,
      duration: data.duration || 0,
      transferSize: data.transferSize || 0,
      time: Date.now()
    };
    state.networkLogs.push(entry);
    pruneNetworkLogs();
    if (overlay.style.display !== 'none' && state.activeTab === 'network') appendNetEntryToPanel(entry);
    updateMeta();
  }
  function updateMeta() {
    metaSpan.textContent = 'logs: ' + state.logs.length + ' · net: ' + state.networkLogs.length;
  }

  // Capture ALL resource loads (favicon, img, script, css, fetch, xhr, etc.)
  try {
    const perfObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        // fetch and XHR are captured explicitly by the patches below, which
        // report accurate method + status. Skip them here to avoid double-logging.
        if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') continue;
        recordNetwork({
          method: 'GET',
          status: typeof e.responseStatus === 'number' && e.responseStatus > 0 ? e.responseStatus : '—',
          initiatorType: e.initiatorType || 'other',
          url: e.name,
          duration: e.duration,
          transferSize: e.transferSize
        });
      }
    });
    perfObserver.observe({ type: 'resource', buffered: true });
  } catch (e) {}

  // Patch fetch/XHR to capture accurate method + status for API calls
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = (init && init.method) || (input && input.method) || 'GET';
      const start = performance.now();
      return origFetch.apply(this, arguments).then((res) => {
        recordNetwork({ method, status: res.status, initiatorType: 'fetch', url, duration: performance.now() - start, transferSize: 0 });
        return res;
      }).catch((err) => {
        recordNetwork({ method, status: 'ERR', initiatorType: 'fetch', url, duration: performance.now() - start, transferSize: 0 });
        throw err;
      });
    };
  }
  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    window.XMLHttpRequest = function () {
      const xhr = new OrigXHR();
      let method = 'GET', url = '', start = 0;
      const origOpen = xhr.open;
      xhr.open = function (m, u) { method = m; url = u; return origOpen.apply(xhr, arguments); };
      xhr.addEventListener('loadend', function () {
        recordNetwork({ method, status: xhr.status, initiatorType: 'xmlhttprequest', url, duration: performance.now() - start, transferSize: 0 });
      });
      const origSend = xhr.send;
      xhr.send = function () { start = performance.now(); return origSend.apply(xhr, arguments); };
      return xhr;
    };
  }

  const onErrorHandler = function (ev) {
    try {
      const errorObj = ev.error || null;
      const msg = ev.message || 'Script error';
      const pos = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '';
      record('error', [errorObj || msg, pos].filter(Boolean));
    } catch (e) {}
  };
  const onRejection = function (ev) {
    try {
      const reason = ev.reason !== undefined ? ev.reason : 'No reason';
      record('error', ['Unhandled Promise Rejection:', reason]);
    } catch (e) {}
  };
  window.addEventListener('error', onErrorHandler);
  window.addEventListener('unhandledrejection', onRejection);

  // Resource load failures (link/img/script/etc.) fire an `error` event on the
  // element itself and do NOT bubble to window, so the handler above misses them.
  // Listening in the capture phase (third arg = true) is the only way to catch them.
  const onResourceError = function (ev) {
    try {
      const el = ev.target;
      if (!el || el === window || !el.tagName) return; // JS errors handled elsewhere
      const tag = el.tagName.toUpperCase();
      const resourceTags = { LINK: 'href', IMG: 'src', SCRIPT: 'src', SOURCE: 'src', AUDIO: 'src', VIDEO: 'src', TRACK: 'src' };
      const attr = resourceTags[tag];
      if (!attr) return;
      const url = el[attr] || el.getAttribute(attr) || '(unknown)';
      record('error', ['Resource failed to load <' + tag.toLowerCase() + '>:', url]);
      recordNetwork({ method: 'GET', status: 'ERR', initiatorType: tag.toLowerCase(), url, duration: 0, transferSize: 0 });
    } catch (e) {}
  };
  window.addEventListener('error', onResourceError, true);

  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  for (const m of methods) {
    state.originalConsole[m] = console[m].bind(console);
    console[m] = function (...args) {
      try { state.originalConsole[m](...args); } catch (e) {}
      try { record(m, args); } catch (e) {}
    };
  }

  function setTab(tab) {
    state.activeTab = tab;
    tabConsole.classList.toggle('active', tab === 'console');
    tabNetwork.classList.toggle('active', tab === 'network');
    panel.style.display = tab === 'console' ? 'block' : 'none';
    netPanel.style.display = tab === 'network' ? 'block' : 'none';
    if (tab === 'console') renderConsole(); else renderNetwork();
  }
  tabConsole.addEventListener('click', () => setTab('console'));
  tabNetwork.addEventListener('click', () => setTab('network'));

  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  clearBtn.addEventListener('click', () => {
    if (state.activeTab === 'console') { state.logs.length = 0; renderConsole(); }
    else { state.networkLogs.length = 0; renderNetwork(); }
  });
  exportBtn.addEventListener('click', () => {
    try {
      const payload = { logs: state.logs, networkLogs: state.networkLogs };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debug-logs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { record('error', ['Export failed:', e]); }
  });

  const pruneIntervalId = setInterval(() => { pruneLogs(); pruneNetworkLogs(); }, state.PRUNE_INTERVAL_MS);

  return function debug() {
    try { pruneLogs(); pruneNetworkLogs(); } catch (e) {}
    overlay.style.display = 'flex';
    setTab(state.activeTab);
    return {
      hide: function () { overlay.style.display = 'none'; },
      show: function () { overlay.style.display = 'flex'; setTab(state.activeTab); },
      clear: function () { state.logs.length = 0; state.networkLogs.length = 0; renderConsole(); renderNetwork(); },
      export: function () { document.getElementById('debugexport').click(); },
      getLogs: function () { return state.logs.slice(); },
      getNetworkLogs: function () { return state.networkLogs.slice(); },
      showTab: setTab
    };
  };
}
