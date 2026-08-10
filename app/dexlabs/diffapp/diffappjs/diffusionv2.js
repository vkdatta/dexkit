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
  inputType: document.getElementById('diffinputtype'),
  trimSpaces: document.getElementById('diffOptTrim') // New Element
};

function diffUpdateGutter(textarea, gutter) {
  const lines = textarea.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) html += i + '<br>';
  gutter.innerHTML = html;
}

function calculateSimilarity(o, n) {
  if (o === n) return 100;
  const wO = o.trim().split(/\s+/).filter(Boolean);
  const wN = n.trim().split(/\s+/).filter(Boolean);
  if (wO.length === 0 || wN.length === 0) return 0;

  const longest = wO.length >= wN.length ? wO : wN;
  const shortest = wO.length < wN.length ? wO : wN;

  // Check if all words of shortest are in longest
  const allIn = shortest.every(word => longest.includes(word));
  
  if (allIn) {
    const variance = ((longest.length - shortest.length) / wO.length) * 100;
    const SD = Math.sqrt(Math.max(0, variance));
    return Math.max(0, 100 - SD);
  } else {
    // Fallback if not perfectly matching: standard overlap calculation
    let matchCount = 0;
    const tempLong = [...longest];
    for (const word of shortest) {
      const idx = tempLong.indexOf(word);
      if (idx !== -1) {
        matchCount++;
        tempLong[idx] = null;
      }
    }
    return (matchCount / longest.length) * 100;
  }
}

function findAnchor(o, n) {
  const oWords = o.split(/(\s+)/);
  const nWords = n.split(/(\s+)/);
  let maxLen = 0, oStart = 0, nStart = 0;

  // Find longest common continuous sequence of words (the Anchor)
  for (let a = 0; a < oWords.length; a++) {
    if (!oWords[a].trim()) continue;
    for (let b = 0; b < nWords.length; b++) {
      if (!nWords[b].trim()) continue;
      let curLen = 0, tempA = a, tempB = b;
      
      while (tempA < oWords.length && tempB < nWords.length && oWords[tempA] === nWords[tempB]) {
        curLen++;
        tempA++; tempB++;
      }
      
      if (curLen > maxLen) {
        // Ensure at least one actual word is in the match, not just spaces
        let hasWord = false;
        for (let k = 0; k < curLen; k++) if (oWords[a + k].trim()) hasWord = true;
        
        if (hasWord) {
          maxLen = curLen; oStart = a; nStart = b;
        }
      }
    }
  }

  if (maxLen === 0) return null;

  return {
    preO: oWords.slice(0, oStart).join(''),
    preN: nWords.slice(0, nStart).join(''),
    anchorText: oWords.slice(oStart, oStart + maxLen).join(''),
    sufO: oWords.slice(oStart + maxLen).join(''),
    sufN: nWords.slice(nStart + maxLen).join('')
  };
}

