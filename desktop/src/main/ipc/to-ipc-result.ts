import type { DomainError, Result } from "../../../../src/shared/domain/result.js";
import { VaultSchemaTooNewError } from "../../../../src/vault/domain/errors.js";
import type { IpcResult } from "../../shared/ipc/messages.js";

/**
 * Maps a `Result` to the wire shape — `error` carries only `code`, never `DomainError.message` (D-V(d)),
 * plus, for a newer-schema refusal only, its two numbers (P-21).
 */
export function toIpcResult<T, U>(
  result: Result<T, DomainError>,
  toResponse: (value: T) => U,
): IpcResult<U> {
  if (!result.ok) return { ok: false, error: errorFor(result.error) };
  return { ok: true, value: toResponse(result.value) };
}

const errorFor = (error: DomainError) =>
  error instanceof VaultSchemaTooNewError
    ? {
        code: error.code,
        schema: { vaultVersion: error.vaultVersion, supportedVersion: error.supportedVersion },
      }
    : { code: error.code };
