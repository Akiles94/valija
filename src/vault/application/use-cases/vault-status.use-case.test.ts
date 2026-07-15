import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import { FakeKeychain, makeUnlockedVault } from "../../../testing/test-vault.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { VaultStatus } from "./vault-status.use-case.js";

const vault = makeUnlockedVault();
const vaultStatus = new VaultStatus(vault.store, vault.keychain);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("VaultStatus", () => {
  it("reports not initialized when there is no vault", () => {
    const emptyStore = new FileVaultStore(resolveVaultPaths(`${vault.paths.root}-nope`));
    const r = new VaultStatus(emptyStore, new FakeKeychain()).execute();
    expect(r.ok && r.value).toMatchObject({ initialized: false, unlocked: false });
  });

  it("reports unlocked when the keychain key opens the vault", () => {
    const r = vaultStatus.execute();
    expect(r.ok && r.value).toMatchObject({
      initialized: true,
      unlocked: true,
      vaultId: vault.vaultId,
    });
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
});
