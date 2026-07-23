import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SaveContext } from "../context/application/use-cases/save-context.use-case.js";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import { openVaultDb } from "../shared/infra/sqlite.js";
import { resolveStatePaths } from "../shared/infra/state-paths.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock, SeqIds } from "../testing/test-vault.js";
import { SessionGuard } from "../vault/application/policies/session-guard.js";
import type { DeviceIdentity } from "../vault/application/ports/device-identity.js";
import { LockVault } from "../vault/application/use-cases/lock-vault.use-case.js";
import { UnlockVault } from "../vault/application/use-cases/unlock-vault.use-case.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { FileDeviceIdentity } from "../vault/infra/file-device-identity.js";
import { FileVaultFolder } from "../vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";

const root = mkdtempSync(join(tmpdir(), "valija-multi-device-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

interface Device {
  paths: VaultPaths;
  store: FileVaultStore;
  keychain: FakeKeychain;
  deviceIdentity: DeviceIdentity;
  sessions: SqliteVaultSessions;
  unlockVault: UnlockVault;
  lockVault: LockVault;
  saveContext: SaveContext;
}

/** One simulated device/installation: its own local vault folder, keychain, and identity. */
function makeDevice(
  localRoot: string,
  deviceIdentity: DeviceIdentity,
  idGen: SeqIds,
  clock: FixedClock,
  ttlMinutes: number | null = 15,
): Device {
  const paths = resolveVaultPaths(localRoot);
  const store = new FileVaultStore(paths, idGen, clock);
  const keychain = new FakeKeychain();
  const folder = new FileVaultFolder(paths);
  const guard = new SessionGuard(deviceIdentity, keychain, clock, ttlMinutes);
  const sessions = new SqliteVaultSessions(paths, keychain, deviceIdentity, guard, idGen, clock);
  return {
    paths,
    store,
    keychain,
    deviceIdentity,
    sessions,
    unlockVault: new UnlockVault(store, new Argon2VaultCrypto(), keychain, deviceIdentity, clock),
    lockVault: new LockVault(store, keychain, folder, deviceIdentity),
    saveContext: new SaveContext(sessions, clock, idGen),
  };
}

/** Create the vault directly on `device` (bypassing CreateVault's Argon2 derivation) and return the raw key. */
function createVaultOn(device: Device, vaultId: string): string {
  const keyHex = randomBytes(32).toString("hex");
  device.store.writeHeader({
    vaultId,
    schemaVersion: 1,
    kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
    salt: randomBytes(16),
    createdAt: "2026-07-23T00:00:00Z",
  });
  const init = device.store.initializeDb(keyHex);
  if (!init.ok) throw new Error(init.error.message);
  return keyHex;
}

/** Simulate the initial "clone": the static header, then the fresh db. */
function cloneOnto(from: Device, to: Device): void {
  mkdirSync(to.paths.root, { recursive: true });
  copyFileSync(from.paths.header, to.paths.header);
  copyFileSync(from.paths.db, to.paths.db);
}

/** Simulate the sync client replicating just the vault file. */
function syncDb(from: Device, to: Device): void {
  copyFileSync(from.paths.db, to.paths.db);
}

describe("multi-device BYO-cloud sync simulation", () => {
  it("a clean A -> B -> A handoff fast-forwards silently on both sides", async () => {
    const clock = new FixedClock();
    const idGen = new SeqIds();
    const deviceA = makeDevice(join(root, "clean-a"), new FakeDeviceIdentity(idGen), idGen, clock);
    const deviceB = makeDevice(join(root, "clean-b"), new FakeDeviceIdentity(idGen), idGen, clock);
    const keyHex = createVaultOn(deviceA, "01MULTIDEVICE");
    cloneOnto(deviceA, deviceB);

    const unlockA1 = await deviceA.unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(unlockA1.ok && unlockA1.value.fork).toBeUndefined();
    expect(
      deviceA.saveContext.execute({ project: "sync-test", content: "device A wrote this" }).ok,
    ).toBe(true);
    deviceA.lockVault.execute();

    syncDb(deviceA, deviceB);
    const unlockB = await deviceB.unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(unlockB.ok).toBe(true);
    expect(unlockB.ok && unlockB.value.fork).toBeUndefined();
    expect(
      deviceB.saveContext.execute({ project: "sync-test", content: "device B wrote this" }).ok,
    ).toBe(true);
    deviceB.lockVault.execute();

    syncDb(deviceB, deviceA);
    const unlockA2 = await deviceA.unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(unlockA2.ok).toBe(true);
    expect(unlockA2.ok && unlockA2.value.fork).toBeUndefined();
  });

  it("both devices writing from the same generation is a detected fork that clobbers nothing", async () => {
    const clock = new FixedClock();
    const idGen = new SeqIds();
    const deviceA = makeDevice(join(root, "fork-a"), new FakeDeviceIdentity(idGen), idGen, clock);
    const deviceB = makeDevice(join(root, "fork-b"), new FakeDeviceIdentity(idGen), idGen, clock);
    const vaultId = "01FORKVAULT";
    const keyHex = createVaultOn(deviceA, vaultId);
    cloneOnto(deviceA, deviceB);

    // Both devices reach the same clean starting point first.
    await deviceA.unlockVault.execute({ recoveryKeyHex: keyHex });
    deviceA.saveContext.execute({ project: "fork-test", content: "shared starting point" });
    deviceA.lockVault.execute();
    syncDb(deviceA, deviceB);
    await deviceB.unlockVault.execute({ recoveryKeyHex: keyHex }); // adopts, records seen

    // Then both write independently, without syncing in between.
    await deviceA.unlockVault.execute({ recoveryKeyHex: keyHex });
    deviceA.saveContext.execute({ project: "fork-test", content: "device A's independent write" });
    deviceA.lockVault.execute();

    await deviceB.unlockVault.execute({ recoveryKeyHex: keyHex });
    deviceB.saveContext.execute({ project: "fork-test", content: "device B's independent write" });
    deviceB.lockVault.execute();

    // The sync client keeps device A's copy; device B's would-be loss is preserved
    // here as a stand-in for the vendor's "(conflicted copy)" file.
    const conflictedCopy = `${deviceB.paths.db} (conflicted copy).db`;
    copyFileSync(deviceB.paths.db, conflictedCopy);
    copyFileSync(deviceA.paths.db, deviceB.paths.db);

    const seenBefore = deviceB.deviceIdentity.lastSeen(vaultId);
    const result = await deviceB.unlockVault.execute({ recoveryKeyHex: keyHex });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fork).toBeDefined();
    expect(result.value.fork?.notice.code).toBe("VAULT_FORK_DETECTED");
    // Last-seen must be untouched: the warning persists until the user resolves it.
    expect(deviceB.deviceIdentity.lastSeen(vaultId)).toEqual(seenBefore);

    // Nothing was deleted: both encrypted copies still open with the same key.
    openVaultDb(deviceB.paths.db, keyHex).close();
    openVaultDb(conflictedCopy, keyHex).close();
  });

  it("idle TTL elapsed drops the key on the next session open; a fresh unlock continues", async () => {
    const clock = new FixedClock();
    const idGen = new SeqIds();
    const device = makeDevice(join(root, "ttl"), new FakeDeviceIdentity(idGen), idGen, clock, 15);
    const vaultId = "01TTLVAULT";
    const keyHex = createVaultOn(device, vaultId);

    const unlocked = await device.unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(unlocked.ok).toBe(true);

    clock.advanceMinutes(16);

    const staleWrite = device.saveContext.execute({
      project: "ttl-test",
      content: "should be locked",
    });
    expect(!staleWrite.ok && staleWrite.error.code).toBe("VAULT_LOCKED");
    expect(device.keychain.getKey(vaultId)).toBeNull();

    const reunlocked = await device.unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(reunlocked.ok).toBe(true);
    expect(device.saveContext.execute({ project: "ttl-test", content: "works again" }).ok).toBe(
      true,
    );
  });

  it("device-local state lives under the state root, never inside the vault folder", async () => {
    const clock = new FixedClock();
    const idGen = new SeqIds();
    const stateRoot = join(root, "state-location-state");
    const vaultRoot = join(root, "state-location-vault");
    const deviceIdentity = new FileDeviceIdentity(resolveStatePaths(stateRoot), idGen);
    const device = makeDevice(vaultRoot, deviceIdentity, idGen, clock);
    const vaultId = "01STATEVAULT";
    const keyHex = createVaultOn(device, vaultId);

    await device.unlockVault.execute({ recoveryKeyHex: keyHex });

    const statePaths = resolveStatePaths(stateRoot);
    expect(existsSync(statePaths.state)).toBe(true);
    expect(statePaths.state.startsWith(vaultRoot)).toBe(false);
    expect(readdirSync(vaultRoot)).not.toContain("state.json");
  });
});
