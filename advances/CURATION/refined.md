# CURATION — Pin, archive, edit and supersede saved context · Refined Spec

**Status:** Gate R approved by Oscar, 2026-10-17. All 16 decisions in §9 (D-A … D-P) were resolved
to their recommended defaults; treat those defaults as settled.

**Directory:** `CURATION`, a feature advance with no milestone number (same posture as `GUI`/`CARDS`).
**Source:** Oscar's raw idea (agreed in chat), checked against the code on 2026-10-16.
**Inherits from:** `docs/SPEC.md` §5/§7/§9/§10/§10a/§10b, `advances/GUI/refined.md` D-A/D-B/D-C/§5.2
(the curation questions that advance deferred to this one), `advances/CARDS/refined.md`,
`docs/vault-format.md` §6–§12/§14, `specs/context.md`.
**Touches:** `src/context/**` (domain, application, infra), `src/delivery/**` (CLI, MCP),
`desktop/src/**` (IPC + project screen), docs. Under the defaults it adds **no** migration, **no**
new MCP tool, and **no** change to pack rendering.

---

## 1. Goal

**Make saved context curatable, so a project's context pack stays accurate. A user (CLI or desktop)
can pin, unpin, archive, unarchive and edit an item. An AI tool can retire an outdated item in the
same `save_context` call that replaces it. None of this weakens encryption, the five-tool MCP
surface, or the vault-format contract.**

Three phrases carry the scope:

- **"Pack stays accurate."** That is the success test. Every verb exists either to keep stale
  `progress` and reversed `decision`s *out* of the pack, or to keep important items reliably
  *in* it (pin).
- **"Reversible by default."** Archive is a soft removal: it can be undone, and the data is not
  lost. Anything an AI can trigger must be reversible. Hard delete is deferred (D-C).
- **"No new tool."** MCP gets one optional argument on `save_context` (`supersedes`). It gets no
  new tool, no pin/archive/edit tools, and no change to `get_context` output (D-E, D-F).

---

## 2. User walkthrough

### 2.1 Human curation from the CLI

Oscar's `valija` pack still shows "next step: wire the restore flow" from three weeks ago, plus a
decision to use WAL that was reversed in M3.

```
$ valija show valija --type decision
— decision · 2026-07-20  id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6  [storage]
We use WAL journaling for performance.
— decision · 2026-07-23  id 01J3V2K9P0R4S6T8W1Y3Z5A7B9  📌  [sync]
Rollback journal (DELETE), never WAL, so a synced folder only sees one file.

$ valija archive 01J3Q8Z6
Archived decision 01J3Q8Z6M4X5Y7T9B2C1D0E8F6 in project "valija". Undo: valija unarchive 01J3Q8Z6M4X5Y7T9B2C1D0E8F6

$ valija pin 01J3V2K9
Pinned decision 01J3V2K9P0R4S6T8W1Y3Z5A7B9 in project "valija".

$ valija pin 01J3V2K9
Already pinned — nothing changed.

$ echo "Restore flow shipped in 0.3.2; next: idle auto-lock docs." | valija edit 01J4AA… --content-file -
Updated progress 01J4AA… in project "valija" (content).

$ valija show valija --archived
… every item, archived ones marked [archived] …
```

| # | Action | What the user sees | Effect on data |
|---|---|---|---|
| 1 | `valija show <project>` | Every item line now carries its **full id** | none (read) |
| 2 | `valija archive <id-or-prefix>` | One confirmation line, with the undo command | `archived = 1`, `updatedAt = now`, one lineage bump |
| 3 | `valija pin <id>` / `unpin` | One line. A repeat says "already pinned — nothing changed" | `pinned` toggled. A no-op performs **no write** (D-L) |
| 4 | `valija edit <id> [--content-file f\|-] [--tags a,b] [--type t]` | One line listing which fields changed | in place, `createdAt` kept, `updatedAt = now`, FTS reindexed (D-B) |
| 5 | `valija unarchive <id>` | One line | `archived = 0`. Pinned state and content are exactly as before archiving (D-O) |
| 6 | `valija show <project> --archived` | Archived items included and marked | none (read) |

