import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { pathModuleFor } from "../../../shared/domain/services/path-containment.js";
import { contextErr } from "../errors.js";
import type { RepositoryTarget } from "./repository-target.js";

export const BINDING_KINDS = ["folder", "repository"] as const;

/** What a binding points at: one folder (and everything under it), or one git repository. */
export type BindingKind = (typeof BINDING_KINDS)[number];

/** A canonical absolute directory path (symlinks already resolved by the probe). */
export type FolderTarget = string & { readonly __brand: "FolderTarget" };

/** Where work is happening: a directory, and the git repository around it if there is one. */
export interface WorkspaceLocation {
  readonly folder: FolderTarget;
  readonly repositoryRoot: FolderTarget | null;
  readonly repository: RepositoryTarget | null;
  /** The filesystem root or the user's home: too broad to link as a folder (P-4). */
  readonly tooBroadToLink: boolean;
}

const POSIX_SEPARATOR = /\/$/;
const WIN32_SEPARATOR = /[\\/]$/;
const DRIVE_LETTER = /^[a-z]:/;

/** Never echoes `raw`: a folder path is the user's machine layout, not something to repeat back. */
export function parseFolderTarget(
  raw: string,
  platform: NodeJS.Platform = process.platform,
): Result<FolderTarget, DomainError> {
  const trimmed = raw.trim();
  if (trimmed === "" || !pathModuleFor(platform).isAbsolute(trimmed)) {
    return contextErr("INVALID_WORKSPACE_PATH", "That folder is not an absolute path.");
  }
  const stripped = stripTrailingSeparators(trimmed, platform);
  return ok(upperCaseDriveLetter(stripped, platform) as FolderTarget);
}

/** Number of path segments, used to rank folder bindings: the deepest match wins (D-E). */
export function folderDepth(folder: FolderTarget): number {
  return folder.split(/[\\/]/).filter((segment) => segment.length > 0).length;
}

function stripTrailingSeparators(path: string, platform: NodeJS.Platform): string {
  const root = pathModuleFor(platform).parse(path).root;
  const separator = platform === "win32" ? WIN32_SEPARATOR : POSIX_SEPARATOR;
  let result = path;
  while (result.length > root.length && separator.test(result)) result = result.slice(0, -1);
  return result;
}

function upperCaseDriveLetter(path: string, platform: NodeJS.Platform): string {
  if (platform !== "win32" || !DRIVE_LETTER.test(path)) return path;
  return path.charAt(0).toUpperCase() + path.slice(1);
}
