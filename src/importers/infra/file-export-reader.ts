import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import type { ExportReader } from "../application/ports/export-reader.js";
import { importerErr } from "../domain/errors.js";

/**
 * Decompression-bomb guards: a `.zip` entry (or the running total across kept
 * entries) whose *uncompressed* size exceeds these caps is rejected before it
 * is ever inflated, so a tiny malicious archive cannot exhaust memory.
 */
export const MAX_ENTRY_BYTES = 128 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

const decoder = new TextDecoder();

/** Decode UTF-8 bytes and JSON-parse them; a decode/parse failure is a malformed export. */
function parseJsonBytes(bytes: Uint8Array): Result<unknown, DomainError> {
  try {
    return ok(JSON.parse(decoder.decode(bytes)));
  } catch (error) {
    return importerErr("MALFORMED_EXPORT", `Invalid JSON: ${(error as Error).message}`);
  }
}

/**
 * Reads an export file into candidate JSON documents — one for a plain `.json`,
 * one per `.json` entry for a `.zip`. The archive is inflated entirely in
 * memory via fflate; nothing is ever written to disk.
 */
export class FileExportReader implements ExportReader {
  constructor(
    private readonly maxEntryBytes: number = MAX_ENTRY_BYTES,
    private readonly maxTotalBytes: number = MAX_TOTAL_BYTES,
  ) {}

  read(filePath: string): Result<unknown[], DomainError> {
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(filePath);
    } catch (error) {
      return importerErr(
        "UNREADABLE_FILE",
        `Could not read "${filePath}": ${(error as Error).message}`,
      );
    }
    return filePath.toLowerCase().endsWith(".zip") ? this.readZip(bytes) : this.readJson(bytes);
  }

  private readJson(bytes: Uint8Array): Result<unknown[], DomainError> {
    const parsed = parseJsonBytes(bytes);
    if (!parsed.ok) return parsed;
    return ok([parsed.value]);
  }

  private readZip(bytes: Uint8Array): Result<unknown[], DomainError> {
    let entries: Record<string, Uint8Array>;
    let total = 0;
    try {
      entries = unzipSync(bytes, {
        filter: (file) => {
          if (!file.name.toLowerCase().endsWith(".json")) return false;
          if (file.originalSize > this.maxEntryBytes) {
            throw new Error(`entry "${file.name}" exceeds the ${this.maxEntryBytes}-byte cap`);
          }
          total += file.originalSize;
          if (total > this.maxTotalBytes) {
            throw new Error(`archive exceeds the ${this.maxTotalBytes}-byte total cap`);
          }
          return true;
        },
      });
    } catch (error) {
      return importerErr(
        "CORRUPT_ARCHIVE",
        `Could not read the archive: ${(error as Error).message}`,
      );
    }

    const docs: unknown[] = [];
    for (const entryBytes of Object.values(entries)) {
      const parsed = parseJsonBytes(entryBytes);
      if (!parsed.ok) return parsed;
      docs.push(parsed.value);
    }
    if (docs.length === 0) {
      return importerErr("EMPTY_EXPORT", "The archive contained no .json files.");
    }
    return ok(docs);
  }
}