### 2.2 An AI tool retiring an outdated item (MCP)

In Claude Code, Oscar says "we're reversing the WAL decision, save that". The model:

1. calls `search_context { query: "WAL journaling decision", project: "valija" }`. Each result line
   now includes the item's id (D-F), e.g.
   `- [valija] (decision, 2026-07-20, id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6) We use WAL journaling…`
2. calls `save_context { project: "valija", type: "decision", content: "…DELETE journal…",
   supersedes: "01J3Q8Z6M4X5Y7T9B2C1D0E8F6" }`
3. gets back: `Saved decision to project "valija". Item id: 01J…NEW. Archived superseded item
   01J3Q8Z6M4X5Y7T9B2C1D0E8F6.`

If the id is wrong, belongs to another project, is pinned, is imported or is already archived, the
**whole call fails and nothing is saved** (D-E). The model sees a coded error and can retry without
`supersedes`.

### 2.3 Desktop app

On a project's screen, each card gains a small action row: **Pin/Unpin** and **Archive**. A
toolbar toggle **Show archived** adds archived cards, visibly marked, each with **Unarchive**. The
list reloads after every action. Edit is deferred under the default (D-K).

### 2.4 Where curated data shows up afterwards

| Surface | Pinned | Archived | Edited | Superseded |
|---|---|---|---|---|
| `get_context` / `valija export` / desktop pack preview | top section, per existing algorithm | **excluded** | new text, same position (createdAt kept) | old one excluded, new one included |
| `search_context` / `valija search` / desktop search | normal | **excluded** (unchanged rule) | matches new text only (FTS reindexed) | old one not found |
| `valija show` / desktop project screen | marked | hidden unless `--archived` / "Show archived" | new text | old one visible only with `--archived` |
| `list_projects` / `valija projects` counts | counted | not counted (unchanged) | counted; last activity moves | — |
| MCP tool output, any tool | — | **never surfaced**, by design | — | — |

The pack *format* does not change. Only the data feeding it changes. That is why the golden
fixture stays byte-identical under the defaults (§8).

---

## 3. Context snapshot (verified facts the planner builds on)

1. `ContextItemRepository.archive(itemId)` exists (`item-repo.ts:121`) and nothing calls it. It
   does not touch `updated_at`, and it is unscoped by project.
2. `ContextItem.pinned` is honoured by `assembleContextPack` (`addPinned`). `SaveContextInput` already
   accepts `pinned?`, but no surface passes it: MCP `save_context` omits it, and no CLI path writes.
3. `SqliteContextItemRepository.save` is an **upsert**. `ON CONFLICT(id)` overwrites `type, content,
   tags, pinned, source, archived, updated_at`, and keeps `created_at`.
4. **Re-import resurrects.** `ImportItems` builds imported items with `archived: false` under
   deterministic ids. Re-importing the same export therefore resets `archived = 0` on any imported
   item the user archived, and overwrites any edit. See D-H.
5. **Imported items are kept out of packs only by construction.** They are never pinned
   (`createImportedContextItem`, vault-format §8), and `addPinned` does not filter by type. Pinning an
   imported item would put it straight into every pack.
6. FTS stays correct through the `items_au` trigger on **any** `UPDATE` (content, tags, pin, archive).
   No manual reindex is needed.
7. `VaultSession.write(mutate)` commits the mutation and one lineage bump atomically. A mutation
   that returns an `err` rolls the transaction back, bump included (`vault-sessions.ts` `commitWrite`).
8. **Ids today:** MCP `save_context`/`save_handoff` responses already say `Item id: <id>`.
   `get_context` (pack markdown) and `search_context` lines show **no ids**. `valija show` shows no
   ids. `valija export --json` and the desktop `ContextItemMessage` already carry `id`.
9. Three id shapes exist: ULIDs (26 chars, Crockford base32), `imp-<32 hex>` (imported), and
   fixture ids like `item-a01` (golden vault). An id parser cannot be ULID-only.
