import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../../shared/infra/migrations.js";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../../testing/schema-skew.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../testing/test-vault.js";
import { VaultSchemaTooNewError } from "../../domain/errors.js";
import { Argon2VaultCrypto } from "../../infra/argon2.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { CheckVaultUpgrade } from "./check-vault-upgrade.use-case.js";
import { CreateVault } from "./create-vault.use-case.js";
import { UnlockVault } from "./unlock-vault.use-case.js";

const PASSPHRASE = "correct horse battery staple";
const NEWER = LATEST_SCHEMA_VERSION + 1;
const tmp = mkdtempSync(join(tmpdir(), "valija-schema-guard-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A real vault created by CreateVault, whose marker a newer valija has moved to LATEST + 1. Starts locked. */
async function makeNewerSchemaVault(name: string) {
  const paths = resolveVaultPaths(join(tmp, name));
  const idGen = new SeqIds();
  const clock = new FixedClock();
  const store = new FileVaultStore(paths, idGen, clock);
  const crypto = new Argon2VaultCrypto();
  const created = await new CreateVault(
    store,
    crypto,
    new FakeKeychain(),
    new FakeDeviceIdentity(idGen),
    clock,
    idGen,
  ).execute(PASSPHRASE);
  if (!created.ok) throw new Error(created.error.message);
  setStoredSchemaVersion(paths.db, created.value.keyHex, NEWER);

  // A fresh device: no key, no activity, no last-seen — anything set afterwards was set by the unlock.
  const keychain = new FakeKeychain();
  const deviceIdentity = new FakeDeviceIdentity(idGen);
  return {
    paths,
    keychain,
    deviceIdentity,
    vaultId: created.value.vaultId,
    recoveryKeyHex: created.value.keyHex,
    unlockVault: new UnlockVault(store, crypto, keychain, deviceIdentity, clock),
    checkUpgrade: new CheckVaultUpgrade(store, crypto),
  };
}

describe("UnlockVault — the newer-schema guard (D-E)", () => {
  it.each([
    ["passphrase", () => ({ passphrase: PASSPHRASE })],
    ["recovery-key", (recoveryKeyHex: string) => ({ recoveryKeyHex })],
  ])("refuses a %s unlock with VAULT_SCHEMA_TOO_NEW carrying both numbers", async (name, input) => {
    const vault = await makeNewerSchemaVault(`refuse-${name}`);
    const result = await vault.unlockVault.execute(input(vault.recoveryKeyHex));

    expect(!result.ok && result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    const error = !result.ok ? result.error : null;
    expect(error).toBeInstanceOf(VaultSchemaTooNewError);
    expect((error as VaultSchemaTooNewError).vaultVersion).toBe(NEWER);
    expect((error as VaultSchemaTooNewError).supportedVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it("is inert: files unchanged, no key, no activity, no last-seen, no .pre-*.bak", async () => {
    const vault = await makeNewerSchemaVault("inert");
    const before = snapshotVaultFiles(vault.paths);

    await vault.unlockVault.execute({ passphrase: PASSPHRASE });
    await vault.unlockVault.execute({ recoveryKeyHex: vault.recoveryKeyHex });

    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();
    expect(vault.deviceIdentity.lastActivityAt(vault.vaultId)).toBeNull();
    expect(vault.deviceIdentity.lastSeen(vault.vaultId)).toBeNull();
    expect(readdirSync(vault.paths.root).some((f) => f.includes(".pre-"))).toBe(false);
  });

  it("a wrong passphrase is still WRONG_PASSPHRASE, not a schema refusal", async () => {
    const vault = await makeNewerSchemaVault("wrong-passphrase");
    const result = await vault.unlockVault.execute({
      passphrase: "not the right passphrase at all",
    });
    expect(!result.ok && result.error.code).toBe("WRONG_PASSPHRASE");
  });

  it("upgradeConfirmed: true does not bypass it", async () => {
    const vault = await makeNewerSchemaVault("confirmed");
    const before = snapshotVaultFiles(vault.paths);
    const result = await vault.unlockVault.execute({
      passphrase: PASSPHRASE,
      upgradeConfirmed: true,
    });
    expect(!result.ok && result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("CheckVaultUpgrade refuses with VAULT_SCHEMA_TOO_NEW and leaves the files unchanged", async () => {
    const vault = await makeNewerSchemaVault("check-upgrade");
    const before = snapshotVaultFiles(vault.paths);
    const result = await vault.checkUpgrade.execute({ passphrase: PASSPHRASE });
    expect(!result.ok && result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(!result.ok && result.error).toBeInstanceOf(VaultSchemaTooNewError);
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });
});
