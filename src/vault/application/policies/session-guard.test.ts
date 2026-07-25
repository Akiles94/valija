import { describe, expect, it } from "vitest";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../testing/test-vault.js";
import { SessionGuard } from "./session-guard.js";

const VAULT_ID = "01TESTVAULT";

function setUp(ttlMinutes: number | null) {
  const clock = new FixedClock();
  const deviceIdentity = new FakeDeviceIdentity(new SeqIds());
  const keychain = new FakeKeychain();
  keychain.setKey(VAULT_ID, "the-key");
  const guard = new SessionGuard(deviceIdentity, keychain, clock, ttlMinutes);
  return { clock, deviceIdentity, keychain, guard };
}

describe("SessionGuard", () => {
  it("does not treat a device that has never been seen as expired", () => {
    const { guard } = setUp(15);
    expect(guard.guard(VAULT_ID).ok).toBe(true);
  });

  it("passes and refreshes the activity timestamp within the TTL", () => {
    const { clock, deviceIdentity, keychain, guard } = setUp(15);

    expect(guard.guard(VAULT_ID).ok).toBe(true);
    expect(deviceIdentity.lastActivityAt(VAULT_ID)).toEqual(clock.now());

    clock.advanceMinutes(10);
    expect(guard.guard(VAULT_ID).ok).toBe(true);
    expect(keychain.getKey(VAULT_ID)).toBe("the-key");
  });

  it("drops the key and returns VAULT_LOCKED once the TTL has elapsed", () => {
    const { clock, keychain, guard } = setUp(15);

    guard.guard(VAULT_ID); // establishes lastActivityAt
    clock.advanceMinutes(16);

    const result = guard.guard(VAULT_ID);
    expect(!result.ok && result.error.code).toBe("VAULT_LOCKED");
    expect(keychain.getKey(VAULT_ID)).toBeNull();
  });

  it("never locks when the TTL is disabled (null)", () => {
    const { clock, keychain, guard } = setUp(null);

    guard.guard(VAULT_ID);
    clock.advanceMinutes(10_000);

    const result = guard.guard(VAULT_ID);
    expect(result.ok).toBe(true);
    expect(keychain.getKey(VAULT_ID)).toBe("the-key");
  });
});
