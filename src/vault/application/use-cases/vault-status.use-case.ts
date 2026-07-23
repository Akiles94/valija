import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { isIdleExpired } from "../../domain/values/auto-lock-ttl.js";
import type { DeviceId } from "../../domain/values/device-id.js";
import type { Generation } from "../../domain/values/generation.js";
import type { DeviceIdentity } from "../ports/device-identity.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultFolder } from "../ports/vault-folder.js";
import type { VaultStore } from "../ports/vault-store.js";

export interface AutoLockStatus {
  ttlMinutes: number | null;
  idleForMinutes?: number;
  expired?: boolean;
}

/**
 * Sync-safety + session reporting only — never touches context items and
 * never feeds a context pack. journalMode is always "DELETE" (D-A): the
 * vault is always a single self-consistent file at rest after M3.
 */
export interface VaultStatusOutput {
  initialized: boolean;
  unlocked: boolean;
  vaultId?: string;
  dbPath: string;
  journalMode: "DELETE";
  sidecars: string[];
  autoLock: AutoLockStatus;
  generation?: Generation;
  lastWriter?: DeviceId;
  lastWriterIsThisDevice?: boolean;
}

export class VaultStatus implements UseCase<void, VaultStatusOutput> {
  constructor(
    private readonly store: VaultStore,
    private readonly keychain: KeychainPort,
    private readonly deviceIdentity: DeviceIdentity,
    private readonly folder: VaultFolder,
    private readonly clock: Clock,
    private readonly ttlMinutes: number | null,
  ) {}

  execute(): Result<VaultStatusOutput, DomainError> {
    const dbPath = this.store.dbPath();
    const { sidecars } = this.folder.inspect();
    const base = { dbPath, journalMode: "DELETE" as const, sidecars };

    if (!this.store.headerExists()) {
      return ok({
        ...base,
        initialized: false,
        unlocked: false,
        autoLock: { ttlMinutes: this.ttlMinutes },
      });
    }
    const header = this.store.readHeader();
    if (!header.ok) return header;
    const vaultId = header.value.vaultId;
    const autoLock = this.autoLockStatus(vaultId);

    const keyHex = this.keychain.getKey(vaultId);
    const unlocked = keyHex !== null && this.store.verifyKey(keyHex).ok;
    if (!unlocked || keyHex === null) {
      return ok({ ...base, initialized: true, unlocked: false, vaultId, autoLock });
    }

    const lineage = this.store.readLineage(keyHex);
    const lineageFields =
      lineage.ok && lineage.value !== null
        ? {
            generation: lineage.value.generation,
            lastWriter: lineage.value.writer,
            lastWriterIsThisDevice: lineage.value.writer === this.deviceIdentity.deviceId(),
          }
        : {};

    return ok({ ...base, initialized: true, unlocked: true, vaultId, autoLock, ...lineageFields });
  }

  private autoLockStatus(vaultId: string): AutoLockStatus {
    if (this.ttlMinutes === null) return { ttlMinutes: null };

    const lastActivity = this.deviceIdentity.lastActivityAt(vaultId);
    if (lastActivity === null) return { ttlMinutes: this.ttlMinutes };

    const now = this.clock.now();
    const idleForMinutes = (now.getTime() - lastActivity.getTime()) / 60_000;
    return {
      ttlMinutes: this.ttlMinutes,
      idleForMinutes,
      expired: isIdleExpired(lastActivity, now, this.ttlMinutes),
    };
  }
}