10. `ContextItemView` has no `archived` and no `updatedAt`. `expected-search.json` byte-compares
    serialized views, so adding an always-present field to the view changes that fixture.
11. `ITEM_NOT_FOUND` is already declared in `ContextErrorCode` and is unused.
12. Schema is v3 (`LATEST_SCHEMA_VERSION = 3`). vault-format §11 requires a reader to **refuse**
    any newer `schema_version`, so a migration 004 would make the MOBILE PoC reader refuse the
    vault until it is updated.
13. The desktop app's documented boundary is **"no curation"** (`docs/gui.md` "What this app
    deliberately does not do"; GUI D-A). This advance reverses it on purpose and must rewrite that
    copy. IPC is a closed, enumerated set (`channels.ts`, asserted by `register-handlers.test.ts`),
    validated by zod (`schemas.ts`).
14. The desktop project screen already groups pinned items above the rest (`partitionPinnedItems`),
    unlike `valija show`'s flat order.
15. No `PRAGMA secure_delete` is set anywhere (`sqlite.ts`). Only D-C cares about this.

---

## 4. Scope

### In
- Domain: item curation transitions (pin, unpin, archive, unarchive, edit) with their invariants;
  an `ItemId` value; new error codes (§6).
- Application: curation use cases (D-M), `SaveContext` gains optional `supersedes`, and
  `ShowProject` gains `includeArchived`.
- Infra: lookup by id and by id prefix, and writes that go through `session.write`. Import keeps the
  archived state (D-H).
- CLI: `pin`, `unpin`, `archive`, `unarchive`, `edit`. `show` prints ids and gains `--archived`.
- MCP: an optional `supersedes` argument on `save_context`, plus an updated description. Ids in
  `search_context` result lines.
- Desktop: pin/unpin/archive/unarchive on project cards, a "Show archived" toggle, new IPC channels,
  error copy and strings in both catalogs.
- Docs in the same commit: `docs/SPEC.md` (§5 use cases, §7 tool args, §8 CLI), `specs/context.md`,
  `specs/delivery.md`, `specs/desktop.md`, `README.md` (Everyday use, MCP surface), `docs/gui.md`
  (rewrite the "no curation" boundary), `CHANGELOG.md`. Touch `docs/vault-format.md` only if D-F
  or D-G move off their defaults.

### Out (deferred on purpose)
- **Hard delete** from any surface (D-C).
- **Desktop edit** (D-K default). The CLI has edit; the desktop gets it in a follow-up.
- Edit history/versions, undo stacks, bulk or multi-select curation, curation from the search
  screen.
- Promoting `imported` items to a saveable type, and pinning or editing imported items (D-H).
- Project rename/merge/delete, moving items between projects.
- New MCP tools; `pinned` or `archive` arguments on any MCP tool (D-N); ids in `get_context`
  output (D-F default).
- `$EDITOR` integration for `valija edit` (D-J).
- A pin cap or any change to pack assembly or rendering.

---

## 5. Behaviour per operation

Every mutating operation runs in **one** `withSession` → `session.write(...)`, so it makes exactly
one lineage bump. A rejected operation makes no bump and writes nothing. A no-op makes no bump (D-L).

| Op | Target must be | Effect | Already in target state | Rejected when |
|---|---|---|---|---|
| **pin** | existing, not archived, not `imported` | `pinned = true`, `updatedAt = now` | ok, `changed: false`, no write | archived → `ITEM_ARCHIVED`; imported → `ITEM_NOT_CURATABLE` |
| **unpin** | existing | `pinned = false`, `updatedAt = now` | ok, no write | — |
| **archive** | existing (any type, imported included) | `archived = true`, `updatedAt = now`; `pinned` **preserved** (D-O) | ok, no write | — |
| **unarchive** | existing | `archived = false`, `updatedAt = now` | ok, no write | — |
| **edit** | existing, not archived, not `imported` | any of `content` / `tags` (replace) / `type` (saveable five only), in place; `createdAt`, `id`, `source`, `pinned` kept | no field differs → ok, no write | no field given → `NOTHING_TO_EDIT`; invalid value → existing codes; archived → `ITEM_ARCHIVED`; imported → `ITEM_NOT_CURATABLE` |
| **save + supersedes** | same project, not archived, not pinned, not imported | new item saved **and** old item archived, atomically | — | any target check fails → whole call fails, nothing saved (D-E) |

