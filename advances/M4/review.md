Verdict: PASS

# M4 — Vault format contract, conformance fixture & compatibility spike · Review (second pass)

**Branch:** `docs/vault-format-M4` · **Base:** `main` (`6441ea5`) · **Reviewed at:** `02444fd`
**Spec:** `advances/M4/refined.md` (Gate R, Oscar 2026-07-26) ·
**Plan:** `advances/M4/plan.md` (carries `Approved: Oscar 2026-07-26` on line 1 ✓)
**Previous pass:** `Verdict: FAIL` at `2f3063c` — C1, C2, C3 Critical; W1 Warning.

The three Critical findings and W1 are closed. I re-derived each one rather than trusting the
commit message, and I independently reproduced the two load-bearing empirical claims (the new
write round-trip and both published Argon2id vectors) in this container from scratch — see §3.
Every acceptance criterion is now met and no hard gate is breached.

---

## 1. Line count

| Artifact | Lines | Plan estimate |
|---|---|---|
| `docs/vault-format.md` | 548 | ~500 |
| `advances/M4/spike.md` | 451 | ~200 |
| `src/testing/golden-vault.ts` (the only non-test `src/` addition) | 272 | ~150 |
| `src/delivery/vault-format-conformance.test.ts` | 266 | ~190 |
| Fixture data (`seed.json`, `expected-*`, `manifest.json`, `README.md`, `vault.json`) | 372 | ~420 |
| `.gitattributes` + `CHANGELOG.md` | 5 | ~5 |
| `src/testing/__fixtures__/golden-vault/vault.db` | binary, 61,440 B | ~60–120 KB |
| **Total (excl. `review.md`)** | **+1,914 / −0**, 14 files, 1 binary | ~1,470 |

The fix commit itself is **+129 / −31 across 3 files** — `advances/M4/spike.md`,
`docs/vault-format.md`, `src/delivery/vault-format-conformance.test.ts`. Nothing else moved.
No scope creep: no new dependency, no new CI job, no `src/` production module touched.

Suite (re-run for this pass): `npm run typecheck` ✓, `npm run lint` ✓ (one pre-existing
biome-config `info`, present on `main`), `npm run test` ✓ — **48 files, 241 tests passing**,
6.2 s.

---

## 2. The three Critical findings, re-derived

### C1 — write-round-trip criterion unanswered → **CLOSED**

refined §8 asks the spike to "separately report **pass/fail** on a write round-trip". The
previous pass found `DEFERRED`, which is neither, and found the stated blocker
("nothing to test until a compatible SQLCipher build exists") contradicted by the Option 2
section further down the same file.

What landed: a new `advances/M4/spike.md:380-419` §"Write round-trip verification", Results
row 7 (`spike.md:431`) flipped to **PASS**, a new row 14 (`spike.md:438`), and the stale
"blocked on C2" paragraph rewritten (`spike.md:253-262`) so the still-open item (C3
pack/search byte-match) is separated from the now-answered one.

**I reproduced it.** Not to spot-check the wording — to test the claim. In this container:

1. Compiled a ~25-line `INSERT` harness against the *literal* amalgamation
   `node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c`, standalone `cc`, no
   Node, no N-API — the same source and the same approach the Option 2 section describes.
2. Ran it against a throwaway copy of the committed fixture:
   `RESULT insert=PASS changes=1` — character-identical to the transcript at `spike.md:396`.
3. Read the mutated file back through the exact `openVaultDb` pragma sequence
   (`src/shared/infra/sqlite.ts:19-28`): `sqlite_master_count = 16`,
   `integrity_check = ok`, the inserted row present with the exact `content`/`project_id`,
   and the FTS query from `src/context/infra/item-repo.ts` returning **exactly one hit** —
   i.e. the `items_ai` trigger fired on a mobile-side write. No `-wal`/`-shm` sidecar left
   behind.

