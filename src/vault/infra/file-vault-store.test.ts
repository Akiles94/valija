import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../shared/infra/migrations.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import { makeUnlockedVault } from "../../testing/test-vault.js";
import { VaultSchemaTooNewError } from "../domain/errors.js";

const current = makeUnlockedVault();
const newer = makeUnlockedVault();
setStoredSchemaVersion(newer.paths.db, newer.keyHex, LATEST_SCHEMA_VERSION + 1);
afterAll(() => {
  rmSync(current.paths.root, { recursive: true, force: true });
  rmSync(newer.paths.root, { recursive: true, force: true });
});

describe("FileVaultStore — error mapping", () => {
  it("readLineage on a newer vault → VAULT_SCHEMA_TOO_NEW with both numbers, files untouched", () => {
    const before = snapshotVaultFiles(newer.paths);
    const r = newer.store.readLineage(newer.keyHex);
    expect(!r.ok && r.error).toBeInstanceOf(VaultSchemaTooNewError);
    expect(!r.ok && (r.error as VaultSchemaTooNewError).vaultVersion).toBe(
      LATEST_SCHEMA_VERSION + 1,
    );
    expect(snapshotVaultFiles(newer.paths)).toEqual(before);
  });

  it("verifyKey on a newer vault → VAULT_SCHEMA_TOO_NEW", () => {
    const r = newer.store.verifyKey(newer.keyHex);
    expect(!r.ok && r.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
  });

  it("readSchemaVersion reports the newer number instead of refusing it, without changing the files", () => {
    const before = snapshotVaultFiles(newer.paths);
    expect(newer.store.readSchemaVersion(newer.keyHex)).toEqual({
      ok: true,
      value: LATEST_SCHEMA_VERSION + 1,
    });
    expect(current.store.readSchemaVersion(current.keyHex)).toEqual({
      ok: true,
      value: LATEST_SCHEMA_VERSION,
    });
    expect(snapshotVaultFiles(newer.paths)).toEqual(before);
  });

  it.each([
    "verifyKey",
    "readLineage",
    "readSchemaVersion",
  ] as const)("a wrong key → WRONG_PASSPHRASE on %s", (method) => {
    const r = current.store[method](randomBytes(32).toString("hex"));
    expect(!r.ok && r.error.code).toBe("WRONG_PASSPHRASE");
  });
});
