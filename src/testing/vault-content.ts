import { createHash } from "node:crypto";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { openVaultDb } from "../shared/infra/sqlite.js";

/** Terms whose FTS match counts are part of the checksum; `seedVaultContent` plants each of them. */
export const CONTENT_TERMS = ["sqlcipher", "handoff", "zebrafish"] as const;

/**
 * sha256 over every row of projects, context_items and project_bindings (id order), `meta` minus
 * the four `lineage_*` rows, and the FTS match count of each `CONTENT_TERMS` term — "the content is
 * identical row for row, apart from the lineage" (REKEY §5.2) in one equality.
 */
export function contentChecksum(dbPath: string, keyHex: string): string {
  const db = openVaultDb(dbPath, keyHex);
  try {
    return contentChecksumOf(db);
  } finally {
    db.close();
  }
}

/** `contentChecksum` over an already open connection. */
export function contentChecksumOf(db: Database): string {
  const hash = createHash("sha256");
  for (const table of ["projects", "context_items", "project_bindings"]) {
    hash.update(JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  }
  hash.update(
    JSON.stringify(
      db.prepare("SELECT key, value FROM meta WHERE key NOT LIKE 'lineage_%' ORDER BY key").all(),
    ),
  );
  for (const term of CONTENT_TERMS) {
    hash.update(
      JSON.stringify(
        db
          .prepare("SELECT count(*) AS n FROM context_items_fts WHERE context_items_fts MATCH ?")
          .get(term),
      ),
    );
  }
  return hash.digest("hex");
}

/** How much `seedVaultContent` writes. */
export interface SeedSize {
  projects: number;
  items: number;
  wordsPerItem: number;
}

/**
 * Fills a migrated vault with deterministic projects, folder bindings and items through the real
 * tables, so the FTS triggers fire. About 7 KB of database per item at 600 words per item.
 */
export function seedVaultContent(dbPath: string, keyHex: string, size: SeedSize): void {
  const db = openVaultDb(dbPath, keyHex);
  try {
    db.transaction(() => insertSeed(db, size))();
  } finally {
    db.close();
  }
}

function insertSeed(db: Database, size: SeedSize): void {
  const at = "2026-10-26T00:00:00Z";
  const words = wordSource();
  const project = db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  const binding = db.prepare(
    "INSERT INTO project_bindings (id, project_id, kind, target, created_at) VALUES (?, ?, 'folder', ?, ?)",
  );
  const item = db.prepare(
    "INSERT INTO context_items (id, project_id, type, content, tags, created_at, updated_at) VALUES (?, ?, 'fact', ?, '[]', ?, ?)",
  );
  for (let p = 0; p < size.projects; p++) {
    const id = `01PROJECT${String(p).padStart(5, "0")}`;
    project.run(id, `project-${p}`, at, at);
    binding.run(`01BINDING${String(p).padStart(5, "0")}`, id, `/work/project-${p}`, at);
  }
  for (let i = 0; i < size.items; i++) {
    const projectId = `01PROJECT${String(i % size.projects).padStart(5, "0")}`;
    const text = Array.from({ length: size.wordsPerItem }, words).join(" ");
    const marker = CONTENT_TERMS[i % CONTENT_TERMS.length];
    item.run(`01ITEM${String(i).padStart(8, "0")}`, projectId, `${marker} ${text}`, at, at);
  }
}

/** A deterministic stream of made-up words (a small LCG over syllables), never random bytes. */
function wordSource(): () => string {
  const syllables = ["ka", "lo", "mi", "ten", "sor", "va", "qui", "dre", "pa", "nu", "zel", "ho"];
  let state = 7;
  return () => {
    let word = "";
    for (let s = 0; s < 3; s++) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      word += syllables[(state >>> 16) % syllables.length];
    }
    return word;
  };
}
