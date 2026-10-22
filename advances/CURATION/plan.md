# CURATION — Pin, archive, edit and supersede saved context · Implementation Plan

**Spec:** `advances/CURATION/refined.md`. Gate R was **approved** by Oscar on 2026-10-17, and all 16
decisions D-A … D-P were settled at their recommended defaults. This plan implements those defaults
and does not reopen them. Where the spec leaves a choice to the planner (D-H mechanism, D-J
`--content`, the CLI file split in §11, and a few smaller ones), this plan uses a recommended
default and lists the choice under §6 *Decisions to confirm*.

**Branch:** `feat/curation-CURATION`, following `{feature}/{ADVANCE}`. Per `CLAUDE.md` step 3, the
implementer creates it **after** approval. The planner has not created it.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** `.claude/hooks/guard-implementation.sh` enforces this mechanically for
> `src/**`, `desktop/**`, `package.json` and build config. The planner never writes that line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Every claim in `refined.md` §3 was re-checked against the working tree. All of them hold:
`archive()` at `item-repo.ts:121` has no caller outside its own test, the upsert keeps `created_at`,
`ITEM_NOT_FOUND` is declared but unused, `ContextItemView` has no `archived`, and
`LATEST_SCHEMA_VERSION` is 3. The facts below are **not in the spec**, and each one changes how a
slice is written.

- **F1. The desktop error-copy test reads `src/` directly.** `desktop/src/shared/i18n/error-copy.test.ts`
  regex-scans `src/context/domain/errors.ts` and fails for any code that has no copy in **both**
  `en.ts` and `es.ts`. So the six new codes and their desktop copy must land in the **same slice**
  (Slice 1). If they don't, the `desktop/` loop goes red from Slice 1 until Slice 7.
- **F2. Repo naming differs from `CLAUDE.md`'s `XUseCase` wording.** Use-case classes are bare
  nouns/verbs (`SaveContext`, `ShowProject`, `ImportItems`) living in `*.use-case.ts` files. This
  plan follows the repo: `SetItemPinned` in `set-item-pinned.use-case.ts`, not `SetItemPinnedUseCase`.
- **F3. Use-case tests run against a real temp vault, not fakes.** Every `*.use-case.test.ts` uses
  `makeUnlockedVault()` from `src/testing/test-vault.ts`. Lineage bumps are observable through
  `vault.deviceIdentity.lastSeen(vault.vaultId)?.generation`, the same probe
  `vault-sessions.test.ts` uses. §11 of the spec says "use cases with fakes". This plan follows the
  repo convention, because it also proves the rollback and no-bump properties against real SQLCipher.
- **F4. Only one test builds a fully typed `Container`.** `src/delivery/mcp/server.test.ts:36` does.
  Every desktop test casts with `as any as Container`. Adding container fields therefore breaks
  exactly one test literal, and it is fixed in the slice that adds the fields (Slice 3).
- **F5. `register-handlers.test.ts` and `schemas.test.ts` compare against `CHANNELS` dynamically.**
  Neither has a hard-coded count. "Update the closed-set test deliberately" therefore means:
  (a) add the two channels to `CHANNELS`, `ChannelMap`, `SCHEMAS`, the handler map and the preload
  bridge together, (b) add explicit schema-rejection cases for them, and (c) change the
  "29 channels" count in `specs/desktop.md` to 31.
- **F6. `exportProjectJson` calls `ShowProject` without `includeArchived`.** Export stays free of
  archived items with no change, and `archived` never appears in export JSON (spec §8).
- **F7. The golden fixture's archived item is `item-a09`**, and `expected-search.json` has an
  `archived-excluded: []` case. Neither is touched. They act as regression guards.
- **F8. Item ids in the repo come in three shapes:** ULIDs (26 chars, upper case), `imp-<32 hex>`
  (lower case), and fixture ids such as `item-a01`. The shortest real id is 8 characters, so a
  6-character minimum reference never rejects a real full id.
- **F9. `context/infra/item-repo.ts` sits loose at the `infra/` root.** Its file name is not
  tech-named, although its class (`SqliteContextItemRepository`) is. This is an existing deviation.
  The plan does not move it, to avoid churn. It is noted in §7.

**Spec wrinkles (none blocking):**

- **W1.** §5 says the curation verbs take a "full id or unique prefix" on the CLI, and §5 Desktop
  says "the renderer passes full ids". The plan's use cases accept a *reference* (a full id or a
  ≥6-character prefix) from every caller. The desktop always sends full ids, which resolve on the
  exact-match path first. Only `supersedes` is exact-id-only, per D-E. See P-6.
- **W2.** The §5 table does not say which wins when an item is **both** archived and already pinned
  and the user pins it. The plan **checks rejections before no-ops**, so this returns
  `ITEM_ARCHIVED`. See P-5.

---

## 1. Summary

Eight slices. The order follows the hexagon from the inside out: pure domain rules first, then
persistence, use cases, the two delivery adapters (MCP, CLI), the desktop IPC boundary, the desktop
UI, and a final gate.

1. **Domain.** `ItemId`/`ItemReference` values, six error codes, and one pure domain service
   (`item-curation.ts`) holding every transition and rule from §5. The desktop error copy ships in
   this slice too (F1).
2. **Persistence.** The repository gains `findById`/`findByIdPrefix` and loses the unscoped
   `archive()`. `ImportItems` stops resurrecting archived items (D-H).
3. **Use cases.** `SetItemPinned`, `SetItemArchived`, `EditItem`, plus `ShowProject.includeArchived`
   and the optional `archived` field on the view. All three are wired into the container.
4. **Supersede + MCP.** `SaveContext.supersedes` (atomic), the MCP argument and descriptions, and
   ids in `search_context` lines.
5. **CLI.** `pin`/`unpin`/`archive`/`unarchive`/`edit`, plus `show` printing ids and accepting
   `--archived`.
6. **Desktop IPC.** `content:setPinned`, `content:setArchived`, and `includeArchived` on
   `content:show`.
7. **Desktop UI.** A card action row, a "Show archived" toggle, an archive notice with Undo,
   catalogs, and the `docs/gui.md` rewrite.
8. **Final gate.** No file changes. A whole-diff check.

**Production lines: about 880 in total** (≈ 600 in `src/`, ≈ 280 in `desktop/src/`). Tests add
about 950 lines and docs about 120. There is no migration, no new dependency, no new MCP tool, and
no change to pack rendering.

---

## 2. Ordered slices

**Every slice ends green on both workspaces** (exact commands in §4.3):
`npm run typecheck && npm run lint && npm run test` at the repo root, **and**
`cd desktop && npm run typecheck && npm run lint && npm run test`. Slice 1 already touches `desktop/`
(F1), and `desktop/` imports root `src/` types, so running both loops every time is cheap insurance.

