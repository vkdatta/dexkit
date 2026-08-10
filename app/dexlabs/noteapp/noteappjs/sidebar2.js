 (function () {
  const hamburger = document.getElementById('secondary-sidebar-button');
  const overlay = document.getElementById('secondary-sidebar-overlay');
  const sidebar = document.getElementById('secondary-sidebar');
  const productCard = document.getElementById('secondary-sidebar-card');
  const cardScroll = document.getElementById('secondary-sidebar-scroll');
  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;
  
  function getTransitionMs() {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').trim();
    return Math.round((parseFloat(val) || 0.32) * 1000);
  }
  
 function openSidebar() {
  sidebar.classList.add('open');
  sidebar.setAttribute('aria-hidden', 'false');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.innerHTML = '<i class="material-symbols-rounded">close</i>';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = '<i class="material-symbols-rounded">view_cozy</i>';
}

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  sidebar.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
      closeSidebar();
    }
  });
 
  function collapse(elem, done) {
    elem.style.overflow = 'hidden';
    elem.style.height = elem.scrollHeight + 'px';
    elem.getBoundingClientRect();
    requestAnimationFrame(() => { elem.style.height = '0'; });
    setTimeout(() => {
      elem.style.height = '';
      elem.setAttribute('aria-hidden','true');
      elem.style.overflow = 'hidden';
      if (done) done();
    }, getTransitionMs() + 20);
  }
  
  function expand(elem, done) {
    elem.style.height = '0';
    elem.setAttribute('aria-hidden','false');
    elem.getBoundingClientRect();
    const target = elem.scrollHeight + 'px';
    requestAnimationFrame(() => { elem.style.height = target; });
    setTimeout(() => {
      elem.style.height = 'auto';
      elem.style.overflow = 'auto';
      if (done) done();
    }, getTransitionMs() + 20);
  }
  
  function buildTopLevel(container, dataContainer, depth = 0) {
    const baseLeft = 12;
    const indentUnit = 20;
    const indent = depth * indentUnit;
    const totalLeft = baseLeft + indent;
    
    Array.from(dataContainer.children).forEach(dataDiv => {
      const isCollapse = dataDiv.classList.contains('collapse');
      const text = dataDiv.getAttribute('text');
      const icon = dataDiv.getAttribute('icon');
      const vlineLeft = (totalLeft + 7) + 'px';
      
      const group = document.createElement('div');
      group.className = `secondary-sidebar-category-group${isCollapse && dataDiv.classList.contains('open') ? ' open' : ''}`;
      
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'secondary-sidebar-category-header';
      header.style.paddingLeft = totalLeft + 'px';
      
      const left = document.createElement('span');
      left.className = 'secondary-sidebar-left';
      
      const i = document.createElement('span');
      i.className = 'material-symbols-rounded';
      i.textContent = icon;
      
      const l = document.createElement('span');
      l.className = 'secondary-sidebar-label';
      l.textContent = text;
      
      left.append(i, l);
      header.append(left);
      
      if (isCollapse) {
        group.classList.add('has-line');
        group.style.setProperty('--vline-left', vlineLeft);
        
        const ch = document.createElement('span');
        ch.className = 'material-symbols-rounded secondary-sidebar-chevron';
        ch.textContent = 'expand_more';
        header.append(ch);
        
        header.onclick = () => toggleGroup(header);
        header.setAttribute('aria-expanded', dataDiv.classList.contains('open') ? 'true' : 'false');
        
        const content = document.createElement('div');
        content.className = 'secondary-sidebar-category-content';
        content.setAttribute('aria-hidden', dataDiv.classList.contains('open') ? 'false' : 'true');
        
        group.append(header, content);
        buildSubLevel(content, dataDiv, depth + 1);
      } else {
        const onclickAttr = dataDiv.getAttribute('onclick');
        if (onclickAttr) {
          header.setAttribute('onclick', onclickAttr);
        }
        group.append(header);
      }
      
      container.append(group);
    });
  }
  
  function buildSubLevel(container, dataContainer, depth) {
    const baseLeft = 12;
    const indentUnit = 20;
    const indent = depth * indentUnit;
    const totalLeft = baseLeft + indent;
    
    Array.from(dataContainer.children).forEach(dataDiv => {
      const isCollapse = dataDiv.classList.contains('collapse');
      const text = dataDiv.getAttribute('text');
      const icon = dataDiv.getAttribute('icon');
      const vlineLeft = (totalLeft + 7) + 'px';
      
      if (isCollapse) {
        const group = document.createElement('div');
        group.className = `secondary-sidebar-nav-item-group${dataDiv.classList.contains('open') ? ' open' : ''}`;
        group.classList.add('has-line');
        group.style.setProperty('--vline-left', vlineLeft);
        
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'secondary-sidebar-nav-toggle';
        toggle.style.paddingLeft = totalLeft + 'px';
        
        const left = document.createElement('span');
        left.className = 'secondary-sidebar-left';
        
        const i = document.createElement('span');
        i.className = 'material-symbols-rounded';
        i.textContent = icon;
        
        const l = document.createElement('span');
        l.className = 'secondary-sidebar-label';
        l.textContent = text;
        
        left.append(i, l);
        toggle.append(left);
        
        const ch = document.createElement('span');
        ch.className = 'material-symbols-rounded secondary-sidebar-chevron';
        ch.textContent = 'expand_more';
        toggle.append(ch);
        
        toggle.onclick = () => toggleGroup(toggle);
        toggle.setAttribute('aria-expanded', dataDiv.classList.contains('open') ? 'true' : 'false');
        
        const sublist = document.createElement('div');
        sublist.className = 'secondary-sidebar-sub-list';
        sublist.setAttribute('aria-hidden', dataDiv.classList.contains('open') ? 'false' : 'true');
        
        group.append(toggle, sublist);
        container.append(group);
        buildSubLevel(sublist, dataDiv, depth + 1);
      } else {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'secondary-sidebar-sub-item';
        item.style.paddingLeft = totalLeft + 'px';
        
        const onclickAttr = dataDiv.getAttribute('onclick');
        if (onclickAttr) {
          item.setAttribute('onclick', onclickAttr);
        }
        const i = document.createElement('span');
        i.className = 'material-symbols-rounded';
        i.textContent = icon;
        
        item.append(i, document.createTextNode(text));
        container.append(item);
      }
    });
  }
  
  const products = cardScroll.querySelector('.secondary-sidebar-products');
  if (products) {
    buildTopLevel(cardScroll, products, 0);
    products.remove();

    document.querySelectorAll('.secondary-sidebar-category-group.has-line, .secondary-sidebar-nav-item-group.has-line').forEach(group => {
      const header = group.querySelector('.secondary-sidebar-category-header, .secondary-sidebar-nav-toggle');
      if (header) {
        header.offsetHeight;
        const headerHeight = header.offsetHeight;
        group.style.setProperty('--line-top', headerHeight + 'px');
      }
    });
  }
  
  window.toggleGroup = function(btn) {
    const group = btn.closest('.secondary-sidebar-category-group, .secondary-sidebar-nav-item-group');
    if (!group) return;
    
    const content = group.querySelector('.secondary-sidebar-category-content, .secondary-sidebar-sub-list');
    if (!content) return;
    
    const isOpen = group.classList.contains('open');
    
    if (group.classList.contains('secondary-sidebar-category-group')) {
      if (!isOpen) {
        const others = Array.from(document.querySelectorAll('.secondary-sidebar-category-group.open'))
          .filter(g => g !== group);
        others.forEach(o => {
          const c = o.querySelector('.secondary-sidebar-category-content');
          const b = o.querySelector('.secondary-sidebar-category-header');
          o.classList.remove('open');
          if (b) b.setAttribute('aria-expanded','false');
          if (c) collapse(c);
        });
        group.classList.add('open');
        btn.setAttribute('aria-expanded','true');
        expand(content);
      } else {
        group.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
        collapse(content);
      }
      return;
    }
    
    const parent = group.parentElement.closest('.secondary-sidebar-nav-item-group, .secondary-sidebar-category-group');
    if (parent) {
      const siblings = Array.from(parent.querySelectorAll('.secondary-sidebar-nav-item-group'));
      siblings.forEach(sib => {
        if (sib !== group && sib.classList.contains('open')) {
          const sc = sib.querySelector('.secondary-sidebar-sub-list');
          const sb = sib.querySelector('.secondary-sidebar-nav-toggle');
          sib.classList.remove('open');
          if (sb) sb.setAttribute('aria-expanded','false');
          if (sc) collapse(sc);
        }
      });
    }
    
    if (!isOpen) {
      group.classList.add('open');
      btn.setAttribute('aria-expanded','true');
      expand(content);
    } else {
      group.classList.remove('open');
      btn.setAttribute('aria-expanded','false');
      collapse(content);
    }
  };
  
  document.querySelectorAll('.secondary-sidebar-category-group.open, .secondary-sidebar-nav-item-group.open').forEach(g => {
    const content = g.querySelector('.secondary-sidebar-category-content, .secondary-sidebar-sub-list');
    if (content) {
      content.style.height = 'auto';
      content.style.overflow = 'auto';
      content.removeAttribute('aria-hidden');
      const btn = g.querySelector('.secondary-sidebar-category-header, .secondary-sidebar-nav-toggle');
      if (btn) btn.setAttribute('aria-expanded','true');
    }
  });
})();

