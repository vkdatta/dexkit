(function () {
  'use strict';
  const TAG = 'dextools-import';
  const MAX_DEPTH = 32;
  const LOG = '[dextools]';

  function resolveURL(src) {
    try {
      return new URL(src.trim(), document.baseURI || location.href).href;
    } catch (_) {
      return src.trim();
    }
  }

  function applyData(html, el) {
    const ds = el.dataset;
    return html.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
      const camel = key.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (key in ds) return ds[key];
      if (camel in ds) return ds[camel];
      return match;
    });
  }

  function inject(anchor, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const frag = document.createDocumentFragment();
    for (const node of Array.from(tpl.content.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'SCRIPT') {
        const s = document.createElement('script');
        for (const { name, value } of node.attributes) s.setAttribute(name, value);
        s.textContent = node.textContent;
        frag.appendChild(s);
      } else {
        frag.appendChild(document.importNode(node, true));
      }
    }
    anchor.parentNode.insertBefore(frag, anchor);
    anchor.parentNode.removeChild(anchor);
  }

  function syncProcessOne(el) {
    const src = el.getAttribute('src');
    if (!src || !src.trim()) {
      console.warn(LOG, 'missing src — skipped.');
      el.remove();
      return;
    }

    const depth = parseInt(el.getAttribute('data-dxt-depth') || '0', 10);
    if (depth > MAX_DEPTH) {
      console.error(LOG, `Max depth (${MAX_DEPTH}) exceeded: ${src}`);
      el.remove();
      return;
    }

    const xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', resolveURL(src), false);
      xhr.send(null);
    } catch (e) {
      console.error(LOG, 'Network error:', src, e);
      el.remove();
      return;
    }

    if (xhr.status >= 200 && xhr.status < 300) {
      inject(el, applyData(xhr.responseText, el));
    } else {
      console.error(LOG, `HTTP ${xhr.status} fetching: ${src}`);
      el.remove();
    }
  }

  function syncPreload() {
    let batch;
    while ((batch = Array.from(document.querySelectorAll(TAG))).length > 0) {
      for (const el of batch) {
        syncProcessOne(el);
      }
    }
  }

  async function fetchAsync(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(LOG, `HTTP ${res.status} fetching: ${url}`);
        return null;
      }
      return await res.text();
    } catch (e) {
      console.error(LOG, 'Network error:', url, e);
      return null;
    }
  }

  class DextoolsImport extends HTMLElement {
    connectedCallback() {
      const src = this.getAttribute('src');
      if (!src || !src.trim()) {
        console.warn(LOG, 'missing src — skipped.');
        this.remove();
        return;
      }

      const depth = parseInt(this.getAttribute('data-dxt-depth') || '0', 10);
      if (depth > MAX_DEPTH) {
        console.error(LOG, `Max depth exceeded: ${src}`);
        this.remove();
        return;
      }

      (async () => {
        const html = await fetchAsync(resolveURL(src));
        if (html !== null) inject(this, applyData(html, this));
        else this.remove();
      })();
    }
  }

  syncPreload();
  if (!customElements.get(TAG)) {
    customElements.define(TAG, DextoolsImport);
  }
})();
