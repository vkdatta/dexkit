import { createSettingsManager } from "./settings_v13.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
