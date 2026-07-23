import type { IdGenerator } from "../../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Random token minted on every write. Two devices that wrote independently from
 * the same generation end up with different stamps — that mismatch is the proof
 * of a fork (see vault-lineage.ts).
 */
export type WriteStamp = string & { readonly __brand: "WriteStamp" };

export function parseWriteStamp(raw: string): Result<WriteStamp, DomainError> {
  if (!ULID_PATTERN.test(raw)) {
    return vaultErr("INVALID_WRITE_STAMP", `Write stamp must be a 26-char ULID. Got: "${raw}"`);
  }
  return ok(raw as WriteStamp);
}

export const createWriteStamp = (idGen: IdGenerator): WriteStamp => idGen.next() as WriteStamp;
