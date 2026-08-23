import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION, schemaVersion } from "../../../shared/infra/migrations.js";
import { openVaultDb } from "../../../shared/infra/sqlite.js";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../testing/test-vault.js";
import { Argon2VaultCrypto } from "../../infra/argon2.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { CheckVaultUpgrade } from "./check-vault-upgrade.use-case.js";
import { CreateVault } from "./create-vault.use-case.js";
import { UnlockVault } from "./unlock-vault.use-case.js";

const PASSPHRASE = "correct horse battery staple";
const tmp = mkdtempSync(join(tmpdir(), "valija-upgrade-gate-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * Builds a real vault, fully migrated to `LATEST_SCHEMA_VERSION` by
 * `CreateVault`, then rolls back only the `meta.schema_version` *marker* to 2
 * — not the schema itself. This is deliberately narrower than reconstructing
 * a genuine legacy database: `readSchemaVersion` and the unlock gate only
 * ever consult that marker, so patching it is sufficient to exercise "behind
 * schema" without re-invoking migration 002's table-rebuild SQL a second
 * time, which is not safe to run twice. Migration 3 (the only one with
 * version > 2) is idempotent (`INSERT OR IGNORE`), so re-running it via
 * `upgradeConfirmed: true` is safe.
 */
async function makeBehindSchemaVault(name: string) {
  const paths = resolveVaultPaths(join(tmp, name));
  const idGen = new SeqIds();
  const clock = new FixedClock();
  const store = new FileVaultStore(paths, idGen, clock);
  const crypto = new Argon2VaultCrypto();
  const keychain = new FakeKeychain();
  const deviceIdentity = new FakeDeviceIdentity(idGen);

  const created = await new CreateVault(
    store,
    crypto,
    keychain,
    deviceIdentity,
    clock,
    idGen,
  ).execute(PASSPHRASE);
  if (!created.ok) throw new Error(created.error.message);
  const { keyHex, vaultId } = created.value;

  const db = openVaultDb(paths.db, keyHex);
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', '2') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run();
  db.close();
  keychain.deleteKey(vaultId); // start every test from a locked vault

  return {
    paths,
    store,
    crypto,
    keychain,
    deviceIdentity,
    clock,
    keyHex,
    vaultId,
    unlockVault: new UnlockVault(store, crypto, keychain, deviceIdentity, clock),
  };
}

describe("UnlockVault — the D-J(b) schema-upgrade gate", () => {
  it("refuses a behind-schema vault without upgradeConfirmed", async () => {
    const vault = await makeBehindSchemaVault("refuse");

    const result = await vault.unlockVault.execute({ passphrase: PASSPHRASE });
    expect(!result.ok && result.error.code).toBe("VAULT_UPGRADE_REQUIRED");
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();
  });

  it("the on-disk schema_version is unchanged after a refusal", async () => {
    const vault = await makeBehindSchemaVault("unchanged");

    await vault.unlockVault.execute({ passphrase: PASSPHRASE });

    const db = openVaultDb(vault.paths.db, vault.keyHex);
    expect(schemaVersion(db)).toBe(2);
    db.close();
  });

  it("unlocks and migrates when upgradeConfirmed is true, reaching LATEST_SCHEMA_VERSION", async () => {
    const vault = await makeBehindSchemaVault("confirmed");

    const result = await vault.unlockVault.execute({
      passphrase: PASSPHRASE,
      upgradeConfirmed: true,
    });
    expect(result.ok).toBe(true);
    expect(vault.keychain.getKey(vault.vaultId)).toBe(vault.keyHex);

    const db = openVaultDb(vault.paths.db, vault.keyHex);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });

  it("a current-schema vault never refuses, even without upgradeConfirmed", async () => {
    const paths = resolveVaultPaths(join(tmp, "current"));
    const idGen = new SeqIds();
    const clock = new FixedClock();
    const store = new FileVaultStore(paths, idGen, clock);
    const crypto = new Argon2VaultCrypto();
    const keychain = new FakeKeychain();
    const deviceIdentity = new FakeDeviceIdentity(idGen);
    const created = await new CreateVault(
      store,
      crypto,
      keychain,
      deviceIdentity,
      clock,
      idGen,
    ).execute(PASSPHRASE);
    if (!created.ok) throw new Error(created.error.message);
    keychain.deleteKey(created.value.vaultId);

    const unlockVault = new UnlockVault(store, crypto, keychain, deviceIdentity, clock);
    const result = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(result.ok).toBe(true);
  });
});

describe("CheckVaultUpgrade", () => {
  it("reports the pending upgrade for a behind-schema vault", async () => {
    const vault = await makeBehindSchemaVault("check");
    const checkVaultUpgrade = new CheckVaultUpgrade(vault.store, vault.crypto);

    const result = await checkVaultUpgrade.execute({ passphrase: PASSPHRASE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      required: true,
      from: 2,
      to: LATEST_SCHEMA_VERSION,
      backsUpCiphertext: true,
    });
  });

  it("reports nothing required for a current-schema vault", async () => {
    const paths = resolveVaultPaths(join(tmp, "check-current"));
    const idGen = new SeqIds();
    const clock = new FixedClock();
    const store = new FileVaultStore(paths, idGen, clock);
    const crypto = new Argon2VaultCrypto();
    const keychain = new FakeKeychain();
    const deviceIdentity = new FakeDeviceIdentity(idGen);
    await new CreateVault(store, crypto, keychain, deviceIdentity, clock, idGen).execute(
      PASSPHRASE,
    );

    const checkVaultUpgrade = new CheckVaultUpgrade(store, crypto);
    const result = await checkVaultUpgrade.execute({ passphrase: PASSPHRASE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.required).toBe(false);
    expect(result.value.from).toBe(LATEST_SCHEMA_VERSION);
  });
});
