import { createSettingsManager } from "./settings_v11.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
