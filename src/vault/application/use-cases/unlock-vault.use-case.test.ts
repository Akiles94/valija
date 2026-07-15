import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import { FakeKeychain, FixedClock, SeqIds } from "../../../testing/test-vault.js";
import { Argon2VaultCrypto } from "../../infra/argon2.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { CreateVault } from "./create-vault.use-case.js";
import { UnlockVault } from "./unlock-vault.use-case.js";

const PASSPHRASE = "correct horse battery staple";
const tmp = mkdtempSync(join(tmpdir(), "valija-unlock-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const paths = resolveVaultPaths(join(tmp, "vault-home"));
const store = new FileVaultStore(paths);
const crypto = new Argon2VaultCrypto();
const keychain = new FakeKeychain();
const unlockVault = new UnlockVault(store, crypto, keychain);

let realKeyHex = "";

beforeAll(async () => {
  const created = await new CreateVault(
    store,
    crypto,
    keychain,
    new FixedClock(),
    new SeqIds(),
  ).execute(PASSPHRASE);
  if (!created.ok) throw new Error(created.error.message);
  realKeyHex = created.value.keyHex;
  keychain.deleteKey(created.value.vaultId); // start every test from a locked vault
});

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
    keychain.deleteKey(r.value.vaultId);
  });

  it("unlocks with the recovery key from the kit", async () => {
    const r = await unlockVault.execute({ recoveryKeyHex: realKeyHex.toUpperCase() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(keychain.getKey(r.value.vaultId)).toBe(realKeyHex);
  });
});
