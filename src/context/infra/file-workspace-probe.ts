import { lstatSync, readFileSync, realpathSync, type Stats, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { isSameOrInside } from "../../shared/domain/services/path-containment.js";
import type { WorkspaceProbe } from "../application/ports/workspace-probe.js";
import { contextErr } from "../domain/errors.js";
import {
  type FolderTarget,
  parseFolderTarget,
  type WorkspaceLocation,
} from "../domain/values/binding-target.js";
import {
  parseRepositoryTarget,
  type RepositoryTarget,
} from "../domain/values/repository-target.js";
import { chooseRemote, remoteUrls } from "./git/git-config.js";

/** How far up the probe walks looking for `.git` before giving up. */
const MAX_LEVELS = 64;
/** A `.git` file (worktree, submodule) or a `commondir` file is one short line. */
const MAX_POINTER_BYTES = 4 * 1024;
/** A larger config is not something a person wrote; it is treated as having no usable remote. */
const MAX_CONFIG_BYTES = 256 * 1024;
const GITDIR_PREFIX = "gitdir:";

interface GitDir {
  readonly workTree: FolderTarget;
  /** `null` when the repository's metadata cannot be followed (malformed `.git` file, symlinked `.git`). */
  readonly gitDir: string | null;
}

/**
 * Reads a workspace from the local filesystem only: `node:fs`, `node:path` and
 * `node:os`. It never runs `git`, never follows `include.path`, caps every read
 * and bounds its upward walk (D-J). The raw remote URL goes straight to
 * `parseRepositoryTarget` and is never stored, returned or logged.
 */
export class FileWorkspaceProbe implements WorkspaceProbe {
  constructor(
    private readonly home: string = homedir(),
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  locate(directory: string): Result<WorkspaceLocation, DomainError> {
    const folder = this.canonicalDirectory(directory);
    if (!folder.ok) return folder;
    const git = this.findGitDir(folder.value);
    return ok({
      folder: folder.value,
      repositoryRoot: git?.workTree ?? null,
      repository: git === null || git.gitDir === null ? null : this.readRemote(git.gitDir),
      tooBroadToLink: this.isTooBroad(folder.value),
    });
  }

  /** Symlinks resolved, and it must be a directory. The message never names the path. */
  private canonicalDirectory(directory: string): Result<FolderTarget, DomainError> {
    try {
      const real = realpathSync.native(directory);
      if (statSync(real).isDirectory()) return parseFolderTarget(real, this.platform);
    } catch {
      // Missing, unreadable, or not resolvable: the same answer as "not a folder".
    }
    return contextErr(
      "INVALID_WORKSPACE_PATH",
      "That folder does not exist, is not a folder, or cannot be read.",
    );
  }

  /** The nearest `.git` at or above `folder`, stopping at the filesystem root or after 64 levels. */
  private findGitDir(folder: FolderTarget): GitDir | null {
    let dir: string = folder;
    for (let level = 0; level < MAX_LEVELS; level += 1) {
      const found = this.gitDirAt(dir);
      if (found !== null) return found;
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
    return null;
  }

  /** A `.git` directory, or a `.git` file pointing at one (worktrees, submodules). */
  private gitDirAt(dir: string): GitDir | null {
    const dotGit = join(dir, ".git");
    const stats = lstatOrNull(dotGit);
    if (stats === null) return null;
    const workTree = dir as FolderTarget;
    if (stats.isDirectory()) return { workTree, gitDir: dotGit };
    if (!stats.isFile()) return { workTree, gitDir: null };
    return { workTree, gitDir: this.followPointer(dotGit, dir, GITDIR_PREFIX) };
  }

  /** The remote of the repository whose metadata lives in `gitDir`; `null` when it has none valija can use. */
  private readRemote(gitDir: string): RepositoryTarget | null {
    const commonDir = this.followPointer(join(gitDir, "commondir"), gitDir, "") ?? gitDir;
    const config = readCapped(join(commonDir, "config"), MAX_CONFIG_BYTES);
    if (config === null) return null;
    const url = chooseRemote(remoteUrls(config));
    if (url === null) return null;
    const target = parseRepositoryTarget(url);
    return target.ok ? target.value : null;
  }

  /** A one-line pointer file (`gitdir: <path>`, or a bare path for `commondir`), resolved against `base`. */
  private followPointer(file: string, base: string, prefix: string): string | null {
    const text = readCapped(file, MAX_POINTER_BYTES);
    const line = text?.split(/\r?\n/)[0]?.trim();
    if (line === undefined || !line.toLowerCase().startsWith(prefix)) return null;
    const target = line.slice(prefix.length).trim();
    return target === "" ? null : resolve(base, target);
  }

  /** The filesystem root or the home folder itself (P-4). */
  private isTooBroad(folder: FolderTarget): boolean {
    if (dirname(folder) === folder) return true;
    const home = canonicalOrSelf(this.home);
    return (
      isSameOrInside(folder, home, this.platform) && isSameOrInside(home, folder, this.platform)
    );
  }
}

function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

/** Only a regular file within `maxBytes` is read: never a FIFO or device that could block. */
function readCapped(path: string, maxBytes: number): string | null {
  try {
    const stats = statSync(path);
    if (!stats.isFile() || stats.size > maxBytes) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function canonicalOrSelf(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}
