/** Success-or-failure value, mirroring the product's `Result` without importing it (the seam). */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Wraps a success value. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/** Wraps a failure value. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Code-unit string comparator: deterministic across locales and OSes, unlike `localeCompare`. */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
