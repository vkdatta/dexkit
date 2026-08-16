import { $ } from './config.js';
import { S } from './state.js';
import { getFont } from './fonts.js';

const previewContainer = $('preview-container');
const previewStage      = $('preview-stage');
const previewEmpty      = $('preview-empty');
const btnDownload       = $('btn-download');
const btnResetView      = $('btn-reset-view');
const zoomInBtn         = $('zoom-in');
const zoomOutBtn        = $('zoom-out');


let needsReinit = true;
export function markNeedsReinit() { needsReinit = true; }

export function initMermaid() {
    if (mermaid.mermaidAPI && mermaid.mermaidAPI.reset) mermaid.mermaidAPI.reset();
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        fontFamily: S.font,
        themeVariables: {
            darkMode:             true,
            background:           S.bg,
            mainBkg:              S.node1,
            nodeBorder:           S.border1,
            clusterBkg:           S.node2,
            clusterBorder:        S.border2,
            primaryColor:         S.node1,
            primaryBorderColor:   S.border1,
            primaryTextColor:     S.text,
            secondaryColor:       S.node2,
            secondaryBorderColor: S.border2,
            secondaryTextColor:   S.text,
            tertiaryColor:        S.node3,
            tertiaryBorderColor:  S.border3,
            tertiaryTextColor:    S.text,
            lineColor:            S.line,
            edgeLabelBackground:  S.bg,
            textColor:            S.text,
            nodeTextColor:        S.text,
            labelTextColor:       S.text,
            fontSize:             S.fontSize + 'px',
            fontFamily:           S.font,
            edgeColor:            S.line,
            titleColor:           S.text,
        },
        flowchart: {
            useMaxWidth:  false,
            htmlLabels:   false,
            curve:        'basis',
            padding:      20,
            nodeSpacing:  50,
            rankSpacing:  60,
        },
        sequence: { useMaxWidth:false, wrap:true, mirrorActors:false },
    });
}

function patchSvg(svg) {
    svg.style.background = 'transparent';
    const svgId = svg.getAttribute('id') || 'mf';
    const mermaidStyle = svg.querySelector('style');
    if (mermaidStyle) {
        let css = mermaidStyle.textContent;
        css += `
#preview-container #${svgId} { font-family: '${S.font}' !important; }
#preview-container #${svgId} text, #preview-container #${svgId} tspan,
#preview-container #${svgId} span, #preview-container #${svgId} .label,
#preview-container #${svgId} p, #preview-container #${svgId} div { font-family: '${S.font}' !important; }
#preview-container #${svgId} svg { font-family: '${S.font}' !important; }`;
        mermaidStyle.textContent = css;
    }
    const old = svg.querySelector('#mf-style');
    if (old) old.remove();
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.id = 'mf-style';
    st.textContent = `
        #${svgId} .node rect, #${svgId} .node circle,
        #${svgId} .node ellipse, #${svgId} .node polygon {
            fill:   ${S.node1}   !important;
            stroke: ${S.border1} !important;
            stroke-width: 1.5px  !important;
        }
        #${svgId} .node .label-container,
        #${svgId} g.node > path {
            fill:   ${S.node1}   !important;
            stroke: ${S.border1} !important;
        }
        #${svgId} .node .label, #${svgId} .node text, #${svgId} .node tspan,
        #${svgId} .nodeLabel, #${svgId} .nodeLabel text, #${svgId} .nodeLabel tspan,
        #${svgId} g.node > text {
            fill: ${S.text} !important;
        }
        #${svgId} .node .label span,
        #${svgId} .nodeLabel span { color: ${S.text} !important; }
        #${svgId} .edgePath path, #${svgId} .flowchart-link {
            stroke: ${S.line} !important;
            fill: none !important;
        }
        #${svgId} .arrowheadPath, #${svgId} marker path {
            fill:   ${S.line} !important;
            stroke: none     !important;
        }
        #${svgId} .edgeLabel rect, #${svgId} .edgeLabel foreignObject div,
        #${svgId} .edgeLabel p {
            background: ${S.bg}  !important;
            fill:        ${S.bg} !important;
            color:       ${S.edgeText} !important;
        }
        #${svgId} .edgeLabel text, #${svgId} .edgeLabel tspan,
        #${svgId} .edgeLabel span {
            fill:  ${S.edgeText} !important;
            color: ${S.edgeText} !important;
        }
        #${svgId} .cluster rect {
            fill:   ${S.node2}   !important;
            stroke: ${S.border2} !important;
        }
        #${svgId} .cluster text, #${svgId} .cluster tspan,
        #${svgId} .cluster span { fill: ${S.text} !important; color: ${S.text} !important; }
        #${svgId} svg > rect:first-of-type { fill: transparent !important; }
    `;
    svg.insertBefore(st, svg.firstChild);
    previewContainer.style.background = S.bg;
}

export function setPreviewBackground() {
    previewContainer.style.background = S.bg;
}


let px = 0, py = 0, sc = 1;
let isDragging = false, lx = 0, ly = 0;

