Verdict: FAIL

# IMPORT-FEEDBACK — change review

Reviewed at `f5ffbd4`, diffed against `0777d4c` (CONNECT's last commit on
`claude/valija-desktop-launch-strategy-4mwugz`). Six commits: `8e034f5` (the `Approved:` line),
`c3bb23e` (Slices 0–2), `f012cdf` (Slice 3), `81decda` (Slice 4), `f4c1722` (Slice 5), `f5ffbd4`
(Slice 6). Every claim below is re-derived from the diff and from the files at HEAD, not from the
commit messages or the hand-off summary.

## Line count

| Category | Lines |
| --- | --- |
| Production TS/TSX | **+284 / −95** (plan estimated ~146 TS) |
| CSS | +60 (plan estimated ~45) |
| Tests | **+472 / −3** (plan estimated ~340) |
| Docs (`docs/gui.md`) | +7 |

`import.tsx` is +174/−78 against a plan estimate of "~85 net"; the file went 270 → 367 lines
(plan said "roughly 340"). Over, but not by a factor that indicates smuggled scope — the file list
below is exact.

## Suites — re-run by me at review time on the working tree

| Suite | Result |
| --- | --- |
| root `npm run typecheck` / `lint` / `test` | **pass, exit 0** — 59 files, **324 tests** |
| `desktop/` `npm run typecheck` / `lint` / `test` | **pass, exit 0** — 55 files, **792 tests** |

## File-count check (plan §"Security-sensitive surfaces" item 10)

`git diff --name-only 0777d4c..HEAD -- desktop src` prints exactly the 14 paths plan.md lists
(7 production, 7 test) — verified path by path. Plus `docs/gui.md` (Slice 6) and
`advances/IMPORT-FEEDBACK/plan.md` (the `Approved:` line). **No** hit under `src/` other than
`importers/application/use-cases/import-conversations.use-case.{ts,test.ts}`, **no**
`desktop/src/preload/`, **no** `desktop/src/shared/ipc/`, **no** `package.json`, **no**
`src/delivery/mcp/`. Scope is clean.

---

## 1. Acceptance criteria (refined.md §6)

### Busy state (steps 2, 4, 6)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| B1 | Visible in-progress state *before* main begins the synchronous work, **verified manually on Windows with a real large export** | **Not met — not performed** | The mechanism exists: `next-paint.ts:14-23` (double-rAF + task), awaited at `import.tsx:105` and `:165` before every blocking bridge call. But §6's bullet requires the *measurement*, and it was not run (no Windows host, no reproducible freeze in this sandbox). No Oscar deferral exists for it. Disclosed, not hidden — see §5. This is the criterion refined.md §10 calls "the one thing that decides whether the advance landed" |
| B2 | Both action buttons disabled for the whole run; the pressed button's label reflects the state | **Met** | `import.tsx:346-361` — both carry `disabled={!canSubmit \|\| working !== null}`; `:352` renders `import.previewingShort`, `:359` `import.importingShort` when pressed. `import.dom.test.tsx:132-133` asserts both disabled mid-run, `:139-140` both re-enabled after |
| B3 | Choosing a file shows the reading state and disables the chooser | **Met** | `import.tsx:104` `beginWork("reading")`, `:187` renders `import.detectingFormat`, `:265` chooser `disabled={working !== null}`. `import.dom.test.tsx:244-245` |
| B4 | In-progress copy never claims another save is in progress; `busyRetrying` removed from both catalogs; `catalogs.test.ts` parity passes | **Met** | `en.ts` / `es.ts` diffs delete `busyRetrying` and add the five keys with matching placeholders; `import-copy.test.ts:38-40` asserts `Object.hasOwn(...,"busyRetrying") === false` for both, `:42-49` asserts no `import.*` string matches `/another save\|otro guardado/i` or `/retrying\|reintentando/i`. `catalogs.test.ts` untouched and green |

