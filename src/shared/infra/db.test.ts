import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { migrate, schemaVersion } from "./migrations.js";
import { isWrongKeyError, openVaultDb } from "./sqlite.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-db-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const newKey = () => randomBytes(32).toString("hex");

describe("Encrypted vault database", () => {
  it("creates, migrates, closes, and reopens with the same key", () => {
    const path = join(tmp, "reopen.db");
    const key = newKey();

    const db = openVaultDb(path, key);
    migrate(db);
    expect(schemaVersion(db)).toBe(1);
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

  it("migration is idempotent", () => {
    const path = join(tmp, "idempotent.db");
    const key = newKey();
    const db = openVaultDb(path, key);
    migrate(db);
    migrate(db);
    expect(schemaVersion(db)).toBe(1);
    db.close();
  });

  it("FTS triggers keep the index in sync", () => {
    const path = join(tmp, "fts.db");
    const db = openVaultDb(path, newKey());
    migrate(db);
    db.prepare(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'p', '2026', '2026')",
    ).run();
    db.prepare(
      "INSERT INTO context_items (id, project_id, type, content, tags, created_at, updated_at) " +
        "VALUES ('01I', '01P', 'decision', 'we chose sqlcipher for encryption', '[\"db\"]', '2026', '2026')",
    ).run();

    const hits = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'sqlcipher'")
      .all();
    expect(hits).toHaveLength(1);

    db.prepare("UPDATE context_items SET content = 'we chose argon2id' WHERE id = '01I'").run();
    const stale = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'sqlcipher'")
      .all();
    const fresh = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'argon2id'")
      .all();
    expect(stale).toHaveLength(0);
    expect(fresh).toHaveLength(1);
    db.close();
  });
});
