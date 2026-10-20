Verdict: PASS

# LIVING-DOCS: Change review (re-review after fixes)

- **Branch:** `feat/living-docs`, HEAD `011821c`.
- **Diff reviewed:** `git diff 2687da7..HEAD`. That is 18 commits: Slices 0–14 plus the fix commit
  `011821c`. I read the fix delta `8e6d825..011821c` in full.
- **Spec:** `advances/LIVING-DOCS/refined.md`. Its Gate R resolutions table is authoritative.
- **Plan:** `advances/LIVING-DOCS/plan.md`. Line 1 is `Approved: Oscar 2026-10-19`.
- **Reviewer:** change-reviewer (hostile, read-only). Date: 2026-10-20.

## Summary

The first review (on `8e6d825`) failed for three reasons:
- **C-1:** the error-code extractor and the D-11 rule had no tests.
- **C-2:** the P-D9 channel-doc rule and the fail-closed paths for entry points had no tests.
- **C-3:** the module map left out `delivery` and did not link `specs/delivery.md` or
  `specs/desktop.md`.

Commit `011821c` resolves all three.

I did not just check that the new tests pass. I broke the code on purpose, in a scratch copy, to
confirm the tests catch it. With the old error-code parser restored, the D-11 filter removed, or
the P-D9 filter removed, the new tests fail.

The C-1 test also exposed a real parser bug: a code whose doc sits right after the `|` was silently
dropped. With the old parser the new test fails 2 of 2. The fix is in place.

Every acceptance criterion is now met and no hard gate is breached. Several non-blocking warnings
remain open (W-2…W-6, W-8, plus new W-9). They are listed below for a follow-up.

## Facts the plan asks review.md to record (re-verified by this reviewer)

| # | Fact | Re-verified? | Result |
|---|---|---|---|
| 1 | Hook check (Slice 0.1) | **Yes.** I ran it in a scratch directory whose `advances/X/plan.md` has no `Approved:` line. | `tools/living-docs/x.ts`: printed "Blocked: …", **exit 2**. `docs/x.md`: **exit 0**. |
| 2 | CLI byte-identity (Slice 4) | **Yes, independently.** I `git archive`d `2687da7` and `HEAD` into the scratchpad, built each with `tsup`, and ran 17 invocations of `node dist/program.js`: `--help`, `--version`, `--help` on all 12 commands, `install nope`, `bogus`, `show`. | `diff -r` over stdout, stderr and exit codes is **empty**. `build-program.ts` holds the old command definitions moved verbatim into `buildProgram(container)`, which ends in `return program`. `program.ts` is a 10-line entry. The fix commit does not touch `src/`. |
| 3 | Biome and Markdown (A3) | **Yes.** | `npx biome check docs/` reports "No files were processed … provided but ignored: docs/". Biome 2.5 does not process `.md`, so `biome.json` correctly stays unchanged. |
| 4 | Deviation: `reachContainerKeys` depth 3 | **Resolved by `011821c`.** | Depth is back to the planned 2. The TSDoc now names the deepest real chain correctly: `export` → `exportCommand` → `exportProjectMarkdown`. Before the revert, I had already confirmed that depth 2 and depth 3 give identical reach for all 12 CLI commands and all 29 IPC channels. The surface tests (`surfaces.test.ts`) still pass. |
| 5 | Final state | **Yes, on `011821c`.** | Root: `typecheck`, `lint` and `test` pass (79 files, **388 tests**). `docs:check` prints `✓ Guide up to date: 20 flows, 268 citations, 449/449 exports documented.` All four exit 0. Desktop: `typecheck` passes and `test` passes (64 files, **930 tests**). |

### Other end-to-end verification (scratch copies, never in the repo)

**Throwaway AC.** I added a `zzthrow` command, a `ZzThrowaway` use case and a `ZZ_THROWAWAY` error
code. After `npm run docs` all three appear in the reference pages without any hand edits.
`docs:check` reports the new command and use case as uncited, and flags the command's missing
desktop counterpart.

**Failure modes.** `docs:check` exits 1 and reports each of these:

| What I broke | What it reported |
|---|---|
| An export with no TSDoc | `undocumented-export`, with file and line |
| A file with an unterminated template | `unscannable-source`, worded "it is not silently skipped" |
| A hand edit to a generated page | `stale-page`, ending "run `npm run docs`" |
| A renamed `## Why` heading | `missing-section` |
| A renamed reference | `broken-reference`, at `file:line` |

