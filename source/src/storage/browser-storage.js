import { parseSaveJson, validateSaveData } from "../state/save-schema.js";
import { migrateSaveData } from "../state/migrations.js";

const SAVE_KEY = "crazytide.save.v2";
const LEGACY_SAVE_KEY = "crazytide.save.v1";
const SETTINGS_KEY = "crazytide.settings.v1";

export class BrowserStorageAdapter {
  load() {
    const rawSave =
      localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    if (!rawSave) return null;

    try {
      const state = migrateSaveData(JSON.parse(rawSave));
      const validation = validateSaveData(state);
      if (!validation.valid) throw new Error(validation.error);
      if (!localStorage.getItem(SAVE_KEY)) this.save(state);
      return state;
    } catch {
      this.backup(rawSave, "corrupt");
      return null;
    }
  }

  save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  export(state) {
    return JSON.stringify(state, null, 2);
  }

  import(jsonText) {
    return parseSaveJson(jsonText);
  }

  backup(rawSave, reason = "manual") {
    const backupKey = `${SAVE_KEY}.backup.${reason}.${Date.now()}`;
    localStorage.setItem(backupKey, rawSave);
    return backupKey;
  }

  loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
    } catch {
      return {};
    }
  }

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}
