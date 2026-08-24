import { nativeTheme } from "electron";
import { resolveSystemOrOverride } from "./system-or-override.js";
import type { AppPreferences } from "../ports/app-preferences.js";

export type Theme = "light" | "dark";

/**
 * Resolve the active theme from preferences and OS preference.
 * The recovery-kit screen is exempt and permanently dark (it doesn't read the theme at all).
 */
export function resolveTheme(preferences: AppPreferences): Theme {
  const systemTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
  return resolveSystemOrOverride(preferences.theme, systemTheme);
}
