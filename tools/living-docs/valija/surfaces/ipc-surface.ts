import { createFinding, type Finding } from "../../core/domain/values/finding.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";
import { type CallableIndex, reachContainerKeys } from "../services/use-case-reach.js";

/** Where the closed IPC surface is declared. */
export const CHANNELS_FILE = "desktop/src/shared/ipc/channels.ts";
const HANDLERS_DIR = "desktop/src/main/ipc/handlers/";

/** One desktop IPC channel: its contract, its handler, and the container keys it reaches. */
export interface IpcChannel {
  readonly name: string;
  readonly doc: string | null;
  readonly request: string;
  readonly response: string;
  /** Line of the channel's `ChannelMap` member, for findings. */
  readonly line: number;
  readonly handlerFile: string;
  readonly reaches: readonly string[];
}

/**
 * Reads channels statically (root CI has no desktop dependencies): names from `CHANNELS`,
 * contract and doc from `ChannelMap`, and the handler from `*-handlers.ts` object keys.
 * A channel handled in zero or several files is an error, never a guess.
 */
export function readIpcChannels(files: readonly SourceFile[], index: CallableIndex): IpcChannel[] {
  const channelsFile = files.find((f) => f.path === CHANNELS_FILE);
  const declared = channelsFile?.scanned.declarations;
  const list = declared?.find((d) => d.name === "CHANNELS");
  const map = declared?.find((d) => d.name === "ChannelMap");
  if (!list || !map) throw new Error(`cannot find CHANNELS and ChannelMap in ${CHANNELS_FILE}`);

  const names = [...list.span.source.matchAll(/"([\w:]+)"/g)].map((m) => m[1] as string);
  const members = readChannelMap(map.span.source, map.line);
  const handlers = files.filter(
    (f) => f.path.startsWith(HANDLERS_DIR) && f.path.endsWith("-handlers.ts"),
  );

  return names.map((name) => {
    const homes = handlers.flatMap((file) => {
      const key = file.text.indexOf(`"${name}":`);
      return key >= 0 && file.scanned.code.slice(key, key + 1) === '"' ? [{ file, key }] : [];
    });
    if (homes.length !== 1) {
      throw new Error(`channel "${name}" is handled in ${homes.length} handler files (expected 1)`);
    }
    const { file, key } = homes[0] as { file: SourceFile; key: number };
    const member = members.get(name);
    if (!member) throw new Error(`channel "${name}" has no ChannelMap entry`);
    return {
      name,
      ...member,
      handlerFile: file.path,
      reaches: reachContainerKeys(handlerBody(file.scanned.code, key), file.path, index),
    };
  });
}

/** The handler's text: from its key to the next `"x:y":` key at the same nesting (or the end). */
function handlerBody(code: string, key: number): string {
  let depth = 0;
  for (let i = key; i < code.length; i++) {
    const c = code[i];
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      if (depth === 0) return code.slice(key, i);
      depth--;
    } else if (c === "," && depth === 0) return code.slice(key, i);
  }
  return code.slice(key);
}

function readChannelMap(
  source: string,
  firstLine: number,
): Map<string, { doc: string | null; request: string; response: string; line: number }> {
  const members = new Map<
    string,
    { doc: string | null; request: string; response: string; line: number }
  >();
  const lines = source.split("\n");
  let pendingDoc: string[] | null = null;
  let collecting: string[] | null = null;
  lines.forEach((text, i) => {
    const trimmed = text.trim();
    if (trimmed.startsWith("/**")) {
      collecting = [];
      pendingDoc = null;
    }
    if (collecting) {
      collecting.push(trimmed.replace(/^\/\*\*\s?|\s?\*\/$|^\*\s?/g, "").trim());
      if (trimmed.endsWith("*/")) {
        pendingDoc = collecting.filter((l) => l !== "");
        collecting = null;
      }
      return;
    }
    const member = /^"([\w:]+)":\s*\{/.exec(trimmed);
    if (!member) return;
    const rest = lines.slice(i, i + 4).join(" ");
    const request = /request:\s*([^;]+);/.exec(rest)?.[1]?.trim() ?? "?";
    const response = /response:\s*([^;}]+)/.exec(rest)?.[1]?.trim() ?? "?";
    const doc = pendingDoc ? (pendingDoc as string[]).join(" ") : null;
    members.set(member[1] as string, { doc, request, response, line: firstLine + i });
    pendingDoc = null;
  });
  return members;
}

/** P-D9: every channel's `ChannelMap` member carries a one-line doc. */
export function findUndocumentedChannels(channels: readonly IpcChannel[]): Finding[] {
  return channels
    .filter((c) => c.doc === null || c.doc.trim() === "")
    .map((c) =>
      createFinding({
        rule: "undocumented-export",
        file: CHANNELS_FILE,
        line: c.line,
        subject: `ChannelMap › ${c.name}`,
        message: `IPC channel "${c.name}" has no one-line doc on its ChannelMap member (P-D9)`,
      }),
    );
}
