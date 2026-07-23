import { existsSync, readdirSync } from "node:fs";
import type { VaultPaths } from "../../shared/infra/vault-paths.js";
import type { VaultFolder, VaultFolderInspection } from "../application/ports/vault-folder.js";

const SIDECAR_SUFFIXES = ["-wal", "-shm", "-journal"];
const CLOUD_MARKERS = ["Dropbox", "OneDrive", "Google Drive", "Mobile Documents"];
const CONFLICTED_COPY_PATTERNS = [/\(conflicted copy.*\)/i, /\.sync-conflict-/i, /\(conflicted\)/i];

/** Filesystem-backed VaultFolder — inspects the vault root, never opens the database. */
export class FileVaultFolder implements VaultFolder {
  constructor(private readonly paths: VaultPaths) {}

  inspect(): VaultFolderInspection {
    return {
      sidecars: this.sidecars(),
      conflictedCopies: this.conflictedCopies(),
      looksLikeCloud: CLOUD_MARKERS.some((marker) => this.paths.root.includes(marker)),
    };
  }

  private sidecars(): string[] {
    return SIDECAR_SUFFIXES.map((suffix) => `${this.paths.db}${suffix}`).filter((path) =>
      existsSync(path),
    );
  }

  private conflictedCopies(): string[] {
    if (!existsSync(this.paths.root)) return [];
    return readdirSync(this.paths.root).filter((name) =>
      CONFLICTED_COPY_PATTERNS.some((pattern) => pattern.test(name)),
    );
  }
}
