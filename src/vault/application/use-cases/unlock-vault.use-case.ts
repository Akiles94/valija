import type { AsyncUseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../../domain/errors.js";
import { bytesToHex, isKeyHex } from "../../domain/values/key-hex.js";
import type { VaultCrypto } from "../ports/crypto.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultHeaderData, VaultStore } from "../ports/vault-store.js";

export interface UnlockInput {
  passphrase?: string;
  recoveryKeyHex?: string;
}

export class UnlockVault implements AsyncUseCase<UnlockInput, { vaultId: string }> {
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
    private readonly keychain: KeychainPort,
  ) {}

  async execute(input: UnlockInput): Promise<Result<{ vaultId: string }, DomainError>> {
    const header = this.store.readHeader();
    if (!header.ok) return header;

    const keyHex = await this.resolveKey(input, header.value);
    if (!keyHex.ok) return keyHex;

    const verified = this.store.verifyKey(keyHex.value);
    if (!verified.ok) return verified;

    this.keychain.setKey(header.value.vaultId, keyHex.value);
    return ok({ vaultId: header.value.vaultId });
  }

  /** A recovery key is used as-is; a passphrase is derived with the header's salt + KDF params. */
  private async resolveKey(
    input: UnlockInput,
    header: VaultHeaderData,
  ): Promise<Result<string, DomainError>> {
    if (input.recoveryKeyHex !== undefined) {
      if (!isKeyHex(input.recoveryKeyHex)) {
        return vaultErr("WRONG_PASSPHRASE", "Recovery key must be 64 hex characters.");
      }
      return ok(input.recoveryKeyHex.toLowerCase());
    }
    if (input.passphrase !== undefined) {
      const key = await this.crypto.deriveKey(input.passphrase, header.salt, header.kdf);
      return ok(bytesToHex(key));
    }
    return vaultErr("WRONG_PASSPHRASE", "Provide a passphrase or a recovery key.");
  }
}
