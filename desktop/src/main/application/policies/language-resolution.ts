import { type Language, matchLanguage } from "../../../shared/i18n/languages.js";
import type { AppPreferences } from "../ports/app-preferences.js";
import { resolveSystemOrOverride } from "./system-or-override.js";

/**
 * The OS locale is the *initial value of the override*, never a separate code
 * path (D-V(g)'s rider) — the same `resolveSystemOrOverride` mechanism
 * `theme-resolution.ts` uses.
 */
export function resolveLanguage(preferences: AppPreferences, osLocale: string): Language {
  return resolveSystemOrOverride(preferences.language, matchLanguage(osLocale));
}
