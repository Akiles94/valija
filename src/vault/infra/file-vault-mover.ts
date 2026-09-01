import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { resolveVaultPaths, type VaultPaths } from "../../shared/infra/vault-paths.js";
import type { VaultMover, VaultRootInspection } from "../application/ports/vault-mover.js";

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isWritable(root: string): boolean {
  try {
    accessSync(root, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * `copyFileSync` + `mkdirSync`, deliberately never a rename (D-R(b)): a
 * Dropbox folder on another volume is the normal case, and Node's rename
 * call fails across filesystems with `EXDEV`. Digests via `node:crypto`,
 * matching §9's cross-filesystem test (asserted by that rename call's
 * absence from this file, not by a mock).
 */
export class FileVaultMover implements VaultMover {
  inspect(root: string): VaultRootInspection {
    const paths = resolveVaultPaths(root);
    const exists = existsSync(root);
    return {
      exists,
      writable: exists && isWritable(root),
      hasHeader: existsSync(paths.header),
      hasDb: existsSync(paths.db),
    };
  }

  copy(from: VaultPaths, to: VaultPaths): void {
    mkdirSync(to.root, { recursive: true });
    copyFileSync(from.header, to.header);
    copyFileSync(from.db, to.db);
  }

  matches(from: VaultPaths, to: VaultPaths): boolean {
    return digest(from.header) === digest(to.header) && digest(from.db) === digest(to.db);
  }

  discard(paths: VaultPaths): void {
    for (const path of [paths.header, paths.db]) {
      try {
        rmSync(path, { force: true });
      } catch {
        // Best effort — a discard that can't remove a partial file is not
        // itself fatal; the caller decides what happens next.
      }
    }
  }

  remove(paths: VaultPaths): void {
    rmSync(paths.header);
    rmSync(paths.db);
  }
}
