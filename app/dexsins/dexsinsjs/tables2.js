(function () {
  'use strict';

  var DEFAULT_NAME = 'Sheets';

  function tableToCSV(table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    return rows.map(function (row) {
      return Array.prototype.slice.call(row.querySelectorAll('th, td'))
        .map(function (cell) {
          var raw = cell.textContent.trim();
          var needsQuotes = /[",\n]/.test(raw);
          var text = raw.replace(/\s+/g, ' ').replace(/"/g, '""');
          if (needsQuotes) { text = '"' + text + '"'; }
          return text;
        })
        .join(',');
    }).join('\n');
  }

  function sanitizeFilename(name) {
    var cleaned = name.trim().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '');
    return cleaned || 'table';
  }

  function downloadCSV(filename, csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Briefly swap a button's icon to give feedback, then restore it.
  function flashIcon(btn, iconClass) {
    var icon = btn.querySelector('i');
    if (!icon) { return; }
    var prev = icon.className;
    icon.className = iconClass;
    setTimeout(function () { icon.className = prev; }, 1400);
  }

  function makeButton(action, iconClass, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'table-btn';
    btn.setAttribute('data-action', action);
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    var i = document.createElement('i');
    i.className = iconClass;
    btn.appendChild(i);
    return btn;
  }

  // Turn a bare <table> into a styled card with a title bar + copy/download icons.
  function enhance(table) {
    if (!table || table.dataset.enhanced === 'true') { return null; }
    if (table.hasAttribute('data-no-enhance')) { table.dataset.enhanced = 'true'; return null; }
    if (table.closest('.table-card')) { table.dataset.enhanced = 'true'; return null; }

    var name = (table.getAttribute('name') || '').trim() || DEFAULT_NAME;
    var hasHead = !!table.querySelector('thead, th');

    var card = document.createElement('div');
    card.className = 'table-card' + (hasHead ? '' : ' is-plain');

    var bar = document.createElement('div');
    bar.className = 'table-bar';

    var title = document.createElement('span');
    title.className = 'table-title';
    title.textContent = name;

    var actions = document.createElement('div');
    actions.className = 'table-actions';
    var copyBtn = makeButton('copy', 'ph-fill ph-copy', 'Copy');
    var dlBtn = makeButton('download', 'ph-fill ph-download-simple', 'Download');
    actions.appendChild(copyBtn);
    actions.appendChild(dlBtn);

    bar.appendChild(title);
    bar.appendChild(actions);

    var scroll = document.createElement('div');
    scroll.className = 'table-scroll';

    // Drop the card where the table sits, then move the table inside it.
    table.parentNode.insertBefore(card, table);
    scroll.appendChild(table);
    card.appendChild(bar);
    card.appendChild(scroll);
    table.dataset.enhanced = 'true';

    copyBtn.addEventListener('click', function () {
      var csv = tableToCSV(table);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(csv)
          .then(function () { flashIcon(copyBtn, 'ph-fill ph-check'); })
          .catch(function () { flashIcon(copyBtn, 'ph-fill ph-x'); });
      } else {
        flashIcon(copyBtn, 'ph-fill ph-x');
      }
    });

    dlBtn.addEventListener('click', function () {
      var base = sanitizeFilename(title.textContent.trim() || DEFAULT_NAME);
      var suffix = card.dataset.dlSuffix ? '-' + card.dataset.dlSuffix : '';
      downloadCSV(base + suffix + '.csv', tableToCSV(table));
    });

    return card;
  }

  // Give same-named tables distinct filenames so multiple untitled
  // "Sheets" tables never overwrite each other on download.
  function reindexDownloads() {
    var titles = Array.prototype.slice.call(document.querySelectorAll('.table-card .table-title'));
    var counts = {}, seen = {};
    titles.forEach(function (t) {
      var key = t.textContent.trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    titles.forEach(function (t) {
      var card = t.closest('.table-card');
      var key = t.textContent.trim().toLowerCase();
      if (counts[key] > 1) {
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] > 1) { card.dataset.dlSuffix = String(seen[key]); }
        else { delete card.dataset.dlSuffix; }
      } else {
        delete card.dataset.dlSuffix;
      }
    });
  }

  function enhanceAll(scope) {
    var root = scope && scope.querySelectorAll ? scope : document;
    var changed = false;
    Array.prototype.slice.call(root.querySelectorAll('table')).forEach(function (tbl) {
      if (enhance(tbl)) { changed = true; }
    });
    if (changed) { reindexDownloads(); }
  }

  function init() {
    enhanceAll(document);

    // Upgrade tables added to the page later (e.g. streamed in).
    if ('MutationObserver' in window && document.body) {
      var mo = new MutationObserver(function (mutations) {
        var found = false;
        mutations.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (node) {
            if (node.nodeType !== 1) { return; }
            if (node.tagName === 'TABLE') {
              if (enhance(node)) { found = true; }
            } else if (node.querySelectorAll) {
              Array.prototype.forEach.call(node.querySelectorAll('table'), function (t) {
                if (enhance(t)) { found = true; }
              });
            }
          });
        });
        if (found) { reindexDownloads(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
