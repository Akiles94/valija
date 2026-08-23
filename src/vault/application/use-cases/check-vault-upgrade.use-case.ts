import type { AsyncUseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { LATEST_SCHEMA_VERSION, pendingMigrations } from "../../../shared/infra/migrations.js";
import type { VaultCrypto } from "../ports/crypto.js";
import type { VaultStore } from "../ports/vault-store.js";
import { resolveUnlockKey, type UnlockKeyInput } from "../services/resolve-unlock-key.js";

export interface VaultUpgradeOutput {
  required: boolean;
  from: number;
  to: number;
  backsUpCiphertext: boolean;
}

/**
 * Describes a pending schema upgrade so a GUI confirmation screen can name it
 * before running `migrate` — called only after `UnlockVault` has refused with
 * `VAULT_UPGRADE_REQUIRED`. Not on the ordinary unlock path: this derives the
 * key on top of `UnlockVault`'s own derivation, an acceptable one-time cost
 * for the rare upgrade case rather than a reason to complicate the common one.
 */
export class CheckVaultUpgrade implements AsyncUseCase<UnlockKeyInput, VaultUpgradeOutput> {
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
  ) {}

  async execute(input: UnlockKeyInput): Promise<Result<VaultUpgradeOutput, DomainError>> {
    const header = this.store.readHeader();
    if (!header.ok) return header;

    const keyHex = await resolveUnlockKey(input, header.value, this.crypto);
    if (!keyHex.ok) return keyHex;

    const schema = this.store.readSchemaVersion(keyHex.value);
    if (!schema.ok) return schema;

    const pending = pendingMigrations(schema.value);
    return ok({
      required: pending.length > 0,
      from: schema.value,
      to: LATEST_SCHEMA_VERSION,
      backsUpCiphertext: pending.some((m) => m.backsUpCiphertext),
    });
  }
}
