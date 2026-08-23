import { writeFileSync } from "node:fs";
import type { Container } from "../../../../../src/delivery/container.js";
import {
  exportProjectJson,
  exportProjectMarkdown,
} from "../../../../../src/delivery/context-pack-export.js";
import type {
  ContentCopyRequest,
  ContentExportRequest,
  ContentExportResponse,
  ContentPackRequest,
  ContentPackResponse,
  ContentSearchRequest,
  ContentShowRequest,
  ContextItemMessage,
  ProjectListEntryMessage,
} from "../../../shared/ipc/messages.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { toIpcResult } from "../to-ipc-result.js";

export function createContentHandlers(
  getContainer: () => Container,
  filePicker: FilePicker,
  clipboard: ClipboardPort,
) {
  return {
    "content:projects": () =>
      toIpcResult(getContainer().listProjects.execute(), (v): ProjectListEntryMessage[] => v),

    "content:show": (req: ContentShowRequest) =>
      toIpcResult(getContainer().showProject.execute(req), (v): ContextItemMessage[] => v),

    "content:search": (req: ContentSearchRequest) =>
      toIpcResult(getContainer().searchContext.execute(req), (v): ContextItemMessage[] => v),

    "content:pack": (req: ContentPackRequest) =>
      toIpcResult(
        exportProjectMarkdown(getContainer(), req.project),
        (markdown): ContentPackResponse => ({ markdown }),
      ),

    "content:export": (req: ContentExportRequest) => {
      const suggestedName = `${req.project}.${req.format === "json" ? "json" : "md"}`;
      const path = filePicker.chooseExportTarget(suggestedName);
      if (path === null) {
        const cancelled: ContentExportResponse = { cancelled: true };
        return { ok: true as const, value: cancelled };
      }
      const rendered =
        req.format === "json"
          ? exportProjectJson(getContainer(), req.project)
          : exportProjectMarkdown(getContainer(), req.project);
      return toIpcResult(rendered, (content): ContentExportResponse => {
        writeFileSync(path, content, "utf8");
        return { cancelled: false, path };
      });
    },

    "content:copy": (req: ContentCopyRequest): void => {
      clipboard.writeText(req.text);
    },
  };
}
