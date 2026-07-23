import type { IdGenerator } from "../../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

/**
 * Stable identifier for one device/installation of valija. Device-local, never
 * synced. Opaque, like every other id this codebase's IdGenerator produces
 * (context item / project ids are treated the same way) — not shape-checked
 * against a specific id format, just required to be non-empty.
 */
export type DeviceId = string & { readonly __brand: "DeviceId" };

export function parseDeviceId(raw: string): Result<DeviceId, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return vaultErr("INVALID_DEVICE_ID", `Device id must be a non-empty string. Got: "${raw}"`);
  }
  return ok(trimmed as DeviceId);
}

export const createDeviceId = (idGen: IdGenerator): DeviceId => idGen.next() as DeviceId;
