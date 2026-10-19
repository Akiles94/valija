/** The preference value meaning follow the operating system. */
export const SYSTEM = "system";
/** A preference that either follows the operating system or holds a manual override. */
export type SystemOr<T> = typeof SYSTEM | T;

/**
 * The one "follow the system, or take my override" mechanism — built once,
 * used twice (D-Q's theme, D-V's language), per the plan's explicit
 * instruction not to derive this interaction pattern a second time.
 */
export function resolveSystemOrOverride<T>(choice: SystemOr<T>, system: T): T {
  return choice === SYSTEM ? system : choice;
}
