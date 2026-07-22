Approved: Oscar 2026-07-17

# M2 — Importers · Execution Plan

**Branch:** `feat/importers-M2` (created off `main` @ `bdd2553`).
**Source of truth:** `advances/M2/refined.md` (Confirmed 2026-07-16) + the current repo.
**Planner note:** I did not refine this spec. Where the spec left a detail underdetermined
(never contradicted), I chose a default and flagged it in *§Decisions to confirm* or *§Assumptions*.
No blocking inconsistency was found; the plan is executable as written.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Facts verified against the code, not older plans:

- `UseCase<In,Out>.execute(input): Result` and `AsyncUseCase` — `src/shared/application/use-case.ts`. Import path uses the **sync** `UseCase` (D-I).
- `VaultSessions.withSession<T>(action): Result<T,DomainError>` is **synchronous**, exposes `session.projects` + `session.items` only — `src/context/application/ports/vault-session.ts`. Import writes go through it via a `context` use case (never `session.items.save` from `importers`).
- `migrate(db)` runs on **every** session open and every db init — `src/context/infra/vault-sessions.ts:69`, `src/vault/infra/file-vault-store.ts:29`. Both call sites hold `this.paths.db`, so passing the db path into `migrate` is a two-line change per call site.
- Per-migration transaction already exists — `src/shared/infra/migrations.ts:16` (`db.transaction(...)`). Migration 002 rides inside it. The **backup/rollback file dance lives in the runner around that transaction**, not in SQL.
- `ITEM_TYPES` = 5 saveable types, reused verbatim as the MCP `save_context` enum — `item-type.ts:4`, `mcp/server.ts:53`. **Do not touch `ITEM_TYPES`.**
- `Content` is ≤ 32 KB **UTF-8 bytes** (`content.ts:4`), enforced by `parseContent`. Chunk targets are byte-based.
- `context_items` schema + FTS5 external-content + 3 triggers (`items_ai/ad/au`) + `idx_items_project` — `migrations/001-init.ts`. FTS is keyed on `rowid`; a table rebuild **must** end with `INSERT INTO context_items_fts(context_items_fts) VALUES('rebuild')`.
- Repo `save()` already upserts via `ON CONFLICT(id) DO UPDATE` — `item-repo.ts:56`. Deterministic ids (D-C 2a) reuse this; **no new port**.
- `ContextItem.type: ItemType` (the 5). Storing `imported` requires widening this field to a new `StorableItemType` (the 6). `context-pack.ts` filters by the 4 section types + `handoff`; `imported` matches none and is never pinned, so it is auto-excluded from packs with **no change to the pack algorithm**.
- `tsconfig` has `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` + `strict`. New code follows the existing `...(x === undefined ? {} : { x })` optional-spread idiom.
- **No root `README.md` and no `CHANGELOG.md` exist** (only `docs/SPEC.md`). See *§Decisions to confirm* D3.

---

## 1. Decisions to confirm (tech trade-offs — please answer before Slice 4/5)

> **RESOLVED (Oscar, 2026-07-17):** D1 → Option A (`wal_checkpoint(TRUNCATE)` + `copyFileSync`). D2 → yes, gate the backup on `current >= 1`. D3 → **create root `README.md`** (install + "import your history" + MCP distillation) and add the sections to `docs/SPEC.md`. D4 → **create `CHANGELOG.md`** (Keep-a-Changelog; 0.1.0 baseline + 0.2.0 entry). D5 → `fflate@^0.8.2`, not in `tsup` external. D6 → count semantics as proposed below. All slices are unblocked.

These are the only open technical choices; each has a recommended default so execution is not blocked.

**D1 — Pre-002 backup consistency under WAL.** The confirmed decision is a ciphertext copy of `vault.db` before the rebuild. The db is in WAL mode by the time `migrate` runs, so a raw file copy could miss pages still in `vault.db-wal`.
- **Option A (recommended):** inside `migrate`, right before the 002 transaction, run `db.pragma("wal_checkpoint(TRUNCATE)")` then `copyFileSync(dbPath, dbPath + ".pre-002.bak")`. Single-threaded, so the snapshot is consistent; delete the `.bak` after the transaction commits. Cost: +1 pragma; copies one file.
- **Option B:** copy the file *before opening the write connection* (peek `schema_version` via a short read-only open, close, copy, reopen). Cleaner snapshot, but two opens and more code.
- **Trade-off:** A is simpler and matches "the runner touches real data"; B avoids reasoning about WAL entirely. Recommend **A**.

**D2 — Backup scope.** Take the `.bak` only when upgrading an existing v1 vault (`current >= 1` at the start of `migrate`), **not** on a fresh `init` (where 001+002 run on empty tables). Recommended: **yes, gate on `current >= 1`** so a fresh install never litters a `.bak`. Confirm.

