import type { AppPreferences } from "../ports/app-preferences.js";
import { resolveSystemOrOverride } from "./system-or-override.js";

export type Theme = "light" | "dark";

/**
 * Same shape as `language-resolution.ts`, over `nativeTheme.shouldUseDarkColors`
 * (injected as `systemPrefersDark` here, not imported, so this stays testable
 * without a window — the caller reads the Electron API and passes the boolean
 * in). The recovery-kit screen is exempt from theming entirely (D-Q's
 * exception) by never importing this resolver — enforced in Slice 6, not here.
 */
export function resolveTheme(preferences: AppPreferences, systemPrefersDark: boolean): Theme {
  return resolveSystemOrOverride(preferences.theme, systemPrefersDark ? "dark" : "light");
}
