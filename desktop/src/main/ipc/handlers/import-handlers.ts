import type { Container } from "../../../../../src/delivery/container.js";
import { importerErr } from "../../../../../src/importers/domain/errors.js";
import type {
  ImportListRequest,
  ImportListResponse,
  ImportOutcomeResponse,
  ImportPreviewRequest,
  ImportRunRequest,
} from "../../../shared/ipc/messages.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { toIpcResult } from "../to-ipc-result.js";

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
        getContainer().importConversations.execute({ filePath: path.value, list: true }),
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
        }),
        toOutcome,
      );
    },

    "import:run": (req: ImportRunRequest) => {
      const path = resolvePath(req.handle);
      if (!path.ok) return toIpcResult(path, emptyOutcome);
      return toIpcResult(
        getContainer().importConversations.execute({
          filePath: path.value,
          projectName: req.projectName,
          ...(req.pick === undefined ? {} : { pick: req.pick }),
          ...(req.query === undefined ? {} : { query: req.query }),
          ...(req.since === undefined ? {} : { since: req.since }),
          ...(req.all === undefined ? {} : { all: req.all }),
        }),
        toOutcome,
      );
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
