import { DEFAULTS, COLOR_PAIRS, $ } from './config.js';
import { pickrInstances } from './ui.js';

export const S = { ...DEFAULTS };

export function syncUI() {
    COLOR_PAIRS.forEach(([cid, hid, key]) => {
        const colorInput = pickrInstances[cid];
        if (colorInput) colorInput.value = S[key];
        $(hid).value = S[key];
    });
    $('s-font-size').value = S.fontSize;
}

export function readUI() {
    COLOR_PAIRS.forEach(([cid, hid, key]) => { S[key] = $(hid).value; });
    S.fontSize = parseInt($('s-font-size').value, 10) || DEFAULTS.fontSize;
}

export function resetState() {
    Object.assign(S, DEFAULTS);
}
