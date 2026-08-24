import type { SystemOr } from "../ports/app-preferences.js";

/**
 * Resolves a "system or override" choice.
 * If choice is "system", returns the system value.
 * Otherwise, returns the override.
 *
 * This is the one mechanism used for both theme and language.
 */
export function resolveSystemOrOverride<T>(
  choice: SystemOr<T>,
  system: T
): T {
  return choice === "system" ? system : choice;
}
