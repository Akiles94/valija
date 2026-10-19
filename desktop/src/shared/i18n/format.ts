import type { Language } from "./languages.js";

/**
 * All date/number/duration formatting goes through `Intl`, bound to the
 * *active UI language* (D-V(e) Option 1) — never the OS locale directly, so a
 * user who overrides the language in Settings sees dates change to match.
 * There is no `Intl` usage anywhere in `src/`; this is entirely a `desktop/`
 * concern.
 */
export function formatDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date);
}

/** Formats a date and time in the active UI language. */
export function formatDateTime(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

/** Formats a number in the active UI language. */
export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(language).format(count);
}

/** Formats a duration in minutes, spelled out in the active UI language. */
export function formatMinutes(minutes: number, language: Language): string {
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes);
}