Each slice also lists the docs that ship in the same commit (`CLAUDE.md`: "Docs ship in the same
commit as the code").

---

### Slice 1 — Domain: item ids, curation rules, error codes (+ desktop error copy)

**Rationale.** Every rule in §5/§6 is a pure function of an item. It is proved here with no
database, no session and no I/O, before any caller exists.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/domain/values/item-id.ts` | new | ~35 |
| `src/context/domain/services/item-curation.ts` | new | ~90 |
| `src/context/domain/errors.ts` | +6 codes | +7 |
| `src/context/domain/values/values.test.ts` | + `parseItemId`/`parseItemReference` cases | +45 (test) |
| `src/context/domain/services/item-curation.test.ts` | new | ~170 (test) |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | +6 `errors.*` keys each | +12 |

**1.1 `errors.ts`.** Append these codes to the `ContextErrorCode` union: `INVALID_ITEM_ID`,
`ITEM_ID_AMBIGUOUS`, `ITEM_ARCHIVED`, `ITEM_PINNED`, `ITEM_NOT_CURATABLE`, `NOTHING_TO_EDIT`.
`contextErr` is unchanged.

**1.2 `values/item-id.ts`.** The file has the same shape as `project-name.ts`:

```ts
const PATTERN = /^[A-Za-z0-9-]{1,64}$/;
export const MIN_REFERENCE_LENGTH = 6;

/** An exact item id: ULID, `imp-<hex>`, or a fixture id — never assumed to be a ULID (spec §3 fact 9). */
export type ItemId = string & { readonly __brand: "ItemId" };
/** A full id or a unique prefix of it, at least 6 characters (D-I). */
export type ItemReference = string & { readonly __brand: "ItemReference" };

export function parseItemId(raw: string): Result<ItemId, DomainError>
export function parseItemReference(raw: string): Result<ItemReference, DomainError>
```

- Both functions trim their input. They never change its case: ULIDs are upper case and `imp-` ids
  are lower case.
- An empty value, more than 64 characters, or a character outside `[A-Za-z0-9-]` →
  `INVALID_ITEM_ID`.
- `parseItemReference` also rejects fewer than 6 characters, with a message that says "at least 6
  characters".
- Messages echo the input truncated to 70 characters with `truncateForMessage`, a three-line local
  helper. A pasted 10 KB blob therefore never comes back in full through MCP or the CLI.
- The charset excludes `%` and `_`, so a parsed reference can never act as a `LIKE` wildcard in
  Slice 2. **This is the reason the parser runs before every lookup.**

**1.3 `services/item-curation.ts`.** This file holds the §5 table as pure functions. Every function
takes `now` and never reads a clock.

```ts
export interface CurationOutcome { item: ContextItem; changed: boolean }

export type EditableField = "content" | "tags" | "type";
export interface ItemEdit { content?: Content; tags?: readonly Tag[]; type?: ItemType }
export interface EditOutcome { item: ContextItem; changedFields: EditableField[] }

export function setPinned(item: ContextItem, pinned: boolean, now: Date): Result<CurationOutcome, DomainError>
export function setArchived(item: ContextItem, archived: boolean, now: Date): CurationOutcome
export function applyEdit(item: ContextItem, edit: ItemEdit, now: Date): Result<EditOutcome, DomainError>
export function archiveSuperseded(item: ContextItem, now: Date): Result<ContextItem, DomainError>
```

Rules. Each line below is one `if` in the code:

- **One private guard, `refuseUncuratable(item)`.** If `item.type === "imported"`, it returns
  `ITEM_NOT_CURATABLE`. If `item.archived`, it returns `ITEM_ARCHIVED`. Pin, edit and supersede use
  it. Archive and unarchive never do, because D-H allows them on imported items.
- **`setPinned(item, true)`**: guard first, then the no-op check (W2/P-5), then
  `{ ...item, pinned: true, updatedAt: now }`.
- **`setPinned(item, false)`**: no guard (unpin works on anything that exists), then the no-op
  check, then the change.
- **`setArchived`** is total. When nothing changes it returns `changed: false` with the item
  untouched. Otherwise it flips `archived` and stamps `updatedAt`. **`pinned` is never touched**
  (D-O).
- **`applyEdit`**: guard first. Then it compares each provided field with the current value
  (`content !==`, tags compared element by element in order, `type !==`) and collects
  `changedFields`. An empty list means no-op and the original item comes back. `id`, `projectId`,
  `source`, `pinned`, `archived` and `createdAt` are always carried over. Only `updatedAt = now` is
  stamped, and only when something changed.
- **`archiveSuperseded`**: guard first, then `item.pinned` → `ITEM_PINNED` (D-P), then
  `setArchived(item, true, now).item`. Project scoping is **not** checked here. That is a lookup
  concern, and it lives in the application layer (Slice 4).

Messages name the id and the remedy:
`Item <id> is archived. Unarchive it first.`,
`Item <id> is pinned. Unpin it first — a pin is the user's call.`, and
`Item <id> is an imported item; it can only be archived or unarchived.`
They contain no content text (§10.4).

**1.4 Desktop error copy (F1).** Add `errors.INVALID_ITEM_ID`, `ITEM_ID_AMBIGUOUS`, `ITEM_ARCHIVED`,
`ITEM_PINNED`, `ITEM_NOT_CURATABLE` and `NOTHING_TO_EDIT` to `en.ts` and `es.ts`. The copy must be
honest (§10.8): `ITEM_ARCHIVED` reads "That item is archived — unarchive it first."; nothing says
"deleted".

**1.5 Tests.**

- `values.test.ts`: a ULID, `imp-<32hex>` and `item-a01` all parse. Each of these is rejected:
  `""`, 65 characters, `"01J%"`, `"01J_"`, `"a b"`, `"ab;--"`. A 5-character reference is
  rejected and a 6-character one passes. Whitespace is trimmed. Case is kept.
- `item-curation.test.ts`, organized as one `describe` per row of §5:
  - **pin.** Each of these cases is covered:
    - pinning an unpinned item sets `changed: true` and stamps `updatedAt`;
    - pinning an already-pinned item returns `changed: false` with an identical item;
    - pinning an archived item returns `ITEM_ARCHIVED`;
    - pinning an imported item returns `ITEM_NOT_CURATABLE`;
    - pinning an archived item that is already pinned returns `ITEM_ARCHIVED` (W2).
  - **unpin** works on an archived item and on an imported one.
  - **archive/unarchive** preserve `pinned` (D-O) and work on imported items. Archiving twice
    returns `changed: false`.
  - **edit.** Each of these cases is covered:
    - each field changes alone and `changedFields` reports exactly that field;
    - identical values give an empty `changedFields`;
    - `createdAt`, `id`, `source` and `pinned` are kept;
    - an archived or imported item is rejected;
    - a reordered tag list counts as a change.
  - **archiveSuperseded.** A pinned item → `ITEM_PINNED`. An imported item → `ITEM_NOT_CURATABLE`.
    An archived item → `ITEM_ARCHIVED`. A healthy item comes back with `archived: true` and
    `pinned` unchanged.

**Docs in this commit:** `specs/context.md` §domain/errors (six codes), §domain/values (`ItemId`,
`ItemReference`), and a new §domain/services bullet for `item-curation.ts`.

**Done when:** both loops are green, and `error-copy.test.ts` passes with the six new codes.

---

### Slice 2 — Persistence: id lookups, remove `archive()`, import keeps archived

**Rationale.** Until the port can find an item by id, no use case can be written. Removing
`archive()` in the same slice that adds the replacement lookups means the unscoped,
lineage-unaware write path never coexists with the new one (D-M).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/ports/repositories.ts` | + `ItemWithProject`, `findById`, `findByIdPrefix`; − `archive` | +10 / −1 |
| `src/context/infra/item-repo.ts` | + 2 queries; − `archive` | +32 / −6 |
| `src/context/application/use-cases/import-items.use-case.ts` | keep archived on re-import (D-H) | +8 |
| `src/context/infra/item-repo.test.ts` | replace the `archive` test; + lookup cases | +70 / −11 (test) |
| `src/context/application/use-cases/import-items.use-case.test.ts` | + re-import keeps archived | +30 (test) |

**2.1 Port** (`ports/repositories.ts`):

```ts
/** An item and the slug of the project it lives in — what every by-id lookup returns. */
export interface ItemWithProject { item: ContextItem; projectName: ProjectName }

export interface ContextItemRepository {
  save(item: ContextItem): void;
  findById(itemId: string): ItemWithProject | null;
  findByIdPrefix(prefix: string, limit: number): ItemWithProject[];
  findByProject(projectId: string, filters?: FindByProjectFilters): ContextItem[];
  search(query: string, projectId?: string, limit?: number): SearchResult[];
}
```

`SearchResult` stays as it is (P-9). Both lookups **include archived items**, because unarchive and
edit must be able to find them. They are vault-wide (D-I).

**2.2 Adapter** (`item-repo.ts`). Both queries reuse `toItem` and the
`JOIN projects p ON p.id = i.project_id` that `search` already uses:

- `findById`: `WHERE i.id = @id` (exact, case-sensitive).
- `findByIdPrefix`: `WHERE i.id LIKE @prefix || '%' ORDER BY i.id LIMIT @limit`. SQLite's `LIKE` is
  ASCII case-insensitive, so `01j3q8z6` finds `01J3Q8Z6…` (P-3). The ESCAPE question does not arise,
  because Slice 1's charset makes `%`/`_` unreachable. A one-line comment states that dependency.
- Delete `archive(itemId)` entirely.

**2.3 `ImportItems` keeps the archived state (D-H, P-4).** In `saveDraft`, after the imported item is
minted:

```ts
const item = createImportedContextItem({ … });
const existing = session.items.findById(item.id);
session.items.save(existing?.item.archived ? setArchived(item, true, now).item : item);
```

This is one indexed primary-key read per chunk, inside the transaction the import already holds. It
does not change `save()`, `SaveContext` or edit persistence, as the spec requires. Content is still
refreshed by the upsert, which is unchanged M2 behaviour for imported chunks.

**2.4 Tests**

- `item-repo.test.ts`:
  - The old "archive hides items from search and default find" test is rewritten to save an item,
    then re-save it with `{ ...item, archived: true }`. It asserts that search and default find
    exclude the item. It is the same property, reached through the one write path that remains.
  - `findById` covers a hit with its project name, a miss → `null`, and an archived item (still
    found).
  - `findByIdPrefix` covers: two items sharing a prefix → both, sorted; a lower-case prefix matches
    an upper-case id; the limit is respected; the search spans projects.
  - **FTS after an in-place edit.** Re-save with new content. `search(old word)` returns 0 hits and
    `search(new word)` returns 1, which proves the `items_au` trigger (spec fact 6).
- `import-items.use-case.test.ts`:
  - Import, archive one imported item (via `session.write` + `save` of the archived copy), then
    re-import the same drafts.
  - Assert that the item is still archived and absent from `findByProject` by default.
  - Assert that a never-archived sibling is refreshed as before.

**Docs in this commit:**

- `specs/context.md` §application/ports: the `ContextItemRepository` list loses "archive" and gains
  "findById / findByIdPrefix (archived included, vault-wide)".
- `specs/context.md` §ImportItems: "re-import preserves a chunk's archived state".
- `CHANGELOG.md` `[Unreleased] → Changed`: re-importing an export no longer un-archives imported
  items.

**Done when:** both loops are green, and `grep -rn "\.archive(" src desktop/src` returns nothing.

---

### Slice 3 — Use cases: `SetItemPinned`, `SetItemArchived`, `EditItem`; `ShowProject.includeArchived`

**Rationale.** The three human curation verbs share one shape:
parse → session → find → domain transition → write only if changed. They land together with the two
small application services they share, so no use case calls another (D-M).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/services/item-curation-steps.ts` | new: `findItemByReference`, `saveIfChanged` | ~40 |
| `src/context/application/dto/item-curation-output.ts` | new: shared output + mapper | ~25 |
| `src/context/application/use-cases/set-item-pinned.use-case.ts` | new | ~40 |
| `src/context/application/use-cases/set-item-archived.use-case.ts` | new | ~38 |
| `src/context/application/use-cases/edit-item.use-case.ts` | new | ~80 |
| `src/context/application/use-cases/show-project.use-case.ts` | + `includeArchived` | +6 |
| `src/context/application/dto/context-item-view.ts` | + optional `archived` | +3 |
| `src/delivery/container.ts` | + 3 fields, 3 constructions | +6 |
| `src/delivery/mcp/server.test.ts` | container literal + 3 fields (F4) | +3 (test) |
| `…/use-cases/set-item-pinned.use-case.test.ts` | new | ~100 (test) |
| `…/use-cases/set-item-archived.use-case.test.ts` | new | ~80 (test) |
| `…/use-cases/edit-item.use-case.test.ts` | new | ~120 (test) |
| `…/use-cases/show-project.use-case.test.ts` | + `includeArchived` cases | +25 (test) |

`services/` is a new subfolder in `context/application`. It follows the existing precedent
`vault/application/services/resolve-unlock-key.ts`: stateless application helpers that are neither
ports nor `UseCase`s. See §7.

**3.1 `services/item-curation-steps.ts`**

```ts
const CANDIDATES_SHOWN = 5;

/** Exact id first; otherwise a unique prefix. Archived items are found — unarchive needs them. */
export function findItemByReference(session: VaultSession, reference: ItemReference): Result<ItemWithProject, DomainError>

/** D-L: a no-op never opens a write, so it never bumps the lineage. */
export function saveIfChanged(session: VaultSession, item: ContextItem, changed: boolean): Result<void, DomainError>
```

- `findItemByReference` follows these steps:
  1. Try `findById(reference)`; a hit returns it.
  2. Otherwise run `findByIdPrefix(reference, CANDIDATES_SHOWN + 1)`.
  3. 0 matches → `ITEM_NOT_FOUND` (`No item matches "<ref>".`).
  4. 1 match → return it.
  5. 2 or more → `ITEM_ID_AMBIGUOUS` (`"<ref>" matches several items: <id>, <id>, … Use more
     characters.`). The message lists up to 5 full ids, plus "and more" when 6 come back.
- `saveIfChanged`: if `changed` is false, return `ok(undefined)` with no write. Otherwise run
  `session.write(() => { session.items.save(item); return ok(undefined); })`.

**3.2 `dto/item-curation-output.ts`**

```ts
export interface ItemCurationOutput { itemId: string; project: string; type: StorableItemType; changed: boolean }
export interface EditItemOutput extends ItemCurationOutput { changedFields: EditableField[] }
export const toItemCurationOutput = (found: ItemWithProject, item: ContextItem, changed: boolean): ItemCurationOutput
```

The DTO carries primitives only, like `ContextItemView`. `type` comes from the **post-edit** item, so
`edit --type` reports the new type.

**3.3 The three use cases.** Each one reads as five lines of narrative:

```ts
export class SetItemPinned implements UseCase<SetItemPinnedInput, ItemCurationOutput> {
  constructor(private readonly sessions: VaultSessions, private readonly clock: Clock) {}

  execute(input: SetItemPinnedInput): Result<ItemCurationOutput, DomainError> {
    const reference = parseItemReference(input.item);
    if (!reference.ok) return reference;

    return this.sessions.withSession((session) => {
      const found = findItemByReference(session, reference.value);
      if (!found.ok) return found;
      const outcome = setPinned(found.value.item, input.pinned, this.clock.now());
      if (!outcome.ok) return outcome;
      const saved = saveIfChanged(session, outcome.value.item, outcome.value.changed);
      if (!saved.ok) return saved;
      return ok(toItemCurationOutput(found.value, outcome.value.item, outcome.value.changed));
    });
  }
}
```

- `SetItemPinnedInput { item: string; pinned: boolean }`. The `item` field mirrors `project: string`
  in `SaveContextInput`: a raw value that gets parsed.
- `SetItemArchived` has the same shape with `{ item: string; archived: boolean }`. `setArchived` is
  total, so it has no `outcome.ok` branch.
- `EditItem` takes `{ item: string; content?: string; tags?: string[]; type?: string }`. Its
  `parseInput` method mirrors `SaveContext.parseInput` and runs **before** the session opens
  (§10.5):
  - If all three fields are `undefined`, it returns `NOTHING_TO_EDIT` (`Nothing to edit: give new
    content, tags, or a type.`).
  - Otherwise it calls `parseContent` / `parseTags` / `parseItemType` (the five saveable types only)
    for each field that is present.
  - The session body is the same as above, with `applyEdit` in place of the pin transition, and it
    returns an `EditItemOutput`.

**3.4 `ShowProject.includeArchived`.** Add `includeArchived?: boolean` to `ShowProjectInput` and to
`ShowFilters`. Pass `{ ...typeFilter, includeArchived: true }` to `findByProject` only when the flag
is true.

**3.5 `ContextItemView.archived`.** Add `archived?: boolean`, set by
`...(item.archived ? { archived: true } : {})`, the same idiom as `source`. The field is absent for
every live item. That keeps `expected-search.json` and `valija export --json` byte-identical
(spec §8).

**3.6 Container.** Add `setItemPinned: SetItemPinned`, `setItemArchived: SetItemArchived` and
`editItem: EditItem`, each constructed `(sessions, systemClock)`. Add the same three fields to the
literal in `server.test.ts` (F4).

**3.7 Tests** (real temp vault, F3). Each file has a `generation()` helper that reads
`vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1`.

- `set-item-pinned`:
  - pin: changed, one bump, `show` reflects it, `updatedAt` advanced (via `FixedClock.advanceMinutes`).
  - pinning again: `changed: false`, **zero** bumps.
  - an 8-character prefix resolves.
  - two ids sharing a prefix (`SeqIds` gives `01SEQ000001`, `01SEQ000002`) with a 7-character
    reference `01SEQ00` → `ITEM_ID_AMBIGUOUS`, zero bumps, and the message contains both ids.
  - an unknown reference → `ITEM_NOT_FOUND`.
  - `"abc"` → `INVALID_ITEM_ID`, and the session is never opened. Proven by locking first: the error
    is still `INVALID_ITEM_ID`, not `VAULT_LOCKED`.
  - an archived item → `ITEM_ARCHIVED`, zero bumps.
  - an imported item (minted through `ImportItems`) → `ITEM_NOT_CURATABLE`.
  - a locked vault with a valid reference → `VAULT_LOCKED`.
- `set-item-archived`:
  - archive: one bump; the item leaves `show`, `search` and the pack (`GetContextPack`); `ListProjects`
    counts it out.
  - unarchive: back in every view, with `pinned` exactly as before (D-O).
  - archive and unarchive both work on an imported item.
  - repeating either: zero bumps.
- `edit-item`:
  - each field alone, and all three together.
  - `changedFields` is correct.
  - `createdAt` is kept, `updatedAt` advances, and `pinned`/`source` are kept.
  - after editing the content, `SearchContext` finds the new word and not the old one (spec §12, CLI
    criterion "After `edit`, search finds the new text").
  - `{}` → `NOTHING_TO_EDIT` before the session (lock-first proof).
  - `type: "imported"` → `INVALID_ITEM_TYPE`; an empty content → `CONTENT_EMPTY`; 11 tags →
    `TOO_MANY_TAGS`.
  - identical values → `changed: false`, zero bumps.
  - an archived item or an imported item is rejected, with zero bumps.
- `show-project`: an archived item is absent by default. With `includeArchived` it is present and
  carries `archived: true`. A live item's view has **no** `archived` key (`"archived" in view` is
  false).

