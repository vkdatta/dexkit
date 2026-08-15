import { $, SAMPLE, COLOR_PAIRS } from './config.js';
import { S, syncUI, readUI, resetState } from './state.js';
import { renderDiagram, clearPreview, setPreviewBackground } from './diagram.js';
import { setLocalFont, setGoogleFont, resetFontSource } from './fonts.js';

const panelEditor   = $('panel-editor');
const panelPreview  = $('panel-preview');
const panelSettings = $('panel-settings');
const textarea      = $('mermaid-code');
const lineCountEl   = $('line-count');
const btnClear      = $('btn-clear');
const btnSample     = $('btn-sample');
const btnRender     = $('btn-render');
const btnApply      = $('btn-apply-settings');
const btnResetS     = $('btn-reset-settings');

export const pickrInstances = {};


export function switchTab(name) {
    [['editor',panelEditor],['preview',panelPreview],['settings',panelSettings]].forEach(([n,pnl]) => {
        pnl.classList.toggle('active', n === name);
    });
    if (name === 'preview') renderDiagram(textarea.value);
    if (name === 'editor')  { setTimeout(() => textarea.focus(), 80); updateLineCount(); }
}
window.dexMermaidSwitchTab = switchTab;

export function updateLineCount() {
    lineCountEl.textContent = `Lines: ${textarea.value.split('\n').length}`;
}
window.dexMermaidUpdateLineCount = updateLineCount;

btnRender.addEventListener('click', () => switchTab('preview'));

btnClear.addEventListener('click', () => {
    textarea.value = ''; updateLineCount(); textarea.focus();
    clearPreview();
});

btnSample.addEventListener('click', () => {
    textarea.value = SAMPLE; updateLineCount(); textarea.focus();
});

textarea.addEventListener('input', updateLineCount);
textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); switchTab('preview'); }
});


btnApply.addEventListener('click', () => {
    readUI();
    setPreviewBackground();
    switchTab('preview');
});

btnResetS.addEventListener('click', () => {
    resetState();
    syncUI();
    resetFontSource();
    setActiveFont('Classy', 'Classy');
    setPreviewBackground();
    const localFontStyle = document.getElementById('local-font-face');
    if (localFontStyle) localFontStyle.remove();
    if (panelPreview.classList.contains('active')) renderDiagram(textarea.value);
});

function setActiveFont(familyName, label) {
    S.font = familyName;
    const badge = $('font-active-name');
    if (badge) badge.textContent = label || familyName;
}


