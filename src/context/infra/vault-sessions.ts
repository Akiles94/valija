import type { Database } from "better-sqlite3-multiple-ciphers";
import type { Clock, IdGenerator } from "../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { migrate } from "../../shared/infra/migrations.js";
import { isWrongKeyError, openVaultDb } from "../../shared/infra/sqlite.js";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { SessionGuard } from "../../vault/application/policies/session-guard.js";
import type { DeviceIdentity } from "../../vault/application/ports/device-identity.js";
import type { KeychainPort } from "../../vault/application/ports/keychain.js";
import { LOCKED_MESSAGE, vaultErr } from "../../vault/domain/errors.js";
import type { LineageStamp } from "../../vault/domain/services/vault-lineage.js";
import type { DeviceId } from "../../vault/domain/values/device-id.js";
import { SqliteLineageStore } from "../../vault/infra/sqlite-lineage-store.js";
import { readVaultHeader } from "../../vault/infra/vault-header.js";
import type { VaultSession, VaultSessions } from "../application/ports/vault-session.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { SqliteProjectRepository } from "./project-repo.js";

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

/** Thrown inside a db.transaction to force a rollback when the mutation itself failed. */
class WriteFailedSentinel extends Error {
  constructor(readonly error: DomainError) {
    super("write-failed-sentinel");
  }
}

/**
 * Implements the context-owned VaultSessions port by wiring vault concerns
 * (keychain, header, lineage) to the shared SQLite engine. This is the one
 * place where the context module depends on the vault module.
 */
export class SqliteVaultSessions implements VaultSessions {
  constructor(
    private readonly paths: VaultPaths,
    private readonly keychain: KeychainPort,
    private readonly deviceIdentity: DeviceIdentity,
    private readonly guard: SessionGuard,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
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

    const guarded = this.guard.guard(header.value.vaultId);
    if (!guarded.ok) return guarded;

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
      migrate(db, this.paths.db);
      const lineageStore = new SqliteLineageStore(db, this.idGen, this.clock);
      const writer = this.deviceIdentity.deviceId();
      return ok({
        projects: new SqliteProjectRepository(db),
        items: new SqliteContextItemRepository(db),
        write: <T>(mutate: () => Result<T, DomainError>) =>
          this.commitWrite(db, lineageStore, writer, vaultId, mutate),
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

  /**
   * Run `mutate` inside the db transaction; only on success does it bump the
   * lineage stamp, atomically with the mutation. A failed mutation rolls back
   * (bump included) via a sentinel throw, since better-sqlite3's transaction
   * commits on normal return and rolls back on throw. Last-seen is recorded
   * only after the transaction has actually committed.
   */
  private commitWrite<T>(
    db: Database,
    lineageStore: SqliteLineageStore,
    writer: DeviceId,
    vaultId: string,
    mutate: () => Result<T, DomainError>,
  ): Result<T, DomainError> {
    let bumped: LineageStamp | null = null;
    let outcome: Result<T, DomainError>;
    try {
      outcome = db.transaction(() => {
        const result = mutate();
        if (!result.ok) throw new WriteFailedSentinel(result.error);
        bumped = lineageStore.bump(writer);
        return result;
      })();
    } catch (error) {
      if (error instanceof WriteFailedSentinel) {
        return { ok: false, error: error.error };
      }
      throw error;
    }
    if (bumped !== null) {
      const stamp: LineageStamp = bumped;
      this.deviceIdentity.recordSeen(vaultId, {
        generation: stamp.generation,
        writeStamp: stamp.writeStamp,
      });
    }
    return outcome;
  }
}