**Docs in this commit:**

- `specs/context.md`:
  - §application: a new `services/` paragraph.
  - §application/dto: `item-curation-output.ts`, and `ContextItemView.archived` described as "present
    only when true".
  - §use cases: `SetItemPinned`, `SetItemArchived` and `EditItem`, each in two sentences, plus
    `ShowProject.includeArchived`.
  - the Proof line.
- `docs/SPEC.md` §5: the use-case list gains the three.

**Done when:** both loops are green, and `server.test.ts` still reports exactly 5 tools.

---

### Slice 4 — `SaveContext.supersedes` and the MCP surface

**Rationale.** `supersedes` is the advance's top risk (spec §14). It gets its own slice and its own
review diff, together with every MCP-facing text change, so the reviewer sees the whole AI-reachable
surface in one place.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/use-cases/save-context.use-case.ts` | + `supersedes` | +30 |
| `src/delivery/mcp/server.ts` | + arg, descriptions, ids in search lines, response suffix | +20 |
| `src/context/application/use-cases/save-context.use-case.test.ts` | + supersede cases | +110 (test) |
| `src/delivery/mcp/server.test.ts` | + supersede e2e, search id, archived never surfaced | +90 (test) |

**4.1 `SaveContext`**

- Input gains `supersedes?: string`. Output gains `supersededItemId?: string`, present only when it
  was used.
- `parseInput` adds a `supersedes: ItemId` (via `parseItemId`, **exact** id, no prefix — D-E/§5 MCP)
  to `ValidatedSave`. A bad id fails before the session opens.
- The order inside the existing single `session.write(...)` is security-relevant (§3):

```ts
session.write(() => {
  const { project, created } = this.findOrCreateProject(session, v.name);
  const retired = this.retireSuperseded(session, project, v.supersedes);   // 1. check target
  if (!retired.ok) return retired;                                         //    → rollback, project creation included
  const item = createContextItem({ … });
  session.items.save(item);                                                // 2. save new
  if (retired.value !== null) session.items.save(retired.value);           // 3. archive old
  return ok({ …, ...(retired.value === null ? {} : { supersededItemId: retired.value.id }) });
});
```

- The private `retireSuperseded(session, project, id?)` method returns
  `Result<ContextItem | null>`:
  1. No id → `ok(null)`.
  2. Otherwise run `findById(id)`.
  3. If that returns `null` **or** an item with `item.projectId !== project.id`, return
     `ITEM_NOT_FOUND` with `No item <id> in project "<name>".` The message is the same in both
     cases, so it leaks nothing about other projects (§6, §10.9).
  4. Otherwise return `archiveSuperseded(found.item, now)`.
- Same-project scoping happens here and never in the domain, because it is a fact about the lookup.
- The method takes the one `now = this.clock.now()` that the save also uses. The new item's
  `createdAt` and the old item's `updatedAt` are therefore the same instant.

**4.2 MCP `server.ts`**

- The `save_context` inputSchema gains:
  `supersedes: z.string().max(64).optional().describe("Optional. The full id of ONE item in this same project that this save replaces — find it with search_context first. That item is archived (hidden from packs and search, not deleted). The whole call fails, and nothing is saved, if the id is unknown, in another project, pinned, imported, or already archived.")`
  The handler passes `supersedes` through. `save_handoff` is **not** changed (D-E).
- The success text appends ` Archived superseded item <id>.` when `supersededItemId` is present.
- `DESCRIPTIONS.save_context` gains one sentence: "If this save replaces an outdated item (a
  reversed decision, stale progress), pass its id as `supersedes`."
- `search_context` lines become ``- [${project}] (${type}, ${date}, id ${id}) ${content}`` (D-F a).
  `DESCRIPTIONS.search_context` ends with "…with project, type, date, and id."
- `get_context`, `list_projects` and the prompts are **unchanged**. No `pinned` argument is added
  anywhere (D-N).

**4.3 Tests**

- `save-context.use-case.test.ts`:
  - Happy path: one bump; the old item is archived, the new one saved, `supersededItemId` set; the
    pack contains the new and not the old.
  - Rejections. Each case below fails with its code, makes **zero bumps**, and saves no new item:
    - an unknown id → `ITEM_NOT_FOUND`;
    - an id from another project → `ITEM_NOT_FOUND`, with a message that does not contain the other
      project's name;
    - a pinned target → `ITEM_PINNED`;
    - an imported target → `ITEM_NOT_CURATABLE`;
    - an archived target → `ITEM_ARCHIVED`;
    - a malformed id → `INVALID_ITEM_ID`, raised before the session (lock-first proof).
    For the first five, the item count is unchanged (`ShowProject` with `includeArchived`).
  - Superseding into a project that does not exist yet → `ITEM_NOT_FOUND`, and **the project is not
    created** (the rollback covers `findOrCreateProject`).
- `server.test.ts`:
  - The tool list is still exactly 5.
  - `save_context`'s `inputSchema.properties` keys are exactly
    `{project, content, type, tags, supersedes}`, and the other four tools' schemas are unchanged.
    The test snapshots the key sets as literal arrays, not as a snapshot file.
  - Supersede e2e: search for the id, supersede, and check the response names both ids.
  - A pinned target → `isError` with `[ITEM_PINNED]`.
  - A search line contains `id <id>`.
  - **Archived content never surfaces.** After the supersede, `get_context` and `search_context` for
    the old item's unique word contain neither the word nor the old id.

**Docs in this commit:**

- `docs/SPEC.md` §7: `save_context` args gain `supersedes?` in the table, plus one sentence on the
  rules.
- `specs/delivery.md` §mcp: the `supersedes` rules, ids in search lines, and "five tools, unchanged
  count".
- `specs/context.md` §SaveContext: atomic supersede.
- `README.md` §"The MCP surface": one bullet on `supersedes` and one on archived content never being
  surfaced.
- `CHANGELOG.md` `Added`.

**Done when:** both loops are green, and `vault-format-conformance.test.ts` passes **unmodified**.

---

### Slice 5 — CLI: five verbs, `show` ids and `--archived`

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/cli/curation-commands.ts` | new (P-1) | ~105 |
| `src/delivery/cli/program.ts` | + 5 commands, `show --archived` | +45 |
| `src/delivery/cli/content-commands.ts` | `showCommand` uses the header helper, passes `includeArchived` | +6 / −3 |
| `src/delivery/cli/render.ts` | + `itemHeaderLine(view)` | +12 |
| `src/delivery/cli/curation-commands.test.ts` | new | ~150 (test) |
| `src/delivery/cli/render.test.ts` | + `itemHeaderLine` cases | +30 (test) |

