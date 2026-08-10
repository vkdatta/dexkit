if (!document.getElementById('fp-styles')) {
  const s = document.createElement('style');
  s.id = 'fp-styles';
  s.textContent = `
    .fp-toggle-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .fp-toggle-btn { flex: 1; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); color: #aaa; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .fp-toggle-btn.active { background: rgba(0,0,0,0.4); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.25); color: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .fp-section { display: none; }
    .fp-section.active { display: block; }
    .fp-search-wrap { position: relative; margin-bottom: 10px; }
    .fp-search-input { width: 100%; box-sizing: border-box; padding: 7px 12px; background: #1e2124; border: 1px solid var(--border); border-radius: 20px; color: #eeeeee; outline: none; font-family: inherit; font-size: 13px; }
    .fp-search-input:focus { border-color: rgba(100, 116, 255, 0.55); }
    .fp-list { max-height: 310px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .fp-card { cursor: pointer; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px; background: rgba(255,255,255,0.03); transition: all 0.2s; display: flex; align-items: center; justify-content: space-between; }
    .fp-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); background: rgba(255,255,255,0.05); }
    .fp-card.selected { background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); border-color: rgba(255,255,255,0.2); box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
    .fp-card-title { color: #eee; }
    .fp-card-badge { font-size: 0.8em; color: var(--blueink); background: rgba(100, 116, 255, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(100, 116, 255, 0.18); letter-spacing: 0.5px; }
    .fp-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
    .fp-actions button { flex: 1; }
    .fp-empty { color: var(--blueink); text-align: center; padding: 16px 0; opacity: 0.6; font-size: 13px; }
    @media (max-width: 480px) { .fp-list { max-height: 230px; } }
  `;
  document.head.appendChild(s);
}

function createFont(label, sets) {
  const font = { label };
  if (sets.upper)    font.upper    = [...sets.upper];
  if (sets.lower)    font.lower    = [...sets.lower];
  if (sets.numerals) font.numerals = [...sets.numerals];
  return font;
}

const FONTS = {
  typewriter: createFont('Typewriter', {
    upper:    '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉',
    lower:    '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣',
    numerals: '𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝟶',
  }),
  smallcap: createFont('Smallcap', {
    upper:    'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ',
    numerals: '𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝟶',
  }),
  empire: createFont('Empire', {
    upper: '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅',
    lower: '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟',
  }),
  whiteball: createFont('White Ball', {
    upper:    'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ',
    lower:    'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ',
    numerals: '①②③④⑤⑥⑦⑧⑨⓪',
  }),
  blackball: createFont('Black Ball', {
    upper:    '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩',
    numerals: '➊➋➌➍➎➏➐➑➒⓿',
  }),
  blackdice: createFont('Black Dice', {
    upper: '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉',
  }),
    samurai: createFont('Samurai', {
    upper:    '卂乃匚刀乇千Ꮆ卄工ﾌҜㄥ爪𠘨ㄖ尸Ɋ尺丂ㄒㄩᐯ山乂ㄚ乙',
    numerals: '一二三四五六七八九〇',
  }),

};

// Named export version of the original window.registerFont.
export function registerFont(key, label, sets) {
  if (FONTS[key]) { console.warn(`Font "${key}" exists`); return false; }
  FONTS[key] = createFont(label, sets);
  _rmap = null;
  return true;
}

let selectedTextFont = null;
let selectedNumFont  = null;
let liveSync         = false;
let liveSyncHandler  = null;
let _rmap            = null;

function buildReverseMap() {
  if (_rmap) return _rmap;
  _rmap = {};
  Object.values(FONTS).forEach(f => {
    (f.upper || []).forEach((ch, i) => {
      if (ch.charCodeAt(0) > 127) _rmap[ch] = String.fromCharCode(65 + i);
    });
    (f.lower || []).forEach((ch, i) => {
      if (ch.charCodeAt(0) > 127) _rmap[ch] = String.fromCharCode(97 + i);
    });
    (f.numerals || []).forEach((ch, i) => {
      if (ch.charCodeAt(0) > 127) _rmap[ch] = i === 9 ? '0' : String(i + 1);
    });
  });
  return _rmap;
}

function toAscii(text) {
  const m = buildReverseMap();
  return [...text].map(ch => m[ch] ?? ch).join('');
}

function convert(text, tKey, nKey) {
  const tf = tKey ? FONTS[tKey] : null;
  const nf = nKey ? FONTS[nKey] : null;
  return [...text].map(ch => {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90 && tf?.upper)    return tf.upper[c - 65];
    if (c >= 97 && c <= 122) {
      if (tf?.lower) return tf.lower[c - 97];
      if (tf?.upper) return tf.upper[c - 97];
    }
    if (c >= 49 && c <= 57 && nf?.numerals) return nf.numerals[c - 49];
    if (c === 48             && nf?.numerals) return nf.numerals[9];
    return ch;
  }).join('');
}

function renderBadgeInFont(font) {
  const parts = [];
  if (font.upper)    parts.push(convert('A-Z', font.label.toLowerCase().replace(/\s/g, ''), null));
  if (font.lower)    parts.push(convert('a-z', font.label.toLowerCase().replace(/\s/g, ''), null));
  if (font.numerals) parts.push(convert('0-9', null, font.label.toLowerCase().replace(/\s/g, '')));
  return parts.join(' · ');
}

function createCard(key, type, onSelect) {
  const font = FONTS[key];
  const isSel = (type === 'text' ? selectedTextFont : selectedNumFont) === key;
  const card = document.createElement('div');
  card.className = 'fp-card' + (isSel ? ' selected' : '');
  card.innerHTML = `<div class="fp-card-title">${font.label}</div><div class="fp-card-badge">${renderBadgeInFont(font)}</div>`;
  card.onclick = () => {
    document.querySelectorAll(`.fp-section[data-type="${type}"] .fp-card`).forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    onSelect(key);
  };
  return card;
}

