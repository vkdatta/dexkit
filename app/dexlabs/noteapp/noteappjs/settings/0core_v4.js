import { createSettingsManager } from "./settings_v4.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