### Result and error (steps 7, 8)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| R1 | Result and error appear in the **same region as the action buttons**, not at the top of a page the user has scrolled away from (D-4); region is `aria-live` | **NOT MET** | `aria-live="polite"` is present (`import.tsx:225`). The **placement is wrong**: `.import-status` (`import.tsx:223-262`) is a direct child of `.screen.import`, rendered at line 223 — *before* `stage === "choose"` (`:264`), *before* `stage === "formatOverride"` (`:270`) and *before* the whole `stage === "listed"` block (`:287-363`). The action buttons stayed **inside** `.import-listing`, at `:346-361`. So in the listed stage the file name, conversation count, filter row, sort button, the 320px conversation list, the project picker and the new-project input all sit **between** the status region and the buttons. This is the top-of-screen placement §6 explicitly rules out, and it contradicts the spec's own mockup (refined.md §3, status region *under* the picker, *above* the buttons), D-4 Option A ("immediately above the action buttons"), plan.md Slice 3 step 9 ("`.import-listing` keeps: display name, count, filter, sort, list, project picker… both action buttons and the result block **leave** it… After the listing branch, unconditionally: `<div className="import-status">`… **Then**, for the listed stage only, `<div className="actions">`"), and the code's own CSS comment at `screens.css:278` ("One region for busy, result and error (D-4), **immediately above the actions** — where the user's eyes and cursor already are"). Details and the fix in §6 C1 |
| R2 | Starting a new run clears the previous run's summary before the new one begins | **Met** | `beginWork` (`import.tsx:75-81`) clears `error`, `resultOutcome`, `resultMode`; called at `:104` and `:164`. `import.dom.test.tsx:189-190` asserts the old summary is gone *and* the new busy line is up while the second run is in flight |
| R3 | A rejected `bridge.import.*` call leaves the screen usable | **Met** | `try/catch/finally` at `import.tsx:106-127` (loadListing) and `:166-181` (runSelection); `catch { setError(errorCopy(REJECTED_CALL_CODE)); }` with `endWork()` in `finally`. `import.dom.test.tsx:194-205` drives a real rejection and asserts both buttons re-enabled and `.import-status .error` non-null |
| R4 | A second click while a run is in flight never starts a second run, even when delivered after a freeze | **Met (implementation); test is weaker than it claims** | `workingRef` (`import.tsx:62`) is set synchronously inside `beginWork` (`:76`) and checked at the top of all three entry points (`:90`, `:103`, `:150`), cleared only in `endWork` (`:85`) which is reached from every `finally`. That is P-D4 implemented correctly. `import.dom.test.tsx:207-223` asserts `run` called once — but the second `fireEvent.click` lands on a button React has already rendered `disabled`, so the assertion holds with or without `workingRef`; the test cannot attribute the outcome to the guard. See §6 W2 |
| R5 | Result block still shows per-conversation failures and `import.excludedFromPacksNotice`, unchanged | **Met** | `import.tsx:247-259` is the old block moved verbatim. `import.dom.test.tsx:274-293` (failures + notice on import) and `:295-302` (no notice on preview) |

### Layout (step 3)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| L1 | With several hundred conversations, project picker, status region and both buttons reachable without an extreme scroll, default window size, **both languages** | **Not met (unverified, and probably false)** | D-6 is implemented: `screens.css:252-260` gives `.conversation-list` `max-height: 320px; overflow-y: auto`. But plan.md's **"Manual bilingual check (required, not optional)"** was not performed, and R1's placement makes the criterion doubtful rather than merely unverified: with the region at the top and the buttons at the bottom, the listed-stage stack at the default 1100×720 window (`main-window.ts:17-18`; `.screen` padding 24px, `base.css:43-47`) is roughly nav-bar + h1 + explainer + a populated status region (~90–140px, taller in Spanish where both `import.previewing` and `mayStopResponding` wrap) + file name + count + filter row + 320px list + picker + input + actions ≈ 790–840px against ~670px of usable viewport. The region and the buttons are then never on screen together — the exact failure D-4 exists to prevent. This is an estimate, not a measurement; the required manual check is the decider, and it is outstanding |

