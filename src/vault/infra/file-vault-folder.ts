import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { VaultFolder, VaultFolderInspection } from "../application/ports/vault-folder.js";

const SIDECAR_SUFFIXES = ["-wal", "-shm", "-journal"];

// Matched case-insensitively against the vault root path: a real synced path
// may be ~/dropbox/valija or ~/Library/Mobile Documents/... as easily as ~/Dropbox/valija.
const CLOUD_PATH_MARKERS = ["dropbox", "onedrive", "google drive", "mobile documents"];
// Vendor "this folder is synced" marker files/dirs, if one sits in the vault root.
const CLOUD_MARKER_FILES = [".dropbox", ".dropbox.cache", ".stfolder", ".stversions"];

// Vendor conflicted-copy names. Dropbox's real form is
// "<name> (<user>'s conflicted copy <date>).<ext>" — the "(" is followed by the
// username, so the stable marker is the phrase "conflicted copy", NOT "(conflicted copy".
// Syncthing uses ".sync-conflict-". (OneDrive renames to "<name>-<hostname>.<ext>",
// which has no reliable marker and is intentionally not matched — see docs/sync.md.)
const CONFLICTED_COPY_PATTERNS = [/conflicted[ -]?copy/i, /\.sync-conflict-/i];

// A pre-upgrade ciphertext backup a migration left behind: "vault.db.pre-003.bak".
// Removed on a successful upgrade, kept on a failed one — a lingering one means the
// folder is not a single file at rest, so doctor should point it out.
const STALE_BACKUP_PATTERN = /\.pre-\d+\.bak$/i;

/** Filesystem-backed VaultFolder — inspects the vault root, never opens the database. */
export class FileVaultFolder implements VaultFolder {
  constructor(private readonly paths: VaultPaths) {}

  inspect(): VaultFolderInspection {
    const entries = this.rootEntries();
    return {
      sidecars: this.sidecars(),
      conflictedCopies: this.matching(entries, CONFLICTED_COPY_PATTERNS),
      staleBackups: this.matching(entries, [STALE_BACKUP_PATTERN]),
      looksLikeCloud: this.looksLikeCloud(entries),
    };
  }

  private sidecars(): string[] {
    return SIDECAR_SUFFIXES.map((suffix) => `${this.paths.db}${suffix}`).filter((path) =>
      existsSync(path),
    );
  }

  private rootEntries(): string[] {
    if (!existsSync(this.paths.root)) return [];
    return readdirSync(this.paths.root);
  }

  /** Entries matching any pattern, as absolute paths (consistent with `sidecars`). */
  private matching(entries: string[], patterns: RegExp[]): string[] {
    return entries
      .filter((name) => patterns.some((pattern) => pattern.test(name)))
      .map((name) => join(this.paths.root, name));
  }

  private looksLikeCloud(entries: string[]): boolean {
    const root = this.paths.root.toLowerCase();
    if (CLOUD_PATH_MARKERS.some((marker) => root.includes(marker))) return true;
    return entries.some((name) => CLOUD_MARKER_FILES.includes(name));
  }
}
