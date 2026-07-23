import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../../shared/infra/vault-paths.js";
import {
  FakeKeychain,
  FixedClock,
  makeUnlockedVault,
  SeqIds,
} from "../../../testing/test-vault.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { LockVault } from "./lock-vault.use-case.js";

const vault = makeUnlockedVault();
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("LockVault", () => {
  it("errors when no vault exists", () => {
    const emptyStore = new FileVaultStore(
      resolveVaultPaths(`${vault.paths.root}-nope`),
      new SeqIds(),
      new FixedClock(),
    );
    const r = new LockVault(emptyStore, new FakeKeychain()).execute();
    expect(!r.ok && r.error.code).toBe("VAULT_NOT_FOUND");
  });

  it("locks an unlocked vault, then reports already-locked", () => {
    const lockVault = new LockVault(vault.store, vault.keychain);
    const first = lockVault.execute();
    expect(first.ok && first.value.wasUnlocked).toBe(true);
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();

    const second = lockVault.execute();
    expect(second.ok && second.value.wasUnlocked).toBe(false);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});
