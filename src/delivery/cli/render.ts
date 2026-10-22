import type { ContextItemView } from "../../context/application/dto/context-item-view.js";
import type { DomainError } from "../../shared/domain/result.js";
import type { DeviceId } from "../../vault/domain/values/device-id.js";

/** Print `error [CODE]: message`, plus a surface-specific remedy when one applies, and exit 1. */
export function fail(error: DomainError, remedy?: string): never {
  console.error(
    `error [${error.code}]: ${error.message}${remedy === undefined ? "" : ` ${remedy}`}`,
  );
  process.exit(1);
}

/**
 * "this device (01J8F2WX…)" / "another device (01K3Q0AB…)". The short id prefix
 * is what lets a user tell a two-device handoff from a three-device fork — a bare
 * "another device" collapses every non-local writer into one label.
 */
export function writerLabel(
  writer: DeviceId | undefined,
  writerIsThisDevice: boolean | undefined,
): string {
  if (writer === undefined) return "unknown device";
  const shortId = writer.length > 10 ? `${writer.slice(0, 10)}…` : writer;
  return `${writerIsThisDevice ? "this" : "another"} device (${shortId})`;
}

/** Collapses whitespace and shortens text to one line of at most `max` characters. */
export function truncate(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

/** Shows an ISO timestamp as its date, or a dash when there is none. */
export function formatDate(iso: string | null): string {
  return iso === null ? "—" : iso.slice(0, 10);
}

/** The header `show` prints above each item: the full id is always there, so any verb can target it. */
export function itemHeaderLine(item: ContextItemView): string {
  const pin = item.pinned ? "  📌" : "";
  const tags = item.tags.length > 0 ? `  [${item.tags.join(", ")}]` : "";
  const archived = item.archived ? "  [archived]" : "";
  return `— ${item.type} · ${formatDate(item.createdAt)}  id ${item.id}${pin}${tags}${archived}`;
}
