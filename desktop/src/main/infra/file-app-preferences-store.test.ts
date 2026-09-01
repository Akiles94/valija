import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppPreferences, DEFAULT_PREFERENCES } from "../application/ports/app-preferences.js";
import { FileAppPreferencesStore } from "./file-app-preferences-store.js";

describe("FileAppPreferencesStore", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "valija-prefs-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns DEFAULT_PREFERENCES when no file exists yet", () => {
    const store = new FileAppPreferencesStore(dir);
    expect(store.read()).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns DEFAULT_PREFERENCES for a corrupt file, and never throws", () => {
    writeFileSync(join(dir, "preferences.json"), "{ not valid json");
    const store = new FileAppPreferencesStore(dir);
    expect(() => store.read()).not.toThrow();
    expect(store.read()).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips a write through read with exactly the four keys", () => {
    const store = new FileAppPreferencesStore(dir);
    const written = {
      vaultPath: "/Users/oscar/Dropbox/valija",
      theme: "dark" as const,
      language: "es" as const,
      tourSeen: true,
    };
    store.write(written);
    expect(store.read()).toEqual(written);
  });

  it("drops an unknown key added by hand rather than persisting it", () => {
    const store = new FileAppPreferencesStore(dir);
    store.write({
      ...DEFAULT_PREFERENCES,
      lastProjectViewed: "alpha",
    } as AppPreferences);
    const onDisk = JSON.parse(readFileSync(join(dir, "preferences.json"), "utf8"));
    expect(Object.keys(onDisk).sort()).toEqual(["language", "theme", "tourSeen", "vaultPath"]);
  });

  it("write is atomic: no .tmp file survives, and the real file always parses", () => {
    const store = new FileAppPreferencesStore(dir);
    store.write({ ...DEFAULT_PREFERENCES, tourSeen: true });
    const files = readdirSync(dir);
    expect(files).toEqual(["preferences.json"]);
    expect(() => JSON.parse(readFileSync(join(dir, "preferences.json"), "utf8"))).not.toThrow();
  });
});
