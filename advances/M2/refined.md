# M2 — Importers · Refined Spec

**Status:** Confirmed (2026-07-16) · **Milestone:** post-0.1.0 (targets 0.2.0)
**Legend:** each open decision lists options and a chosen **Default** with a reason.

**Confirmed decisions (Oscar, 2026-07-16):**
- **D-C atomicity → deterministic ids (best-effort, 2a).** No new port surface; re-import upserts by id.
- **Migration 002 → ciphertext backup + rollback (Option 1).** `vault.db.pre-002.bak` before the rebuild, deleted after a verified open.
- **CLI source → `--from <provider>` flag (not a positional).** Overrides the earlier locked positional `[source]` shape; removes the commander ambiguity.

---

## 1. Goal

Let a user load their existing chatbot conversation history into the encrypted vault so a fresh install is no longer empty. In scope for this advance: two official-export parsers (**ChatGPT**, **Claude**), a **generic JSON** escape hatch for any other provider, and a `valija import` CLI command. Everything imported lands encrypted through the exact same persistence path as a normal save, is searchable via FTS, and is kept out of context packs. No new MCP tool is added.

---

## User walkthrough — the workflow from the user's perspective

**Why:** a fresh vault is empty; a user's real history lives in ChatGPT/Claude. This feature pulls that history into the encrypted vault so it is searchable next to saved context, with no re-typing.

**0. Setup (already exists).** `valija init`, then `valija unlock`.

**1. Get the export** from the provider's official "Export data" (ChatGPT → a `.zip` containing `conversations.json`; Claude → a `.zip`/JSON). Other providers: the generic JSON format, or the MCP path in step 6.

**2. List first (safety default).** With no selection flag, `valija import <file> -p <project>` writes nothing — it prints a numbered table (index, date, title, message count, estimated chunks) so the user sees the file's contents before importing.

**3. Select and import.**
```
valija import chatgpt-export.zip -p my-history --pick 1,4-6
valija import claude.zip         -p work --query "postgres" --since 2024-06-01
valija import export.zip         -p all  --all --dry-run     # preview, writes nothing
valija import weird.json         -p misc --from generic --all
```
`-p` = target project (auto-created). `--from` forces a parser; omit it and chatgpt/claude auto-detect. `--dry-run` runs the full pipeline but opens no write session.

**4. Result.** One summary line, e.g. `Imported 47 item(s) from 12 conversation(s) into "my-history" (skipped 0, failed 0)`. Re-running the same file makes no duplicates (deterministic ids).

**5. Using imported data afterward** — the load-bearing distinction:

| Surface | Imported items |
|---|---|
| `valija search <term>` / MCP `search_context` | included (FTS) |
| `valija show <project> --type imported` | included |
| Context pack — MCP `get_context` / `valija export` | **excluded, by design** |
| MCP `save_context` | cannot create `imported` (only the 5 saveable types) |

Imported history is a **searchable archive pulled on demand**, not auto-injected context: dumping thousands of old chunks into the token-budgeted pack would drown the signal, and excluding them bounds prompt-injection blast radius (an old transcript cannot ride into a model via `get_context`).

**6. Escape hatch — the MCP distillation path.** Because valija is an MCP server, any connected AI can read an arbitrary export and call `save_context` to distill it into real `decision`/`preference`/`fact` items (which *do* enter the pack). Parsers = fast bulk archive; MCP = curated distillation. No parser is needed for unsupported providers.

---

## 2. Context snapshot (load-bearing facts from the current codebase)

These constrain the design; a planner must not contradict them.

