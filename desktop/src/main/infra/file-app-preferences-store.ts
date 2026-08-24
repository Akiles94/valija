import { readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";
import { app } from "electron";
import type {
  AppPreferences,
  AppPreferencesStore,
} from "../application/ports/app-preferences.js";
import {
  DEFAULT_PREFERENCES,
} from "../application/ports/app-preferences.js";

export class FileAppPreferencesStore implements AppPreferencesStore {
  private filePath: string;

  constructor() {
    // app.setName("Valija") must be called before this
    const userData = app.getPath("userData");
    this.filePath = `${userData}/preferences.json`;
  }

  read(): AppPreferences {
    try {
      const content = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(content);

      // Only read the four permitted keys, drop anything else
      return {
        vaultPath: parsed.vaultPath ?? null,
        theme: parsed.theme ?? "system",
        language: parsed.language ?? "system",
        tourSeen: Boolean(parsed.tourSeen),
      };
    } catch {
      // File missing or corrupt → return defaults
      return DEFAULT_PREFERENCES;
    }
  }

  write(next: AppPreferences): void {
    // Atomic write: temp file + rename
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });

    const tmpPath = `${this.filePath}.tmp`;

    // Write only the four permitted keys
    const data = {
      vaultPath: next.vaultPath,
      theme: next.theme,
      language: next.language,
      tourSeen: next.tourSeen,
    };

    writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    writeFileSync(this.filePath, readFileSync(tmpPath, "utf-8"));
  }
}
