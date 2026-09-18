import { shouldPlayTour } from "../../main/application/policies/onboarding-tour.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import type { SessionState } from "./session-state.js";

/** The two screens with no CLI counterpart, held above the phase switch (P-D15) — neither is a `WorkspaceView` screen, because Settings must open while the vault is locked. */
export type Overlay = "tour" | "settings" | null;

export interface OverlayState {
  overlay: Overlay;
  /** Where a finished tour returns to: the workspace (`null`) when it auto-played, Settings when replayed from there — criterion 2/6's "returns the user to where the tour interrupted them." */
  returnTo: Overlay;
}

export const CLOSED_OVERLAY: OverlayState = { overlay: null, returnTo: null };

/**
 * D-U(a) Option 2: the tour plays the first time this installation reaches
 * the dashboard, on either branch of the entry screen — driven entirely by
 * the persisted flag, never by which branch was taken. Never interrupts an
 * overlay already open, so it can't steal focus from a Settings screen
 * opened before this unlock.
 */
export function autoTourOverlay(
  current: OverlayState,
  state: SessionState,
  preferences: AppPreferencesMessage,
): OverlayState {
  if (current.overlay !== null) return current;
  if (state.phase !== "unlocked" || !shouldPlayTour(preferences)) return current;
  return { overlay: "tour", returnTo: null };
}

export function openSettings(): OverlayState {
  return { overlay: "settings", returnTo: null };
}

/** Replaying from Settings (item 90's "replay") lands the user back there when the tour finishes — unlike the auto-played tour, which returns to the workspace. */
export function replayTourFromSettings(): OverlayState {
  return { overlay: "tour", returnTo: "settings" };
}

/** Skip and "Get started" both call this — D-U(b)'s rider: both mark the tour seen, so neither is distinguished here. */
export function finishTourOverlay(current: OverlayState): OverlayState {
  return { overlay: current.returnTo, returnTo: null };
}

export function closeOverlay(): OverlayState {
  return CLOSED_OVERLAY;
}
