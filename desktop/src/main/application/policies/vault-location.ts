import type { AppPreferences } from "../ports/app-preferences.js";

/**
 * Resolve the vault root from environment, preferences, and defaults.
 *
 * Precedence order (D-R(a)):
 * 1. VALIJA_HOME environment variable (always wins)
 * 2. remembered location from preferences (vaultPath)
 * 3. undefined (falls through to CLI's default ~/.valija)
 *
 * The environment always wins. The remembered location is consulted only
 * when VALIJA_HOME is unset. The default falls through to resolveVaultPaths()'s
 * own ~/.valija fallback.
 */
export function resolveVaultRoot(
  env: Record<string, string | undefined>,
  preferences: AppPreferences
): string | undefined {
  return env.VALIJA_HOME ?? preferences.vaultPath ?? undefined;
}
