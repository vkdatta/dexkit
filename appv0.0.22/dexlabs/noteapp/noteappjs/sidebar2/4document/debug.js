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

  try {
    const perfObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
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

  const onResourceError = function (ev) {
    try {
      const el = ev.target;
      if (!el || el === window || !el.tagName) return; 
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