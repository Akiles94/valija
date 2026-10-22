# Spec: context — the saved-content bounded context

Content subdomain. Ubiquitous language: **project, context item, type, tag, pinned, archived**. Depends on `shared`, and on `vault` only through the session bridge.

## domain/errors.ts

`INVALID_PROJECT_NAME · INVALID_ITEM_TYPE · INVALID_TAG · CONTENT_TOO_LARGE · CONTENT_EMPTY · TOO_MANY_TAGS · PROJECT_NOT_FOUND · ITEM_NOT_FOUND · INVALID_ITEM_ID · ITEM_ID_AMBIGUOUS · ITEM_ARCHIVED · ITEM_PINNED · ITEM_NOT_CURATABLE · NOTHING_TO_EDIT · PROJECT_NOT_DETECTED · PROJECT_AMBIGUOUS · BINDING_CONFLICT · BINDING_NOT_FOUND · NO_GIT_REMOTE · INVALID_WORKSPACE_PATH`

The six PROJECT-DETECT codes follow one invariant: a message may name project slugs, binding ids and a binding *kind*, and **never a path, a remote, or the raw input** (a raw remote can carry a token). Surfaces show targets from DTO fields, never from error text.

## domain/values (parse-don't-validate; branded types)

- **ProjectName** — `[a-z0-9][a-z0-9-]{0,63}`, trimmed + lowercased. Violation → `INVALID_PROJECT_NAME`.
- **ItemType** — one of `decision | progress | preference | fact | handoff`. Else → `INVALID_ITEM_TYPE`. **StorableItemType** adds `imported` (the six types that may be *stored*); `parseStorableItemType` accepts it, `parseItemType` does not. The split keeps `imported` off the save/MCP surface (`ITEM_TYPES` is the MCP enum) while letting storage and reads carry it.
- **Tag** — 1–32 chars of `[a-z0-9-]`, trimmed + lowercased. Max 10 (`TOO_MANY_TAGS`), duplicates dropped.
- **Content** — trimmed; empty → `CONTENT_EMPTY`; over **32 KB in UTF-8 bytes** → `CONTENT_TOO_LARGE`; exactly 32 KB accepted.
- **ItemId** — 1–64 chars of `[A-Za-z0-9-]`, trimmed, case kept (ULIDs, `imp-<hex>` and fixture ids all fit; never assumed to be a ULID). Else → `INVALID_ITEM_ID`. The charset excludes `%`/`_`, so a parsed id can never be a `LIKE` wildcard. **ItemReference** — an `ItemId` of at least 6 chars: a full id or a unique prefix (CURATION D-I).
- **BindingKind** — `folder | repository` (`BINDING_KINDS`). Validated at each surface's own boundary (commander `.choices()`, `z.enum`), so there is no domain parser (PROJECT-DETECT P-13).
- **FolderTarget** (`binding-target.ts`) — a canonical absolute directory path. `parseFolderTarget(raw, platform?)` trims, requires an absolute path for `platform`, strips trailing separators except on a root, and upper-cases a Windows drive letter; else → `INVALID_WORKSPACE_PATH` (input never echoed). `folderDepth` counts non-empty segments (split on `/` and `\`), used to rank folder bindings. The same file defines **WorkspaceLocation** `{ folder, repositoryRoot, repository, tooBroadToLink }` — where work is happening, as the probe reports it.
- **RepositoryTarget** (`repository-target.ts`, D-K) — a normalized remote, `host/owner/repo`. `parseRepositoryTarget` accepts the URL form (`ssh`, `git+ssh`, `ssh+git`, `git`, `http`, `https`; only `hostname` is read, so userinfo and port are dropped by construction) and the scp form (`[user@]host:path`, host ≥ 2 chars so `C:\repo` is not one); local paths and `file://` are not usable (P-5). The host is lower-cased and must be `[a-z0-9.-]`; the path drops a leading `/` or `~/`, repeated and trailing `/`, and a trailing `.git`; path case is kept. Path segments are read from the raw string (a `URL` would resolve `..` silently) and must be `[A-Za-z0-9._~%-]`, with no `.`/`..` — so no `@`, `:`, `?` or `#` (nothing credential-shaped) can survive. Any rejection → `NO_GIT_REMOTE` with one fixed sentence; the input is never echoed. `repositoryName` is the last segment.
- **BindingId** — same grammar as `ItemId`; a malformed id → `BINDING_NOT_FOUND` (it cannot match a row, so "not found" is the honest answer).

## domain/entities

- **Project**: id, name, description?, timestamps.
- **ProjectBinding** (PROJECT-DETECT): id, projectId, kind (`BindingKind`), target (`FolderTarget | RepositoryTarget`), createdAt — a user-made link from a folder or repository to one project. Minted by the total `createProjectBinding`.
- **ContextItem**: id, projectId, type (`StorableItemType`), content, tags, pinned, source?, archived, timestamps. Minted via `createContextItem` (the five saveable types) or `createImportedContextItem` — both total. The imported factory fixes `type: imported`, is never pinned, keeps the **original conversation date** as `createdAt` while stamping `updatedAt` at the import instant, sets `source: "<src>-import"`, and derives a **deterministic id** (`importedItemId(projectId, source, conversationId, chunkIndex)`), so re-importing the same export into the same project upserts instead of duplicating, while the same conversation imported into a different project stays distinct.

## domain/services

- `context-pack.ts` — **the assembly algorithm**, pure and vault-free. `assembleContextPack({ projectName, items, generatedAt, budgetTokens? })`; tokens ≈ `ceil(chars/4)`. Order: (1) **pinned** newest-first — the newest pinned is kept even if it alone exceeds budget, oldest pinned cut first; (2) **latest handoff** if it fits; (3) a section per type, **decision → preference → progress → fact**, newest-first, until one doesn't fit. No item repeats. Omitting `budgetTokens` (or passing `Infinity`) means unbudgeted. Returns sections carrying **entities, not text** — `estimatedTokens` is the sum of the domain's estimates, so it is an approximation of the rendered result, never a promise about it.
- `item-curation.ts` — **the curation rules** (CURATION), pure functions taking `now`: `setPinned`, `setArchived` (total), `applyEdit`, `archiveSuperseded`. Each reports whether anything changed, so a no-op is never persisted. Pin, edit and supersede refuse imported items (`ITEM_NOT_CURATABLE`) and archived ones (`ITEM_ARCHIVED`) — rejections are checked before no-ops; unpin and archive/unarchive work on anything. Archive never touches `pinned`. `archiveSuperseded` also refuses a pinned item (`ITEM_PINNED` — a pin is the user's call).
- `project-resolution.ts` — **the detection rules** (PROJECT-DETECT D-E/D-K/D-L), pure, taking an optional `platform`. It never sees `VALIJA_PROJECT` or an explicit name; callers rank those first. `BoundProject { binding, projectName }` is what a binding list yields. `bindingFor(location, bindings)` — the deepest folder binding covering the location (containment and case rule from `shared/domain/services/path-containment.ts`), else the repository binding whose target equals `location.repository`, else `null`. `resolveFromBindings(locations, bindings)` — maps every location through `bindingFor`; unmatched locations are ignored; one distinct project → `bound`, two or more → `ambiguous` with slugs sorted, none → `none`. `bindingOnTarget(bindings, kind, target)` — the binding that owns that exact target (folders compared both ways with `isSameOrInside`, so case-folding agrees with matching). `chooseLinkTarget(location, by?)` — the repository when it has a usable remote, else the folder; `by: "repository"` without one → `NO_GIT_REMOTE`; a folder link on a `tooBroadToLink` location (home or filesystem root) → `INVALID_WORKSPACE_PATH` (P-4). `hintCandidates(location)` — the repository's name and its root folder's name, lower-cased and de-duplicated; `[]` outside a repository. It only ever feeds a hint, never a routing decision.

## application/ports

- `repositories.ts` — `ProjectRepository` (upsert, findByName, list with counts) and `ContextItemRepository` (upsert, findById / findByIdPrefix — vault-wide, archived included, each returning an `ItemWithProject`; findByProject newest-first with filters, FTS search). There is no separate archive write: archiving is an upsert of the archived item, so it goes through the one write path that stamps `updatedAt` and the lineage.
- `vault-session.ts` — **the bridge**: `VaultSessions.withSession(action)` runs `action` against a `VaultSession` (both repos), or returns `VAULT_LOCKED`. The port owns the open → work → always-close lifecycle, so use cases never touch it. `VaultSession` also carries `write<T>(mutate)` (M3): runs `mutate` and, only on success, atomically stamps the vault's lineage (bump the generation, mint a fresh write stamp) as part of the same commit — the seam that lets the write path advance BYO-cloud sync's fork-detection stamp without `context` importing anything from `vault`'s storage layer. Read-only use cases never call it.

## application/services

- `item-curation-steps.ts` — stateless helpers the curation use cases share, so no use case calls another: `findItemByReference(session, ref)` (exact id first, else a unique prefix; 0 matches → `ITEM_NOT_FOUND`, 2+ → `ITEM_ID_AMBIGUOUS` listing up to 5 ids; archived items are found) and `saveIfChanged(session, item, changed)` (a no-op never opens `session.write`, so it never bumps the lineage — CURATION D-L).

## application/dto

- `context-item-view.ts` — `ContextItemView`, the one shape every read use case returns: primitives only, no value objects and no `Date`. Carries `source` so an export loses nothing. `archived` is present **only when true** (only `ShowProject` with `includeArchived` can return such an item), so every live view and every export stays byte-identical.
- `item-curation-output.ts` — `ItemCurationOutput { itemId, project, type, changed }` and `EditItemOutput` (+ `changedFields`). `changed: false` means nothing was written.

## application use cases

Each implements `UseCase<In, Out>` (or `AsyncUseCase`) from `shared/application/use-case.ts` — a contract, never a base class.

**SaveContext** — parses project/type(default `fact`)/tags/content **before opening a session**, so bad input never touches the vault; **auto-creates the project** (D9), reports `projectCreated`; captures optional `source` (MCP client name). The project find-or-create and the item save run inside `session.write(...)` (M3), so one save bumps the vault's lineage once. **`supersedes`** (CURATION, exact id only): inside that same write it checks the target first — missing or in another project → `ITEM_NOT_FOUND` with one message for both, so nothing leaks about other projects; then `archiveSuperseded` — then saves the new item and the archived old one. Any refusal rolls the whole write back, project auto-creation included; `supersededItemId` is reported only when used.

**GetContextPack({ project, budgetTokens = 4000 })** — unknown project → `PROJECT_NOT_FOUND`. Loads the project's items and delegates to `assembleContextPack`; returns the pack **structure**. Pass `Infinity` for the whole project — that is how `export` gets an unbudgeted pack.

**SearchContext** — unknown project scope → `PROJECT_NOT_FOUND`; limit clamped [1,100] default 20; empty/whitespace query → empty (terms quoted, never an FTS syntax error).

**ListProjects / ShowProject** — list with counts (archived excluded); show newest-first with optional type filter (`ShowProject` accepts `imported` via `parseStorableItemType`, so `show <p> --type imported` works). Both return `ContextItemView[]`. `ShowProject` also takes `includeArchived` (CURATION D-D): archived items are then included, each marked `archived: true`.

**SetItemPinned / SetItemArchived / EditItem** (CURATION) — the human curation verbs. Each parses an item reference (a full id or a unique ≥6-char prefix) — and, for `EditItem`, the new content/tags/type, with `NOTHING_TO_EDIT` when none is given — **before** opening a session, finds the item with `findItemByReference`, applies the `item-curation.ts` rule, and persists through `saveIfChanged`. Edit is in place: same id, `createdAt` kept, `updatedAt` stamped, FTS re-indexed by the `items_au` trigger; `tags: []` clears the tags.

**ImportItems** — the batch write path used by the importers module. Parses the project name **before** opening a session, find-or-creates the project, then in **one session, one `session.write(...)` (M3)** re-validates each chunk's tags and content (defense in depth), mints an imported item via `createImportedContextItem`, and upserts it — keeping the chunk archived if the user archived it (CURATION D-H) — so one import bumps the vault's lineage once, not per item. A single bad chunk is collected into `failures` (never aborts the batch). Returns `{ projectCreated, imported, failed, failures }`. This keeps `context` the sole guardian of `ContextItem` and the `imported` type — importers hand it drafts, nothing more.

**Imported items and the pack:** `assembleContextPack` only ever includes pinned items, the latest handoff, and the four section types. Imported items are never pinned and are none of those types, so they are **automatically excluded** from every pack — searchable via FTS, but never auto-loaded through `get_context`.

There is no ExportPack use case: exporting is a rendering choice over these two, made in `delivery`.

## infra

- `project-repo.ts`, `item-repo.ts` — SQLite implementations; dates as ISO strings, tags as JSON; FTS terms individually double-quoted and ANDed, ranked by `rank`.
- `vault-sessions.ts` — implements `VaultSessions`; the one place `context` touches `vault` (keychain + header + lineage). No keychain key → `VAULT_LOCKED`; stale key → delete it, then `VAULT_LOCKED`. On open, also consults the injected `SessionGuard` (M3 idle auto-lock — see [vault.md](vault.md)) right after the keychain check. `runWithSession` holds the always-close guarantee. `write()` (M3) runs the mutation inside the db transaction and bumps the lineage only on success (a failed `Result` throws a private sentinel to force a rollback, caught outside and unwrapped back to the original error) — last-seen is recorded only after the transaction actually commits.

Proof: `src/context/domain/values/values.test.ts`, `src/context/domain/entities/context-item.test.ts`, `src/context/domain/services/context-pack.test.ts` (the algorithm, no vault), `src/context/domain/services/item-curation.test.ts` (the curation rules, no vault), `src/context/domain/values/{binding-target,repository-target}.test.ts` (path grammar; the remote normalization table, credentials stripped, input never echoed), `src/context/domain/services/project-resolution.test.ts` (precedence, case, ambiguity, link-target choice, hints), `src/context/infra/{project-repo,item-repo,vault-sessions}.test.ts`, and one `*.use-case.test.ts` per use case under `src/context/application/use-cases/`.