function buildSection(type) {
  const keys = type === 'numeral'
    ? Object.keys(FONTS).filter(k => FONTS[k].numerals)
    : Object.keys(FONTS);

  const section = document.createElement('div');
  section.className = 'fp-section' + (type === 'text' ? ' active' : '');
  section.dataset.type = type;

  const searchWrap = document.createElement('div');
  searchWrap.className = 'fp-search-wrap';
  const searchInput = document.createElement('input');
  searchInput.className = 'fp-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search fonts…';
  searchInput.autocomplete = 'off';
  searchWrap.appendChild(searchInput);
  section.appendChild(searchWrap);

  const list = document.createElement('div');
  list.className = 'fp-list';

  const renderCards = (filter = '') => {
    list.innerHTML = '';
    let count = 0;
    keys.forEach(key => {
      if (filter && !FONTS[key].label.toLowerCase().includes(filter.toLowerCase())) return;
      list.appendChild(createCard(key, type, k => {
        if (type === 'text') selectedTextFont = k; else selectedNumFont = k;
      }));
      count++;
    });
    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'fp-empty';
      empty.textContent = 'No matches';
      list.appendChild(empty);
    }
  };

  renderCards();
  searchInput.addEventListener('input', e => renderCards(e.target.value.trim()));
  section.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'fp-actions';

  const revertBtn = document.createElement('button');
  revertBtn.className = 'modal-btn';
  revertBtn.textContent = 'Revert';
  revertBtn.onclick = () => {
    if (liveSync) {
      noteTextarea.removeEventListener('input', liveSyncHandler);
      liveSync = false; liveSyncHandler = null;
    }
    noteTextarea.value = toAscii(noteTextarea.value);
    selectedTextFont = selectedNumFont = null;
    document.querySelectorAll('.fp-card.selected').forEach(c => c.classList.remove('selected'));
    if (typeof updateNoteMetadata === 'function') updateNoteMetadata();
    showNotification('Reverted to original');
  };

  const applyBtn = document.createElement('button');
  applyBtn.className = 'modal-btn';
  applyBtn.textContent = 'Apply Once';
  applyBtn.onclick = () => {
    if (!selectedTextFont && !selectedNumFont) return showNotification('Select a font first');
    const pos = noteTextarea.selectionStart;
    noteTextarea.value = convert(toAscii(noteTextarea.value), selectedTextFont, selectedNumFont);
    try { noteTextarea.setSelectionRange(pos, pos); } catch(_) {}
    if (typeof updateNoteMetadata === 'function') updateNoteMetadata();
    showNotification('Font applied');
  };

  const syncBtn = document.createElement('button');
  syncBtn.className = 'modal-btn' + (liveSync ? ' active' : '');
  syncBtn.textContent = 'Live Sync';
  syncBtn.onclick = () => {
    if (liveSync) {
      noteTextarea.removeEventListener('input', liveSyncHandler);
      liveSync = false; liveSyncHandler = null;
      syncBtn.classList.remove('active');
      showNotification('Live sync off');
    } else {
      if (!selectedTextFont && !selectedNumFont) return showNotification('Select a font first');
      applyBtn.click();
      liveSyncHandler = () => {
        const pos = noteTextarea.selectionStart;
        const converted = convert(toAscii(noteTextarea.value), selectedTextFont, selectedNumFont);
        if (converted !== noteTextarea.value) {
          noteTextarea.value = converted;
          try { noteTextarea.setSelectionRange(pos, pos); } catch(_) {}
          if (typeof updateNoteMetadata === 'function') updateNoteMetadata();
        }
      };
      noteTextarea.addEventListener('input', liveSyncHandler);
      liveSync = true;
      syncBtn.classList.add('active');
      showNotification('Live sync on');
    }
  };

  actions.append(revertBtn, applyBtn, syncBtn);
  section.appendChild(actions);
  return section;
}

// Named export version of the original window.openFontPickerModal.
export async function openFontPickerModal() {
  if (!currentNote || !noteTextarea) return;

  const body = document.createElement('div');
  const toggleRow = document.createElement('div');
  toggleRow.className = 'fp-toggle-row';

  const textBtn = document.createElement('button');
  textBtn.className = 'fp-toggle-btn active';
  textBtn.textContent = 'Text Font';

  const numBtn = document.createElement('button');
  numBtn.className = 'fp-toggle-btn';
  numBtn.textContent = 'Number Font';

  toggleRow.append(textBtn, numBtn);

  const textSection = buildSection('text');
  const numSection = buildSection('numeral');

  textBtn.onclick = () => { textBtn.classList.add('active'); numBtn.classList.remove('active'); textSection.classList.add('active'); numSection.classList.remove('active'); };
  numBtn.onclick = () => { numBtn.classList.add('active'); textBtn.classList.remove('active'); numSection.classList.add('active'); textSection.classList.remove('active'); };

  body.append(toggleRow, textSection, numSection);

  const modalPromise = showModal({
    title: 'Choose Fonts',
    body: body,
    footer: '<button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" onclick="closeModal(\'save\')">Save</button>'
  });

  const win = modalBackdrop.querySelector('.modal-window');
  if (win) { win.style.width = '440px'; win.style.maxWidth = '440px'; }

  const result = await modalPromise;
  if (result === 'save' || (result && result.action === 'Save')) {
    showNotification('Font settings saved');
  }
}