- **Module-first / hexagonal.** Each bounded context is `domain/` (no I/O), `application/` (use cases + ports + DTOs), `infra/` (adapters). Dependency rule: `shared ← everyone · vault → shared · context → shared, vault · delivery → all`. `context` reaches `vault` **only** through the `VaultSessions` bridge.
- **Use cases** implement `UseCase<In,Out>` / `AsyncUseCase<In,Out>` (contracts, not base classes) from `src/shared/application/use-case.ts`. Ports injected by plain constructor injection; composed in `src/delivery/container.ts`.
- **The session bridge is synchronous:** `VaultSessions.withSession<T>(action): Result<T,DomainError>` (`src/context/application/ports/vault-session.ts`). It opens repos, runs the action, always closes, and returns `VAULT_LOCKED` when the vault is locked. `session` exposes `projects` and `items` repositories only — no raw DB, no transaction handle.
- **Persistence is one SQLCipher file** opened via `openVaultDb` (`src/shared/infra/sqlite.ts`); `migrate(db)` runs on every session open, gated by `schema_version` in `meta`. Only `001-init` exists today.
- **`ItemType`** = `decision | progress | preference | fact | handoff` (`src/context/domain/values/item-type.ts`). The constant `ITEM_TYPES` is reused verbatim as the zod enum for the MCP `save_context` tool (`src/delivery/mcp/server.ts`). **Widening `ITEM_TYPES` widens the MCP surface** — this is the central coupling M2 must break cleanly.
- **`Content`** value (`src/context/domain/values/content.ts`): trimmed, non-empty, **≤ 32 KB measured in UTF-8 bytes**. This is why chunk targets are byte-based, not char-based.
- **Context pack** (`src/context/domain/services/context-pack.ts`): a pure domain service. It only ever includes `pinned` items, the latest `handoff`, and type sections in the fixed order `decision → preference → progress → fact`. An item of a *new* type is automatically excluded **unless it is pinned** — pinned items are always included regardless of type.
- **Search** (`item-repo.ts`): FTS is type-agnostic; any stored item is searchable. `search_context` (MCP) therefore surfaces imported items — which is the desired "searchable via FTS" behaviour.
- **Project list** (`project-repo.ts` `list()`): `itemCount = COUNT(items where archived=0)`, `lastActivityAt = MAX(items.updated_at)`. Imported items inflate the count and, depending on their `updatedAt`, can change last-activity ordering (see §5, D-H).
- **Errors** follow a per-context vocabulary: `contextErr(code,msg)` / `vaultErr(code,msg)` returning `Result<never,DomainError>`. A new module gets its own.
- **Specs are contracts.** `specs/` has one file per module; a behaviour change updates the matching spec in the same commit. M2 adds `specs/importers.md` and edits `specs/context.md` and `specs/delivery.md`.

---

## 3. Scope

### In
1. New top-level module `src/importers/` owning its full domain/application/infra stack.
2. A **parser port** plus three parsers: ChatGPT export, Claude export, generic-JSON envelope.
3. **`.zip` support** decompressed **in memory** via **fflate** (the only new dependency).
4. A pure **normalization + chunk/render** domain service: provider export → normalized conversations → markdown items (~28 KB byte target, split on message boundaries, `(part n/m)` headers).
5. A new item type **`imported`** at the storage layer **without** exposing it on the MCP save surface.
6. A **context-owned write path** for imported items (batch, single session), keeping `importers → context` and never letting `importers` touch `vault`.
7. **Migration 002**: extend the `context_items.type` CHECK to include `imported` via table rebuild + FTS trigger/index recreation + FTS rebuild — the first migration to run on populated real data.
8. **`valija import` CLI** with list-first safety, selection filters, and `--dry-run`.
9. **Docs**: the "MCP distillation path" — any connected AI can already read an arbitrary export and call `save_context`; document it as the answer for unsupported providers.
10. Per-layer tests, including a migration-on-existing-data test and a round-trip fixture test per parser.

### Out (deferred to 0.2.x+ — name them so the planner doesn't drift)
- Gemini / Google Takeout parser (messy format).
- Claude Code session import.
- Live watcher / file-tailing daemon.
- **Any new MCP tool or MCP argument.** Import is CLI-only.
- Attachments, images, code artifacts, tool-call payloads beyond their text.
- AI-assisted summarization/distillation at import time (import stores verbatim rendered transcripts).
- Semantic de-duplication across imports (only id-based idempotency, if adopted — D-C).
- Editing/curation UI for imported items.

---

## 4. The `imported` type without widening MCP (decision D-0, load-bearing)

