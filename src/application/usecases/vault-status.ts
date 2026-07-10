import { type DomainError, ok, type Result } from "../../domain/errors.js";
import type { KeychainPort } from "../../domain/ports/keychain.js";
import type { VaultStore } from "../../domain/ports/vault-store.js";

export interface VaultStatusOutput {
  initialized: boolean;
  unlocked: boolean;
  vaultId?: string;
  dbPath: string;
}

export class VaultStatus {
  constructor(
    private readonly store: VaultStore,
    private readonly keychain: KeychainPort,
  ) {}

  execute(): Result<VaultStatusOutput, DomainError> {
    const dbPath = this.store.dbPath();
    if (!this.store.headerExists()) {
      return ok({ initialized: false, unlocked: false, dbPath });
    }
    const header = this.store.readHeader();
    if (!header.ok) return header;

    const keyHex = this.keychain.getKey(header.value.vaultId);
    const unlocked = keyHex !== null && this.store.verifyKey(keyHex).ok;
    return ok({ initialized: true, unlocked, vaultId: header.value.vaultId, dbPath });
  }
}
