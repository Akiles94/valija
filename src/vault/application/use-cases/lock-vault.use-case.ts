import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { DeviceId } from "../../domain/values/device-id.js";
import type { Generation } from "../../domain/values/generation.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultFolder } from "../ports/vault-folder.js";
import type { VaultStore } from "../ports/vault-store.js";

export interface LockOutput {
  wasUnlocked: boolean;
  /** The vault's lineage as of locking, when it could be read (unlocked and already written to). */
  generation?: Generation;
  writer?: DeviceId;
  /** Non-empty means the vault is NOT safely at rest — a crash or an unexpected journal mode. */
  sidecars: string[];
}

export class LockVault implements UseCase<void, LockOutput> {
  constructor(
    private readonly store: VaultStore,
    private readonly keychain: KeychainPort,
    private readonly folder: VaultFolder,
  ) {}

  execute(): Result<LockOutput, DomainError> {
    const header = this.store.readHeader();
    if (!header.ok) return header;
    const vaultId = header.value.vaultId;

    const lineage = this.currentLineage(vaultId);
    const wasUnlocked = this.keychain.deleteKey(vaultId);
    const { sidecars } = this.folder.inspect();

    return ok({ wasUnlocked, sidecars, ...lineage });
  }

  /**
   * Best-effort: read the lineage before dropping the key, so the handoff
   * report can show "generation N, last written by X". A stale/missing key
   * or a vault that has never been written to simply omits these fields —
   * it never blocks the lock itself.
   */
  private currentLineage(vaultId: string): { generation?: Generation; writer?: DeviceId } {
    const keyHex = this.keychain.getKey(vaultId);
    if (keyHex === null) return {};

    const lineage = this.store.readLineage(keyHex);
    if (!lineage.ok || lineage.value === null) return {};

    return { generation: lineage.value.generation, writer: lineage.value.writer };
  }
}