**Problem:** `ITEM_TYPES` is the single source of truth for both the storage CHECK constraint *and* the MCP `save_context` enum.

**Options**
- **A. Two constants.** Keep `ITEM_TYPES` as the five *saveable* types (unchanged → MCP enum unchanged). Add a separate `STORABLE_ITEM_TYPES = [...ITEM_TYPES, "imported"]` used only by (a) the migration CHECK and (b) repository rehydration. `parseItemType` (the save path) keeps rejecting `imported`. Imported items are minted through a dedicated factory, never through the MCP/save path.
- **B. One widened constant + a separate MCP allow-list.** Widen `ITEM_TYPES` to six and give the MCP tool its own five-element enum. Fragile: the coupling is inverted and easy to re-break later.

**Default: A.** It makes "models cannot classify a save as `imported`" a compile-time property (the MCP enum literally never contains it) and localizes the new type to storage + the importer. Acceptance §9 verifies the MCP `save_context` schema still offers exactly five types.

---

## 5. Open decisions (options + defaults)

### D-A. Parser port contract: detect vs parse, and auto-detect ordering
A parser needs two responsibilities: recognizing an export and converting it.

- **Contract shape.** Port exposes `detect(doc): boolean` and `parse(doc): Result<Conversation[], DomainError>` over an already-decoded JSON document (not raw bytes, not filename). A separate reader adapter turns a path into candidate documents (unzip if `.zip`, else read+parse JSON). Rationale: detection on *structure* is robust to renamed files; keeping fflate/`fs` out of the parser keeps parsers pure-ish and unit-testable on fixtures.
- **Explicit source vs auto-detect.**
  - If the user names the source, call that parser directly and surface its `parse` error verbatim (do not silently fall through to another parser).
  - If the source is omitted, iterate an **ordered registry** `[chatgpt, claude]`, first `detect() === true` wins.
- **Where does generic sit in auto-detect?**
  - **Option 1:** generic participates in auto-detect (matches its versioned envelope only).
  - **Option 2:** generic is **never** auto-selected; it requires the explicit `generic` source.
  - **Default: Option 2.** A permissive "generic" matcher risks swallowing a *malformed* ChatGPT/Claude export and importing garbage instead of reporting `MALFORMED_EXPORT`. Requiring explicit opt-in for generic keeps auto-detect honest. Because generic uses a versioned envelope (D-D), collisions with the official shapes are impossible anyway.
- **Ambiguity when two official parsers both match:** treat as a defect, not a runtime choice. ChatGPT (conversations carry a `mapping` node tree) and Claude (conversations carry `chat_messages`/`sender`) shapes are disjoint; `detect` must key on a discriminating field, and a fixture test asserts each parser rejects the other's export.

### D-B. Where chunk/render logic lives
The transform "normalized `Conversation` → one-or-more markdown item bodies (~28 KB byte target, split on message boundaries, `(part n/m)` header)" is pure and deterministic.

- **Option 1 — pure domain service** in `importers/domain/services/` operating on the normalized IR, mirroring how `context-pack.ts` is a pure vault-free service.
- **Option 2 — application helper** folded into the import use case.
- **Default: Option 1.** Chunking has real edge cases (multibyte-safe byte boundaries; a single message larger than the target) that deserve isolated, exhaustive unit tests with no vault or fflate in the way.
- **Edge case the planner must resolve, not skip:** a single message whose text exceeds the max content size. Default behaviour: split on message boundaries first; if one message still exceeds the limit, hard-split that message's text at a safe UTF-8 byte boundary and continue the `(part n/m)` sequence. Every emitted chunk must independently pass `parseContent` (≤ 32 KB); the ~28 KB target is headroom so the header + fences never push a chunk over.

### D-C. Shape of the `importers → context` write bridge
`importers` must persist through `context` and must never import from `vault`.

