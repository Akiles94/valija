import type { AppPreferences } from "../ports/app-preferences.js";

export type SlideId = "welcome" | "save" | "use" | "privacy";

/**
 * Plain TypeScript onboarding tour logic.
 * No React, no I/O, fully testable.
 *
 * The tour plays the first time this installation reaches the dashboard,
 * on either branch (new vault or existing vault).
 * Skip sets the seen flag so it never nags again.
 * Nothing — including this tour — may be shown between init and recovery-kit acknowledgement.
 */

export const TOUR_SLIDES: readonly SlideId[] = [
  "welcome",
  "save",
  "use",
  "privacy",
];

export function shouldPlayTour(prefs: AppPreferences): boolean {
  return !prefs.tourSeen;
}

export function nextSlide(current: SlideId): SlideId | null {
  const currentIndex = TOUR_SLIDES.indexOf(current);
  if (currentIndex === -1 || currentIndex === TOUR_SLIDES.length - 1) {
    return null;
  }
  return TOUR_SLIDES[currentIndex + 1];
}

export function previousSlide(current: SlideId): SlideId | null {
  const currentIndex = TOUR_SLIDES.indexOf(current);
  if (currentIndex <= 0) {
    return null;
  }
  return TOUR_SLIDES[currentIndex - 1];
}

/**
 * Mark the tour as seen. Used when:
 * - User clicks "Get started" on the last slide
 * - User clicks "Skip" on any slide (D-U(b)'s rider)
 */
export function markTourSeen(prefs: AppPreferences): AppPreferences {
  return {
    ...prefs,
    tourSeen: true,
  };
}
