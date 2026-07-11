import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import type { ContextItem } from "../domain/entities/context-item.js";
import type { Project } from "../domain/entities/project.js";
import type { ItemType } from "../domain/values/item-type.js";
import type { ProjectName } from "../domain/values/project-name.js";
import type { Tag } from "../domain/values/tag.js";
import { SqliteContextItemRepository } from "./item-repo.js";
import { SqliteProjectRepository } from "./project-repo.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-repo-"));
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

const item = (
  projectId: string,
  content: string,
  overrides: Partial<Pick<ContextItem, "type" | "pinned" | "archived" | "tags" | "createdAt">> = {},
): ContextItem => {
  seq++;
  return {
    id: `01ITEM${String(seq).padStart(4, "0")}`,
    projectId,
    type: (overrides.type ?? "decision") as ItemType,
    content,
    tags: overrides.tags ?? [],
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    createdAt: overrides.createdAt ?? new Date(Date.UTC(2026, 6, 1, 10, 0, seq)),
    updatedAt: overrides.createdAt ?? new Date(Date.UTC(2026, 6, 1, 10, 0, seq)),
  };
};

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
    items.save(item(p.id, "beta archived", { archived: true }));
    const summary = projects.list().find((s) => s.project.name === "counted");
    expect(summary?.itemCount).toBe(1);
    expect(summary?.lastActivityAt).toBeInstanceOf(Date);
  });
});

describe("SqliteContextItemRepository", () => {
  it("findByProject filters by type, pinned, and excludes archived by default", () => {
    const p = project("filters");
    projects.save(p);
    items.save(item(p.id, "a decision", { type: "decision" as ItemType }));
    items.save(item(p.id, "a fact", { type: "fact" as ItemType }));
    items.save(item(p.id, "pinned pref", { type: "preference" as ItemType, pinned: true }));
    items.save(item(p.id, "gone", { archived: true }));

    expect(items.findByProject(p.id)).toHaveLength(3);
    expect(items.findByProject(p.id, { type: "fact" as ItemType })).toHaveLength(1);
    expect(items.findByProject(p.id, { pinned: true })[0]?.content).toBe("pinned pref");
    expect(items.findByProject(p.id, { includeArchived: true })).toHaveLength(4);
    expect(items.findByProject(p.id, { limit: 2 })).toHaveLength(2);
  });

  it("returns newest first", () => {
    const p = project("ordering");
    projects.save(p);
    items.save(item(p.id, "older", { createdAt: new Date("2026-07-01T00:00:00Z") }));
    items.save(item(p.id, "newer", { createdAt: new Date("2026-07-02T00:00:00Z") }));
    const list = items.findByProject(p.id);
    expect(list[0]?.content).toBe("newer");
  });

  it("searches across projects and scoped to one", () => {
    const p1 = project("search-one");
    const p2 = project("search-two");
    projects.save(p1);
    projects.save(p2);
    items.save(item(p1.id, "we chose sqlcipher for the vault"));
    items.save(item(p2.id, "sqlcipher rejected here"));

    const all = items.search("sqlcipher");
    expect(all.length).toBeGreaterThanOrEqual(2);
    const scoped = items.search("sqlcipher", p1.id);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.projectName).toBe("search-one");
  });

  it("search round-trips tags and does not choke on quotes", () => {
    const p = project("search-tags");
    projects.save(p);
    items.save(item(p.id, "tagged item", { tags: ["argon2", "kdf"] as Tag[] }));
    expect(items.search("argon2", p.id)).toHaveLength(1);
    expect(items.search('"quoted" thing', p.id)).toHaveLength(0);
    expect(items.search("   ", p.id)).toHaveLength(0);
  });

  it("archive hides items from search and default find", () => {
    const p = project("archiving");
    projects.save(p);
    const it1 = item(p.id, "soon to vanish zanzibar");
    items.save(it1);
    expect(items.search("zanzibar", p.id)).toHaveLength(1);
    expect(items.archive(it1.id)).toBe(true);
    expect(items.search("zanzibar", p.id)).toHaveLength(0);
    expect(items.findByProject(p.id)).toHaveLength(0);
    expect(items.archive("missing-id")).toBe(false);
  });
});
