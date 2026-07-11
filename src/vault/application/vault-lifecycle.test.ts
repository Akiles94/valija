import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../shared/infra/vault-paths.js";
import { FakeKeychain, FixedClock, SeqIds } from "../../testing/test-vault.js";
import { Argon2VaultCrypto } from "../infra/argon2.js";
import { FileVaultStore } from "../infra/file-vault-store.js";
import { CreateVault } from "./create-vault.js";
import { LockVault } from "./lock-vault.js";
import { UnlockVault } from "./unlock-vault.js";
import { VaultStatus } from "./vault-status.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-lifecycle-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const paths = resolveVaultPaths(join(tmp, "vault-home"));
const store = new FileVaultStore(paths);
const crypto = new Argon2VaultCrypto();
const keychain = new FakeKeychain();
const createVault = new CreateVault(store, crypto, keychain, new FixedClock(), new SeqIds());
const unlockVault = new UnlockVault(store, crypto, keychain);
const lockVault = new LockVault(store, keychain);
const vaultStatus = new VaultStatus(store, keychain);

const PASSPHRASE = "correct horse battery staple";

describe("vault lifecycle (full round trip, real Argon2id)", () => {
  it("status before init: not initialized", () => {
    const s = vaultStatus.execute();
    expect(s.ok && s.value).toMatchObject({ initialized: false, unlocked: false });
  });

  it("rejects a weak passphrase", async () => {
    const r = await createVault.execute("short");
    expect(!r.ok && r.error.code).toBe("WEAK_PASSPHRASE");
  });

  it("creates the vault and starts unlocked", async () => {
    const r = await createVault.execute(PASSPHRASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.keyHex).toMatch(/^[0-9a-f]{64}$/);
    const s = vaultStatus.execute();
    expect(s.ok && s.value).toMatchObject({ initialized: true, unlocked: true });
  });

  it("refuses to create twice", async () => {
    const r = await createVault.execute(PASSPHRASE);
    expect(!r.ok && r.error.code).toBe("VAULT_ALREADY_EXISTS");
  });

  it("locks, then rejects a wrong passphrase on unlock", async () => {
    const locked = lockVault.execute();
    expect(locked.ok && locked.value.wasUnlocked).toBe(true);
    expect(vaultStatus.execute().ok && vaultStatus.execute()).toMatchObject({
      value: { unlocked: false },
    });
    const wrong = await unlockVault.execute({ passphrase: "not the passphrase" });
    expect(!wrong.ok && wrong.error.code).toBe("WRONG_PASSPHRASE");
  });

  it("unlocks with the correct passphrase", async () => {
    const r = await unlockVault.execute({ passphrase: PASSPHRASE });
    expect(r.ok).toBe(true);
    const s = vaultStatus.execute();
    expect(s.ok && s.value.unlocked).toBe(true);
  });

  it("unlocks with the recovery key after locking again", async () => {
    const header = store.readHeader();
    if (!header.ok) throw new Error("header missing");
    const keyHex = keychain.getKey(header.value.vaultId);
    if (keyHex === null) throw new Error("expected unlocked");
    lockVault.execute();

    const bad = await unlockVault.execute({ recoveryKeyHex: "zz".repeat(32) });
    expect(!bad.ok && bad.error.code).toBe("WRONG_PASSPHRASE");
    const good = await unlockVault.execute({ recoveryKeyHex: keyHex });
    expect(good.ok).toBe(true);
  });
});
