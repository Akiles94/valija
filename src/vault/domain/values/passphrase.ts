import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

export const MIN_PASSPHRASE_LENGTH = 8;

/** A passphrase long enough to derive a vault key from. Never trimmed: spaces are entropy. */
export type Passphrase = string & { readonly __brand: "Passphrase" };

export function parsePassphrase(raw: string): Result<Passphrase, DomainError> {
  if (raw.length < MIN_PASSPHRASE_LENGTH) {
    return vaultErr(
      "WEAK_PASSPHRASE",
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    );
  }
  return ok(raw as Passphrase);
}