### Project-name honesty (V8 / Problem 2)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| P1 | Previewing with an invalid name fails **at Preview**, with the same localized `INVALID_PROJECT_NAME` message Import would show | **Met** | `import-conversations.use-case.ts:103-109` — `parseProjectName(input.projectName ?? "")` runs after the `list` early-return (`:95-101`) and **before** `selectConversations` (`:111`), so it covers `dry-run` and `import` alike. The renderer already renders `errorCopy(result.error.code)` (`import.tsx:172`) for both paths, so the two show the identical string |
| P2 | Preview and Import always agree — both succeed or both fail | **Met** | Single guard on the shared path; `ImportItems`' own `parseProjectName` is untouched (defense in depth). Tests: `import-conversations.use-case.test.ts:78-90` (dry-run) and `:92-104` (import) |
| P3 | `list` mode unaffected | **Met** | The `list` branch returns at `:95-101`, before the new guard. `import:list` (`import-handlers.ts:90-103`) passes no `projectName` and its existing handler tests stay green |
| P4 | A test exists that fails against today's use case and passes after | **Met** | `import-conversations.use-case.test.ts:78-90`: against `0777d4c` the dry-run branch never called `parseProjectName`, so `execute` returned `ok` — `expect(r.ok).toBe(false)` was red. Re-derived from `git show 0777d4c:src/.../import-conversations.use-case.ts` |

