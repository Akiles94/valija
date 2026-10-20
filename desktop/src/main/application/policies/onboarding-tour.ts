import type { AppPreferences } from "../ports/app-preferences.js";

/** The welcome tour's slides, in order. */
export const SLIDE_IDS = ["slide1", "slide2", "slide3", "slide4"] as const;
/** One welcome-tour slide. */
export type SlideId = (typeof SLIDE_IDS)[number];

/**
 * D-U(a) Option 2: plays the first time *this installation* reaches the
 * dashboard, on either branch of the entry screen (create a vault, or point
 * at an existing one) — driven entirely by the one seen-flag, never by which
 * branch was taken.
 */
export function shouldPlayTour(preferences: AppPreferences): boolean {
  return !preferences.tourSeen;
}

/** The slide after `current`, or `null` at the end of the tour. */
export function nextSlide(current: SlideId): SlideId | null {
  const index = SLIDE_IDS.indexOf(current);
  return SLIDE_IDS[index + 1] ?? null;
}

/** The slide before `current`, or `null` on the first slide. */
export function previousSlide(current: SlideId): SlideId | null {
  const index = SLIDE_IDS.indexOf(current);
  return index <= 0 ? null : (SLIDE_IDS[index - 1] ?? null);
}

/** Skip sets the seen flag exactly like finishing the last slide does (D-U(b)'s rider) — a skipped tour never nags again. */
export function markTourSeen(preferences: AppPreferences): AppPreferences {
  return { ...preferences, tourSeen: true };
}
