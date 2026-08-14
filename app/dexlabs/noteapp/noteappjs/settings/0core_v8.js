import { createSettingsManager } from "./settings_v10.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
