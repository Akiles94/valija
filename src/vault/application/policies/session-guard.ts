import type { Clock } from "../../../shared/application/ports/clock.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { LOCKED_MESSAGE, vaultErr } from "../../domain/errors.js";
import { isIdleExpired } from "../../domain/values/auto-lock-ttl.js";
import type { DeviceIdentity } from "../ports/device-identity.js";
import type { KeychainPort } from "../ports/keychain.js";

/**
 * Idle auto-lock: a lazy, no-daemon TTL check consulted at every session
 * open. Past the TTL it proactively drops the keychain key (a genuine lock,
 * not just a refusal) and returns the same VAULT_LOCKED error the ordinary
 * "no key present" path uses, so MCP/CLI behaviour is unchanged either way —
 * it only ever tightens the unlocked window, never widens it.
 */
export class SessionGuard {
  constructor(
    private readonly deviceIdentity: DeviceIdentity,
    private readonly keychain: KeychainPort,
    private readonly clock: Clock,
    private readonly ttlMinutes: number | null,
  ) {}

  guard(vaultId: string): Result<void, DomainError> {
    const now = this.clock.now();

    if (this.ttlMinutes === null) {
      this.deviceIdentity.recordActivity(vaultId, now);
      return ok(undefined);
    }

    const lastActivity = this.deviceIdentity.lastActivityAt(vaultId);
    if (lastActivity !== null && isIdleExpired(lastActivity, now, this.ttlMinutes)) {
      this.keychain.deleteKey(vaultId);
      return vaultErr("VAULT_LOCKED", LOCKED_MESSAGE);
    }

    this.deviceIdentity.recordActivity(vaultId, now);
    return ok(undefined);
  }
}
