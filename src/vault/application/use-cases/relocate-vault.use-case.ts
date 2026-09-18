import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, err, ok, type Result } from "../../../shared/domain/result.js";
import { resolveVaultPaths, type VaultPaths } from "../../../shared/infra/vault-paths.js";
import { vaultErr } from "../../domain/errors.js";
import { refuseUnsafeRelocation } from "../../domain/services/vault-relocation.js";
import { readVaultHeader } from "../../infra/vault-header.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { VaultFolder } from "../ports/vault-folder.js";
import type { VaultMover } from "../ports/vault-mover.js";
import type { VaultStore } from "../ports/vault-store.js";

export interface RelocateVaultOutput {
  root: string;
  vaultId: string;
}

/**
 * The file-move half of relocation (D-R(c) Option 1) — re-pointing already-
 * connected AI clients is deliberately **not** this use case's job (D-R(a)'s
 * "no use case calls another"); `desktop/.../relocation-handlers.ts`
 * orchestrates that, strictly after this returns `ok`.
 *
 * There is no `keyHex` anywhere in this file: `VAULT_MUST_BE_LOCKED` is
 * checked (and enforced) before anything else runs, so relocation never
 * has — and never needs — the key. `RelocateVaultOutput` carries no
 * `generation` for the same reason: an encrypted vault's lineage cannot be
 * read without the key it was just proven not to have. "Same lineage
 * generation after the move" is proven by re-reading it once re-unlocked,
 * not by this use case.
 */
export class RelocateVault implements UseCase<string, RelocateVaultOutput> {
  constructor(
    private readonly store: VaultStore,
    private readonly keychain: KeychainPort,
    private readonly mover: VaultMover,
    private readonly folder: VaultFolder,
    private readonly sourcePaths: VaultPaths,
  ) {}

  execute(destinationRoot: string): Result<RelocateVaultOutput, DomainError> {
    const header = this.store.readHeader();
    if (!header.ok) return header;
    const { vaultId } = header.value;

    if (this.keychain.getKey(vaultId) !== null) {
      return vaultErr(
        "VAULT_MUST_BE_LOCKED",
        "Lock the vault before moving it — relocation refuses to run against an unlocked vault.",
      );
    }

    const destinationPaths = resolveVaultPaths(destinationRoot);
    const refusal = refuseUnsafeRelocation({
      sourceRoot: this.sourcePaths.root,
      destinationRoot,
      destinationInspection: this.mover.inspect(destinationRoot),
      sourceInspection: this.folder.inspect(),
    });
    if (refusal !== null) return err(refusal);

    return this.moveVerifyAndRemoveSource(vaultId, destinationPaths);
  }

  private moveVerifyAndRemoveSource(
    vaultId: string,
    destinationPaths: VaultPaths,
  ): Result<RelocateVaultOutput, DomainError> {
    try {
      this.mover.copy(this.sourcePaths, destinationPaths);
    } catch (error) {
      this.mover.discard(destinationPaths);
      return vaultErr("RELOCATION_COPY_FAILED", `Could not copy the vault: ${describe(error)}`);
    }

    if (!this.mover.matches(this.sourcePaths, destinationPaths)) {
      this.mover.discard(destinationPaths);
      return vaultErr(
        "RELOCATION_VERIFY_FAILED",
        "The copied vault does not match the original byte-for-byte.",
      );
    }

    const destinationHeader = readVaultHeader(destinationPaths.header);
    if (!destinationHeader.ok) {
      this.mover.discard(destinationPaths);
      return vaultErr(
        "RELOCATION_VERIFY_FAILED",
        `The copied vault's header could not be read: ${destinationHeader.error.message}`,
      );
    }

    // The source is removed only now that the destination is verified
    // complete and correct — never "delete then copy" (§8.12).
    try {
      this.mover.remove(this.sourcePaths);
    } catch (error) {
      return this.rollBack(destinationPaths, error);
    }

    return ok({ root: destinationPaths.root, vaultId });
  }

  /**
   * The one genuinely awkward failure (§9 item 64): the copy verified, but
   * removing the source failed. Two openable copies of the same vault id is
   * the exact fork scenario M3 exists to prevent, so the destination is
   * discarded and the source stays the one vault — unless the discard
   * itself also fails, in which case both folders are named and the user
   * must act.
   */
  private rollBack(
    destinationPaths: VaultPaths,
    removeError: unknown,
  ): Result<RelocateVaultOutput, DomainError> {
    try {
      this.mover.discard(destinationPaths);
    } catch (discardError) {
      return vaultErr(
        "RELOCATION_ROLLBACK_FAILED",
        `Removing the old vault at ${this.sourcePaths.root} failed (${describe(removeError)}), ` +
          `and cleaning up the copy at ${destinationPaths.root} also failed (${describe(discardError)}). ` +
          "Delete one of these two folders by hand before trying again.",
      );
    }
    return vaultErr(
      "RELOCATION_COPY_FAILED",
      `The vault was copied and verified, but the old copy at ${this.sourcePaths.root} could not ` +
        `be removed: ${describe(removeError)}. Nothing was lost — that folder is still your vault.`,
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