**Per surface:**
- **CLI:** each verb takes `<id>`, a full id or a unique prefix (D-I). On success it prints one
  line naming the type, the full id and the project. Errors go through the existing `fail()`
  (`error [CODE]: message`, exit 1). `show` prints the full id on every item header and accepts
  `--archived`.
- **MCP:** only `save_context.supersedes` (an exact full id, no prefix). The response appends
  `Archived superseded item <id>.`. Errors use the existing `message [CODE]` shape. `search_context`
  lines include `id <id>`.
- **Desktop:** two write channels plus the `includeArchived` read flag (D-K). The renderer passes
  full ids and never prefixes. Every new error code needs copy in `error-copy.ts`, in both
  languages.

---

## 6. Error codes (context module)

| Code | New? | When |
|---|---|---|
| `ITEM_NOT_FOUND` | existing, first use | No item with that id. For `supersedes`, also when the id exists **in another project**: the message says "No item <id> in project <p>", so no cross-project existence is leaked |
| `INVALID_ITEM_ID` | new | Empty, more than 64 chars, or not `[A-Za-z0-9-]`; a prefix shorter than the minimum (D-I) |
| `ITEM_ID_AMBIGUOUS` | new | A CLI prefix matches more than one item. The message lists the candidates' full ids |
| `ITEM_ARCHIVED` | new | pin / edit / supersede on an archived item. The message says to unarchive first |
| `ITEM_PINNED` | new | `supersedes` targets a pinned item (D-P). The message says to unpin first |
| `ITEM_NOT_CURATABLE` | new | pin / edit / supersede on an `imported` item (D-H) |
| `NOTHING_TO_EDIT` | new | `edit` with no field flags |
| `INVALID_ITEM_TYPE`, `INVALID_TAG`, `TOO_MANY_TAGS`, `CONTENT_EMPTY`, `CONTENT_TOO_LARGE` | existing | edit / supersede field validation, parsed **before** a session opens |
| `VAULT_LOCKED` etc. | existing (vault) | unchanged |

---

## 7. Schema / migration impact

**Default: none.** `pinned`, `archived` and `updated_at` already exist. FTS triggers already reindex
on update. Schema stays v3. vault-format §6 is unchanged, no ciphertext backup runs, and the MOBILE
PoC reader keeps opening the vault. The alternative, a `superseded_by` column, is D-G.

---

## 8. Impact on pack output and the golden fixture

Under the defaults:
- `renderContextPackMarkdown` and `assembleContextPack` are **unchanged**.
  `expected-pack.md`/`expected-export.md` stay byte-identical.
- `ContextItemView` gains `archived` **only as an optional field present when true**, the same way
  `source` already works. Search never returns archived items, and export excludes them. So
  `expected-search.json` and `valija export --json` output stay byte-identical. The field appears
  only in `show --archived` / desktop "Show archived" results.
- MCP `search_context` line text changes (adds the id). This is MCP presentation, not part of
  vault-format §10. The fixture compares views, not MCP text.
- If D-F option (b)/(c) or D-G option 2 is chosen instead, vault-format §14 change control applies:
  regenerate the fixture, update the doc, land both in one commit.

---

## 9. Open decisions (options, trade-offs, recommended defaults)

### D-A. Verb set for this advance
1. pin/unpin + archive/unarchive only (GUI D-B option 1).
2. **Option 1 + edit (content/tags/type) + MCP supersede.**
3. Option 2 + hard delete.

**Default: 2.** Supersede is the verb that fixes reversed decisions at the moment they happen. Edit
fixes stale `progress` without growing the item count. Delete is a separate risk class (D-C).

### D-B. Edit semantics
1. **In place.** Same id, `createdAt` kept, `updatedAt = now`, FTS reindexed by trigger.
2. Edit as a new version: a new item with `createdAt = now` plus archiving the old one (a human
   supersede).

