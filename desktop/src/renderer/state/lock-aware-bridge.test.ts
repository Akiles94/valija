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

  describe("newer-schema routing (P-18 (b))", () => {
    const versions = { vaultVersion: 5, supportedVersion: 4 };
    const tooNew = {
      ok: false as const,
      error: { code: "VAULT_SCHEMA_TOO_NEW", schema: versions },
    };

    it("a nested call returning VAULT_SCHEMA_TOO_NEW with schema calls onSchemaTooNew once with the versions, never onLocked", async () => {
      const onLocked = vi.fn();
      const onSchemaTooNew = vi.fn();
      const bridge = { content: { projects: vi.fn().mockResolvedValue(tooNew) } };

      const result = await withLockDetection(
        bridge as never,
        onLocked,
        onSchemaTooNew,
      ).content.projects();

      expect(onSchemaTooNew).toHaveBeenCalledTimes(1);
      expect(onSchemaTooNew).toHaveBeenCalledWith(versions);
      expect(onLocked).not.toHaveBeenCalled();
      expect(result).toBe(tooNew);
    });

    it("the same code without schema calls neither callback (the screen shows its inline copy)", async () => {
      const onLocked = vi.fn();
      const onSchemaTooNew = vi.fn();
      const bare = { ok: false as const, error: { code: "VAULT_SCHEMA_TOO_NEW" } };
      const bridge = { content: { search: vi.fn().mockResolvedValue(bare) } };

      await withLockDetection(bridge as never, onLocked, onSchemaTooNew).content.search(
        {} as never,
      );

      expect(onSchemaTooNew).not.toHaveBeenCalled();
      expect(onLocked).not.toHaveBeenCalled();
    });

    it("vault.unlock and vault.upgradeCheck route too", async () => {
      const onSchemaTooNew = vi.fn();
      const bridge = {
        vault: {
          unlock: vi.fn().mockResolvedValue(tooNew),
          upgradeCheck: vi.fn().mockResolvedValue(tooNew),
        },
      };
      const wrapped = withLockDetection(bridge as never, vi.fn(), onSchemaTooNew);

      await wrapped.vault.unlock({ passphrase: "x" });
      await wrapped.vault.upgradeCheck({ passphrase: "x" });

      expect(onSchemaTooNew).toHaveBeenCalledTimes(2);
    });

    it("with no third argument a newer-schema result is returned unchanged and nothing throws", async () => {
      const bridge = { content: { projects: vi.fn().mockResolvedValue(tooNew) } };
      const result = await withLockDetection(bridge as never, vi.fn()).content.projects();
      expect(result).toBe(tooNew);
    });
  });
});
