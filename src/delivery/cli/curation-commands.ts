import { readFileSync } from "node:fs";
import type { ItemCurationOutput } from "../../context/application/dto/item-curation-output.js";
import type { DomainError, Result } from "../../shared/domain/result.js";
import type { Container } from "../container.js";
import { fail } from "./render.js";

// Nothing in this file prints item content: only ids, types, project names and field names.

type Verb = "pin" | "unpin" | "archive" | "unarchive";

const VERBS: Record<Verb, { done: string; already: string }> = {
  pin: { done: "Pinned", already: "Already pinned" },
  unpin: { done: "Unpinned", already: "Already unpinned" },
  archive: { done: "Archived", already: "Already archived" },
  unarchive: { done: "Unarchived", already: "Already unarchived" },
};

/** The `valija edit` flags: content from a file or `-` for stdin, comma-separated tags, a type. */
export interface EditOptions {
  contentFile?: string;
  tags?: string;
  type?: string;
}

/** `valija pin <id>`: pins an item so it always leads its project's context pack. */
export function pinCommand(c: Container, item: string): void {
  report("pin", c.setItemPinned.execute({ item, pinned: true }));
}

/** `valija unpin <id>`: removes an item's pin. */
export function unpinCommand(c: Container, item: string): void {
  report("unpin", c.setItemPinned.execute({ item, pinned: false }));
}

/** `valija archive <id>`: hides an item from packs and search without deleting it. */
export function archiveCommand(c: Container, item: string): void {
  report("archive", c.setItemArchived.execute({ item, archived: true }));
}

/** `valija unarchive <id>`: brings an archived item back into packs and search. */
export function unarchiveCommand(c: Container, item: string): void {
  report("unarchive", c.setItemArchived.execute({ item, archived: false }));
}

/** Content comes from a file or stdin (`-`) — never an editor, a temp file, or an inline flag. */
export function editCommand(c: Container, item: string, options: EditOptions): void {
  const result = c.editItem.execute({
    item,
    ...(options.contentFile === undefined ? {} : { content: readContent(options.contentFile) }),
    ...(options.tags === undefined ? {} : { tags: splitTags(options.tags) }),
    ...(options.type === undefined ? {} : { type: options.type }),
  });
  if (!result.ok) fail(result.error);
  const v = result.value;
  if (!v.changed) {
    console.log("Nothing changed — the item already has those values.");
    return;
  }
  console.log(
    `Updated ${v.type} ${v.itemId} in project "${v.project}" (${v.changedFields.join(", ")}).`,
  );
}

function report(verb: Verb, result: Result<ItemCurationOutput, DomainError>): void {
  if (!result.ok) fail(result.error);
  const v = result.value;
  if (!v.changed) {
    console.log(`${VERBS[verb].already} — nothing changed.`);
    return;
  }
  const undo = verb === "archive" ? ` Undo: valija unarchive ${v.itemId}` : "";
  console.log(`${VERBS[verb].done} ${v.type} ${v.itemId} in project "${v.project}".${undo}`);
}

function readContent(path: string): string {
  try {
    return readFileSync(path === "-" ? 0 : path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`error: could not read ${path}: ${reason}`);
    process.exit(1);
  }
}

/** `--tags ""` clears every tag. */
function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
