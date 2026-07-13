import { type DomainError, domainErr, ok, type Result } from "../../domain/errors.js";
import type { KeychainPort } from "../../domain/ports/keychain.js";
import type { VaultSession, VaultSessionFactory } from "../../domain/ports/vault-session.js";
import { readVaultHeader } from "../crypto/vault-header.js";
import type { VaultPaths } from "../vault-paths.js";
import { isWrongKeyError, openVaultDb } from "./connection.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { migrate } from "./migrations.js";
import { SqliteProjectRepository } from "./project-repo.js";

const LOCKED_MESSAGE = 'Vault is locked. Ask the user to run "valija unlock" in a terminal.';

export class SqliteVaultSessionFactory implements VaultSessionFactory {
  constructor(
    private readonly paths: VaultPaths,
    private readonly keychain: KeychainPort,
  ) {}

  open(): Result<VaultSession, DomainError> {
    const header = readVaultHeader(this.paths.header);
    if (!header.ok) return header;

    const keyHex = this.keychain.getKey(header.value.vaultId);
    if (keyHex === null) return domainErr("VAULT_LOCKED", LOCKED_MESSAGE);

    try {
      const db = openVaultDb(this.paths.db, keyHex);
      migrate(db);
      return ok({
        projects: new SqliteProjectRepository(db),
        items: new SqliteContextItemRepository(db),
        close: () => db.close(),
      });
    } catch (error) {
      if (isWrongKeyError(error)) {
        // Stale key in the keychain (e.g. vault file replaced) — treat as locked.
        this.keychain.deleteKey(header.value.vaultId);
        return domainErr("VAULT_LOCKED", LOCKED_MESSAGE);
      }
      return domainErr("STORAGE_ERROR", `Could not open vault: ${(error as Error).message}`);
    }
  }
}
