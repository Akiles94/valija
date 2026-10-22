import type { Database } from "better-sqlite3-multiple-ciphers";
import type { ProjectBindingRepository } from "../application/ports/repositories.js";
import type { ProjectBinding } from "../domain/entities/project-binding.js";
import type { BoundProject } from "../domain/services/project-resolution.js";
import type { BindingKind, FolderTarget } from "../domain/values/binding-target.js";
import type { ProjectName } from "../domain/values/project-name.js";
import type { RepositoryTarget } from "../domain/values/repository-target.js";

interface BindingRow {
  id: string;
  project_id: string;
  kind: string;
  target: string;
  created_at: string;
  project_name: string;
}

/** Rows were parsed before they were written, so reading them back only re-brands them. */
const toBoundProject = (row: BindingRow): BoundProject => ({
  binding: {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as BindingKind,
    target: row.target as FolderTarget | RepositoryTarget,
    createdAt: new Date(row.created_at),
  },
  projectName: row.project_name as ProjectName,
});

export class SqliteProjectBindingRepository implements ProjectBindingRepository {
  constructor(private readonly db: Database) {}

  /** `ON CONFLICT DO NOTHING`: a concurrent insert from another process is a clean `false`, never a throw. */
  add(binding: ProjectBinding): boolean {
    const info = this.db
      .prepare(
        `INSERT INTO project_bindings (id, project_id, kind, target, created_at)
         VALUES (@id, @projectId, @kind, @target, @createdAt)
         ON CONFLICT(kind, target) DO NOTHING`,
      )
      .run({
        id: binding.id,
        projectId: binding.projectId,
        kind: binding.kind,
        target: binding.target,
        createdAt: binding.createdAt.toISOString(),
      });
    return info.changes === 1;
  }

  remove(bindingId: string): boolean {
    const info = this.db.prepare("DELETE FROM project_bindings WHERE id = ?").run(bindingId);
    return info.changes === 1;
  }

  list(): BoundProject[] {
    const rows = this.db
      .prepare(
        `SELECT b.*, p.name AS project_name
         FROM project_bindings b
         JOIN projects p ON p.id = b.project_id
         ORDER BY p.name, b.kind, b.target`,
      )
      .all() as BindingRow[];
    return rows.map(toBoundProject);
  }
}
