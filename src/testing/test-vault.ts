import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import type { Clock, IdGenerator } from "../shared/application/ports/clock.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { SessionGuard } from "../vault/application/policies/session-guard.js";
import type { DeviceIdentity } from "../vault/application/ports/device-identity.js";
import type { KeychainPort } from "../vault/application/ports/keychain.js";
import type { LineageSeen } from "../vault/domain/services/vault-lineage.js";
import { parseAutoLockTtl } from "../vault/domain/values/auto-lock-ttl.js";
import { createDeviceId, type DeviceId } from "../vault/domain/values/device-id.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";

export class FakeKeychain implements KeychainPort {
  private readonly store = new Map<string, string>();
  setKey(vaultId: string, keyHex: string): void {
    this.store.set(vaultId, keyHex);
  }
  getKey(vaultId: string): string | null {
    return this.store.get(vaultId) ?? null;
  }
  deleteKey(vaultId: string): boolean {
    return this.store.delete(vaultId);
  }
}

export class FixedClock implements Clock {
  private current: Date;
  constructor(start = new Date("2026-07-11T12:00:00Z")) {
    this.current = start;
  }
  now(): Date {
    return this.current;
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SeqIds implements IdGenerator {
  private n = 0;
  next(): string {
    return `01SEQ${String(++this.n).padStart(6, "0")}`;
  }
}

/** In-memory DeviceIdentity — device-local state kept in a Map instead of a file. */
export class FakeDeviceIdentity implements DeviceIdentity {
  private id: DeviceId | null = null;
  private readonly seen = new Map<string, LineageSeen>();
  private readonly activity = new Map<string, Date>();

  constructor(private readonly idGen: IdGenerator) {}

  deviceId(): DeviceId {
    if (this.id === null) this.id = createDeviceId(this.idGen);
    return this.id;
  }
  lastSeen(vaultId: string): LineageSeen | null {
    return this.seen.get(vaultId) ?? null;
  }
  recordSeen(vaultId: string, seen: LineageSeen): void {
    this.seen.set(vaultId, seen);
  }
  lastActivityAt(vaultId: string): Date | null {
    return this.activity.get(vaultId) ?? null;
  }
  recordActivity(vaultId: string, at: Date): void {
    this.activity.set(vaultId, at);
  }
}

export interface TestVault {
  paths: VaultPaths;
  store: FileVaultStore;
  keychain: FakeKeychain;
  sessions: SqliteVaultSessions;
  keyHex: string;
  vaultId: string;
  deviceIdentity: FakeDeviceIdentity;
  guard: SessionGuard;
  idGen: IdGenerator;
  clock: FixedClock;
}

/** An initialized, unlocked vault on a temp dir — no Argon2, fast. */
export function makeUnlockedVault(): TestVault {
  const root = mkdtempSync(join(tmpdir(), "valija-app-"));
  const paths = resolveVaultPaths(root);
  const idGen = new SeqIds();
  const clock = new FixedClock();
  const store = new FileVaultStore(paths, idGen, clock);
  const keychain = new FakeKeychain();
  const keyHex = randomBytes(32).toString("hex");
  const vaultId = "01TESTVAULT";
  store.writeHeader({
    vaultId,
    schemaVersion: 1,
    kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
    salt: randomBytes(16),
    createdAt: "2026-07-11T00:00:00Z",
  });
  const init = store.initializeDb(keyHex);
  if (!init.ok) throw new Error(init.error.message);
  keychain.setKey(vaultId, keyHex);
  const deviceIdentity = new FakeDeviceIdentity(idGen);
  const guard = new SessionGuard(deviceIdentity, keychain, clock, parseAutoLockTtl(undefined));
  return {
    paths,
    store,
    keychain,
    sessions: new SqliteVaultSessions(paths, keychain, deviceIdentity, guard, idGen, clock),
    keyHex,
    vaultId,
    deviceIdentity,
    guard,
    idGen,
    clock,
  };
}
