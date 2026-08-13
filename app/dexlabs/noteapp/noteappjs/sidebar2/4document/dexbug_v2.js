import { createDebugTool } from "./debug_v2.js";

const debugFn = createDebugTool();
if (debugFn) window.debug = debugFn;