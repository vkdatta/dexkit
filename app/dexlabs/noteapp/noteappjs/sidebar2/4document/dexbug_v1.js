import { createDebugTool } from "./debug_v1.js";

const debugFn = createDebugTool();
if (debugFn) window.debug = debugFn;