**5.1 `render.ts`: `itemHeaderLine(item: ContextItemView): string`.** This is a pure function, and it
is the line `show` prints:

```
— decision · 2026-07-20  id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6  📌  [storage]  [archived]
```

The id is always shown in full (D-I). The `📌`, tags and `[archived]` segments each appear only when
applicable.

**5.2 `curation-commands.ts`.** These are thin adapters: call the use case, call `fail()` on an
error, print one line.

```ts
export function pinCommand(c: Container, item: string): void
export function unpinCommand(c: Container, item: string): void
export function archiveCommand(c: Container, item: string): void
export function unarchiveCommand(c: Container, item: string): void
export function editCommand(c: Container, item: string, options: EditOptions): void
```

- Output for a change: `Pinned decision <fullId> in project "valija".`. `archiveCommand` appends
  ` Undo: valija unarchive <fullId>`. Output for a no-op: `Already pinned — nothing changed.`. The
  verb words come from a small `const` table, not from four near-identical functions.
- `editCommand` options: `{ contentFile?: string; tags?: string; type?: string }`.
  - `--content-file <path|->`: `-` means stdin, read with `readFileSync(0, "utf8")`; anything else is
    read with `readFileSync(path, "utf8")`.
  - An unreadable file → `error: could not read <path>: <reason>`, exit 1. The message carries no
    content.
  - `--tags a,b` → `split(",").map(trim).filter(Boolean)`. **`--tags ""` clears all tags** (P-8).
  - The command never spawns a process and never writes a file (D-J).
  - There is **no `--content <text>` flag** (P-7).
  - Success: `Updated progress <id> in project "valija" (content, tags).`. No-op: `Nothing changed —
    the item already has those values.`. `NOTHING_TO_EDIT` comes from the use case through `fail()`.
- Commands print only ids, types and project names. **Nothing in this file prints item content.**

**5.3 `program.ts`.** Five `program.command(...)` blocks in the existing style. Each takes
`.argument("<id>", "item id, or a unique prefix of at least 6 characters (see valija show)")`.
`edit` declares the three options. `show` gains
`.option("--archived", "include archived items, marked [archived]")`.

**5.4 Tests** (`curation-commands.test.ts`)

- The test builds a container over `makeUnlockedVault()`, like `vault-commands.test.ts` does, with
  `as unknown as Container` around the fields it needs.
- It spies on `console.log`/`console.error`, and stubs `process.exit` to throw a sentinel so `fail()`
  is observable.
- Cases:
  - Each verb prints its line and changes state.
  - A repeated pin prints the no-op line.
  - An ambiguous prefix exits 1 with `error [ITEM_ID_AMBIGUOUS]`.
  - An unknown reference exits 1 with `[ITEM_NOT_FOUND]`.
  - `edit --content-file <tmpfile>` updates the item; a following `searchCommand` finds the new word.
  - `edit` with no flags → `[NOTHING_TO_EDIT]`.
  - `edit --tags ""` clears the tags.
  - **No `console.log` call in any case contains the item's content.**
- `render.test.ts`: `itemHeaderLine` covers a full id, the pinned mark, the archived mark, and no
  tags.
- Stdin (`-`) is one branch on `readFileSync(0)` and is checked by review. No test spawns a
  subprocess (Assumption A5).

**Docs in this commit:**

- `docs/SPEC.md` §8: the CLI block gains `pin|unpin|archive|unarchive <id>`,
  `edit <id> [--content-file f|-] [--tags a,b] [--type t]`, and `show <project> [--type] [--archived]`.
- `specs/delivery.md` §cli: table rows for the five verbs and the `show` changes.
- `README.md` §"Everyday use": the five commands added to the code block, plus a short "Curating your
  context" paragraph. That paragraph says archive is "hidden from packs and search, not deleted",
  and that `edit` reads from a file or stdin and never opens an editor.
- `CHANGELOG.md` `Added`.

**Done when:** both loops are green, and `valija --help` lists the five commands. Check this manually
with `npm run build && node dist/program.js --help`.

---

