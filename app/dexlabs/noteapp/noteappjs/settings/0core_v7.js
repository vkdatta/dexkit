import { createSettingsManager } from "./settings_v9.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
