import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { openVaultDb } from "../../../shared/infra/sqlite.js";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import {
  FakeKeychain,
  FixedClock,
  makeUnlockedVault,
  SeqIds,
} from "../../../testing/test-vault.js";
import { FileVaultFolder } from "../../infra/file-vault-folder.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { SqliteLineageStore } from "../../infra/sqlite-lineage-store.js";
import { VaultStatus } from "./vault-status.use-case.js";

const vault = makeUnlockedVault();
const folder = new FileVaultFolder(vault.paths);
const vaultStatus = new VaultStatus(
  vault.store,
  vault.keychain,
  vault.deviceIdentity,
  folder,
  vault.clock,
  15,
);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("VaultStatus", () => {
  it("reports not initialized when there is no vault", () => {
    const emptyPaths = resolveVaultPaths(`${vault.paths.root}-nope`);
    const emptyStore = new FileVaultStore(emptyPaths, new SeqIds(), new FixedClock());
    const r = new VaultStatus(
      emptyStore,
      new FakeKeychain(),
      vault.deviceIdentity,
      new FileVaultFolder(emptyPaths),
      vault.clock,
      15,
    ).execute();
    expect(r.ok && r.value).toMatchObject({ initialized: false, unlocked: false });
  });

  it("reports unlocked, single-file journaling, and the auto-lock TTL", () => {
    const r = vaultStatus.execute();
    expect(r.ok && r.value).toMatchObject({
      initialized: true,
      unlocked: true,
      vaultId: vault.vaultId,
      journalMode: "DELETE",
      sidecars: [],
    });
    expect(r.ok && r.value.autoLock.ttlMinutes).toBe(15);
  });

  it("reports locked when the key is missing", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = vaultStatus.execute();
    expect(r.ok && r.value.unlocked).toBe(false);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("reports locked when the keychain key is stale (does not open the vault)", () => {
    vault.keychain.setKey(vault.vaultId, randomBytes(32).toString("hex"));
    const r = vaultStatus.execute();
    expect(r.ok && r.value.unlocked).toBe(false);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("reports generation and last-writer once the vault has been written to", () => {
    const db = openVaultDb(vault.paths.db, vault.keyHex);
    const stamp = new SqliteLineageStore(db, vault.idGen, vault.clock).bump(
      vault.deviceIdentity.deviceId(),
    );
    db.close();

    const r = vaultStatus.execute();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.generation).toBe(stamp.generation);
    expect(r.value.lastWriter).toBe(stamp.writer);
    expect(r.value.lastWriterIsThisDevice).toBe(true);
  });

  it("reports idle time and expiry once activity is recorded", () => {
    vault.deviceIdentity.recordActivity(vault.vaultId, vault.clock.now());
    vault.clock.advanceMinutes(20);

    const r = vaultStatus.execute();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.autoLock.idleForMinutes).toBeCloseTo(20);
    expect(r.value.autoLock.expired).toBe(true);

    vault.clock.advanceMinutes(-20); // restore for any later test relying on the fixed clock
  });
});