### Slice 6 — Desktop IPC: two channels and `includeArchived`

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/shared/ipc/messages.ts` | + 3 types; `includeArchived?`, `archived?` | +20 |
| `desktop/src/shared/ipc/channels.ts` | + 2 channels + `ChannelMap` entries | +8 |
| `desktop/src/main/ipc/schemas.ts` | + 2 schemas; `content:show` flag | +4 |
| `desktop/src/main/ipc/handlers/content-handlers.ts` | + 2 handlers | +14 |
| `desktop/src/preload/index.ts` | + 2 bridge methods (hand-written) | +6 |
| `desktop/src/renderer/state/bridge.ts` | + 2 interface members | +2 |
| `desktop/src/main/ipc/schemas.test.ts` | + rejection/acceptance cases | +25 (test) |
| `desktop/src/main/ipc/handlers/content-handlers.curation.test.ts` | new | ~90 (test) |
| `desktop/src/main/ipc/handlers/content-handlers.session-safety.test.ts` | + the 2 writes in the scripted sequence | +6 (test) |

**6.1 Wire types** (`messages.ts`):

```ts
export interface ContentSetPinnedRequest { id: string; pinned: boolean }
export interface ContentSetArchivedRequest { id: string; archived: boolean }
export interface ContentCurationResponse { changed: boolean }
```

`ContentShowRequest` gains `includeArchived?: boolean`, and `ContextItemMessage` gains
`archived?: boolean`. The response deliberately carries **only** `changed`, with no content and no
project. The renderer reloads `content:show` to see the result.

**6.2 Schemas.**

- `"content:setPinned": z.object({ id: z.string().max(64), pinned: z.boolean() })`
- `"content:setArchived": z.object({ id: z.string().max(64), archived: z.boolean() })`
- `content:show` gains `includeArchived: z.boolean().optional()`

The schemas have no free-form patch object (§10.5). The full id grammar is enforced by
`parseItemReference` in the use case, so zod checks only type and length.

**6.3 Handlers.** Each is four lines, like its neighbours:

```ts
"content:setPinned": (req: ContentSetPinnedRequest) =>
  toIpcResult(getContainer().setItemPinned.execute({ item: req.id, pinned: req.pinned }),
    (v): ContentCurationResponse => ({ changed: v.changed })),
```

`toIpcResult` already strips `DomainError.message`. The `ITEM_ID_AMBIGUOUS` message, which lists ids,
therefore never crosses to the renderer.

**6.4 Tests**

- `schemas.test.ts`:
  - `setPinned` cases: `{}` rejected; `{id:"x", pinned:"yes"}` rejected; a 65-character id rejected;
    `{ id, pinned:true }` accepted.
  - `setArchived`: the same four cases.
  - `content:show` with `includeArchived: "true"` (a string) → rejected.
  - An extra `patch` field is stripped from the parsed data.
- `content-handlers.curation.test.ts` (real vault, built like the session-safety test):
  - Each case is checked:
    - `setPinned` → `{ ok:true, value:{changed:true} }`, and `content:show` shows `pinned: true`;
    - the same call again → `changed:false`;
    - `setArchived` hides the item from `content:show`, and `includeArchived:true` returns it with
      `archived: true`;
    - an unknown id → `{ ok:false, error:{ code:"ITEM_NOT_FOUND" } }`, with **no `message` key**;
    - `content:pack` after archiving does not contain the archived content.
  - Static check: the handler file never imports a repository or `SqliteVaultSessions`. A grep
    assertion in the same style as `import-no-reimplementation.test.ts` verifies this.
- `content-handlers.session-safety.test.ts`: append `setPinned`/`setArchived` calls to the scripted
  sequence. No sidecar may remain.

**Docs in this commit:** `specs/desktop.md` §IPC: "29 channels" → "31"; the `content:*` row gains
`setPinned · setArchived`, with the note "writes through the same use cases as the CLI, one lineage
bump per real change, none on a no-op".

**Done when:** the desktop loop is green, and `register-handlers.test.ts` passes with 31 channels.

---

### Slice 7 — Desktop UI: card actions, Show archived, archive notice, docs

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/renderer/state/item-actions.ts` | new: `itemActionsFor`, `performItemAction` | ~40 |
| `desktop/src/renderer/state/item-actions.test.ts` | new | ~70 (test) |
| `desktop/src/renderer/components/item-card.tsx` | + `archived`, `actions`, `onAction`, `busy` props; action row | +30 |
| `desktop/src/renderer/screens/project.tsx` | + toggle, reload token, sections, notice | +40 |
| `desktop/src/renderer/styles/screens.css` | + `.item-actions`, `.item-action`, `.item-row.archived`, `.item-archived` | +35 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + 10 `project.*` keys each | +20 |
| `desktop/src/renderer/screens/__dom-tests__/project.dom.test.tsx` | + curation cases | +130 (test) |

**7.1 `state/item-actions.ts`.** This is the pure view logic §11 asks for, in the same style as
`pinned-partition.ts`.

```ts
export type ItemAction = "pin" | "unpin" | "archive" | "unarchive";

/** Which actions a card offers — mirrors the domain rules so the UI never offers a call that would be refused. */
export function itemActionsFor(item: { type: string; pinned: boolean; archived?: boolean }): ItemAction[]

/** One bridge call per action — the only place the renderer maps an action to a channel. */
export function performItemAction(bridge: ValijaBridge, id: string, action: ItemAction): Promise<IpcResult<ContentCurationResponse>>
```

The rules for `itemActionsFor`:

- archived → `["unarchive"]`
- `imported` → `["archive"]`. There is no pin (D-H).
- otherwise → `[pinned ? "unpin" : "pin", "archive"]`

`performItemAction` is a `switch` with no default branch, so the compiler checks that all four
actions are handled.

**7.2 `item-card.tsx`.** It gains four **optional** props: `archived?: boolean`,
`actions?: ItemAction[]`, `onAction?: (action: ItemAction) => void` and `busy?: boolean`. These
additions leave the card unchanged wherever no actions are passed, which matters for a future
`search.tsx` reuse.

- The row class becomes `item-row` + ` pinned` + ` archived`.
- An archived card shows an `item-archived` label (`t("project.archivedBadge")`) in the header.
- When `actions` is non-empty, a `<div className="item-actions">` renders one
  `<button type="button" className="item-action">` per action, labelled `t(\`project.${action}\`)`.
- The archive button's `title` is `t("project.archiveHint")` ("Hide from packs and search. You can
  undo this.") (§10.8).
- Buttons are `disabled` while `busy`.

**7.3 `project.tsx`**

- New in-memory state: `showArchived` (default `false`), `reloadToken` (a counter), `busyId`
  (`string | null`), and `notice`, which holds the id of the item just archived.
  **None of these touches `bridge.preferences`** (§10.4).
- The `useEffect` deps become `[project, typeFilter, showArchived, reloadToken]`. The `show` request
  gains `includeArchived: true` only when `showArchived` is true.
- `async function runAction(id, action)`:
  1. set `busyId`;
  2. `await performItemAction(bridge, id, action)`;
  3. on `!ok`, call `setError(errorCopy(code))`;
  4. on `archive`, `setNotice(id)`; otherwise clear the notice;
  5. clear `busyId`;
  6. call `setReloadToken(n => n + 1)` (D-K: the list reloads after every action).
- The toolbar gains a `<label className="chip"><input type="checkbox" …/>{t("project.showArchived")}</label>`
  after the type chips.
- The notice renders as
  `<p className="notice">{t("project.archivedNotice")} <button …>{t("project.undo")}</button></p>`,
  and Undo calls `runAction(notice, "unarchive")`. This is the "archive success state shows an
  Unarchive affordance" from D-K.
- Sections:
  - `live = items.filter(i => !i.archived)` goes through the existing `partitionPinnedItems` into
    Pinned / Other.
  - `archived = items.filter(i => i.archived)` renders last, under `t("project.archivedSection")`,
    only when `showArchived` is on and the list is non-empty (P-10).
- `itemList(rows)` passes `archived`, `actions={itemActionsFor(item)}`,
  `onAction={(a) => runAction(item.id, a)}` and `busy={busyId === item.id}`.

**7.4 Catalog keys** (`project.*`, both languages, no placeholders, 10 keys):

| key | en | es |
|---|---|---|
| `pin` | Pin | Fijar |
| `unpin` | Unpin | Quitar de fijados |
| `archive` | Archive | Archivar |
| `unarchive` | Unarchive | Desarchivar |
| `archiveHint` | Hide from packs and search. You can undo this. | Ocultar de los paquetes y la búsqueda. Puedes deshacerlo. |
| `showArchived` | Show archived | Mostrar archivados |
| `archivedSection` | Archived | Archivados |
| `archivedBadge` | Archived | Archivado |
| `archivedNotice` | Archived — hidden from packs and search. | Archivado: oculto en los paquetes y la búsqueda. |
| `undo` | Undo | Deshacer |

**7.5 CSS** (`screens.css`, appended to the existing `/* project.tsx */` section and using existing
tokens only):

- `.item-actions`: flex, gap 12px.
- `.item-action`: the same link-style override `.item-toggle` uses (`padding:0; border:none;
  background:none; color: var(--color-accent); font-size: 0.78rem`). `.item-action:disabled` gets
  `opacity: .5; cursor: default`.
