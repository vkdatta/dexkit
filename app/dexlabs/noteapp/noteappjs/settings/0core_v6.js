import { createSettingsManager } from "./settings_v7.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
