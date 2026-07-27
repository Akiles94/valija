# M4 — Vault format contract, conformance fixture & compatibility spike · Ship report

**Branch:** `docs/vault-format-M4` → merged into `main` with `--no-ff`
**Merge commit:** `f999b7b932fa7147a806e68f24b278d6a1ee9ba4`
**Base:** `main` (`6441ea59d8a32a509513c1fc21fbed56adc142ca`)
**Review verdict:** `PASS` (second pass, `advances/M4/review.md`, reviewed at `169256e`)

## What was done

Per Gate P (`plan.md`, `Approved: Oscar 2026-07-26`) and D-B Option 2, this advance is
docs/fixture-only — no mobile app code, no milestone number assigned:

- **`docs/vault-format.md`** (548 lines) — the versioned vault-format contract: SQLCipher
  parameters, the raw-key convention, Argon2id KDF parameters and source, header schema
  (incl. unknown-key stripping), schema-v3 tables and the three FTS5 triggers (byte-verified
  against `src/shared/infra/migrations/002-imported-type.ts`), pack assembly, markdown
  rendering, FTS query construction (incl. quote-escaping), and the read-only contract
  (§11: no journal pragma, no migration, no lineage bump, no device identity, unknown
  `schema_version`/`-wal` sidecar refusals with exact messages).
- **`src/testing/golden-vault.ts`** (272 lines) + **`src/testing/__fixtures__/golden-vault/`**
  — a committed golden vault (`vault.db`, seed, manifest, expected pack/search/export output),
  built from a published, clearly-marked synthetic test passphrase/key (no real user content).
- **`src/delivery/vault-format-conformance.test.ts`** (266 lines) — proves the desktop
  reproduces the published pack/search output byte-for-byte (plain `toBe`, no snapshots), and
  asserts the rebuilt vault's derived key matches the published Argon2id vector.
- **`advances/M4/spike.md`** (451 lines) — the compatibility spike runbook and results:
  official-SQLCipher raw-key open **FAIL** (Linux and the official Zetetic SPM package; no
  single divergent cipher parameter found; two unresolved upstream issues linked), Argon2id
  reproduction **PASS** (both published vectors), and a mobile-side write round-trip
  (literal-amalgamation INSERT → desktop `openVaultDb` read via pragma sequence + FTS query)
  **PASS**, executed across Linux, real Android (emulator via `adb`), and macOS, with an iOS
  device-target link-only result honestly distinguished from actual execution.
- `.gitattributes` (binary fixture handling) and a `CHANGELOG.md` entry.

No `src/` production module, dependency, or CI job was added or touched; no mobile toolchain
was left in the repo.

## Review summary

The review went through two passes. The first pass (`0186c47`, at `2f3063c`) was **FAIL** on
three Critical findings: C1 (write-round-trip criterion left `DEFERRED`, contradicted by the
spike's own later section), C2 (the published Argon2id vector was documented but never
asserted by a test), and C3 (a macOS run was labelled as an iOS execution). A fix commit
(`02444fd`) closed all three plus Warning W1 (stale FTS trigger reference), and the second-pass
review (`169256e`) verdict is **PASS**.

For the second pass the reviewer did not trust the commit message — it independently
reproduced the two load-bearing empirical claims from scratch in its own container: both
published Argon2id vectors via the reference `argon2` CLI, and the full write-round-trip
(compiled the literal-amalgamation write harness, ran it against a throwaway fixture copy,
read the mutation back through the exact `openVaultDb` pragma sequence and an FTS query,
confirming the trigger fired and no `-wal`/`-shm` sidecar was left). It also reproduced the
headline raw-key-open FAIL against the official `sqlcipher` CLI and diffed the documented FTS5
triggers against the migration source (byte-identical). All 12 of 12 acceptance criteria from
`refined.md` §8 were scored MET; no hard gate (security surface, missing tests, ritual
evidence, naming/architecture) was breached. Suite: 48 files / 241 tests passing, typecheck
and lint clean (one pre-existing `biome.json` config `info`, present on `main` before this
advance).

## What is lacking (non-blocking, per review.md §7)

- **W1** — `docs/vault-format.md`'s §13 pointer still claims the spike sections contain "the
  exact commands and C source," but neither the write harness nor its compile command was
  ever committed (the Option 2 harness exists only in this branch's deleted history).
- **W2** — the §13 results table in `docs/vault-format.md` doesn't carry the write-round-trip
  PASS as a row (the answer lives only in prose); an adjacent row's stated blocker is stale.
- **S1** — the second (non-default) published Argon2id vector is verified by the reviewer by
  hand but not pinned by any test.
- **S2** — two spike results rows record the same write-round-trip answer, with one having lost
  its literal-iOS scoping.
- **S3** — three "see above/below" cross-references in `spike.md` point the wrong direction.
- Carried forward, explicitly out of scope this round: `DEFERRED` vs `PENDING` labelling
  inconsistency; a step label (`C3`) naming two different things; under-specified section-label
  budgeting and "latest handoff" wording in `docs/vault-format.md` that could cause a second
  implementation to diverge (W5/W6 — the two the reviewer most wants fixed before this contract
  is handed to a real second implementer); unpinned `MAX_LIMIT`/`DEFAULT_LIMIT` constants; and
  several minor suggestions (fixture placement, README cross-link, reader-close-on-failure,
  unread `fixtureVersion`, the six `ci(M4):` spike commits riding into `main`'s history via
  `--no-ff`).

None of the open items touch the security surface, the test suite, the advance ritual, or the
repo's architectural conventions.

## Post-merge verification

Run against `main` at `f999b7b` after the merge:

- `npm run typecheck` — clean.
- `npm run lint` — clean (1 pre-existing `biome.json` config info, unrelated to this advance).
- `npm run test` — 48 files, 241 tests, all passing.

`main` is green.
