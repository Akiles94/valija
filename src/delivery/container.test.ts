import { describe, expect, it } from "vitest";
import { resolveAutoLockTtl } from "./container.js";

describe("resolveAutoLockTtl — CONNECT D5's env-wins-over-preference precedence", () => {
  it("VALIJA_AUTOLOCK_MINUTES wins over the desktop's persisted preference when both are set", () => {
    expect(resolveAutoLockTtl({ VALIJA_AUTOLOCK_MINUTES: "5" }, 30)).toBe(5);
  });

  it("VALIJA_AUTOLOCK_MINUTES='off' disables auto-lock even if the preference wants a TTL", () => {
    expect(resolveAutoLockTtl({ VALIJA_AUTOLOCK_MINUTES: "off" }, 30)).toBeNull();
  });

  it("falls back to the desktop's preference when the env var is unset", () => {
    expect(resolveAutoLockTtl({}, 30)).toBe(30);
    expect(resolveAutoLockTtl({}, null)).toBeNull();
  });

  it("falls back to the default (15) when neither is set — CLI/MCP's own call site", () => {
    expect(resolveAutoLockTtl({})).toBe(15);
    expect(resolveAutoLockTtl({}, undefined)).toBe(15);
  });
});
