import type { DomainError } from "../../../shared/domain/result.js";
import type { VaultFolderInspection } from "../../application/ports/vault-folder.js";
import { vaultError } from "../errors.js";

/**
 * Every file that keeps the vault folder from being "a single vault at rest" (D-I): sidecars,
 * conflicted copies, leftover upgrade backups and leftover passphrase-change backups, in one list.
 */
export function unsettledFiles(inspection: VaultFolderInspection): string[] {
  return [
    ...inspection.sidecars,
    ...inspection.conflictedCopies,
    ...inspection.staleBackups,
    ...inspection.rekeyBackups,
  ];
}

/**
 * Refuses to re-encrypt an unsettled folder, naming every file to resolve — pure, no I/O.
 * Returning `null` means the folder is settled.
 */
export function refuseUnsettledFolder(inspection: VaultFolderInspection): DomainError | null {
  const files = unsettledFiles(inspection);
  if (files.length === 0) return null;
  return vaultError(
    "VAULT_FOLDER_UNSETTLED",
    `Settle the vault folder first — resolve or remove: ${files.join(", ")}. Nothing was changed.`,
  );
}
