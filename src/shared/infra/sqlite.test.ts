import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
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
});