**Default: 1.** Typo fixes should not reorder the pack or change ids that other notes or the user
may reference. *Trade-off:* the previous text is gone with no undo. Users who want history can
supersede instead: save a new item with `supersedes`, or archive and re-save. *Consequence to
accept:* an edited old `progress` item keeps its old position in the newest-first order.

### D-C. Hard delete
1. **Defer.** Archive only.
2. CLI-only `valija delete <id>` with interactive confirmation. The delete runs with
   `PRAGMA secure_delete = ON` and `updatedAt` is irrelevant.
3. Delete everywhere, including desktop.

**Default: 1.** Archive fully solves pack accuracy, and every curation verb stays reversible.
Delete also cannot be as complete as it sounds. Free pages are already ciphertext without the key,
but older copies of `vault.db` persist in the sync client's version history, in Time Machine, and
in any `.pre-00N.bak`. A "delete" that cannot reach those copies over-promises. *Strongest
counter-argument:* a model accidentally saved a secret. Archive keeps it out of every pack and
search, which covers the exposure path to AI providers. Option 2 is the right follow-up if Oscar
wants at-rest erasure, and it needs honest copy about the backups it cannot reach.

### D-D. Archived visibility
1. **CLI `show --archived` and desktop "Show archived" include archived items, marked. Search
   stays archive-free on every surface. MCP never sees archived items.**
2. Also add `valija search --archived`.
3. No way to list archived items (unarchive only by remembered id).

**Default: 1.** Unarchive needs a way to find the id. Keeping search unchanged preserves the
`archived-excluded` fixture case and vault-format §10. *Trade-off:* the user cannot full-text
search inside archived items. Option 2 can follow cheaply.

### D-E. `supersedes` shape and failure mode
- Arity: **a single id (default)** or an array of up to N ids. A single id bounds what one model
  call can retire to one item. That limit is the main protection against injection (§10).
- Target rules: **same project, exists, not archived, not pinned (D-P), not imported (default).**
- Failure: **atomic, so the whole call fails and nothing is saved (default)**, versus saving anyway
  and reporting "supersede skipped".
- Tools: **`save_context` only (default).** `save_handoff` does not need it, because the pack
  already shows only the latest handoff.

*Trade-off of atomic failure:* a bad id costs the model a retry. In return, the outcome is always
exactly what the call asked for, and the user is never left with both versions live.

### D-F. How the model learns item ids
- a. **Ids in `search_context` result lines** (plus the existing save responses). This changes no
  fixture or contract. The `supersedes` description tells the model to find the id with
  `search_context` first.
- b. Ids in every pack item heading (`### decision · 2026-07-20 · id …`). The model can supersede
  straight from the pack. Costs about 7 tokens per item, changes vault-format §9 and both golden
  `.md` files, and changes `valija export` and the desktop preview for humans too.
- c. Ids only in MCP `get_context` output, through a render option, with export unchanged. This
  breaks the "one renderer, same pack" symmetry that `context-pack-export.ts` relies on, and
  vault-format §12's "render the pack" would then describe a different text than the one AI tools
  receive.

**Default: a.** It needs no contract change and no token cost on every load. *Trade-off:* one extra
tool call before a supersede. Revisit (b) if models in practice skip the search.

### D-G. Schema: record the supersede link?
1. **No migration.** Supersede = archive the old item.
2. Migration 004 adds `superseded_by TEXT NULL`, following the 002/003 pattern (transaction plus
   ciphertext backup on a populated vault). `show --archived` can then say "superseded by X".

**Default: 1.** Option 2 bumps the schema to v4. That forces fixture regeneration, a vault-format
§6 rewrite, and makes the MOBILE PoC reader refuse the vault (§11), all for provenance that is
nice to have. *Trade-off:* after the fact you cannot tell "archived by hand" from "superseded".

### D-H. Imported items
- Curation allowed: **archive/unarchive only (default)**. No pin, because that would put them into
  packs and break vault-format §8's construction guarantee. No edit or type change, because a
  re-import would overwrite it and promotion is its own feature.