Every claim in `spike.md:411-414` holds. The scoping caveat at `spike.md:416-419` ("only
exercises the write path on Linux… a literal on-device write round-trip remains open") is the
honest framing and I would not want it removed.

*Is the substitution legitimate?* refined §8 words the criterion as "an INSERT via the mobile
SQLCipher binding". That wording presupposed D-G Option 1, which this spike closed as
non-viable — so the literal criterion is unexecutable, and the closest available proxy is the
same C source that *would be* the mobile binding under Option 2, on a target where it
demonstrably runs. Combined with the Option 2 table's real Android-emulator execution
(`spike.md:352`, real Bionic userspace via `adb`), that is a defensible, disclosed
substitution, and refined §8 explicitly makes this row non-blocking either way. Criterion met.

### C2 — published Argon2id vector untested → **CLOSED**

`src/delivery/vault-format-conformance.test.ts:241` now asserts
`expect(built.keyHex).toBe(manifest.keyHex)` inside the rebuild case, with the reasoning in a
comment at `:237-240`. This bites: `buildGoldenVault` derives through the real
`Argon2VaultCrypto().deriveKey(manifest.passphrase, salt, manifest.kdf)`
(`src/testing/golden-vault.ts:145`), so an Argon2id parameter or adapter change now fails the
suite instead of silently invalidating the vector. `manifest.keyHex` is byte-identical to the
published vector in `docs/vault-format.md:104`. The case title was updated to match. I also
re-derived both published vectors with the reference `phc-winner-argon2` CLI — both match
exactly, independently confirming `spike.md:45-60`.

The second, non-default vector (`docs/vault-format.md:105`, 8192 KiB / t=1) is still unpinned
by any test. That was a "consider" last pass, not a criterion, and the plan's §4 promise
("**the** published vector") is now satisfied. Restated as **S1** below.

### C3 — macOS run published as iOS → **CLOSED**

`spike.md:349` now reads `Apple/Darwin (arm64) … Compile + run **on macOS**`, with a separate
`spike.md:350` row for the iOS device target explicitly marked `**Link-only** … no iOS binary
was run … Linked clean — no execution evidence`. A new paragraph at `spike.md:354-361` opens
with "**No binary was executed on an iOS device or simulator**" and explains the CoreSimulator
reason without hedging. Results row 11 (`spike.md:435`) matches. `docs/vault-format.md:522-527`
now says "executed on **macOS**; the real iOS device target linked clean but was never
executed". The conclusion is preserved and correctly weakened only where the evidence was
weaker. This is the fix I asked for, and it is now the *most* carefully-scoped claim in the
document.

### W1 — FTS5 triggers named, not reproduced → **CLOSED**

`docs/vault-format.md:232-247` now carries all three trigger definitions. I diffed them against
`src/shared/infra/migrations/002-imported-type.ts:39-54`: **byte-identical**. The
"a reader never has to reproduce these" note is kept and the reason for including them anyway
(D-D keeps writes open) is stated at `:248-254`.

---

## 3. Independent verification performed for this pass

| Claim | Where | How I checked | Result |
|---|---|---|---|
| Argon2id vector, default params | `spike.md:45-51`, `docs:104` | `argon2` reference CLI, published salt/params | Exact match |
| Argon2id vector, non-default params | `spike.md:56-60`, `docs:105` | same | Exact match |
| Upstream SQLCipher cannot open the fixture (the headline FAIL) | `spike.md:67-76` | `sqlcipher` 4.5.6 CLI, published raw key, throwaway copy | Reproduced: `ok` then `file is not a database (26)` — transcript-identical |
| Literal amalgamation writes, desktop reads back | `spike.md:380-419` | compiled harness + `openVaultDb` pragma sequence + FTS query | Reproduced end to end, integrity ok, 1 search hit, no sidecar |
| Triggers verbatim | `docs:232-247` | `diff` against migration source | Identical |
| Suite | — | `typecheck`/`lint`/`test` | 241/241 green |

`sqlcipher` and `argon2` are present in this container (`/usr/bin/…`), corroborating Tier B's
own account of how it was run.

---

## 4. Acceptance criteria (refined.md §8)

### Applies under every option

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| A1 | No milestone number assigned to mobile; `docs/SPEC.md` §2 Out line untouched | **MET** | `docs/SPEC.md` absent from `git diff main...HEAD --name-only` |
| A2 | No change to `vault.json` schema, Argon2id params, key format, SQLCipher configuration | **MET** | No file under `src/vault/**` or `src/shared/infra/**` in the diff |
| A3 | MCP surface byte-for-byte unchanged (5 tools, 2 prompts, stdio) | **MET** | No `src/delivery/mcp/**` path in the diff; `server.test.ts` unchanged and green |
| A4 | No network call, telemetry, analytics or cloud SDK added | **MET** | `package.json` byte-identical; `.github/workflows/` contains `ci.yml` only |
| A5 | `typecheck && lint && test` pass; `src/` behaviour changes reflected in `specs/*.md` | **MET** | All three clean; no production module edited, so `specs/*` correctly untouched |

### Under the decided scope (D-B Option 2)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| B1 | `docs/vault-format.md` specifies SQLCipher params + raw-key convention; Argon2id params and source; header schema incl. unknown-key stripping; **schema-v3 tables incl. the FTS5 triggers** and `meta` lineage rows; pack assembly; markdown rendering; FTS query construction incl. quote-escaping; `imported` searchable-but-never-packed | **MET** | Previously the only gap was the triggers; now verbatim at `docs/vault-format.md:232-247`, diff-verified against `002-imported-type.ts:39-54` |
| B2 | Read-only contract explicit: no journal pragma, no migration, no lineage bump, no device identity; unknown `schema_version` and `-wal` sidecar behaviour | **MET** | `docs/vault-format.md` §11 — all four prohibitions plus both refusals with exact messages |
| B3 | Committed golden vault + expected pack + expected search; a test proves the desktop reproduces them byte-for-byte | **MET** | `src/testing/__fixtures__/golden-vault/*`; `vault-format-conformance.test.ts:174-227` plain `toBe`, no snapshots |
| B4 | Fixture key/passphrase is a published test value, clearly marked; no real user content | **MET** | fixture `README.md:1-6`, `manifest.json:4-5`, `golden-vault.ts:29-32`, `docs/vault-format.md` §12 |
| B5 | Spike reports pass/fail on official-SQLCipher raw-key open and Argon2id reproduction; params recorded / divergence named + D-G fallback triggered; targets iOS first | **MET** | `spike.md` Results rows 1/2/4/9. Argon2id **PASS** (both vectors, verified by me); raw-key open **FAIL** on Linux and on the official Zetetic SPM package. No single divergent parameter exists — the spike documents that every queryable parameter matches (`spike.md:216-229`) and links two unresolved upstream issues, which is the honest answer. D-G's fallback is not just triggered but empirically verified. C3's relabelling makes the Apple-platform evidence claim exactly as strong as it is |
| B6 | Spike **separately reports pass/fail on a write round-trip**: INSERT via the mobile binding into a throwaway copy, read back through desktop `openVaultDb` | **MET** | `spike.md:380-419` + Results rows 7 and 14 = **PASS**, mirrored into `docs/vault-format.md:528-532`. Reproduced independently by this reviewer (§3). Scope caveat honestly stated at `spike.md:416-419` |
| B7 | The spike leaves no mobile toolchain, dependency or CI job in this repo | **MET** | Final tree: `.github/workflows/ci.yml` only; `advances/M4/` holds `idea/refined/plan/spike/review.md` only; `package.json` unchanged. The write harness was never committed at all |

The "Additional criteria if a Tier 1 app is in scope (D-B Option 1)" block is **N/A** — no app
code exists, correctly.

**Score: 12 of 12 met.**

---

## 5. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — the fix commit adds one `expect` and documentation. No `console.*`/`process.stdout` in either new source file; the only writes outside a temp dir are behind `VALIJA_WRITE_GOLDEN_VAULT` and produce synthetic data; `openVaultDb` is always handed a key before any read; no keychain or KDF code touched. The published passphrase/key remain synthetic and marked as such in four places |
| Tests missing for new behaviour / suite not passing | **PASS** — 241/241 green. The one documented-but-untested contract claim from last pass (the Argon2id vector) is now asserted at `vault-format-conformance.test.ts:241` |
| Advance ritual evidenced (`refined.md` → approved `plan.md` → `review.md`) | **PASS** — `plan.md:1` = `Approved: Oscar 2026-07-26`; `refined.md:3` records Gate R approval; this file completes the trail |
| Naming, clean architecture, file placement | **PASS** — unchanged from last pass and still correct. `src/testing/` is a test-support folder, not a bounded context with layers, and already held a bare `test-vault.ts`. `vault-format-conformance.test.ts` sits at `src/delivery/`'s root exactly like the existing cross-module `multi-device-sync.test.ts`. `__fixtures__/` mirrors `src/importers/infra/parsers/__fixtures__/`. Helper names (`buildGoldenVault`, `copyGoldenVaultTo`, `makeGoldenVaultReader`, `readGoldenVaultManifest`, `FixedIds`) match the `makeUnlockedVault`/`FakeKeychain`/`SeqIds` style. `readGoldenVaultManifest` rather than `parseGoldenVaultManifest` is correct and justified in-file at `golden-vault.ts:85-91`. No new *kind* of domain/application object, so no new subfolder was owed |

**No hard gate is breached.**

---

## 6. Did the fix commit introduce anything new?

Checked deliberately, since a fix commit is where regressions hide.

- **No scope creep.** Three files, all in the advance's own footprint. No `src/` production
  module, no dependency, no CI job, no roadmap edit.
- **No new unsubstantiated claim.** Every new assertion in the fix commit is either something I
  reproduced (write round-trip, triggers verbatim) or a *weakening* of a prior claim (C3).
  The one exception is a stale pointer, **W1** below.
- **Suite intact.** Still 241 tests; the C2 fix strengthened an existing case rather than adding
  a decorative one.
- **The C3 edit is a genuine retreat, not a rewording that preserves the overclaim.** The
  Option 2 conclusion at `spike.md:372-378` now says "confirmed on every platform that could be
  executed, and compiles clean on the two that couldn't", where it previously said "confirmed".

---

## 7. Issues (all non-blocking)

### Warning

**W1. `docs/vault-format.md:535` still promises source that is not there.**
The §13 pointer reads "See `advances/M4/spike.md` §'Option 2 verification' and §'Write
round-trip verification' for the full detail, **including the exact commands and C source**, so
this can be independently re-checked or re-run." Neither section contains C source or a compile
command. The Option 2 `main.c` exists only in this branch's deleted history
(`git show a977045:advances/M4/option2-spike/main.c`); the write harness was never committed
anywhere. This is the same class of defect as C3 — a claim about evidence that overstates what
is actually in hand — in a document whose whole premise is that it must not do that.
*Fix (either):* inline the ~60-line write harness and its `cc` line into `spike.md` §"Write
round-trip verification" (it is fixture-only C, so it lands nothing that violates refined §8's
"no toolchain in this repo"); **or** reword to "…for the full detail and exact results; the
Option 2 harness source is preserved in this branch's history at
`a977045:advances/M4/option2-spike/main.c`."

