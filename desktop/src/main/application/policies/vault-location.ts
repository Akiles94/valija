import type { AppPreferences } from "../ports/app-preferences.js";

/**
 * D-R(a)'s mandatory precedence rule: `VALIJA_HOME`, when set in the app's
 * own environment, always wins; the remembered location is consulted only
 * when it is unset. `undefined` falls through to `resolveVaultPaths()`'s own
 * `~/.valija` default — this never duplicates that resolution rule, only
 * feeds it an optional override.
 */
export function resolveVaultRoot(
  env: { VALIJA_HOME?: string },
  preferences: AppPreferences,
): string | undefined {
  return env.VALIJA_HOME ?? preferences.vaultPath ?? undefined;
}