- Re-import: **preserves `archived` (default)**, versus "re-import resurrects, documented". This
  changes M2 behaviour. *Reason:* a user who archived 300 noisy chunks should not lose that work by
  re-running the same import. The planner chooses the mechanism. It must not change how
  `SaveContext` or edit persist.

### D-I. Addressing items from the CLI
1. **Full id or unique prefix of at least 6 characters, vault-wide, no project argument.**
   Ambiguous → `ITEM_ID_AMBIGUOUS` with candidates.
2. Full id only.
3. Require `-p <project>` and accept per-project short indexes (e.g. `#3` from `show`).

**Default: 1.** It matches git-style ergonomics with no hidden state. Indexes shift as items are
added, which is dangerous for a destructive-ish verb. *Note:* ULIDs share their leading
time characters, so items saved in the same second often share an 8-char prefix. The ambiguity
error is a normal path, not an edge case. MCP and desktop always use exact full ids.

### D-J. CLI edit input
1. **Flags: `--content-file <path|->` (stdin), `--tags a,b` (replace), `--type <t>`.**
2. Open `$EDITOR` on a temp file.

**Default: 1.** Option 2 writes decrypted content to a plaintext temp file outside the vault and
hands it to an arbitrary process. That conflicts with §9 of SPEC's at-rest promise. Stdin lets a
user pipe from anywhere, knowingly. `--content <text>` inline is also possible, but it puts content
in shell history. Leave it out or document the risk; the planner decides.

### D-K. Desktop scope and IPC shape
- Scope: **pin/unpin, archive/unarchive, Show archived (default)**, versus also edit (a textarea, a
  tags input, validation copy in both catalogs; roughly doubles the UI work).
- Channels: **`content:setPinned {id, pinned}` and `content:setArchived {id, archived}`, plus
  `includeArchived?` on `content:show` (default)**, versus one channel per verb (4), versus a
  generic `content:curate {verb}`. The closed-set test must be updated deliberately.
- Confirmation: **none for pin/archive (default)**, because both are reversible from the same
  screen. The archive success state shows an Unarchive affordance.

**Amended 2026-10-17 (Oscar): desktop edit is IN scope.** `CLAUDE.md` now requires CLI/desktop
surface parity in every advance, so the "versus also edit" alternative is adopted: the desktop app
gets an Edit action (content, tags, type) through a third channel, `content:edit`, over the same
`EditItem` use case as `valija edit`. See plan.md Slice 9.

### D-L. No-ops, `updatedAt`, and lineage
- **A no-op (already pinned, etc.) reports `changed: false` and performs no `session.write`, so no
  lineage bump (default).** Spurious generation bumps make sync history noisier and can turn a
  harmless repeat on a second device into a reported fork.
- **Every real curation change sets `updatedAt = now` (default).** Consequence: `list_projects`
  "last activity" moves on curation as well as on saves. The alternative, leaving `updatedAt` alone
  for pin/archive, keeps "last activity" meaning "last save" but makes `updatedAt` untrustworthy.

### D-M. Application shape (DDD / hexagonal)
- Transitions live in the **domain** as total or `Result`-returning functions on `ContextItem`
  (e.g. pin → `Result<ContextItem>` with the imported/archived rules). `SaveContext` (for
  supersedes) and the curation use cases share the same rules **without calling each other**.
- Use cases: **`SetItemPinned`, `SetItemArchived`, `EditItem` (default, three classes)**, versus
  one per verb (five; more files, each trivial), versus one generic `UpdateItem` patch (rejected in
  GUI D-C: weakest invariants).
- Repository port: add id lookup (exact, and by prefix for the CLI) and persist through the
  existing upsert. **Remove or re-scope the unused `archive(itemId)` (default: remove)** so there is
  no second, unscoped, lineage-unaware write path.

### D-N. Pinning from MCP, and a pin cap
- **No `pinned` argument on any MCP tool (default).** A pin is the user's signal that something is
  most important. A model that pins liberally would push everything else out of the pack.