- `.item-row.archived`: `border-style: dashed; color: var(--color-text-muted)`.
- `.item-archived`: the same scale as `.item-pinned`, in the muted colour.
- There is no `url(...)`, because the no-network test applies.

**7.6 Tests**

- `item-actions.test.ts`:
  - the action lists for live, pinned, archived, imported and archived+pinned items;
  - `performItemAction` sends each of the four actions to the correct bridge method with the
    correct boolean, checked against a `vi.fn` bridge.
- `project.dom.test.tsx`: `fakeBridge` gains `setPinned`/`setArchived` (`vi.fn` resolving
  `{ ok:true, value:{ changed:true } }`). New cases:
  1. A live card shows Pin and Archive. A pinned card shows Unpin. An imported card shows Archive
     only, with no Pin.
  2. Clicking Pin calls `setPinned({ id, pinned: true })`, and `show` is then called a second time
     (reload).
  3. Clicking Archive calls `setArchived({ id, archived: true })`; the notice with Undo appears;
     Undo calls `setArchived({ id, archived: false })`.
  4. Ticking "Show archived" calls `show` with `includeArchived: true`. An archived row renders under
     the Archived heading with `.item-row.archived`, the badge, and only an Unarchive button.
  5. An error result `{ ok:false, error:{ code:"ITEM_ARCHIVED" } }` renders the English catalog copy.
  6. **Not persisted:** after toggling and acting, `preferences.write` was never called.
  7. Spanish: the same screen with `language: "es"` shows `Fijar` / `Mostrar archivados`.
  - The file must contain no URL, because `no-network-surface` scans `*.test.tsx` (CARDS F1).

**Docs in this commit:**

- `docs/gui.md`:
  - **Rewrite** the "Curate your content" bullet in "What this app deliberately does not do" to:
    "**Edit or delete your content** — you can pin, unpin, archive and unarchive items from a project
    (see above), but editing text is CLI-only for now (`valija edit`), and nothing in this app
    deletes anything: archive hides an item from packs and search and can always be undone."
  - Add one paragraph to "Browsing, searching, and taking a pack" describing Pin/Archive, Show
    archived, and the Undo notice.
- `specs/desktop.md` §Screens / §Renderer view state: `item-actions.ts`, and the project screen's
  curation row.
- `CHANGELOG.md` `Added` (desktop).

**Done when:** both loops are green; `no-network-surface.test.ts` and `catalogs.test.ts` pass; and a
manual run of the app (`cd desktop && npm run dev`) shows that pin, archive, Undo and Show archived
work against a real vault, in light **and** dark themes.

---

### Slice 8 — Final gate (no file changes)

1. Run both full loops (§4.3).
2. `git diff main...HEAD --stat -- src/testing/__fixtures__ src/shared/infra/migrations src/delivery/context-pack-markdown.ts src/context/domain/services/context-pack.ts docs/vault-format.md` must be **empty**. That covers spec §8 and AC "Contracts".
3. `grep -n "LATEST_SCHEMA_VERSION" src/shared/infra/migrations.ts` must still show 3.
4. `grep -rn "\.archive(" src desktop/src` must return nothing (D-M).
5. `grep -rnE "console\.(log|error)\(.*content" src/delivery/cli/curation-commands.ts` must return
   nothing. Also grep `src/context/**` for any `console.` call, which must not exist (§10.4).
6. `grep -rn "spawn\|exec\|tmpdir\|writeFileSync" src/delivery/cli/curation-commands.ts` must return
   nothing (D-J).
7. Walk spec §12 line by line against §4.2 below, then hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

1. **Parse before you open.** Every new entry point (`SetItemPinned`, `SetItemArchived`, `EditItem`,
   and `SaveContext` with `supersedes`) parses ids, content, tags and type **before**
   `withSession`. Bad input never decrypts the vault. Tests prove this with "lock first, still get
   the parse error".
2. **The id charset gates the SQL.** `parseItemReference` rejects `%` and `_` before
   `findByIdPrefix` builds its `LIKE` pattern. All values are bound parameters. No string
   interpolation reaches SQL. (The `LIMIT` in `findByProject` is pre-existing and unchanged.)
3. **Supersede checks the target first, then writes, in one transaction.** The order is:
   `findOrCreateProject` → `retireSuperseded` (lookup, same-project check, domain rules) → save the
   new item → save the archived old item. Any refusal returns an `err`, and `commitWrite`'s sentinel
   rolls back **everything**, including a just-created project and the lineage bump. There is no
   code path that saves the new item before the target has been approved.
4. **No cross-project oracle.** A missing id and an id in another project produce byte-identical
   `ITEM_NOT_FOUND` text. The test asserts that the other project's name is absent.
5. **Writes only through `session.write`.** The one unscoped write (`archive()`) is deleted in
   Slice 2, the same slice in which the lookups that replace it appear. The window in which two
   write paths coexist is zero.
6. **A no-op is not a write.** `saveIfChanged` is the only curation path into `session.write`, so a
   repeat never bumps the lineage (D-L). Tests count generations.
7. **The MCP blast radius stays bounded.** The tool takes a single exact id (no prefix, no array).
   Pinned and imported targets are refused. The action is archive-only. The archived id is always
   echoed. There is no `pinned` argument anywhere. The tool count stays 5, and the test asserts the
   exact schema key sets.
8. **Archived content never leaves through MCP.** No new read path is exposed to MCP.
   `findById`/`findByIdPrefix` are reachable only from curation use cases, whose output carries ids,
   types and project names, never content. The server test greps the outputs.
9. **No plaintext outside the vault.** `edit` reads a file or stdin and nothing else: no temp file,
   no `$EDITOR`. The desktop "Show archived", notice and busy state stay in React memory and never
   reach `preferences.write` (the DOM test asserts this). There is no `console.*` anywhere in
   `src/context`.
10. **The IPC stays closed.** Each channel is added to `CHANNELS`, `ChannelMap`, `SCHEMAS`, the
    handler map, the hand-written preload method and `ValijaBridge` together, in Slice 6. The
    handlers call container use cases only. `toIpcResult` strips messages, so candidate ids from
    `ITEM_ID_AMBIGUOUS` never reach the renderer.

---

## 4. Test plan

### 4.1 By layer

| Layer | Files | Proves |
|---|---|---|
| Domain values | `values.test.ts` | id/reference grammar, length bounds, wildcard chars refused |
| Domain service | `item-curation.test.ts` | every §5 row, every §6 rejection code, no-op detection, D-O, D-P |
| Repository (real SQLCipher) | `item-repo.test.ts` | exact/prefix lookup, archived included, case-insensitive prefix, FTS reindex after edit |
| Use cases (real temp vault) | `set-item-pinned`, `set-item-archived`, `edit-item`, `save-context`, `show-project`, `import-items` `.use-case.test.ts` | one bump per change, zero per rejection/no-op, `updatedAt`, parse-before-session, `VAULT_LOCKED`, atomic supersede, re-import keeps archived |
| CLI | `curation-commands.test.ts`, `render.test.ts` | output lines, exit codes, prefix/ambiguity, edit from file, no content printed |
| MCP (real client, in-memory transport) | `server.test.ts` | 5 tools, exact schema keys, supersede e2e + rejection, ids in search, archived never surfaced |
| Desktop IPC | `schemas.test.ts`, `content-handlers.curation.test.ts`, `content-handlers.session-safety.test.ts`, `register-handlers.test.ts` (unchanged) | closed set at 31, validation, code-only errors, no sidecars |
| Desktop view logic | `item-actions.test.ts` | action availability mirrors domain rules; action → channel mapping |
| Desktop DOM | `project.dom.test.tsx` | buttons, reload, notice/Undo, Show archived, error copy, not persisted, bilingual |
| Contracts (unchanged) | `vault-format-conformance.test.ts`, `context-pack-export.test.ts`, `content-handlers.golden-fixture.test.ts`, `error-copy.test.ts`, `catalogs.test.ts`, `no-network-surface.test.ts` | byte-identical fixtures, copy completeness, no network surface |

### 4.2 Acceptance criteria (spec §12) → where each is checked

