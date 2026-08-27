import { describe, expect, it, vi } from "vitest";
import { withLockDetection } from "./lock-aware-bridge.js";

describe("withLockDetection", () => {
  it("calls onLocked when a nested call resolves to a VAULT_LOCKED error, and still returns it unchanged", async () => {
    const onLocked = vi.fn();
    const locked = { ok: false as const, error: { code: "VAULT_LOCKED" } };
    const bridge = { content: { projects: vi.fn().mockResolvedValue(locked) } };

    const result = await withLockDetection(bridge as never, onLocked).content.projects();

    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(result).toBe(locked);
  });

  it("does not call onLocked for a successful result", async () => {
    const onLocked = vi.fn();
    const bridge = {
      content: { projects: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
    };

    await withLockDetection(bridge as never, onLocked).content.projects();

    expect(onLocked).not.toHaveBeenCalled();
  });

  it("does not call onLocked for a failure with a different error code", async () => {
    const onLocked = vi.fn();
    const bridge = {
      content: {
        projects: vi.fn().mockResolvedValue({ ok: false, error: { code: "STORAGE_ERROR" } }),
      },
    };

    await withLockDetection(bridge as never, onLocked).content.projects();

    expect(onLocked).not.toHaveBeenCalled();
  });

  it("does not call onLocked for a plain (non-IpcResult) response, like tools.status()", async () => {
    const onLocked = vi.fn();
    const bridge = { tools: { status: vi.fn().mockResolvedValue([{ client: "claude-code" }]) } };

    await withLockDetection(bridge as never, onLocked).tools.status();

    expect(onLocked).not.toHaveBeenCalled();
  });

  it("wraps every nested namespace, not just the top level", async () => {
    const onLocked = vi.fn();
    const locked = { ok: false as const, error: { code: "VAULT_LOCKED" } };
    const bridge = {
      relocation: { move: vi.fn().mockResolvedValue(locked) },
    };

    await withLockDetection(bridge as never, onLocked).relocation.move({} as never);

    expect(onLocked).toHaveBeenCalledTimes(1);
  });
});
