import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import type { KeychainPort } from "./ports/keychain.js";
import type { VaultStore } from "./ports/vault-store.js";

export class LockVault {
  constructor(
    private readonly store: VaultStore,
    private readonly keychain: KeychainPort,
  ) {}

  execute(): Result<{ wasUnlocked: boolean }, DomainError> {
    const header = this.store.readHeader();
    if (!header.ok) return header;
    const wasUnlocked = this.keychain.deleteKey(header.value.vaultId);
    return ok({ wasUnlocked });
  }
}