**Mutation checks on the fix commit:**

| Mutation | Result |
|---|---|
| Restore the old `readErrorCodes` | `error-codes.extractor.test.ts`: 2 of 2 fail |
| Drop the D-11 finding filter | 1 fails |
| Drop the P-D9 filter in `findUndocumentedChannels` | `ipc-surface.test.ts`: 1 fails |

**Scope.** Outside `src/delivery/cli/{program,build-program,build-program.test}.ts`, every
`src/**` and `desktop/src/**` change is comment-only. The fix commit touches only `tools/` and
`docs/guide/architecture.md`. `CLAUDE.md` is untouched.

**Determinism.** The generated guide has no timestamps, absolute paths or backslashes. There is no
`localeCompare` in `tools/`. Directory listings, catalogue rows, and graph nodes and edges are all
sorted by code unit, and CRLF is normalised on read and on write. CI runs `docs:check` on all six
matrix entries.

## Acceptance criteria (refined §6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| G1 | `docs` writes the README (two entry points), architecture, reference and flow pages, each with a banner | **Met** | `docs/guide/**`. Banner: `file-guide-workspace.ts:8`. Test: `markdown-guide-renderer.test.ts:103`. |
| G2 | No diff on a second run; no timestamps, absolute paths or OS separators; identical across the CI matrix | **Met** | `docs:check` is green. Renderer and catalogue determinism tests. `ci.yml:26` runs on every matrix entry. |
| G3 | Generated Markdown passes lint, or is excluded with a reason | **Met** | Fact 3. |
| G4 | Business section before technical; the diagram matches the steps; links resolve | **Met** | `markdown-guide-renderer.test.ts:110`, `mermaid-diagrams.test.ts:16`. Zero `broken-reference`. |
| R1 | 12 commands, 5 tools + 2 prompts, 29 channels, 13 use cases with summaries and back-links | **Met** | `surfaces.test.ts`, `valija-guide.smoke.test.ts:21`, back-links in `markdown-guide-renderer.test.ts:121`. |
| R2 | Per-module error catalogue covering all 36 codes, with descriptions | **Met** | `reference/errors.md`. Smoke test checks the 36 keys. `error-codes.extractor.test.ts` covers docs before and after `|`, multi-line docs, the D-11 finding, raise sites (including `new DomainError`), and the never-raised label. |
| R3 | Architecture page: module × layer map, dependency diagram, wiring including `ImportItems` | **Met** | `delivery` now has a row (`architecture.extractor.ts:38-56`). `architecture.extractor.test.ts` covers wiring: port labels, an unexposed use case, an inline adapter. The smoke test checks the `ImportItems` node. |
| R4 | Parity table; relocate shown as the known gap; MCP excluded | **Met** | `valija-guide.ts:29-38`, `reference/parity.md`, smoke test. |
| R5 | A throwaway command, use case and error code appear without hand edits | **Met** | Reviewer run (above). |
| C1–C7 | Each check fails demonstrably | **Met** | Unit tests listed in the first review, plus the reviewer's scratch run. |
| C8 | Each failure mode is covered by an automated fixture test | **Met** | The C-1 and C-2 gaps are closed by `error-codes.extractor.test.ts`, `ipc-surface.test.ts` (0 handlers, 2 handlers, missing `ChannelMap` entry, P-D9) and `assertSameNames` (runtime vs static mismatch, shared by CLI and MCP). |
| C9 | `docs:check` passes on the real repo at merge | **Met** | Fact 5. |
| B1 | Every D-6 export meets D-7, including the 9 use cases | **Met** | 449/449. I sampled docs, including the security-relevant ones in `vault/infra`, the IPC handlers and preload. They are accurate and none just restates the name. |
| B2 | One flow per §4.3 row (1–20); all 13 use cases cited | **Met** | 20 sources. Zero `unreferenced-item`. |
| B3 | Flow content matches behaviour | **Met** | See the spot-checks below. |
| S1 | Separate folders; a test enforces the seam | **Met** | `core/seam.architecture.test.ts:20`. |
| S2 | One explicit configuration point; no discovery | **Met** | `valija-guide.ts` `createValijaExtractors`. |
| S3 | The contract has TSDoc and is the only thing extractors implement | **Met** (see W-3) | `core/application/ports/extractor.ts`. All extractors `implements Extractor`. |
| W1 | `docs` / `docs:check` scripts; CI step | **Met** | `package.json`, `ci.yml:26`. |
| W2 | CLI byte-identical after the refactor | **Met** | Fact 2, plus `build-program.test.ts`. |
| W3 | Cross-links in README, SPEC §10, `specs/README.md`, `gui.md`, `sync.md`; module rows link to `specs/<module>.md` | **Met** | Every module row now links to its spec. `delivery` → `specs/delivery.md` and `desktop` → `specs/desktop.md` (`docs/guide/architecture.md:12-18`). |
| W4 | CONTRIBUTING flow how-to and corrected module list | **Met** | `CONTRIBUTING.md` diff. |
| W5 | Root and desktop gates green | **Met** | Fact 5. |
| W6 | No new runtime or dev dependency | **Met** | The `package.json` diff touches only `scripts`. |

