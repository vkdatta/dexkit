// Register the Settings manager on window so sidebar2's non-collapse item
// (which uses `onclick='openSettingsManager()'`) can invoke it.
import { createSettingsManager } from "./settings1.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
