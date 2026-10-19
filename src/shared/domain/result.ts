/**
 * Outcome of an operation that can fail in an expected way: `ok` with a value or not `ok` with an
 * error. Use cases return it instead of throwing.
 */
export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

/** Wraps a success value in a `Result`. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/** Wraps an expected failure in a `Result`. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Base error shared by every module. Each bounded context narrows `code`
 * through its own constructor (vaultErr / contextErr).
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
