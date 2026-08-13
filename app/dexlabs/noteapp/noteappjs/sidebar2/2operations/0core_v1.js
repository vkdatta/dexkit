import { handlePattern, handlePatternSubmit } from "./pattern_v1.js";
import { handleAdd, handleAddSubmit } from "./add_v1.js";
import { handleCleanupText, handleCleanupSubmit } from "./cleanup_v1.js";
import { openfindbackdrop, createFindAndReplace } from "./find_v1.js";

window.handlePattern = handlePattern;
window.handlePatternSubmit = handlePatternSubmit;
window.handleAdd = handleAdd;
window.handleAddSubmit = handleAddSubmit;
window.handleCleanupText = handleCleanupText;
window.handleCleanupSubmit = handleCleanupSubmit;
window.openfindbackdrop = openfindbackdrop;
window.findandreplace = createFindAndReplace();
