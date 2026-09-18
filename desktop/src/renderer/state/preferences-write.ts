import { markTourSeen } from "../../main/application/policies/onboarding-tour.js";
import type { AppPreferencesMessage, PreferencesWriteRequest } from "../../shared/ipc/messages.js";

/**
 * `preferences:write`'s request is deliberately narrower than the read shape
 * — no `vaultPath` (§8.6), so a patch can never smuggle a fourth key in.
 * This is the one place that narrowing happens: every write in the renderer
 * (Settings' Appearance/Language radios, the tour's finish handler) goes
 * through this function rather than hand-building the request.
 */
export function mergePreferencesWrite(
  current: AppPreferencesMessage,
  patch: Partial<PreferencesWriteRequest>,
): PreferencesWriteRequest {
  return { theme: current.theme, language: current.language, tourSeen: current.tourSeen, ...patch };
}

/** The tour's finish handler builds its write from the same policy (Slice 3's `markTourSeen`) the preferences store is tested against, rather than hand-rolling `{ tourSeen: true }`. */
export function tourSeenWrite(preferences: AppPreferencesMessage): PreferencesWriteRequest {
  const marked = markTourSeen(preferences);
  return { theme: marked.theme, language: marked.language, tourSeen: marked.tourSeen };
}
