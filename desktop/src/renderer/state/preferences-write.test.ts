import { describe, expect, it } from "vitest";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import { mergePreferencesWrite, tourSeenWrite } from "./preferences-write.js";

const PREFS: AppPreferencesMessage = {
  vaultPath: "/some/vault",
  theme: "dark",
  language: "es",
  tourSeen: false,
};

describe("mergePreferencesWrite", () => {
  it("drops vaultPath and preserves every field the patch doesn't touch", () => {
    expect(mergePreferencesWrite(PREFS, { theme: "light" })).toEqual({
      theme: "light",
      language: "es",
      tourSeen: false,
    });
  });

  it("an empty patch round-trips the three writable fields unchanged", () => {
    expect(mergePreferencesWrite(PREFS, {})).toEqual({
      theme: "dark",
      language: "es",
      tourSeen: false,
    });
  });

  it("switching language leaves theme and tourSeen untouched — the mechanism item 90's live-switch criterion depends on", () => {
    expect(mergePreferencesWrite(PREFS, { language: "en" })).toEqual({
      theme: "dark",
      language: "en",
      tourSeen: false,
    });
  });
});

describe("tourSeenWrite", () => {
  it("sets tourSeen true and preserves theme/language, via markTourSeen", () => {
    expect(tourSeenWrite(PREFS)).toEqual({ theme: "dark", language: "es", tourSeen: true });
  });

  it("is idempotent when tourSeen is already true", () => {
    const alreadySeen = { ...PREFS, tourSeen: true };
    expect(tourSeenWrite(alreadySeen)).toEqual({ theme: "dark", language: "es", tourSeen: true });
  });
});
