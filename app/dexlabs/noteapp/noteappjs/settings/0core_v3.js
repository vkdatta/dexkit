import { createSettingsManager } from "./settings_v3.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
