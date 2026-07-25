import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { FixedClock, SeqIds } from "../../testing/test-vault.js";
import { createDeviceId } from "../domain/values/device-id.js";
import { SqliteLineageStore } from "./sqlite-lineage-store.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-lineage-store-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function openTestDb(): Database {
  const path = join(tmp, `${randomBytes(4).toString("hex")}.db`);
  const db = openVaultDb(path, randomBytes(32).toString("hex"));
  migrate(db, path);
  return db;
}

describe("SqliteLineageStore", () => {
  it("reads null before any write has happened", () => {
    const db = openTestDb();
    const store = new SqliteLineageStore(db, new SeqIds(), new FixedClock());
    expect(store.read()).toBeNull();
    db.close();
  });

  it("bump starts at generation zero and mints a fresh stamp on each call", () => {
    const db = openTestDb();
    const idGen = new SeqIds();
    const store = new SqliteLineageStore(db, idGen, new FixedClock());
    const writer = createDeviceId(idGen);

    const first = store.bump(writer);
    expect(first.generation).toBe(0);
    expect(first.writer).toBe(writer);

    const second = store.bump(writer);
    expect(second.generation).toBe(1);
    expect(second.writeStamp).not.toBe(first.writeStamp);

    db.close();
  });

  it("round-trips through read after a bump", () => {
    const db = openTestDb();
    const idGen = new SeqIds();
    const store = new SqliteLineageStore(db, idGen, new FixedClock());
    const writer = createDeviceId(idGen);

    const bumped = store.bump(writer);
    expect(store.read()).toEqual(bumped);

    db.close();
  });
});
