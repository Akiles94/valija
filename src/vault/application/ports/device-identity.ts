import type { LineageSeen } from "../../domain/services/vault-lineage.js";
import type { DeviceId } from "../../domain/values/device-id.js";

/**
 * Device-local, never-synced identity plus per-vault sync/session state:
 * what this device last saw of a vault's lineage, and when it was last active.
 */
export interface DeviceIdentity {
  /** Stable id for this device/installation, created lazily on first use. */
  deviceId(): DeviceId;
  lastSeen(vaultId: string): LineageSeen | null;
  recordSeen(vaultId: string, seen: LineageSeen): void;
  lastActivityAt(vaultId: string): Date | null;
  recordActivity(vaultId: string, at: Date): void;
}
