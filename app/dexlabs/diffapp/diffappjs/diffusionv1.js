  const diffElements = {
    raw: document.getElementById('diffRawInput'),
    morph: document.getElementById('diffMorphInput'),
    gRaw: document.getElementById('diffRawGutter'),
    gMorph: document.getElementById('diffMorphGutter'),
    scrollD1: document.getElementById('diffDiff1Scroll'),
    scrollD2: document.getElementById('diffDiff2Scroll'),
    d1: document.getElementById('diffDiff1Lines'),
    d2: document.getElementById('diffDiff2Lines'),
    optBreaks: document.getElementById('diffOptBreaks'),
    optInline: document.getElementById('diffOptInline'),
    optSync: document.getElementById('diffOptSyncScroll'),
    overlay: document.getElementById('diffCustomOverlay'),
    inputType: document.getElementById('diffinputtype')
  };

 function diffUpdateGutter(textarea, gutter) {
    const lines = textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '<br>';
    gutter.innerHTML = html;
  }

function diffusion() { let t1 = diffElements.raw.value || ''; let t2 = diffElements.morph.value || ''; const respect = diffElements.optBreaks.checked; const inline = diffElements.optInline.checked; diffUpdateGutter(diffElements.raw, diffElements.gRaw); diffUpdateGutter(diffElements.morph, diffElements.gMorph); if (!respect) { t1 = t1.replace(/\r?\n/g, ' '); t2 = t2.replace(/\r?\n/g, ' '); } const l1 = respect ? t1.split(/\r?\n/) : [t1]; const l2 = respect ? t2.split(/\r?\n/) : [t2]; const max = Math.max(l1.length, l2.length); let h1 = '', h2 = '', diffs = 0; for (let i = 0; i < max; i++) { const a = l1[i] || ''; const b = l2[i] || ''; const ln = i + 1; if (a === b) { const row = `<div class="diff-line-row" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(a) || '&nbsp;'}</div></div>`; h1 += row; h2 += row; } else { diffs++; if (inline && a.length + b.length < 800) { const pre = diffCommonPrefix(a, b); const suf = diffCommonSuffix(a, b); const aMid = a.slice(pre.length, a.length - suf.length); const bMid = b.slice(pre.length, b.length - suf.length); h1 += `<div class="diff-line-row diff-removed" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-removed-strong">${diffEscapeHTML(aMid)}</span>${diffEscapeHTML(suf)}</div></div>`; h2 += `<div class="diff-line-row diff-added" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-added-strong">${diffEscapeHTML(bMid)}</span>${diffEscapeHTML(suf)}</div></div>`; } else { h1 += `<div class="diff-line-row diff-removed" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(a) || '&nbsp;'}</div></div>`; h2 += `<div class="diff-line-row diff-added" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(b) || '&nbsp;'}</div></div>`; } } } diffElements.d1.innerHTML = h1 || '<div style="padding:0 16px; color:#666;">No content</div>'; diffElements.d2.innerHTML = h2 || '<div style="padding:0 16px; color:#666;">No content</div>'; document.getElementById('diffStatDiff').textContent = diffs; document.getElementById('diffStatLine').textContent = max; document.getElementById('diffStatStatus').textContent = diffs === 0 ? 'Identical' : 'Differences Found'; }

  function diffEscapeHTML(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m] || '&#039;'); }
  function diffCommonPrefix(a, b) { let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++; return a.slice(0,i); }
  function diffCommonSuffix(a, b) { let i=0; while(i<a.length && i<b.length && a[a.length-1-i]===b[b.length-1-i]) i++; return a.slice(a.length-i); }

  [diffElements.raw, diffElements.morph].forEach(t => t.addEventListener('input', diffusion));
  diffusion();
