# M4 — Vault format contract, conformance fixture & compatibility spike · Implementation Plan

**Spec:** `advances/M4/refined.md` (Approved at Gate R — Oscar, 2026-07-26; D-A Option 3,
**D-B Option 2**, D-C Tier 1, D-D deferred, D-E KMP/iOS-first *recorded not acted on*, D-F
reimplement, D-G official builds + spike incl. write round-trip, D-H picker+snapshot,
D-I biometric-gated key, D-J never migrate, D-K expiring clipboard / no telemetry,
D-L separate `valija-mobile` repo).

**Branch (implementer creates after approval):** `docs/vault-format-M4`

> Implementation must NOT begin until Oscar has reviewed this file and recorded an
> `Approved:` line at its top. `.claude/hooks/guard-implementation.sh` blocks every
> `src/**`, `package.json`, `tsup.config.ts` and `tsconfig*.json` edit until that marker
> exists. This advance touches `src/**` (one helper + one test + fixture files), so the
> gate is live.

---

## 1. Summary

This advance ships **no mobile app**. Per D-B Option 2 it delivers exactly three things:

1. **`docs/vault-format.md`** — the written contract a second, non-Node implementation
   builds against: SQLCipher parameters and the raw-key convention, Argon2id parameters and
   where they come from, the `vault.json` header schema (including its unknown-key
   stripping), the schema-v3 tables and FTS5 triggers, the pack-assembly algorithm, the
   markdown rendering byte-for-byte, the FTS query construction, and the read-only
   discipline (never migrate, never switch journal mode, never bump lineage, refuse a `-wal`
   sidecar or a newer `schema_version`).
2. **A committed golden-vault conformance fixture + a test in the normal `npm run test`
   suite** proving the *desktop* TypeScript implementation still reproduces the fixture's
   expected pack markdown and search results byte-for-byte. This is drift protection for
   desktop first; it is valuable whether or not mobile ever ships.
3. **A compatibility spike targeting iOS** (D-E sequencing) reporting pass/fail on both the
   read/unlock path and a **write round-trip** (D-G amendment), with the working parameter
   set recorded in `docs/vault-format.md` or the divergent parameter named.

### The execution constraint you must know about before approving

**Deliverable 3 cannot be completed by an agent in this container.** The iOS side needs
Xcode, an official SQLCipher iOS build (CocoaPods/SwiftPM) and a native Argon2id library —
none of which exist on a sandboxed Linux box, and none of which may be added to this repo
(refined §8: *"The spike leaves no mobile toolchain, dependency, or CI job in this repo."*).
The plan therefore splits the spike into three honest tiers:

| Tier | Who runs it | Where | What it answers |
|---|---|---|---|
| **A — deterministic, in-repo** | agent | this container, `npm run test` | The desktop side of every contract claim: the real cipher parameter values (dumped from the live database, not read off the source), the published Argon2id vector, the golden vault, the byte-for-byte pack + search expectations. |
| **B — best-effort, in-container** | agent (if `sqlcipher` and `argon2` binaries can be installed locally), else Oscar on any machine | container / any Linux or macOS shell | Whether **upstream SQLCipher** (a different C codebase from `better-sqlite3-multiple-ciphers`) opens the golden vault with a raw key, and whether **reference-C Argon2id** reproduces the same 32 bytes. This is where most of hazard H1a actually dies: the iOS SQLCipher build is the *same upstream C source*, differently packaged. Nothing is committed — only the transcript. |
| **C — iOS, manual** | **Oscar, on a Mac with Xcode** | outside this repo, throwaway Xcode project | The remaining iOS-specific risk: the CocoaPods/SwiftPM SQLCipher build's defaults (CommonCrypto vs OpenSSL provider), a native Argon2id at 64 MiB on device, and the **write round-trip** (INSERT through the mobile binding into a throwaway copy, then read back with desktop `openVaultDb`). |

Slices 1–6 are Tier A + the Tier B/C **runbook**. Slice 7 is an explicit **human gate**:
the orchestrator hands Oscar `advances/M4/spike.md`, Oscar runs Tier C (an hour or two of
work following a step-by-step script), reports pass/fail, and the implementer records the
result. Do not plan around an agent completing Tier C; it cannot.

If Oscar has no Mac available in this cycle, see **Decision D-4** — the fallback ships
Tiers A + B now with the iOS row of the results table explicitly `PENDING`, rather than
silently claiming a verification that never happened.

**No `src/` behaviour changes.** No production module is edited. The only additions under
`src/` are one test-support helper, one test, and the fixture files. `docs/SPEC.md` is
untouched (D-A keeps mobile unscheduled, refined §9). No new npm dependency, no CI job.

---

## 2. Ordered steps

Run `npm run typecheck && npm run lint && npm run test` after every slice. Test files are
co-located (`foo.ts` + `foo.test.ts`); fixture data lives in a `__fixtures__/` folder, the
convention already used by `src/importers/infra/parsers/__fixtures__/`.

### Slice 1 — the golden vault's seed and published test values

1. **New `src/testing/__fixtures__/golden-vault/manifest.json`** — the published,
   machine-readable parameter set. Hand-written now; the cipher block is filled in by
   Slice 4. Shape:
   ```jsonc
   {
     "fixtureVersion": 1,
     "vaultId": "01JGOLDENVAULT0000000000",
     "passphrase": "valija-golden-vault-public-test-passphrase",
     "keyHex": "<64 hex — filled by Slice 2>",
     "saltBase64": "<16 bytes, fixed>",
     "kdf": { "algorithm": "argon2id", "memoryKiB": 65536, "iterations": 3, "parallelism": 1 },
     "schemaVersion": 3,
     "createdAt": "2026-07-26T00:00:00.000Z",
     "generatedAt": "2026-07-26T12:00:00.000Z",   // the pack's `generated <ISO>` line
     "packBudgetTokens": 150,                      // tight, to exercise the over-budget rule
     "searchLimitDefault": 20,
     "cipher": { /* filled by Slice 4 from live PRAGMA output */ },
     "fileSaltHex": "<first 16 bytes of vault.db — filled by Slice 2>"
   }
   ```
   The passphrase is deliberately self-describing (and ≥ 8 chars, so `parsePassphrase`
   accepts it and `valija unlock` works against the fixture in the spike runbook).
