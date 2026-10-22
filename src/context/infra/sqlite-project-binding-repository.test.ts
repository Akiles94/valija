import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { ok } from "../../shared/domain/result.js";
import { makeUnlockedVault } from "../../testing/test-vault.js";
import type { VaultSession } from "../application/ports/vault-session.js";
import type { Project } from "../domain/entities/project.js";
import { createProjectBinding, type ProjectBinding } from "../domain/entities/project-binding.js";
import type { BindingKind, FolderTarget } from "../domain/values/binding-target.js";
import type { ProjectName } from "../domain/values/project-name.js";
import type { RepositoryTarget } from "../domain/values/repository-target.js";

const vault = makeUnlockedVault();
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const project = (id: string, name: string): Project => ({
  id,
  name: name as ProjectName,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-01T10:00:00Z"),
});

const binding = (
  id: string,
  projectId: string,
  kind: BindingKind,
  target: string,
): ProjectBinding =>
  createProjectBinding({
    id,
    projectId,
    kind,
    target: target as FolderTarget | RepositoryTarget,
    now: new Date("2026-10-19T12:00:00Z"),
  });

/** Every case runs in a real SQLCipher session, so `session.bindings` wiring is covered too. */
function inSession<T>(work: (session: VaultSession) => T): T {
  const result = vault.sessions.withSession((session) => ok(work(session)));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

inSession((session) => {
  session.projects.save(project("01PALPHA", "alpha"));
  session.projects.save(project("01PBETA", "beta"));
});

describe("SqliteProjectBindingRepository", () => {
  it("adds a binding and lists it with its project's slug", () => {
    const added = binding("b-alpha-repo", "01PALPHA", "repository", "github.com/oscar/alpha");
    expect(inSession((s) => s.bindings.add(added))).toBe(true);

    const listed = inSession((s) => s.bindings.list());
    expect(listed).toEqual([{ binding: added, projectName: "alpha" }]);
  });

  it("refuses a second binding on the same (kind, target) and keeps one row", () => {
    const duplicate = binding("b-dup", "01PBETA", "repository", "github.com/oscar/alpha");
    expect(inSession((s) => s.bindings.add(duplicate))).toBe(false);

    const onTarget = inSession((s) => s.bindings.list()).filter(
      ({ binding: b }) => b.target === "github.com/oscar/alpha",
    );
    expect(onTarget.map(({ binding: b }) => b.id)).toEqual(["b-alpha-repo"]);
  });

  it("allows the same target string under the other kind", () => {
    const folder = binding("b-alpha-folder", "01PALPHA", "folder", "github.com/oscar/alpha");
    expect(inSession((s) => s.bindings.add(folder))).toBe(true);
  });

  it("removes by id once, then reports nothing to remove", () => {
    expect(inSession((s) => s.bindings.remove("b-alpha-folder"))).toBe(true);
    expect(inSession((s) => s.bindings.remove("b-alpha-folder"))).toBe(false);
    expect(inSession((s) => s.bindings.remove("never-existed"))).toBe(false);
  });

  it("lists in project, kind, target order", () => {
    inSession((s) => {
      s.bindings.add(binding("b-beta-folder-z", "01PBETA", "folder", "/work/z"));
      s.bindings.add(binding("b-beta-repo", "01PBETA", "repository", "github.com/oscar/beta"));
      s.bindings.add(binding("b-beta-folder-a", "01PBETA", "folder", "/work/a"));
      s.bindings.add(binding("b-alpha-folder-m", "01PALPHA", "folder", "/work/m"));
    });

    const order = inSession((s) => s.bindings.list()).map(({ binding: b }) => b.id);
    expect(order).toEqual([
      "b-alpha-folder-m",
      "b-alpha-repo",
      "b-beta-folder-a",
      "b-beta-folder-z",
      "b-beta-repo",
    ]);
  });

  it("round-trips createdAt as a Date", () => {
    const [first] = inSession((s) => s.bindings.list());
    expect(first?.binding.createdAt).toEqual(new Date("2026-10-19T12:00:00Z"));
  });
});
