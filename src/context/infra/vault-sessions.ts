import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { migrate } from "../../shared/infra/migrations.js";
import { isWrongKeyError, openVaultDb } from "../../shared/infra/sqlite.js";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { KeychainPort } from "../../vault/application/ports/keychain.js";
import { vaultErr } from "../../vault/domain/errors.js";
import { readVaultHeader } from "../../vault/infra/vault-header.js";
import type { VaultSession, VaultSessions } from "../application/ports/vault-session.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { SqliteProjectRepository } from "./project-repo.js";

const LOCKED_MESSAGE = 'Vault is locked. Ask the user to run "valija unlock" in a terminal.';

/**
 * Open a session, run the action, and always close the session — even when the
 * action throws. Kept generic (no SQLite here) so the lifecycle guarantee can be
 * verified in isolation.
 */
export function runWithSession<T>(
  open: () => Result<VaultSession, DomainError>,
  action: (session: VaultSession) => Result<T, DomainError>,
): Result<T, DomainError> {
  const session = open();
  if (!session.ok) return session;
  try {
    return action(session.value);
  } finally {
    session.value.close();
  }
}

/**
 * Implements the context-owned VaultSessions port by wiring vault concerns
 * (keychain, header) to the shared SQLite engine. This is the one place where
 * the context module depends on the vault module.
 */
export class SqliteVaultSessions implements VaultSessions {
  constructor(
    private readonly paths: VaultPaths,
    private readonly keychain: KeychainPort,
  ) {}

  withSession<T>(
    action: (session: VaultSession) => Result<T, DomainError>,
  ): Result<T, DomainError> {
    return runWithSession(() => this.open(), action);
  }

  private open(): Result<VaultSession, DomainError> {
    const header = readVaultHeader(this.paths.header);
    if (!header.ok) return header;

    const keyHex = this.requireKey(header.value.vaultId);
    if (!keyHex.ok) return keyHex;

    return this.openRepositories(header.value.vaultId, keyHex.value);
  }

  /** The session key must be present in the OS keychain — otherwise the vault is locked. */
  private requireKey(vaultId: string): Result<string, DomainError> {
    const keyHex = this.keychain.getKey(vaultId);
    if (keyHex === null) return vaultErr("VAULT_LOCKED", LOCKED_MESSAGE);
    return ok(keyHex);
  }

  private openRepositories(vaultId: string, keyHex: string): Result<VaultSession, DomainError> {
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
        this.keychain.deleteKey(vaultId);
        return vaultErr("VAULT_LOCKED", LOCKED_MESSAGE);
      }
      return vaultErr("STORAGE_ERROR", `Could not open vault: ${(error as Error).message}`);
    }
  }
}