- **Option 1 — reuse `SaveContext` per item.** Rejected: `SaveContext` opens a *new* session per call (slow for hundreds of chunks), auto-parses type through `parseItemType` (which correctly refuses `imported`), and gives no batch atomicity.
- **Option 2 — new context use case `ImportItems` (batch, one session).** `context` gains a use case that accepts a batch of imported-item DTOs (`projectName`, `content`, `createdAt`, `tags`, `sourceId`), opens **one** session, auto-creates the target project, mints `imported` items via a dedicated factory, validates each body through `parseContent` (defense in depth), saves them, and returns a summary. `importers` depends on this use case. Ownership stays correct: `context` remains the sole guardian of `ContextItem` and the `imported` type; `importers` orchestrates parsing/chunking.
- **Option 3 — `importers` writes via the `VaultSessions` port + `session.items.save()` directly.** Keeps `importers → context` (the port lives in `context`) but duplicates item-minting and bypasses context use cases. Weaker encapsulation.
- **Default: Option 2.**
- **Atomicity sub-decision (genuinely open):**
  - **2a. Best-effort + idempotent ids.** No new port surface. Derive each imported item's id deterministically from `(sourceId, conversationId, chunkIndex)` so re-running an import upserts instead of duplicating (the repo already does `ON CONFLICT(id) DO UPDATE`). A crash mid-import leaves a resumable partial state; re-running is safe. Report `imported N / skipped M / failed K`.
  - **2b. Transactional batch.** Extend the `VaultSession` port with a `transaction(fn)` primitive so a whole conversation (or the whole run) is all-or-nothing. Cleaner atomicity, but adds surface to the bridge and a `better-sqlite3` transaction leak into the port.
  - **CONFIRMED: 2a.** Deterministic ids are the property users actually want (re-import the same file twice → no duplicates) and they need no new port. Note: imported ids will not be ULIDs; this is fine because ordering everywhere is by `created_at`, never by id. 2b (a `transaction()` primitive on the session port) is explicitly out of scope for M2.

### D-D. Is the generic format versioned?
- **Option 1 — versioned envelope:** `{ "valija_import_version": 1, "conversations": [ { id, title?, createdAt, messages: [ { role, content, createdAt? } ] } ] }`.
- **Option 2 — bare array**, unversioned.
- **Default: Option 1.** The version field doubles as the detection signal (no collision with official shapes), gives a clean evolution path, and lets an unknown version fail loudly (`UNSUPPORTED_GENERIC_VERSION`) instead of being mis-parsed. Define the v1 schema explicitly in `specs/importers.md`; `role ∈ {user, assistant, system}`, `createdAt` ISO-8601.

### D-E. Error taxonomy for the new module
New `importerErr(code, message)` with an `ImporterErrorCode`:
`UNSUPPORTED_SOURCE` (unknown/undetectable source) · `MALFORMED_EXPORT` (claimed/detected format won't parse) · `EMPTY_EXPORT` (no conversations) · `UNREADABLE_FILE` (missing/unreadable path) · `CORRUPT_ARCHIVE` (zip won't inflate) · `INVALID_SELECTION` (bad `--pick` syntax) · `NO_CONVERSATIONS_SELECTED` (filters matched nothing) · `UNSUPPORTED_GENERIC_VERSION`.
Rules: importers **do not** redefine context errors — content-size/tag violations raised while `context` persists a chunk surface as the existing `contextErr` codes. Per-conversation parse/persist failures are **collected, not fatal**: the run continues and the summary reports failures. Whole-run preconditions (unreadable file, corrupt archive, unsupported source, empty selection) fail fast before any write.

### D-F. `createdAt` / `updatedAt` for imported items
Locked: `createdAt` = original conversation date (chronology preserved). Open: `updatedAt`.
- If `updatedAt` = conversation date → the project's `lastActivityAt` (MAX updated_at) stays historical; a 2023 export won't make the project look freshly touched.
- If `updatedAt` = import instant → the freshly imported project sorts to the top of `valija projects`.
- **Default: `createdAt` = conversation date, `updatedAt` = import instant.** Item ordering within the project (by `created_at`) stays truthfully historical, while the project surfaces as recently active — which it is. This requires the `imported` factory to accept an explicit `createdAt` (the existing `createContextItem` stamps both from `now`; leave it untouched and add a separate factory).
- **Missing conversation date** (some exports omit it): default to the import instant and continue; note it in `specs/importers.md`.

