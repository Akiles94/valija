import { describe, expect, it } from "vitest";
import { isIdleExpired, parseAutoLockTtl } from "./auto-lock-ttl.js";

describe("parseAutoLockTtl", () => {
  it("defaults to 15 minutes when unset or empty", () => {
    expect(parseAutoLockTtl(undefined)).toBe(15);
    expect(parseAutoLockTtl("")).toBe(15);
    expect(parseAutoLockTtl("   ")).toBe(15);
  });

  it("disables auto-lock on '0' or 'off', case-insensitive", () => {
    expect(parseAutoLockTtl("0")).toBeNull();
    expect(parseAutoLockTtl("off")).toBeNull();
    expect(parseAutoLockTtl("OFF")).toBeNull();
  });

  it("uses a positive integer as-is", () => {
    expect(parseAutoLockTtl("30")).toBe(30);
    expect(parseAutoLockTtl("1")).toBe(1);
  });

  it("falls back to the default for anything unparseable, rather than failing", () => {
    expect(parseAutoLockTtl("-5")).toBe(15);
    expect(parseAutoLockTtl("abc")).toBe(15);
    expect(parseAutoLockTtl("1.5")).toBe(15);
  });
});

describe("isIdleExpired", () => {
  const start = new Date("2026-07-23T12:00:00.000Z");

  it("is not expired before the TTL elapses", () => {
    const now = new Date(start.getTime() + 14 * 60_000);
    expect(isIdleExpired(start, now, 15)).toBe(false);
  });

  it("is expired exactly at the TTL boundary", () => {
    const now = new Date(start.getTime() + 15 * 60_000);
    expect(isIdleExpired(start, now, 15)).toBe(true);
  });

  it("is expired well past the TTL", () => {
    const now = new Date(start.getTime() + 20 * 60_000);
    expect(isIdleExpired(start, now, 15)).toBe(true);
  });
});
