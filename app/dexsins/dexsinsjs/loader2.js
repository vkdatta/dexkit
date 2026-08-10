(function(){
  const css = `
.loading-container{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;pointer-events:none;width:100%;height:100%}
.loading-bars{display:inline-flex;gap:4px;align-items:center;height:17px;margin-bottom:3px}
.loading-bar{width:3px;background:#e0e0e0;border-radius:2px;animation:loading-pulse 1.2s infinite}
.loading-bar:nth-child(1){height:5px;animation-delay:-0.2s}
.loading-bar:nth-child(2){height:9px;animation-delay:-.1s}
.loading-bar:nth-child(3){height:5px;animation-delay:-0s}
@keyframes loading-pulse{0%,40%,100%{opacity:.3}20%{opacity:1}}
`;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
  const MIN_TIME = 400;

  // ---- exclusion API: dexsins.loader.exclude(...) ----
  let excludeAll = false;
  const excludedSelectors = [];

  function normalizeExcludeSelector(sel) {
    if (typeof sel !== 'string') return null;
    sel = sel.trim();
    if (!sel) return null;
    // already a valid CSS selector form: #id, .class, [attr=...], tag, etc.
    if (sel[0] === '#' || sel[0] === '.' || sel[0] === '[') return sel;
    // data-action style shorthand, with or without a value:
    //   data-action            -> [data-action]
    //   data-action=submit     -> [data-action="submit"]
    //   data-action="submit"   -> [data-action="submit"]
    if (/^data-[\w-]+/i.test(sel)) {
      const eqIndex = sel.indexOf('=');
      if (eqIndex === -1) return `[${sel}]`;
      const attr = sel.slice(0, eqIndex).trim();
      const val = sel.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      return `[${attr}="${val}"]`;
    }
    // fallback: pass through as-is (e.g. a raw tag or custom selector)
    return sel;
  }

  function isExcluded(el) {
    if (excludeAll) return true;
    if (!el || !excludedSelectors.length) return false;
    for (const sel of excludedSelectors) {
      try {
        if (el.closest && el.closest(sel)) return true;
      } catch (e) {
        // ignore invalid selector
      }
    }
    return false;
  }

  window.dexsins = window.dexsins || {};
  window.dexsins.loader = window.dexsins.loader || {};
  window.dexsins.loader.exclude = function (...selectors) {
    if (!selectors.length) {
      excludeAll = true;
      return;
    }
    selectors.forEach((sel) => {
      const normalized = normalizeExcludeSelector(sel);
      if (normalized) excludedSelectors.push(normalized);
    });
  };
  // ---- end exclusion API ----

  const wrappedHandlers = new WeakMap();
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, handler, options){
    if (type === 'click' && typeof handler === 'function') {
      const owner = this;
      const wrapped = function(evt){
        try{
          const result = handler.call(this, evt);
          if (owner instanceof Element && owner.matches && owner.matches('.post-body button')) {
            try{ owner._lastHandlerPromise = result instanceof Promise ? result : null }catch(e){}
          }
          return result;
        }catch(e){ throw e }
      };
      wrappedHandlers.set(handler, wrapped);
      return origAddEventListener.call(this, type, wrapped, options);
    }
    return origAddEventListener.call(this, type, handler, options);
  };
  const origRemoveEventListener = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.removeEventListener = function(type, handler, options){
    if (type === 'click' && wrappedHandlers.has(handler)) {
      const wrapped = wrappedHandlers.get(handler);
      wrappedHandlers.delete(handler);
      return origRemoveEventListener.call(this, type, wrapped, options);
    }
    return origRemoveEventListener.call(this, type, handler, options);
  };
  function wrapInlineOnclick(el){
    if (!el || !el.onclick || typeof el.onclick !== 'function') return;
    const original = el.onclick;
    if (original._wrappedByLoader) return;
    const wrapped = function(evt){
      const result = original.call(this, evt);
      try{ el._lastHandlerPromise = result instanceof Promise ? result : null }catch(e){}
      return result;
    };
    wrapped._wrappedByLoader = true;
    el.onclick = wrapped;
  }
  document.querySelectorAll && document.querySelectorAll('.post-body button').forEach(wrapInlineOnclick);
  const observer = new MutationObserver(function(muts){
    for (const m of muts){
      for (const node of m.addedNodes){
        if (node.nodeType === 1){
          if (node.matches && node.matches('.post-body button')) wrapInlineOnclick(node);
          node.querySelectorAll && node.querySelectorAll('.post-body button').forEach(wrapInlineOnclick);
        }
      }
      if (m.type === 'attributes' && m.target && m.target.matches && m.target.matches('.post-body button') && m.attributeName === 'onclick') {
        wrapInlineOnclick(m.target);
      }
    }
  });
  observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['onclick']});
  function setupLoadingState(button) {
    if (button.dataset.loading === 'true') return false;
    button.dataset.loading = 'true';
    button.setAttribute('aria-busy','true');
    const originalHTML = button.innerHTML;
    const originalBg = button.style.background || '';
    const originalPosition = button.style.position || '';
    const originalWidth = button.style.width || '';
    const originalHeight = button.style.height || '';
    const originalBoxSizing = button.style.boxSizing || '';
    const rect = button.getBoundingClientRect();
    button.style.width = rect.width + 'px';
    button.style.height = rect.height + 'px';
    button.style.boxSizing = 'border-box';
    const computedPos = window.getComputedStyle(button).position;
    let setPosition = false;
    if (computedPos === 'static') {
      button.style.position = 'relative';
      setPosition = true;
    }
    button.style.background = '#000';
    button.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'loading-container';
    loader.style.opacity = '1';
    loader.innerHTML = '<div class="loading-bars"><div class="loading-bar"></div><div class="loading-bar"></div><div class="loading-bar"></div></div>';
    button.appendChild(loader);
    return {
      loader,
      originalHTML,
      originalBg,
      originalPosition,
      originalWidth,
      originalHeight,
      originalBoxSizing,
      setPosition
    };
  }
  function cleanupLoadingState(button, state) {
    if (state.loader && state.loader.parentNode) {
      state.loader.parentNode.removeChild(state.loader);
    }
    button.innerHTML = state.originalHTML;
    button.style.background = state.originalBg;
    if (state.setPosition) {
      button.style.position = state.originalPosition;
    }
    if (state.originalWidth) {
      button.style.width = state.originalWidth;
    } else {
      button.style.removeProperty('width');
    }
    if (state.originalHeight) {
      button.style.height = state.originalHeight;
    } else {
      button.style.removeProperty('height');
    }
    if (state.originalBoxSizing) {
      button.style.boxSizing = state.originalBoxSizing;
    } else {
      button.style.removeProperty('box-sizing');
    }
    button.removeAttribute('aria-busy');
    delete button.dataset.loading;
    try {
      delete button._lastHandlerPromise;
    } catch(e) {}
  }
  function startLoading(button, options = {}) {
    const {
      startTime = performance.now(),
      promise = null,
      delay = 0,
      maxTime = 0,
      elapsedSync = 0
    } = options;
    if (button.dataset.loading === 'true') return null;
    if (isExcluded(button)) return null;
    const state = setupLoadingState(button);
    if (!state) return null;
    let forcedTimeoutId = null;
    if (maxTime > 0) {
      forcedTimeoutId = setTimeout(() => {
        const ev = new CustomEvent('loading-timeout', { detail: { maxTime } });
        button.dispatchEvent(ev);
        finishCleanup();
      }, maxTime);
    }
    let finished = false;
    const onHandlerDone = () => {
      if (finished) return;
      finished = true;
      const elapsed = Math.max(0, performance.now() - startTime);
      const required = Math.max(MIN_TIME, elapsedSync, delay);
      const remaining = Math.max(0, required - elapsed);
      setTimeout(finishCleanup, remaining);
    };
    const finishCleanup = () => {
      if (forcedTimeoutId) {
        clearTimeout(forcedTimeoutId);
        forcedTimeoutId = null;
      }
      cleanupLoadingState(button, state);
    };
    if (promise) {
      promise.then(onHandlerDone, onHandlerDone);
    } else if (delay > 0) {
      setTimeout(onHandlerDone, delay);
    } else {
      onHandlerDone();
    }
    return finishCleanup;
  }
  document.addEventListener('click', function(evt){
    const btn = evt.target.closest && evt.target.closest('.post-body button');
    if (!btn) return;
    if (btn.dataset.loading === 'true') return;
    if (isExcluded(btn)) return;
    const start = performance.now();
    let captureDone = false;
    const onAfterSync = function(){
      if (captureDone) return;
      captureDone = true;
      const elapsedSync = Math.max(0, performance.now() - start);
      const dataDelay = Number(btn.dataset.delay) || 0;
      const dataMax = Number(btn.dataset.maxTime) || 0;
      const promiseFromHandler = (() => {
        try {
          return btn._lastHandlerPromise instanceof Promise ? btn._lastHandlerPromise : null;
        } catch(e) {
          return null;
        }
      })();
      startLoading(btn, {
        startTime: start,
        promise: promiseFromHandler,
        delay: dataDelay,
        maxTime: dataMax,
        elapsedSync: elapsedSync
      });
    };
    setTimeout(onAfterSync, 0);
  }, true);
  window.startLoadingWithPromise = function(button, promise, maxTimeMs) {
    if (!button || typeof promise?.then !== 'function') return;
    startLoading(button, {
      promise,
      maxTime: Number(maxTimeMs) || 0
    });
  };
  window.finishLoading = function(button){
    if (!button) return;
    const ev = new CustomEvent('force-finish-loading');
    button.dispatchEvent(ev);
    try {
      delete button._lastHandlerPromise;
    } catch(e) {}
  };
})();
