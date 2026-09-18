import { describe, expect, it } from "vitest";
import {
  afterCreateSuccess,
  afterKitAcknowledged,
  afterLock,
  afterMigrationCancelled,
  afterStatusCheck,
  afterUnlockFailure,
  afterUnlockSuccess,
  afterUnlockUpgradeRequired,
  canNavigateAwayFrom,
  creating,
  INITIAL_STATE,
  unlocking,
} from "./session-state.js";

describe("session-state", () => {
  it("starts in 'checking'", () => {
    expect(INITIAL_STATE).toEqual({ phase: "checking" });
  });

  it("afterStatusCheck routes to no-vault, locked, or unlocked", () => {
    expect(afterStatusCheck({ initialized: false, unlocked: false })).toEqual({
      phase: "no-vault",
    });
    expect(afterStatusCheck({ initialized: true, unlocked: false })).toEqual({ phase: "locked" });
    expect(afterStatusCheck({ initialized: true, unlocked: true })).toEqual({ phase: "unlocked" });
  });

  it("the create-vault flow passes through kit-pending before unlocked", () => {
    expect(creating()).toEqual({ phase: "creating" });
    expect(afterCreateSuccess()).toEqual({ phase: "kit-pending" });
    expect(afterKitAcknowledged()).toEqual({ phase: "unlocked" });
  });

  it("the unlock flow reaches unlocked, carrying a fork notice only when one is present", () => {
    expect(unlocking()).toEqual({ phase: "unlocking" });
    expect(afterUnlockSuccess()).toEqual({ phase: "unlocked" });
    expect(afterUnlockSuccess()).not.toHaveProperty("forkNotice");
    const withFork = afterUnlockSuccess({
      generation: 2,
      writer: "01DEVICE",
      noticeCode: "VAULT_FORK_DETECTED",
    });
    expect(withFork).toEqual({
      phase: "unlocked",
      forkNotice: { generation: 2, writer: "01DEVICE", noticeCode: "VAULT_FORK_DETECTED" },
    });
  });

  it("an upgrade-required refusal routes to upgrade-required, not locked", () => {
    expect(afterUnlockUpgradeRequired()).toEqual({ phase: "upgrade-required" });
  });

  it("any other unlock failure stays locked", () => {
    expect(afterUnlockFailure()).toEqual({ phase: "locked" });
  });

  it("cancelling the migration confirmation returns to locked, not unlocked", () => {
    expect(afterMigrationCancelled()).toEqual({ phase: "locked" });
  });

  it("locking returns to locked from any prior state", () => {
    expect(afterLock()).toEqual({ phase: "locked" });
  });

  it("canNavigateAwayFrom is false only during kit-pending — the D-U(a) invariant", () => {
    expect(canNavigateAwayFrom({ phase: "kit-pending" })).toBe(false);
    expect(canNavigateAwayFrom({ phase: "checking" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "no-vault" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "creating" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "locked" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "unlocking" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "upgrade-required" })).toBe(true);
    expect(canNavigateAwayFrom({ phase: "unlocked" })).toBe(true);
  });
});
