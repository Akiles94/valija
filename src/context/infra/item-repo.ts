import type { Database } from "better-sqlite3-multiple-ciphers";
import type {
  ContextItemRepository,
  FindByProjectFilters,
  ItemWithProject,
  SearchResult,
} from "../application/ports/repositories.js";
import type { ContextItem } from "../domain/entities/context-item.js";
import type { Content } from "../domain/values/content.js";
import type { StorableItemType } from "../domain/values/item-type.js";
import type { ProjectName } from "../domain/values/project-name.js";
import type { Tag } from "../domain/values/tag.js";

interface ItemRow {
  id: string;
  project_id: string;
  type: string;
  content: string;
  tags: string;
  pinned: number;
  source: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

type ItemRowWithProject = ItemRow & { project_name: string };

const toItemWithProject = (row: ItemRowWithProject): ItemWithProject => ({
  item: toItem(row),
  projectName: row.project_name as ProjectName,
});

const toItem = (row: ItemRow): ContextItem => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type as StorableItemType,
  content: row.content as Content,
  tags: JSON.parse(row.tags) as Tag[],
  pinned: row.pinned === 1,
  ...(row.source === null ? {} : { source: row.source }),
  archived: row.archived === 1,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

/** Quote each term so user input cannot break FTS5 query syntax. Terms are ANDed. */
const toFtsQuery = (query: string): string =>
  query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" ");

/** Context items in the encrypted SQLite database, searched through its FTS5 index. */
export class SqliteContextItemRepository implements ContextItemRepository {
  constructor(private readonly db: Database) {}

  save(item: ContextItem): void {
    this.db
      .prepare(
        `INSERT INTO context_items
           (id, project_id, type, content, tags, pinned, source, archived, created_at, updated_at)
         VALUES (@id, @projectId, @type, @content, @tags, @pinned, @source, @archived, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           content = excluded.content,
           tags = excluded.tags,
           pinned = excluded.pinned,
           source = excluded.source,
           archived = excluded.archived,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: item.id,
        projectId: item.projectId,
        type: item.type,
        content: item.content,
        tags: JSON.stringify(item.tags),
        pinned: item.pinned ? 1 : 0,
        source: item.source ?? null,
        archived: item.archived ? 1 : 0,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
  }

  findById(itemId: string): ItemWithProject | null {
    const row = this.db
      .prepare(
        `SELECT i.*, p.name AS project_name
         FROM context_items i JOIN projects p ON p.id = i.project_id
         WHERE i.id = @itemId`,
      )
      .get({ itemId }) as ItemRowWithProject | undefined;
    return row === undefined ? null : toItemWithProject(row);
  }

  /** SQLite's LIKE is ASCII case-insensitive. Callers pass a parsed ItemReference, whose charset has no `%`/`_`. */
  findByIdPrefix(prefix: string, limit: number): ItemWithProject[] {
    const rows = this.db
      .prepare(
        `SELECT i.*, p.name AS project_name
         FROM context_items i JOIN projects p ON p.id = i.project_id
         WHERE i.id LIKE @prefix || '%'
         ORDER BY i.id LIMIT @limit`,
      )
      .all({ prefix, limit }) as ItemRowWithProject[];
    return rows.map(toItemWithProject);
  }

  findByProject(projectId: string, filters: FindByProjectFilters = {}): ContextItem[] {
    const conditions = ["project_id = @projectId"];
    const params: Record<string, unknown> = { projectId };
    if (!filters.includeArchived) conditions.push("archived = 0");
    if (filters.type !== undefined) {
      conditions.push("type = @type");
      params.type = filters.type;
    }
    if (filters.pinned !== undefined) {
      conditions.push("pinned = @pinned");
      params.pinned = filters.pinned ? 1 : 0;
    }
    const limit = filters.limit !== undefined ? ` LIMIT ${Math.max(0, filters.limit)}` : "";
    const rows = this.db
      .prepare(
        `SELECT * FROM context_items WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC${limit}`,
      )
      .all(params) as ItemRow[];
    return rows.map(toItem);
  }

  search(query: string, projectId?: string, limit = 20): SearchResult[] {
    const fts = toFtsQuery(query);
    if (fts.length === 0) return [];
    const projectFilter = projectId !== undefined ? "AND i.project_id = @projectId" : "";
    const rows = this.db
      .prepare(
        `SELECT i.*, p.name AS project_name
         FROM context_items_fts f
         JOIN context_items i ON i.rowid = f.rowid
         JOIN projects p ON p.id = i.project_id
         WHERE context_items_fts MATCH @fts AND i.archived = 0 ${projectFilter}
         ORDER BY rank LIMIT @limit`,
      )
      .all({ fts, projectId, limit }) as ItemRowWithProject[];
    return rows.map(toItemWithProject);
  }
}
