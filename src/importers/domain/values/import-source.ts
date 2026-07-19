import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { importerErr } from "../errors.js";

/**
 * Where an imported conversation came from. Part of the importers' ubiquitous
 * language: it names the parser, tags each imported item, and labels provenance
 * headers. Lives in the domain so every layer depends inward on it.
 */
export const IMPORT_SOURCES = ["chatgpt", "claude", "generic"] as const;

export type ImportSource = (typeof IMPORT_SOURCES)[number];

export function parseImportSource(raw: string): Result<ImportSource, DomainError> {
  if ((IMPORT_SOURCES as readonly string[]).includes(raw)) {
    return ok(raw as ImportSource);
  }
  return importerErr(
    "UNSUPPORTED_SOURCE",
    `Source must be one of ${IMPORT_SOURCES.join(", ")}. Got: "${raw}"`,
  );
}
