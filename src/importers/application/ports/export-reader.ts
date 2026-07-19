import type { DomainError, Result } from "../../../shared/domain/result.js";

/**
 * Turns a file path into candidate JSON documents for the parsers: one document
 * for a plain `.json` export, one per `.json` entry for a `.zip`. Keeps fflate
 * and the filesystem out of the parsers, which stay pure and fixture-testable.
 */
export interface ExportReader {
  read(filePath: string): Result<unknown[], DomainError>;
}
