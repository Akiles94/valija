import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultStore } from "../ports/vault-store.js";

export interface VaultStatusOutput {
  initialized: boolean;
  unlocked: boolean;
  vaultId?: string;
  dbPath: string;
}

export class VaultStatus implements UseCase<void, VaultStatusOutput> {
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
