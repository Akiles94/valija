import { afterEach, describe, expect, it, vi } from "vitest";
import { startIdleLockTimer } from "./idle-lock-timer.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startIdleLockTimer (⚑ D-A.2)", () => {
  it("expires at the TTL after the last activity", () => {
    vi.useFakeTimers();
    const last = new Date();
    const onExpire = vi.fn();
    startIdleLockTimer(15, () => last, onExpire);
    vi.advanceTimersByTime(15 * 60_000 - 1);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60 * 60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("activity in the meantime moves the deadline", () => {
    vi.useFakeTimers();
    let last = new Date();
    const onExpire = vi.fn();
    startIdleLockTimer(15, () => last, onExpire);
    vi.advanceTimersByTime(10 * 60_000);
    last = new Date();
    vi.advanceTimersByTime(5 * 60_000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("expires at once when the last activity is already past the TTL", () => {
    const onExpire = vi.fn();
    startIdleLockTimer(15, () => new Date(Date.now() - 16 * 60_000), onExpire);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("counts from the start when there is no activity yet", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    startIdleLockTimer(1, () => null, onExpire);
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("null (auto-lock off) starts nothing", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    const onExpire = vi.fn();
    startIdleLockTimer(null, () => new Date(0), onExpire).stop();
    expect(spy).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("stop() cancels the pending check", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const timer = startIdleLockTimer(1, () => new Date(), onExpire);
    timer.stop();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the timer is unref'd — it never keeps the process alive", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    const timer = startIdleLockTimer(
      15,
      () => new Date(),
      () => {},
    );
    const handle = spy.mock.results[0]?.value as NodeJS.Timeout;
    expect(handle.hasRef()).toBe(false);
    timer.stop();
  });

  it("a TTL beyond setTimeout's ceiling is re-checked, never fired early", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const timer = startIdleLockTimer(60 * 24 * 60, () => new Date(), onExpire);
    vi.advanceTimersByTime(2_147_483_647);
    expect(onExpire).not.toHaveBeenCalled();
    timer.stop();
  });
});