### D-G. Tags and provenance
Locked: tags `["imported", <sourceId>]` where `sourceId ∈ {chatgpt, claude, generic}` (all valid tags). Do **not** derive tags from conversation titles — titles rarely satisfy the tag pattern and would explode tag cardinality (max 10). Provenance (original title, date, conversation id, `part n/m`) belongs in the **markdown header of each item body**, not in tags. This keeps recall (`search_context "imported"` or by source) working without polluting the tag space.

### D-H. Single target project
Locked: all selected conversations import into one `-p <project>` (auto-created like `SaveContext`). Confirm and document: one conversation → 1..m items (chunks); each item tagged `["imported", sourceId]`.

### D-I. Sync vs async import use case
- `withSession`, the repositories, and the existing use cases are all synchronous. fflate offers `unzipSync`; `fs` offers `readFileSync`.
- **Default: a synchronous `UseCase` for the import**, using `unzipSync` + `readFileSync`. A CLI one-shot tolerates blocking; it avoids introducing the module's first async use case and matches the sync session bridge. Note async (`AsyncUseCase`) as the fallback only if large-file responsiveness becomes a concern.

---

## 6. Migration 002 — sequence and safety (highest-risk surface)

Extending a SQLite CHECK constraint requires a **table rebuild** (SQLite cannot `ALTER` a CHECK). This is the first migration to run against **populated, encrypted, real user data**, and `migrate(db)` runs automatically on the next session open after upgrade — **including a session opened by the MCP server that an AI tool launched**. It must be atomic and non-lossy.

**Required sequence, executed inside the existing per-migration `db.transaction()` wrapper** (so the whole thing commits or rolls back as a unit):
1. Drop the FTS sync triggers `items_ai`, `items_ad`, `items_au` (they reference `context_items`).
2. Create `context_items_new` identical to the current table but with the CHECK extended to include `imported`.
3. Copy every row: `INSERT INTO context_items_new SELECT ... FROM context_items` (copy the explicit column list).
4. `DROP TABLE context_items`; `ALTER TABLE context_items_new RENAME TO context_items`.
5. Recreate `idx_items_project`.
6. Recreate the three FTS triggers exactly as in `001-init`.
7. Rebuild the external-content FTS index: `INSERT INTO context_items_fts(context_items_fts) VALUES('rebuild')` — because the table rebuild changes rowids and the FTS index is keyed on `rowid`. **Skipping this silently breaks search.**

**Safety facts to honour / verify:**
- No table has a foreign key pointing **into** `context_items` (it points *out* to `projects`), so the drop/rename is FK-safe with `foreign_keys = ON`. `PRAGMA foreign_keys` **cannot** be toggled inside the transaction the runner already holds, so the migration must not rely on toggling it.
- Idempotent by the `schema_version` gate; running `migrate` twice is a no-op after 002 applies.
- On failure the transaction rolls back, leaving schema_version at 1; the open surfaces as `STORAGE_ERROR` ("Could not open vault"). Flag: a persistently failing 002 blocks every command until fixed — acceptance requires a green migration-on-populated-data test before release.

**Open safety option — pre-migration backup.**
- **Option 1:** before running any table-rebuild migration, copy `vault.db` → `vault.db.pre-002.bak` (still ciphertext — safe to leave on disk). Belt-and-suspenders for a destructive rebuild.
- **Option 2:** rely solely on transactional rollback (no backup file).
- **CONFIRMED: Option 1** for this specific migration, deleted after a verified successful open, with a `doctor`/log note. Cheap insurance the first time the runner touches real data; the copy is encrypted so it does not weaken at-rest guarantees.

---

## 7. CLI contract

`valija import <file> -p <project> [--from <chatgpt|claude|generic>] [--list] [--pick 1,3-5] [--query <text>] [--since <YYYY-MM-DD>] [--all] [--dry-run]`

