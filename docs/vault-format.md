# The valija vault format — a contract for a second implementation

**Status:** Argon2id verified compatible; SQLCipher raw-key open verified **incompatible**
with the official build, on two independent platforms (§13) — see `advances/M4/spike.md`.
**Owner:** this repository. Any change to the facts documented here is a change to this
contract, and must land together with a regenerated conformance fixture (§14).
**Who this is for:** anyone building a second, non-Node reader of a valija vault — starting
with the read-only mobile companion described in `advances/M4/refined.md` (Tier 1, D-C).
This document, plus the committed fixture at `src/testing/__fixtures__/golden-vault/`, is
meant to be everything you need — you should not have to read `src/` to implement against
this.

**Read-only first.** Every fact below describes how to *read* a vault. Writing is
out of scope for this document and, per `advances/M4/refined.md` D-D, deferred as a product
decision — a second implementation must not write to a vault unless and until that decision
is revisited.

---

## 1. What this is

A valija vault is one encrypted SQLite database (SQLCipher) plus one small plaintext header
file, both living in the same folder. There is no server, no account, and no network
protocol — "the format" means exactly: what bytes are on disk, and what algorithm turns them
into the markdown a user reads. Nothing here changes because a second implementation exists;
this document only writes down what the first (TypeScript/Node) implementation already does.

## 2. Files on disk

A vault folder (`VALIJA_HOME`, default `~/.valija`) contains exactly two files at rest:

```
vault.json   the plaintext header (§3)
vault.db     the encrypted SQLCipher database (§5-6)
```

Since valija 0.3.0 (M3, D-A), the vault is a **single self-consistent file at rest after
every command** — there is never a `-wal`, `-shm`, or `-journal` sidecar sitting next to
`vault.db` once a command has finished. If you see one, the vault was last touched by a
pre-0.3.0 valija, or a process crashed mid-write; §11 covers what a reader must do about it.
See [`docs/sync.md`](sync.md) for the full multi-device story this enables.

## 3. The plaintext header (`vault.json`)

Exactly five fields, no more, no fewer:

```json
{
  "vaultId": "01JGOLDENVAULT0000000000",
  "schemaVersion": 1,
  "kdf": { "algorithm": "argon2id", "memoryKiB": 65536, "iterations": 3, "parallelism": 1 },
  "saltBase64": "R29sZGVuVmF1bHRTYWx0IQ==",
  "createdAt": "2026-07-26T00:00:00.000Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| `vaultId` | string | Opaque identifier, not shape-checked (this codebase treats every id as opaque) |
| `schemaVersion` | the literal `1` | The **header's** version. This is a different number from the database's `schema_version` (§6) — the collision in naming is a trap, not a hint that they move together |
| `kdf` | object | The exact Argon2id parameters used for **this** vault (§4) — never assume a default, always read this |
| `saltBase64` | string | The Argon2id salt, base64-encoded, 16 raw bytes |
| `createdAt` | ISO 8601 string | When `valija init` created the vault |

**This file is frozen by design (M3).** No sync flag, no device list, no session hint, no
lineage data has ever been added here, and none should be — that would leak sync-relevant
metadata in plaintext to whatever cloud vendor is syncing the folder, and it would
reintroduce a second file a sync client has to keep in step with `vault.db`. **The reader
implementation matters here too: unknown keys are silently stripped**, not rejected — the
schema is validated with a permissive parser that drops anything it doesn't recognize. A
well-meant new field added by a future client would be silently ignored by desktop, not
loudly flagged. Don't add one; if you need to carry more information, that is a finding to
raise, not a field to add unilaterally.

## 4. Key derivation (Argon2id)

A user's passphrase never touches the database directly — it derives a 32-byte raw key:

- **Algorithm:** Argon2id, the **reference C implementation** (bound via the npm `argon2`
  package, which itself binds `phc-winner-argon2`) — not a from-scratch reimplementation. A
  second implementation should link the same reference library rather than a different
  Argon2id implementation, so identical output is by construction, not by hope
  (`advances/M4/refined.md` D-G).
- **Output:** raw bytes (not the usual PHC-encoded string), exactly 32 bytes, then rendered
  as **64 lowercase hex characters**. This hex string is the vault's "key" everywhere else in
  this document and in the codebase — it is what goes into the OS keychain, what a recovery
  kit prints, and what §5 hands to SQLCipher.
- **Salt:** 16 random bytes, generated once at `valija init` and stored in the header's
  `saltBase64`. Never regenerated, never derived from anything else.
- **Parameters come from the header, never from a compiled-in default.** The default a fresh
  `valija init` writes is `memoryKiB: 65536` (64 MiB), `iterations: 3`, `parallelism: 1` — but
  an implementation that assumes this instead of reading `vault.json`'s `kdf` object will
  silently produce the wrong key for any vault created with different parameters. There is no
  guarantee every vault uses the default.
- **The 64-hex recovery key is used as-is.** If a user unlocks with the recovery key printed
  at `init` instead of their passphrase, **no KDF runs at all** — the 64 hex characters
  (lowercased) are the raw key directly.

**Published test vectors** (both computed with the golden vault's fixed salt
`R29sZGVuVmF1bHRTYWx0IQ==`, ASCII `GoldenVaultSalt!`):

| Passphrase | Params | Key (hex) |
|---|---|---|
| `valija-golden-vault-public-test-passphrase` | 65536 KiB, t=3, p=1 (the fixture's actual header) | `3e53d9f1d53beb152abeab88320e77a4fd9e5e878828a1c1aec4d0327d46dc67`[^keylen] |
| `valija-golden-vault-public-test-passphrase` | 8192 KiB, t=1, p=1 (deliberately non-default) | `dfdeb798323eee9fd777775505bab940bb301b7c2d586b5fbff882259fa94750`[^keylen] |

[^keylen]: Both keys are 64 hex characters (32 bytes); if your rendering wraps them, that is
    a display artifact, not evidence of the wrong length.

The second row exists specifically to prove "parameters come from the header": deriving with
the fixture's *actual* header parameters (row 1) must be the only combination that opens
`src/testing/__fixtures__/golden-vault/vault.db` — the second vector is a worked example of a
*different*, valid derivation, not a value that unlocks anything.

## 5. Database encryption (SQLCipher)

Opening the database is two pragmas, in this exact order, against the raw 64-hex key from §4:

```sql
PRAGMA cipher = 'sqlcipher';
PRAGMA key = "x'<64 hex chars>'";
```

Key verification is not a separate step — the first real read forces it: touching
`sqlite_master` (e.g. `SELECT count(*) FROM sqlite_master`) throws `SQLITE_NOTADB` if the key
is wrong. There is no "verify key" API to call first; a wrong key looks exactly like "this
file is not a database" to SQLite, which is the mechanism a reader should treat as
`WRONG_PASSPHRASE`.

### The raw-key salt convention

A 32-byte raw key (as opposed to a passphrase SQLCipher derives itself) supplies **no salt of
its own** — SQLCipher reads the salt from the **first 16 bytes of the database file**. This
is the single most load-bearing fact in this document for a second implementation: get it
wrong and every vault reports "wrong passphrase" despite a correct key.

Empirically confirmed against the golden vault fixture (not assumed): the file's first 16
bytes and `PRAGMA cipher_salt` are byte-for-byte identical —

```
first 16 bytes of vault.db (hex): EC9F1BEE32529ADFBD1D6A0A1AEA05AF
PRAGMA cipher_salt:                EC9F1BEE32529ADFBD1D6A0A1AEA05AF
```

— proven every run by `src/delivery/vault-format-conformance.test.ts`, which hashes the
committed file, re-derives this value, and fails the build if either drifts.

### The full probed parameter set

Not a list read off documentation — every value below was **read from the live database**
via `PRAGMA <name>` against the golden vault fixture, using this repository's own
`better-sqlite3-multiple-ciphers` build. A second implementation's SQLCipher build must
answer the same way for these to be compatible (`advances/M4/refined.md` D-G):

| Pragma | Value | Meaning |
|---|---|---|
| `cipher` | `sqlcipher` | The cipher scheme |
| `page_size` | `4096` | SQLite page size |
| `kdf_iter` | `256000` | SQLCipher's own internally-configured KDF iteration count. **Unrelated to Argon2id** (§4), which derives the passphrase into the raw key *before* SQLCipher ever sees it — whether/how SQLCipher's own KDF is exercised on top of an already-raw key is SQLCipher's internal behavior, not something this repository has independently verified beyond the pragma value itself. Recorded because a compatible build must report the same value, not as a claim about its internal mechanics |
| `fast_kdf_iter` | `2` | A second, cheaper iteration count SQLCipher reports alongside `kdf_iter` |
| `hmac_use` | `1` | Per-page HMAC is enabled |
| `hmac_pgno` | `1` | Page-number handling variant for the per-page HMAC |
| `hmac_salt_mask` | `58` | The mask value SQLCipher reports for HMAC salt handling |
| `kdf_algorithm` | `2` | Which KDF variant SQLCipher is configured with |
| `hmac_algorithm` | `2` | Which HMAC variant authenticates each page |
| `plaintext_header_size` | `0` | No unencrypted header bytes — the salt itself (first 16 bytes) is the only non-ciphertext content |
| `legacy` | `0` | Not running in a legacy-compatibility mode |
| `legacy_page_size` | `4096` | Only meaningful when `legacy` is set; recorded for completeness |
| `cipher_salt` | `EC9F1BEE32529ADFBD1D6A0A1AEA05AF` | The file's salt, readable directly (see above) — **this exact value is fixture-specific**, every other row in this table is a fixed parameter of the format |

The exact mechanics of *why* SQLCipher reports each of these values are its own internals,
documented by the SQLCipher project, not by valija. What this document commits to is
narrower and fully verified: **a compatible build reports these same values against this
same fixture** — that equality is what the conformance test asserts (§14), not an
explanation of SQLCipher's internal cryptography.

Five candidates this build's `better-sqlite3-multiple-ciphers` does **not** answer (probed,
came back empty — not a gap in this document, an absence in the underlying library):
`cipher_version`, `cipher_provider`, `cipher_provider_version`, `cipher_default_kdf_iter`,
`cipher_compatibility`. If a second implementation's SQLCipher build exposes these and they
disagree with the format this document describes, that is new information worth reporting,
not something this table can currently confirm either way.

**`sqlite_version()`** and any cipher/library version string are recorded in the spike report
(`advances/M4/spike.md`) as provenance, not asserted here — they change on every dependency
bump and carry no compatibility guarantee of their own; the pragmas above are what must hold.

### Journaling

At rest, the journal mode is always `DELETE`, never `WAL` — see §2. A vault a *pre-0.3.0*
desktop wrote may still be in `WAL` mode with a live `-wal` sidecar; §11 covers the required
refusal behavior.

## 6. Schema v3

Three tables plus an FTS5 index, created by three migrations applied in order (`001-init`,
`002-imported-type`, `003-lineage`) — a reader only ever needs the **result**, reproduced
verbatim below, not the migration history.

```sql
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
  type TEXT NOT NULL CHECK (type IN
    ('decision','progress','preference','fact','handoff','imported')),
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
-- verbatim from src/shared/infra/migrations/002-imported-type.ts — a reader
-- never has to reproduce these; they exist to keep the committed vault.db's
-- FTS index correct, and a read-only client only ever queries the index,
-- never writes to it (§11). Reproduced here (not just named) because D-D
-- keeps writes open as a real future step, and this file's own §14
-- write-round-trip note otherwise tells an implementer to rely on triggers
-- they cannot verify without the definitions.

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Created by the migration runner itself (not by a numbered migration's SQL),
-- before any migration runs — verbatim from src/shared/infra/migrations.ts.
```

`meta` carries, as plain string rows:

| `key` | `value` |
|---|---|
| `schema_version` | `"3"` — the **database's** version (distinct from the header's `schemaVersion`, always `1`) |
| `lineage_generation` | a non-negative integer, as a string |
| `lineage_stamp` | an opaque per-write random token |
| `lineage_writer` | an opaque device id |
| `lineage_written_at` | ISO 8601 timestamp of the last write |

The four `lineage_*` rows exist only after the vault's **first real write** — `meta` may
carry only `schema_version` on a freshly migrated, never-written-to vault. This is
sync/device bookkeeping for humans (`valija status`/`lock`/`doctor`), documented here only so
a reader recognizes and ignores it; **never surface it as content**.

**Column notes:**
- `tags` is a JSON array of strings, stored as text (e.g. `'["security","storage"]'`).
- `pinned` and `archived` are `0`/`1` integers, not SQLite booleans (SQLite has none).
- `type` for a stored row is one of the six `CHECK`-listed values. `imported` is a valid
  **stored** value but is never offered as a save option to a user or an AI — it exists only
  via valija's import feature, never through the save path.
- `source` is nullable free text: `undefined`/`NULL` for most items, an MCP client name for
  items saved through a tool, or `"<provider>-import"` (e.g. `"chatgpt-import"`) for imported
  items.

## 7. Reading projects and items

The repository contract the pack algorithm (§8) depends on:

- **Items:** `SELECT * FROM context_items WHERE project_id = ? AND archived = 0 ORDER BY
  created_at DESC`. Archived items (`archived = 1`) are excluded **at this query**, not later
  — they never reach the pack-assembly step at all, and they are never returned by search
  either (§10).
- **`ORDER BY created_at DESC` has no tie-break.** Two items with the identical `created_at`
  string have an implementation-defined relative order. Do not rely on it, and if you build
  your own fixtures, give every item a distinct `created_at` the way
  `src/testing/__fixtures__/golden-vault/seed.json` does.
- **Projects:** looked up by `name` (unique). A project has no content of its own beyond its
  `id`/`name`/`description`/timestamps — everything a pack shows comes from its items.

## 8. Pack assembly — the algorithm

This is the part most likely to be gotten subtly wrong; the fixture exists specifically to
catch that.

- **Token estimate:** `estimateTokens(text) = ceil(text.length / 4)` — a character count, not
  a real tokenizer. `estimateTokens("abcde")` must equal `2` (this exact value is a pinned
  constant in the conformance test).
- **`text.length` means UTF-16 code units**, because that is what JavaScript's `String.length`
  is. This matters for any character outside the Basic Multilingual Plane, where the two
  plausible readings diverge: `"𝄞"` (U+1D11E) is **two** UTF-16 code units but **one**
  grapheme cluster. Kotlin's `String.length` and Java's `String.length()` match JavaScript.
  **Swift's `String.count` does not** — it counts grapheme clusters; Swift implementations must
  use `text.utf16.count`. A second implementation that gets this wrong agrees with valija on
  all-BMP text (including the fixture's `café ☕`, which is 6 units *and* 6 graphemes) and
  silently disagrees the first time a user writes an emoji with a skin-tone modifier or a
  musical symbol.
- **An item's cost** against the budget is `estimateTokens` of exactly this string:
  ``` `${type} ${YYYY-MM-DD} ${tags.join(" ")}\n\n${content}` ```
  — the type, the `created_at` date truncated to 10 characters (`YYYY-MM-DD`, **not** the
  full ISO timestamp), the tags space-joined, a blank line, then the raw content.
- **The preamble** (the pack's own overhead) costs
  ``` `Context pack: ${projectName} — ${items.length} items, generated ${generatedAt.toISOString()}` ```
  — note this uses the **full** ISO timestamp, unlike the per-item date. That timestamp is
  JavaScript's `Date.toISOString()`: UTC, **always exactly three fractional-second digits**,
  and a literal trailing `Z` — `2026-07-26T12:00:00.000Z`, never `2026-07-26T12:00:00Z`. Most
  other languages' default ISO formatters elide zero milliseconds, which produces a token
  estimate and a rendered header that are each wrong by a few characters. The safest port keeps
  the stored string and never parses it into a date type at all.
- **Section headings cost their own label's tokens too, but the three sections charge for them
  differently.** "Added once per section" is true; *when* it is added is not uniform, and a
  budgeted pack comes out different if you get this wrong:
  - **Pinned:** `estimateTokens("Pinned")` is added **unconditionally, before any pinned item
    is considered** — it is charged even if the section ends up empty.
  - **Latest handoff:** the item's own cost **plus** `estimateTokens("Latest handoff")` are
    tested against the budget **together, as one sum**. The label is charged only if the pair
    fits; if it does not, neither is charged and the section is omitted.
  - **By type:** the label is `estimateTokens(<type>)` — the **lowercase wire name**
    (`"decision"`, 2 tokens), *not* the rendered plural heading (`"Decisions"`) — and it is
    folded into the **first candidate item's** budget test. So it is charged only if that first
    item fits, and never charged for a section that ends up omitted.
- **Order, and what goes in each section:**
  1. **Pinned**, newest first. **The newest pinned item is always included, even if it alone
     exceeds the whole budget** — only starting from the *second* pinned item does the budget
     get checked before adding. Older pinned items are cut oldest-first once the budget is
     exhausted. (Proven by the fixture: `item-a08`, the long pinned item, is the *only* thing
     in the tight-budget pack — see `expected-pack.md`.)
  2. **The single latest handoff**, if one exists and fits the remaining budget. Older
     handoffs are **never** shown, even in an unbudgeted pack — "latest" means exactly one,
     always. Precisely, "latest" is **the newest `handoff` item not already placed in the
     Pinned section** — not simply the newest handoff in the project. The distinction is
     invisible in the fixture (no handoff there is pinned) but real: a pinned handoff appears
     under **Pinned** and this section is then filled by the next-newest handoff, while a
     pinned handoff that the *budget* pushed out of the Pinned section is still eligible here.
  3. **One section per type, in this fixed order:** `decision → preference → progress →
     fact`. Each section holds items of that type not already included above, newest first,
     until the budget is exhausted; a section with zero eligible items is omitted entirely
     (no empty heading).
- **No item repeats.** An item already placed in the Pinned or Latest-handoff section never
  reappears in a by-type section, even though its type would otherwise put it there.
- **`imported` items are never in a pack, period.** They are not pinnable (`imported` items
  are always `pinned: false` by construction — see `specs/context.md`), they are not
  `handoff`, and `imported` is not one of the four by-type sections. No code path ever places
  one in a `PackSection`.
- **Default budget: 4000 tokens.** `export` (the `valija export`/`get_context` unbudgeted
  path) passes `Number.POSITIVE_INFINITY` — same algorithm, no truncation.
- **`totalCount` counts every item the query in §7 returned — including `imported` ones —
  after archived items are already excluded.** This is the one place `imported` items *are*
  visible: the `"> N items in vault"` line counts them even though the pack body never shows
  them. Concretely, in the fixture: `alpha` has 10 items, 1 archived → the query returns 9 →
  `totalCount` is `9`, even though only 7 of those 9 ever appear in a section (the imported
  item and the superseded older handoff make up the other 2). See the "excludes imported and
  archived ... but counts imported" case in the conformance test for the exact numbers.

## 9. Markdown rendering

Presentation, not domain logic — but a second implementation showing "the same pack" must
match it exactly, since `expected-pack.md`/`expected-export.md` are byte-compared against it.

```
# Context pack: <projectName>

> <totalCount> items in vault · generated <generatedAt.toISOString()>

## <Section title>

### <type> · <YYYY-MM-DD>[ · #tag #tag ...]

<content>

```

- Section titles: `"Pinned"`, `"Latest handoff"`, or the capitalized plural for a by-type
  section (`"Decisions"`, `"Preferences"`, `"Progress"`, `"Facts"` — `Progress` has no
  distinct plural).
- The separator between the date and the tags (and between tags) is `·` (U+00B7 MIDDLE DOT),
  not a hyphen or a pipe.
- Tags render as `#tag`, space-separated, only when the item has at least one.
- The exact worked example is `src/testing/__fixtures__/golden-vault/expected-export.md` —
  when in doubt, that file is more authoritative than this prose.

**The concatenation rule — the part the template above cannot show you.** The blank lines are
not decoration and they are not uniform: there is **one** blank line between an item and the
next item, and **two** before a `##` heading that follows an item. That falls out of how the
pieces are joined, so a second implementation must reproduce the construction, not eyeball the
spacing:

```
header      = "# Context pack: <name>\n\n> <N> items in vault · generated <ISO>\n"
sectionPart = "\n## <Section title>\n"
itemPart    = "### <type> · <YYYY-MM-DD>[ · #tag …]\n\n<content>\n"

parts  = for each section: [sectionPart] followed by one itemPart per item
output = header + parts.join("\n")
```

Note the three separate sources of newlines: the header already ends with one, each section
part *begins* with one, each item part *ends* with one, and the `join("\n")` adds one more
between every adjacent pair. Building this with a per-line "append with newline" helper, or
joining with `""`, yields output that looks correct in a rendered Markdown preview and fails a
byte comparison. The output ends with a single `\n` after the last item's content — there is no
trailing blank line.

## 10. Search

- **Query construction:** split the raw query on whitespace, drop empty pieces, wrap **each**
  remaining term in double quotes, doubling any internal `"` (so a term containing a literal
  quote character can never break FTS5 syntax), then join the quoted terms with spaces. This
  produces an **implicit AND** — FTS5 treats space-separated terms as a conjunction.
  Example: the query `caf"e` (a literal embedded quote) becomes the FTS string `"caf""e"` —
  syntactically valid, and expected to match nothing in the fixture (see
  `expected-search.json`'s `"quoted-term-no-match"` case).
- **An empty or whitespace-only query returns no results without ever touching the
  database** — not an empty FTS query, a short-circuit before one is built.
- **The match:** `SELECT ... FROM context_items_fts f JOIN context_items i ON i.rowid =
  f.rowid ... WHERE context_items_fts MATCH <built query> AND i.archived = 0 [AND
  i.project_id = ?] ORDER BY rank LIMIT ?`. Archived items are excluded from search results
  the same way they are excluded from a pack — even if the query term only appears in an
  archived item's content, it will not be returned (fixture case
  `"archived-excluded"` → `[]`).
- **`imported` items are fully searchable** — search has no type filter at all. This is the
  other place (besides `totalCount`) `imported` content surfaces, deliberately: it's a
  searchable archive, never auto-loaded context (fixture case `"imported-only"`).
- **Project scoping** is an optional exact-match filter on `project_id`, applied in the same
  query as the FTS match, not as a second pass over unscoped results.
- **`ORDER BY rank`** is FTS5's own bm25 ranking, ascending (most relevant first). A second
  implementation must use FTS5's default ranking to match this repository's expected search
  results — there is no custom scoring anywhere in valija. Rank ties have no defined order;
  the fixture's queries are deliberately built so their matches have clearly separated scores
  (see `plan.md` Assumption A6).
- **Limit:** clamped to the inclusive range **1 to 100**, default **20** — never 0, never
  unbounded.

## 11. The read-only contract

This is the section that matters most for a mobile reader, and it is permanent — not a
Tier-1-only restriction lifted once a future write tier ships (`advances/M4/refined.md` D-J,
D-D).

**A reader must never:**
- Run `PRAGMA journal_mode` or `PRAGMA wal_checkpoint`. Desktop's own `openVaultDb` runs
  these **on every open** (folding any WAL, forcing `DELETE` mode) — that is a mutation of a
  file the user's sync client is watching, and a read-only client must not reproduce that
  code path structurally, not just by convention.
- Run a schema migration, under any circumstance, ever — including after a future write tier
  ships. Migration is a desktop-only ritual, permanently.
- Bump the lineage stamp, mint a device identity, or call anything equivalent to
  `recordSeen`/`recordActivity`. A pure reader that never writes can never fork a vault by
  construction — keep it that way by never touching lineage at all, not by being careful.

**A reader must, when it encounters:**
- **An unknown or newer `schema_version`** than it was built against: refuse to open the
  vault with an actionable message ("update the app"). Never attempt to read a schema newer
  than the one this document describes, and never partially display what it can parse.
- **A `-wal`, `-shm`, or `-journal` sidecar next to `vault.db`, or a journal mode that isn't
  `DELETE`:** refuse with a specific message ("open this vault once on your computer with
  valija 0.3+ first"), never attempt to read `vault.db` alone and show possibly-stale data. A
  vault last touched by a pre-0.3.0 desktop can have committed data sitting only in the
  `-wal` file — opening `vault.db` by itself would silently omit it.
- **A vault whose plaintext header parses but whose key doesn't open the database:** this is
  `WRONG_PASSPHRASE` (§5), not a format problem — prompt again, don't treat it as corruption.

**Recommended, not required by the format itself, but required by
`advances/M4/refined.md`'s D-H:** open a snapshotted **copy** of the vault files, never the
live file inside a synced folder in place. This sidesteps SQLite locking assumptions that
don't hold against a cloud file-provider URL, and it makes the "never mutates" rule above
structural rather than a promise.

## 12. The conformance fixture

Everything above is proven, not just asserted, against
`src/testing/__fixtures__/golden-vault/`:

| File | Contents |
|---|---|
| `manifest.json` | Published passphrase, derived key, salt, KDF params, probed cipher parameters, fixed ids |
| `seed.json` | The exact plaintext rows (2 projects, 12 items) as JSON |
| `vault.json` / `vault.db` | The built fixture — **public test data, never a real secret** |
| `expected-pack.md` | The rendered pack for project `alpha` at the tight budget (150 tokens) |
| `expected-export.md` | The same pack, unbudgeted — full section order |
| `expected-search.json` | Expected results for 8 queries covering every rule in §10 |

**A second implementation's own conformance check:** derive the key from the published
passphrase (§4) and confirm it matches `manifest.keyHex` → open `vault.db` with that raw key
(§5) → render project `alpha`'s pack at `manifest.packBudgetTokens` → byte-compare against
`expected-pack.md` → run each query in `expected-search.json` → byte-compare the results.
Passing all of this is what "compatible" means for the purposes of `advances/M4/spike.md`.

**Everything in this fixture is published, on purpose, and is not a secret** — the passphrase
and the derived key exist so a second implementation (and this repository's own CI) can prove
compatibility without a human in the loop. Never reuse these values for a real vault.

## 13. Verified compatibility

Tiers A, B, and C′ are done — see `advances/M4/spike.md` for the full commands and analysis.
A literal iOS device/simulator run (Tier C) remains open, but is now lower priority: C′
already answered the core question using the official SPM package on Apple's own toolchain.

| Question | Tier | Result |
|---|---|---|
| Argon2id reference-C vector reproduction | B | **PASS** — exact match, two vectors (default and non-default params) |
| Raw-key open (upstream SQLCipher, Linux), `legacy=0` (valija's actual vaults) | B | **FAIL** — see below |
| Raw-key open (official SPM SQLCipher package, macOS via GitHub Actions), `legacy=0` | C′ | **FAIL** — identical signature to Tier B |
| Raw-key open, bidirectional, `legacy=4` (Linux) | B | **PASS** — real data verified, both directions |
| Raw-key open, official SPM package, `legacy=4` (macOS) | C′ | **FAIL** — identical signature, despite every queryable parameter matching |
| Argon2id on-device (literal iOS) | C | DEFERRED — low value, B1 already conclusive |
| Rendered pack / search byte-match (literal iOS) | C | DEFERRED — blocked on a compatible SQLCipher build existing |
| Write round-trip (literal iOS) | C | DEFERRED — informational only (D-D deferred) |

**Argon2id is a closed question.** The reference C implementation (the same library both the
npm `argon2` package and, per D-G, the iOS side are meant to link) reproduces valija's
derived key exactly. Key derivation carries no remaining risk.

**SQLCipher compatibility is closed, and the answer is no — including the library's own
documented compatibility mode.** Upstream SQLCipher fails to open a vault created by
`better-sqlite3-multiple-ciphers` (12.11.1) at its default settings (`legacy=0`, what
valija's `openVaultDb` actually produces) both via Ubuntu's packaged CLI (SQLCipher 4.5.6
community, Tier B) and via the official, Zetetic-maintained SPM package (`SQLCipher.swift`,
resolved to `4.17.0`, on a GitHub Actions macOS runner, Tier C′): `sqlite3_key` accepts the
raw key without error, but the first real read fails with `SQLITE_NOTADB` ("file is not a
database"). A self-test on Linux confirmed the testing methodology itself is sound (upstream
SQLCipher round-trips against its own output).

`SQLite3MultipleCiphers` (the library `better-sqlite3-multiple-ciphers` wraps) documents a
`legacy` cipher parameter specifically to fix this: `legacy=4` selects SQLCipher 4's exact
parameters and is documented to produce SQLCipher-compatible files. Re-tested with `legacy=4`
set: on Linux, it works — a `legacy=4` vault round-trips real data in both directions against
upstream `sqlcipher` (Node writes, `sqlcipher` reads a real row back, and the reverse). But the
same vault, byte-for-byte, still fails against the official SPM package on macOS, with the
identical `SQLITE_NOTADB` signature — even though every queryable parameter matches exactly
between the two real SQLCipher builds (`kdf_iter`, `page_size`, `use_hmac`,
`plaintext_header_size`, both digest algorithms at SHA512, the HMAC salt mask). This is not a
new problem: `utelle/SQLite3MultipleCiphers` issues
[#20](https://github.com/utelle/SQLite3MultipleCiphers/issues/20) and
[#47](https://github.com/utelle/SQLite3MultipleCiphers/issues/47) report the identical
unresolved symptom against real SQLCipher and DB Browser for SQLite, respectively — this
spike's result is a fresh, independent reproduction of a known pattern, not a one-off
misconfiguration.

**This does not change anything documented above** — §5's parameter table is still exactly
what `better-sqlite3-multiple-ciphers` produces, verified by this repository's own
conformance test on every run. What it changes is the plan for a future mobile app advance:
**"official SQLCipher on one side, `better-sqlite3-multiple-ciphers` (with or without
`legacy=N`) on the other" is closed, not just de-prioritized.**

**D-G's Option 2 is confirmed — not just theoretically sound, empirically verified.** Building
the literal `SQLite3MultipleCiphers` amalgamation (the exact `sqlite3.c` `node-gyp` compiles
into the desktop native addon) for mobile, so both ends run the same implementation, was
tested directly: compiled standalone (no Node, no N-API) and run against valija's real
production golden-vault fixture (`legacy=0`, the actual desktop config — no changes needed on
that side) on Linux, on Apple/Darwin (arm64, Apple's own clang — executed on **macOS**; the
real iOS device target linked clean but was never executed, since a literal iOS-simulator
binary needs full CoreSimulator infrastructure to run, not just a compile flag), and on
Android (arm64 compiles clean against the real NDK/bionic toolchain; x86_64 executes
correctly inside a real, booted Android emulator via `adb`). **Every run that could execute
the binary passed, reading back byte-identical data** — the same 16-table count, the same
six-way row breakdown, on Linux, Apple/Darwin, and the Android emulator. A separate write
round-trip check (refined §8's D-G amendment) confirms the format survives a mobile-side
write too: a row inserted through the same literal amalgamation reads back correctly through
the real desktop `openVaultDb` and `SearchContext` code paths — **PASS**. A future
mobile-companion advance can adopt this with confidence: build/vendor the amalgamation for
the mobile app rather than depending on the official SQLCipher package, no desktop-side
migration required. A literal iOS device/simulator execution remains the one genuinely open
item. See `advances/M4/spike.md` §"Option 2 verification" and §"Write round-trip
verification" for the full detail, including the exact commands and C source, so this can be
independently re-checked or re-run.

## 14. Change control

This document and the fixture in §12 change **together, in the same commit**. If a change to
`src/context/domain/services/context-pack.ts`, `src/delivery/context-pack-markdown.ts`,
`src/context/infra/item-repo.ts`, or any migration alters what this document promises, the
conformance test (`src/delivery/vault-format-conformance.test.ts`) fails first — regenerate
the fixture (`VALIJA_WRITE_GOLDEN_VAULT=1`, see the fixture's own `README.md`), update this
document to match, and land both together. A failing conformance test after an unrelated
change is never a flake to silence — see `advances/M4/plan.md` Risk R3 for what a real
dependency-driven drift looks like versus what a genuine flake would look like (they are not
the same failure, and the difference matters).
