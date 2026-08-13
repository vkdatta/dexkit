import { createSettingsManager } from "./settings_v2.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
