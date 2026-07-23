import type { Clock } from "../../../shared/application/ports/clock.js";
import type { AsyncUseCase } from "../../../shared/application/use-case.js";
import { DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../../domain/errors.js";
import { classifyLineage } from "../../domain/services/vault-lineage.js";
import type { DeviceId } from "../../domain/values/device-id.js";
import type { Generation } from "../../domain/values/generation.js";
import { bytesToHex, isKeyHex } from "../../domain/values/key-hex.js";
import type { VaultCrypto } from "../ports/crypto.js";
import type { DeviceIdentity } from "../ports/device-identity.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultHeaderData, VaultStore } from "../ports/vault-store.js";

export interface UnlockInput {
  passphrase?: string;
  recoveryKeyHex?: string;
}

/**
 * Provable divergence: this vault was written independently on two devices
 * from the same starting point. The vault is still unlocked (for inspection)
 * — nothing is clobbered, nothing is deleted.
 */
export interface ForkNotice {
  generation: Generation;
  writer: DeviceId;
  notice: DomainError;
}

export interface UnlockOutput {
  vaultId: string;
  fork?: ForkNotice;
}

export class UnlockVault implements AsyncUseCase<UnlockInput, UnlockOutput> {
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
    private readonly keychain: KeychainPort,
    private readonly deviceIdentity: DeviceIdentity,
    private readonly clock: Clock,
  ) {}

  async execute(input: UnlockInput): Promise<Result<UnlockOutput, DomainError>> {
    const header = this.store.readHeader();
    if (!header.ok) return header;

    const keyHex = await this.resolveKey(input, header.value);
    if (!keyHex.ok) return keyHex;

    // readLineage opens and verifies the key (WRONG_PASSPHRASE on mismatch),
    // so a separate verifyKey call would only open the db twice for nothing.
    const lineage = this.store.readLineage(keyHex.value);
    if (!lineage.ok) return lineage;

    const vaultId = header.value.vaultId;
    this.keychain.setKey(vaultId, keyHex.value);
    this.deviceIdentity.recordActivity(vaultId, this.clock.now());

    if (lineage.value === null) {
      // Never written to yet (fresh, or migrated but no write has happened) — nothing to classify.
      return ok({ vaultId });
    }

    const classification = classifyLineage(lineage.value, this.deviceIdentity.lastSeen(vaultId));
    if (classification === "fork") {
      // Leave last-seen untouched: the warning persists until the user resolves it.
      return ok({
        vaultId,
        fork: {
          generation: lineage.value.generation,
          writer: lineage.value.writer,
          notice: new DomainError(
            "VAULT_FORK_DETECTED",
            `This vault was changed on another device from the same starting point ` +
              `(generation ${lineage.value.generation}). Your sync client may have kept only one ` +
              `copy; changes made on the other device may be in a "conflicted copy" file. valija ` +
              `has not deleted anything. Run "valija doctor" to inspect.`,
          ),
        },
      });
    }

    this.deviceIdentity.recordSeen(vaultId, {
      generation: lineage.value.generation,
      writeStamp: lineage.value.writeStamp,
    });
    return ok({ vaultId });
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
