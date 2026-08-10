//<![CDATA[
(function () {
  var PER_PAGE = 20;
  if (!/\/search\/label\//.test(location.pathname)) return;

  var seg = location.pathname.split('/search/label/')[1].split(/[\/?]/)[0];
  var labelPath = seg.split('+').map(function (p) {
    return encodeURIComponent(decodeURIComponent(p));
  }).join('/');

  var page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page') || '1', 10));
  var sortMode = 'date';
  var dir = { date: 'desc', az: 'asc' };
  var CACHE = null;

  function ready(){ document.body.classList.add('cpg-ready'); }
  function findContainer(){
    return document.querySelector('.blog-posts')
        || (document.querySelector('.post-outer-container') || {}).parentElement
        || document.querySelector('#Blog1');
  }
  function postUrl(e){ var l=(e.link||[]).filter(function(x){return x.rel==='alternate';})[0]; return l?l.href:'#'; }
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function cardHTML(p){
    return '<article class="post-outer-container"><div class="post-outer">'
         +   '<div class="post-content container">'
         +     '<i class="ph-fill ph-book-open-text pc-ico"></i>'
         +     '<div class="post-title-container">'
         +       '<h3 class="post-title entry-title"><a href="'+esc(p.url)+'">'+esc(p.title)+'</a></h3>'
         +     '</div>'
         +     '<span class="material-symbols-rounded pc-chev">chevron_right</span>'
         +   '</div>'
         + '</div></article>';
  }

  function controlsHTML(){
    var dateArrow = (dir.date==='desc') ? 'arrow_upward' : 'arrow_downward';
    var azArrow   = (dir.az==='asc')   ? 'arrow_upward' : 'arrow_downward';
    return '<div id="sort-bar">'
      + '<button class="sort-btn'+(sortMode==='date'?' active':'')+'" data-mode="date">Date Modified <span class="material-symbols-rounded">'+dateArrow+'</span></button>'
      + '<button class="sort-btn'+(sortMode==='az'?' active':'')+'" data-mode="az">A\u2013Z <span class="material-symbols-rounded">'+azArrow+'</span></button>'
      + '</div>';
  }

  function pagerHTML(pages){
    if(pages<=1) return '';
    var h='<div id="custom-pager">';
    if(page>1) h+='<a class="cpg" data-page="'+(page-1)+'" href="?page='+(page-1)+'"><span class="material-symbols-rounded">reply_all</span></a>';
    for(var i=1;i<=pages;i++) h+='<a class="cpg'+(i===page?' active':'')+'" data-page="'+i+'" href="?page='+i+'">'+i+'</a>';
    if(page<pages) h+='<a class="cpg" data-page="'+(page+1)+'" href="?page='+(page+1)+'"><span class="material-symbols-rounded">forward</span></a>';
    return h+'</div>';
  }

  function sortedList(){
    var arr = CACHE.slice();
    if(sortMode==='az'){
      arr.sort(function(a,b){ return a.title.toLowerCase().localeCompare(b.title.toLowerCase()); });
      if(dir.az==='desc') arr.reverse();
    } else {
      arr.sort(function(a,b){ return a.updated<b.updated?-1:(a.updated>b.updated?1:0); });
      if(dir.date==='desc') arr.reverse();
    }
    return arr;
  }

  function updateURL(){
    var m=location.search.indexOf('m=1')>-1?'&m=1':'';
    history.pushState({page:page},'',location.pathname+'?page='+page+m);
  }

  function render(){
    var c=findContainer(); if(!c){ ready(); return; }
    var arr=sortedList();
    var pages=Math.max(1,Math.ceil(arr.length/PER_PAGE));
    if(page>pages) page=pages;
    var slice=arr.slice((page-1)*PER_PAGE, page*PER_PAGE);
    c.innerHTML = (slice.length ? slice.map(cardHTML).join('')
                                : '<p style="text-align:center;opacity:.7;padding:40px 0">No posts found.</p>')
                + controlsHTML() + pagerHTML(pages);

    c.querySelectorAll('.post-outer').forEach(function(p){
      p.style.cursor='pointer';
      p.addEventListener('click',function(ev){ if(ev.target.closest('a'))return; var a=p.querySelector('.post-title a'); if(a)a.click(); });
    });
    c.querySelectorAll('.sort-btn').forEach(function(b){
      b.addEventListener('click',function(){
        var m=b.getAttribute('data-mode');
        if(m===sortMode){ dir[m]=(dir[m]==='asc'?'desc':'asc'); } else { sortMode=m; }
        page=1; updateURL(); render();
      });
    });
    c.querySelectorAll('.cpg').forEach(function(a){
      a.addEventListener('click',function(ev){ ev.preventDefault(); page=parseInt(a.getAttribute('data-page'),10); updateURL(); render(); window.scrollTo(0,0); });
    });
    ready();
  }

  function fetchAll(){
    var base='/feeds/posts/summary/-/'+labelPath+'?alt=json&max-results=150';
    return fetch(base+'&start-index=1').then(function(r){return r.json();}).then(function(d){
      var feed=d.feed||{};
      var total=feed['openSearch$totalResults']?parseInt(feed['openSearch$totalResults'].$t,10):((feed.entry||[]).length);
      var all=(feed.entry||[]).slice();
      var reqs=[];
      for(var s=151; s<=total && s<=1500; s+=150){
        reqs.push(fetch(base+'&start-index='+s).then(function(r){return r.json();}).then(function(x){return (x.feed&&x.feed.entry)||[];}));
      }
      return Promise.all(reqs).then(function(rest){
        rest.forEach(function(a){ all=all.concat(a); });
        return all.map(function(e){
          return { title: e.title?e.title.$t:'(untitled)', url: postUrl(e),
                   updated: e.updated?e.updated.$t:(e.published?e.published.$t:'') };
        });
      });
    });
  }

  window.addEventListener('popstate',function(){
    page=Math.max(1,parseInt(new URLSearchParams(location.search).get('page')||'1',10));
    if(CACHE) render();
  });

  fetchAll().then(function(list){ CACHE=list; render(); })
            .catch(function(err){ console.error('pagination fetch failed',err); ready(); });
})();

//]]>
