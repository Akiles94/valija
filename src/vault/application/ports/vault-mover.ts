import type { VaultPaths } from "../../../shared/infra/vault-paths.js";

/** What relocation needs to know about a candidate destination folder before it writes anything. */
export interface VaultRootInspection {
  exists: boolean;
  writable: boolean;
  hasHeader: boolean;
  hasDb: boolean;
}

/**
 * The file-move half of relocation, kept separate from `VaultStore` (which
 * knows how to open a *particular* vault, not move one) — five small,
 * trivially fakeable methods so `RelocateVault`'s tests can drive every
 * failure stage without touching a real filesystem.
 */
export interface VaultMover {
  inspect(root: string): VaultRootInspection;
  /** Copies both vault files to `to` — never a rename (D-R(b)): a cross-filesystem destination must work. */
  copy(from: VaultPaths, to: VaultPaths): void;
  /** Byte-for-byte identity of both files at `from` and `to`. */
  matches(from: VaultPaths, to: VaultPaths): boolean;
  /** Removes any partial files a failed copy left at `paths` — best effort, never throws. */
  discard(paths: VaultPaths): void;
  remove(paths: VaultPaths): void;
}
