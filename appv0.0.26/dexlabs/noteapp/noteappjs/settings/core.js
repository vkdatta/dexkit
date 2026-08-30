import { createSettingsManager } from "./settings.js";

const openSettings = createSettingsManager();
if (openSettings) window.openSettingsManager = openSettings;