| §12 criterion | Checked by |
|---|---|
| Verbs behave per §5, every code in §6 | `item-curation.test.ts` + the three use-case tests |
| One bump per change; zero per rejection/no-op | use-case tests via `lastSeen().generation` |
| `updatedAt = now`; edit keeps id/createdAt/source/pinned | `item-curation.test.ts` (edit) + `edit-item.use-case.test.ts` |
| Imported: archive/unarchive ok; pin/edit → `ITEM_NOT_CURATABLE` | `set-item-archived`, `set-item-pinned`, `edit-item` tests |
| Re-import doesn't un-archive | `import-items.use-case.test.ts` |
| No use case calls another; `archive()` gone | code review of `services/item-curation-steps.ts` + Slice 8 step 4 |
| `show` prints full ids; `--archived` marks | `render.test.ts` + `curation-commands.test.ts` |
| Full id or ≥6 prefix; ambiguous/unknown codes | `values.test.ts` + `set-item-pinned` test + CLI test |
| `edit` file/stdin, tags replace, type among five, no flags → code, no editor/temp | `edit-item` test + CLI test + Slice 8 step 6 |
| After edit, search finds new not old | `item-repo.test.ts` + `edit-item` test + CLI test |
| 5 tools; only `supersedes` added | `server.test.ts` exact key-set assertion |
| Supersede atomic; response names both ids | `save-context` test + `server.test.ts` |
| Bad target fails whole call; nothing saved | `save-context` rejection matrix (item count unchanged, zero bumps) |
| Search lines include id; `get_context` unchanged | `server.test.ts` + `vault-format-conformance` unmodified |
| No MCP response contains an archived item | `server.test.ts` "archived never surfaced" |
| Cards offer Pin/Unpin/Archive; Show archived; reload | `project.dom.test.tsx` cases 1–4 |
| Channels in CHANNELS/SCHEMAS/ChannelMap/bridge; handlers call use cases | `register-handlers.test.ts`, `schemas.test.ts`, typecheck (`satisfies Record<Channel, …>`), curation handler grep test |
| Copy in `en.ts` + `es.ts` | `error-copy.test.ts`, `catalogs.test.ts`, `Catalog` typecheck |
| Show archived not persisted | `project.dom.test.tsx` case 6 |
| No migration; schema v3 | Slice 8 steps 2–3 |
| Fixtures byte-identical | conformance/export/golden-fixture tests unmodified + Slice 8 step 2 |
| Docs updated | per-slice "Docs in this commit" + review |
| Loops green root + desktop | §4.3, every slice |

### 4.3 Verification loop

```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
# targeted, end of Slices 6–7:
cd /home/user/valija/desktop && npx vitest run src/main/infra/no-network-surface.test.ts src/shared/i18n
```

The root `typecheck`/`test` commands do not cover `desktop/`, so both loops must run every time.

---

## 5. Assumptions (each one a place the plan could be wrong)

- **A1.** `better-sqlite3`'s `LIKE` keeps SQLite's default ASCII case-insensitivity under SQLCipher
  (`PRAGMA case_sensitive_like` is not set anywhere; checked `sqlite.ts`). If that is wrong, the
  lower-case-prefix test fails in Slice 2, and the fix is `UPPER(i.id) LIKE UPPER(@prefix) || '%'`.
- **A2.** Lookups are a read, then a separate write in the same session (P-2). A second process (the
  MCP server) writing **the same item** in the microseconds between the two could lose its update.
  This is accepted as negligible for a single-user vault.
- **A3.** `ContextItem.id` stays `string`. `ItemId`/`ItemReference` brand **inputs** only. Branding
  the entity field would ripple through `createContextItem`, `importedItemId`, the golden-vault
  loader and every test helper, for no rule gained.
- **A4.** `readFileSync(0, "utf8")` reads piped stdin on Linux, macOS and Windows under Node 22. On
  an interactive TTY it waits for EOF (Ctrl-D/Ctrl-Z). README documents this as "pipe content in".
- **A5.** The stdin branch is not unit-tested (no subprocess tests exist in `src/delivery/cli`). It is
  one line and is verified in review and by hand.
- **A6.** "Docs in the same commit" (spec §12) is satisfied per slice: each slice's commit carries the
  docs for what it changed. If Oscar wants one squashed commit at ship time, `git-ops`' `--no-ff`
  merge already groups them.
- **A7.** No other `ContextItemRepository` implementation exists (searched the repo: only
  `SqliteContextItemRepository`), so changing the port breaks nothing else.
- **A8.** `ITEM_ID_AMBIGUOUS` lists at most 5 candidates. A prefix that matches hundreds of items
  (e.g. `imp-`) costs one `LIMIT 6` query, never a full scan into memory.

---

## 6. Decisions to confirm

All D-A … D-P stand as settled. These are the planning-level calls the spec left open.

**P-1. CLI verbs in a new `cli/curation-commands.ts`** *(recommended)*, versus extending
`content-commands.ts`.
*Why:* `content-commands.ts` holds read views, and these are writes. The new file is about 105 lines,
and the existing one stays small. *Trade-off:* one more file in `cli/`.

**P-2. Decide outside the write, persist inside it** *(recommended)*. Lookup and the domain
transition run in the session, and only a real change enters `session.write`.
*Why:* this is the only way a no-op makes zero bumps (D-L) without a "no change" sentinel in
`commitWrite`. *Trade-off:* a microsecond read→write gap across processes (A2). The alternative,
re-reading inside the write, closes the gap but duplicates the transition call and can still bump on
a race.

**P-3. Prefix matching is case-insensitive** *(recommended)*. Exact-id matching stays
case-sensitive.
*Why:* people type ULID prefixes in lower case, and it costs nothing. *Trade-off:* in theory, two
ids differing only in case could make a prefix ambiguous. No real id shape allows that.

**P-4. D-H mechanism: `ImportItems` reads the existing row by id and re-applies `archived`**
*(recommended)*, versus a repo-level `ON CONFLICT … archived = context_items.archived` for imported
rows.
*Why:* it keeps one write path (`save`) and puts the rule in application code, where it is testable.
*Trade-off:* one primary-key read per imported chunk (≈ 300 for a large import, sub-millisecond each).

**P-5. Rejections are checked before no-ops.** Pinning an archived item that is still pinned returns
`ITEM_ARCHIVED`, not "already pinned".
*Why:* the honest message is "this is hidden; unarchive first". *Trade-off:* a repeat pin on such an
item errors instead of passing silently.

**P-6. Curation use cases accept a reference (full id or prefix ≥ 6) from every caller**
*(recommended)*. Only `supersedes` is exact-only.
*Why:* this needs no `exact` flag, and the desktop always sends full ids, which match exactly first.
*Trade-off:* a tampered renderer could act on a prefix. That is the same user and the same vault, so
nothing is gained.

**P-7. No `--content <text>` flag on `valija edit`** *(recommended)*.
*Why:* inline content lands in shell history, which is plaintext outside the vault (§10.4). Stdin
covers the use case (`echo … | valija edit <id> --content-file -`). *Trade-off:* one-word typo fixes
need a pipe.

**P-8. `--tags ""` clears every tag** *(recommended)*, versus refusing an empty list.
*Why:* "replace" naturally includes "replace with nothing", and there is no other way to remove the
last tag. *Trade-off:* an accidental empty value erases tags (visible in the output line, and
reversible by re-tagging).

**P-9. A new port type `ItemWithProject`, leaving `SearchResult` untouched** *(recommended)*, versus
reusing `SearchResult` for lookups.
*Why:* a lookup result named "SearchResult" misleads, and renaming `SearchResult` would touch
unrelated code. *Trade-off:* two structurally identical interfaces.

**P-10. On the desktop, archived cards render in their own "Archived" section at the bottom**
*(recommended)*, versus interleaving them by date.
*Why:* it keeps the Pinned section truthful (a pinned and archived item is not "pinned" in any
useful sense, D-O), and the hidden set is easy to scan. *Trade-off:* the order differs from
`valija show --archived`, which is flat. That is consistent with the existing pinned divergence that
`docs/gui.md` documents.

---

## 7. Naming, placement, and ubiquitous language

**Placement** (`CLAUDE.md` "no bare files at a layer's root"):

| New file | Folder kind | Precedent |
|---|---|---|
| `context/domain/values/item-id.ts` | `values/` | `project-name.ts`, `tag.ts` |
| `context/domain/services/item-curation.ts` | `services/` (pure domain rules over an entity) | `vault/domain/services/vault-relocation.ts`, `context-pack.ts` |
| `context/application/services/item-curation-steps.ts` | **new `services/` subfolder** in `context/application` (stateless helpers shared by use cases; neither port nor `UseCase`) | `vault/application/services/resolve-unlock-key.ts` |
| `context/application/dto/item-curation-output.ts` | `dto/` | `context-item-view.ts` |
| `context/application/use-cases/{set-item-pinned,set-item-archived,edit-item}.use-case.ts` | `use-cases/` | every use case |
| `delivery/cli/curation-commands.ts` | `cli/` (delivery is not a DDD module) | `content-commands.ts`, `import-command.ts` |
| `desktop/src/renderer/state/item-actions.ts` | renderer `state/` (pure view logic) | `pinned-partition.ts` |
| `desktop/src/main/ipc/handlers/content-handlers.curation.test.ts` | beside its subject | `content-handlers.session-safety.test.ts` |

Existing deviation, left alone: `context/infra/item-repo.ts` sits at the `infra/` root under a
non-tech file name (F9). Renaming it to `sqlite-context-item-repository.ts` belongs in its own
cleanup advance, not here.

**Names**

| Name | Verdict |
|---|---|
| `SetItemPinned` / `SetItemArchived` / `EditItem` | D-M's names. Bare class names per repo convention (F2), not `…UseCase` |
| `parseItemId` / `parseItemReference` → `ItemId` / `ItemReference` | `parseX → Result`, branded. "Reference" names what a user hands the CLI (id or prefix) without inventing "short id" |
| `setPinned` / `setArchived` / `applyEdit` / `archiveSuperseded` | Domain verbs on an item, each reads as a phrase at the call site (`setPinned(found.item, true, now)`). Distinct from the use-case classes by case and by layer. `applyEdit` avoids colliding with `EditItem` |
| `CurationOutcome` / `EditOutcome` / `EditableField` / `ItemEdit` | Domain result shapes. "Outcome" avoids clashing with `Result` |
| `findItemByReference` / `saveIfChanged` | Each says exactly what it does, and the second encodes D-L in its name |
| `ItemWithProject` | Plain description of the lookup result (P-9) |
| `ItemCurationOutput` / `EditItemOutput` | Matches `SaveContextOutput`, `ImportItemsOutput` |
| `supersedes` / `supersededItemId` | The spec's own word, used verbatim on MCP and in the use case |
| `content:setPinned` / `content:setArchived`; `ContentSetPinnedRequest` … `ContentCurationResponse` | `area:verb` channels; `Content…Request/Response` like their neighbours |
| `itemActionsFor` / `performItemAction` / `ItemAction` | Renderer vocabulary that mirrors the domain verbs |
| catalog `project.pin`, `project.archive`, … | Namespaced by screen, like `project.showMore` |

