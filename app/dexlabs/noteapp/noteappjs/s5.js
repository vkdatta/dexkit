import { createSettingsManager } from "./settings5.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
