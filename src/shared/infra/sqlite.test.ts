import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./migrations.js";
import { isWrongKeyError, openVaultDb } from "./sqlite.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-sqlite-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const newKey = () => randomBytes(32).toString("hex");

describe("SQLCipher engine", () => {
  it("creates, closes, and reopens with the same key", () => {
    const path = join(tmp, "reopen.db");
    const key = newKey();

    const db = openVaultDb(path, key);
    migrate(db);
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "01P",
      "vault-app",
      "2026-07-11",
      "2026-07-11",
    );
    db.close();

    const reopened = openVaultDb(path, key);
    const row = reopened.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("vault-app");
    reopened.close();
  });

  it("fails to open with a wrong key", () => {
    const path = join(tmp, "wrongkey.db");
    const db = openVaultDb(path, newKey());
    migrate(db);
    db.close();

    let caught: unknown;
    try {
      openVaultDb(path, newKey());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(isWrongKeyError(caught)).toBe(true);
  });

  it("rejects a malformed key before touching disk", () => {
    expect(() => openVaultDb(join(tmp, "never.db"), "not-hex")).toThrow(/64 hex/);
  });

  it("is a single self-consistent file at rest after every command, not only after lock", () => {
    const path = join(tmp, "single-file.db");
    const key = newKey();

    const db = openVaultDb(path, key);
    migrate(db, path);
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "01P",
      "single-file",
      "2026-07-23",
      "2026-07-23",
    );
    db.close();

    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
    expect(existsSync(`${path}-journal`)).toBe(false);

    // A bare copy of just vault.db, with no sidecars present, is the complete database.
    const copyPath = join(tmp, "single-file-copy.db");
    copyFileSync(path, copyPath);
    const reopened = openVaultDb(copyPath, key);
    const row = reopened.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("single-file");
    reopened.close();
  });

  it("folds an existing WAL from a pre-upgrade vault into vault.db on open", () => {
    const path = join(tmp, "pre-upgrade.db");
    const key = newKey();

    // Simulate a 0.2.x vault left in WAL mode with a live -wal sidecar.
    const legacy = openVaultDb(path, key);
    legacy.pragma("journal_mode = WAL");
    migrate(legacy, path);
    legacy
      .prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run("01P", "legacy", "2026-07-23", "2026-07-23");
    // Leave the connection open with committed data still possibly sitting in -wal.
    legacy.close();

    const upgraded = openVaultDb(path, key);
    expect(upgraded.pragma("journal_mode", { simple: true })).toBe("delete");
    const row = upgraded.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("legacy");
    upgraded.close();

    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
  });
});
