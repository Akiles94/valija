import type { DomainError } from "../../shared/domain/result.js";
import type { DeviceId } from "../../vault/domain/values/device-id.js";

export function fail(error: DomainError): never {
  console.error(`error [${error.code}]: ${error.message}`);
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

export function truncate(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

export function formatDate(iso: string | null): string {
  return iso === null ? "—" : iso.slice(0, 10);
}
