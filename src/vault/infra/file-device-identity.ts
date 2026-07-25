import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IdGenerator } from "../../shared/application/ports/clock.js";
import type { StatePaths } from "../../shared/infra/state-paths.js";
import type { DeviceIdentity } from "../application/ports/device-identity.js";
import type { LineageSeen } from "../domain/services/vault-lineage.js";
import { createDeviceId, type DeviceId, parseDeviceId } from "../domain/values/device-id.js";
import { parseGeneration } from "../domain/values/generation.js";
import { parseWriteStamp } from "../domain/values/write-stamp.js";

interface VaultState {
  lastSeenGeneration?: string;
  lastSeenStamp?: string;
  lastActivityAt?: string;
}

interface StateFile {
  deviceId?: string;
  vaults?: Record<string, VaultState>;
}

/**
 * Device-local, never-synced identity + per-vault sync/session state, stored
 * as JSON under StatePaths (outside VALIJA_HOME by construction). Reads
 * tolerate a missing or corrupt file by starting fresh — this is session
 * bookkeeping, never a secret, so it never throws.
 */
export class FileDeviceIdentity implements DeviceIdentity {
  constructor(
    private readonly paths: StatePaths,
    private readonly idGen: IdGenerator,
  ) {}

  deviceId(): DeviceId {
    const state = this.readState();
    const parsed = state.deviceId !== undefined ? parseDeviceId(state.deviceId) : null;
    if (parsed?.ok) return parsed.value;

    const id = createDeviceId(this.idGen);
    this.writeState({ ...state, deviceId: id });
    return id;
  }

  lastSeen(vaultId: string): LineageSeen | null {
    const vault = this.readState().vaults?.[vaultId];
    if (vault?.lastSeenGeneration === undefined || vault.lastSeenStamp === undefined) return null;

    const generation = parseGeneration(vault.lastSeenGeneration);
    const writeStamp = parseWriteStamp(vault.lastSeenStamp);
    if (!generation.ok || !writeStamp.ok) return null;
    return { generation: generation.value, writeStamp: writeStamp.value };
  }

  recordSeen(vaultId: string, seen: LineageSeen): void {
    this.updateVault(vaultId, {
      lastSeenGeneration: String(seen.generation),
      lastSeenStamp: seen.writeStamp,
    });
  }

  lastActivityAt(vaultId: string): Date | null {
    const raw = this.readState().vaults?.[vaultId]?.lastActivityAt;
    if (raw === undefined) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  recordActivity(vaultId: string, at: Date): void {
    this.updateVault(vaultId, { lastActivityAt: at.toISOString() });
  }

  private updateVault(vaultId: string, patch: Partial<VaultState>): void {
    const state = this.readState();
    const vaults = { ...state.vaults };
    vaults[vaultId] = { ...vaults[vaultId], ...patch };
    this.writeState({ ...state, vaults });
  }

  private readState(): StateFile {
    try {
      return JSON.parse(readFileSync(this.paths.state, "utf8")) as StateFile;
    } catch {
      return {};
    }
  }

  private writeState(state: StateFile): void {
    mkdirSync(dirname(this.paths.state), { recursive: true });
    // Write-then-rename so a crash or a concurrent reader never sees a half-written
    // file. A truncated state.json reads back as "{}" (see readState), which would
    // mint a new device id and silently drop last-seen — making the next divergent
    // vault look like a clean fast-forward. renameSync is atomic on one filesystem.
    const tmp = `${this.paths.state}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(tmp, this.paths.state);
  }
}
