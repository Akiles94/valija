import { type DomainError, domainErr, ok, type Result } from "../../domain/errors.js";
import type { VaultCrypto } from "../../domain/ports/crypto.js";
import type { KeychainPort } from "../../domain/ports/keychain.js";
import type { VaultStore } from "../../domain/ports/vault-store.js";
import { bytesToHex, isKeyHex } from "../hex.js";

export interface UnlockInput {
  passphrase?: string;
  recoveryKeyHex?: string;
}

export class UnlockVault {
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
    private readonly keychain: KeychainPort,
  ) {}

  async execute(input: UnlockInput): Promise<Result<{ vaultId: string }, DomainError>> {
    const header = this.store.readHeader();
    if (!header.ok) return header;

    let keyHex: string;
    if (input.recoveryKeyHex !== undefined) {
      if (!isKeyHex(input.recoveryKeyHex)) {
        return domainErr("WRONG_PASSPHRASE", "Recovery key must be 64 hex characters.");
      }
      keyHex = input.recoveryKeyHex.toLowerCase();
    } else if (input.passphrase !== undefined) {
      const key = await this.crypto.deriveKey(
        input.passphrase,
        header.value.salt,
        header.value.kdf,
      );
      keyHex = bytesToHex(key);
    } else {
      return domainErr("WRONG_PASSPHRASE", "Provide a passphrase or a recovery key.");
    }

    const verified = this.store.verifyKey(keyHex);
    if (!verified.ok) return verified;

    this.keychain.setKey(header.value.vaultId, keyHex);
    return ok({ vaultId: header.value.vaultId });
  }
}
