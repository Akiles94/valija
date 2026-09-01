import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type AppPreferences,
  type AppPreferencesStore,
  DEFAULT_PREFERENCES,
} from "../application/ports/app-preferences.js";

/**
 * A JSON file at `<userDataDir>/preferences.json` — `userDataDir` is injected
 * (the caller passes `app.getPath("userData")`), never imported, so this
 * adapter is testable against a temp directory with no Electron window
 * involved. A missing or corrupt file reads back as `DEFAULT_PREFERENCES` and
 * never throws: this file is read before the first window exists, so a parse
 * error must not be a failure to launch (mirrors `FileDeviceIdentity`'s own
 * tolerate-and-start-fresh discipline).
 */
export class FileAppPreferencesStore implements AppPreferencesStore {
  constructor(private readonly userDataDir: string) {}

  private get filePath(): string {
    return join(this.userDataDir, "preferences.json");
  }

  read(): AppPreferences {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<AppPreferences>;
      return {
        vaultPath: raw.vaultPath ?? DEFAULT_PREFERENCES.vaultPath,
        theme: raw.theme ?? DEFAULT_PREFERENCES.theme,
        language: raw.language ?? DEFAULT_PREFERENCES.language,
        tourSeen: raw.tourSeen ?? DEFAULT_PREFERENCES.tourSeen,
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  write(next: AppPreferences): void {
    // Exactly the four permitted keys, spelled out — an unknown key added by
    // hand to `next` is dropped rather than persisted, making §8.4's "exactly
    // four keys" criterion structural rather than a promise.
    const toWrite: AppPreferences = {
      vaultPath: next.vaultPath,
      theme: next.theme,
      language: next.language,
      tourSeen: next.tourSeen,
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(toWrite, null, 2), { mode: 0o600 });
    renameSync(tmp, this.filePath);
  }
}
