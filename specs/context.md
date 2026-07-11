# Spec: context — the saved-content bounded context

Content subdomain. Ubiquitous language: **project, context item, type, tag, pinned, archived**. Depends on `shared`, and on `vault` only through the session bridge.

## domain/errors.ts

`INVALID_PROJECT_NAME · INVALID_ITEM_TYPE · INVALID_TAG · CONTENT_TOO_LARGE · CONTENT_EMPTY · TOO_MANY_TAGS · PROJECT_NOT_FOUND · ITEM_NOT_FOUND`

## domain/values (parse-don't-validate; branded types)

- **ProjectName** — `[a-z0-9][a-z0-9-]{0,63}`, trimmed + lowercased. Violation → `INVALID_PROJECT_NAME`.
- **ItemType** — one of `decision | progress | preference | fact | handoff`. Else → `INVALID_ITEM_TYPE`.
- **Tag** — 1–32 chars of `[a-z0-9-]`, trimmed + lowercased. Max 10 (`TOO_MANY_TAGS`), duplicates dropped.

## domain/entities

- **Project**: id, name, description?, timestamps.
- **ContextItem**: id, projectId, type, content, tags, pinned, source?, archived, timestamps. Content trimmed; empty → `CONTENT_EMPTY`; over **32 KB in UTF-8 bytes** → `CONTENT_TOO_LARGE`; exactly 32 KB accepted.

## application/ports

- `repositories.ts` — `ProjectRepository` (upsert, findByName, list with counts) and `ContextItemRepository` (upsert, findByProject newest-first with filters, FTS search, archive).
- `vault-session.ts` — **the bridge**: `VaultSessionFactory.open()` returns a `VaultSession` (both repos + `close()`) or `VAULT_LOCKED`. Every use case opens, works, closes in a `finally`.

## application use cases

**SaveContext** — validates project/type(default `fact`)/tags/content; **auto-creates the project** (D9), reports `projectCreated`; captures optional `source` (MCP client name).

**GetContextPack({ project, budgetTokens = 4000 })** — unknown project → `PROJECT_NOT_FOUND`. Tokens ≈ `ceil(chars/4)`. Assembly: (1) header; (2) **pinned** newest-first — the newest pinned is kept even if it alone exceeds budget, oldest pinned cut first; (3) **latest handoff** if it fits; (4) sections **Decisions → Preferences → Progress → Facts**, newest-first, until one doesn't fit. No item repeats. Returns `{ markdown, includedCount, totalCount, estimatedTokens }`.

**SearchContext** — unknown project scope → `PROJECT_NOT_FOUND`; limit clamped [1,100] default 20; empty/whitespace query → empty (terms quoted, never an FTS syntax error).

**ListProjects / ShowProject / ExportPack** — list with counts (archived excluded); show newest-first with optional type filter; export md = the pack **without budget**, json = full item dump.

## infra

- `project-repo.ts`, `item-repo.ts` — SQLite implementations; dates as ISO strings, tags as JSON; FTS terms individually double-quoted and ANDed, ranked by `rank`.
- `session-factory.ts` — implements `VaultSessionFactory`; the one place `context` touches `vault` (keychain + header). No keychain key → `VAULT_LOCKED`; stale key → delete it, then `VAULT_LOCKED`.

Proof: `src/context/domain/values/values.test.ts`, `src/context/domain/entities/context-item.test.ts`, `src/context/infra/repositories.test.ts`, `src/context/application/context-usecases.test.ts`.