function diffusion() {
  let t1 = diffElements.raw.value || '';
  let t2 = diffElements.morph.value || '';
  const respect = diffElements.optBreaks.checked;
  const inline = diffElements.optInline.checked;
  const trimActive = diffElements.trimSpaces && diffElements.trimSpaces.checked;
  const inputMode = diffElements.inputType ? diffElements.inputType.value : 'other';

  diffUpdateGutter(diffElements.raw, diffElements.gRaw);
  diffUpdateGutter(diffElements.morph, diffElements.gMorph);

  // Apply Trim Whitespaces Rule
  if (trimActive) {
    t1 = t1.replace(/[ \t]+/g, ' ').replace(/^ | $/gm, '');
    t2 = t2.replace(/[ \t]+/g, ' ').replace(/^ | $/gm, '');
  }

  if (!respect) {
    t1 = t1.replace(/\r?\n/g, ' ');
    t2 = t2.replace(/\r?\n/g, ' ');
  }

  const l1 = respect ? t1.split(/\r?\n/) : [t1];
  const l2 = respect ? t2.split(/\r?\n/) : [t2];

  let h1 = '', h2 = '', diffs = 0;

  if (inputMode === "plain text") {
    // --- NEW ALGORITHM: Plain Text Mode ---
    let alignedO = [], alignedN = [];
    let i = 0, j = 0;

    // 1. Interline Level: 2-way lookahead shift
    while (i < l1.length || j < l2.length) {
      const oLine = i < l1.length ? l1[i] : null;
      const nLine = j < l2.length ? l2[j] : null;

      if (oLine === null) { alignedO.push(null); alignedN.push(nLine); j++; continue; }
      if (nLine === null) { alignedO.push(oLine); alignedN.push(null); i++; continue; }

      const sim = calculateSimilarity(oLine, nLine);

      if (sim >= 80) {
        alignedO.push(oLine); alignedN.push(nLine);
        i++; j++;
      } else {
        // Lookahead in new text
        let matchN = -1;
        for (let k = j + 1; k < l2.length; k++) {
          if (calculateSimilarity(oLine, l2[k]) >= 80) { matchN = k; break; }
        }
        // Lookahead in old text
        let matchO = -1;
        for (let k = i + 1; k < l1.length; k++) {
          if (calculateSimilarity(l1[k], nLine) >= 80) { matchO = k; break; }
        }

        if (matchN !== -1 && (matchO === -1 || (matchN - j) <= (matchO - i))) {
          while (j < matchN) { alignedO.push(null); alignedN.push(l2[j]); j++; }
        } else if (matchO !== -1) {
          while (i < matchO) { alignedO.push(l1[i]); alignedN.push(null); i++; }
        } else {
          // No match, align and proceed to character/word level
          alignedO.push(oLine); alignedN.push(nLine);
          i++; j++;
        }
      }
    }

    // 2. Intra-line (Word & Character) Level
    for (let k = 0; k < Math.max(alignedO.length, alignedN.length); k++) {
      const a = alignedO[k];
      const b = alignedN[k];
      const ln = k + 1;

      if (a === b && a !== null) {
        const row = `<div class="diff-line-row" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(a) || '&nbsp;'}</div></div>`;
        h1 += row; h2 += row;
      } else {
        diffs++;
        const safeA = a === null ? '' : a;
        const safeB = b === null ? '' : b;

        if (inline && safeA && safeB && (safeA.length + safeB.length < 800)) {
          const anchorData = findAnchor(safeA, safeB);

          if (anchorData) {
             // Diff Prefix (Before anchor)
             const preComPre = diffCommonPrefix(anchorData.preO, anchorData.preN);
             const preComSuf = diffCommonSuffix(anchorData.preO, anchorData.preN);
             const aPreMid = anchorData.preO.slice(preComPre.length, anchorData.preO.length - preComSuf.length);
             const bPreMid = anchorData.preN.slice(preComPre.length, anchorData.preN.length - preComSuf.length);

             // Diff Suffix (After anchor)
             const sufComPre = diffCommonPrefix(anchorData.sufO, anchorData.sufN);
             const sufComSuf = diffCommonSuffix(anchorData.sufO, anchorData.sufN);
             const aSufMid = anchorData.sufO.slice(sufComPre.length, anchorData.sufO.length - sufComSuf.length);
             const bSufMid = anchorData.sufN.slice(sufComPre.length, anchorData.sufN.length - sufComSuf.length);

             h1 += `<div class="diff-line-row diff-removed" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(preComPre)}<span class="diff-word-removed-strong">${diffEscapeHTML(aPreMid)}</span>${diffEscapeHTML(preComSuf)}${diffEscapeHTML(anchorData.anchorText)}${diffEscapeHTML(sufComPre)}<span class="diff-word-removed-strong">${diffEscapeHTML(aSufMid)}</span>${diffEscapeHTML(sufComSuf)}</div></div>`;
             
             h2 += `<div class="diff-line-row diff-added" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(preComPre)}<span class="diff-word-added-strong">${diffEscapeHTML(bPreMid)}</span>${diffEscapeHTML(preComSuf)}${diffEscapeHTML(anchorData.anchorText)}${diffEscapeHTML(sufComPre)}<span class="diff-word-added-strong">${diffEscapeHTML(bSufMid)}</span>${diffEscapeHTML(sufComSuf)}</div></div>`;
          } else {
            // Fallback to purely character level if no word anchor exists
            const pre = diffCommonPrefix(safeA, safeB);
            const suf = diffCommonSuffix(safeA, safeB);
            const aMid = safeA.slice(pre.length, safeA.length - suf.length);
            const bMid = safeB.slice(pre.length, safeB.length - suf.length);
            h1 += `<div class="diff-line-row diff-removed" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-removed-strong">${diffEscapeHTML(aMid)}</span>${diffEscapeHTML(suf)}</div></div>`;
            h2 += `<div class="diff-line-row diff-added" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-added-strong">${diffEscapeHTML(bMid)}</span>${diffEscapeHTML(suf)}</div></div>`;
          }
        } else {
          // Block level missing lines
          h1 += `<div class="diff-line-row ${a === null ? '' : 'diff-removed'}" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${a === null ? '&nbsp;' : (diffEscapeHTML(a) || '&nbsp;')}</div></div>`;
          h2 += `<div class="diff-line-row ${b === null ? '' : 'diff-added'}" data-line="${k}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${b === null ? '&nbsp;' : (diffEscapeHTML(b) || '&nbsp;')}</div></div>`;
        }
      }
    }
  } else {
    // --- ORIGINAL ALGORITHM: Other Mode ---
    const max = Math.max(l1.length, l2.length);
    for (let i = 0; i < max; i++) {
      const a = l1[i] || ''; const b = l2[i] || ''; const ln = i + 1;
      if (a === b) {
        const row = `<div class="diff-line-row" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(a) || '&nbsp;'}</div></div>`;
        h1 += row; h2 += row;
      } else {
        diffs++;
        if (inline && a.length + b.length < 800) {
          const pre = diffCommonPrefix(a, b);
          const suf = diffCommonSuffix(a, b);
          const aMid = a.slice(pre.length, a.length - suf.length);
          const bMid = b.slice(pre.length, b.length - suf.length);
          h1 += `<div class="diff-line-row diff-removed" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-removed-strong">${diffEscapeHTML(aMid)}</span>${diffEscapeHTML(suf)}</div></div>`;
          h2 += `<div class="diff-line-row diff-added" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(pre)}<span class="diff-word-added-strong">${diffEscapeHTML(bMid)}</span>${diffEscapeHTML(suf)}</div></div>`;
        } else {
          h1 += `<div class="diff-line-row diff-removed" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(a) || '&nbsp;'}</div></div>`;
          h2 += `<div class="diff-line-row diff-added" data-line="${i}"><div class="diff-gutter-cell">${ln}</div><div class="diff-content-cell">${diffEscapeHTML(b) || '&nbsp;'}</div></div>`;
        }
      }
    }
  }

  const finalMax = inputMode === "plain text" ? Math.max(h1.split('diff-line-row').length - 1, h2.split('diff-line-row').length - 1) : Math.max(l1.length, l2.length);

  diffElements.d1.innerHTML = h1 || '<div style="padding:0 16px; color:#666;">No content</div>';
  diffElements.d2.innerHTML = h2 || '<div style="padding:0 16px; color:#666;">No content</div>';
  document.getElementById('diffStatDiff').textContent = diffs;
  document.getElementById('diffStatLine').textContent = finalMax;
  document.getElementById('diffStatStatus').textContent = diffs === 0 ? 'Identical' : 'Differences Found';
}

function diffEscapeHTML(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m] || '&#039;'); }
function diffCommonPrefix(a, b) { let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++; return a.slice(0,i); }
function diffCommonSuffix(a, b) { let i=0; while(i<a.length && i<b.length && a[a.length-1-i]===b[b.length-1-i]) i++; return a.slice(a.length-i); }

// Make sure to add events for the new UI elements if they exist
[diffElements.raw, diffElements.morph].forEach(t => t.addEventListener('input', diffusion));
if (diffElements.inputType) diffElements.inputType.addEventListener('change', diffusion);
if (diffElements.trimSpaces) diffElements.trimSpaces.addEventListener('change', diffusion);

diffusion();
