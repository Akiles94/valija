import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { SqliteLineageStore } from "../../infra/sqlite-lineage-store.js";
import { CreateVault } from "./create-vault.use-case.js";
import { UnlockVault } from "./unlock-vault.use-case.js";

const PASSPHRASE = "correct horse battery staple";
const tmp = mkdtempSync(join(tmpdir(), "valija-unlock-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const paths = resolveVaultPaths(join(tmp, "vault-home"));
const idGen = new SeqIds();
const clock = new FixedClock();
const store = new FileVaultStore(paths, idGen, clock);
const crypto = new Argon2VaultCrypto();
const keychain = new FakeKeychain();
const deviceIdentity = new FakeDeviceIdentity(idGen);
const unlockVault = new UnlockVault(store, crypto, keychain, deviceIdentity, clock);

let realKeyHex = "";
let vaultId = "";

beforeAll(async () => {
  const created = await new CreateVault(store, crypto, keychain, clock, idGen).execute(PASSPHRASE);
  if (!created.ok) throw new Error(created.error.message);
  realKeyHex = created.value.keyHex;
  vaultId = created.value.vaultId;
  keychain.deleteKey(vaultId); // start every test from a locked vault
});

/** Bump the real vault's lineage directly, as if another session had written to it. */
function bumpLineage() {
  const db = openVaultDb(paths.db, realKeyHex);
  const stamp = new SqliteLineageStore(db, idGen, clock).bump(deviceIdentity.deviceId());
  db.close();
  return stamp;
}

describe("UnlockVault", () => {
  it("rejects a wrong passphrase", async () => {
    const r = await unlockVault.execute({ passphrase: "not the passphrase" });
    expect(!r.ok && r.error.code).toBe("WRONG_PASSPHRASE");
  });

  it("rejects a malformed recovery key without touching the vault", async () => {
    const r = await unlockVault.execute({ recoveryKeyHex: "zz".repeat(32) });
    expect(!r.ok && r.error.code).toBe("WRONG_PASSPHRASE");
  });

  it("rejects when neither passphrase nor recovery key is given", async () => {
    const r = await unlockVault.execute({});
    expect(!r.ok && r.error.code).toBe("WRONG_PASSPHRASE");
  });

  it("unlocks with the correct passphrase and stores the key", async () => {
    const r = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(keychain.getKey(r.value.vaultId)).toBe(realKeyHex);
    expect(r.value.fork).toBeUndefined();
    keychain.deleteKey(r.value.vaultId);
  });

  it("unlocks with the recovery key from the kit", async () => {
    const r = await unlockVault.execute({ recoveryKeyHex: realKeyHex.toUpperCase() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(keychain.getKey(r.value.vaultId)).toBe(realKeyHex);
  });

  it("adopts a clean fast-forward and records last-seen (never seen this vault before)", async () => {
    bumpLineage(); // generation 0
    const r = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fork).toBeUndefined();
    expect(deviceIdentity.lastSeen(vaultId)?.generation).toBe(0);
  });

  it("adopts a further fast-forward when the generation has moved on since last seen", async () => {
    const before = deviceIdentity.lastSeen(vaultId);
    bumpLineage(); // generation 1
    const r = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fork).toBeUndefined();
    const after = deviceIdentity.lastSeen(vaultId);
    expect(after?.generation).toBe(1);
    expect(after?.writeStamp).not.toBe(before?.writeStamp);
  });

  it("reports VAULT_FORK_DETECTED when the same generation has a different stamp, and never clobbers last-seen", async () => {
    const seenBefore = deviceIdentity.lastSeen(vaultId);
    expect(seenBefore).not.toBeNull();

    // Simulate a sync client landing a copy that diverged from the same starting
    // point: overwrite the stamp at the SAME generation this device already saw.
    const db = openVaultDb(paths.db, realKeyHex);
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('lineage_stamp', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("a-completely-different-stamp");
    db.close();

    const r = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fork).toBeDefined();
    expect(r.value.fork?.generation).toBe(seenBefore?.generation);
    expect(r.value.fork?.notice.code).toBe("VAULT_FORK_DETECTED");

    // Last-seen must be untouched: the warning persists until the user resolves it.
    expect(deviceIdentity.lastSeen(vaultId)).toEqual(seenBefore);
  });
});
