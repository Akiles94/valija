import { randomBytes } from "node:crypto";
import { readdirSync, rmSync } from "node:fs";
import { Worker } from "node:worker_threads";
import SqliteDatabase from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { LATEST_SCHEMA_VERSION, schemaVersion } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import { makeUnlockedVault, type TestVault } from "../../testing/test-vault.js";
import { VaultSchemaTooNewError, vaultErr } from "../../vault/domain/errors.js";
import type { VaultSession } from "../application/ports/vault-session.js";
import type { ProjectName } from "../domain/values/project-name.js";
import { BUSY_MESSAGE, runWithSession, SqliteVaultSessions } from "./vault-sessions.js";

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

describe("SqliteVaultSessions — schema guard, open order, modes and busy writes (SDK)", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  const openVault = (version?: number) => {
    const vault = makeUnlockedVault();
    cleanups.push(() => rmSync(vault.paths.root, { recursive: true, force: true }));
    if (version !== undefined) setStoredSchemaVersion(vault.paths.db, vault.keyHex, version);
    return vault;
  };

  const readOnly = (sessions: SqliteVaultSessions) =>
    sessions.withSession((session) => ok(session.projects.findByName("p" as ProjectName)));

  const noAutoMigrate = (vault: TestVault) =>
    new SqliteVaultSessions(
      vault.paths,
      vault.keychain,
      vault.deviceIdentity,
      vault.guard,
      vault.idGen,
      vault.clock,
      { autoMigrate: false },
    );

  const storedVersion = (vault: TestVault) => {
    const db = new SqliteDatabase(vault.paths.db, { readonly: true });
    db.pragma("cipher='sqlcipher'");
    db.pragma(`key="x'${vault.keyHex}'"`);
    const version = schemaVersion(db);
    db.close();
    return version;
  };

  /** Push the clock past the default idle TTL from a recorded activity point. */
  const expireIdle = (vault: TestVault) => {
    vault.deviceIdentity.recordActivity(vault.vaultId, vault.clock.now());
    vault.clock.advanceMinutes(24 * 60);
  };

  it("a throw while the connection is open closes it and maps to STORAGE_ERROR (review W1)", () => {
    const vault = openVault();
    const close = vi.spyOn(SqliteDatabase.prototype, "close");
    cleanups.push(() => close.mockRestore());
    const throwingGuard = {
      guard: () => {
        throw new Error("state.json write failed");
      },
    } as unknown as TestVault["guard"];
    const sessions = new SqliteVaultSessions(
      vault.paths,
      vault.keychain,
      vault.deviceIdentity,
      throwingGuard,
      vault.idGen,
      vault.clock,
    );

    const result = readOnly(sessions);

    expect(!result.ok && result.error.code).toBe("STORAGE_ERROR");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("a newer schema → VAULT_SCHEMA_TOO_NEW; files unchanged, key kept, activity unchanged", () => {
    const vault = openVault(LATEST_SCHEMA_VERSION + 1);
    const before = snapshotVaultFiles(vault.paths);
    const activityBefore = vault.deviceIdentity.lastActivityAt(vault.vaultId);

    const result = readOnly(vault.sessions);

    expect(!result.ok && result.error).toBeInstanceOf(VaultSchemaTooNewError);
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
    expect(vault.keychain.getKey(vault.vaultId)).toBe(vault.keyHex);
    expect(vault.deviceIdentity.lastActivityAt(vault.vaultId)).toEqual(activityBefore);
  });

  it("a newer schema with the idle TTL expired is still VAULT_SCHEMA_TOO_NEW, and the key is kept", () => {
    const vault = openVault(LATEST_SCHEMA_VERSION + 1);
    expireIdle(vault);
    const result = readOnly(vault.sessions);
    expect(!result.ok && result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(vault.keychain.getKey(vault.vaultId)).toBe(vault.keyHex);
  });

  it("a current schema with the idle TTL expired → VAULT_LOCKED and the key is deleted (unchanged)", () => {
    const vault = openVault();
    expireIdle(vault);
    const result = readOnly(vault.sessions);
    expect(!result.ok && result.error.code).toBe("VAULT_LOCKED");
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();
  });

  it("autoMigrate: false on a behind vault → VAULT_UPGRADE_REQUIRED; marker, activity and backups untouched", () => {
    const vault = openVault(LATEST_SCHEMA_VERSION - 1);
    const result = readOnly(noAutoMigrate(vault));
    expect(!result.ok && result.error.code).toBe("VAULT_UPGRADE_REQUIRED");
    expect(!result.ok && result.error.message).toMatch(/allowUpgrade/);
    expect(storedVersion(vault)).toBe(LATEST_SCHEMA_VERSION - 1);
    expect(vault.deviceIdentity.lastActivityAt(vault.vaultId)).toBeNull();
    expect(readdirSync(vault.paths.root).some((f) => f.includes(".pre-"))).toBe(false);
  });

  it("autoMigrate: false on a current vault opens normally", () => {
    const vault = openVault();
    expect(readOnly(noAutoMigrate(vault)).ok).toBe(true);
  });

  it("by default a behind vault is migrated on open (D-I, unchanged)", () => {
    const vault = openVault(LATEST_SCHEMA_VERSION - 1);
    expect(readOnly(vault.sessions).ok).toBe(true);
    expect(storedVersion(vault)).toBe(LATEST_SCHEMA_VERSION);
  });

  it("a stale key → VAULT_LOCKED and the key is deleted (unchanged)", () => {
    const vault = openVault();
    vault.keychain.setKey(vault.vaultId, randomBytes(32).toString("hex"));
    const result = readOnly(vault.sessions);
    expect(!result.ok && result.error.code).toBe("VAULT_LOCKED");
    expect(vault.keychain.getKey(vault.vaultId)).toBeNull();
  });

  it("a write contended past the busy timeout → STORAGE_ERROR busy; nothing saved, no sidecar", async () => {
    const vault = openVault();
    const generationBefore = generationOf(vault);
    const holder = await holdWriteLock(vault, 6_500);

    const result = vault.sessions.withSession((session) =>
      session.write(() => {
        const at = new Date("2026-10-21T00:00:00Z");
        session.projects.save({
          id: "01BUSY",
          name: "busy" as ProjectName,
          createdAt: at,
          updatedAt: at,
        });
        return ok("saved");
      }),
    );
    await holder.exited;

    expect(!result.ok && result.error.code).toBe("STORAGE_ERROR");
    expect(!result.ok && result.error.message).toBe(BUSY_MESSAGE);
    expect(generationOf(vault)).toBe(generationBefore);
    expect(countProjects(vault)).toBe(0);
    expect(vault.deviceIdentity.lastSeen(vault.vaultId)).toBeNull();
    expect(readdirSync(vault.paths.root).sort()).toEqual(["vault.db", "vault.json"]);
  }, 20_000);
});

function generationOf(vault: TestVault): string | undefined {
  const db = openVaultDb(vault.paths.db, vault.keyHex);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'lineage_generation'").get() as
    | { value: string }
    | undefined;
  db.close();
  return row?.value;
}

function countProjects(vault: TestVault): number {
  const db = openVaultDb(vault.paths.db, vault.keyHex);
  const { n } = db.prepare("SELECT count(*) AS n FROM projects").get() as { n: number };
  db.close();
  return n;
}

/**
 * Another valija connection: a worker thread (its own SQLite connection, as another surface would
 * hold) takes BEGIN IMMEDIATE on the vault and keeps it for `ms`.
 * Resolves once the lock is held, with a promise for the worker's exit.
 */
function holdWriteLock(vault: TestVault, ms: number): Promise<{ exited: Promise<void> }> {
  const source = `
    const { parentPort, workerData } = require("node:worker_threads");
    const Sqlite = require("node:module").createRequire(workerData.anchor)("better-sqlite3-multiple-ciphers");
    const db = new Sqlite(workerData.path);
    db.pragma("cipher='sqlcipher'");
    db.pragma('key="x\\'' + workerData.key + '\\'"');
    db.exec("BEGIN IMMEDIATE");
    parentPort.postMessage("held");
    setTimeout(() => {
      db.exec("ROLLBACK");
      db.close();
    }, workerData.ms);
  `;
  const worker = new Worker(source, {
    eval: true,
    workerData: { anchor: import.meta.filename, path: vault.paths.db, key: vault.keyHex, ms },
  });
  const exited = new Promise<void>((resolve, reject) => {
    worker.once("exit", () => resolve());
    worker.once("error", reject);
  });
  return new Promise((resolve, reject) => {
    worker.once("message", () => resolve({ exited }));
    worker.once("error", reject);
  });
}
