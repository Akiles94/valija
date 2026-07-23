import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

/** Monotonically increasing write counter for a vault's lineage. */
export type Generation = number & { readonly __brand: "Generation" };

export const GENERATION_ZERO = 0 as Generation;

export function parseGeneration(raw: string | number): Result<Generation, DomainError> {
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isInteger(value) || value < 0) {
    return vaultErr(
      "INVALID_GENERATION",
      `Generation must be a non-negative integer. Got: "${raw}"`,
    );
  }
  return ok(value as Generation);
}

export const nextGeneration = (generation: Generation): Generation =>
  (generation + 1) as Generation;
