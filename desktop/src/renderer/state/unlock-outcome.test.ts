import { describe, expect, it } from "vitest";
import type { IpcResult, VaultUnlockResponse } from "../../shared/ipc/messages.js";
import { classifyUnlockResult } from "./unlock-outcome.js";

describe("classifyUnlockResult", () => {
  it("VAULT_UPGRADE_REQUIRED classifies as upgrade-required, not a plain error (D-J(b))", () => {
    const result: IpcResult<VaultUnlockResponse> = {
      ok: false,
      error: { code: "VAULT_UPGRADE_REQUIRED" },
    };
    expect(classifyUnlockResult(result)).toEqual({ kind: "upgrade-required" });
  });

  it("every other failure code classifies as a plain error — the upgrade screen never appears for it", () => {
    const result: IpcResult<VaultUnlockResponse> = {
      ok: false,
      error: { code: "WRONG_PASSPHRASE" },
    };
    expect(classifyUnlockResult(result)).toEqual({ kind: "error", code: "WRONG_PASSPHRASE" });
  });

  it("a successful unlock with no fork notice classifies as unlocked, with no fork key present at all", () => {
    const result: IpcResult<VaultUnlockResponse> = { ok: true, value: { vaultId: "01V" } };
    const outcome = classifyUnlockResult(result);
    expect(outcome).toEqual({ kind: "unlocked" });
    expect(outcome).not.toHaveProperty("fork");
  });

  it("a successful unlock with a fork notice carries it through unchanged", () => {
    const fork = { generation: 2, writer: "device-b", noticeCode: "VAULT_FORK_DETECTED" };
    const result: IpcResult<VaultUnlockResponse> = { ok: true, value: { vaultId: "01V", fork } };
    expect(classifyUnlockResult(result)).toEqual({ kind: "unlocked", fork });
  });
});
