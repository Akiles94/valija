import { describe, expect, it } from "vitest";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import { mergePreferencesWrite, tourSeenWrite } from "./preferences-write.js";

const PREFS: AppPreferencesMessage = {
  vaultPath: "/some/vault",
  theme: "dark",
  language: "es",
  tourSeen: false,
  autoLockMinutes: 15,
};

describe("mergePreferencesWrite", () => {
  it("drops vaultPath and preserves every field the patch doesn't touch", () => {
    expect(mergePreferencesWrite(PREFS, { theme: "light" })).toEqual({
      theme: "light",
      language: "es",
      tourSeen: false,
      autoLockMinutes: 15,
    });
  });

  it("an empty patch round-trips the four writable fields unchanged", () => {
    expect(mergePreferencesWrite(PREFS, {})).toEqual({
      theme: "dark",
      language: "es",
      tourSeen: false,
      autoLockMinutes: 15,
    });
  });

  it("switching language leaves theme and tourSeen untouched — the mechanism item 90's live-switch criterion depends on", () => {
    expect(mergePreferencesWrite(PREFS, { language: "en" })).toEqual({
      theme: "dark",
      language: "en",
      tourSeen: false,
      autoLockMinutes: 15,
    });
  });

  it("carries a chosen autoLockMinutes through the merge, including disabled (null)", () => {
    expect(mergePreferencesWrite(PREFS, { autoLockMinutes: null })).toEqual({
      theme: "dark",
      language: "es",
      tourSeen: false,
      autoLockMinutes: null,
    });
  });
});

describe("tourSeenWrite", () => {
  it("sets tourSeen true and preserves theme/language/autoLockMinutes, via markTourSeen", () => {
    expect(tourSeenWrite(PREFS)).toEqual({
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
  });

  it("is idempotent when tourSeen is already true", () => {
    const alreadySeen = { ...PREFS, tourSeen: true };
    expect(tourSeenWrite(alreadySeen)).toEqual({
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
  });
});
