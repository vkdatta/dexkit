//<![CDATA[
(function () {
  'use strict';
  function currentUrl() {
    var c = document.querySelector('link[rel="canonical"]');
    return (c && c.href) || location.href;
  }
  function closeMenu() { var t = document.getElementById('menu-toggle'); if (t) t.checked = false; }

  document.addEventListener('click', function (e) {
    var item = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!item) return;
    var action = item.getAttribute('data-action');
    if (action === 'share') {
      closeMenu();
      var data = { title: document.title, url: currentUrl() };
      if (navigator.share) { navigator.share(data).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(data.url).then(function () { alert('Link copied'); }).catch(function () { prompt('Copy this link:', data.url); }); }
      else { prompt('Copy this link:', data.url); }
    }
  });
})();
//]]>