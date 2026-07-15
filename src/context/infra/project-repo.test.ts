import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import type { ContextItem } from "../domain/entities/context-item.js";
import type { Project } from "../domain/entities/project.js";
import type { Content } from "../domain/values/content.js";
import type { ProjectName } from "../domain/values/project-name.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { SqliteProjectRepository } from "./project-repo.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-projrepo-"));
const db = openVaultDb(join(tmp, "vault.db"), randomBytes(32).toString("hex"));
const projects = new SqliteProjectRepository(db);
const items = new SqliteContextItemRepository(db);

beforeAll(() => migrate(db));
afterAll(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

let seq = 0;
const project = (name: string): Project => ({
  id: `01PROJ${seq++}`,
  name: name as ProjectName,
  createdAt: new Date("2026-07-01T10:00:00Z"),
  updatedAt: new Date("2026-07-01T10:00:00Z"),
});

const item = (projectId: string, content: string, archived = false): ContextItem => ({
  id: `01ITEM${String(++seq).padStart(4, "0")}`,
  projectId,
  type: "decision",
  content: content as Content,
  tags: [],
  pinned: false,
  archived,
  createdAt: new Date(Date.UTC(2026, 6, 1, 10, 0, seq)),
  updatedAt: new Date(Date.UTC(2026, 6, 1, 10, 0, seq)),
});

describe("SqliteProjectRepository", () => {
  it("saves and finds by name", () => {
    const p = project("vault-app");
    projects.save(p);
    const found = projects.findByName("vault-app" as ProjectName);
    expect(found?.id).toBe(p.id);
    expect(projects.findByName("nope" as ProjectName)).toBeNull();
  });

  it("upserts on same id", () => {
    const p = project("upsertable");
    projects.save(p);
    projects.save({ ...p, description: "now with description" });
    expect(projects.findByName(p.name)?.description).toBe("now with description");
  });

  it("lists with item counts excluding archived", () => {
    const p = project("counted");
    projects.save(p);
    items.save(item(p.id, "alpha decision"));
    items.save(item(p.id, "beta archived", true));
    const summary = projects.list().find((s) => s.project.name === "counted");
    expect(summary?.itemCount).toBe(1);
    expect(summary?.lastActivityAt).toBeInstanceOf(Date);
  });
});
