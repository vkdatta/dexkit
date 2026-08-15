/* Category card builder — MULTI-INSTANCE version.
 *
 * The original build only ever handled ONE card: it read a single #products,
 * dumped it into the FIRST .category-scroll on the page, then deleted #products.
 * With two cards (home + sidebar) they fought over that single target, so whichever
 * .category-scroll came first in the DOM won and the other was left empty.
 *
 * This version builds EVERY .category-scroll independently. Each scroll names its
 * own data source with a data-source="#id" attribute, e.g.
 *     <div class="category-scroll" data-source="#products"></div>     (home)
 *     <div class="category-scroll" data-source="#s-products"></div>   (sidebar)
 * A scroll with no data-source falls back to #products for backward compatibility.
 */
(function () {
  var root = document.documentElement;
  var baseLeft = parseInt(getComputedStyle(root).getPropertyValue('--base-left')) || 12;
  var indentUnit = parseInt(getComputedStyle(root).getPropertyValue('--indent-unit')) || 28;

  function getTransitionMs() {
    var val = getComputedStyle(root).getPropertyValue('--transition-speed').trim();
    return Math.round((parseFloat(val) || 0.15) * 1000);
  }

  function collapse(elem, done) {
    elem.style.overflow = 'hidden';
    elem.style.height = elem.scrollHeight + 'px';
    elem.getBoundingClientRect();
    requestAnimationFrame(function () { elem.style.height = '0'; });
    setTimeout(function () {
      elem.style.height = '';
      elem.setAttribute('aria-hidden', 'true');
      elem.style.overflow = 'hidden';
      if (done) done();
    }, getTransitionMs() + 20);
  }

  function expand(elem, done) {
    elem.style.height = '0';
    elem.setAttribute('aria-hidden', 'false');
    elem.getBoundingClientRect();
    var target = elem.scrollHeight + 'px';
    requestAnimationFrame(function () { elem.style.height = target; });
    setTimeout(function () {
      elem.style.height = 'auto';
      elem.style.overflow = 'auto';
      if (done) done();
    }, getTransitionMs() + 20);
  }

  /* Carry the click behaviour from the data node to the rendered node.
   * Supports both onclick="location.href=..." (navigation) and
   * data-action="share|debug" (handled by the template's delegated listener). */
  function carryActions(target, dataDiv) {
    var onclickAttr = dataDiv.getAttribute('onclick');
    var actionAttr = dataDiv.getAttribute('data-action');
    if (onclickAttr) target.setAttribute('onclick', onclickAttr);
    if (actionAttr) target.setAttribute('data-action', actionAttr);
    if (onclickAttr || actionAttr) target.style.cursor = 'pointer';
  }

  function makeLabel(icon, text) {
    var left = document.createElement('span');
    left.className = 'left';
    var i = document.createElement('span');
    i.className = 'material-symbols-rounded';
    i.textContent = icon;
    var l = document.createElement('span');
    l.className = 'label';
    l.textContent = text;
    left.append(i, l);
    return left;
  }

  function buildTopLevel(container, dataContainer, depth) {
    var totalLeft = baseLeft + depth * indentUnit;
    Array.prototype.forEach.call(dataContainer.children, function (dataDiv) {
      var isCollapse = dataDiv.classList.contains('collapse');
      var text = dataDiv.getAttribute('text') || '';
      var icon = dataDiv.getAttribute('icon') || '';
      var vlineLeft = (totalLeft + 7) + 'px';

      var group = document.createElement('div');
      group.className = 'category-group' + (isCollapse && dataDiv.classList.contains('open') ? ' open' : '');
      if (isCollapse) group.classList.add('has-line');

      var header = document.createElement(isCollapse ? 'button' : 'div');
      header.type = 'button';
      header.className = 'category-header';
      header.style.paddingLeft = totalLeft + 'px';
      header.append(makeLabel(icon, text));

      if (isCollapse) {
        group.style.setProperty('--vline-left', vlineLeft);
        var ch = document.createElement('span');
        ch.className = 'material-symbols-rounded chevron';
        ch.textContent = 'expand_more';
        header.append(ch);
        header.onclick = function () { toggleGroup(header); };
        header.setAttribute('aria-expanded', dataDiv.classList.contains('open') ? 'true' : 'false');
        var content = document.createElement('div');
        content.className = 'category-content';
        content.setAttribute('aria-hidden', dataDiv.classList.contains('open') ? 'false' : 'true');
        group.append(header, content);
        container.append(group);
        buildSubLevel(content, dataDiv, depth + 1);
      } else {
        carryActions(header, dataDiv);
        group.append(header);
        container.append(group);
      }
    });
  }

  function buildSubLevel(container, dataContainer, depth) {
    var totalLeft = baseLeft + depth * indentUnit;
    Array.prototype.forEach.call(dataContainer.children, function (dataDiv) {
      var isCollapse = dataDiv.classList.contains('collapse');
      var text = dataDiv.getAttribute('text') || '';
      var icon = dataDiv.getAttribute('icon') || '';
      var vlineLeft = (totalLeft + 7) + 'px';

      if (isCollapse) {
        var group = document.createElement('div');
        group.className = 'nav-item-group' + (dataDiv.classList.contains('open') ? ' open' : '');
        group.classList.add('has-line');
        group.style.setProperty('--vline-left', vlineLeft);
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-toggle';
        toggle.style.paddingLeft = totalLeft + 'px';
        toggle.append(makeLabel(icon, text));
        var ch = document.createElement('span');
        ch.className = 'material-symbols-rounded chevron';
        ch.textContent = 'expand_more';
        toggle.append(ch);
        toggle.onclick = function () { toggleGroup(toggle); };
        toggle.setAttribute('aria-expanded', dataDiv.classList.contains('open') ? 'true' : 'false');
        var sublist = document.createElement('div');
        sublist.className = 'sub-list';
        sublist.setAttribute('aria-hidden', dataDiv.classList.contains('open') ? 'false' : 'true');
        group.append(toggle, sublist);
        container.append(group);
        buildSubLevel(sublist, dataDiv, depth + 1);
      } else {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'sub-item';
        item.style.paddingLeft = totalLeft + 'px';
        carryActions(item, dataDiv);
        var i = document.createElement('span');
        i.className = 'material-symbols-rounded';
        i.textContent = icon;
        item.append(i, document.createTextNode(text));
        container.append(item);
      }
    });
  }

  function setLineTops(scope) {
    scope.querySelectorAll('.category-group.has-line, .nav-item-group.has-line').forEach(function (group) {
      var header = group.querySelector('.category-header, .nav-toggle');
      if (header) {
        header.offsetHeight; // force reflow
        group.style.setProperty('--line-top', header.offsetHeight + 'px');
      }
    });
  }

  /* ---- Build every card on the page, each from its own source ---- */
  document.querySelectorAll('.category-scroll').forEach(function (scroll) {
    if (scroll.dataset.built) return;
    var srcSel = scroll.getAttribute('data-source') || '#products';
    var src = document.querySelector(srcSel);
    if (!src) return;
    buildTopLevel(scroll, src, 0);
    src.remove();
    scroll.dataset.built = '1';
    setLineTops(scroll);
  });

  /* ---- Toggle, scoped to the card it belongs to (so one card can't
   *      collapse groups in another card) ---- */
  window.toggleGroup = function (btn) {
    var group = btn.closest('.category-group, .nav-item-group');
    if (!group) return;
    var content = group.querySelector('.category-content, .sub-list');
    if (!content) return;
    var scope = btn.closest('.category-scroll') || document;
    var isOpen = group.classList.contains('open');

    if (group.classList.contains('category-group')) {
      if (!isOpen) {
        Array.prototype.slice.call(scope.querySelectorAll('.category-group.open'))
          .filter(function (g) { return g !== group; })
          .forEach(function (o) {
            var c = o.querySelector('.category-content');
            var b = o.querySelector('.category-header');
            o.classList.remove('open');
            if (b) b.setAttribute('aria-expanded', 'false');
            if (c) collapse(c);
          });
        group.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        expand(content);
      } else {
        group.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        collapse(content);
      }
      return;
    }

    var parent = group.parentElement.closest('.nav-item-group, .category-group');
    if (parent) {
      Array.prototype.slice.call(parent.querySelectorAll('.nav-item-group')).forEach(function (sib) {
        if (sib !== group && sib.classList.contains('open')) {
          var sc = sib.querySelector('.sub-list');
          var sb = sib.querySelector('.nav-toggle');
          sib.classList.remove('open');
          if (sb) sb.setAttribute('aria-expanded', 'false');
          if (sc) collapse(sc);
        }
      });
    }
    if (!isOpen) {
      group.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      expand(content);
    } else {
      group.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      collapse(content);
    }
  };

  /* ---- Initialise groups that start open ---- */
  document.querySelectorAll('.category-group.open, .nav-item-group.open').forEach(function (g) {
    var content = g.querySelector('.category-content, .sub-list');
    if (content) {
      content.style.height = 'auto';
      content.style.overflow = 'auto';
      content.removeAttribute('aria-hidden');
      var btn = g.querySelector('.category-header, .nav-toggle');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  });
})();
