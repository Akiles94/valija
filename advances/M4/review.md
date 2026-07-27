# M4 — Vault format contract, conformance fixture & compatibility spike · Review

Verdict: FAIL

**Branch:** `docs/vault-format-M4` · **Base:** `main` · **Reviewed at:** `2f3063c`
**Spec:** `advances/M4/refined.md` (Gate R, Oscar 2026-07-26) ·
**Plan:** `advances/M4/plan.md` (carries `Approved: Oscar 2026-07-26` on line 1 ✓)

This is a strong advance that does substantially more empirical work than the plan asked
for. It fails on two specific, cheap-to-close gaps and one factual overclaim, all listed
under **Critical** below. Nothing here is a security regression, and nothing here requires
re-planning.

---

## 1. Line count

| Artifact | Lines | Plan estimate |
|---|---|---|
| `docs/vault-format.md` | 521 | ~500 |
| `advances/M4/spike.md` | 385 | ~200 |
| `src/testing/golden-vault.ts` (the only non-test `src/` addition) | 272 | ~150 |
| `src/delivery/vault-format-conformance.test.ts` | 261 | ~190 |
| Fixture data (`seed.json`, `expected-*`, `manifest.json`, `README.md`, `vault.json`) | 360 | ~420 |
| `.gitattributes` + `CHANGELOG.md` | 5 | ~5 |
| `src/testing/__fixtures__/golden-vault/vault.db` | binary, 61,440 B | ~60–120 KB |
| **Total** | **+1,816 / −0**, 14 files, 1 binary | ~1,470 |

Over the estimate by ~23%, driven by `spike.md` (nearly double, justified — it carries four
tiers of real results the plan only budgeted a runbook for) and `golden-vault.ts` (272 vs
150). No file is oversized for what it does.

Suite: `npm run typecheck` ✓, `npm run lint` ✓ (one pre-existing biome-config `info`, present
on `main`), `npm run test` ✓ — **48 files, 241 tests passing**; the 10 new conformance cases
all green, full run 7.0 s.

---

## 2. Acceptance criteria (refined.md §8)

### Applies under every option

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| A1 | No milestone number assigned to mobile; `docs/SPEC.md` §2 Out line untouched | **MET** | `git diff main...HEAD --name-status` — `docs/SPEC.md` absent from the diff; `docs/vault-format.md` and `spike.md` assign no milestone |
| A2 | No change to `vault.json` schema, Argon2id params, key format, SQLCipher configuration | **MET** | No file under `src/vault/**` or `src/shared/infra/**` in the diff; `src/shared/infra/sqlite.ts:19-20` and `src/vault/infra/argon2.ts` unmodified |
| A3 | MCP surface byte-for-byte unchanged (5 tools, 2 prompts, stdio) | **MET** | No `src/delivery/mcp/**` path in the diff; `server.test.ts` unchanged and green |
| A4 | No network call, telemetry, analytics or cloud SDK added, mobile or desktop | **MET** | `package.json` byte-identical; no `fetch`/`http` in the two new source files; `.github/workflows/` contains only `ci.yml` |
| A5 | `typecheck && lint && test` pass; `src/` behaviour changes reflected in `specs/*.md` | **MET** | All three run clean above; no production module edited, so `specs/*` correctly untouched |

