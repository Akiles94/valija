/**
 * Extends the context_items.type CHECK to accept 'imported'. SQLite cannot ALTER
 * a CHECK constraint, so the table is rebuilt: drop the FTS triggers, recreate
 * the table with the wider CHECK, copy every row, swap names, recreate the index
 * and triggers, then rebuild the FTS index (the rebuild changes rowids, and the
 * external-content FTS is keyed on rowid — skipping the rebuild would silently
 * break search). The whole script runs inside the migration runner's single
 * transaction, so it commits or rolls back as a unit.
 */
export const MIGRATION_002 = `
DROP TRIGGER items_ai;
DROP TRIGGER items_ad;
DROP TRIGGER items_au;

CREATE TABLE context_items_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL CHECK (type IN ('decision','progress','preference','fact','handoff','imported')),
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO context_items_new
  (id, project_id, type, content, tags, pinned, source, archived, created_at, updated_at)
SELECT
  id, project_id, type, content, tags, pinned, source, archived, created_at, updated_at
FROM context_items;

DROP TABLE context_items;
ALTER TABLE context_items_new RENAME TO context_items;

CREATE INDEX idx_items_project ON context_items(project_id, created_at DESC);

CREATE TRIGGER items_ai AFTER INSERT ON context_items BEGIN
  INSERT INTO context_items_fts(rowid, content, tags)
  VALUES (new.rowid, new.content, new.tags);
END;

CREATE TRIGGER items_ad AFTER DELETE ON context_items BEGIN
  INSERT INTO context_items_fts(context_items_fts, rowid, content, tags)
  VALUES ('delete', old.rowid, old.content, old.tags);
END;

CREATE TRIGGER items_au AFTER UPDATE ON context_items BEGIN
  INSERT INTO context_items_fts(context_items_fts, rowid, content, tags)
  VALUES ('delete', old.rowid, old.content, old.tags);
  INSERT INTO context_items_fts(rowid, content, tags)
  VALUES (new.rowid, new.content, new.tags);
END;

INSERT INTO context_items_fts(context_items_fts) VALUES('rebuild');
`;
