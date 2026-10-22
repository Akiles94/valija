import type { DomainError } from "../../../shared/domain/result.js";
import { isSameOrInside } from "../../../shared/domain/services/path-containment.js";
import type { VaultFolderInspection } from "../../application/ports/vault-folder.js";
import type { VaultRootInspection } from "../../application/ports/vault-mover.js";
import { vaultError } from "../errors.js";

/** Everything the relocation safety rules look at: both folders and what is currently in them. */
export interface RelocationRequest {
  sourceRoot: string;
  destinationRoot: string;
  destinationInspection: VaultRootInspection;
  sourceInspection: VaultFolderInspection;
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
