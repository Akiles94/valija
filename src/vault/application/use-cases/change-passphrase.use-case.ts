import type { Clock } from "../../../shared/application/ports/clock.js";
import type { AsyncUseCase } from "../../../shared/application/use-case.js";
import { type DomainError, err, ok, type Result } from "../../../shared/domain/result.js";
import { compareSchema } from "../../../shared/domain/services/schema-compatibility.js";
import { LATEST_SCHEMA_VERSION } from "../../../shared/infra/migrations.js";
import { schemaTooNewErr, vaultErr } from "../../domain/errors.js";
import { refuseUnsettledFolder } from "../../domain/services/folder-settlement.js";
import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import type { Generation } from "../../domain/values/generation.js";
import { parsePassphrase } from "../../domain/values/passphrase.js";
import type { VaultCrypto } from "../ports/crypto.js";
import type { DeviceIdentity } from "../ports/device-identity.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultFolder } from "../ports/vault-folder.js";
import type { VaultRekeyer } from "../ports/vault-rekeyer.js";
import type { VaultStore } from "../ports/vault-store.js";
import { resolveUnlockKey, type UnlockKeyInput } from "../services/resolve-unlock-key.js";

/** Who the user is (current passphrase or recovery key), the new passphrase, and the sync confirmation. */
export interface ChangePassphraseInput {
  /** The current credential — always required, even when unlocked (D-F); the recovery key resets a forgotten passphrase (D-G). */
  current: UnlockKeyInput;
  newPassphrase: string;
  /** The user confirmed every other device is locked and synced — required when the folder looks cloud-synced (D-M). */
  otherDevicesConfirmed: boolean;
}

/** The re-keyed vault, plus its new raw key — for the recovery kit only, shown once. */
export interface ChangePassphraseOutput {
  vaultId: string;
  keyHex: string;
  createdAt: string;
  /** When the new key was issued: the kit's "Key issued" line (D-L). */
  issuedAt: string;
  generation: Generation;
  /** false when the OS keychain could not store the new key — the vault is then locked here (D-H). */
  unlockedOnThisDevice: boolean;
}

const UNCHANGED_MESSAGE =
  "The new passphrase opens the vault with the key it already has. Choose a different passphrase — nothing was changed.";

const CONFIRM_SYNC_MESSAGE =
  "This vault is in a synced folder. Lock valija on every other device, let sync finish, then confirm — nothing was changed.";

/**
 * Changes the passphrase by re-encrypting the whole vault under the key the new passphrase derives
 * (same salt and KDF, so `vault.json` never changes). Every refusal comes before any write; the new
 * key reaches the keychain, the result and the recovery kit only after the re-encryption verified,
 * and once it has, nothing (not even a failed `state.json` write) can keep them from doing so.
 * Goes around the session layer on purpose: no idle guard, no migration (spec §10).
 */
export class ChangePassphrase
  implements AsyncUseCase<ChangePassphraseInput, ChangePassphraseOutput>
{
  constructor(
    private readonly store: VaultStore,
    private readonly crypto: VaultCrypto,
    private readonly keychain: KeychainPort,
    private readonly folder: VaultFolder,
    private readonly deviceIdentity: DeviceIdentity,
    private readonly rekeyer: VaultRekeyer,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ChangePassphraseInput,
  ): Promise<Result<ChangePassphraseOutput, DomainError>> {
    const header = this.store.readHeader();
    if (!header.ok) return header;
    const inspection = this.folder.inspect();
    const unsettled = refuseUnsettledFolder(inspection);
    if (unsettled !== null) return err(unsettled);
    const newPassphrase = parsePassphrase(input.newPassphrase);
    if (!newPassphrase.ok) return newPassphrase;

    const currentKey = await resolveUnlockKey(input.current, header.value, this.crypto);
    if (!currentKey.ok) return currentKey;
    const schema = this.store.readSchemaVersion(currentKey.value); // proves the credential, read-only (F9)
    if (!schema.ok) return schema;
    if (compareSchema(schema.value, LATEST_SCHEMA_VERSION) === "newer") {
      return schemaTooNewErr(schema.value, LATEST_SCHEMA_VERSION); // behind is allowed, never migrated (D-J)
    }

    const newKey = await resolveUnlockKey(
      { passphrase: newPassphrase.value },
      header.value,
      this.crypto,
    );
    if (!newKey.ok) return newKey;
    if (newKey.value === currentKey.value)
      return vaultErr("PASSPHRASE_UNCHANGED", UNCHANGED_MESSAGE);
    if (inspection.looksLikeCloud && !input.otherDevicesConfirmed) {
      return vaultErr("VAULT_FOLDER_UNSETTLED", CONFIRM_SYNC_MESSAGE); // P-6: a backstop, surfaces ask first
    }

    const vaultId = header.value.vaultId;
    const stamp = this.rekeyer.rekey({
      currentKeyHex: currentKey.value,
      newKeyHex: newKey.value,
      writer: this.deviceIdentity.deviceId(),
    });
    if (!stamp.ok) return stamp;

    // Committed and verified: from here on nothing may stop the keychain swap or the kit (C1).
    const unlockedOnThisDevice = this.storeNewKey(vaultId, newKey.value);
    this.recordBookkeeping(vaultId, stamp.value, unlockedOnThisDevice);
    return ok({
      vaultId,
      keyHex: newKey.value,
      createdAt: header.value.createdAt,
      issuedAt: this.clock.now().toISOString(),
      generation: stamp.value.generation,
      unlockedOnThisDevice,
    });
  }

  /** D-H: the new key replaces the old one; when the keychain refuses, leave no key at all — never the old one (§5.3). */
  private storeNewKey(vaultId: string, keyHex: string): boolean {
    try {
      this.keychain.setKey(vaultId, keyHex);
      return true;
    } catch {
      this.keychain.deleteKey(vaultId); // OsKeychain.deleteKey never throws (F7)
      return false;
    }
  }

  /**
   * Last-seen and activity in `state.json`, best effort: a failed write only costs a fast-forward
   * notice or an earlier idle lock on the next unlock, never the new key or the kit (C1, W1).
   */
  private recordBookkeeping(vaultId: string, stamp: LineageStamp, unlocked: boolean): void {
    const { generation, writeStamp } = stamp;
    ignoreFailure(() => this.deviceIdentity.recordSeen(vaultId, { generation, writeStamp }));
    if (unlocked)
      ignoreFailure(() => this.deviceIdentity.recordActivity(vaultId, this.clock.now()));
  }
}

function ignoreFailure(step: () => void): void {
  try {
    step();
  } catch {
    // Device-local bookkeeping only; see recordBookkeeping.
  }
}
