import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import SqliteDatabase from "better-sqlite3-multiple-ciphers";
import type { VaultPaths } from "../shared/infra/vault-paths.js";

/**
 * Patch only the `meta.schema_version` marker, through a raw connection (openVaultDb would refuse
 * past LATEST). Simulates a vault upgraded by a newer valija, or left behind by an older one.
 */
export function setStoredSchemaVersion(dbPath: string, keyHex: string, version: number): void {
  const db = new SqliteDatabase(dbPath, { fileMustExist: true });
  try {
    db.pragma("cipher='sqlcipher'");
    db.pragma(`key="x'${keyHex}'"`);
    db.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(String(version));
  } finally {
    db.close();
  }
}

export interface VaultFilesSnapshot {
  header: string;
  db: string;
  entries: string[];
}

/** sha256 of vault.json and vault.db plus the sorted folder listing — "the vault is untouched" in one equality. */
export function snapshotVaultFiles(paths: VaultPaths): VaultFilesSnapshot {
  return {
    header: sha256(paths.header),
    db: sha256(paths.db),
    entries: readdirSync(paths.root).sort(),
  };
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