- **`--from <chatgpt|claude|generic>` flag (CONFIRMED).** Replaces the earlier positional `[source]`. When present, that parser is called directly and its `parse` error surfaces verbatim (no silent fall-through). When omitted, the source is auto-detected across the ordered registry `[chatgpt, claude]` — `generic` is never auto-selected and must be named via `--from generic` (D-A). `<file>` stays the single required positional, so there is no commander ambiguity.
- **Safety default (locked):** with **no selection flag** (`--pick` / `--query` / `--since` / `--all`), the command **lists** conversations and imports nothing. Mass import requires `--all` (or an explicit selection). `-p` may be omitted for `--list`; it is **required** for any real import or `--dry-run` that writes nothing but needs the target for its report.
- **`--list`:** print a numbered, **chronological ascending** table (index, date, title, message count, estimated chunk count). `--pick` indexes into exactly this order; indices are stable because the export file is static.
- **`--pick 1,3-5`:** 1-based indices/ranges into the listed order; malformed → `INVALID_SELECTION`.
- **`--query <text>`:** filter by conversation **title** substring (case-insensitive). Note as an option: extending match to message bodies (heavier, less predictable) — default is title-only.
- **`--since <YYYY-MM-DD>`:** keep conversations dated on/after the date (by conversation `createdAt`).
- **`--all`:** import every conversation in the file.
- **`--dry-run`:** run detect → parse → select → chunk and print the summary (conversations, items/chunks that *would* be written, per-conversation failures) **without opening a write session**. Prints to stdout only.
- **Output:** a summary line `Imported N item(s) from M conversation(s) into "<project>" (skipped S, failed F)`; failures printed with reason. Errors follow the house format `error [CODE]: message`, exit 1.

---

## 8. Security surfaces (must not weaken)

1. **Same encrypted path.** Imported items are persisted only through the `context` write path → `VaultSessions` → `openVaultDb` (SQLCipher). No secondary store, no plaintext sidecar. Acceptance verifies imported rows are unreadable in `vault.db` without the key.
2. **No plaintext to disk.** `.zip` is inflated **in memory** (fflate → `Uint8Array`); JSON is parsed in memory; chunks go straight into the encrypted DB. No temp files, no extraction directory. The user's original export file is theirs and is never copied. `--dry-run` prints to the terminal (stdout) — plaintext to the console is acceptable and under the user's control; the command itself must not write conversation text anywhere on disk, nor log conversation bodies to stderr.
3. **Lock is honoured.** Import needs an unlocked session; a locked vault returns `VAULT_LOCKED` exactly like a save. Import cannot bypass the passphrase.
4. **MCP surface unchanged.** No new tool, no new argument, and `save_context`'s enum stays the five saveable types (§4). The "import arbitrary provider via a connected AI + `save_context`" path is **documentation**, not code.
5. **Decompression-bomb guard.** Cap the total inflated size (and/or per-entry size) when unzipping so a tiny malicious archive cannot exhaust memory; exceeding the cap → `CORRUPT_ARCHIVE`/`MALFORMED_EXPORT`. This is new attack surface introduced by accepting `.zip`.
6. **Untrusted content is inert.** Imported markdown is stored opaquely, never executed; SQL is parameterized; tags are constrained; FTS terms are already quoted. Residual, accepted risk: imported transcripts may contain prompt-injection-flavored text that could surface through `search_context`. Blast radius is limited by design — imported items are **excluded from context packs** (they never auto-load into a model via `get_context`) and only appear as explicit search hits. Note this in the security section of `specs/importers.md`; do not attempt content sanitization in M2.
7. **Supply chain.** fflate is the only new dependency (small, zero-dependency). No other additions.
8. **Migration integrity.** See §6: transactional, non-lossy, ciphertext-only backup.

---

## 9. Acceptance criteria (reviewer checklist)

