import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import type { DeviceId } from "../../domain/values/device-id.js";

/** What a re-encryption needs: both keys (hex) and the device to record as the writer. */
export interface RekeyRequest {
  /** The key the vault opens with now — already proven by the caller. */
  currentKeyHex: string;
  /** The key the vault must open with afterwards. */
  newKeyHex: string;
  /** This device: the lineage bump names it as the last writer (D-K). */
  writer: DeviceId;
}

/**
 * Re-encrypts the whole vault database from one key to another, crash-safe (D-E): afterwards it
 * opens with exactly one of the two keys, or a pre-rekey backup that the current key opens remains.
 * Counts as a write, so it bumps the lineage and returns the new stamp (D-K). Never touches
 * `vault.json` or any keychain.
 */
export interface VaultRekeyer {
  rekey(request: RekeyRequest): Result<LineageStamp, DomainError>;
}