### Cross-cutting

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| X1 | A test exists that **fails against today's `import.tsx`** and passes after (D-12) | **Met** | Re-derived against `git show 0777d4c:desktop/src/renderer/screens/import.tsx`: case 1 (`/importing 3 items from 1 conversations/`) — old code rendered `import.busyRetrying`, red. Case 2 — same, red. Case 3 (stale summary cleared) — old `runSelection` never cleared `resultOutcome`, red. Case 4 (rejection) — old code had no `try/catch`, red. Case 6 (reading state) — old `loadListing` had no busy state, red. Case 7 — old code rendered `<p className="error">` as a direct child of `.screen.import` and had no `.actions` element, red twice over. Six cases genuinely red. **Correction to the hand-off note:** case 5 was almost certainly *green* against the old code too (the old `setWorking(mode)` already disabled the buttons before the second `fireEvent.click`), so "7 of 9 failed" overstates it. The criterion is still met |
| X2 | `typecheck && lint && test` green in repo root **and** `desktop/` | **Met** | Re-run by me: 324 and 792 tests, exit 0 on all six commands |
| X3 | Diff touches no `src/**` except `import-conversations.use-case.{ts,test.ts}`, no `desktop/src/shared/ipc/**`, no preload, no `package.json` | **Met** | See the file-count check above |
| X4 | `docs/gui.md` describes the three moments | **Met** | `docs/gui.md:206-212` — reading, working with counts + disabled buttons, and the result/failure in the same spot, plus D-10's may-stop-responding warning |
| X5 | No import semantics changed — same parser resolution, selection, single write, counts, deterministic ids | **Met, with one deliberate ordering change** | Nothing in the write path moved. The new guard changes *which* error wins when an invalid name and a selection error are both true (plan.md's own risk table names this and accepts it), and a programmatic `dry-run` with no `projectName` now returns `INVALID_PROJECT_NAME` instead of a summary. Unreachable from the CLI (`import-command.ts:31-34` requires `-p` whenever a selection flag is present) and from the desktop (`import:preview`/`import:run` always send `projectName`) |

---

## 2. Plan conformance

Slices 0, 1, 2, 4, 5 and 6 match plan.md as written, including the details the plan flagged as traps:
`import:list`/`import:preview` stay **synchronous** (`import-handlers.ts:90`, `:105` — no `async`, so
`import-handlers.test.ts`'s existing non-`await` calls still pass); `waitForNextPaint` uses no
`setInterval` and keeps its `setTimeout` fallback for the `node` environment (`next-paint.ts:16-19`);
`scrollIntoView` is optional-called (`import.tsx:209`) so jsdom does not throw; `busyRetrying` is
deleted in the same commit as its last render; the CSS section lands after `/* connect-tools.tsx */`
and before `/* diagnostics.tsx */` per that file's per-screen ordering (`screens.css:79`, `:248`,
`:308`).

Deviations:

- **D1 (material, unjustified) — Slice 3 step 9's JSX order was not followed.** The plan moved the
  action buttons out of `.import-listing` into a sibling `.actions` row rendered *after* the status
  region. The implementation kept `.actions` inside `.import-listing` and hoisted the status region
  above every stage branch instead. "Mounted unconditionally at screen level" does not require "at
  the top of the screen" — rendering the region *after* the three stage branches satisfies both the
  live-region-mounted-early requirement and the "reading busy state / `loadListing` error while
  `stage` is still `choose`" requirement the hand-off cites, while keeping D-4. This is criterion R1
  above and Critical C1 below. Note that the *previous* code put the result block immediately after
  the buttons; for the result specifically, the new position is further from the user's cursor than
  the code being replaced.
- **D2 (benign) — the D-7 reset "when a new file is chosen"** happens inside `loadListing`'s
  `beginWork("reading")` (`import.tsx:104`) rather than explicitly in `handleChooseFile`. Equivalent
  and less duplicative; no objection.
- **D3 (benign) — the `biome-ignore` on the scroll effect** was dropped because all three deps are
  listed (`import.tsx:210`). Lint is green. Cleaner than the plan.

---

## 3. Hard gates

| Gate | Result |
| --- | --- |
| Security surface not weakened | **PASS** — see §4 |
| Tests present for new behaviour; suite passing | **PASS** — every new production unit has a test; both suites green, re-run by me |
| Advance ritual evidenced | **PASS** — `refined.md` (Gate R resolved 2026-09-04, amendment folded in the same day) → `plan.md` line 1 `Approved: Oscar 2026-09-08`, added in its own commit `8e034f5` before any `src/**` or `desktop/**` edit (`c3bb23e` follows it) → this `review.md` |
| Naming, clean-architecture placement, no bare files at a layer root | **PASS** — `src/` gains **no** file; the one `src/` change is 7 lines inside an existing `application/use-cases/` file. Every new desktop file lands in an existing kind-named folder: `renderer/state/next-paint.ts{,.test.ts}`, `renderer/screens/__dom-tests__/import.dom.test.tsx`, `shared/i18n/catalogs/import-copy.test.ts`. `desktop/src/renderer/` is a presentation tree partitioned by kind, not a `domain/application/infra` layer root, so CLAUDE.md's bare-file rule does not bite. `countSelection` extends `import-selection.ts` rather than adding a file — correct, it is the same kind of thing (a pure fact about the current selection). Verb-first export names (`waitForNextPaint`, `countSelection`) match `wireFocusRefresh` / `buildPickSpec` / `sortListingByDate`. Class names are kebab-case and scoped under `.import`; `.actions` is reused from `base.css:168-172` rather than reinvented. `next-paint.ts` living in `state/` is a stretch of that folder's name, but it is P-D5's explicitly reasoned, Oscar-approved choice with `focus-refresh.ts` as precedent — no action |
| Every acceptance criterion met | **FAIL** — R1 not met (§6 C1); B1 and L1 not performed (§5) |

---

## 4. Security-sensitive surfaces (plan §"The order that keeps them closed")

| # | Check | Result |
| --- | --- | --- |
| 1 | No new bridge surface, no preload change, no zod schema edit | **Confirmed** — nothing under `desktop/src/preload/` or `desktop/src/shared/ipc/` in the diff; `ValijaBridge` unchanged |
| 2 | No filesystem path originates in or is rendered by the renderer | **Confirmed** — `git diff … \| grep -E "^\+.*(filePath\|resolveHandle\|path)"` returns hits only in `import-handlers.ts` (pre-existing lines re-indented by the `orStorageError` wrap) and in `src/` test fixtures. `import.tsx` carries none; the busy copy interpolates only `itemCount`/`conversationCount` (`import.tsx:189`) |
| 3 | The rejection path never reads the caught error | **Confirmed** — `catch {` with no binding at `import.tsx:123`, `:177`, `:97` and `import-handlers.ts:64`. No `String(e)`, no `e.message` |
| 4 | No `console.*` anywhere in the diff | **Confirmed** — zero added lines match `console\.` |
| 5 | Slice 5 keeps the code-only wire shape | **Confirmed** — `toIpcResult` (`to-ipc-result.ts:9`) emits `{ code }` only; `orStorageError`'s message is a fixed English constant that never crosses IPC; the two new tests assert `expect(result.error).not.toHaveProperty("message")` (`import-handlers.test.ts:361`, `:381`) |
| 6 | No vault session, key material or keychain access moves | **Confirmed** — nothing in the diff opens a session, reads a key, or touches the keychain. No SQLCipher keying, Argon2id parameter or keychain call is in the diff at all |
| 7 | Imported items stay excluded from context packs | **Confirmed** — `import.excludedFromPacksNotice` still renders for import mode only (`import.tsx:259`), pinned by `import.dom.test.tsx:292` and `:301` |
| 8 | MCP surface unchanged | **Confirmed** — nothing under `src/delivery/mcp/`; 5 tools + 2 prompts untouched |
| 9 | No network, telemetry, URL or remote asset; no `setInterval` | **Confirmed** — no spinner, no `url()` in the new CSS, no `setInterval` in `next-paint.ts`. `no-network-surface.test.ts` scans the new `.ts`/`.tsx`/`.css` and is green |
| 10 | File list matches the plan exactly | **Confirmed** — see above |

No plaintext is written to disk, no secret or key is logged, key derivation and keychain use are
untouched, SQLCipher keying is untouched. **No security gate is breached.**

---

## 5. Unperformed, disclosed gaps

Recorded openly, per the pattern `advances/CONNECT/review.md` §4 established. Neither is hidden and
neither is being waved through; both are genuinely unmet until real results or an explicit Oscar
deferral exists.

1. **D-2's Windows measurement (refined.md §6 first bullet, §10; plan.md "Manual measurement — D-2's
   bet").** Not performed. This environment has no Windows host, no packaged build target and no way
   to reproduce a main-process UI freeze under a test harness. All five sub-steps are outstanding:
   whether "Leyendo el archivo…" and the disabled-button state appear *before* the freeze or after
   it; whether the title bar reads "(No responde)"; whether a second click during the freeze starts a
   second import; whether the summary is visible without scrolling afterwards; and D-1's export
   size / conversation count / per-phase wall-clock. Until it is run, **it is unknown whether the
   advance's central bet (O1: two rAFs plus a task is enough for Chromium to present the busy frame
   before main blocks) holds at all.** Everything else in this advance (V1–V8) is worth having
   regardless — refined.md §10 says so and I agree — but this bullet is not satisfied by source.
   If it fails, refined.md §5 D-2 and plan.md are explicit that the answer is to escalate to O2 as
   its own advance with its own security review, not to ship quietly.
