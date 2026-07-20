# Spec: context — the saved-content bounded context

Content subdomain. Ubiquitous language: **project, context item, type, tag, pinned, archived**. Depends on `shared`, and on `vault` only through the session bridge.

## domain/errors.ts

`INVALID_PROJECT_NAME · INVALID_ITEM_TYPE · INVALID_TAG · CONTENT_TOO_LARGE · CONTENT_EMPTY · TOO_MANY_TAGS · PROJECT_NOT_FOUND · ITEM_NOT_FOUND`

## domain/values (parse-don't-validate; branded types)

- **ProjectName** — `[a-z0-9][a-z0-9-]{0,63}`, trimmed + lowercased. Violation → `INVALID_PROJECT_NAME`.
- **ItemType** — one of `decision | progress | preference | fact | handoff`. Else → `INVALID_ITEM_TYPE`. **StorableItemType** adds `imported` (the six types that may be *stored*); `parseStorableItemType` accepts it, `parseItemType` does not. The split keeps `imported` off the save/MCP surface (`ITEM_TYPES` is the MCP enum) while letting storage and reads carry it.
- **Tag** — 1–32 chars of `[a-z0-9-]`, trimmed + lowercased. Max 10 (`TOO_MANY_TAGS`), duplicates dropped.
- **Content** — trimmed; empty → `CONTENT_EMPTY`; over **32 KB in UTF-8 bytes** → `CONTENT_TOO_LARGE`; exactly 32 KB accepted.

## domain/entities

- **Project**: id, name, description?, timestamps.
- **ContextItem**: id, projectId, type (`StorableItemType`), content, tags, pinned, source?, archived, timestamps. Minted via `createContextItem` (the five saveable types) or `createImportedContextItem` — both total. The imported factory fixes `type: imported`, is never pinned, keeps the **original conversation date** as `createdAt` while stamping `updatedAt` at the import instant, sets `source: "<src>-import"`, and derives a **deterministic id** (`importedItemId(projectId, source, conversationId, chunkIndex)`), so re-importing the same export into the same project upserts instead of duplicating, while the same conversation imported into a different project stays distinct.

## domain/services

- `context-pack.ts` — **the assembly algorithm**, pure and vault-free. `assembleContextPack({ projectName, items, generatedAt, budgetTokens? })`; tokens ≈ `ceil(chars/4)`. Order: (1) **pinned** newest-first — the newest pinned is kept even if it alone exceeds budget, oldest pinned cut first; (2) **latest handoff** if it fits; (3) a section per type, **decision → preference → progress → fact**, newest-first, until one doesn't fit. No item repeats. Omitting `budgetTokens` (or passing `Infinity`) means unbudgeted. Returns sections carrying **entities, not text** — `estimatedTokens` is the sum of the domain's estimates, so it is an approximation of the rendered result, never a promise about it.

## application/ports

- `repositories.ts` — `ProjectRepository` (upsert, findByName, list with counts) and `ContextItemRepository` (upsert, findByProject newest-first with filters, FTS search, archive).
- `vault-session.ts` — **the bridge**: `VaultSessions.withSession(action)` runs `action` against a `VaultSession` (both repos), or returns `VAULT_LOCKED`. The port owns the open → work → always-close lifecycle, so use cases never touch it.

## application/dto

- `context-item-view.ts` — `ContextItemView`, the one shape every read use case returns: primitives only, no value objects and no `Date`. Carries `source` so an export loses nothing.

## application use cases

Each implements `UseCase<In, Out>` (or `AsyncUseCase`) from `shared/application/use-case.ts` — a contract, never a base class.

**SaveContext** — parses project/type(default `fact`)/tags/content **before opening a session**, so bad input never touches the vault; **auto-creates the project** (D9), reports `projectCreated`; captures optional `source` (MCP client name).

**GetContextPack({ project, budgetTokens = 4000 })** — unknown project → `PROJECT_NOT_FOUND`. Loads the project's items and delegates to `assembleContextPack`; returns the pack **structure**. Pass `Infinity` for the whole project — that is how `export` gets an unbudgeted pack.

**SearchContext** — unknown project scope → `PROJECT_NOT_FOUND`; limit clamped [1,100] default 20; empty/whitespace query → empty (terms quoted, never an FTS syntax error).

**ListProjects / ShowProject** — list with counts (archived excluded); show newest-first with optional type filter (`ShowProject` accepts `imported` via `parseStorableItemType`, so `show <p> --type imported` works). Both return `ContextItemView[]`.

**ImportItems** — the batch write path used by the importers module. Parses the project name **before** opening a session, find-or-creates the project, then in **one session** re-validates each chunk's tags and content (defense in depth), mints an imported item via `createImportedContextItem`, and upserts it. A single bad chunk is collected into `failures` (never aborts the batch). Returns `{ projectCreated, imported, failed, failures }`. This keeps `context` the sole guardian of `ContextItem` and the `imported` type — importers hand it drafts, nothing more.

**Imported items and the pack:** `assembleContextPack` only ever includes pinned items, the latest handoff, and the four section types. Imported items are never pinned and are none of those types, so they are **automatically excluded** from every pack — searchable via FTS, but never auto-loaded through `get_context`.

There is no ExportPack use case: exporting is a rendering choice over these two, made in `delivery`.

## infra

- `project-repo.ts`, `item-repo.ts` — SQLite implementations; dates as ISO strings, tags as JSON; FTS terms individually double-quoted and ANDed, ranked by `rank`.
- `vault-sessions.ts` — implements `VaultSessions`; the one place `context` touches `vault` (keychain + header). No keychain key → `VAULT_LOCKED`; stale key → delete it, then `VAULT_LOCKED`. `runWithSession` holds the always-close guarantee.

Proof: `src/context/domain/values/values.test.ts`, `src/context/domain/entities/context-item.test.ts`, `src/context/domain/services/context-pack.test.ts` (the algorithm, no vault), `src/context/infra/{project-repo,item-repo,vault-sessions}.test.ts`, and one `*.use-case.test.ts` per use case under `src/context/application/use-cases/`.
