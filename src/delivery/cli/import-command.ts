import { importRefusedMessage } from "../../context/domain/services/secret-detection/secret-refusal.js";
import { describeFindings } from "../../context/domain/values/secret-finding.js";
import type {
  ImportConversationsInput,
  ImportConversationsOutput,
} from "../../importers/application/use-cases/import-conversations.use-case.js";
import type { BlockingChunk } from "../../importers/domain/services/blocking-chunks.js";
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
  /** `--allow-secrets`: a human's explicit "import it anyway" (SECRET-WARN D-C). */
  allowSecrets?: boolean;
}

const IMPORT_SECRET_REMEDY =
  "Leave those conversations out of the selection, or re-run with --allow-secrets.";

/**
 * `valija import <file>`: lists the conversations in a chat export, or imports (or dry-runs) the
 * selected ones into a project.
 */
export function importCommand(c: Container, file: string, options: ImportOptions): void {
  // A selection flag means a real import or dry-run preview, which report against a target,
  // so -p is required. With no selection the command just lists (a bare --dry-run lists too).
  const hasSelection =
    options.all === true ||
    options.pick !== undefined ||
    options.query !== undefined ||
    options.since !== undefined;
  if (hasSelection && options.project === undefined) {
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
    ...(options.allowSecrets === true ? { allowSecrets: true } : {}),
  };

  const result = c.importConversations.execute(input);
  if (!result.ok) {
    // Defense in depth: ImportItems' own refusal, never expected once ImportConversations has screened.
    fail(result.error, result.error.code === "POSSIBLE_SECRET" ? IMPORT_SECRET_REMEDY : undefined);
  }

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
  if (summary.mode === "import" && summary.refused) renderRefusedImport(summary);
  renderCounts(summary);
  if (summary.mode === "dry-run" && summary.refused) renderWouldBeRefused(summary);
}

function renderCounts(summary: ImportConversationsOutput): void {
  const target = summary.project === undefined ? "" : ` into "${summary.project}"`;
  const verb = summary.mode === "dry-run" ? "Would import" : "Imported";
  console.log(
    `${verb} ${summary.imported} item(s) from ${summary.conversations} conversation(s)${target} (skipped ${summary.skipped}, failed ${summary.failed}).`,
  );
  for (const failure of summary.failures) {
    console.error(`  failed: ${failure.conversation} — ${failure.reason}`);
  }
}

/** Dry-run (stdout, exit 0): what a real run would refuse, and how to get past it. */
function renderWouldBeRefused(summary: ImportConversationsOutput): void {
  const count = summary.blockingChunks.length;
  console.log(`A real import would be REFUSED: ${count} chunk(s) look like they contain secrets.`);
  for (const chunk of summary.blockingChunks) console.log(blockingLine(chunk));
  console.log(
    "Leave those conversations out of the selection (--pick / --query / --since), or add --allow-secrets.",
  );
}

/** Real run (stderr, exit 1): nothing was written (D-E). */
function renderRefusedImport(summary: ImportConversationsOutput): never {
  console.error(`error [POSSIBLE_SECRET]: ${importRefusedMessage(summary.blockingChunks.length)}`);
  for (const chunk of summary.blockingChunks) console.error(blockingLine(chunk));
  console.error(IMPORT_SECRET_REMEDY);
  process.exit(1);
}

/** `  #2 "Deploy debugging" part 1 — AWS access key (line 5)`: the `#n` is what `--pick` reads. */
function blockingLine(chunk: BlockingChunk): string {
  const title = chunk.title === null ? "(title hidden)" : `"${truncate(chunk.title, 48)}"`;
  return `  #${chunk.conversationIndex} ${title} part ${chunk.part} — ${describeFindings(chunk.findings)}`;
}