### Under the decided scope (D-B Option 2)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| B1 | `docs/vault-format.md` specifies SQLCipher params + raw-key convention; Argon2id params and their source; `vault.json` schema incl. unknown-key stripping; **schema-v3 tables incl. the FTS5 external-content triggers** and `meta` lineage rows; pack assembly incl. token estimate, over-budget pinned rule, section order; markdown rendering; FTS query construction incl. quote-escaping; `imported` searchable-but-never-packed | **NOT MET** (one sub-item) | Everything present and accurate **except the FTS5 triggers**: `docs/vault-format.md:231-234` replaces them with a comment naming `items_ai`/`items_ad`/`items_au` instead of reproducing them. Source is `src/shared/infra/migrations/002-imported-type.ts:39-54`. Plan Slice 5 §6 said "verbatim". See **W1** |
| B2 | The read-only contract is explicit: no journal pragma, no migration, no lineage bump, no device identity; behaviour on unknown `schema_version` and on a `-wal` sidecar | **MET** | `docs/vault-format.md:384-417` — all four prohibitions plus both required refusals, with the exact messages |
| B3 | Committed golden vault + expected pack + expected search exist; a test proves the desktop reproduces them byte-for-byte | **MET** | `src/testing/__fixtures__/golden-vault/{vault.db,vault.json,expected-pack.md,expected-export.md,expected-search.json}`; `src/delivery/vault-format-conformance.test.ts:174-227` — plain `toBe` byte-compare, no snapshots. A renderer or pack-algorithm change fails the build |
| B4 | Fixture key/passphrase is a published test value, clearly marked; no real user content | **MET** | `src/testing/__fixtures__/golden-vault/README.md:1-6`; `manifest.json:4-5` + `golden-vault.ts:29-32`; `docs/vault-format.md:439-441`. `seed.json` is entirely synthetic |
| B5 | Spike reports **pass/fail** on official-SQLCipher raw-key open and Argon2id reproduction; params recorded on pass / divergent param named + D-G fallback triggered on fail; targets iOS first | **MET, with a caveat** | `spike.md:356-373` rows 1/2/4/9. Argon2id **PASS** (B1, two vectors); raw-key open **FAIL** on Linux and on the official Zetetic SPM package via macOS CI. No divergent parameter could be named — the spike documents that *every* queryable parameter matches (`spike.md:216-229`), which is the honest answer, and D-G's fallback is not just triggered but empirically verified. iOS-first sequencing honoured (Tier C′ used the exact SPM package an iOS app would declare) |
| B6 | Spike **separately reports pass/fail on a write round-trip**: INSERT via the mobile binding into a throwaway copy of the fixture, reopened and read back through desktop `openVaultDb` | **NOT MET** | `spike.md:366` row 7 reads `DEFERRED — Informational only`, not PASS/FAIL. The stated blocker (`spike.md:257-258`, "Nothing to test until a compatible SQLCipher build (D-G's Option 2) exists") is **stale by the end of the same document**: `spike.md:318-354` proves such a build exists and executes against the real fixture on Linux, Darwin/arm64 and a booted Android emulator. See **C1** |
| B7 | The spike leaves no mobile toolchain, dependency or CI job in this repo | **MET** | Final tree verified: `.github/workflows/` holds `ci.yml` only; `advances/M4/` holds `idea/refined/plan/spike.md` only; `package.json` unchanged. `git log --diff-filter=D` confirms `m4-tier-c-spike.yml`, `m4-option2-spike.yml`, `advances/M4/tier-c-spike/**` and `advances/M4/option2-spike/main.c` were all deleted in the commits that recorded their results |

The "Additional criteria if a Tier 1 app is in scope (D-B Option 1)" block is **N/A** — no
app code exists, correctly.

**Score: 10 of 12 met.** B1 (partial) and B6 (not met) block the verdict.

---

## 3. Plan compliance

Slices 1–6 were executed essentially as written: fixture at
`src/testing/__fixtures__/golden-vault/` (D-2), `VALIJA_WRITE_GOLDEN_VAULT=1` regeneration
branch that deliberately throws (`vault-format-conformance.test.ts:116-118`, D-3), production
KDF params in the fixture (D-6), cipher pragmas asserted **including the exact key set**
(`vault-format-conformance.test.ts:161-162`, D-7), no second `-wal` fixture (D-8), no
`docs/SPEC.md` edit (D-9), `*.db binary` added to `.gitattributes` (Slice 2 step 7).

**Deviations, all disclosed and defensible:**

1. **Slice 7's human gate was replaced by CI-based execution.** Oscar had no Mac
   (`29e425c`). Rather than taking D-4's fallback verbatim (ship Tiers A+B, mark iOS
   `PENDING`), the implementer ran Tier C′ on a GitHub Actions `macos-latest` runner with the
   official `SQLCipher.swift` SPM package, then the `legacy=4` re-check, then a full Option 2
   verification. This is *more* evidence than the plan required and it is the right call.
   One wording concern: D-4's fallback specifies `PENDING`; the delivered table uses
   `DEFERRED — low value` for the remaining iOS rows, which reads as a closed decision rather
   than an outstanding obligation. See **W2**.
2. **The plan's test-plan table (§4, row 2) promises the published Argon2id vector is
   "asserted by the derivation case (Slice 2/3)". There is no such assertion.** See **C2**.
3. **FTS triggers documented by name, not verbatim** (plan Slice 5 §6). See **W1**.

No scope creep toward the app (plan R6): no Swift/Kotlin/`mobile/` artifact survives, no
biometric or picker work, no roadmap edit.

