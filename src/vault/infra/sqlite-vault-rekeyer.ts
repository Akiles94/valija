import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
} from "node:fs";
import type { Database } from "better-sqlite3-multiple-ciphers";
import type { Clock, IdGenerator } from "../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { SchemaTooNewError } from "../../shared/infra/migrations.js";
import { isBusyError, isWrongKeyError, openVaultDb } from "../../shared/infra/sqlite.js";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { RekeyRequest, VaultRekeyer } from "../application/ports/vault-rekeyer.js";
import { schemaTooNewErr, vaultErr } from "../domain/errors.js";
import type { LineageStamp } from "../domain/services/vault-lineage.js";
import type { DeviceId } from "../domain/values/device-id.js";
import { isKeyHex } from "../domain/values/key-hex.js";
import { SqliteLineageStore } from "./sqlite-lineage-store.js";

/** Where the pre-rekey ciphertext copy lives, next to vault.db (FileVaultFolder recognises it). */
export const REKEY_BACKUP_SUFFIX = ".pre-rekey.bak";

/** Free space required, as a multiple of vault.db (P-8 (a)): backup + journal measured ≈ 2×. */
export const REKEY_SPACE_FACTOR = 3;

/** What a re-encryption refused because another process held the vault past the busy timeout says. */
export const REKEY_BUSY_MESSAGE =
  "The vault is busy: another valija process held it for more than 5 s. Nothing was changed. Try again.";

/** Stage markers, in order — observed only by the fault-injection test. */
export type RekeyStage =
  | "locked"
  | "bumped"
  | "backed-up"
  | "rekeying"
  | "rekeyed"
  | "released"
  | "verified";

const NOTHING_CHANGED = "Nothing changed: your current passphrase still works.";
const CIPHER_SALT = /^[0-9a-f]{32}$/i;

/**
 * Re-encrypts vault.db in place under SQLCipher (D-E 1′): exclusive lock, lineage bump, a fsynced
 * ciphertext backup, then `PRAGMA rekey` with the raw new key plus the CURRENT cipher salt and
 * `cache_spill = OFF`, so a crash or a write error always rolls back under the old key. A fresh
 * connection verifies the result before the backup is deleted; a failure restores the backup.
 * Error messages carry SQLite codes only — never `error.message`, so never a key-bearing pragma.
 */
export class SqliteVaultRekeyer implements VaultRekeyer {
  constructor(
    private readonly paths: VaultPaths,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
    private readonly onStage: (stage: RekeyStage) => void = () => {},
  ) {}

  rekey(request: RekeyRequest): Result<LineageStamp, DomainError> {
    if (!isKeyHex(request.newKeyHex)) {
      return vaultErr("REKEY_FAILED", `The new key is malformed. ${NOTHING_CHANGED}`);
    }
    const room = this.ensureRoom();
    if (!room.ok) return room;
    const db = this.openExclusively(request.currentKeyHex);
    if (!db.ok) return db;
    let stamp: LineageStamp;
    try {
      stamp = this.bumpLineage(db.value, request.writer);
      this.backUp();
      this.reencrypt(db.value, request.newKeyHex);
    } catch (error) {
      closeQuietly(db.value);
      return this.recoverFrom(failureCode(error), request.currentKeyHex);
    }
    this.release(db.value);
    if (!this.verify(request.newKeyHex, stamp)) return this.restoreBackup("did not verify");
    rmSync(this.backupPath(), { force: true });
    return ok(stamp);
  }

  /** D-P: refuse before anything is written when the backup and the journal may not fit. */
  private ensureRoom(): Result<void, DomainError> {
    if (!existsSync(this.paths.db)) {
      return vaultErr(
        "STORAGE_ERROR",
        `No vault database at ${this.paths.db}. Nothing was changed.`,
      );
    }
    const needed = REKEY_SPACE_FACTOR * statSync(this.paths.db).size;
    const free = freeBytes(this.paths.root);
    if (free === null || free >= needed) return ok(undefined); // A2: unknown free space → rely on rollback
    return vaultErr(
      "STORAGE_ERROR",
      `Not enough free disk space to re-encrypt the vault (needs about ${megabytes(needed)} MB, ${megabytes(free)} MB free). Nothing was changed.`,
    );
  }

