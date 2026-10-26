/** Sync-safety signals about the vault folder on disk, read without decrypting anything. */
export interface VaultFolderInspection {
  /** Which of vault.db-wal / -shm / -journal exist right now (absolute). Non-empty at rest is a red flag. */
  readonly sidecars: string[];
  /** Vendor "conflicted copy" files a sync client left behind after a fork (absolute). */
  readonly conflictedCopies: string[];
  /** Pre-upgrade ".pre-NNN.bak" backups a migration left behind (absolute); a lingering one means a failed upgrade. */
  readonly staleBackups: string[];
  /**
   * "vault.db.pre-rekey.bak" copies a passphrase change left behind (absolute). Each is still
   * encrypted with the PREVIOUS key: a leftover one means a change crashed or could not clean up.
   */
  readonly rekeyBackups: string[];
  /** Best-effort hint that the vault root looks like a recognized cloud-sync folder. */
  readonly looksLikeCloud: boolean;
}

/** Reads the vault folder's filesystem state — sync-safety signals only, never vault content. */
export interface VaultFolder {
  inspect(): VaultFolderInspection;
}
