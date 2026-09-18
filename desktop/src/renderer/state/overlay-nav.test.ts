import { describe, expect, it } from "vitest";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import {
  autoTourOverlay,
  CLOSED_OVERLAY,
  closeOverlay,
  finishTourOverlay,
  type OverlayState,
  openSettings,
  replayTourFromSettings,
} from "./overlay-nav.js";
import type { SessionState } from "./session-state.js";

const PREFS = (tourSeen: boolean): AppPreferencesMessage => ({
  vaultPath: null,
  theme: "system",
  language: "system",
  tourSeen,
});

const LOCKED: SessionState = { phase: "locked" };
const UNLOCKED: SessionState = { phase: "unlocked" };

describe("autoTourOverlay — item 90's first missing test", () => {
  it("does not play while locked, even with tourSeen false", () => {
    expect(autoTourOverlay(CLOSED_OVERLAY, LOCKED, PREFS(false))).toEqual(CLOSED_OVERLAY);
  });

  it("plays once unlocked, driven by the persisted flag alone — the same result on both entry branches, since neither is a parameter here", () => {
    const result = autoTourOverlay(CLOSED_OVERLAY, UNLOCKED, PREFS(false));
    expect(result).toEqual({ overlay: "tour", returnTo: null });
  });

  it("does not play again once the flag is set", () => {
    expect(autoTourOverlay(CLOSED_OVERLAY, UNLOCKED, PREFS(true))).toEqual(CLOSED_OVERLAY);
  });

  it("does not interrupt an overlay already open", () => {
    const settingsOpen: OverlayState = { overlay: "settings", returnTo: null };
    expect(autoTourOverlay(settingsOpen, UNLOCKED, PREFS(false))).toEqual(settingsOpen);
  });
});

describe("finishTourOverlay — item 90's second and third missing tests (Skip/replay)", () => {
  it("Skip and Get started return the user to the workspace after an auto-played tour", () => {
    const playing = autoTourOverlay(CLOSED_OVERLAY, UNLOCKED, PREFS(false));
    expect(finishTourOverlay(playing)).toEqual(CLOSED_OVERLAY);
  });

  it("a replay from Settings returns the user to Settings, not the workspace", () => {
    const fromSettings = openSettings();
    const replaying = replayTourFromSettings();
    expect(finishTourOverlay(replaying)).toEqual(fromSettings);
  });
});

describe("openSettings / closeOverlay", () => {
  it("openSettings never carries a returnTo — Settings is not reached via the tour", () => {
    expect(openSettings()).toEqual({ overlay: "settings", returnTo: null });
  });

  it("closeOverlay always returns to the closed state, regardless of how it was reached", () => {
    expect(closeOverlay()).toEqual(CLOSED_OVERLAY);
    expect(closeOverlay()).toEqual(closeOverlay());
  });
});