**D3 — Where the user docs land.** Spec §9 asks for a README note (MCP distillation path + "import your history"), but **no `README.md` exists**; only `docs/SPEC.md`.
- **Option A (recommended):** add the two sections to `docs/SPEC.md` (the existing product spec that `specs/` already links to) and create a minimal root `README.md` with install + "import your history" + distillation.
- **Option B:** put everything only in `docs/SPEC.md`, skip README.
- Recommend **A** (a public npm package needs a README). Confirm whether to create `README.md`.

**D4 — `CHANGELOG.md`.** None exists. Recommend creating one (Keep-a-Changelog style) with a `0.1.0` baseline entry and the `0.2.0` importers entry. Confirm create-vs-skip.

**D5 — fflate version.** Add `fflate` (zero-dependency) to `dependencies`. Recommended pin: `^0.8.2`. It stays **out** of `tsup` `external` (pure JS, safe to bundle). Confirm the version.

**D6 — Summary counts semantics** (spec §7 line `(skipped S, failed F)` is not fully pinned). Proposed definitions, used consistently by the use case and the CLI:
- `imported N` = item chunks successfully upserted.
- `from M conversation(s)` = conversations that contributed ≥ 1 imported chunk.
- `skipped S` = conversations that were selected but rendered **zero** chunks (empty/no textual messages).
- `failed F` = conversations whose parse or persist raised an error (collected, non-fatal).
Confirm these definitions (they drive the tests).

---

## 2. Naming & DDD consistency check

