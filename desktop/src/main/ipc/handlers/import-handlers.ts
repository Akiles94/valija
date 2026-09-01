import type { Container } from "../../../../../src/delivery/container.js";
import { importerErr } from "../../../../../src/importers/domain/errors.js";
import { DomainError, err, type Result } from "../../../../../src/shared/domain/result.js";
import type {
  ImportListRequest,
  ImportListResponse,
  ImportOutcomeResponse,
  ImportPreviewRequest,
  ImportRunRequest,
} from "../../../shared/ipc/messages.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { toIpcResult } from "../to-ipc-result.js";

/** D-J(a): constants, not inherited library defaults — a short, bounded wait for a contended write to clear. */
export const IMPORT_BUSY_RETRY_ATTEMPTS = 2;
export const IMPORT_BUSY_RETRY_BACKOFF_MS = 200;

function isSqliteBusyError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as { code?: string }).code === "SQLITE_BUSY"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The one place D-J(a)'s bounded retry lives: a contended write (a GUI
 * import racing an MCP `save_context`) throws once better-sqlite3's own
 * busy timeout is exhausted, rather than returning a `Result` — this catches
 * that throw, retries a small fixed number of times with a short backoff,
 * and only then surfaces localized copy keyed off an error code, never a
 * raw SQLite string (§9 item 75).
 */
async function runImportWithBusyRetry<T>(
  run: () => Result<T, DomainError>,
): Promise<Result<T, DomainError>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return run();
    } catch (error) {
      if (!isSqliteBusyError(error) || attempt >= IMPORT_BUSY_RETRY_ATTEMPTS) {
        return err(
          new DomainError("STORAGE_ERROR", "The vault is busy right now. Try again in a moment."),
        );
      }
      await sleep(IMPORT_BUSY_RETRY_BACKOFF_MS);
    }
  }
}

/**
 * Every filesystem path here is resolved from a `handle` the dialog channel
 * minted (§8.6) — no channel accepts a path directly. No parser, chunker,
 * selection rule or archive reader is re-implemented: everything routes
 * through the same `ImportConversations` the CLI uses.
 */
export function createImportHandlers(getContainer: () => Container, filePicker: FilePicker) {
  function resolvePath(handle: string) {
    const path = filePicker.resolveHandle(handle);
    if (path === undefined) {
      return importerErr(
        "UNREADABLE_FILE",
        "That import session has expired. Choose the file again.",
      );
    }
    return { ok: true as const, value: path };
  }

  return {
    "import:list": (req: ImportListRequest) => {
      const path = resolvePath(req.handle);
      if (!path.ok) return toIpcResult(path, () => ({ source: "", listing: [] }));
      return toIpcResult(
        getContainer().importConversations.execute({
          filePath: path.value,
          list: true,
          ...(req.from === undefined ? {} : { from: req.from }),
        }),
        (v): ImportListResponse => ({ source: v.source, listing: v.listing ?? [] }),
      );
    },

    "import:preview": (req: ImportPreviewRequest) => {
      const path = resolvePath(req.handle);
      if (!path.ok) return toIpcResult(path, emptyOutcome);
      return toIpcResult(
        getContainer().importConversations.execute({
          filePath: path.value,
          projectName: req.projectName,
          dryRun: true,
          ...(req.pick === undefined ? {} : { pick: req.pick }),
          ...(req.query === undefined ? {} : { query: req.query }),
          ...(req.since === undefined ? {} : { since: req.since }),
          ...(req.all === undefined ? {} : { all: req.all }),
          ...(req.from === undefined ? {} : { from: req.from }),
        }),
        toOutcome,
      );
    },

    "import:run": async (req: ImportRunRequest) => {
      const path = resolvePath(req.handle);
      if (!path.ok) return toIpcResult(path, emptyOutcome);
      const result = await runImportWithBusyRetry(() =>
        getContainer().importConversations.execute({
          filePath: path.value,
          projectName: req.projectName,
          ...(req.pick === undefined ? {} : { pick: req.pick }),
          ...(req.query === undefined ? {} : { query: req.query }),
          ...(req.since === undefined ? {} : { since: req.since }),
          ...(req.all === undefined ? {} : { all: req.all }),
          ...(req.from === undefined ? {} : { from: req.from }),
        }),
      );
      return toIpcResult(result, toOutcome);
    },
  };
}

function toOutcome(v: {
  imported: number;
  conversations: number;
  skipped: number;
  failed: number;
  failures: { conversation: string; reason: string }[];
}): ImportOutcomeResponse {
  return v;
}

function emptyOutcome(): ImportOutcomeResponse {
  return { imported: 0, conversations: 0, skipped: 0, failed: 0, failures: [] };
}
