import type { Clock, IdGenerator } from "../../../shared/application/ports/clock.js";
import type { AsyncUseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../../domain/errors.js";
import { bytesToHex } from "../../domain/values/key-hex.js";
import { type Passphrase, parsePassphrase } from "../../domain/values/passphrase.js";
import { DEFAULT_KDF_PARAMS, type VaultCrypto } from "../ports/crypto.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultHeaderData, VaultStore } from "../ports/vault-store.js";

export interface CreateVaultOutput {
  vaultId: string;
  keyHex: string;
  createdAt: string;
}

interface ForgedVault {
  header: VaultHeaderData;
  keyHex: string;
}

export class CreateVault implements AsyncUseCase<string, CreateVaultOutput> {
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
    const parsed = parsePassphrase(passphrase);
    if (!parsed.ok) return parsed;

    const vault = await this.forgeVault(parsed.value);
    this.store.writeHeader(vault.header);
    const initialized = this.store.initializeDb(vault.keyHex);
    if (!initialized.ok) return initialized;

    // Convenience: a freshly created vault starts unlocked.
    this.keychain.setKey(vault.header.vaultId, vault.keyHex);
    return ok({
      vaultId: vault.header.vaultId,
      keyHex: vault.keyHex,
      createdAt: vault.header.createdAt,
    });
  }

  /** Mint the vault identity: id + salt + key derived from the passphrase. */
  private async forgeVault(passphrase: Passphrase): Promise<ForgedVault> {
    const vaultId = this.idGen.next();
    const salt = this.crypto.generateSalt();
    const key = await this.crypto.deriveKey(passphrase, salt, DEFAULT_KDF_PARAMS);
    return {
      header: {
        vaultId,
        schemaVersion: 1,
        kdf: DEFAULT_KDF_PARAMS,
        salt,
        createdAt: this.clock.now().toISOString(),
      },
      keyHex: bytesToHex(key),
    };
  }
}
