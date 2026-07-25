import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import type { DeviceId } from "../../domain/values/device-id.js";

/**
 * Reads and bumps the vault's lineage stamp, stored inside the encrypted db.
 * Deliberately narrow (no SQLite types) so the write path can bump it without
 * importing the storage engine.
 */
export interface LineageStore {
  /** null when the vault predates lineage tracking, or has never been written to yet. */
  read(): LineageStamp | null;
  /** Advance the generation, mint a fresh stamp, and persist it. Returns the new stamp. */
  bump(writer: DeviceId): LineageStamp;
}