(function() {  
  const container = document.querySelector('.secondary-sidebar-desc .info-dex');  
  
  if (!container) return;  
  
  const userDisplayWrapper = document.createElement('div');  
  userDisplayWrapper.id = 'user-display-wrapper';  
  userDisplayWrapper.style.cssText = `  
    width: 100% !important;  
    display: flex !important;  
    justify-content: center !important;  
    align-items: center !important;  
    text-align: center !important;  
    margin-bottom: 8px !important;  
  `;  
  
  function capitalizeName(name) {  
    return name  
      .split(' ')  
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))  
      .join(' ');  
  }  
  
  function renderUserDisplay(user) {  
    userDisplayWrapper.innerHTML = user  
      ? `<div style="display:flex !important; align-items:center !important; gap:8px !important;">  
           <img src="${user.photoURL || 'default-profile.png'}"   
                alt="Profile Picture"   
                style="width:23px !important; height:23px !important; border-radius:50% !important; object-fit:cover !important;">  
         </div>`  
      : `<div style="display:flex !important; align-items:center !important; gap:8px !important; font-size:14px !important; color:#cacaca !important;">  
           <span class="material-symbols-rounded" style="font-size:18px !important;">person_heart</span>  
         </div>`;  
  }  
  container.parentNode.insertBefore(userDisplayWrapper, container);  
  renderUserDisplay(auth.currentUser);  
  auth.onAuthStateChanged(user => {  
    renderUserDisplay(user);  
  });  
})();  