## Plan conformance

The slice order matches the plan, and the hook commit came first. Remaining deviations, with my
judgement:

| Deviation | Judgement |
|---|---|
| `GuideWorkspace.readOverview()` added | Fine. |
| `CoverageRequirement.locate` callback | Not strictly data-only (W-3). Non-blocking. |
| `byCodeUnit` placed in `core/domain/result.ts` | W-4. Non-blocking. |
| New `valija/surfaces/segments.ts` (now also holds `assertSameNames`) | S-3. |
| New `valija/testing/source-fixture.ts` (in-memory fixtures, P-D17) | Fine. A `testing/` kind folder mirrors `src/testing/`. Production code never imports it. |
| Per-surface tests merged into `surfaces.test.ts`, plus the new `ipc-surface.test.ts` | Fine now. The fail-closed cases have fixtures. |
| `use-cases.extractor`, `entry-points.extractor`, `inert-container` and `guide-report` have no dedicated unit tests | Acceptable. The real-repo `surfaces.test.ts` and smoke test cover them, and so do the use-case and renderer tests. Their logic is thin composition. The fragile parsing (error codes, IPC, wiring) is now fixture-tested. |
| Size: ~3,123 production TS lines (plan ~2,330, +34%); scanner 382 lines | W-8. |

## Hard gates