2. **The plan's "Manual bilingual check (required, not optional)."** Not performed — no display.
   This is the check that would have caught C1 below: it asks specifically whether "the picker,
   status region and both buttons sit together on one screen", in `en` and in the longer `es`
   strings, and whether a forced failure shows the error in the status region "not off-screen at the
   top". As implemented, at least the second half of that check would have failed.

To close them the way CONNECT closed its equivalent, either real results get recorded here, or
Oscar records an explicit deferral (e.g. a `Deferred (§5.1 Windows measurement): Oscar <date>` line
at the top of this file, in his own hand). An agent must not write that line on its own.

---

## 6. Issues, prioritized

### Critical

**C1 — the status region is at the top of the screen, not above the action buttons; D-4 is not
delivered.** `import.tsx:223-262` renders `.import-status` as the third child of `.screen.import`,
ahead of all three stage branches (`:264`, `:270`, `:287`); the buttons stayed inside
`.import-listing` at `:346-361`. Between them: file name, conversation count, filter input, sort
button, a 320px scrolling list, the project `<select>` and the new-project `<input>`. Refined.md §6
asks for result and error "in the **same region as the action buttons**, not at the top of a page
the user has scrolled away from"; §3's mockup and walkthrough step 7 ("the same place she just
clicked") say the same; D-4 Option A says "immediately above the action buttons"; plan.md Slice 3
step 9 spells out the exact JSX order; and `screens.css:278`'s own comment asserts the region is
"immediately above the actions — where the user's eyes and cursor already are", which the markup
makes false. This is V3 in a smaller form, in the advance whose stated purpose is to kill V3.
`import.dom.test.tsx:265-271` does not catch it because `compareDocumentPosition` is satisfied by
*any* position before the buttons, including the top of the page.