function applyT() {
    previewStage.style.transform = `translate(${px}px,${py}px) scale(${sc})`;
}

export function centerDiagram() {
    const svg = previewStage.querySelector('svg');
    if (!svg) { px=0; py=0; sc=1; applyT(); return; }
    let sw = 600, sh = 400;
    const vb = svg.getAttribute('viewBox');
    if (vb) {
        const p = vb.trim().split(/[\s,]+/);
        if (p.length >= 4) { sw = parseFloat(p[2]) || sw; sh = parseFloat(p[3]) || sh; }
    } else {
        sw = parseFloat(svg.getAttribute('width'))  || sw;
        sh = parseFloat(svg.getAttribute('height')) || sh;
    }
    const cw = previewContainer.clientWidth  || 800;
    const ch = previewContainer.clientHeight || 500;
    sc = Math.min(cw / sw, ch / sh, 1.6) * 0.85;
    px = (cw - sw * sc) / 2;
    py = (ch - sh * sc) / 2;
    applyT();
}

previewContainer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isDragging = true; lx = e.clientX; ly = e.clientY;
    previewContainer.classList.add('panning');
});
window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    px += e.clientX - lx; py += e.clientY - ly;
    lx = e.clientX; ly = e.clientY; applyT();
});
window.addEventListener('mouseup', () => {
    isDragging = false; previewContainer.classList.remove('panning');
});

let lastTouch = null;
previewContainer.addEventListener('touchstart', e => {
    if (e.touches.length === 1) lastTouch = {x:e.touches[0].clientX, y:e.touches[0].clientY};
}, {passive:true});
previewContainer.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && lastTouch) {
        px += e.touches[0].clientX - lastTouch.x;
        py += e.touches[0].clientY - lastTouch.y;
        lastTouch = {x:e.touches[0].clientX, y:e.touches[0].clientY};
        applyT();
    }
}, {passive:true});
previewContainer.addEventListener('touchend', () => { lastTouch = null; });

previewContainer.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = previewContainer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const ns = Math.min(Math.max(sc * factor, 0.1), 10);
    px = mx - (mx - px) * (ns / sc);
    py = my - (my - py) * (ns / sc);
    sc = ns; applyT();
}, {passive:false});

function zoom(factor) {
    const cx = previewContainer.clientWidth  / 2;
    const cy = previewContainer.clientHeight / 2;
    const ns = Math.min(Math.max(sc * factor, 0.1), 10);
    px = cx - (cx - px) * (ns / sc);
    py = cy - (cy - py) * (ns / sc);
    sc = ns; applyT();
}
zoomInBtn .addEventListener('click', () => zoom(1.25));
zoomOutBtn.addEventListener('click', () => zoom(0.8));
btnResetView.addEventListener('click', centerDiagram);


let renderSeq = 0;

function removeLeakedMermaidNode(id) {
    [id, 'd' + id].forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.remove();
    });
}

function escHtml(s) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(s)); return d.innerHTML;
}

function cleanErrorMessage(raw) {
    let msg = (raw || '').replace(/^Error:\s*/i, '').trim();
    msg = msg.replace(/\s*for text:[\s\S]*$/i, '').trim();
    const MAX = 300;
    if (msg.length > MAX) msg = msg.slice(0, MAX).trim() + '…';
    return msg;
}

export async function renderDiagram(code) {
    const seq = ++renderSeq;
    const prevErr = previewContainer.querySelector('.preview-error');
    if (prevErr) prevErr.remove();
    const trimmed = (code || '').trim();
    if (!trimmed) {
        previewStage.innerHTML = '';
        previewEmpty.style.display = '';
        btnDownload.disabled = true;
        return;
    }
    if (needsReinit) { initMermaid(); needsReinit = false; }
    const id = 'mf-' + seq;
    try {
        const { svg: svgStr } = await mermaid.render(id, trimmed);
        if (seq !== renderSeq) return;
        removeLeakedMermaidNode(id);
        document.querySelectorAll('head style[id^="mermaid-"]').forEach(s => s.remove());
        previewEmpty.style.display = 'none';
        previewStage.style.visibility = 'hidden';
        previewStage.innerHTML = svgStr;
        const svgEl = previewStage.querySelector('svg');
        if (svgEl) patchSvg(svgEl);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (seq === renderSeq) centerDiagram();
            previewStage.style.visibility = '';
        }));
        btnDownload.disabled = false;
    } catch (err) {
        if (seq !== renderSeq) return;
        removeLeakedMermaidNode(id);
        previewStage.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'preview-error';
        div.innerHTML = `<strong>⚠ Syntax Error</strong><br><br>${escHtml(
            cleanErrorMessage(err.message || String(err))
        )}<br><br><small style="opacity:.65">Check your Mermaid syntax and try again.</small>`;
        previewContainer.appendChild(div);
        btnDownload.disabled = true;
    }
}

export function clearPreview() {
    previewStage.innerHTML = '';
    const e = previewContainer.querySelector('.preview-error');
    if (e) e.remove();
    previewEmpty.style.display = '';
    btnDownload.disabled = true;
}


