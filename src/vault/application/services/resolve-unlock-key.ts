import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../../domain/errors.js";
import { bytesToHex, isKeyHex } from "../../domain/values/key-hex.js";
import type { VaultCrypto } from "../ports/crypto.js";
import type { VaultHeaderData } from "../ports/vault-store.js";

export interface UnlockKeyInput {
  passphrase?: string;
  recoveryKeyHex?: string;
}

/**
 * A recovery key is used as-is; a passphrase is derived with the header's
 * salt + KDF params. Shared by `UnlockVault` and `CheckVaultUpgrade` so both
 * resolve a key the same way rather than each deriving it independently.
 */
export async function resolveUnlockKey(
  input: UnlockKeyInput,
  header: VaultHeaderData,
  crypto: VaultCrypto,
): Promise<Result<string, DomainError>> {
  if (input.recoveryKeyHex !== undefined) {
    if (!isKeyHex(input.recoveryKeyHex)) {
      return vaultErr("WRONG_PASSPHRASE", "Recovery key must be 64 hex characters.");
    }
    return ok(input.recoveryKeyHex.toLowerCase());
  }
  if (input.passphrase !== undefined) {
    const key = await crypto.deriveKey(input.passphrase, header.salt, header.kdf);
    return ok(bytesToHex(key));
  }
  return vaultErr("WRONG_PASSPHRASE", "Provide a passphrase or a recovery key.");
}
