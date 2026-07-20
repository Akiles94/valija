import type {
  ImportConversationsInput,
  ImportConversationsOutput,
} from "../../importers/application/use-cases/import-conversations.use-case.js";
import {
  type ImportSource,
  parseImportSource,
} from "../../importers/domain/values/import-source.js";
import type { Container } from "../container.js";
import { fail, truncate } from "./render.js";

interface ImportOptions {
  project?: string;
  from?: string;
  list?: boolean;
  pick?: string;
  query?: string;
  since?: string;
  all?: boolean;
  dryRun?: boolean;
}

export function importCommand(c: Container, file: string, options: ImportOptions): void {
  // -p is required for a real import or a dry-run (both report against a target); --list may omit it.
  const wantsSelection =
    options.all === true ||
    options.pick !== undefined ||
    options.query !== undefined ||
    options.since !== undefined ||
    options.dryRun === true;
  if (wantsSelection && options.project === undefined) {
    console.error("error: -p <project> is required to import. Run with --list first to preview.");
    process.exit(1);
  }

  const input: ImportConversationsInput = {
    filePath: file,
    ...(options.project === undefined ? {} : { projectName: options.project }),
    ...(options.from === undefined ? {} : { from: resolveSource(options.from) }),
    ...(options.list === undefined ? {} : { list: options.list }),
    ...(options.pick === undefined ? {} : { pick: options.pick }),
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.since === undefined ? {} : { since: options.since }),
    ...(options.all === undefined ? {} : { all: options.all }),
    ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
  };

  const result = c.importConversations.execute(input);
  if (!result.ok) fail(result.error);

  if (result.value.mode === "list") renderListing(result.value);
  else renderSummary(result.value);
}

function resolveSource(raw: string): ImportSource {
  const parsed = parseImportSource(raw);
  if (!parsed.ok) fail(parsed.error);
  return parsed.value;
}

function renderListing(summary: ImportConversationsOutput): void {
  const rows = summary.listing ?? [];
  if (rows.length === 0) {
    console.log("No conversations found in this export.");
    return;
  }
  console.log(`${rows.length} conversation(s) in this ${summary.source} export:\n`);
  console.log("  #  DATE        CHUNKS  TITLE");
  for (const row of rows) {
    console.log(
      `${String(row.index).padStart(3)}  ${row.date}  ${String(row.estimatedChunks).padStart(6)}  ${truncate(row.title, 48)}`,
    );
  }
  console.log(
    "\nSelect with --pick 1,3-5, --query <text>, --since <YYYY-MM-DD>, or --all. Add --dry-run to preview.",
  );
}

function renderSummary(summary: ImportConversationsOutput): void {
  const target = summary.project === undefined ? "" : ` into "${summary.project}"`;
  const verb = summary.mode === "dry-run" ? "Would import" : "Imported";
  console.log(
    `${verb} ${summary.imported} item(s) from ${summary.conversations} conversation(s)${target} (skipped ${summary.skipped}, failed ${summary.failed}).`,
  );
  for (const failure of summary.failures) {
    console.error(`  failed: ${failure.conversation} — ${failure.reason}`);
  }
}