---

## 4. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — no `console.*` anywhere in the two new source files; the only writes outside a temp dir are behind `REGENERATE` and produce synthetic fixture data; `openVaultDb` is always handed a key before any read (`golden-vault.ts:156`, `vault-format-conformance.test.ts:144`); no keychain or KDF code touched. The published passphrase/key are synthetic and marked as such in four places |
| Tests missing for new behaviour / suite not passing | **PASS on the suite** (241/241). One documented contract claim ships untested — see **C2** — which is a drift hole, not a red suite |
| Advance ritual evidenced (`refined.md` → approved `plan.md` → `review.md`) | **PASS** — `plan.md:1` = `Approved: Oscar 2026-07-26`; `refined.md:3` records Gate R approval; this file completes the trail |
| Naming, clean architecture, file placement | **PASS** — `src/testing/` is a test-support folder, not a bounded context with layers, and already held a bare `test-vault.ts`; `golden-vault.ts` sits beside it. `vault-format-conformance.test.ts` sits at `src/delivery/`'s root exactly like the existing cross-module `multi-device-sync.test.ts`. `__fixtures__/` mirrors `src/importers/infra/parsers/__fixtures__/`. Helper names (`buildGoldenVault`, `copyGoldenVaultTo`, `makeGoldenVaultReader`, `readGoldenVaultManifest`, `FixedIds`) match the existing `makeUnlockedVault`/`FakeKeychain`/`SeqIds` style. `readGoldenVaultManifest` rather than `parseGoldenVaultManifest` is correct — `parseX → Result` is for untrusted input crossing a domain boundary, and the deviation is justified in a comment at `golden-vault.ts:85-91`. No new *kind* of domain/application object was introduced, so no new subfolder was owed |

**No hard gate is breached.** The FAIL is on acceptance criteria B6 and B1, plus C3.

---

## 5. Issues

### Critical — must be fixed to flip this to PASS

