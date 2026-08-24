import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { FileAppPreferencesStore } from "./file-app-preferences-store.js";
import type { AppPreferences } from "../application/ports/app-preferences.js";

describe("FileAppPreferencesStore", () => {
  let tempDir: string;
  let store: FileAppPreferencesStore;

  beforeEach(() => {
    // Mock app.getPath for testing
    tempDir = join(tmpdir(), `valija-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    vi.mock("electron", () => ({
      app: {
        getPath: (type: string) => (type === "userData" ? tempDir : ""),
      },
    }));
  });

  afterEach(() => {
    vi.unmock("electron");
  });

  it("returns default preferences when file is missing", () => {
    const store = new FileAppPreferencesStore();
    const prefs = store.read();

    expect(prefs).toEqual({
      vaultPath: null,
      theme: "system",
      language: "system",
      tourSeen: false,
    });
  });

  it("reads and writes preferences correctly", () => {
    const store = new FileAppPreferencesStore();

    const prefs: AppPreferences = {
      vaultPath: "/my/vault",
      theme: "dark",
      language: "es",
      tourSeen: true,
    };

    store.write(prefs);
    const read = store.read();

    expect(read).toEqual(prefs);
  });

  it("persists only the four permitted keys", () => {
    const store = new FileAppPreferencesStore();

    const prefs: AppPreferences = {
      vaultPath: "/my/vault",
      theme: "dark",
      language: "es",
      tourSeen: true,
    };

    store.write(prefs);

    // Read the file directly to verify only four keys exist
    const filePath = join(tempDir, "preferences.json");
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    const keys = Object.keys(data).sort();
    expect(keys).toEqual([
      "language",
      "theme",
      "tourSeen",
      "vaultPath",
    ]);
  });

  it("drops unknown keys when writing", () => {
    const store = new FileAppPreferencesStore();

    // Try to write a preferences object with extra keys
    const prefs = {
      vaultPath: "/my/vault",
      theme: "dark",
      language: "es",
      tourSeen: true,
      extraKey: "should be dropped",
    } as any;

    store.write(prefs);

    const filePath = join(tempDir, "preferences.json");
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    expect(data.extraKey).toBeUndefined();
  });

  it("handles corrupt file by returning defaults", () => {
    const filePath = join(tempDir, "preferences.json");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filePath, "{ invalid json");

    const store = new FileAppPreferencesStore();
    const prefs = store.read();

    expect(prefs).toEqual({
      vaultPath: null,
      theme: "system",
      language: "system",
      tourSeen: false,
    });
  });

  it("returns null for missing vaultPath", () => {
    const store = new FileAppPreferencesStore();

    const prefs: AppPreferences = {
      vaultPath: null,
      theme: "light",
      language: "en",
      tourSeen: false,
    };

    store.write(prefs);
    const read = store.read();

    expect(read.vaultPath).toBeNull();
  });

  it("preserves tourSeen across write-read cycles", () => {
    const store = new FileAppPreferencesStore();

    // First write
    store.write({
      vaultPath: null,
      theme: "system",
      language: "system",
      tourSeen: true,
    });

    // Second read should have tourSeen = true
    const read = store.read();
    expect(read.tourSeen).toBe(true);

    // Write again
    store.write(read);
    const read2 = store.read();
    expect(read2.tourSeen).toBe(true);
  });
});