- **No pin cap (default).** Over-budget pins are already cut oldest-first by the pack algorithm. A
  cap is a product call that can be added later.

### D-O. Does archive clear `pinned`?
**Default: no, archive preserves it.** Archived items never reach the pack, so the flag is inert
while archived, and unarchive restores the exact prior state. *Alternative:* archive unpins, which
gives a cleaner archived list but makes unarchive lossy.

### D-P. Can `supersedes` retire a pinned item?
**Default: no (`ITEM_PINNED`).** A pin is a human signal, and a model write should not override it.
The model tells the user to unpin first. *Trade-off:* a reversed pinned decision needs one human
step. *Alternative:* allow it and say so loudly in the response.

---

## 10. Security surfaces (must not be weakened)

1. **All writes go through `VaultSessions.withSession` → `session.write`.** No repository write
   outside it, no direct DB handle in delivery or desktop, and a locked vault still yields
   `VAULT_LOCKED` for every new verb.
2. **MCP blast radius.** `supersedes` is a new way for model output to change existing data. A
   prompt-injected model (e.g. one reading hostile imported text) could retire user context. The
   mitigations are part of the spec: a single id, same project only, never pinned or imported, and
   archive only (reversible, visible via `show --archived`). The response always names the
   archived id, so the user sees it in the transcript.
3. **No archived content ever reaches an MCP response,** from any tool.
4. **No plaintext outside the vault.** No `$EDITOR` temp files (D-J), no logging of content or
   ids from curation paths, and nothing written to the desktop preferences file (e.g. the
   "Show archived" toggle stays in memory, the same rule as CARDS §7.7).
5. **Validation before session.** Ids, content, tags and type are parsed before the vault opens,
   following the `SaveContext` pattern. The desktop zod schemas accept an `id` string and booleans
   only, with no free-form patch object.
6. **IPC stays closed and enumerated.** Each new channel is added to `CHANNELS`, `SCHEMAS`,
   `ChannelMap` and the preload bridge, and the registration test is updated.
7. **No network, no telemetry, no new dependency.**
8. **Honest copy.** Archive is described as "hidden from packs and search", never as "deleted".
   Docs do not imply data is erased.
9. **Error messages leak nothing across projects** (`ITEM_NOT_FOUND` scoping, §6).

---

## 11. Architecture notes

- **Domain** (`context/domain`): `ItemId` value (`parseItemId` → `Result`). Curation transitions
  and invariants live with the `ContextItem` entity or in a `services/` or `policies/` subfolder,
  whichever is the correct kind-named folder. New codes go in `errors.ts` via `contextErr`. No I/O.
- **Application**: new `XUseCase` classes under `use-cases/`. Repository port additions go in
  `ports/repositories.ts`. `ContextItemView` gains optional `archived`. `SaveContext` absorbs
  `supersedes` inside its existing single `session.write`.
- **Infra**: `SqliteContextItemRepository` gains the lookups. Import keeps the archived state.
- **Delivery**: CLI verbs are thin adapters. Following the existing split, a new
  `cli/curation-commands.ts` or an extension of `content-commands.ts` is the planner's call. MCP
  adds a zod field and description text. `container.ts` wires the new use cases.
- **Desktop**: the main process handlers call container use cases only, never a repository. The
  renderer card gets an action row. Pure view logic (e.g. which actions an item offers) lives in a
  testable pure function, like `pinned-partition.ts`.
- **Tests per layer:** domain transitions; use cases with fakes (including rollback/no-bump on
  rejection and no-write on no-op); repo against a real SQLCipher DB (FTS after edit, prefix
  lookup, re-import keeps archived); CLI; MCP server (supersede happy path plus each rejection);
  desktop IPC handlers and one DOM test.

---

## 12. Acceptance criteria

**Domain and use cases (§5, §6)**
- [ ] pin / unpin / archive / unarchive / edit behave exactly per the §5 table, including no-op
      results and every rejection code in §6.
- [ ] Each successful change makes exactly **one** lineage bump. Each rejection or no-op makes
      **zero** (verified by test).