Repo conventions observed: `parseX` (parse-don't-validate, returns `Result`), `createX` total factories, `xxxErr(code,msg)` per-context error constructors, `SqliteXRepository` / `FileX` / `OsX` tech-named adapters, `XUseCase`-style classes implementing `UseCase`, one bounded context per top-level folder with `domain/application/infra`.

Proposed names, all consistent:

| Concern | Name | Rationale |
|---|---|---|
| New module | `src/importers/` | Mirrors `context`/`vault` module-first layout. |
| Error ctor | `importerErr(code, message)` + `ImporterErrorCode` | Mirrors `contextErr`/`vaultErr`. |
| Normalized IR | `Conversation`, `Message`, `Role` | Importers ubiquitous language: conversation/message/role. |
| Parser port | `ConversationParser` with `detect(doc)` + `parse(doc)` | Spec §D-A wording. |
| Source id | `ImportSource = "chatgpt" \| "claude" \| "generic"` | Matches `sourceId` tag values (D-G). |
| Parser adapters | `ChatgptParser`, `ClaudeParser`, `GenericParser` | PascalCase; `implements ConversationParser`. |
| Reader port / adapter | `ExportReader` / `FileExportReader` | `FileVaultStore`/`OsKeychain` tech-named-adapter convention. |
| Chunk service | `renderConversationChunks(conversation, source): string[]` | Pure domain service, mirrors `context-pack.ts`. |
| Selection service | `parsePickSpec(spec, count)`, `selectConversations(convos, filters)` | Pure, parse-don't-validate. |
| Importers orchestrator | `ImportConversations` (`UseCase<In,Out>`) | Verb+aggregate; distinct from context's `ImportItems`. |
| Context write use case | `ImportItems` (`UseCase<In,Out>`) | Guardian of `ContextItem`; batch, one session. |
| Imported factory | `createImportedContextItem(...)` + `importedItemId(...)` | Mirrors `createContextItem`. |
| Storable types | `STORABLE_ITEM_TYPES`, `StorableItemType` | Spec D-0 exact name. |
| Migration | `002-imported-type.ts` exporting `MIGRATION_002` | Mirrors `001-init.ts`/`MIGRATION_001`. |
| CLI | `importCommand(container, file, options)` in `cli/import-command.ts` | Mirrors `doctor.ts`. |

**One naming flag:** context's write use case is `ImportItems` and importers' orchestrator is `ImportConversations`. Two `Import*` use cases is intentional and unambiguous because they live in different bounded contexts with different aggregates (item-drafts vs. conversations). No rename needed.

---

## 3. Ordered steps (grouped by commit slice)

Each step is independently checkable. Run `npm run typecheck && npm run lint && npm run test` after each slice.

### Slice 1 — importers domain (IR + errors + chunk/render + selection) + ports
Pure, no I/O, no vault, no fflate. Fully unit-testable in isolation.

1. **`src/importers/domain/errors.ts`** — `ImporterErrorCode` union exactly per §D-E (`UNSUPPORTED_SOURCE · MALFORMED_EXPORT · EMPTY_EXPORT · UNREADABLE_FILE · CORRUPT_ARCHIVE · INVALID_SELECTION · NO_CONVERSATIONS_SELECTED · UNSUPPORTED_GENERIC_VERSION`) and `importerErr(code, message): Result<never, DomainError>`. Copy the `contextErr` shape.
2. **`src/importers/domain/entities/conversation.ts`** — the normalized IR (in `entities/`, mirroring `context/domain/entities/`): `Role = "user"|"assistant"|"system"`, `interface Message { role; content: string; createdAt?: Date }`, `interface Conversation { id: string; title: string; createdAt: Date; messages: readonly Message[] }`. No behavior.
   **`src/importers/domain/values/import-source.ts`** — `IMPORT_SOURCES = ["chatgpt","claude","generic"] as const` + `ImportSource` (in `values/`, mirroring `context/domain/values/`). Lives in the domain so the port, the registry, the chunk/render service, and the tags all depend inward on it — a domain→application edge is avoided.
3. **`src/importers/domain/services/chunk-render.ts`** — `renderConversationChunks(conversation, source, byteBudget = 28*1024): string[]`.
   - Build a provenance header line (title · ISO date · conversation id · `part n/m`) — provenance in the **body** (D-G), never in tags.
   - Render each message as `**user:** …` / `**assistant:** …` / `**system:** …`.
   - Greedy pack messages until the *next* message would push the encoded body over `byteBudget`; then start a new chunk. Byte length via `new TextEncoder().encode(...).length` (same as `content.ts`).
   - Oversize single message: hard-split its text at a **codepoint boundary** (iterate `Array.from(text)` accumulating byte length) so UTF-8 is never cut mid-sequence; continue the `(part n/m)` sequence.
   - Two-pass `n/m`: compute chunks first, then re-stamp the header with the final `m`.
   - Invariant asserted by tests: every returned string, re-checked by `parseContent`, is `ok` and ≤ 32 KB. The 28 KB budget is headroom for header + fences.
4. **`src/importers/domain/services/selection.ts`** —
   - `parsePickSpec(spec: string, count: number): Result<number[], DomainError>` — parse `"1,3-5"` → sorted unique **0-based** indices; any non-numeric/out-of-range/`5-3` → `importerErr("INVALID_SELECTION", …)`.
   - `selectConversations(convos, { all?, pick?, query?, since? }): Result<Conversation[], DomainError>` — filters over the **chronological-ascending** list: `--query` = case-insensitive title substring; `--since` = `createdAt >= YYYY-MM-DD` (invalid date → `INVALID_SELECTION`); `--pick` uses `parsePickSpec`; `--all` = every conversation. Empty result → `importerErr("NO_CONVERSATIONS_SELECTED", …)`. Pure.
5. **`src/importers/application/ports/parser.ts`** — imports `ImportSource` from `../../domain/values/import-source.js` and `Conversation` from `../../domain/entities/conversation.js`; `interface ParsedExport { conversations: Conversation[]; failures: ConversationFailure[] }`; `interface ConversationFailure { title: string; reason: string }`; `interface ConversationParser { readonly source: ImportSource; detect(doc: unknown): boolean; parse(doc: unknown): Result<ParsedExport, DomainError> }`. Whole-doc problems → `err(...)`; per-conversation problems → `failures[]` (D-E: collected, not fatal).
6. **`src/importers/application/ports/export-reader.ts`** — `interface ExportReader { read(filePath: string): Result<unknown[], DomainError> }` (candidate JSON documents; one for `.json`, one-per-`.json`-entry for `.zip`).

*Tests (Slice 1):* `chunk-render.test.ts` (multi-part split on boundaries; oversize single message hard-split stays valid UTF-8 and each chunk passes `parseContent`; `n/m` correct; provenance in body). `selection.test.ts` (pick ranges, malformed pick → `INVALID_SELECTION`, query, since, all, empty → `NO_CONVERSATIONS_SELECTED`).

### Slice 2 — parsers + reader adapter (fflate)
7. **`src/importers/infra/parsers/chatgpt-parser.ts`** — `detect`: array (or `{conversations:[…]}`) whose entries carry a `mapping` node tree. `parse`: linearize each `mapping` by `create_time`, role from `message.author.role`, text from `message.content.parts`, title from `title`, `createdAt` from `create_time` (unix seconds; missing → import instant, see D-F). Unparseable single conversation → `failures[]`.
8. **`src/importers/infra/parsers/claude-parser.ts`** — `detect`: entries carry `chat_messages` with `sender`. `parse`: `sender==="human"→"user"` else `"assistant"`, text from message text parts, title from `name`, `createdAt` from `created_at`.
9. **`src/importers/infra/parsers/generic-parser.ts`** — `detect`: object with `valija_import_version`. `parse`: version `!== 1` → `importerErr("UNSUPPORTED_GENERIC_VERSION", …)`; else map `conversations[].{id,title?,createdAt,messages[].{role,content,createdAt?}}` with `role ∈ {user,assistant,system}`. Never auto-selected (§D-A Option 2).
10. **`src/importers/infra/parser-registry.ts`** — `AUTODETECT_PARSERS: readonly ConversationParser[] = [chatgpt, claude]` (order matters) and `parserBySource(source): ConversationParser` including `generic`.
11. **`src/importers/infra/file-export-reader.ts`** — `FileExportReader implements ExportReader`:
    - Missing/unreadable path → `importerErr("UNREADABLE_FILE", …)`.
    - `.json`: `readFileSync` → `JSON.parse` (throw → `MALFORMED_EXPORT`) → `[doc]`.
    - `.zip`: `unzipSync(bytes, { filter })` where `filter` keeps only `*.json` entries **and** enforces the decompression cap (per-entry `originalSize` ≤ `MAX_ENTRY_BYTES`, running total ≤ `MAX_TOTAL_BYTES`); inflate failure or cap exceeded → `importerErr("CORRUPT_ARCHIVE", …)`. Parse each kept entry as JSON. **In-memory only — no temp files, no extraction dir** (§8.2).
    - Define caps as named constants (e.g. `MAX_TOTAL_BYTES = 256*1024*1024`, `MAX_ENTRY_BYTES = 128*1024*1024`) — confirm values in review.

*Tests (Slice 2):* per-parser fixture round-trips under `src/importers/infra/parsers/__fixtures__/` (tiny ChatGPT export, Claude export, generic v1); each parser **rejects the other's** export (detect miss / `MALFORMED_EXPORT`) — acceptance §9. `generic` unknown-version → `UNSUPPORTED_GENERIC_VERSION`. `file-export-reader.test.ts`: real temp `.json` and a real in-memory `zipSync` archive round-trip; a `.zip` whose entry exceeds the cap → `CORRUPT_ARCHIVE`; missing path → `UNREADABLE_FILE`; **assert no files are created outside the input** (list the temp dir before/after).

### Slice 3 — `imported` type, `ImportItems` (context), `ImportConversations` (importers)
12. **`src/context/domain/values/item-type.ts`** — add, below `ITEM_TYPES` (unchanged): `export const STORABLE_ITEM_TYPES = [...ITEM_TYPES, "imported"] as const;` and `export type StorableItemType = (typeof STORABLE_ITEM_TYPES)[number];`. `parseItemType` unchanged (still rejects `imported`).
13. **`src/context/domain/entities/context-item.ts`** — widen `ContextItem.type` from `ItemType` to `StorableItemType`. Keep `NewContextItem.type: ItemType` (save path mints only the 5). Add:
    - `importedItemId(source, conversationId, chunkIndex): string` — deterministic id from `sha256(`${source} ${conversationId} ${chunkIndex}`)` (prefix e.g. `imp-` + 32 hex). `node:crypto` hashing is pure (allowed in domain, like `TextEncoder` in `content.ts`). Not a ULID — fine, ordering is by `created_at` everywhere (D-C).
    - `createImportedContextItem(input): ContextItem` — total factory; `type: "imported"`, `archived: false`, **`createdAt` = explicit conversation date**, **`updatedAt` = `now` (import instant)** (D-F), id from `importedItemId`.
14. **`src/context/application/dto/context-item-view.ts`** — widen `ContextItemView.type` to `StorableItemType` (search/show of imported items now type-checks).
15. **`src/context/infra/item-repo.ts`** — change the `toItem` cast `row.type as ItemType` → `as StorableItemType`. No SQL change (CHECK handled by migration 002).
16. **`src/context/application/use-cases/import-items.use-case.ts`** — `ImportItems implements UseCase<ImportItemsInput, ImportItemsOutput>`, constructor `(sessions: VaultSessions, clock: Clock)`.
    - `ImportItemsInput = { projectName: string; items: ImportedItemInput[] }`, `ImportedItemInput = { source: ImportSource; conversationId: string; chunkIndex: number; content: string; createdAt: Date; tags: string[] }`.
    - Parse `projectName` **before** the session (bad input never opens the vault, mirroring `SaveContext`).
    - `withSession`: find-or-create project (reuse the `SaveContext.findOrCreateProject` pattern; extract a tiny shared helper or duplicate ~6 lines — do **not** call `SaveContext`, which opens its own session, D-C Opt 1 rejected).
    - Per item: `parseTags` + `parseContent` (defense in depth); on failure push to `failures[]` and continue (non-fatal). On success `createImportedContextItem(...)` then `session.items.save(item)` (upsert → idempotent re-import).
    - `ImportItemsOutput = { projectCreated: boolean; imported: number; failed: number; failures: { conversationId: string; reason: string }[] }`.
    - **`ImportSource` type import:** `ImportItemsInput` references `ImportSource`. To keep the dependency edge `importers → context` (not the reverse), define `ImportSource` in **`context`** is wrong. Instead type `source` as `string` in the context DTO (context does not need the union) — `importers` passes the concrete literal. *(Assumption A6.)*
17. **`src/importers/application/use-cases/import-conversations.use-case.ts`** — `ImportConversations implements UseCase<ImportConversationsInput, ImportConversationsOutput>`, constructor `(reader: ExportReader, importItems: UseCase<ImportItemsInput, ImportItemsOutput>, clock: Clock)`.
    - `importItems` is injected as the shared `UseCase<ImportItemsInput, ImportItemsOutput>` contract (types imported from `context`; allowed edge). No extra port file, keeping class count low.
    - Input: `{ filePath: string; projectName?: string; from?: ImportSource; list?: boolean; pick?: string; query?: string; since?: string; all?: boolean; dryRun?: boolean }`.
    - Pipeline: `reader.read` → resolve `(parser, doc)` → `parser.parse` → sort chronological-asc → build `ListingRow[]` → resolve **mode** → (list) return listing; (else) `selectConversations` → `renderConversationChunks` per conversation into `ImportedItemInput[]` (tags `["imported", source]`, `createdAt` = conversation date) → (dry-run) return summary, **no session** → (import) require `projectName`, call `importItems.execute`, merge counts → return.
    - **Mode resolution:** no selection flag (`pick/query/since/all`) **or** `--list` → `"list"`; else `--dry-run` → `"dry-run"`; else `"import"` (see D6 / Assumption A5).
    - **Parser resolution:** `from` set → `parserBySource(from)`, pick the doc it `detect`s (else first doc) and surface its `parse` error verbatim; `from` omitted → first `(parser, doc)` in `AUTODETECT_PARSERS × docs` with `detect === true`, else `UNSUPPORTED_SOURCE`. `generic` only via explicit `from`.
    - Output: `{ mode; source; project?; listing?: ListingRow[]; imported; skipped; failed; failures }`.

*Tests (Slice 3):* `import-items.use-case.test.ts` on a real `makeUnlockedVault()` (idempotent re-import → no dup rows; imported items excluded from a `get_context` pack; returned by `search`; tags `["imported", source]`; `createdAt` historical, `updatedAt` = clock; `VAULT_LOCKED` when key gone). `context-item.test.ts` addition for `createImportedContextItem` + `importedItemId` determinism. `import-conversations.use-case.test.ts` with a **fake** `ExportReader` + **fake** `importItems` (list mode writes nothing; dry-run opens no writer; `--pick` indexes printed order; auto-detect picks chatgpt then claude; `--from generic` required; per-conversation failure collected).

### Slice 4 — migration 002 + populated-data test
18. **`src/shared/infra/migrations/002-imported-type.ts`** — `MIGRATION_002` string, executed inside the runner's existing `db.transaction()`, in this exact order (§6):
    1. `DROP TRIGGER items_ai; DROP TRIGGER items_ad; DROP TRIGGER items_au;`
    2. `CREATE TABLE context_items_new (...)` identical to 001 but CHECK `type IN ('decision','progress','preference','fact','handoff','imported')`.
    3. `INSERT INTO context_items_new (id,project_id,type,content,tags,pinned,source,archived,created_at,updated_at) SELECT ... FROM context_items;` (explicit column list).
    4. `DROP TABLE context_items; ALTER TABLE context_items_new RENAME TO context_items;`
    5. `CREATE INDEX idx_items_project ON context_items(project_id, created_at DESC);`
    6. Recreate the 3 triggers verbatim from 001.
    7. `INSERT INTO context_items_fts(context_items_fts) VALUES('rebuild');`
    Do **not** toggle `PRAGMA foreign_keys` (can't change inside the held transaction; the FK points out to `projects`, so drop/rename is FK-safe).
19. **`src/shared/infra/migrations.ts`** — register `{ version: 2, sql: MIGRATION_002, backup: true }`; add optional param `migrate(db, dbPath?)`; before applying a `backup` migration when `current >= 1` and `dbPath` given, do the ciphertext backup (D1/D2): `db.pragma("wal_checkpoint(TRUNCATE)")` → `copyFileSync(dbPath, dbPath + ".pre-002.bak")`; after the transaction commits, delete the `.bak`; on throw, leave the `.bak` and rethrow (rollback keeps `schema_version` at 1).
20. **`src/context/infra/vault-sessions.ts`** + **`src/vault/infra/file-vault-store.ts`** — pass `this.paths.db` into `migrate(db, this.paths.db)` (two one-line edits). Existing `migrate(db)` callers in tests remain valid (param optional).

*Tests (Slice 4):* `src/shared/infra/migrations-002.test.ts` — build a **v1** db (exec `MIGRATION_001` + set `schema_version=1`), insert several projects/items (varied types, tags, pinned, one archived), run `migrate(db, path)`: assert row count + every column identical before/after, every original item still returns from FTS `MATCH`, `imported` now accepted by an insert, `schema_version === 2`, second `migrate` is a no-op, `.bak` was created and cleaned up. **Rollback test:** pre-create a stray `context_items_new` table so step 2 fails mid-migration; assert the transaction rolled back — `schema_version === 1`, triggers present, all rows intact, FTS still works. (No production seam needed for the failure injection.)

### Slice 5 — CLI + container/program wiring + docs + 0.2.0
21. **`src/delivery/container.ts`** — construct `new ImportItems(sessions, systemClock)`, `new FileExportReader()`, and `new ImportConversations(reader, importItems, systemClock)`; add `importItems` + `importConversations` to `Container`.
22. **`src/delivery/cli/import-command.ts`** — `importCommand(c, file, options)`: map options → `ImportConversationsInput`; **guard**: `-p` required for `import`/`dry-run` modes → plain `error: -p <project> is required to import` + exit 1 (Assumption A4); execute; render the **listing table** (index, date, title, msg count, est chunks) for list mode; render the summary line `Imported N item(s) from M conversation(s) into "<project>" (skipped S, failed F)` for import/dry-run and print each failure with its reason; errors via existing `fail(error)` (`error [CODE]: message`, exit 1). Mirrors `doctor.ts`/`content-commands.ts` style.
23. **`src/delivery/cli/program.ts`** — add:
    ```
    program.command("import")
      .argument("<file>", "path to an export file (.json or .zip)")
      .requiredOption... // -p optional at commander level; enforced per-mode in the command
      .option("-p, --project <project>", "target project (required to import)")
      .option("--from <provider>", "chatgpt | claude | generic (auto-detected if omitted)")
      .option("--list", "list conversations and exit")
      .option("--pick <spec>", "1-based indices/ranges, e.g. 1,3-5")
      .option("--query <text>", "filter by title substring")
      .option("--since <date>", "keep conversations on/after YYYY-MM-DD")
      .option("--all", "import every conversation")
      .option("--dry-run", "report what would be imported; write nothing")
      .action((file, options) => importCommand(container, file, options));
    ```
    `<file>` is the only positional (no commander ambiguity, per confirmed CLI decision).
24. **`src/delivery/version.ts`** → `export const VERSION = "0.2.0";`
25. **`package.json`** → `"version": "0.2.0"`; add `"fflate": "^0.8.2"` to `dependencies` (D5). `tsup.config.ts` `external` unchanged (fflate is pure JS).
26. **Docs (same commit):**
    - **`specs/importers.md`** (new) — the **User walkthrough** (workflow from the user's perspective, carried from `refined.md`); module ubiquitous language (conversation, message, role, export, parser, source, chunk, import); error vocabulary; parser port + registry + auto-detect order; generic v1 envelope schema; chunk/render rules incl. oversize-message and byte budget; `createdAt`/`updatedAt` + missing-date rule; tags/provenance policy; the CLI contract; the security section (§8: same encrypted path, in-memory zip, decompression cap, imported excluded from packs, residual prompt-injection risk left un-sanitized).
    - **`specs/context.md`** — add `imported` storable type + `STORABLE_ITEM_TYPES`, the `ImportItems` use case, `createImportedContextItem`, and the invariant "imported items are never pinned and never enter a context pack."
    - **`specs/delivery.md`** — add the `import` command row + `container` additions (`ImportItems`, `ImportConversations`, `FileExportReader`).
    - **`docs/SPEC.md`** and/or **`README.md`** (D3) — "import your history" + the MCP-distillation path for unsupported providers.
    - **`CHANGELOG.md`** (D4) — `0.2.0` entry.
27. **`src/delivery/mcp/server.test.ts`** — add one assertion that `save_context` rejects `type: "imported"` (MCP non-widening, acceptance §9). The existing "exactly 5 tools" test already guards the surface.

---

## 4. Test plan by layer → acceptance mapping (§9)

| Layer | File(s) | Proves (acceptance §9) |
|---|---|---|
| Domain (pure) | `chunk-render.test.ts` | oversize split, `(part n/m)`, every chunk ≤ 32 KB & valid UTF-8, provenance in body |
| Domain (pure) | `selection.test.ts` | `--pick`/`--query`/`--since`/`--all`; malformed pick → `INVALID_SELECTION`; empty → `NO_CONVERSATIONS_SELECTED` |
| Domain (entity) | `context-item.test.ts` (+) | deterministic `importedItemId`, `createImportedContextItem` timestamps (D-F) |
| Infra (parsers) | `chatgpt/claude/generic-parser.test.ts` + fixtures | round-trip each; cross-reject; unknown generic version → `UNSUPPORTED_GENERIC_VERSION` |
| Infra (reader) | `file-export-reader.test.ts` | `.json` + `.zip` in-memory; decompression cap → `CORRUPT_ARCHIVE`; missing → `UNREADABLE_FILE`; **no plaintext file written** |
| App (context) | `import-items.use-case.test.ts` | idempotent re-import (no dups); imported excluded from pack; returned by search; tags/timestamps; `VAULT_LOCKED` |
| App (importers) | `import-conversations.use-case.test.ts` | list writes nothing; dry-run opens no writer; auto-detect order; `--from` verbatim error; per-conversation failure collected; summary counts |
| Infra (shared) | `migrations-002.test.ts` | populated v1→v2 lossless; FTS intact; `imported` accepted; idempotent; transactional rollback leaves v1 intact; `.bak` created+cleaned |
| Delivery (MCP) | `server.test.ts` (+) | `save_context` still exactly 5 types; `imported` rejected |

---

## 5. Security-sensitive order of operations (must not weaken §8)

1. **Key before DB, always.** No new open path. `ImportItems` writes only through `VaultSessions.withSession` → `SqliteVaultSessions.open` (reads header → **requires keychain key** → `openVaultDb`). Locked vault → `VAULT_LOCKED` before any read/write. Import cannot bypass the passphrase (§8.3).
2. **No plaintext to disk, ever.** `FileExportReader` inflates `.zip` **in memory** (`unzipSync`), `JSON.parse` in memory, chunks go straight into the encrypted DB via the context write path. No temp files, no extraction dir. `--dry-run` prints to **stdout only** and opens **no** write session; conversation bodies are **never** written to disk or logged to stderr (§8.2). Test asserts the temp dir gains no files.
3. **Decompression-bomb guard first.** The `unzipSync` `filter` restricts to `*.json` and rejects entries/total over the caps **before** materializing them; over-cap → `CORRUPT_ARCHIVE` (§8.5).
4. **Migration 002 atomic sequence** (highest risk, §6/§11): (a) if `current >= 1`, `wal_checkpoint(TRUNCATE)` then copy ciphertext `.bak` — **before** the rebuild; (b) the entire drop-triggers → create-new → copy → drop/rename → reindex → recreate-triggers → **FTS `'rebuild'`** runs inside the single `db.transaction()`; (c) commit → delete `.bak`; (d) on any throw → rollback (schema stays v1) and **keep** the `.bak`. Never toggle `PRAGMA foreign_keys` inside the transaction. Ship only with the green populated-data + rollback tests.
5. **MCP surface unchanged.** `ITEM_TYPES` untouched → `z.enum(ITEM_TYPES)` stays 5. `imported` is unreachable from any tool (compile-time property via D-0 Option A). No new tool/argument. Distillation path is documentation only (§8.4).
6. **Encrypted-at-rest verified.** Imported rows live only in `vault.db` (SQLCipher); no sidecar store. `.bak` is ciphertext, safe on disk (§8.1/§8.8).
7. **Supply chain.** Only `fflate` added (zero-dependency). No other additions (§8.7).
8. **Untrusted content inert.** Imported markdown stored opaquely; SQL parameterized (existing repo); tags constrained; FTS terms already quoted. Residual prompt-injection risk documented, **not** sanitized in M2, blast radius bounded by pack-exclusion (§8.6).

---

## 6. Assumptions (each is a place the plan could be wrong)

- **A1.** ChatGPT export shape = array of conversations each with a `mapping` node tree keyed by node id, messages under `message.content.parts` with `message.author.role`, `create_time` unix seconds; Claude export = array with `chat_messages[].{sender,text/content,created_at}`, title `name`. Fixtures are hand-built minimal samples; if a real export differs, the parser (not the port/plan) changes.
- **A2.** `imported` deterministic id = `imp-` + 32 hex of `sha256(source \0 conversationId \0 chunkIndex)`. Collision-free in practice; not a ULID (acceptable — ordering is by `created_at`).
- **A3.** `ContextItem.type` may widen to `StorableItemType` without breaking `context-pack.ts` (verified: it filters by the 4 section types + `handoff`; `imported` matches none and is never pinned).
- **A4.** `-p <project>` presence for `import`/`dry-run` is enforced in the **CLI** layer (delivery), not via an importer error code (the §D-E code list has none for it). List mode allows `-p` omitted.
- **A5.** Mode precedence: list (no selection or `--list`) wins over dry-run; dry-run wins over import. `--dry-run` with no selection lists (nothing selected to preview).
- **A6.** The `context` `ImportItems` DTO types `source` as `string` (context needs no `ImportSource` union); `importers` passes the concrete `ImportSource` literal. Keeps the dependency edge one-way (`importers → context`).
- **A7.** Summary counts follow D6 definitions.
- **A8.** Decompression caps `MAX_TOTAL_BYTES = 256 MiB`, `MAX_ENTRY_BYTES = 128 MiB` (tunable in review).
- **A9.** Missing conversation date → import instant (documented in `specs/importers.md`, per D-F).
- **A10.** The `.pre-002.bak` lives in `VALIJA_HOME` (outside the repo), so no `.gitignore` change is needed.

---

## 7. Repo structure after execution

```
src/
  importers/                                  ← NEW MODULE
    domain/
      errors.ts                               (+) importerErr / ImporterErrorCode
      entities/
        conversation.ts                       (+) Conversation / Message / Role IR
      values/
        import-source.ts                      (+) ImportSource
      services/
        chunk-render.ts                       (+) renderConversationChunks
        chunk-render.test.ts                  (+)
        selection.ts                          (+) parsePickSpec / selectConversations
        selection.test.ts                     (+)
    application/
      ports/
        parser.ts                             (+) ConversationParser / ParsedExport
        export-reader.ts                      (+) ExportReader
      use-cases/
        import-conversations.use-case.ts      (+) ImportConversations (orchestrator)
        import-conversations.use-case.test.ts (+)
    infra/
      parsers/
        chatgpt-parser.ts                     (+)
        chatgpt-parser.test.ts                (+)
        claude-parser.ts                      (+)
        claude-parser.test.ts                 (+)
        generic-parser.ts                     (+)
        generic-parser.test.ts                (+)
        __fixtures__/                         (+) chatgpt.json, claude.json, generic.json
      parser-registry.ts                      (+) AUTODETECT_PARSERS / parserBySource
      file-export-reader.ts                   (+) FileExportReader (fs + fflate, in-memory)
      file-export-reader.test.ts              (+)
  context/
    domain/values/item-type.ts                (~) + STORABLE_ITEM_TYPES / StorableItemType
    domain/entities/context-item.ts           (~) type widened; + createImportedContextItem / importedItemId
    domain/entities/context-item.test.ts      (~) + imported factory / id tests
    application/dto/context-item-view.ts       (~) type widened to StorableItemType
    application/use-cases/import-items.use-case.ts       (+) ImportItems (batch, one session)
    application/use-cases/import-items.use-case.test.ts  (+)
    infra/item-repo.ts                         (~) toItem cast → StorableItemType
  shared/
    infra/migrations.ts                        (~) register 002; migrate(db, dbPath?); backup dance
    infra/migrations/002-imported-type.ts      (+) MIGRATION_002
    infra/migrations-002.test.ts               (+) populated-data + rollback
  context/infra/vault-sessions.ts              (~) migrate(db, this.paths.db)
  vault/infra/file-vault-store.ts              (~) migrate(db, this.paths.db)
  delivery/
    container.ts                               (~) wire ImportItems / FileExportReader / ImportConversations
    cli/program.ts                             (~) `import` command
    cli/import-command.ts                      (+) importCommand
    mcp/server.test.ts                         (~) + `imported` rejected assertion
  version.ts (delivery/version.ts)             (~) 0.2.0
package.json                                   (~) 0.2.0 + fflate
specs/importers.md                             (+)
specs/context.md                               (~)
specs/delivery.md                              (~)
docs/SPEC.md                                   (~)  (D3)
README.md                                      (+?) (D3, to confirm)
CHANGELOG.md                                   (+?) (D4, to confirm)
```
`(+)` new · `(~)` modified.

---

## 8. Estimated production-line count & risks

**Production TypeScript (excludes tests, fixtures, specs/docs):**

| Slice | Approx lines |
|---|---|
| 1 — domain + ports | ~250 |
| 2 — parsers + reader | ~260 |
| 3 — imported type + `ImportItems` + `ImportConversations` | ~235 |
| 4 — migration 002 + runner | ~90 |
| 5 — CLI + wiring + version/pkg | ~130 |
| **Total production** | **≈ 965 lines** |

Tests add ≈ 700–800 lines; specs/docs ≈ 400 lines (not "production"). **Headline: ~965 production lines** (~1,750 including tests).

**Risks (highest first):**
1. **Migration 002 on real, populated, encrypted vaults, possibly first triggered by a background MCP server** (§11). Mitigated by: whole rebuild in one transaction, FTS `'rebuild'`, ciphertext `.bak`, and mandatory green populated-data + rollback tests. Confirm D1/D2 before implementing.
2. **fflate decompression cap** must reject before materializing — verify fflate's `unzipSync` `filter` sees `originalSize` and short-circuits (it does in 0.8.x). If not, fall back to inspecting the central directory first.
3. **Parser fidelity to real exports** (A1). The port/plan are stable; only the three adapter files absorb format drift. Keep fixtures minimal and add real-export fixtures post-review if available.
4. **Type widening ripple** (`ContextItem.type`). Low risk — verified against `context-pack.ts`, `item-repo.ts`, DTOs; `npm run typecheck` after Slice 3 catches any missed cast.
5. **Doc surface (D3/D4)** — README/CHANGELOG don't exist; needs a yes/no before Slice 5 so the "docs in the same commit" rule (spec §2) is honored.

---

**Plan file:** `advances/M2/plan.md` · **Branch:** `feat/importers-M2`.
