import type { IdGenerator } from "../../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

/**
 * Random token minted on every write. Two devices that wrote independently from
 * the same generation end up with different stamps — that mismatch is the proof
 * of a fork (see vault-lineage.ts). Opaque, like DeviceId: not shape-checked
 * against a specific id format, just required to be non-empty.
 */
export type WriteStamp = string & { readonly __brand: "WriteStamp" };

export function parseWriteStamp(raw: string): Result<WriteStamp, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return vaultErr("INVALID_WRITE_STAMP", `Write stamp must be a non-empty string. Got: "${raw}"`);
  }
  return ok(trimmed as WriteStamp);
}

export const createWriteStamp = (idGen: IdGenerator): WriteStamp => idGen.next() as WriteStamp;