2. **New `src/testing/__fixtures__/golden-vault/seed.json`** — the exact plaintext rows the
   vault contains, so a second implementation can see what it should be reading. Two
   projects and ~12 items, every one with a **distinct `created_at`** (see Assumption A5 —
   `ORDER BY created_at DESC` has no tie-break, so equal timestamps would make ordering
   implementation-defined and the fixture flaky). Content is deliberately shaped to exercise
   every documented rule:
   - project `alpha`: two **pinned** items (the newest one long enough to exceed the tight
     budget on its own — proves "the newest pinned item is included even over budget"), two
     **handoff** items (proves only the *latest* handoff is ever included and older handoffs
     never reappear in a type section), one item of each of `decision`/`preference`/
     `progress`/`fact` (proves section order), one item **with tags** and one without
     (proves the `· #tag` rendering), one item with multi-line markdown and a non-ASCII
     character (proves verbatim UTF-8 content), one **archived** item (proves it is invisible
     to both pack and search), one **`imported`** item (proves it is searchable but never in
     a pack — and that it still counts toward the `> N items in vault` line).
   - project `beta`: two items (proves project scoping in search, and that `alpha`'s pack
     never contains `beta`'s rows).
3. **New `src/testing/__fixtures__/golden-vault/README.md`** — 20 lines: this is a
   **published test vault**, its passphrase and key are public, it contains no real user
   content, never point a real vault at these values; how to regenerate; what each file is.
4. **New `src/testing/golden-vault.ts`** — the test-support module both the generator and the
   conformance test import. Small, total, no assertions:
   - `GOLDEN_VAULT_DIR` — the fixture directory URL (`new URL("./__fixtures__/golden-vault/", import.meta.url)`).
   - `interface GoldenVaultManifest`, `interface GoldenVaultSeed` — typed shapes.
   - `readGoldenVaultManifest()` / `readGoldenVaultSeed()` — typed JSON reads (repo-owned
     data, not untrusted input; see §7 on why these are not `parseX`).
   - `buildGoldenVault(root, manifest, seed)` — writes `vault.json` via `writeVaultHeader`,
     then `openVaultDb` + `migrate`, then saves projects/items through the **real**
     `SqliteProjectRepository` / `SqliteContextItemRepository` (so the fixture is shaped by
     the production write path, FTS triggers included), then one
     `new SqliteLineageStore(db, fixedIds, fixedClock).bump(deviceId)` so the vault carries
     realistic `meta` lineage rows, then `db.close()`.
   - `copyGoldenVaultTo(destRoot)` — copies the committed `vault.json` + `vault.db` into a
     temp root and returns it. **Every reader in this repo goes through this**: `openVaultDb`
     writes on open (`wal_checkpoint`, `journal_mode`, `foreign_keys`), so opening the
     committed fixture in place would dirty the working tree. This mirrors D-H's
     snapshot-copy discipline structurally.
   - `makeGoldenVaultReader(root, manifest)` — wires `SqliteVaultSessions` over the copied
     root with `FakeKeychain` (seeded with the published key), `FakeDeviceIdentity`,
     `SessionGuard`, and a `FixedClock` pinned to `manifest.generatedAt`; returns
     `{ pack(budgetTokens), search(query, options), close() }` built from the real
     `GetContextPack` and `SearchContext` use cases. Keeping the wiring here leaves the test
     file as nothing but assertions.
   - A local `FixedIds implements IdGenerator` (~6 lines) returning ULID-shaped ids from a
     list, so the lineage stamp and device id are deterministic and realistic.

### Slice 2 — generate and commit the golden vault + its expected outputs

5. **Add the regeneration path to the conformance test** (written in Slice 3, but the
   generator branch lands first so the fixture can be produced): when
   `process.env.VALIJA_WRITE_GOLDEN_VAULT === "1"`, the test builds the vault from the seed
   into the fixture directory, derives the key from the published passphrase + salt + KDF
   params via `Argon2VaultCrypto`, writes `keyHex` and `fileSaltHex` back into
   `manifest.json`, renders and writes `expected-pack.md`, `expected-export.md` and
   `expected-search.json` — and then **fails the run** with
   `"Golden vault regenerated — review the diff and re-run without VALIJA_WRITE_GOLDEN_VAULT."`.
   Failing on regeneration is deliberate: an accidentally-set flag in CI can never produce a
   green build that silently rewrote its own expectations.
6. **Run it once** (`VALIJA_WRITE_GOLDEN_VAULT=1 npx vitest run src/delivery/vault-format-conformance.test.ts`)
   and commit the produced files:
   - `src/testing/__fixtures__/golden-vault/vault.json` (plaintext header)
   - `src/testing/__fixtures__/golden-vault/vault.db` (**binary**, SQLCipher, ~60–120 KB)
   - `src/testing/__fixtures__/golden-vault/expected-pack.md` (budget = `manifest.packBudgetTokens`)
   - `src/testing/__fixtures__/golden-vault/expected-export.md` (unbudgeted — the `valija export` path)
   - `src/testing/__fixtures__/golden-vault/expected-search.json`
   - updated `manifest.json` (`keyHex`, `fileSaltHex`)
7. **Edit `.gitattributes`** — add `*.db binary`. `* text=auto eol=lf` already forces LF for
   the text expectations (so a Windows checkout cannot CRLF-mangle a byte-for-byte
   comparison), but leaving the encrypted database to binary auto-detection is a needless
   risk on the Windows CI leg.
8. **Eyeball the generated expectations.** They are the contract's worked example and will be
   quoted in `docs/vault-format.md`; if the rendered pack looks wrong, the fixture content is
   wrong, not the code.

### Slice 3 — the conformance test (the drift gate)

9. **New `src/delivery/vault-format-conformance.test.ts`** — placed in `delivery/` alongside
   the existing cross-module end-to-end test `multi-device-sync.test.ts`, because it drives
   the whole stack (shared SQLite engine → vault header/lineage → context repositories and
   use cases → delivery's markdown renderer). Cases:
   - **opens the committed golden vault with the published raw key** — `copyGoldenVaultTo` a
     temp root, open a session, assert `schema_version = 3` and the expected project/item
     counts. Proves the committed ciphertext is still readable by the current code.
   - **renders `expected-pack.md` byte-for-byte** at `manifest.packBudgetTokens` — a plain
     `expect(rendered).toBe(readFileSync(...))`, no snapshot magic, so the diff on failure is
     the actual markdown.
   - **renders `expected-export.md` byte-for-byte** unbudgeted (`Number.POSITIVE_INFINITY`),
     the `valija export` path.
   - **the pack contains no `imported` and no archived item, but the `> N items in vault`
     count includes the imported one** — the subtlety a second implementation is most likely
     to get wrong (`totalCount` is `items.length` as returned by `findByProject`, which
     excludes archived but includes `imported`).
   - **reproduces `expected-search.json`** for every recorded query: a single term, a
     two-term AND, a term containing a double quote (the `"` → `""` escaping rule), a query
     that matches only the `imported` item (searchable), a query that matches only the
     archived item (expect `[]`), a project-scoped query, a whitespace-only query
     (expect `[]`), and a `limit` truncation case.
   - **pins the documented constants** — `expect(DEFAULT_BUDGET_TOKENS).toBe(4000)` and
     `expect(estimateTokens("abcde")).toBe(2)`, so the two magic numbers the contract
     publishes cannot drift silently even though the fixture uses a tighter budget.
   - **rebuilding from the seed reproduces the same pack** — `buildGoldenVault` into a second
     temp root and assert its rendered pack equals `expected-pack.md`. Guards against the
     committed `vault.db` going stale relative to `seed.json`.
   - **reading the fixture never mutates it** — SHA-256 the committed `vault.db` and
     `vault.json` at the start of the case, do a full copy-open-read cycle, re-hash, assert
     unchanged. This is the read-only discipline the contract prescribes, enforced in this
     repo's own suite.
   - `afterAll` removes every temp root (`rmSync(..., { recursive: true, force: true })`).

### Slice 4 — the cipher-parameter probe (the empirical half of the contract)

10. **Extend `src/testing/golden-vault.ts`** with `readCipherParameters(db)` — probes the
    live database for the parameters that must line up with an official SQLCipher build and
    returns a `Record<string, string | number>`. **Do not hard-code a pragma list from
    memory:** try a candidate set, keep only the ones the build actually answers, and record
    what came back. Candidates to try (drop any that return nothing):
    `cipher`, `page_size`, `kdf_iter`, `fast_kdf_iter`, `hmac_use`, `hmac_pgno`,
    `hmac_salt_mask`, `kdf_algorithm`, `hmac_algorithm`, `plaintext_header_size`,
    `legacy`, `legacy_page_size`, `cipher_salt`.
11. **Assert them in the conformance test** against `manifest.cipher`, and assert the
    recorded *key set* matches exactly — so a dependency bump that changes a default, stops
    answering a pragma, or adds one, fails the build loudly. Silent cipher-parameter drift is
    hazard H1a; a noisy dependency bump is the price and it is worth paying (Decision D-7).
12. **Assert the raw-key salt convention** — read the first 16 bytes of `vault.db` and assert
    they equal `manifest.fileSaltHex` (and, if `PRAGMA cipher_salt` is answered, that it
    matches too). This is the single most load-bearing fact for the mobile side: a 32-byte
    raw key supplies no salt, so the salt must come from the file's leading bytes; a mismatch
    here is exactly the "wrong passphrase against a perfectly good vault" failure of H1a.
13. **Record versions informationally, do not assert them** — `sqlite_version()` and the
    cipher/library version string go into the spike report and the doc's provenance line, not
    into an equality assertion (they change on every dependency bump and carry no contract).

### Slice 5 — `docs/vault-format.md` (the contract)

14. **New `docs/vault-format.md`** — written *from the fixture and the probe output*, not
    from reading the source, and every claim it makes is one the conformance test holds.
    Sections:
    1. **What this is** — the contract for a second implementation; status; who owns it;
       read-only first (D-C Tier 1), writes deferred (D-D).
    2. **Files on disk** — `vault.json` + `vault.db`, no sidecars at rest since 0.3.0, cross
       reference `docs/sync.md`.
    3. **The plaintext header** — the zod schema field by field, `schemaVersion` literal `1`
       (the *header* version, distinct from the database's `schema_version` — call the
       collision out explicitly, it is a trap), and the **unknown-key stripping** behaviour:
       a well-meant new field is silently dropped by desktop, so the header is frozen
       (refined §7.2).
    4. **Key derivation** — Argon2id, `type=argon2id, raw=true, hashLength=32`, parameters
       **read from the header, never assumed** (defaults 64 MiB / t=3 / p=1), 16-byte salt,
       key rendered as 64 lowercase hex; the 64-hex recovery key is used as-is with no KDF.
       Includes the published Argon2id test vector (passphrase + salt + params → key) and a
       second, cheap non-default-params vector to prove "honour the header".
    5. **Database encryption** — `PRAGMA cipher='sqlcipher'` then `PRAGMA key="x'<64 hex>'"`;
       the probed parameter table from Slice 4; the file-salt convention; key verification by
       touching `sqlite_master` (wrong key → `SQLITE_NOTADB`).
    6. **Schema v3** — `projects`, `context_items` (with the full `type` CHECK including
       `imported`), `idx_items_project`, the FTS5 external-content table and its three
       triggers verbatim, and `meta` (`schema_version` + the four `lineage_*` rows).
    7. **Reading projects and items** — the repository contract the pack algorithm relies on:
       `archived = 0`, `ORDER BY created_at DESC`, and the explicit caveat that **equal
       timestamps have no defined order** — do not rely on it, and do not build fixtures that
       depend on it.
    8. **Pack assembly** — the full algorithm: `estimateTokens = ceil(chars/4)`; the exact
       item cost string `` `${type} ${YYYY-MM-DD} ${tags.join(" ")}\n\n${content}` ``; the
       preamble cost string; section headings each cost their own label; pinned newest-first
       with the newest always included even over budget; the single latest handoff; then
       `decision → preference → progress → fact`; no item repeats; default budget 4000; export
       is unbudgeted; **`imported` items are never in a pack** (they are not pinned, not
       `handoff`, and not in the section order) **but they do count toward the `N items in
       vault` line**.
    9. **Markdown rendering** — the exact templates, the `·` U+00B7 separators, the `\n` join
       between parts, with the fixture's `expected-pack.md` shown as the worked example.
    10. **Search** — split on whitespace, drop empties, wrap each term in `"`, double any
        internal `"`, join with spaces (implicit AND), `MATCH` against `context_items_fts`
        joined on `rowid`, `archived = 0`, optional project filter, `ORDER BY rank`, limit
        clamped to 1..100 (default 20); an empty query returns no rows without touching the
        database; bm25 ranking is FTS5's, so a second implementation must use FTS5's default
        `rank` to match, and rank ties have no defined order.
    11. **The read-only contract** (D-J, permanent) — what a reader may do, and the explicit
        do-not list: **no `journal_mode`/`wal_checkpoint` pragma** (desktop's `openVaultDb`
        does this; a mobile reader must not copy that code path), **no migration ever, even
        after Tier 2 ships**, no lineage bump, no device identity, no `recordSeen`. Required
        behaviour: an unknown/newer `schema_version` → refuse with "update the app", never
        partially display; a `-wal`/`-shm`/`-journal` sidecar next to the vault, or a
        non-`DELETE` journal mode → refuse with "open this vault once on your computer with
        valija 0.3+ first", never show possibly-stale data; open a **sandbox snapshot copy**,
        never the provider file in place, and show it as "as of \<time\>".
    12. **The conformance fixture** — path, file-by-file contents, the published test values
        (marked loudly as public test data), and the check-list a second implementation runs:
        derive the key → open → render the pack → byte-compare → run the queries →
        byte-compare.
    13. **Verified compatibility** — the results table, filled by Slice 7. Until then each row
        reads `PENDING`. On pass: the exact parameter set that worked. On fail: the divergent
        parameter named and D-G's fallback (build the SQLite3MultipleCiphers amalgamation for
        mobile) flagged as triggered.
    14. **Change control** — this document and the fixture change together; the conformance
        test is the enforcement; a change to the pack algorithm or the renderer is a change to
        this contract and needs a fixture regeneration in the same commit.
15. **Edit `CHANGELOG.md`** — one entry under `## [Unreleased]`: added `docs/vault-format.md`
    and the golden-vault conformance fixture; no behaviour change, no version bump.
16. **No `docs/SPEC.md` edit and no `specs/*.md` edit.** D-A keeps mobile unscheduled, so §2's
    Out line stays as written (refined §8, first checkbox), and no `src/` behaviour changed,
    so the specs-are-contracts rule is not triggered. See Decision D-9 if a cross-link is
    wanted anyway.

### Slice 6 — the spike runbook (`advances/M4/spike.md`)

17. **New `advances/M4/spike.md`** — a runbook precise enough that whoever runs it needs no
    context from this plan, plus the results section that turns it into the spike report.
    Sections:
    - **What is being tested and why** — H1a in one paragraph; a fail here can invalidate the
      whole mobile idea, which is why it comes before any app work.
    - **Inputs** — the exact fixture files to copy out of the repo, the published passphrase,
      salt, KDF params, expected key hex, expected `fileSaltHex`, the probed cipher parameter
      table, and the expected `expected-pack.md` / `expected-search.json`.
    - **Tier B — upstream SQLCipher + reference-C Argon2id (any Linux/macOS shell).**
      Step-by-step: install the `sqlcipher` CLI and the reference `argon2` CLI locally
      (nothing enters the repo); `PRAGMA key = "x'<hex>'"` then `.schema` and a
      `SELECT count(*)`; if it fails, iterate the documented parameter knobs (`cipher_page_size`,
      `kdf_iter`, `hmac_algorithm`, `kdf_algorithm`, `plaintext_header_size`, `legacy`) one at
      a time and record which one made the difference; then run `argon2` with the published
      salt/params and compare the 32 bytes to `manifest.keyHex`. Record the exact commands and
      their output.
    - **Tier C — iOS (needs a Mac with Xcode).** Throwaway Xcode project; add SQLCipher via
      CocoaPods/SwiftPM and a native Argon2id; put the fixture in the app bundle; **(a) read
      path:** derive the key from the passphrase, open, `SELECT` the items, and compare the
      rendered pack against `expected-pack.md`; **(b) write round-trip (D-G amendment):** copy
      the vault to a throwaway path, `INSERT` one row into `context_items` through the mobile
      binding (a valid `type`, an existing `project_id` — the FTS triggers keep the index in
      step automatically), close, move the file back to the machine.
    - **Desktop-side verification of the round-trip** — no scratch code needed: point
      `VALIJA_HOME` at a copy of the mutated vault, `node dist/program.js unlock` with the
      published passphrase, then `search` / `show` to confirm the new row reads back and is
      indexed, plus `PRAGMA integrity_check` and a check that no sidecar was left behind.
      Work on a copy; `valija` writes on open, by design.
    - **Results** — a table with one row per question: *raw-key open*, *Argon2id vector*,
      *pack byte-match*, *search match*, *write round-trip*, each `PASS` / `FAIL` / `PENDING`,
      with the working parameter set or the divergent parameter named. A `FAIL` on the write
      round-trip does **not** block this advance (D-D is deferred, not committed) — it is
      early evidence, recorded and called out as a separate line item.
    - **What must not happen** — no toolchain, dependency, script or CI job lands in this
      repo; the throwaway project is deleted; the fixture in the repo is never edited by the
      spike.
18. **Run Tier B in this container if the tooling installs.** If `sqlcipher`/`argon2` cannot
    be installed (no network, no package), record that plainly in the Results table as
    `NOT RUN — toolchain unavailable in the implementation environment` and leave it to Oscar.
    Do not fake it, and do not add a dependency to make it work.

### Slice 7 — HUMAN GATE: run the iOS spike and record the result

> **The implementing agent stops here.** Everything above is done and green; this step needs
> a Mac.

19. The orchestrator presents `advances/M4/spike.md` and the fixture files to Oscar.
20. **Oscar runs Tier C** and reports the five results.
21. The implementer records them in `advances/M4/spike.md` §Results and mirrors the
    conclusion into `docs/vault-format.md` §13 *Verified compatibility* — the exact parameter
    set on pass, the divergent parameter plus a "D-G fallback triggered" note on fail. If the
    read path fails, that is a **finding to escalate at the next Gate R** (refined §5 Out:
    *"If mobile compatibility appears to require a format change, that is a finding to report
    … not a change to make inside this one."*) — nothing about the desktop crypto changes in
    this advance under any outcome.
22. Final `npm run typecheck && npm run lint && npm run test`, then Review.

---

## 3. Security-sensitive order of operations

- **Key before database, always.** `buildGoldenVault` and every reader derive/obtain the
  64-hex key first and hand it to `openVaultDb`, which verifies it against `sqlite_master`
  before any other pragma runs. Nothing in this advance opens a database before a key is in
  hand, and no code path is added that could.
- **Read the copy, never the committed fixture.** `openVaultDb` mutates on open. Every test
  path goes through `copyGoldenVaultTo` first, and one test asserts the committed fixture's
  SHA-256 is unchanged after a full read cycle. This keeps the repo clean *and* demonstrates
  the exact discipline `docs/vault-format.md` §11 demands of a mobile reader.
- **The published secrets are published on purpose, and only these.** The fixture's
  passphrase and key are public test values, named as such in three places (fixture README,
  manifest, contract doc). No real key, passphrase, recovery key or user content enters the
  repo. The fixture's `keyHex` is not a secret precisely because the vault behind it is
  synthetic — say so explicitly wherever it appears.
- **Nothing is logged.** The helper and the test print nothing; the regeneration branch prints
  a single path-only message. No key material reaches stdout, ever — including in the runbook,
  where the published values are quoted deliberately and no *user* value ever appears.
- **The crypto is untouched.** No KDF change, no key-format change, no header field, no
  SQLCipher configuration change. The advance only *reads and documents* the existing
  parameters; the parameter assertions in Slice 4 are a tripwire against accidental change,
  not a place to change anything.
- **`vault.json` stays frozen.** The fixture's header uses exactly the five documented fields.
  The contract documents the unknown-key stripping so a future implementer understands why
  adding a field is worse than useless (silently dropped, not rejected).
- **The MCP surface is not touched.** No tool, argument, prompt or transport is added or
  changed; no file under `src/delivery/mcp/` is edited. The existing
  `src/delivery/mcp/server.test.ts` assertions continue to hold unchanged.
- **No network, no telemetry, no new dependency** (D-K confirmed). The Tier B/C toolchains are
  installed *outside* the repo, used, and discarded; nothing they need is added to
  `package.json` or `.github/workflows/ci.yml`.
- **The spike never writes to a real vault.** Both the read path and the write round-trip
  operate on throwaway copies of a synthetic fixture. The runbook states this at the top and
  repeats it at the write step.

---

## 4. Test plan → acceptance criteria

Everything below runs in the normal `npm run test` suite (vitest `include: ["src/**/*.test.ts"]`),
on the existing CI matrix (ubuntu/windows/macos × node 22/24). No new runner, no new config.

| Acceptance criterion (refined §8) | How it is proven |
|---|---|
| `docs/vault-format.md` specifies the SQLCipher parameter set + raw-key convention | Slice 5 §5, written **from** the Slice 4 probe output; the probe assertion fails if the doc's table goes stale |
| …the Argon2id parameters and where they come from | Slice 5 §4 + the published vector, asserted by the derivation case (Slice 2/3) |
| …the `vault.json` schema incl. unknown-key stripping | Slice 5 §3; existing `src/vault/infra/vault-header.test.ts` already pins the behaviour |
| …schema-v3 tables incl. FTS triggers and `meta` lineage rows | Slice 5 §6, quoted from `001-init.ts`/`002`/`003`; the fixture opens at `schema_version = 3` and its FTS index answers queries |
| …pack assembly incl. token estimate, over-budget pinned rule, section order | Slice 5 §8; `expected-pack.md` byte-compare (tight budget forces the over-budget pinned rule) + `expected-export.md` byte-compare (full section order) + the `DEFAULT_BUDGET_TOKENS`/`estimateTokens` pins |
| …the markdown rendering | byte-for-byte comparison against both expected files — any renderer change fails the build |
| …FTS query construction incl. quote-escaping | `expected-search.json` includes a term containing `"`; plus the AND, project-scope, limit and empty-query cases |
| …`imported` searchable but never in a pack | one case asserts the imported item is absent from the pack body, present in a search hit, and counted in the `N items in vault` line |
| `docs/vault-format.md` states the read-only contract (no journal pragma, no migration, no lineage bump, no device identity) + unknown `schema_version` + `-wal` sidecar behaviour | Slice 5 §11 (prose contract, D-J); the "reading never mutates the fixture" case demonstrates the snapshot discipline in this repo |
| A committed golden vault + expected pack + expected search exist; a test proves the desktop reproduces them byte-for-byte | Slice 2 (committed) + Slice 3 (the test). A future change to the pack algorithm or renderer fails `npm run test` |
| The fixture's key/passphrase is a published test value, clearly marked; no real user content | fixture `README.md` + `manifest.json` + `docs/vault-format.md` §12; reviewed in `change-reviewer`'s pass |
| Spike reports pass/fail on raw-key open + Argon2id reproduction; parameter set recorded or divergence named; targets iOS | `advances/M4/spike.md` §Results (Slice 7), mirrored into `docs/vault-format.md` §13 |
| Spike separately reports pass/fail on the write round-trip | same table, its own row, explicitly non-blocking |
| The spike leaves no mobile toolchain, dependency or CI job in this repo | `package.json` and `.github/workflows/ci.yml` are untouched — verifiable in the diff |
| No change to `vault.json`, Argon2id params, key format, SQLCipher configuration | no file under `src/vault/**` or `src/shared/infra/**` is edited — verifiable in the diff; the Slice 4 parameter assertions are the standing tripwire |
| MCP surface byte-for-byte unchanged (5 tools, 2 prompts, stdio) | no `src/delivery/mcp/**` edit; existing `server.test.ts` unchanged and green |
| No network call, telemetry, analytics or cloud SDK added | no dependency added; diff review |
| No milestone number assigned to mobile | `docs/SPEC.md` untouched; the plan and spike report both state "unscheduled" |
| `npm run typecheck && npm run lint && npm run test` pass | run after every slice |

---

## 5. Assumptions (each one a place this plan could be wrong)

- **A1 — refined §2.4's `test/fixtures/conformance/` path is illustrative, not normative.**
  This plan puts the fixture at `src/testing/__fixtures__/golden-vault/` because that is the
  convention already in the repo (`src/importers/infra/parsers/__fixtures__/`), because
  `vitest.config.ts` only includes `src/**/*.test.ts`, and because keeping everything under
  `src/` keeps the implementation guard hook covering it. See Decision D-2.
- **A2 — "a test that regenerates and byte-compares" means regenerating the *expected
  outputs* from the committed vault, not regenerating the vault.** The ciphertext contains
  random per-database salt and IVs, so a regenerated `vault.db` is never byte-identical. The
  committed vault is the stable artifact a second implementation opens; the pack markdown and
  search results are what get byte-compared. Slice 3's "rebuild from seed reproduces the same
  pack" case covers the remaining risk (a stale committed db).
- **A3 — `better-sqlite3-multiple-ciphers` answers a useful subset of the SQLCipher parameter
  pragmas.** I could not execute anything to confirm which names it accepts, so Slice 4
  probes a candidate list and records what comes back rather than asserting a list I guessed.
  If it answers almost nothing, the contract falls back to documenting the *observable* facts
  (page size from the file header, the 16-byte file salt, the raw-key convention) and the
  spike carries proportionally more of the H1a load.
- **A4 — the first 16 bytes of `vault.db` are the KDF salt** under SQLCipher's default
  (non-plaintext-header) configuration, which is what makes a raw 32-byte key work at all.
  The Slice 4 assertion pins whatever is actually there; if the probe shows otherwise, the doc
  records reality and the spike's parameter list changes accordingly.
- **A5 — item ordering needs distinct timestamps.** `findByProject` orders by `created_at DESC`
  with no tie-break, so equal timestamps produce an implementation-defined order. The fixture
  gives every item a distinct `created_at`, and the contract documents the caveat.
- **A6 — FTS5 `ORDER BY rank` is stable enough to byte-compare** for queries whose hits have
  clearly different bm25 scores. The fixture queries are designed that way. A future SQLite
  version that re-scores could still surprise us; that is a true drift signal, not a flake,
  but it will look like one — see Risk R3.
- **A7 — an iOS SQLCipher build is the same upstream C source as a Linux one**, differently
  packaged (crypto provider, build flags). This is what makes Tier B worth running: it
  answers most of H1a without a Mac. It does not make Tier C optional — CommonCrypto vs
  OpenSSL and the CocoaPods defaults are exactly the kind of packaging difference that could
  bite.
- **A8 — the golden vault carries production KDF parameters** (64 MiB / t=3 / p=1), so the
  suite pays one real Argon2id derivation (~0.5–1.5 s, 64 MiB) in the vector case. Existing
  tests use 8 MiB / t=1 for speed; this is the one place where the real cost is the point.
  See Decision D-6.
- **A9 — a ~60–120 KB binary in git is acceptable** and is regenerated rarely (only when the
  fixture content itself changes). `package.json`'s `files: ["dist", …]` means it never ships
  to npm, and `tsup`'s single CLI entry point means it is never bundled.
- **A10 — Oscar has access to a Mac with Xcode within this advance's cycle.** If not,
  Decision D-4's fallback applies. Nothing else in the plan depends on it.

---

## 6. Decisions to confirm (recommended default + trade-offs)

- **D-1 — Branch name.** *Recommend:* `docs/vault-format-M4`. The dominant deliverable is the
  written contract; the test exists to keep it honest. *Trade-off:* a `docs/` prefix on a
  branch that does add code under `src/` may read as under-selling. *Alternatives:*
  `test/vault-conformance-M4` (leads with the drift gate) or `chore/vault-format-M4`.

- **D-2 — Where the fixture lives.** *Recommend:* `src/testing/__fixtures__/golden-vault/`.
  Matches the repo's existing `__fixtures__` convention, keeps `vitest`/`tsc`/`biome` config
  untouched, keeps the files inside the implementation guard's scope, and adds nothing to the
  repo root. *Trade-off:* refined §2.4 sketches `test/fixtures/conformance/`, and a
  contract artifact consumed by an *outside* implementation is slightly buried under
  `src/testing/`. *Alternatives:* `test/fixtures/conformance/` (literal match to the sketch,
  but introduces a `test/` root the repo has never had, split from the test that reads it) or
  `fixtures/vault-format/` at the repo root (most discoverable for a second implementation,
  but a new top-level folder outside the guard).

- **D-3 — How the fixture is regenerated.** *Recommend:* an env-flag branch inside the
  conformance test (`VALIJA_WRITE_GOLDEN_VAULT=1`) that writes the files and then **fails**,
  so it can never green-wash CI. Zero new config, zero new scripts, discoverable from the
  file that consumes it. *Trade-off:* a write path living inside a test file is slightly
  unusual. *Alternative:* an `npm run fixture:golden-vault` script — more conventional, but it
  edits `package.json` and needs a TS entry point runnable outside vitest.

- **D-4 — What happens if Oscar cannot run the iOS spike this cycle.** *Recommend:* hold the
  advance at Slice 7 until Tier C is run — the acceptance criteria ask for a pass/fail, and a
  contract published as "verified" that was never verified against a second implementation is
  exactly the artifact D-B Option 3 was rejected for. *Trade-off:* the branch waits on machine
  availability. *Fallback if that wait is unacceptable:* ship Tiers A + B now with
  `docs/vault-format.md` §13 and the spike Results table marked `PENDING — iOS not yet run`,
  and treat Tier C as the first task of the next advance. This is honest and still lands the
  durable artifacts; it just leaves the advance's headline question open.

- **D-5 — Attempt Tier B (upstream SQLCipher on Linux) inside the container.**
  *Recommend:* yes, best-effort. It is the cheapest way to kill most of H1a, and it needs no
  Mac. If the tooling will not install, record `NOT RUN — toolchain unavailable` and move on.
  *Trade-off:* time spent on an install that may fail in a sandbox. *Alternative:* skip it and
  let Tier C carry everything — faster, but a Tier C failure then has no intermediate signal
  to localise it (packaging problem vs format problem).

- **D-6 — Golden vault KDF parameters.** *Recommend:* production defaults (64 MiB / t=3 / p=1),
  with exactly one derivation in the suite (the published vector) and a second, cheap
  non-default vector documented to prove "parameters come from the header". *Trade-off:*
  ~0.5–1.5 s and 64 MiB added to every test run, on six CI legs. *Alternative:* a reduced-cost
  header (8 MiB / t=1) — fast, but then the published vector exercises a configuration no real
  vault uses, and D-G's "is 64 MiB acceptable on a low-end phone?" question loses its fixture.

- **D-7 — Assert the probed cipher parameters, or only record them.** *Recommend:* assert,
  including the exact key set. Silent cipher-parameter drift is the hazard that can strand
  every existing user's vault. *Trade-off:* a `better-sqlite3-multiple-ciphers` bump that
  changes a default will fail CI and need a deliberate fixture/doc update — which is the
  intent, but it is friction. *Alternative:* record into the manifest without asserting —
  zero friction, zero protection.

- **D-8 — A second fixture for the `-wal` refusal case.** *Recommend:* no. Document the
  detection rule and a recipe for producing such a vault; this repo already exercises the
  WAL-vault path in `src/shared/infra/upgrade-wal.test.ts`. *Trade-off:* the mobile author has
  to build their own refusal-case vault. *Alternative:* commit a second `vault-stale-wal.db` +
  `-wal` pair — directly testable by a second implementation, at the cost of two more
  committed binaries and a generator branch that has to deliberately produce a state the
  desktop code path no longer creates.

- **D-9 — Touch `docs/SPEC.md` at all.** *Recommend:* no. D-A says mobile stays unscheduled
  and refined §9 explicitly says no roadmap edit is needed this round. *Trade-off:* a reader
  of `docs/SPEC.md` §6 (Storage layout) will not learn that a full format contract now exists.
  *Alternative:* one cross-reference line in §6 pointing at `docs/vault-format.md` — harmless,
  informative, but it is still an edit to the roadmap document during an advance whose first
  acceptance checkbox is "no milestone number is assigned". A one-line link in `README.md`'s
  docs list is a lower-risk way to get the same discoverability if Oscar wants it.

- **D-10 — Fixture size and shape.** *Recommend:* 2 projects / ~12 items / ~4–6 KB of
  synthetic content, with a tight pack budget (~150 tokens) to exercise truncation, plus the
  unbudgeted export for full section order. *Trade-off:* the tight budget means the fixture
  does not exercise the *default* 4000-token budget end to end (pinned separately by a
  constant assertion). *Alternative:* size the content past 4000 tokens so the default budget
  truncates naturally — more realistic, but ~16 KB of generated filler in both the fixture and
  the expected markdown, for one constant's worth of extra coverage.

---

## 7. Naming / placement / ubiquitous-language check

- **Ubiquitous language.** The advance introduces one new term into the project's vocabulary:
  the **vault format contract** (`docs/vault-format.md`), verified by a **golden vault**
  fixture and a **conformance** test. "Golden fixture" is refined §6 D-F's own wording, and
  "conformance" is refined §2.4's. Existing vocabulary is reused unchanged everywhere else —
  vault, header, key, pack, section, item, project, lineage, snapshot.
- **File placement.** `CLAUDE.md`'s "no bare files at a layer's root" rule governs a module's
  `domain/application/infra`. Nothing in this advance lands in one:
  - `src/testing/` is a test-support folder, not a bounded context, and already holds a bare
    `test-vault.ts`; `golden-vault.ts` sits beside it consistently.
  - `src/delivery/vault-format-conformance.test.ts` sits at `delivery/`'s root exactly like
    the existing cross-module `multi-device-sync.test.ts` — `delivery/` is the composition
    layer and end-to-end tests live at its root by precedent.
  - `src/testing/__fixtures__/golden-vault/` mirrors `src/importers/infra/parsers/__fixtures__/`.
  - `docs/` and `advances/M4/` are documentation trees, not code layers.
  No new *kind* of application or domain object is introduced, so no new typed subfolder is
  needed.
- **Naming conventions.** Helpers follow the repo's existing test-support style
  (`makeUnlockedVault`, `FakeKeychain`, `FixedClock`, `SeqIds`): `buildGoldenVault`,
  `copyGoldenVaultTo`, `makeGoldenVaultReader`, `readGoldenVaultManifest`, `FixedIds`.
- **Why `readGoldenVaultManifest`, not `parseGoldenVaultManifest`.** `parseX → Result` is the
  parse-don't-validate convention for *untrusted domain input* crossing a boundary. The
  manifest is a repo-owned fixture read by test-support code; a typed read that throws on
  malformed data is simpler, and a `Result` there would only be unwrapped with a throw anyway.
  Called out here so a reviewer reads it as a deliberate choice, not an oversight.
- **No production module is renamed or edited**, so no existing name is put at risk.

---

## 8. Estimated line count & risks

**Estimated production lines (`src/**`, non-test):** **~150** — `src/testing/golden-vault.ts`
only. Counting generously, since it is test-support code that is typechecked and linted but
never bundled (`tsup` has one CLI entry) and never published (`package.json` `files`).

Everything else:

| Artifact | Lines |
|---|---|
| `src/delivery/vault-format-conformance.test.ts` | ~190 (test) |
| Fixture data (`manifest.json`, `seed.json`, `expected-*.md`, `expected-search.json`, `README.md`) | ~420 (generated + hand-written data) |
| `src/testing/__fixtures__/golden-vault/vault.json` + `vault.db` | 8 lines + one ~60–120 KB binary |
| `docs/vault-format.md` | ~500 (markdown) |
| `advances/M4/spike.md` | ~200 (markdown) |
| `CHANGELOG.md`, `.gitattributes` | ~5 |

**Total change ≈ 1,470 lines + one committed binary.**

**Risks:**

1. **R1 — Tier C is not executable by the implementing agent.** The advance's headline
   question (H1a) can only be closed by a human with a Mac. Mitigated by making it an explicit
   gate (Slice 7) rather than a hidden dependency, by the Tier B pre-check that localises any
   failure, and by Decision D-4's fallback. This is the single most likely reason the advance
   stalls, and it is a scheduling risk, not a technical one.
2. **R2 — The contract could be confidently wrong.** A document written from source reading is
   precisely the artifact D-B Option 3 was rejected for. Mitigated by deriving the crypto
   section from the **live parameter probe** rather than from `src/`, by making every rendering
   and search claim byte-asserted against the fixture, and by keeping §13 honestly `PENDING`
   until a second implementation has actually opened the file.
3. **R3 — A dependency bump makes the conformance test look flaky.** Asserted cipher pragmas
   and `ORDER BY rank` results are both tied to the bundled SQLite/SQLCipher build. A future
   bump could fail the build for a reason that is real (mobile compatibility just moved) but
   reads as noise. Mitigated by asserting parameters and not version strings, by designing the
   search queries to have clearly-separated bm25 scores, and by documenting in §14 of the
   contract that such a failure is a contract change requiring a deliberate regeneration.
4. **R4 — Byte-for-byte comparisons across the CI matrix.** Line endings and UTF-8 are the
   classic traps. `* text=auto eol=lf` already covers the markdown expectations on Windows;
   `*.db binary` (Slice 2) covers the database. If the Windows leg still diverges, suspect the
   fixture content's line endings first, not the renderer.
5. **R5 — Fixture staleness.** A committed vault can drift from the seed that describes it.
   Mitigated by the "rebuild from seed reproduces the same pack" case, and by §14's rule that
   a renderer or algorithm change regenerates the fixture in the same commit.
6. **R6 — Scope creep toward the app.** Everything from D-E through D-L is *recorded, not
   acted on*. Any Swift/Kotlin file, any `mobile/` folder, any biometric or document-picker
   work, any Android work, any `docs/SPEC.md` roadmap edit is out of scope for this advance
   and should be rejected in review.

---

## 9. Repo structure after execution

```
docs/
├── SPEC.md                                        (unchanged — D-A keeps mobile unscheduled)
├── sync.md                                        (unchanged — cross-referenced by the contract)
└── vault-format.md                                (NEW: the format & algorithm contract,
                                                     §13 filled at Slice 7)

specs/                                             (all unchanged — no src/ behaviour change)

src/
├── testing/
│   ├── test-vault.ts                              (unchanged)
│   ├── golden-vault.ts                            (NEW: manifest/seed reads, buildGoldenVault,
│   │                                                copyGoldenVaultTo, makeGoldenVaultReader,
│   │                                                readCipherParameters, FixedIds)
│   └── __fixtures__/
│       └── golden-vault/
│           ├── README.md                          (NEW: published test values, no real data)
│           ├── manifest.json                      (NEW: crypto params, cipher probe, queries)
│           ├── seed.json                           (NEW: the exact plaintext rows)
│           ├── vault.json                          (NEW, generated: the golden header)
│           ├── vault.db                            (NEW, generated, BINARY: the golden vault)
│           ├── expected-pack.md                    (NEW, generated: tight-budget pack)
│           ├── expected-export.md                  (NEW, generated: unbudgeted pack)
│           └── expected-search.json                (NEW, generated: per-query expected hits)
├── delivery/
│   ├── multi-device-sync.test.ts                  (unchanged — placement precedent)
│   └── vault-format-conformance.test.ts           (NEW: the drift gate + regeneration branch)
├── shared/                                        (unchanged)
├── vault/                                         (unchanged)
├── context/                                       (unchanged)
└── importers/                                     (unchanged)

advances/M4/
├── idea.md                                        (unchanged)
├── refined.md                                     (unchanged)
├── plan.md                                        (this file)
└── spike.md                                       (NEW: runbook for Tiers B & C + Results table)

.gitattributes                                     (changed: + `*.db binary`)
CHANGELOG.md                                       (changed: one [Unreleased] entry)
package.json                                       (UNCHANGED — no dependency, no script)
.github/workflows/ci.yml                           (UNCHANGED — no new CI job)
vitest.config.ts / tsconfig.json / tsup.config.ts  (UNCHANGED)
```

---

**Plan path:** `advances/M4/plan.md`. Implementation must not begin until Oscar reviews this
plan and records an `Approved:` line at its top; the orchestrator halts for that approval at
Gate P. Note additionally that this advance contains a **second, mid-implementation human
gate** (Slice 7, the iOS spike) that no agent can execute.
