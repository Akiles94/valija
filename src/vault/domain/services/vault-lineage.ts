import type { DeviceId } from "../values/device-id.js";
import type { Generation } from "../values/generation.js";
import type { WriteStamp } from "../values/write-stamp.js";

/** The vault's current lineage, as committed with its last write. */
export interface LineageStamp {
  readonly generation: Generation;
  readonly writeStamp: WriteStamp;
  readonly writer: DeviceId;
  readonly writtenAt: string;
}

/** What this device last saw of the vault's lineage. */
export interface LineageSeen {
  readonly generation: Generation;
  readonly writeStamp: WriteStamp;
}

export type LineageClassification = "in-sync" | "fast-forward" | "fork";

/**
 * Compare the vault's current lineage against what this device last saw.
 *
 * - Never seen before (fresh vault, or this device's first unlock) → fast-forward.
 * - Same stamp as last seen → in-sync, nothing changed.
 * - Generation moved forward → another device wrote cleanly and it synced down; adopt.
 * - Same or lower generation with a different stamp → two devices wrote independently
 *   from the same starting point. That is provable divergence, never auto-resolved.
 */
export function classifyLineage(
  current: LineageStamp,
  lastSeen: LineageSeen | null,
): LineageClassification {
  if (lastSeen === null) return "fast-forward";
  if (current.writeStamp === lastSeen.writeStamp) return "in-sync";
  if (current.generation > lastSeen.generation) return "fast-forward";
  return "fork";
}
