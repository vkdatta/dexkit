import { createDebugTool } from "./debug_v3.js";

const debugFn = createDebugTool();
if (debugFn) window.debug = debugFn;