import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../shared/infra/migrations.js";
import { makePassphraseVault } from "../testing/passphrase-vault.js";
import { RecordingKeychain } from "../testing/recording-keychain.js";
import { setStoredSchemaVersion } from "../testing/schema-skew.js";
import { ChangePassphrase } from "../vault/application/use-cases/change-passphrase.use-case.js";
import { FileDeviceIdentity } from "../vault/infra/file-device-identity.js";
import { InMemoryActivityDeviceIdentity } from "../vault/infra/in-memory-activity-device-identity.js";
import { InMemoryKeychain } from "../vault/infra/in-memory-keychain.js";
import { buildContainer } from "./container.js";

vi.mock("../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-container-"));
const originalEnv = { ...process.env };
let n = 0;
const freshRoot = () => join(tmp, `vault-${++n}`);

beforeEach(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, "state");
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

describe("buildContainer — default wiring (CLI, MCP, desktop)", () => {
  it("constructs one OsKeychain and the file-backed device identity", () => {
    const c = buildContainer({ vaultRoot: freshRoot() });
    expect(RecordingKeychain.constructions).toBe(1);
    expect(c.deviceIdentity).toBeInstanceOf(FileDeviceIdentity);
  });

  it("autoLockMinutes follows VALIJA_AUTOLOCK_MINUTES, read at build time", () => {
    expect(buildContainer({ vaultRoot: freshRoot() }).autoLockMinutes).toBe(15);
    process.env.VALIJA_AUTOLOCK_MINUTES = "7";
    expect(buildContainer({ vaultRoot: freshRoot() }).autoLockMinutes).toBe(7);
    process.env.VALIJA_AUTOLOCK_MINUTES = "0";
    expect(buildContainer({ vaultRoot: freshRoot() }).autoLockMinutes).toBeNull();
    process.env.VALIJA_AUTOLOCK_MINUTES = "off";
    expect(buildContainer({ vaultRoot: freshRoot() }).autoLockMinutes).toBeNull();
  });

  it("still migrates a behind vault on a session open (D-I)", async () => {
    const vault = await makePassphraseVault(freshRoot());
    setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION - 1);
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const c = buildContainer({ vaultRoot: vault.paths.root });
    expect(c.listProjects.execute().ok).toBe(true);
  });
});

describe("buildContainer — changePassphrase (REKEY)", () => {
  it("is wired to the real adapters and stores the new key in the OS keychain (mocked)", async () => {
    const vault = await makePassphraseVault(freshRoot());
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const c = buildContainer({ vaultRoot: vault.paths.root });
    expect(c.changePassphrase).toBeInstanceOf(ChangePassphrase);

    const result = await c.changePassphrase.execute({
      current: { passphrase: vault.passphrase },
      newPassphrase: "a different test phrase",
      otherDevicesConfirmed: false,
    });

    expect(result.ok && result.value.unlockedOnThisDevice).toBe(true);
    expect(RecordingKeychain.constructions).toBe(1);
    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(result.ok ? result.value.keyHex : "?");
    expect(c.listProjects.execute().ok).toBe(true);
  });
});

describe("buildContainer — SDK options", () => {
  it("{ keychain } never constructs the OS keychain (§11.1)", () => {
    buildContainer({ vaultRoot: freshRoot(), keychain: new InMemoryKeychain() });
    expect(RecordingKeychain.constructions).toBe(0);
    expect(RecordingKeychain.calls).toEqual([]);
  });

  it("the given keychain is the one the sessions read", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const keychain = new InMemoryKeychain();
    keychain.setKey(vault.vaultId, vault.keyHex);
    const c = buildContainer({ vaultRoot: vault.paths.root, keychain });
    expect(c.listProjects.execute().ok).toBe(true);
    expect(RecordingKeychain.calls).toEqual([]);
  });

  it("keepActivityInMemory wraps the shared identity and keeps activity out of state.json", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const keychain = new InMemoryKeychain();
    keychain.setKey(vault.vaultId, vault.keyHex);
    const c = buildContainer({ vaultRoot: vault.paths.root, keychain, keepActivityInMemory: true });
    expect(c.deviceIdentity).toBeInstanceOf(InMemoryActivityDeviceIdentity);

    expect(c.listProjects.execute().ok).toBe(true);
    expect(c.deviceIdentity.lastActivityAt(vault.vaultId)).not.toBeNull();
    const shared = buildContainer({ vaultRoot: vault.paths.root, keychain }).deviceIdentity;
    expect(shared.lastActivityAt(vault.vaultId)).toBeNull();
    expect(c.deviceIdentity.deviceId()).toBe(shared.deviceId());
  });

  it("autoMigrate: false reaches the sessions — a behind vault is refused, not migrated (D-H)", async () => {
    const vault = await makePassphraseVault(freshRoot());
    setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION - 1);
    const keychain = new InMemoryKeychain();
    keychain.setKey(vault.vaultId, vault.keyHex);
    const c = buildContainer({ vaultRoot: vault.paths.root, keychain, autoMigrate: false });
    const result = c.listProjects.execute();
    expect(!result.ok && result.error.code).toBe("VAULT_UPGRADE_REQUIRED");
    const migrating = buildContainer({ vaultRoot: vault.paths.root, keychain });
    expect(migrating.listProjects.execute().ok).toBe(true);
  });
});
