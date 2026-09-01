import { describe, expect, it } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { makeUnlockedVault } from "../../../../../src/testing/test-vault.js";
import { UnlockVault } from "../../../../../src/vault/application/use-cases/unlock-vault.use-case.js";
import { Argon2VaultCrypto } from "../../../../../src/vault/infra/argon2.js";
import { createVaultHandlers } from "./vault-handlers.js";

describe("vault-handlers — D-V(d): errors cross as { code } only, never DomainError.message", () => {
  it("vault:unlock's failure response has no message field anywhere in its shape", async () => {
    const vault = makeUnlockedVault();
    const container = {
      paths: vault.paths,
      unlockVault: new UnlockVault(
        vault.store,
        new Argon2VaultCrypto(),
        vault.keychain,
        vault.deviceIdentity,
        vault.clock,
      ),
      // biome-ignore lint/suspicious/noExplicitAny: only unlockVault is exercised here
    } as any as Container;

    const handlers = createVaultHandlers(() => container);
    const result = await handlers["vault:unlock"]({ passphrase: "definitely wrong" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: "WRONG_PASSPHRASE" });
    expect(JSON.stringify(result)).not.toContain("message");
  });

  it("a successful unlock's response carries no message field anywhere in its shape", async () => {
    const vault = makeUnlockedVault();
    vault.keychain.deleteKey(vault.vaultId); // start locked
    const container = {
      paths: vault.paths,
      unlockVault: new UnlockVault(
        vault.store,
        new Argon2VaultCrypto(),
        vault.keychain,
        vault.deviceIdentity,
        vault.clock,
      ),
      // biome-ignore lint/suspicious/noExplicitAny: only unlockVault is exercised here
    } as any as Container;

    const handlers = createVaultHandlers(() => container);
    // makeUnlockedVault() mints a raw key directly, with no real passphrase
    // behind it — unlock with the recovery-key path instead.
    const result = await handlers["vault:unlock"]({ recoveryKeyHex: vault.keyHex });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("message");
  });
});