**C1. The write-round-trip criterion is unanswered, and it is now answerable.**
`advances/M4/spike.md:366` records row 7 as `DEFERRED`. refined §8 asks for `pass/fail`, and
goes out of its way to say a FAIL is acceptable and non-blocking — so `DEFERRED` is not a
permitted outcome, it is a missing one. The spike's own justification is stale: lines 257-258
say the round-trip is "blocked on C2 passing… Nothing to test until a compatible SQLCipher
build (D-G's Option 2) exists", but lines 318-354 then prove exactly such a build, running
the unmodified `SQLite3MultipleCiphers` amalgamation against the real `legacy=0` fixture and
reading real rows back on Linux, Darwin/arm64 and a booted Android x86_64 emulator.

*Fix:* extend the existing 47-line `main.c` harness with one `INSERT INTO context_items`
(valid `type`, `project_id = 'proj-alpha'`) against a throwaway copy, run it on whichever
target already executes, move the file back, and reopen it with desktop `openVaultDb` —
`node dist/program.js unlock` + `search`, per the runbook's own step 4
(`spike.md:302-312`). Record PASS/FAIL in `spike.md` row 7 and mirror it into
`docs/vault-format.md` §13. Also delete or correct the stale "blocked on C2" paragraph.
If Oscar prefers not to spend that time, the alternative is his explicit, recorded waiver of
this checkbox — but the reviewer cannot grant it.

**C2. The published Argon2id test vector is not defended by any test.**
`docs/vault-format.md:104` publishes
`3e53d9f1…dc67` as *the* derivation of the published passphrase + salt + params, and
`spike.md:45-51` records it as the PASS that "closes the Argon2id half of H1a". Nothing in
the suite asserts it. `vault-format-conformance.test.ts:142-152` opens the vault with the
**stored** `manifest.keyHex` (so a derivation change cannot fail it), and
`vault-format-conformance.test.ts:236-237` deliberately substitutes the freshly derived key:

```ts
const built = await buildGoldenVault(root, manifest, seed);
const reader = makeGoldenVaultReader(root, { ...manifest, keyHex: built.keyHex });
```

`manifest.keyHex` and the derivation are therefore fully decoupled: an Argon2id parameter or
adapter change would leave the whole suite green while silently invalidating the vector every
second implementation is told to check first. The plan's §4 test-plan row 2 explicitly
promised this assertion.

*Fix:* one line in the "rebuilding from the seed" case, at zero extra cost since
`buildGoldenVault` already performs the derivation:
`expect(built.keyHex).toBe(manifest.keyHex);`. Consider also pinning the second, non-default
vector (`docs/vault-format.md:105`) — it is currently unverifiable from this repo, and it is
the vector that proves "parameters come from the header".

**C3. A macOS-target run is published as an iOS run.**
`spike.md:339` labels the platform `iOS (arm64)` while the toolchain column reads
`-target arm64-apple-macos13.0` — a macOS binary. The iOS *device* target was link-checked
only. Results row 11 (`spike.md:370`) then reads "compile + **run**, iOS (arm64) — **PASS**",
and `docs/vault-format.md:502-503` states the harness was "run against valija's real
production golden-vault fixture … on Linux, **on iOS** …, and on Android". No binary was
executed on an iOS device or simulator. In an advance whose entire premise is that a contract
must not claim verification it does not have (plan D-4), this is the one claim that
overstates its evidence.

*Fix:* relabel that row `Apple/Darwin (arm64)` with "executed on macOS; iOS device target
link-checked only", change Results row 11 to match, and reword `docs/vault-format.md` §13 to
"on Linux, on Apple arm64 (macOS execution, iOS device target link-verified), and on
Android". The conclusion survives intact — this is a wording correction, not a retraction.

### Warning — should be fixed

**W1. §6 omits the FTS5 triggers refined §8 names explicitly.**
`docs/vault-format.md:231-234` names `items_ai`/`items_ad`/`items_au` in a comment and says
"a reader never has to reproduce these". Defensible for a pure reader, but the criterion asks
for them, the plan said "verbatim", D-D keeps writes open as a real future step, and the
document's own §14 write-round-trip step (`spike.md:300`) tells an implementer to rely on
"the FTS triggers keep the index in step automatically" — which they cannot verify without
the definitions. *Fix:* paste the 16 lines from
`src/shared/infra/migrations/002-imported-type.ts:39-54` into §6, keeping the "a reader never
has to reproduce these" note.

**W2. `DEFERRED` vs `PENDING`, and stale prose in `spike.md`.** Plan D-4's fallback
prescribes `PENDING — iOS not yet run`; the delivered table uses
`DEFERRED — low value / informational only`, which reads as a decision rather than an open
obligation. Separately, the "What C2's result doesn't answer, still open" block
(`spike.md:253-258`) is contradicted by the "Option 2 verification" section immediately
below it. *Fix:* restore `PENDING` for any genuinely open row and delete or rewrite the stale
block.

**W3. `spike.md` uses the label `C3` for two different steps.** `spike.md:195`
("C3 — Raw-key open, official SPM package, `legacy=4`") and `spike.md:289`
("C3 — Pack and search byte-match"), with `spike.md:257` referring to the latter. In a
runbook explicitly written so "whoever runs it needs no context from this plan", a duplicated
step id is a real navigation hazard. *Fix:* renumber the `legacy=4` re-check to `B3′/C2′`.

**W4. §8's section-label budgeting is under-specified for byte-identical output.**
`docs/vault-format.md:296` says heading labels are "added once per section, not per item".
The implementation charges them three different ways: `Pinned` is charged unconditionally
before the loop (`context-pack.ts:90`); `Latest handoff` is folded into a single all-or-
nothing affordability check (`context-pack.ts:107-108`); a by-type label is charged only
inside the *first candidate's* check, so a section whose first item does not fit is charged
nothing (`context-pack.ts:120`). A second implementation charging by-type labels eagerly
would truncate earlier and diverge from `expected-pack.md`. *Fix:* three sub-bullets spelling
this out; note also that the by-type label costs the **domain type name** (`"decision"`), not
the rendered heading (`"Decisions"`).

**W5. §8's "latest handoff" rule omits the already-included clause.**
`docs/vault-format.md:304-306` says "'latest' means exactly one, always" and "Older handoffs
are never shown". `context-pack.ts:104` selects the newest handoff **not already in the
Pinned section** — so if the newest handoff is pinned, the section shows the *second*-newest
handoff. Not exercised by the fixture. *Fix:* add "…the newest handoff that was not already
included in the Pinned section".

**W6. Two published search constants have no test and no fixture coverage.**
`docs/vault-format.md:381-382` publishes "clamped to 1..100, default 20"; `MAX_LIMIT`/
`DEFAULT_LIMIT` live at `search-context.use-case.ts:14-15` and neither is pinned by the
"pins the documented constants" case (`vault-format-conformance.test.ts:229-232`), which
covers only `DEFAULT_BUDGET_TOKENS` and `estimateTokens`. `manifest.searchLimitDefault: 20`
is declared, published and never read by any code. *Fix:* add two assertions in the same
case, and either assert `manifest.searchLimitDefault` or drop the field.

### Suggestion — non-blocking

- **S1. `FixedIds` placement.** `golden-vault.ts:101-110` sits away from its three siblings
  (`FakeKeychain`, `FixedClock`, `SeqIds`, `FakeDeviceIdentity`) in
  `src/testing/test-vault.ts`. Moving it beside `SeqIds` keeps the repo's test doubles in one
  discoverable place; nothing about it is golden-vault-specific.
- **S2. Zero discoverability for the new contract.** `docs/vault-format.md` is linked from no
  index — `README.md:204-205` lists `docs/sync.md` and `docs/SPEC.md` only. Plan D-9 left the
  README link optional; a one-line entry costs nothing and is the difference between a
  contract a second implementer finds and one they do not.
- **S3. `CHANGELOG.md`'s new entry points users at `advances/M4/`.** A user-facing changelog
  referencing an internal advance directory is unusual for this repo; the `docs/vault-format.md`
  link alone would read better.
- **S4. `reader.close()` is skipped on assertion failure** in six cases
  (`vault-format-conformance.test.ts:183`, `197`, `211`, `243`, and the surrounding blocks).
  Harmless today — `SqliteVaultSessions.withSession` closes the database in a `finally`
  (`vault-sessions.ts:30-34`) and `close()` only clears an in-memory keychain entry — but it
  is a pattern that stops being harmless the moment the reader owns anything real. A small
  `unwrap(result)` helper that throws would remove the repeated
  `expect(result.ok).toBe(true); if (!result.ok) return;` and make `close()` unconditional.
- **S5. `fixtureVersion` is published and never read** (`manifest.json:2`,
  `golden-vault.ts:27`). Either assert it in the conformance test so a fixture-format change
  is a deliberate act, or drop it.
- **S6. §9 omits the `Handoffs` label.** `context-pack-markdown.ts:11` defines it; it is
  currently unreachable because `SECTION_TYPE_ORDER` excludes `handoff`. Worth one sentence so
  an implementer reading the table does not think the renderer is incomplete.
- **S7. Branch history retains the deleted spike artifacts.** A `--no-ff` merge carries
  `m4-tier-c-spike.yml`, `m4-option2-spike.yml`, the SPM package and a second encrypted
  fixture into `main`'s history permanently. The final tree is clean and none of it contains a
  real secret, so the acceptance criterion is met — but squashing the six `ci(M4):` commits
  before merge would keep `main`'s history matching what the advance actually shipped.

---

## 6. What would flip this to PASS

1. **C1** — answer the write round-trip with an explicit PASS/FAIL in `spike.md` row 7 and
   `docs/vault-format.md` §13, using the Option 2 harness that already executes, and remove
   the stale "blocked on C2" paragraph. (Or record Oscar's explicit waiver of refined §8's
   write-round-trip checkbox.)
2. **C2** — `expect(built.keyHex).toBe(manifest.keyHex);` in the rebuild case, so the
   published Argon2id vector cannot drift silently.
3. **C3** — relabel the Darwin/arm64 execution honestly in `spike.md` (platform column,
   Results row 11) and in `docs/vault-format.md` §13.
4. **W1** — paste the three FTS5 triggers verbatim into `docs/vault-format.md` §6.

W2–W6 and S1–S7 are not merge blockers, but W4 and W5 are cheap and directly serve this
document's stated purpose (a second implementation that never reads `src/`), so they are
worth taking in the same pass.

**What this advance got right, and should not be lost in a revision:** the cipher parameters
are probed from a live database rather than transcribed from documentation, and the exact key
set is asserted (`vault-format-conformance.test.ts:154-163`) so a dependency bump cannot drift
silently; the raw-key salt convention — the single fact most likely to strand a mobile client
— is verified against the file's own bytes (`:165-172`); the read-only discipline the contract
demands of others is enforced on this repo by the SHA-256 no-mutation case (`:248-260`); the
regeneration path fails on purpose so a stray env var can never green-wash CI (`:116-118`);
and the spike reports a headline **FAIL** on the advance's own premise, then does the harder
work of proving the fallback empirically instead of asserting it. That is the honest version
of this advance, and it is why the fixes above are small.
