import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { makeUnlockedVault } from "../../testing/test-vault.js";
import { vaultErr } from "../../vault/domain/errors.js";
import type { VaultSession } from "../application/ports/vault-session.js";
import type { ProjectName } from "../domain/values/project-name.js";
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

describe("SqliteVaultSessions — write-time lineage bump", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  const openVault = () => {
    const vault = makeUnlockedVault();
    cleanups.push(() => rmSync(vault.paths.root, { recursive: true, force: true }));
    return vault;
  };

  it("bumps the generation and mints a fresh stamp on each successful write, atomically", () => {
    const vault = openVault();
    expect(vault.deviceIdentity.lastSeen(vault.vaultId)).toBeNull();

    const first = vault.sessions.withSession((session) => session.write(() => ok("done")));
    expect(first.ok && first.value).toBe("done");
    const seenFirst = vault.deviceIdentity.lastSeen(vault.vaultId);
    expect(seenFirst?.generation).toBe(0);

    const second = vault.sessions.withSession((session) => session.write(() => ok("again")));
    expect(second.ok).toBe(true);
    const seenSecond = vault.deviceIdentity.lastSeen(vault.vaultId);
    expect(seenSecond?.generation).toBe(1);
    expect(seenSecond?.writeStamp).not.toBe(seenFirst?.writeStamp);
  });

  it("rolls back the bump when the mutation fails, and never records last-seen", () => {
    const vault = openVault();
    const result = vault.sessions.withSession((session) =>
      session.write(() => vaultErr("STORAGE_ERROR", "boom")),
    );
    expect(result.ok).toBe(false);
    expect(vault.deviceIdentity.lastSeen(vault.vaultId)).toBeNull();
  });

  it("a session that never calls write() never bumps the lineage", () => {
    const vault = openVault();
    // Read-only access — session.projects/items directly, no write() call.
    const result = vault.sessions.withSession((session) =>
      ok(session.projects.findByName("nonexistent-project" as ProjectName)),
    );
    expect(result.ok).toBe(true);
    expect(vault.deviceIdentity.lastSeen(vault.vaultId)).toBeNull();
  });
});
