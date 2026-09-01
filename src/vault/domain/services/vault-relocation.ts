import { posix, win32 } from "node:path";
import type { DomainError } from "../../../shared/domain/result.js";
import type { VaultFolderInspection } from "../../application/ports/vault-folder.js";
import type { VaultRootInspection } from "../../application/ports/vault-mover.js";
import { vaultError } from "../errors.js";

export interface RelocationRequest {
  sourceRoot: string;
  destinationRoot: string;
  destinationInspection: VaultRootInspection;
  sourceInspection: VaultFolderInspection;
}

/** win32 and darwin both have case-insensitive filesystems by default (D-R(d)'s path-containment check must agree). */
function isCaseInsensitivePlatform(platform: NodeJS.Platform): boolean {
  return platform === "win32" || platform === "darwin";
}

/**
 * The `platform` argument, not the host OS, decides path semantics — `node:path`'s
 * default export is host-bound and would silently apply win32's own case-insensitive
 * `relative()` even when simulating "linux" on a Windows host (or vice versa).
 */
function pathModuleFor(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix;
}

/** True if `candidate`, after `resolve()`, is `root` itself or nested inside it. */
function isSameOrInside(root: string, candidate: string, platform: NodeJS.Platform): boolean {
  const { resolve, relative, isAbsolute } = pathModuleFor(platform);
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const [normalizedRoot, normalizedCandidate] = isCaseInsensitivePlatform(platform)
    ? [resolvedRoot.toLowerCase(), resolvedCandidate.toLowerCase()]
    : [resolvedRoot, resolvedCandidate];

  if (normalizedRoot === normalizedCandidate) return true;

  const rel = relative(normalizedRoot, normalizedCandidate);
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Every §4.7 step 30 refusal, in the order the wizard presents them — pure,
 * no I/O: both inspections are already computed by the caller. Returning
 * `null` means the move may proceed; nothing here has written anything
 * either way.
 */
export function refuseUnsafeRelocation(
  request: RelocationRequest,
  platform: NodeJS.Platform = process.platform,
): DomainError | null {
  const { sourceRoot, destinationRoot, destinationInspection, sourceInspection } = request;

  if (destinationInspection.hasHeader || destinationInspection.hasDb) {
    return vaultError(
      "RELOCATION_DESTINATION_OCCUPIED",
      `A vault already exists at ${destinationRoot}. Choose an empty folder.`,
    );
  }

  if (!destinationInspection.exists || !destinationInspection.writable) {
    return vaultError(
      "RELOCATION_DESTINATION_UNUSABLE",
      `${destinationRoot} does not exist or is not writable.`,
    );
  }

  if (isSameOrInside(sourceRoot, destinationRoot, platform)) {
    return vaultError(
      "RELOCATION_DESTINATION_NESTED",
      `${destinationRoot} is the current vault folder, or is inside it. Choose a different folder.`,
    );
  }

  if (sourceInspection.conflictedCopies.length > 0 || sourceInspection.staleBackups.length > 0) {
    return vaultError(
      "RELOCATION_SOURCE_UNSETTLED",
      `${sourceRoot} has an unresolved conflicted copy or leftover upgrade backup. Resolve it before moving the vault.`,
    );
  }

  if (sourceInspection.sidecars.length > 0) {
    return vaultError(
      "RELOCATION_SOURCE_UNSETTLED",
      `${sourceRoot} is not at rest — a write is in progress or was interrupted. Try again once it settles.`,
    );
  }

  return null;
}
