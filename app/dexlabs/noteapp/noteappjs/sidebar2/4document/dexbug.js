import { createDebugTool } from "./debug.js";

const debugFn = createDebugTool();
if (debugFn) window.debug = debugFn;