- [ ] Every change sets `updatedAt = now`. Edit keeps `id`, `createdAt`, `source`, `pinned`.
- [ ] Imported items: archive and unarchive work; pin and edit return `ITEM_NOT_CURATABLE`.
- [ ] Re-importing an export does not un-archive a previously archived imported item (D-H).
- [ ] No use case calls another. The unused unscoped `archive(itemId)` path is gone or re-scoped
      (D-M).

**CLI (§2.1)**
- [ ] `valija show` prints every item's full id. `--archived` includes archived items, marked.
- [ ] `pin|unpin|archive|unarchive|edit <id>` accept a full id or a unique prefix of 6 or more
      characters. Ambiguous → `ITEM_ID_AMBIGUOUS` listing candidates. Unknown → `ITEM_NOT_FOUND`.
- [ ] `edit` reads content from a file or stdin, replaces tags, and changes type among the five
      saveable types. With no flags → `NOTHING_TO_EDIT`. Never spawns an editor or writes a temp
      file.
- [ ] After `edit`, `valija search` finds the new text and not the old.

**MCP (§2.2)**
- [ ] The tool count is still 5. `save_context` has one new optional `supersedes` argument, and no
      other tool's schema changed.
- [ ] Supersede saves the new item and archives the old one in one transaction. The response names
      both ids.
- [ ] A bad target (unknown, other project, archived, pinned, imported) fails the whole call with
      its code, and the new item is **not** saved.
- [ ] `search_context` result lines include the item id. `get_context` output is unchanged.
- [ ] No MCP response ever contains an archived item.

**Desktop (§2.3)**
- [ ] Project cards offer Pin/Unpin and Archive. "Show archived" reveals archived cards with
      Unarchive. The list reloads after each action.
- [ ] New IPC channels exist in `CHANNELS`, `SCHEMAS`, `ChannelMap` and the bridge, and the
      closed-set test passes. Handlers call use cases only.
- [ ] Every new string and error code has copy in both `en.ts` and `es.ts`. `catalogs.test.ts`
      passes.
- [ ] The "Show archived" state is not persisted to preferences.

**Contracts and docs (§7, §8)**
- [ ] No migration. `LATEST_SCHEMA_VERSION` is still 3 (unless D-G changed).
- [ ] `expected-pack.md`, `expected-export.md` and `expected-search.json` are byte-identical, and
      the conformance test passes unmodified (unless D-F or D-G changed).
- [ ] `docs/gui.md`'s "no curation" boundary is rewritten. SPEC §5/§7/§8, `specs/context.md`,
      `specs/delivery.md`, `specs/desktop.md`, README and CHANGELOG are updated in the same
      commit.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at root and in `desktop/`.

---

## 13. Deliverables summary (not a plan)

| Deliverable | Nature |
|---|---|
| `ItemId` value, curation transitions, 6 new error codes | domain |
| `SetItemPinned`, `SetItemArchived`, `EditItem`; `SaveContext.supersedes`; `ShowProject.includeArchived` | application |
| Id/prefix lookup; import keeps the archived state; remove the unscoped `archive()` | infra |
| 5 CLI verbs, `show` ids and `--archived` | delivery/cli |
| `supersedes` arg plus description; ids in search lines | delivery/mcp |
| 2 IPC channels, `show` flag, card actions, Show-archived toggle, catalogs | desktop |
| SPEC, specs, README, gui.md, CHANGELOG | docs, same commit |

---

## 14. Biggest risk

**`supersedes` gives model output the power to retire the user's context.** Before this advance, an
AI could only *add* to the vault. Now a confused or prompt-injected model can make a correct,
human-saved decision disappear from every future pack. It vanishes silently, because packs never
show what is missing. Mitigations, all mandatory under the defaults: archive-only (reversible),
single id per call, same-project only, pinned and imported targets refused, atomic failure, the
archived id always echoed in the tool response, and `valija show --archived` to audit and undo.
*Runner-up:* re-import silently resurrecting archived imported items (fact 4). It is invisible
until the user notices the noise is back, which is why D-H defaults to preserving the archived
state.