**Ubiquitous language.** The plan uses the spec's own nouns and verbs: *pin, unpin, archive,
unarchive, edit, supersede*, plus *item*, *project* and *pinned/archived*. It deliberately does not
use *delete*, *remove* or *hide-forever*, and no user-facing string says "deleted" (§10.8). *Curation*
names the capability (file names and section titles). It never appears as a verb in UI copy.

---

## 8. Estimated line count and risks

### Production lines

| Area | Lines |
|---|---|
| `src/context/domain` (item-id, item-curation, errors) | ~132 |
| `src/context/application` (services, dto, 3 use cases, show, view, save, import) | ~277 |
| `src/context/infra/item-repo.ts` | ~+26 net |
| `src/delivery` (container, server, cli ×4 files) | ~194 |
| `desktop/src/main` + `shared/ipc` + `preload` + `bridge` | ~54 |
| `desktop/src/renderer` (item-actions, item-card, project, css) | ~145 |
| `desktop/src/shared/i18n/catalogs` (en + es: 12 error lines + 20 project lines) | ~32 |
| **Total production** | **~860–880** |

Tests come to about 950 lines. Docs come to about 120 lines across SPEC, specs ×3, README, gui.md
and CHANGELOG.

### Risks

1. **Model-driven retirement of human context** (spec §14). All of its mitigations are in Slice 4 and
   are asserted by tests, not just documented: exact single id, same project, refusal of pinned and
   imported targets, archive-only, atomic failure, an echoed id, and `show --archived` for audit.
2. **The `desktop/` loop breaking in Slice 1** if the error copy is forgotten (F1). It is named in the
   slice and is mechanical to fix.
3. **A lost update across processes** (A2/P-2). It is rare, single-user and recoverable. It is
   documented, not engineered away.
4. **`project.tsx` growth.** The screen goes from about 150 to about 190 lines. The action→channel
   mapping and availability rules live in `item-actions.ts` to keep it a composition. If it still
   reads heavy at review, the toolbar can become a `ProjectToolbar` component in the same folder
   with no behaviour change.
5. **Prefix UX.** Same-second ULIDs often share 8+ characters (spec D-I note), so users will meet
   `ITEM_ID_AMBIGUOUS`. The message lists the full candidates, so recovery is one copy-paste.
6. **Doc drift.** Seven doc files across four slices. Each slice lists its own, and Slice 8 step 7
   walks them.

---

## 9. Repo structure after execution

Legend: `+` new · `~` changed · `−` removed member · unmarked = unchanged context.

```
valija/
├── advances/CURATION/
│   ├── refined.md                                   (unchanged — Gate R approved)
│   └── plan.md                                      + THIS FILE
├── CHANGELOG.md                                     ~ Added (curation, supersedes, desktop) + Changed (re-import keeps archived)
├── README.md                                        ~ Everyday use (5 verbs, curating paragraph); MCP surface (supersedes)
├── docs/
│   ├── SPEC.md                                      ~ §5 use cases · §7 save_context args · §8 CLI
│   ├── gui.md                                       ~ "Browsing…" paragraph; "does not do" bullet rewritten
│   └── vault-format.md                              (unchanged — D-F a / D-G 1)
├── specs/
│   ├── context.md                                   ~ errors, values, services, ports, dto, use cases, ImportItems
│   ├── delivery.md                                  ~ cli table, mcp section
│   └── desktop.md                                   ~ 31 channels, content:* row, item-actions, project screen
├── src/
│   ├── context/
│   │   ├── domain/
│   │   │   ├── errors.ts                            ~ +6 codes
│   │   │   ├── values/
│   │   │   │   ├── item-id.ts                       + parseItemId, parseItemReference
│   │   │   │   └── values.test.ts                   ~ + id/reference cases
│   │   │   ├── entities/context-item.ts             (unchanged)
│   │   │   └── services/
│   │   │       ├── context-pack.ts                  (unchanged — pack algorithm untouched)
│   │   │       ├── item-curation.ts                 + setPinned, setArchived, applyEdit, archiveSuperseded
│   │   │       └── item-curation.test.ts            +
│   │   ├── application/
│   │   │   ├── ports/repositories.ts                ~ + ItemWithProject, findById, findByIdPrefix; − archive
│   │   │   ├── services/                            + NEW SUBFOLDER
│   │   │   │   └── item-curation-steps.ts           + findItemByReference, saveIfChanged
│   │   │   ├── dto/
│   │   │   │   ├── context-item-view.ts             ~ + archived? (present only when true)
│   │   │   │   └── item-curation-output.ts          + ItemCurationOutput, EditItemOutput
│   │   │   └── use-cases/
│   │   │       ├── set-item-pinned.use-case.ts      + SetItemPinned
│   │   │       ├── set-item-pinned.use-case.test.ts +
│   │   │       ├── set-item-archived.use-case.ts    + SetItemArchived
│   │   │       ├── set-item-archived.use-case.test.ts +
│   │   │       ├── edit-item.use-case.ts            + EditItem
│   │   │       ├── edit-item.use-case.test.ts       +
│   │   │       ├── save-context.use-case.ts         ~ + supersedes (atomic)
│   │   │       ├── save-context.use-case.test.ts    ~ + supersede matrix
│   │   │       ├── show-project.use-case.ts         ~ + includeArchived
│   │   │       ├── show-project.use-case.test.ts    ~
│   │   │       ├── import-items.use-case.ts         ~ re-import keeps archived (D-H)
│   │   │       └── import-items.use-case.test.ts    ~
│   │   └── infra/
│   │       ├── item-repo.ts                         ~ + findById, findByIdPrefix; − archive
│   │       └── item-repo.test.ts                    ~ lookups, FTS-after-edit; archive test rewritten
│   ├── delivery/
│   │   ├── container.ts                             ~ + setItemPinned, setItemArchived, editItem
│   │   ├── context-pack-markdown.ts                 (unchanged)
│   │   ├── cli/
│   │   │   ├── program.ts                           ~ + pin/unpin/archive/unarchive/edit; show --archived
│   │   │   ├── content-commands.ts                  ~ show: ids via itemHeaderLine, includeArchived
│   │   │   ├── curation-commands.ts                 + 5 thin command adapters
│   │   │   ├── curation-commands.test.ts            +
│   │   │   ├── render.ts                            ~ + itemHeaderLine
│   │   │   └── render.test.ts                       ~
│   │   └── mcp/
│   │       ├── server.ts                            ~ + supersedes arg/descriptions; ids in search lines
│   │       └── server.test.ts                       ~ container fields; supersede, schema keys, archived-never-surfaced
│   ├── shared/infra/migrations/                     (unchanged — schema stays v3)
│   └── testing/__fixtures__/golden-vault/           (unchanged — byte-identical)
└── desktop/src/
    ├── shared/
    │   ├── ipc/
    │   │   ├── messages.ts                          ~ + ContentSetPinnedRequest, ContentSetArchivedRequest,
    │   │   │                                          ContentCurationResponse; includeArchived?, archived?
    │   │   └── channels.ts                          ~ + content:setPinned, content:setArchived (29 → 31)
    │   └── i18n/catalogs/
    │       ├── en.ts                                ~ + 6 errors.*, + 10 project.*
    │       └── es.ts                                ~ + 6 errors.*, + 10 project.*
    ├── main/ipc/
    │   ├── schemas.ts                               ~ + 2 schemas; content:show includeArchived
    │   ├── schemas.test.ts                          ~
    │   └── handlers/
    │       ├── content-handlers.ts                  ~ + 2 handlers (use cases only)
    │       ├── content-handlers.curation.test.ts    +
    │       └── content-handlers.session-safety.test.ts ~ + 2 writes in sequence
    ├── preload/index.ts                             ~ + content.setPinned, content.setArchived
    └── renderer/
        ├── state/
        │   ├── bridge.ts                            ~ + 2 members
        │   ├── item-actions.ts                      + itemActionsFor, performItemAction
        │   └── item-actions.test.ts                 +
        ├── components/item-card.tsx                 ~ + archived, actions, onAction, busy; action row
        ├── screens/
        │   ├── project.tsx                          ~ Show archived toggle, reload token, notice + Undo, Archived section
        │   └── __dom-tests__/project.dom.test.tsx   ~ + 7 curation cases
        └── styles/screens.css                       ~ + .item-actions/.item-action/.item-row.archived/.item-archived
```

**Net: 15 new files (8 production, 7 test), about 33 changed files (including 8 docs), 1 new
subfolder (`context/application/services/`), 0 deletions of files, 1 removed port method
(`archive`), 0 migrations, 0 dependencies.**
