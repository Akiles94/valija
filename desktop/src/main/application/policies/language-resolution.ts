import { resolveSystemOrOverride } from "./system-or-override.js";
import { matchLanguage } from "../../shared/i18n/languages.js";
import type { Language } from "../../shared/i18n/languages.js";
import type { AppPreferences } from "../ports/app-preferences.js";

/**
 * Resolve the active language from preferences and OS locale.
 * The OS value is the initial value of the override, never a separate code path.
 */
export function resolveLanguage(
  preferences: AppPreferences,
  osLocale: string
): Language {
  const systemLanguage = matchLanguage(osLocale);
  return resolveSystemOrOverride(preferences.language, systemLanguage);
}