*Fix (plan.md Slice 3 step 9, unchanged):* move the `.import-status` `<div>` to render **after** all
three stage branches, and lift the two action buttons out of `.import-listing` into a sibling
`{stage === "listed" && <div className="actions">…}` rendered after the region. The region stays
mounted unconditionally at screen level, so the "reading" busy state and a `loadListing` error still
have somewhere to go while `stage` is `"choose"`, and D-4 is satisfied for the listed stage.
Then tighten DOM case 7 so it can never pass again with the region at the top — assert that
`region.nextElementSibling` is the `.actions` row (or that `.conversation-list` precedes `region`),
not merely that the region precedes the buttons. Re-run the bilingual manual check afterwards (§5.2)
to confirm L1.

### Warning

**W1 — `.import-status:empty { display: none }` (`screens.css:288-290`) partly defeats the reason the
region is mounted early.** An `aria-live` region inside a `display: none` subtree is not in the
accessibility tree; when it becomes non-empty it is re-inserted, which several screen readers treat
as a new region rather than a live update — the same failure mode the plan's own ground-truth note
("a region that appears at the same moment as its text is frequently not announced") was trying to
avoid. It is plan-conformant, so not a criterion breach, but V7 is an explicit acceptance area.
*Suggested fix:* keep the element in the tree and zero out only its box —
`.import .import-status:empty { border: 0; padding: 0; margin: 0; }` — rather than removing it from
layout.

**W2 — DOM case 5 cannot prove what it claims.** `import.dom.test.tsx:207-223` fires two clicks and
asserts `run` was called once. By the time the second `fireEvent.click` runs, React has flushed
`beginWork`'s `setWorking` and rendered `disabled` on the button, and React suppresses `onClick` on
disabled form controls — so the assertion holds identically whether or not `workingRef` exists. The
guard itself is implemented correctly (`import.tsx:62`, `:76`, `:85`, `:90`, `:103`, `:150`), so
R4 is met on the code; the test is just not evidence for it. *Suggested fix:* dispatch both clicks
inside a single `act(() => { btn.click(); btn.click(); })` against a button that has not yet
re-rendered, or drive `runSelection` twice in one task, so the ref is the only thing that can block
the second call.

