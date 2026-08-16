import { FONT_URL } from './config.js';

let localFontDataUrl = null;
let localFontMime    = 'font/woff2';
let gfFontCssUrl      = null;

let cachedFont      = null; 
let cachedGfFont     = null; 
let cachedGfFontFor  = null; 

export function setLocalFont(dataUrl, mime) {
    localFontDataUrl = dataUrl;
    localFontMime    = mime || 'font/woff2';
    gfFontCssUrl      = null;
}

export function setGoogleFont(cssUrl) {
    gfFontCssUrl      = cssUrl;
    localFontDataUrl = null;
}

export function resetFontSource() {
    localFontDataUrl = null;
    gfFontCssUrl      = null;
}

function arrayBufferToDataUrl(buf, mime) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${mime};base64,${btoa(bin)}`;
}

async function resolveGoogleFont(cssUrl) {
    const cssResp = await fetch(cssUrl);
    if (!cssResp.ok) throw new Error(`GF stylesheet fetch failed (${cssResp.status})`);
    const css = await cssResp.text();
    const blocks = css.match(/@font-face\s*{[^}]*}/g);
    if (!blocks || !blocks.length) throw new Error('No @font-face blocks in GF stylesheet');
    const rank = b => {
        const m = b.match(/unicode-range:\s*([^;]+);/i);
        if (!m) return 99;
        const ranges = m[1].toLowerCase();
        if (ranges.includes('u+0000-00ff') || ranges.includes('u+0-ff')) return 0;
        if (ranges.includes('latin-ext')) return 1;
        return 2;
    };
    const block = blocks.slice().sort((a, b) => rank(a) - rank(b))[0];
    const woff2Match = block.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/i);
    const anyUrlMatch = block.match(/url\(([^)]+)\)/i);
    const fontFileUrl = (woff2Match && woff2Match[1] || anyUrlMatch && anyUrlMatch[1] || '')
        .replace(/^["']|["']$/g, '');
    if (!fontFileUrl) throw new Error('No font src URL found in GF @font-face block');
    const fontResp = await fetch(fontFileUrl, { mode: 'cors' });
    if (!fontResp.ok) throw new Error(`GF font file fetch failed (${fontResp.status})`);
    const buf = await fontResp.arrayBuffer();
    const mime = fontFileUrl.includes('.woff2') ? 'font/woff2'
               : fontFileUrl.includes('.woff')  ? 'font/woff'
               : fontFileUrl.includes('.ttf')   ? 'font/ttf' : 'font/woff2';
    return arrayBufferToDataUrl(buf, mime);
}

export async function getFont() {
    if (localFontDataUrl) return localFontDataUrl;

    if (gfFontCssUrl) {
        if (cachedGfFont && cachedGfFontFor === gfFontCssUrl) return cachedGfFont;
        cachedGfFont = await resolveGoogleFont(gfFontCssUrl);
        cachedGfFontFor = gfFontCssUrl;
        return cachedGfFont;
    }

    if (cachedFont) return cachedFont;
    const r = await fetch(FONT_URL, { mode: 'cors' });
    if (!r.ok) throw new Error(`Classy font fetch failed (${r.status})`);
    const buf = await r.arrayBuffer();
    cachedFont = arrayBufferToDataUrl(buf, 'font/woff2');
    return cachedFont;
}
