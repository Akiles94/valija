import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { migrate, schemaVersion } from "./migrations.js";
import { openVaultDb } from "./sqlite.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-migrations-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("Migrations", () => {
  it("applies the latest schema and is idempotent", () => {
    const db = openVaultDb(join(tmp, "idempotent.db"), randomBytes(32).toString("hex"));
    migrate(db);
    migrate(db);
    expect(schemaVersion(db)).toBe(3);
    db.close();
  });

  it("FTS triggers keep the index in sync on insert, update, and delete visibility", () => {
    const db = openVaultDb(join(tmp, "fts.db"), randomBytes(32).toString("hex"));
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
