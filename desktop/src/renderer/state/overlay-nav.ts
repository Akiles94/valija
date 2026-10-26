import { shouldPlayTour } from "../../main/application/policies/onboarding-tour.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import type { SessionState } from "./session-state.js";

/**
 * Screens held above the phase switch (P-D15) — none is a `WorkspaceView` screen, because each must
 * open while the vault is locked. REKEY's change-passphrase dialog joins them: it works locked and
 * unlocked, and Settings itself must stay bridge-free (P-13).
 */
export type Overlay = "tour" | "settings" | "change-passphrase" | null;

/** Which overlay is open, and where it returns when closed. */
export interface OverlayState {
  overlay: Overlay;
  /** Where a finished tour returns to: the workspace (`null`) when it auto-played, Settings when replayed from there — criterion 2/6's "returns the user to where the tour interrupted them." */
  returnTo: Overlay;
}

/** No overlay open. */
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

/** Opens the Settings overlay (it also works while the vault is locked). */
export function openSettings(): OverlayState {
  return { overlay: "settings", returnTo: null };
}

/** Opens the change-passphrase dialog from Settings (it works locked and unlocked; it always asks for the current credential). */
export function openChangePassphrase(): OverlayState {
  return { overlay: "change-passphrase", returnTo: null };
}

/** Replaying from Settings (item 90's "replay") lands the user back there when the tour finishes — unlike the auto-played tour, which returns to the workspace. */
export function replayTourFromSettings(): OverlayState {
  return { overlay: "tour", returnTo: "settings" };
}

/** Skip and "Get started" both call this — D-U(b)'s rider: both mark the tour seen, so neither is distinguished here. */
export function finishTourOverlay(current: OverlayState): OverlayState {
  return { overlay: current.returnTo, returnTo: null };
}

/** Closes whatever overlay is open. */
export function closeOverlay(): OverlayState {
  return CLOSED_OVERLAY;
}