**Module & architecture**
- [ ] `src/importers/` exists with `domain/`, `application/`, `infra/`; no import from `src/vault/` anywhere under `src/importers/` (dependency check passes).
- [ ] `importers` persists imported items exclusively through a `context` use case; no `session.items.save()` or SQL in `importers`.
- [ ] The parser port defines `detect` + `parse`; ChatGPT, Claude, and generic parsers implement it; a reader adapter handles `.zip` (fflate) and `.json`.

**`imported` type & MCP non-widening**
- [ ] `imported` is a valid stored type (CHECK accepts it; rehydration maps it).
- [ ] The MCP `save_context` input schema offers exactly the five original types; `imported` is not selectable from any MCP tool.
- [ ] Imported items are **never pinned** and never appear in a `get_context` pack; a test loads a pack for a project containing imported items and asserts none are present.
- [ ] Imported items **are** returned by `search_context` / `valija search`.

**Import behaviour**
- [ ] ChatGPT and Claude fixture exports import into normalized items; each parser rejects the other's export (`MALFORMED_EXPORT` / detect miss).
- [ ] Generic versioned envelope imports; an unknown version yields `UNSUPPORTED_GENERIC_VERSION`.
- [ ] A conversation exceeding the size target is split on message boundaries into `(part n/m)` items; every chunk passes `parseContent` (≤ 32 KB); a single oversize message is safely hard-split without breaking UTF-8.
- [ ] Imported items carry `createdAt` = original conversation date and tags `["imported", <sourceId>]`; provenance (title/date/id/part) is in the body, not in tags.
- [ ] Re-importing the same file does not create duplicates (idempotent ids) **or** the chosen atomicity strategy is implemented and tested (D-C).
- [ ] `.zip` is processed without writing any plaintext file to disk (verified: no temp artifacts).

**CLI**
- [ ] No selection flag → lists conversations, writes nothing.
- [ ] `--all`, `--pick`, `--query`, `--since` select as specified; `--pick` indexes the printed order; malformed `--pick` → `INVALID_SELECTION`.
- [ ] `--dry-run` reports what would be imported and opens no write session.
- [ ] Locked vault → `VAULT_LOCKED`; unreadable file → `UNREADABLE_FILE`; corrupt zip → `CORRUPT_ARCHIVE`; empty selection → `NO_CONVERSATIONS_SELECTED`.
- [ ] Summary reports imported / skipped / failed counts; per-conversation failures don't abort the run.

**Migration 002**
- [ ] Applied to a **populated** v1 vault: row count and content are identical before/after; every original item still returns from FTS search; `schema_version` becomes 2; a second `migrate` is a no-op.
- [ ] The rebuild runs inside a single transaction; a forced mid-migration failure leaves the vault at v1 and fully intact.
- [ ] (If adopted) the ciphertext pre-migration backup is created and cleaned up.

**Docs & specs**
- [ ] `specs/importers.md` added; `specs/context.md` (imported type, import use case, exclusion-from-pack invariant) and `specs/delivery.md` (`import` command) updated in the same change.
- [ ] README documents the MCP distillation path for unsupported providers.

**Security**
- [ ] All §8 items hold: encrypted path, no plaintext on disk, lock honoured, MCP unchanged, decompression cap, migration integrity.

---

## 10. Deliverables summary (for the planner, not a plan)

New module `src/importers/` (parser port + 3 parsers + reader adapter + normalized IR + chunk/render domain service + import use case + importer error vocabulary); a `context` `ImportItems` use case + `imported` item factory + `STORABLE_ITEM_TYPES`; `migration 002`; `valija import` CLI wiring in `program.ts` + `container.ts`; fflate dependency; three spec files touched; README note. Tests co-located per file, plus a migration-on-populated-data test and per-parser fixture round-trips.

---

## 11. Biggest risk

**Migration 002 running automatically against real, encrypted, populated vaults — potentially first triggered by an MCP server an AI tool launched in the background.** A table rebuild that mishandles rowids or forgets the FTS `'rebuild'` will silently break search (or, if non-transactional, lose data) on the user's existing history. Mitigations required before release: keep the entire rebuild inside the runner's transaction, rebuild the FTS index, gate a green migration-on-populated-data test, and take a ciphertext backup the first time the runner touches real data.
