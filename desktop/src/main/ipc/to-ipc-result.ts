import type { DomainError, Result } from "../../../../src/shared/domain/result.js";
import type { IpcResult } from "../../shared/ipc/messages.js";

/** Maps a `Result` to the wire shape — `error` carries only `code`, never `DomainError.message` (D-V(d)). */
export function toIpcResult<T, U>(
  result: Result<T, DomainError>,
  toResponse: (value: T) => U,
): IpcResult<U> {
  if (!result.ok) return { ok: false, error: { code: result.error.code } };
  return { ok: true, value: toResponse(result.value) };
}
