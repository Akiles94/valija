import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

/** Monotonically increasing write counter for a vault's lineage. */
export type Generation = number & { readonly __brand: "Generation" };

/** Generation of a vault that has never been written to. */
export const GENERATION_ZERO = 0 as Generation;

/**
 * Accepts a non-negative integer (or its plain decimal string); fails with `INVALID_GENERATION`
 * otherwise.
 */
export function parseGeneration(raw: string | number): Result<Generation, DomainError> {
  // A string must be plain decimal digits — Number() would otherwise accept
  // "", "  ", "0x10" (→16) and "1e3" (→1000) as valid generations.
  if (typeof raw === "string" && !/^\d+$/.test(raw)) {
    return vaultErr(
      "INVALID_GENERATION",
      `Generation must be a non-negative integer. Got: "${raw}"`,
    );
  }
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isInteger(value) || value < 0) {
    return vaultErr(
      "INVALID_GENERATION",
      `Generation must be a non-negative integer. Got: "${raw}"`,
    );
  }
  return ok(value as Generation);
}

/** The generation a write advances the vault to. */
export const nextGeneration = (generation: Generation): Generation =>
  (generation + 1) as Generation;
