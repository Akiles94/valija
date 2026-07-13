import { existsSync, mkdirSync } from "node:fs";
import { type DomainError, domainErr, ok, type Result } from "../domain/errors.js";
import type { VaultHeaderData, VaultStore } from "../domain/ports/vault-store.js";
import { readVaultHeader, writeVaultHeader } from "./crypto/vault-header.js";
import { isWrongKeyError, openVaultDb } from "./db/connection.js";
import { migrate } from "./db/migrations.js";
import type { VaultPaths } from "./vault-paths.js";

export class FileVaultStore implements VaultStore {
  constructor(private readonly paths: VaultPaths) {}

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
      migrate(db);
      db.close();
      return ok(undefined);
    } catch (error) {
      return domainErr("STORAGE_ERROR", `Could not create vault db: ${(error as Error).message}`);
    }
  }

  verifyKey(keyHex: string): Result<void, DomainError> {
    try {
      const db = openVaultDb(this.paths.db, keyHex);
      db.close();
      return ok(undefined);
    } catch (error) {
      if (isWrongKeyError(error)) {
        return domainErr("WRONG_PASSPHRASE", "Wrong passphrase (or recovery key) for this vault.");
      }
      return domainErr("STORAGE_ERROR", `Could not open vault db: ${(error as Error).message}`);
    }
  }

  dbPath(): string {
    return this.paths.db;
  }
}
