import { describe, expect, it, vi } from "vitest";
import { type FocusTarget, wireFocusRefresh } from "./focus-refresh.js";

class FakeFocusTarget implements FocusTarget {
  private readonly listeners = new Set<() => void>();
  addEventListener(_type: "focus", listener: () => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: "focus", listener: () => void): void {
    this.listeners.delete(listener);
  }
  dispatchFocus(): void {
    for (const listener of this.listeners) listener();
  }
}

describe("wireFocusRefresh", () => {
  it("does not call refetch until the target actually regains focus — no timer firing it eagerly", () => {
    const target = new FakeFocusTarget();
    const refetch = vi.fn();
    wireFocusRefresh(target, refetch);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("calls refetch once per focus event", () => {
    const target = new FakeFocusTarget();
    const refetch = vi.fn();
    wireFocusRefresh(target, refetch);

    target.dispatchFocus();
    expect(refetch).toHaveBeenCalledTimes(1);
    target.dispatchFocus();
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("the returned cleanup stops future focus events from re-triggering refetch", () => {
    const target = new FakeFocusTarget();
    const refetch = vi.fn();
    const cleanup = wireFocusRefresh(target, refetch);

    cleanup();
    target.dispatchFocus();

    expect(refetch).not.toHaveBeenCalled();
  });
});