btnDownload.addEventListener('click', async () => {
    const svgEl = previewStage.querySelector('svg');
    if (!svgEl) return;
    const origText = btnDownload.textContent;
    btnDownload.disabled = true; btnDownload.textContent = '⏳ Exporting…';
    try {
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
        let W = 900, H = 600;
        const vb = clone.getAttribute('viewBox');
        if (vb) {
            const p = vb.trim().split(/[\s,]+/);
            if (p.length >= 4) { W = parseFloat(p[2])||W; H = parseFloat(p[3])||H; }
        } else {
            W = parseFloat(clone.getAttribute('width'))  || W;
            H = parseFloat(clone.getAttribute('height')) || H;
        }
        const MAX_DIM  = 16000;
        const MAX_AREA = 16_000_000;
        let SCALE = Math.min(3, MAX_DIM / W, MAX_DIM / H, Math.sqrt(MAX_AREA / (W * H)));
        SCALE = Math.max(SCALE, 1);
        clone.setAttribute('width',  W * SCALE);
        clone.setAttribute('height', H * SCALE);
        const fontUri = await getFont();
        const svgId = clone.getAttribute('id') || 'mf';
        let fmt = 'woff2';
        const mermaidStyle = clone.querySelector('style');
        if (mermaidStyle) {
            let css = mermaidStyle.textContent;
            if (fontUri) {
                const fmtMatch = fontUri.match(/^data:font\/(\w+);/);
                fmt = fmtMatch
                    ? ({woff2:'woff2', woff:'woff', ttf:'truetype', otf:'opentype'}[fmtMatch[1]] || 'woff2')
                    : 'woff2';
                css = `@font-face{font-family:'${S.font}';src:url('${fontUri}') format('${fmt}');}\n` + css;
            }
            css += `\n#${svgId}{font-family:'${S.font}'!important;}
#${svgId} text,#${svgId} tspan,#${svgId} span,#${svgId} .label,
#${svgId} p,#${svgId} div{font-family:'${S.font}'!important;}`;
            mermaidStyle.textContent = css;
        }
        let defs = clone.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            clone.insertBefore(defs, clone.firstChild);
        }
        if (fontUri) {
            const fontDefStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            fontDefStyle.id = 'mf-font-face';
            fontDefStyle.textContent = `@font-face{font-family:'${S.font}';src:url('${fontUri}') format('${fmt}');}`;
            defs.appendChild(fontDefStyle);
        }
        const old = clone.querySelector('#mf-style'); if (old) old.remove();
        const st = document.createElementNS('http://www.w3.org/2000/svg','style');
        st.id = 'mf-style';
        st.textContent = `
            #${svgId} .node rect,#${svgId} .node circle,#${svgId} .node ellipse,#${svgId} .node polygon,#${svgId} .node path{fill:${S.node1}!important;stroke:${S.border1}!important;}
            #${svgId} .node .label-container,#${svgId} g.node > path{fill:${S.node1}!important;stroke:${S.border1}!important;}
            #${svgId} .node .label,#${svgId} .node text,#${svgId} .nodeLabel,#${svgId} .nodeLabel text{fill:${S.text}!important;}
            #${svgId} .node .label span,#${svgId} .nodeLabel span{color:${S.text}!important;}
            #${svgId} .edgePath path,#${svgId} .flowchart-link{stroke:${S.line}!important;fill:none;}
            #${svgId} .arrowheadPath{fill:${S.line}!important;stroke:none!important;}
            #${svgId} .edgeLabel rect,#${svgId} .edgeLabel p{fill:${S.bg}!important;background:${S.bg}!important;}
            #${svgId} .edgeLabel text,#${svgId} .edgeLabel tspan,#${svgId} .edgeLabel span{fill:${S.edgeText}!important;color:${S.edgeText}!important;}
            #${svgId} .cluster rect{fill:${S.node2}!important;stroke:${S.border2}!important;}
            #${svgId} svg > rect:first-of-type{fill:transparent!important;}
        `;
        defs.appendChild(st);
        let svgStr = new XMLSerializer().serializeToString(clone);
        if (!svgStr.startsWith('<?xml')) svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgStr;
        const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
        const canvas = document.createElement('canvas');
        canvas.width = W * SCALE; canvas.height = H * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = S.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
        await new Promise((res,rej) => {
            const img = new Image();
            img.onload = () => { ctx.drawImage(img,0,0); res(); };
            img.onerror = () => { rej(new Error(`SVG→Canvas failed (${canvas.width}×${canvas.height}px)`)); };
            img.src = url;
        });
        const png = await new Promise((res,rej) =>
            canvas.toBlob(b => b ? res(b) : rej(new Error(
                `toBlob failed — canvas ${canvas.width}×${canvas.height}px may exceed this browser's limits`
            )), 'image/png'));
        const dlUrl = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = dlUrl; a.download = `mermaid-flow-${Date.now()}.png`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(dlUrl);
    } catch(e) { alert('Export error: ' + e.message); }
    finally { btnDownload.textContent = origText; btnDownload.disabled = false; }
});
