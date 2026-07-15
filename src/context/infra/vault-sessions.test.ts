import { describe, expect, it } from "vitest";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { vaultErr } from "../../vault/domain/errors.js";
import type { VaultSession } from "../application/ports/vault-session.js";
import { runWithSession } from "./vault-sessions.js";

const makeSession = () => {
  const state = { closed: false };
  const session = {
    close: () => {
      state.closed = true;
    },
  } as unknown as VaultSession;
  return { state, open: (): Result<VaultSession, DomainError> => ok(session) };
};

describe("runWithSession", () => {
  it("propagates the open error when the vault cannot open", () => {
    const r = runWithSession(
      () => vaultErr("VAULT_LOCKED", "locked"),
      () => ok("unreachable"),
    );
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
  });

  it("returns the action result and closes the session", () => {
    const { state, open } = makeSession();
    const r = runWithSession(open, () => ok(42));
    expect(r.ok && r.value).toBe(42);
    expect(state.closed).toBe(true);
  });

  it("closes the session even when the action throws", () => {
    const { state, open } = makeSession();
    expect(() =>
      runWithSession(open, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(state.closed).toBe(true);
  });
});
