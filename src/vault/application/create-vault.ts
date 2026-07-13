import type { Clock, IdGenerator } from "../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { vaultErr } from "../domain/errors.js";
import { bytesToHex } from "./hex.js";
import { DEFAULT_KDF_PARAMS, type VaultCrypto } from "./ports/crypto.js";
import type { KeychainPort } from "./ports/keychain.js";
import type { VaultStore } from "./ports/vault-store.js";

export const MIN_PASSPHRASE_LENGTH = 8;

export interface CreateVaultOutput {
  vaultId: string;
  keyHex: string;
  createdAt: string;
}

export class CreateVault {
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
    private readonly keychain: KeychainPort,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(passphrase: string): Promise<Result<CreateVaultOutput, DomainError>> {
    if (this.store.headerExists()) {
      return vaultErr("VAULT_ALREADY_EXISTS", "A vault already exists on this machine.");
    }
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      return vaultErr(
        "WEAK_PASSPHRASE",
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
      );
    }
    const vaultId = this.idGen.next();
    const salt = this.crypto.generateSalt();
    const key = await this.crypto.deriveKey(passphrase, salt, DEFAULT_KDF_PARAMS);
    const keyHex = bytesToHex(key);
    const createdAt = this.clock.now().toISOString();

    this.store.writeHeader({ vaultId, schemaVersion: 1, kdf: DEFAULT_KDF_PARAMS, salt, createdAt });
    const init = this.store.initializeDb(keyHex);
    if (!init.ok) return init;

    // Convenience: a freshly created vault starts unlocked.
    this.keychain.setKey(vaultId, keyHex);
    return ok({ vaultId, keyHex, createdAt });
  }
}