| Gate | Status |
|---|---|
| Security surface | **No breach.** <ul><li>The inert-container proxy throws on any access.</li><li>`buildContainer` and `.execute(` are banned statically in `valija/` (`valija-guide.smoke.test.ts:84`).</li><li>MCP introspection stops at `listTools`/`listPrompts`, and commander is never parsed.</li><li>Writes are confined to `docs/guide/`: absolute paths, `..`, `\` and non-`.md` paths are refused, and only banner-carrying files are deleted.</li><li>No network APIs anywhere in `tools/` (seam test).</li><li>The MCP set is pinned at 5 tools + 2 prompts.</li><li>The new security-relevant TSDoc matches the code.</li><li>Error-code docs contain no `;` and no `"UPPER_CASE"` token, and desktop `error-copy.test.ts` passes.</li><li>The secret-shape tripwire (P-D20) is in place.</li></ul> |
| Tests for new behaviour; suite passing | **OK.** 388 root tests and 930 desktop tests pass. The C-1 and C-2 gaps are closed and mutation-checked. |
| Advance ritual | **OK.** `refined.md` (Gate R approved) → `plan.md` with `Approved: Oscar 2026-10-19` → this `review.md`. `CLAUDE.md` is untouched. |
| Naming, architecture, placement | **OK.** The only layer-root file is the approved `core/domain/result.ts` (P-D7). `core/infra/` holds tech-named adapters. `valija/` uses kind folders: `composition/`, `extractors/`, `surfaces/`, `services/`, `testing/`. W-4 and S-3 are placement nits. |

## Flow accuracy spot-checks

| Flow | Checked against | Verdict |
|---|---|---|
| `unlock-vault` | `unlock-vault.use-case.ts`: on a fork, `ok` is returned with the notice and nothing is deleted. The key goes to the keychain, and `recordActivity` runs. | **Correct.** |
| `load-context-pack` | `context-pack.ts`: budget of 4,000 tokens, about 4 characters per token, pinned → latest handoff → decisions, preferences, progress, facts. `imported` is never a section. Desktop `content:pack` equals the unbudgeted export (desktop golden test). | **Correct.** |
| `idle-auto-lock` | `auto-lock-ttl.ts` and `session-guard.ts`: 15 minutes by default, `0`/`off` disables it, a malformed value falls back to the default, the check is lazy, the key is really deleted, and the error is `VAULT_LOCKED`. | **Correct.** |
| `relocate-vault` | Handler docs and the parity known-gap declaration | **Consistent.** |

## Issues

### Critical

None.

### Warning (non-blocking; recommended for a follow-up)

**W-2. Stale parity declarations pass silently.** `surface-parity.ts` never checks that a declared
name exists. A declaration for a removed channel either disappears quietly or renders a dead anchor
link. Add a finding of the form "VALIJA_PARITY declares `x`, which is neither a CLI command nor a
channel".

**W-3. The extractor contract carries a callback.** `CoverageRequirement.locate` (`guide-rules.ts`)
crosses the seam, so the contract is not data-only as D-14 asks. Replace it with data, for example
`locations?: Record<string, { file; line? }>`.

**W-4. `byCodeUnit` lives in `core/domain/result.ts`.** That file is allowed at the layer root only
as the `Result` contract. Move the comparator to `core/domain/services/ordering.ts`.

**W-5. Part of the desktop row is hard-coded.** The cells `"— (uses the src/ use cases)"` and
`"main/infra/, main/ipc/, preload/, renderer/, shared/"` in `architecture.extractor.ts` are literal
strings, not derived from the tree, so they can drift. Derive them with `this.kinds(...)`.

**W-6. The no-home-writes test is weaker than planned.**
- It does not pass an `onTouch` spy to the inert container and assert zero touches.
- Its environment overrides are applied after the static imports, so a home path resolved at import
  time would not be caught.

**W-8. The scanner is 382 lines.** Split it along its existing seam: `lex` (state machine) and
`collect` (declarations and imports).

**W-9 (new). The `delivery` row puts its contents in the `domain` column.** The row reads
`entry points: cli/, mcp/, 5 file(s) | — | —`, so a reader sees delivery's entry points listed as
"domain". The intro sentence explains it, but the table reads wrongly. Possible fixes:
- render the entry-points cell in the `infra` column (delivery is adapters);
- put it in a dedicated note row;
- add a smoke-test assertion that the `delivery` row exists, so this fix cannot silently regress
  (today only the staleness check pins it).

**Open from the first review, not raised again as W-1.** `use-case-reach.ts` shares one `visited`
set across the whole walk. A callable first reached with a small remaining depth is never revisited
at a larger depth, so results can depend on call order. Real reach is complete today.

### Suggestion (nits)

- **S-1.** Bare `.sort()` calls in `use-case-reach.ts`, `entry-points.extractor.ts` and
  `segments.ts` `assertSameNames`. They are deterministic, but `byCodeUnit` would be consistent with
  the rest of the code.
- **S-2.** `file-guide-workspace.ts`:
  - replace the inline `import("node:fs").Dirent` with `import type { Dirent }`;
  - `readOverview` should treat only `ENOENT` as an empty overview, not every error.
- **S-3.** `segments.ts` (`segmentByMarker`, `assertSameNames`) holds text helpers, not surfaces.
  `valija/services/` is a better home.
- **S-4.** `ipc-surface.ts` `readChannelMap`:
  - it renders `"?"` when it cannot read a type; failing closed would be safer;
  - `indexOf` finds only the first occurrence of a handler key, so a comment containing the key can
    shadow the real one.
- **S-5.** `architecture.extractor.ts` `constructorTypes` splits parameters on `,`. It survives
  today's generics only because the fragments it cannot read are filtered out. A generic that
  contains a `:` (for example `Record<string, { a: T }>`) would mislabel ports. A depth-aware
  split, like the existing `splitArguments`, would be robust.
- **S-6.** `unlock-vault.md` could list `{{err:VAULT_UPGRADE_REQUIRED}}` (desktop path).

## Line count

| Area | Lines |
|---|---|
| Whole diff (`git diff --shortstat 2687da7..HEAD`) | 243 files changed, 10,489 insertions, 131 deletions |
| `tools/living-docs` production TS | **3,123** |
| `tools/living-docs` tests | **1,525** |
| Hand-written flows | 939 |
| Generated guide | 1,865 |
| `src/**` + `desktop/src/**` | Comment-only, apart from the CLI `buildProgram` extraction and its test |

## Note for the orchestrator

- **CLAUDE.md per-slice command.** Changing it to
  `npm run typecheck && npm run lint && npm run test && npm run docs:check` is **Oscar's edit**
  (D-5, "Note for Oscar"). Propose it to him after merge as a one-tap question. The implementer
  correctly did not make it.
- **Surface parity.** This advance adds no user capability. The parity table declares relocate as
  the known gap and excludes MCP, as CLAUDE.md requires.
