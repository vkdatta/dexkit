import './config.js';
import { initColorPickers, initFontUI } from './ui.js';
import { syncUI } from './state.js';
import { initMermaid, setPreviewBackground } from './diagram.js';
import './fonts.js';

window.dexMermaidInitColorPickers = initColorPickers;
window.dexMermaidInitFontUI = initFontUI;
window.dexMermaidSyncUI = syncUI;
window.dexMermaidInitMermaid = initMermaid;
window.dexMermaidSetPreviewBackground = setPreviewBackground;

import './mode.js';
