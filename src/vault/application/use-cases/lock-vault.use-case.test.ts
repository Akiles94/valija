import { rmSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../../shared/infra/migrations.js";
import { openVaultDb } from "../../../shared/infra/sqlite.js";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../../testing/schema-skew.js";
import {
  FakeKeychain,
  FixedClock,
  makeUnlockedVault,
  SeqIds,
} from "../../../testing/test-vault.js";
import { FileVaultFolder } from "../../infra/file-vault-folder.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { SqliteLineageStore } from "../../infra/sqlite-lineage-store.js";
import { LockVault } from "./lock-vault.use-case.js";

const vault = makeUnlockedVault();
const folder = new FileVaultFolder(vault.paths);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("LockVault", () => {
  it("errors when no vault exists", () => {
    const emptyPaths = resolveVaultPaths(`${vault.paths.root}-nope`);
    const emptyStore = new FileVaultStore(emptyPaths, new SeqIds(), new FixedClock());
    const r = new LockVault(
      emptyStore,
      new FakeKeychain(),
      new FileVaultFolder(emptyPaths),
      vault.deviceIdentity,
    ).execute();
    expect(!r.ok && r.error.code).toBe("VAULT_NOT_FOUND");
  });

  it("locks an unlocked vault, then reports already-locked", () => {
    const lockVault = new LockVault(vault.store, vault.keychain, folder, vault.deviceIdentity);
    const first = lockVault.execute();
    expect(first.ok && first.value.wasUnlocked).toBe(true);
    expect(first.ok && first.value.sidecars).toEqual([]);
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();

    const second = lockVault.execute();
    expect(second.ok && second.value.wasUnlocked).toBe(false);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("reports the current generation and writer when the vault has been written to", () => {
    const db = openVaultDb(vault.paths.db, vault.keyHex);
    const stamp = new SqliteLineageStore(db, vault.idGen, vault.clock).bump(
      vault.deviceIdentity.deviceId(),
    );
    db.close();

    const r = new LockVault(vault.store, vault.keychain, folder, vault.deviceIdentity).execute();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.generation).toBe(stamp.generation);
    expect(r.value.writer).toBe(stamp.writer);
    expect(r.value.writerIsThisDevice).toBe(true);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("reports stray sidecar files when the vault is not safely at rest", () => {
    const walPath = `${vault.paths.db}-wal`;
    writeFileSync(walPath, "");
    try {
      const r = new LockVault(vault.store, vault.keychain, folder, vault.deviceIdentity).execute();
      expect(r.ok).toBe(true);
      expect(r.ok && r.value.sidecars).toEqual([walPath]);
    } finally {
      rmSync(walPath, { force: true });
      vault.keychain.setKey(vault.vaultId, vault.keyHex);
    }
  });
});

describe("LockVault — a vault newer than this build (F8)", () => {
  it("still drops the key; lineage is omitted and the files are unchanged", () => {
    const newer = makeUnlockedVault();
    const db = openVaultDb(newer.paths.db, newer.keyHex);
    new SqliteLineageStore(db, newer.idGen, newer.clock).bump(newer.deviceIdentity.deviceId());
    db.close();
    setStoredSchemaVersion(newer.paths.db, newer.keyHex, LATEST_SCHEMA_VERSION + 1);
    const before = snapshotVaultFiles(newer.paths);

    const r = new LockVault(
      newer.store,
      newer.keychain,
      new FileVaultFolder(newer.paths),
      newer.deviceIdentity,
    ).execute();

    expect(r.ok && r.value.wasUnlocked).toBe(true);
    expect(newer.keychain.getKey(newer.vaultId)).toBeNull();
    expect(r.ok && r.value.generation).toBeUndefined();
    expect(r.ok && r.value.writer).toBeUndefined();
    expect(snapshotVaultFiles(newer.paths)).toEqual(before);
    rmSync(newer.paths.root, { recursive: true, force: true });
  });
});
