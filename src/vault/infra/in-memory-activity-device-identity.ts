import type { DeviceIdentity } from "../application/ports/device-identity.js";
import type { LineageSeen } from "../domain/services/vault-lineage.js";
import type { DeviceId } from "../domain/values/device-id.js";

/**
 * SDK Mode P (⚑ D-A.3): the device id and lineage last-seen stay shared with the CLI (no false fork),
 * but idle activity is kept per handle in memory — a product never extends the OS session's idle clock.
 */
export class InMemoryActivityDeviceIdentity implements DeviceIdentity {
  private readonly activity = new Map<string, Date>();

  constructor(private readonly shared: DeviceIdentity) {}

  deviceId(): DeviceId {
    return this.shared.deviceId();
  }

  lastSeen(vaultId: string): LineageSeen | null {
    return this.shared.lastSeen(vaultId);
  }

  recordSeen(vaultId: string, seen: LineageSeen): void {
    this.shared.recordSeen(vaultId, seen);
  }

  lastActivityAt(vaultId: string): Date | null {
    return this.activity.get(vaultId) ?? null;
  }

  recordActivity(vaultId: string, at: Date): void {
    this.activity.set(vaultId, at);
  }
}
