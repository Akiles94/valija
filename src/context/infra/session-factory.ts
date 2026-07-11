import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { migrate } from "../../shared/infra/migrations.js";
import { isWrongKeyError, openVaultDb } from "../../shared/infra/sqlite.js";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { KeychainPort } from "../../vault/application/ports/keychain.js";
import { vaultErr } from "../../vault/domain/errors.js";
import { readVaultHeader } from "../../vault/infra/vault-header.js";
import type { VaultSession, VaultSessionFactory } from "../application/ports/vault-session.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { SqliteProjectRepository } from "./project-repo.js";

const LOCKED_MESSAGE = 'Vault is locked. Ask the user to run "valija unlock" in a terminal.';

/**
 * Implements the context-owned VaultSessionFactory port by wiring vault
 * concerns (keychain, header) to the shared SQLite engine. This is the
 * one place where the context module depends on the vault module.
 */
export class SqliteVaultSessionFactory implements VaultSessionFactory {
  constructor(
    private readonly paths: VaultPaths,
    private readonly keychain: KeychainPort,
  ) {}

  open(): Result<VaultSession, DomainError> {
    const header = readVaultHeader(this.paths.header);
    if (!header.ok) return header;

    const keyHex = this.keychain.getKey(header.value.vaultId);
    if (keyHex === null) return vaultErr("VAULT_LOCKED", LOCKED_MESSAGE);

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
        return vaultErr("VAULT_LOCKED", LOCKED_MESSAGE);
      }
      return vaultErr("STORAGE_ERROR", `Could not open vault: ${(error as Error).message}`);
    }
  }
}
