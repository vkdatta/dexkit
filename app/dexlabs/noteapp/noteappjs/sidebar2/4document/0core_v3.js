import { handleRename, handleRenameSubmit } from "./rename_v3.js";
import { handleDownload, handleDownloadSubmit } from "./download_v3.js";
import { handleOpenFile } from "./open_v3.js";
import { toggleFullscreen } from "./fullscreen_v3.js";
import { increaseFontSize, decreaseFontSize } from "./fontsize_v3.js";
import { createDebugTool } from "./debug_v3.js";

window.handleRename = handleRename;
window.handleRenameSubmit = handleRenameSubmit;

window.handleDownload = handleDownload;
window.handleDownloadSubmit = handleDownloadSubmit;

window.handleOpenFile = handleOpenFile;

window.toggleFullscreen = toggleFullscreen;

window.increaseFontSize = increaseFontSize;
window.decreaseFontSize = decreaseFontSize;

const debugFn = createDebugTool();
if (debugFn) window.debug = debugFn;