**W3 — `orStorageError` reports a file-read/parse crash as "the vault is busy".**
`import-handlers.ts:61-69` maps *every* throw out of `import:list`/`import:preview` to
`STORAGE_ERROR`, whose user-facing copy is "Algo salió mal al leer o escribir los archivos de la
bóveda". But `ImportConversations` already returns `Result`s for real read failures, so a *throw* on
those two channels is an unexpected crash — most plausibly an OOM or a `RangeError` out of fflate on
a huge archive (refined.md §2.3: 128 MB/entry, 256 MB total), which has nothing to do with the
vault. The code is what the plan specified and the message never crosses IPC, so this is not a
breach; but it tells the user the wrong thing at exactly the moment they most need a true one.
*Suggested fix:* either reuse `UNREADABLE_FILE` for the two read-only channels, or add one
`errors.UNEXPECTED` key pair (P-D6's own listed alternative) and use it here and for the renderer's
`REJECTED_CALL_CODE`, which currently renders "Algo salió mal (UNEXPECTED)." with a bare English
token.

**W4 — the duplicated `DomainError` literal.**
`new DomainError("STORAGE_ERROR", "The vault is busy right now. Try again in a moment.")` now appears
verbatim at `import-handlers.ts:45` and `:66`. Two copies of one sentence in one 157-line file will
drift. *Suggested fix:* one `function vaultBusyError()` (or a module constant) used by both
`runImportWithBusyRetry` and `orStorageError`.

### Suggestion

- **S1 — the comment above the scroll effect (`import.tsx:202-205`) describes a different decision
  than the code below it.** It explains why the *region* is mounted early (already explained, almost
  word for word, at `:217-222`), then says "so this fires only once busy/result/error clear", which
  is not what the effect does — it fires when `working` clears **and** a result or error exists.
  Replace with one line naming D-4's sub-decision: "On completion, bring the region into view;
  `block: "nearest"` is a no-op when it already is. Optional call — jsdom has no `scrollIntoView`."
- **S2 — `t(…, { ...counts })` at `import.tsx:189`.** The spread exists only to satisfy the params
  index signature; it reads as if something is being merged. Typing `SelectionCounts` as a
  `Record`-compatible shape, or a one-line `const params = countSelection(...)` with a named type,
  reads better and allocates one object fewer per render.
- **S3 — `handleChooseFile` gates on `workingRef` but never sets it** (`import.tsx:89-100`), so the
  file dialog itself is ungated: a double click on "Elegir un archivo…" can request two dialogs.
  Low risk (Electron's open dialog is window-modal) and pre-existing, but `beginWork("reading")`
  before the `await` and `endWork()` in a `finally` would make the guard uniform across all three
  entry points and would also disable the chooser while the dialog is open.
- **S4 — a stale comment in the new use-case test.**
  `import-conversations.use-case.test.ts:92` labels the import-mode case "unchanged, pre-existing
  behaviour", but against `0777d4c` that test was red too: the recording `ImportItems` double returns
  `ok`, so the old code produced a successful summary and `writer.calls` of length 1. The test is
  valuable; the comment mis-describes it.
- **S5 — the free-text project input has no label** (`import.tsx:339-343`), which is why the DOM test
  has to select it with `getByRole("textbox", { name: "" })` (`import.dom.test.tsx:118`) — a brittle
  selector that now encodes the a11y gap. Out of this advance's scope (§4 defers input hints), but
  worth an issue: a `<label>` would fix the a11y gap and let the test say what it means.
- **S6 — `next-paint.test.ts` covers only the `setTimeout` fallback.** The rAF path — the one that
  actually ships — is exercised only indirectly, through the jsdom DOM test. P-D5 accepted this
  knowingly; if the Windows measurement (§5.1) ever pushes the gate to a third frame, add the
  `// @vitest-environment jsdom` companion at that point.

---

## 7. What would flip this to PASS

1. **C1 fixed**: `.import-status` rendered after the stage branches, `.actions` lifted out of
   `.import-listing` into a sibling rendered after the region, and DOM case 7 strengthened so it
   fails if the region drifts back above the listing. This is the only code change required.
2. **§5.1** — the D-2 Windows measurement recorded here with real numbers, **or** an explicit Oscar
   deferral of it, recorded in this file the way CONNECT §4 records its own.
3. **§5.2** — the required manual bilingual check run after C1's fix, confirming picker + status
   region + both buttons on one screen in `en` and `es`, and that a forced failure shows in the
   status region.

W1–W4 and S1–S6 are not blocking. Everything else in the advance is sound: the project-name fix is
correct and correctly placed, the re-entrancy guard is right, the rejection hardening is complete on
both sides of the IPC boundary, the copy is honest and machine-checked, the file list is exactly the
one the plan promised, and no security surface moved.
