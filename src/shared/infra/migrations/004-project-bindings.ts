/**
 * Adds the project_bindings table (PROJECT-DETECT, D-A): user-made links from a
 * folder or a git repository to one project. Purely additive — no existing table
 * changes. `IF NOT EXISTS` is required, not a style choice: two upgrade tests roll
 * meta.schema_version back over a fully migrated database and migrate again, and a
 * plain CREATE TABLE would fail there with "table already exists" (the same reason
 * 003 uses INSERT OR IGNORE). The UNIQUE (kind, target) index is the only one: a
 * vault holds tens of bindings, and the list query reads them all.
 */
export const MIGRATION_004 = `
CREATE TABLE IF NOT EXISTS project_bindings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('folder','repository')),
  target TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, target)
);
`;
