/*
Heart by vkd
Read https://dexsins.blogspot.com/p/heart-by-vkd.html for usage
*/
(function() {
  'use strict';
  function injectStyles() {
    if (document.getElementById('heart-by-vkd-styles')) return;
    const style = document.createElement('style');
    style.id = 'heart-by-vkd-styles';
    style.textContent = `
      @keyframes heart-blink-vkd {
        from { color: transparent; }
        to   { color: var(--vkd-heart-color, #8B78FF); }
      }
      .heart-by-vkd {
        display: inline-block;
        animation-name: heart-blink-vkd;
        animation-duration: var(--vkd-heart-speed, 0.8333s);
        animation-iteration-count: infinite;
        animation-timing-function: ease-in-out;
        font-family: inherit;
        line-height: 1;
        vertical-align: middle;
      }
      .heart-by-vkd-block {
        display: block;
        width: 100%;
      }
      .heart-by-vkd-align-left   { text-align: left; }
      .heart-by-vkd-align-center { text-align: center; }
      .heart-by-vkd-align-right  { text-align: right; }
    `;
    document.head.appendChild(style);
  }
  function createHeartElement(color, speed, size) {
    const span = document.createElement('span');
    span.className = 'heart-by-vkd';
    span.textContent = '\u2764';
    if (color) span.style.setProperty('--vkd-heart-color', color);
    if (speed) span.style.setProperty('--vkd-heart-speed', speed + 's');
    if (size) span.style.fontSize = size + 'px';
    return span;
  }
  function processElement(el) {
    const color = el.getAttribute('data-heart-color') || '#8B78FF';
    const speed = parseFloat(el.getAttribute('data-speed')) || 0.8333;
    const size  = el.getAttribute('data-size');
    const align = el.getAttribute('data-align') || 'center';
    const isBlock = el.tagName.toLowerCase() === 'div';
    el.innerHTML = '';
    const heart = createHeartElement(color, speed, size);
    if (isBlock) {
      el.className = (el.className + ' heart-by-vkd-block heart-by-vkd-align-' + align).trim();
      el.appendChild(heart);
    } else {
      el.appendChild(heart);
    }
    el.setAttribute('data-heart-processed', 'true');
  }
  function init() {
    injectStyles();
    const targets = document.querySelectorAll('[data-import="heart_by_vkd"]:not([data-heart-processed])');
    targets.forEach(processElement);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  const observer = new MutationObserver(function(mutations) {
    let shouldRescan = false;
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('[data-import="heart_by_vkd"]:not([data-heart-processed])')) {
            processElement(node);
          }
          if (node.querySelectorAll) {
            const children = node.querySelectorAll('[data-import="heart_by_vkd"]:not([data-heart-processed])');
            children.forEach(processElement);
          }
        }
      });
    });
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
