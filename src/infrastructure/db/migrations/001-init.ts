export const MIGRATION_001 = `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE context_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL CHECK (type IN ('decision','progress','preference','fact','handoff')),
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_items_project ON context_items(project_id, created_at DESC);

CREATE VIRTUAL TABLE context_items_fts USING fts5(
  content,
  tags,
  content='context_items',
  content_rowid='rowid'
);

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
`;
