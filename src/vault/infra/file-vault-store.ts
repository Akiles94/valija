import { existsSync, mkdirSync } from "node:fs";
import type { Clock, IdGenerator } from "../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { migrate } from "../../shared/infra/migrations.js";
import { isWrongKeyError, openVaultDb } from "../../shared/infra/sqlite.js";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { VaultHeaderData, VaultStore } from "../application/ports/vault-store.js";
import { vaultErr } from "../domain/errors.js";
import type { LineageStamp } from "../domain/services/vault-lineage.js";
import { SqliteLineageStore } from "./sqlite-lineage-store.js";
import { readVaultHeader, writeVaultHeader } from "./vault-header.js";

export class FileVaultStore implements VaultStore {
  constructor(
    private readonly paths: VaultPaths,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
  ) {}

  headerExists(): boolean {
    return existsSync(this.paths.header);
  }

  readHeader(): Result<VaultHeaderData, DomainError> {
    return readVaultHeader(this.paths.header);
  }

  writeHeader(header: VaultHeaderData): void {
    mkdirSync(this.paths.root, { recursive: true });
    writeVaultHeader(this.paths.header, header);
  }

  initializeDb(keyHex: string): Result<void, DomainError> {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      migrate(db, this.paths.db);
      db.close();
      return ok(undefined);
    } catch (error) {
      return vaultErr("STORAGE_ERROR", `Could not create vault db: ${(error as Error).message}`);
    }
  }

  verifyKey(keyHex: string): Result<void, DomainError> {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      db.close();
      return ok(undefined);
    } catch (error) {
      if (isWrongKeyError(error)) {
        return vaultErr("WRONG_PASSPHRASE", "Wrong passphrase (or recovery key) for this vault.");
      }
      return vaultErr("STORAGE_ERROR", `Could not open vault db: ${(error as Error).message}`);
    }
  }

  readLineage(keyHex: string): Result<LineageStamp | null, DomainError> {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      try {
        migrate(db, this.paths.db);
        return ok(new SqliteLineageStore(db, this.idGen, this.clock).read());
      } finally {
        db.close();
      }
    } catch (error) {
      if (isWrongKeyError(error)) {
        return vaultErr("WRONG_PASSPHRASE", "Wrong passphrase (or recovery key) for this vault.");
      }
      return vaultErr("STORAGE_ERROR", `Could not open vault db: ${(error as Error).message}`);
    }
  }

  dbPath(): string {
    return this.paths.db;
  }
}