const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function normalizeHex(raw) {
    if (typeof raw !== 'string') return null;
    let v = raw.trim().toLowerCase();
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v.slice(1).split('').map(ch => ch + ch).join('');
    return HEX_RE.test(v) ? v : null;
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
    const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r)      h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                 h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if      (h < 60)  [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else               [r, g, b] = [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

let popoverEl, svEl, svThumb, hueEl, hueThumb, previewEl, hexFieldEl;
let popoverBuilt = false;
const pop = { h: 0, s: 0, v: 0, swatch: null };

function dragOn(el, onMove) {
    el.addEventListener('pointerdown', e => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const handle = ev => {
            const r = el.getBoundingClientRect();
            const x = clamp((ev.clientX - r.left) / r.width, 0, 1);
            const y = clamp((ev.clientY - r.top) / r.height, 0, 1);
            onMove(x, y);
        };
        handle(e);
        const move = ev => handle(ev);
        const up = () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
    });
}

function renderThumbs() {
    svEl.style.backgroundColor = `hsl(${pop.h}, 100%, 50%)`;
    svThumb.style.left = `${pop.s * 100}%`;
    svThumb.style.top  = `${(1 - pop.v) * 100}%`;
    hueThumb.style.left = `${(pop.h / 360) * 100}%`;
}

function commit(hex) {
    if (!pop.swatch) return;
    pop.swatch.value = hex;
    pop.swatch.dispatchEvent(new Event('input', { bubbles: true }));
    previewEl.style.backgroundColor = hex;
    if (document.activeElement !== hexFieldEl) hexFieldEl.value = hex;
}

function applyFromHsv() {
    const { r, g, b } = hsvToRgb(pop.h, pop.s, pop.v);
    renderThumbs();
    commit(rgbToHex(r, g, b));
}

function positionPopover(swatchEl) {
    const sw = swatchEl.getBoundingClientRect();
    const pw = popoverEl.offsetWidth  || 220;
    const ph = popoverEl.offsetHeight || 230;
    let left = sw.left;
    let top  = sw.bottom + 10;
    if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    if (top + ph > window.innerHeight - 10) top  = sw.top - ph - 10;
    popoverEl.style.left = `${Math.max(10, left)}px`;
    popoverEl.style.top  = `${Math.max(10, top)}px`;
}

function closePopover() {
    if (!popoverEl || !popoverEl.classList.contains('open')) return;
    popoverEl.classList.remove('open');
    if (pop.swatch) pop.swatch.classList.remove('cp-active');
    pop.swatch = null;
}

function buildPopover() {
    if (popoverBuilt) return;
    popoverBuilt = true;

    popoverEl = document.createElement('div');
    popoverEl.className = 'cp-popover';
    popoverEl.innerHTML = `
        <div class="cp-sv"><div class="cp-sv-thumb"></div></div>
        <div class="cp-hue"><div class="cp-hue-thumb"></div></div>
        <div class="cp-bottom-row">
            <div class="cp-preview"></div>
            <input class="cp-hex-input" maxlength="7" spellcheck="false" autocomplete="off" />
        </div>
    `;
    document.body.appendChild(popoverEl);

    svEl       = popoverEl.querySelector('.cp-sv');
    svThumb    = popoverEl.querySelector('.cp-sv-thumb');
    hueEl      = popoverEl.querySelector('.cp-hue');
    hueThumb   = popoverEl.querySelector('.cp-hue-thumb');
    previewEl  = popoverEl.querySelector('.cp-preview');
    hexFieldEl = popoverEl.querySelector('.cp-hex-input');

    popoverEl.addEventListener('pointerdown', e => e.stopPropagation());

    dragOn(svEl, (x, y) => { pop.s = x; pop.v = 1 - y; applyFromHsv(); });
    dragOn(hueEl, (x) => { pop.h = x * 360; applyFromHsv(); });

    hexFieldEl.addEventListener('input', () => {
        let v = hexFieldEl.value.replace(/[^0-9a-fA-F#]/g, '');
        if (!v.startsWith('#')) v = `#${v}`;
        v = `#${v.slice(1, 7)}`;
        if (hexFieldEl.value !== v) hexFieldEl.value = v;
        if (HEX_RE.test(v)) {
            const hsv = rgbToHsv(...Object.values(hexToRgb(v)));
            pop.h = hsv.h; pop.s = hsv.s; pop.v = hsv.v;
            renderThumbs();
            commit(v);
        }
    });
    hexFieldEl.addEventListener('focus', () => hexFieldEl.select());

    document.addEventListener('pointerdown', e => {
        if (popoverEl.classList.contains('open') && !popoverEl.contains(e.target) && e.target !== pop.swatch) {
            closePopover();
        }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopover(); });
    window.addEventListener('resize', closePopover);
    window.addEventListener('scroll', closePopover, true);
}

function openPopover(swatchEl, key) {
    buildPopover();
    const reopening = popoverEl.classList.contains('open') && pop.swatch === swatchEl;
    closePopover();
    if (reopening) return;

    const hex = swatchEl.value;
    const hsv = rgbToHsv(...Object.values(hexToRgb(hex)));
    pop.h = hsv.h; pop.s = hsv.s; pop.v = hsv.v;
    pop.swatch = swatchEl;

    swatchEl.classList.add('cp-active');
    hexFieldEl.value = hex;
    previewEl.style.backgroundColor = hex;
    renderThumbs();

    popoverEl.classList.add('open');
    positionPopover(swatchEl);
}

export function initColorPickers() {
    COLOR_PAIRS.forEach(([cid, hid, key]) => {
        try {
            const swatchEl = $(cid);
            const hexInput = $(hid);
            if (!swatchEl || !hexInput) {
                console.error(`[colorPickers] missing DOM element for "${key}" (swatch:#${cid} input:#${hid})`);
                return;
            }

            const current = normalizeHex(hexInput.value) || normalizeHex(S[key]) || '#000000';
            if (current !== hexInput.value) {
                console.warn(`[colorPickers] normalized malformed value for "${key}": "${hexInput.value}" -> "${current}"`);
            }
            S[key] = current;
            hexInput.value = current;

            const swatchBtn = document.createElement('button');
            swatchBtn.type = 'button';
            swatchBtn.id = cid;
            swatchBtn.className = swatchEl.className ? `${swatchEl.className} color-swatch-btn` : 'color-swatch-btn';
            swatchBtn.setAttribute('aria-label', key);
            swatchBtn.setAttribute('aria-haspopup', 'true');

            let value = current;
            Object.defineProperty(swatchBtn, 'value', {
                get: () => value,
                set: hex => {
                    const n = normalizeHex(hex);
                    if (!n) { console.warn(`[colorPickers] rejected invalid color "${hex}" for "${key}"`); return; }
                    value = n;
                    swatchBtn.style.backgroundColor = n;
                }
            });
            swatchBtn.value = current;

            swatchEl.replaceWith(swatchBtn);

            swatchBtn.addEventListener('click', e => {
                e.stopPropagation();
                openPopover(swatchBtn, key);
            });

            swatchBtn.addEventListener('input', () => {
                hexInput.value = swatchBtn.value;
                S[key] = swatchBtn.value;
            });

            hexInput.addEventListener('input', () => {
                if (!HEX_RE.test(hexInput.value)) return;
                S[key] = hexInput.value;
                swatchBtn.value = hexInput.value;
                if (pop.swatch === swatchBtn) {
                    const hsv = rgbToHsv(...Object.values(hexToRgb(hexInput.value)));
                    pop.h = hsv.h; pop.s = hsv.s; pop.v = hsv.v;
                    renderThumbs();
                    previewEl.style.backgroundColor = hexInput.value;
                }
            });

            pickrInstances[cid] = swatchBtn;

            requestAnimationFrame(() => resyncSwatch(swatchBtn, hexInput, key));
        } catch (err) {
            console.error(`[colorPickers] failed to init "${key}"`, err);
        }
    });
}

function resyncSwatch(swatchBtn, hexInput, key) {
    const normalized = normalizeHex(hexInput.value);
    if (!normalized || normalized === swatchBtn.value) return;
    hexInput.value = normalized;
    S[key] = normalized;
    swatchBtn.value = normalized;
}

export function resyncColorSwatches() {
    COLOR_PAIRS.forEach(([cid, hid, key]) => {
        const swatchBtn = pickrInstances[cid];
        const hexInput = $(hid);
        if (swatchBtn && hexInput) resyncSwatch(swatchBtn, hexInput, key);
    });
}


export function initFontUI() {
    const fileInput    = $('font-file-input');
    const uploadName   = $('font-upload-name');
    const btnUseLocal  = $('btn-use-local-font');
    const gfUrlInput   = $('gf-url-input');
    const gfNameInput  = $('gf-name-input');
    const btnUseGf     = $('btn-use-gf-font');

    let stagedFontDataUrl = null;
    let stagedFontMime    = 'font/woff2';

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadName.textContent = file.name;
        btnUseLocal.disabled = false;
        const ext = file.name.split('.').pop().toLowerCase();
        const mimeMap = { woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf' };
        stagedFontMime = mimeMap[ext] || 'font/woff2';
        const reader = new FileReader();
        reader.onload = e => { stagedFontDataUrl = e.target.result; };
        reader.readAsDataURL(file);
    });

    btnUseLocal.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file || !stagedFontDataUrl) return;
        const rawName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
        const familyName = 'mf-local-' + (rawName || 'CustomFont');
        let styleTag = document.getElementById('local-font-face');
        if (styleTag) styleTag.remove();
        styleTag = document.createElement('style');
        styleTag.id = 'local-font-face';
        document.head.appendChild(styleTag);
        styleTag.textContent = [
            `@font-face { font-family: '${familyName}'; src: url('${stagedFontDataUrl}'); }`,
            `#preview-container { --font-classy: '${familyName}'; }`
        ].join('\n');
        setActiveFont(familyName, file.name);
        setLocalFont(stagedFontDataUrl, stagedFontMime);
        const ff = new FontFace(familyName, `url('${stagedFontDataUrl}')`);
        ff.load().then(loaded => {
            document.fonts.add(loaded);
            switchTab('preview');
        }).catch(() => {
            switchTab('preview');
        });
    });

    btnUseGf.addEventListener('click', () => {
        const raw  = gfUrlInput.value.trim();
        const name = gfNameInput.value.trim();
        if (!raw || !name) {
            alert('Please enter both a Google Fonts URL and the font family name.');
            return;
        }
        let href = raw;
        const linkMatch   = raw.match(/href=["']([^"']+)["']/);
        const importMatch = raw.match(/@import\s+url\(['"]?([^'")\s]+)['"]?\)/);
        if (linkMatch)        href = linkMatch[1];
        else if (importMatch) href = importMatch[1];
        const existingLink = document.getElementById('gf-font-link');
        if (existingLink) existingLink.remove();
        const link = document.createElement('link');
        link.id   = 'gf-font-link';
        link.rel  = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        setGoogleFont(href);
        setActiveFont(name, name);
        gfNameInput.value = '';
        gfUrlInput.value  = '';
        link.onload  = () => switchTab('preview');
        link.onerror = () => switchTab('preview');
    });
}