  /** Opens with the current key and takes the exclusive lock, held until `release` (P-2 (a)). */
  private openExclusively(keyHex: string): Result<Database, DomainError> {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      try {
        db.pragma("locking_mode = EXCLUSIVE");
        db.exec("BEGIN EXCLUSIVE");
        db.exec("COMMIT");
      } catch (error) {
        closeQuietly(db);
        throw error;
      }
      this.onStage("locked");
      return ok(db);
    } catch (error) {
      return refusalToStart(error);
    }
  }

  /** D-K, P-3 (a): its own IMMEDIATE transaction, under the old key, before the backup. */
  private bumpLineage(db: Database, writer: DeviceId): LineageStamp {
    const lineage = new SqliteLineageStore(db, this.idGen, this.clock);
    const stamp = db.transaction(() => lineage.bump(writer)).immediate();
    this.onStage("bumped");
    return stamp;
  }

  private backUp(): void {
    copyFileSync(this.paths.db, this.backupPath());
    const fd = openSync(this.backupPath(), "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.onStage("backed-up");
  }

  /** The raw-key form only (F4), keeping the cipher salt, with no cache spill (spike D-E 1′). */
  private reencrypt(db: Database, newKeyHex: string): void {
    const salt = String(db.pragma("cipher_salt", { simple: true }));
    if (!CIPHER_SALT.test(salt)) throw codedError("CIPHER_SALT_UNREADABLE");
    db.pragma("cache_spill = OFF");
    this.onStage("rekeying");
    const outcome = db.pragma(`rekey="x'${newKeyHex}${salt}'"`, { simple: true });
    if (outcome !== "ok") throw codedError("REKEY_NOT_OK");
    this.onStage("rekeyed");
  }

  /** Spike S5: back to NORMAL plus one read deletes the exclusive-mode journal before close. */
  private release(db: Database): void {
    try {
      db.pragma("locking_mode = NORMAL");
      db.prepare("SELECT count(*) FROM sqlite_master").get();
    } catch {
      // verify() below decides whether the re-encrypted file is sound.
    } finally {
      closeQuietly(db);
    }
    this.onStage("released");
  }

  /** P-21 (a): a fresh connection, integrity_check, and the lineage stamp equals the bump. */
  private verify(newKeyHex: string, stamp: LineageStamp): boolean {
    const verified = this.opensIntact(newKeyHex, (db) => {
      const current = new SqliteLineageStore(db, this.idGen, this.clock).read();
      return current?.writeStamp === stamp.writeStamp;
    });
    if (verified) this.onStage("verified");
    return verified;
  }

  /** The engine rolled back (F2): when the old key verifiably opens, nothing changed (P-7 (a)). */
  private recoverFrom(code: string, currentKeyHex: string): Result<never, DomainError> {
    if (!this.opensIntact(currentKeyHex)) return this.restoreBackup(code);
    rmSync(this.backupPath(), { force: true });
    return vaultErr("REKEY_FAILED", `Re-encrypting the vault failed (${code}). ${NOTHING_CHANGED}`);
  }

  /** Spike S8: delete any journal first, so no stale rollback lands on the restored backup. */
  private restoreBackup(cause: string): Result<never, DomainError> {
    const backup = this.backupPath();
    if (!existsSync(backup)) {
      return vaultErr(
        "REKEY_FAILED",
        `Re-encrypting the vault failed (${cause}) and it could not be confirmed intact. Run "valija doctor".`,
      );
    }
    try {
      rmSync(`${this.paths.db}-journal`, { force: true });
      renameSync(backup, this.paths.db);
    } catch {
      return vaultErr(
        "REKEY_FAILED",
        `Re-encrypting the vault failed (${cause}) and restoring its backup failed too. Your previous vault is intact in ${backup}: close valija everywhere, then rename it to ${this.paths.db}. Your current passphrase opens it.`,
      );
    }
    return vaultErr(
      "REKEY_FAILED",
      `Re-encrypting the vault failed (${cause}). Your previous vault was restored from its backup; your current passphrase still works.`,
    );
  }

  private opensIntact(keyHex: string, alsoCheck: (db: Database) => boolean = () => true): boolean {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      try {
        return db.pragma("integrity_check", { simple: true }) === "ok" && alsoCheck(db);
      } finally {
        db.close();
      }
    } catch {
      return false;
    }
  }

  private backupPath(): string {
    return `${this.paths.db}${REKEY_BACKUP_SUFFIX}`;
  }
}

function refusalToStart(error: unknown): Result<never, DomainError> {
  if (error instanceof SchemaTooNewError) {
    return schemaTooNewErr(error.vaultVersion, error.supportedVersion);
  }
  if (isBusyError(error)) return vaultErr("STORAGE_ERROR", REKEY_BUSY_MESSAGE);
  if (isWrongKeyError(error)) {
    return vaultErr(
      "WRONG_PASSPHRASE",
      "The current passphrase or recovery key does not open the vault.",
    );
  }
  return vaultErr(
    "REKEY_FAILED",
    `Re-encrypting the vault could not start (${failureCode(error)}). ${NOTHING_CHANGED}`,
  );
}

function freeBytes(dir: string): number | null {
  try {
    const stats = statfsSync(dir);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

const megabytes = (bytes: number): number => Math.ceil(bytes / (1024 * 1024));

/** The SQLite or filesystem code only (`SQLITE_FULL`, `ENOSPC`, …) — never the message text. */
function failureCode(error: unknown): string {
  const code =
    error instanceof Error && "code" in error ? (error as { code?: unknown }).code : null;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "unexpected error";
}

function codedError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function closeQuietly(db: Database): void {
  try {
    if (db.open) db.close();
  } catch {
    // Already closed or unusable; nothing left to release.
  }
}
