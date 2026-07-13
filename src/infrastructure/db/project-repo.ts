import type { Database } from "better-sqlite3-multiple-ciphers";
import type { Project, ProjectSummary } from "../../domain/entities/project.js";
import type { ProjectRepository } from "../../domain/ports/repositories.js";
import type { ProjectName } from "../../domain/values/project-name.js";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name as ProjectName,
  ...(row.description === null ? {} : { description: row.description }),
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database) {}

  save(project: Project): void {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, created_at, updated_at)
         VALUES (@id, @name, @description, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      });
  }

  findByName(name: ProjectName): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE name = ?").get(name) as
      | ProjectRow
      | undefined;
    return row ? toProject(row) : null;
  }

  list(): ProjectSummary[] {
    const rows = this.db
      .prepare(
        `SELECT p.*,
                COUNT(i.id) AS item_count,
                MAX(i.updated_at) AS last_activity
         FROM projects p
         LEFT JOIN context_items i ON i.project_id = p.id AND i.archived = 0
         GROUP BY p.id
         ORDER BY last_activity DESC NULLS LAST, p.name ASC`,
      )
      .all() as Array<ProjectRow & { item_count: number; last_activity: string | null }>;
    return rows.map((row) => ({
      project: toProject(row),
      itemCount: row.item_count,
      lastActivityAt: row.last_activity ? new Date(row.last_activity) : null,
    }));
  }
}
