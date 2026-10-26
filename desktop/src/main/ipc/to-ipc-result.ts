import type { DomainError, Result } from "../../../../src/shared/domain/result.js";
import {
  RekeyUnresolvedError,
  VaultSchemaTooNewError,
} from "../../../../src/vault/domain/errors.js";
import type { IpcResult } from "../../shared/ipc/messages.js";

/**
 * Maps a `Result` to the wire shape — `error` carries only `code`, never `DomainError.message` (D-V(d)),
 * plus, for a newer-schema refusal only, its two numbers (P-21), and, for a `REKEY_FAILED` the
 * rekeyer could not confirm undone, the `unresolved` flag (REKEY W4).
 */
export function toIpcResult<T, U>(
  result: Result<T, DomainError>,
  toResponse: (value: T) => U,
): IpcResult<U> {
  if (!result.ok) return { ok: false, error: errorFor(result.error) };
  return { ok: true, value: toResponse(result.value) };
}

function errorFor(error: DomainError) {
  if (error instanceof VaultSchemaTooNewError) {
    return {
      code: error.code,
      schema: { vaultVersion: error.vaultVersion, supportedVersion: error.supportedVersion },
    };
  }
  if (error instanceof RekeyUnresolvedError) return { code: error.code, unresolved: true as const };
  return { code: error.code };
}