**W2. `docs/vault-format.md` §13's results table does not carry the write-round-trip PASS.**
Row `:478` still reads `| Write round-trip (literal iOS) | C | DEFERRED — informational only |`
and there is no PASS row; the answer lives only in prose at `:528-532`. A table exists to be
scanned, and this one now understates the advance's own result. The adjacent row `:477`
("Rendered pack / search byte-match … DEFERRED — **blocked on a compatible SQLCipher build
existing**") also carries a reason that is now stale — a compatible build was verified; the
real blocker is that nobody has reimplemented the pack/render algorithm in a second language.
*Fix:* add `| Write round-trip (mobile-side amalgamation write → desktop openVaultDb /
SearchContext read) | — | **PASS** |`, keep the literal-iOS row as `DEFERRED`, and reword
`:477`'s reason to "no second implementation of the pack/render algorithm exists yet".

### Suggestion

- **S1. The second published Argon2id vector is still unpinned.** `docs/vault-format.md:105`
  (8192 KiB / t=1) is the vector that proves "parameters come from the header", and it is the
  one a second implementation would use to test that path. I verified it by hand; nothing in
  the suite defends it. One extra `deriveKey` call in the same case would close it, at ~50 ms.
- **S2. Results rows 7 and 14 are the same answer twice.** `spike.md:431` and `:438` both record
  the write round-trip as PASS. Row 7 also silently lost its `(literal iOS)` scoping and its
  Tier (`C` → `—`), so the literal-iOS write question no longer has a row — whereas the Option 2
  table correctly kept a separate "iOS device target" row for exactly that distinction. *Fix:*
  keep row 7 as `Write round-trip on literal iOS | C | DEFERRED` and let row 14 carry the PASS.
- **S3. Three cross-references point the wrong way**, two of them introduced by the fix commit.
  `spike.md:301` says "see 'Write round-trip verification' **above**" — that section is at
  `:380`, below it. `spike.md:431` and `:438` say "**below**" — it is above them. Small, but this
  is the runbook that is meant to be navigable "with no context from this plan".

### Still standing from the previous pass (explicitly out of scope this round — noted, not penalised)

- **W3 (prev W2)** — `DEFERRED` vs plan D-4's `PENDING` for genuinely open rows
  (`spike.md:427/429/430`, `docs:475-478`).
- **W4 (prev W3)** — the label `C3` still names two different steps (`spike.md:195` and `:293`);
  the new text at `:257` refers to the latter.
- **W5 (prev W4)** — `docs/vault-format.md:296` still under-specifies section-label budgeting.
  The implementation charges labels three different ways (`context-pack.ts:90`, `:107-108`,
  `:120`); an implementer charging by-type labels eagerly would truncate early and diverge from
  `expected-pack.md`. This is the most likely real-world source of a byte-mismatch for a second
  implementation, and it is cheap to fix.
- **W6 (prev W5)** — `docs/vault-format.md:324-326` still says "'latest' means exactly one,
  always", but `context-pack.ts:104` picks the newest handoff **not already pinned**.
- **W7 (prev W6)** — `MAX_LIMIT`/`DEFAULT_LIMIT` (`search-context.use-case.ts:14-15`) are
  published at `docs/vault-format.md:401` and pinned by nothing;
  `manifest.searchLimitDefault` is declared and never read.
- **S4–S10 (prev S1–S7)** — `FixedIds` placement, no README link to the new contract,
  `CHANGELOG` pointing at `advances/M4/`, `reader.close()` skipped on assertion failure,
  unread `fixtureVersion`, the unreachable `Handoffs` label, and the six `ci(M4):` commits that
  a `--no-ff` merge carries into `main`'s history.

W5 and W6 remain the two I would most want taken before this document is handed to a second
implementer, since they are the only places where the contract is *wrong* rather than merely
incomplete. Neither blocks this advance.

---

## 8. Summary

The previous FAIL turned on two missing answers and one overstated one. All three are closed on
their merits, not on assertion: the write round-trip is real and I reproduced it end to end, the
Argon2id vector is now defended by a test that actually bites, and the Apple-platform claim has
been narrowed to exactly what was executed. W1 is closed byte-for-byte. The fix commit is small,
in-footprint, and introduces no regression.

What is left is one stale pointer (**W1**), one table row that undersells the advance's own
result (**W2**), and a list of pre-existing non-blocking items. None of them touch the security
surface, the suite, the ritual, or the repo's conventions.

**Verdict: PASS.**
