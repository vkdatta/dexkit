import { createSettingsManager } from "./settings_v12.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
