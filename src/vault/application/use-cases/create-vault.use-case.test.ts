import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import { FakeKeychain, FixedClock, SeqIds } from "../../../testing/test-vault.js";
import { Argon2VaultCrypto } from "../../infra/argon2.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { CreateVault } from "./create-vault.use-case.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-create-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const paths = resolveVaultPaths(join(tmp, "vault-home"));
const store = new FileVaultStore(paths, new SeqIds(), new FixedClock());
const keychain = new FakeKeychain();
const createVault = new CreateVault(
  store,
  new Argon2VaultCrypto(),
  keychain,
  new FixedClock(),
  new SeqIds(),
);

describe("CreateVault", () => {
  it("rejects a weak passphrase before deriving anything", async () => {
    const r = await createVault.execute("short");
    expect(!r.ok && r.error.code).toBe("WEAK_PASSPHRASE");
    expect(store.headerExists()).toBe(false);
  });

  it("creates the vault and starts it unlocked (key in keychain)", async () => {
    const r = await createVault.execute("correct horse battery staple");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.keyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(store.headerExists()).toBe(true);
    expect(keychain.getKey(r.value.vaultId)).toBe(r.value.keyHex);
    expect(store.verifyKey(r.value.keyHex).ok).toBe(true);
  });

  it("refuses to create a second vault", async () => {
    const r = await createVault.execute("correct horse battery staple");
    expect(!r.ok && r.error.code).toBe("VAULT_ALREADY_EXISTS");
  });
});
