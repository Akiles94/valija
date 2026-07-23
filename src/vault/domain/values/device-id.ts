import type { IdGenerator } from "../../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { vaultErr } from "../errors.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Stable identifier for one device/installation of valija. Device-local, never synced. */
export type DeviceId = string & { readonly __brand: "DeviceId" };

export function parseDeviceId(raw: string): Result<DeviceId, DomainError> {
  if (!ULID_PATTERN.test(raw)) {
    return vaultErr("INVALID_DEVICE_ID", `Device id must be a 26-char ULID. Got: "${raw}"`);
  }
  return ok(raw as DeviceId);
}

export const createDeviceId = (idGen: IdGenerator): DeviceId => idGen.next() as DeviceId;
