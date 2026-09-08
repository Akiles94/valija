Verdict: PASS

# IMPORT-FEEDBACK — change review (second pass)

Reviewed at `f3a27e8` ("fix(IMPORT-FEEDBACK): address change-reviewer's FAIL pass"), on top of
`f5ffbd4`, diffed against `0777d4c` (CONNECT's last commit on
`claude/valija-desktop-launch-strategy-4mwugz`). Seven commits: `8e034f5` (the `Approved:` line),
`c3bb23e` (Slices 0–2), `f012cdf` (Slice 3), `81decda` (Slice 4), `f4c1722` (Slice 5), `f5ffbd4`
(Slice 6), `f3a27e8` (the fix pass).

Every claim below is re-derived from the diff and from the files at HEAD — not from the commit
message, not from the hand-off summary. The **whole** §6/§7 checklist was re-checked from scratch,
not just the fixed items. Two of the fix-pass claims were verified **empirically**, by mutating an
out-of-repo copy of the tree (`/tmp/.../scratchpad/probe`, `src/` + `desktop/src/` + a symlinked
`node_modules`) and re-running the DOM suite there; the repo working tree was never modified.

## Line count

| Category | Lines |
| --- | --- |
| Production TS/TSX | **+276 / −82** (plan estimated ~146 TS) |
| CSS | +67 (plan estimated ~45) |
| Tests | **+488 / −3** (plan estimated ~340) |
| Docs (`docs/gui.md`) | +7 |

`import.tsx` is 368 lines (was 270; plan said "roughly 340"). Over the estimate, but the file list
below is exact and nothing extra is smuggled in.

## Suites — re-run by me at review time on the working tree

| Suite | Result |
| --- | --- |
| root `npm run typecheck` / `lint` / `test` | **pass, exit 0** — 59 files, **324 tests** |
| `desktop/` `npm run typecheck` / `lint` / `test` | **pass, exit 0** — 55 files, **792 tests** |

## File-count check (plan §"Security-sensitive surfaces" item 10)

`git diff --name-only 0777d4c..HEAD` prints exactly the 15 paths plan.md lists (7 production, 7
test, plus `docs/gui.md`), plus `advances/IMPORT-FEEDBACK/{plan,review}.md`. **No** hit under `src/`
other than `importers/application/use-cases/import-conversations.use-case.{ts,test.ts}`, **no**
`desktop/src/preload/`, **no** `desktop/src/shared/ipc/`, **no** `package.json`, **no**
`src/delivery/mcp/`. Scope is clean.

---

## 1. Acceptance criteria (refined.md §6)

### Busy state (steps 2, 4, 6)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| B1 | Visible in-progress state *before* main begins the synchronous work, **verified manually on Windows with a real large export** | **Not performed — human gate, still open (§5.1)** | The mechanism is in place and correct: `next-paint.ts:14-23` (double-rAF then a task, no `setInterval`), awaited at `import.tsx:105` and `:165` before every blocking bridge call. But §6's bullet demands the *measurement*, and it cannot be run here (no Windows host, no packaged build target, no reproducible main-process freeze). Not satisfied by source, not hidden — see §5 |
| B2 | Both action buttons disabled for the whole run; the pressed button's label reflects the state | **Met** | `import.tsx:350-363` — both carry `disabled={!canSubmit \|\| working !== null}`; `:355` renders `import.previewingShort`, `:362` `import.importingShort` when pressed. `import.dom.test.tsx:132-133` (both disabled mid-run), `:139-140` (both re-enabled after) |
| B3 | Choosing a file shows the reading state and disables the chooser | **Met** | `import.tsx:104` `beginWork("reading")`, `:187` renders `import.detectingFormat`, `:217` chooser `disabled={working !== null}`. `import.dom.test.tsx:252-253` |
| B4 | In-progress copy never claims another save is in progress; `busyRetrying` removed from both catalogs; `catalogs.test.ts` parity passes | **Met** | `en.ts` / `es.ts` delete `busyRetrying` and add the five keys with matching placeholders; `import-copy.test.ts:33-35` (`Object.hasOwn(...) === false` in both), `:37-44` (no `import.*` string matches `/another save\|otro guardado/i` or `/retrying\|reintentando/i`). Repo-wide grep: `busyRetrying` survives only inside that test's own assertions. `catalogs.test.ts` untouched and green |

### Result and error (steps 7, 8)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| R1 | Result and error appear in the **same region as the action buttons**, not at the top of a page the user has scrolled away from (D-4); region is `aria-live` | **Met — first pass's C1 is closed** | `.import-status` (`import.tsx:307-346`) now renders **after** all three stage branches (`:216` choose, `:222` formatOverride, `:239-298` listed) and **immediately before** `.actions` (`:348-365`), which was lifted out of `.import-listing`. It is still unconditional, so the "reading" busy state and a `loadListing` error have somewhere to go while `stage` is `"choose"` (proven by DOM case 6, which runs entirely in the choose stage). `aria-live="polite"` at `:309`, `aria-busy` at `:310`. The top-of-screen `<p className="error">` is gone — `import.dom.test.tsx:268` asserts `.screen.import > p.error` is `null`, `:271` asserts `.import-status .error` is not. **Tripwire verified empirically:** I hoisted the region back above the stage branches in the scratch copy — case 7 failed at `import.dom.test.tsx:280` (`region.nextElementSibling` no longer `.actions`). The hardened assertions are real, not decorative |
| R2 | Starting a new run clears the previous run's summary before the new one begins | **Met** | `beginWork` (`import.tsx:74-81`) clears `error`, `resultOutcome`, `resultMode`; called at `:104` and `:164`. `import.dom.test.tsx:189-190` asserts the old summary is gone *and* the new busy line is up while the second run is in flight |
| R3 | A rejected `bridge.import.*` call leaves the screen usable | **Met** | `try/catch/finally` at `import.tsx:106-127` (`loadListing`) and `:166-181` (`runSelection`); `catch { setError(errorCopy(REJECTED_CALL_CODE)); }` with `endWork()` in `finally`. `import.dom.test.tsx:194-205` drives a real rejection: both buttons re-enabled, `.import-status .error` present. Main side: `import-handlers.ts:66-72` makes `import:list`/`import:preview` non-throwing (`import-handlers.test.ts:342-382`) |
| R4 | A second click while a run is in flight never starts a second run, even when the click is delivered after a freeze | **Met — first pass's W2 is closed, and I verified it** | `workingRef` (`import.tsx:62`) is set synchronously in `beginWork` (`:76`), checked at all three entry points (`:90`, `:103`, `:150`), cleared only in `endWork` (`:85`), which every `finally` reaches. Case 5 (`import.dom.test.tsx:207-231`) now dispatches **both** clicks inside one `act()` batch, so React has not yet re-rendered `disabled` when the second handler runs — the ref is the only thing that can block it. **Verified empirically:** deleting the `workingRef` line at `import.tsx:150` in the scratch copy makes case 5 fail with "expected 1 times, but got 2 times". The test is now genuine evidence for the guard |
| R5 | Result block still shows per-conversation failures and `import.excludedFromPacksNotice`, unchanged | **Met** | `import.tsx:320-345` is the old block, moved verbatim into the region. `import.dom.test.tsx:286-305` (failures + notice on import), `:307-314` (no notice on preview) |

### Layout (step 3)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| L1 | With several hundred conversations, project picker, status region and both buttons reachable without an extreme scroll, default window size, **both languages** | **Met structurally; the required manual bilingual check is still unperformed (§5.2)** | D-6 is implemented (`screens.css:252-260`: `max-height: 320px; overflow-y: auto`), and with C1 fixed the three elements are now **contiguous** in the DOM: picker + new-project input are the last children of `.import-listing` (`import.tsx:279-296`), then `.import-status` (`:307`), then `.actions` (`:348`). Scrolling to the bottom now puts all three on screen together — the failure mode the first pass predicted is gone. What remains is only the visual/bilingual confirmation at the real default window size (1100×720) with the longer `es` strings, which plan.md marks "required, not optional" and which cannot be run here |

### Project-name honesty (V8 / Problem 2)

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| P1 | Previewing with an invalid name fails **at Preview**, with the same localized `INVALID_PROJECT_NAME` message Import would show | **Met** | `import-conversations.use-case.ts:103-109` — `parseProjectName(input.projectName ?? "")` runs after the `list` early-return (`:95-101`) and before `selectConversations` (`:111`), so `dry-run` and `import` share one guard. The renderer renders `errorCopy(result.error.code)` for both paths (`import.tsx:172`), so the two show the identical string |
| P2 | Preview and Import always agree — both succeed or both fail | **Met** | One guard on the shared path; `ImportItems`' own `parseProjectName` untouched (defense in depth). Tests: `import-conversations.use-case.test.ts:78-90` (dry-run) and `:92-108` (import) |
| P3 | `list` mode unaffected | **Met** | The `list` branch returns at `:95-101`, before the guard. `import:list` (`import-handlers.ts:93-106`) passes no `projectName`; its existing handler tests are untouched and green |
| P4 | A test exists that fails against today's use case and passes after | **Met** | `import-conversations.use-case.test.ts:78-90`: at `0777d4c` the dry-run branch never called `parseProjectName`, so `execute` returned `ok` and `expect(r.ok).toBe(false)` was red |

### Cross-cutting

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| X1 | A test exists that **fails against today's `import.tsx`** and passes after (D-12) | **Met — measured, not argued** | I restored `0777d4c`'s `import.tsx`, `en.ts` and `es.ts` into the scratch copy and ran the new DOM file against them: **7 of 9 cases fail** (cases 1–7); only case 8 and the preview-notice case pass. Against HEAD all 9 pass. (Note this also corrects my first pass: with case 5 rewritten, it is now red against the old code too) |
| X2 | `typecheck && lint && test` green in repo root **and** `desktop/` | **Met** | Re-run by me: 324 and 792 tests, exit 0 on all six commands |
| X3 | Diff touches no `src/**` except `import-conversations.use-case.{ts,test.ts}`, no `desktop/src/shared/ipc/**`, no preload, no `package.json` | **Met** | See the file-count check above |
| X4 | `docs/gui.md` describes the three moments | **Met** | `docs/gui.md:206-212` — reading, working (with counts and disabled buttons), and the result/failure "in that same spot, just above the buttons you pressed", plus D-10's may-stop-responding warning. Note the paragraph's claim about placement is now **true** of the markup, which it was not at `f5ffbd4` |
| X5 | No import semantics changed — same parser resolution, selection, single write, counts, deterministic ids | **Met, with one deliberate ordering change** | Nothing in the write path moved. The new guard changes *which* error wins when an invalid name and a selection error are both true (plan.md's risk table names and accepts this), and a programmatic `dry-run` with no `projectName` now returns `INVALID_PROJECT_NAME` instead of a summary — unreachable from the CLI (`import-command.ts` requires `-p` whenever a selection flag is present) and from the desktop (`import:preview`/`import:run` always send `projectName`) |

---

## 2. Plan conformance

Slices 0–6 match plan.md, including every trap the plan flagged: `import:list`/`import:preview`
stay **synchronous** (`import-handlers.ts:93`, `:108` — no `async`, so the existing non-`await`
handler tests still pass); `waitForNextPaint` uses no `setInterval` and keeps its `setTimeout`
fallback for the `node` environment (`next-paint.ts:16-19`); `scrollIntoView` is optional-called
(`import.tsx:208`) so jsdom does not throw; `busyRetrying` was deleted in the same commit as its
last render; the CSS lands in its per-screen slot between `/* connect-tools.tsx */` and
`/* diagnostics.tsx */` (`screens.css:248`, `:313`). Slice 3 step 9's JSX order — the thing the
first pass failed on — is now followed exactly.

Deviations, all judged safe:

- **D1 (justified) — Slice 5 returns `UNREADABLE_FILE`, not `STORAGE_ERROR`.** `refined.md` D-9
  Option B and `plan.md` Slice 5 both say "mirroring `import:run`'s catch-all → `STORAGE_ERROR`".
  `import-handlers.ts:66-72` returns `importerErr("UNREADABLE_FILE", …)` instead. This is a
  deviation from the letter of the approved plan, made in response to my first pass's W3. It is
  safe and better: neither channel writes to the vault (`import:list` lists;
  `import:preview` returns before `importItems.execute` — `import-conversations.use-case.ts:120-128`),
  `getContainer` is `() => container` and cannot throw (`main/index.ts:37`), so the only reachable
  throw is a read/parse/chunk crash on the export file. `UNREADABLE_FILE` is an existing
  `ImporterErrorCode` (`src/importers/domain/errors.ts:8`) with localized copy in both catalogs
  (`en.ts:376`, `es.ts:375`). §6 names no code for this path, so no criterion is affected. **But
  refined.md D-9 B and plan.md Slice 5 now read as stale** — see W3 below.
- **D2 (benign)** — the D-7 reset "when a new file is chosen" happens inside `loadListing`'s
  `beginWork("reading")` (`import.tsx:104`) rather than in `handleChooseFile`. Equivalent, less
  duplicative.
- **D3 (benign)** — the planned `biome-ignore` on the scroll effect was dropped because all three
  deps are listed (`import.tsx:209`). Lint green. Cleaner than the plan.
- **D4 (process, not code) — P-D1 was never recorded.** The plan required the orchestrator to state,
  before Slice 1, whether the work lands on `feat/import-feedback` or directly on the session
  branch. It landed on `claude/valija-desktop-launch-strategy-4mwugz` (the same branch CONNECT used),
  which is IMPORT-ENTRY's precedent and the plan's own listed alternative — but nothing in the repo
  records the choice. Cosmetic; noted so it is not silently repeated.

---

## 3. Hard gates

| Gate | Result |
| --- | --- |
| Security surface not weakened | **PASS** — see §4 |
| Tests present for new behaviour; suite passing | **PASS** — every new production unit has a test; both suites green, re-run by me; the two tests the first pass called weak (DOM 5, DOM 7) are now provably sensitive, verified by mutation |
| Advance ritual evidenced | **PASS** — `refined.md` (Gate R resolved 2026-09-04, amendment folded in the same day) → `plan.md` line 1 `Approved: Oscar 2026-09-08`, added in its own commit `8e034f5` **before** any `src/**`/`desktop/**` edit (`c3bb23e` is the next commit) → this `review.md` |
| Naming, clean-architecture placement, no bare files at a layer root | **PASS** — `src/` gains **no** file; the one `src/` change is a 7-line guard inside an existing `application/use-cases/` file. Every new desktop file lands in an existing kind-named folder (`renderer/state/next-paint.ts{,.test.ts}`, `renderer/screens/__dom-tests__/import.dom.test.tsx`, `shared/i18n/catalogs/import-copy.test.ts`); `desktop/src/renderer/` is a presentation tree partitioned by kind, not a `domain/application/infra` layer root, so CLAUDE.md's bare-file rule does not bite. `countSelection` extends `import-selection.ts` rather than adding a file — correct, it is the same kind of thing. Verb-first exports (`waitForNextPaint`, `countSelection`, `orUnreadableFile`) match `wireFocusRefresh` / `buildPickSpec` / `sortListingByDate`. Class names kebab-case and scoped under `.import`; `.actions` reused from `base.css:168-172`. `next-paint.ts` in `state/` is a stretch of that folder's name (see S1) but is P-D5's reasoned, Oscar-approved choice with `focus-refresh.ts` as precedent |
| Every acceptance criterion met | **Code-level: yes.** B1 and the bilingual half of L1 are human-gated measurements that were not performed and are recorded as open in §5 — they are not code defects and, per this pass's remit and CONNECT's precedent, they are not treated as the sole cause of a FAIL. This verdict does **not** certify them |

---

## 4. Security-sensitive surfaces (plan §"The order that keeps them closed")

| # | Check | Result |
| --- | --- | --- |
| 1 | No new bridge surface, no preload change, no zod schema edit | **Confirmed** — nothing under `desktop/src/preload/` or `desktop/src/shared/ipc/` in the diff; `ValijaBridge` unchanged |
| 2 | No filesystem path originates in or is rendered by the renderer | **Confirmed** — `import.tsx` contains no `path`, `filePath` or `resolveHandle` token at all (grep at HEAD); the screen still passes the opaque `handle` and displays only the dialog's `displayName`; the busy copy interpolates only `itemCount`/`conversationCount` (`import.tsx:188-189`) |
| 3 | The rejection path never reads the caught error | **Confirmed** — `catch {` with no binding at `import.tsx:97`, `:123`, `:177` and `import-handlers.ts:69`. No `String(e)`, no `e.message` anywhere in the diff |
| 4 | No `console.*` anywhere in the diff | **Confirmed** — zero added lines match `console\.` (also checked `process.env`, `localStorage`) |
| 5 | Code-only wire shape | **Confirmed** — `to-ipc-result.ts:9` emits `{ code }` only; `orUnreadableFile`'s message is a fixed English constant that never crosses IPC; both new handler tests assert `expect(result.error).not.toHaveProperty("message")` (`import-handlers.test.ts:359`, `:380`) |
| 6 | No vault session, key material, or keychain access moves | **Confirmed** — nothing in the diff opens a session, reads a key, or touches the OS keychain. No SQLCipher keying, no Argon2id parameter, no keychain call appears in the diff at all. `import:preview`'s dry-run path still returns before `importItems.execute`, so Preview still never touches the vault (`import-conversations.use-case.ts:120-128`) |
| 7 | Imported items stay excluded from context packs | **Confirmed** — `import.excludedFromPacksNotice` still renders for import mode only (`import.tsx:343`), pinned by `import.dom.test.tsx:304` and `:313` |
| 8 | MCP surface unchanged | **Confirmed** — nothing under `src/delivery/mcp/`; 5 tools + 2 prompts untouched |
| 9 | No network, telemetry, URL or remote asset; no `setInterval` | **Confirmed** — no spinner (D-5 = A), no `url()` in the new CSS, no `setInterval` in `next-paint.ts`. `no-network-surface.test.ts` scans the new `.ts`/`.tsx`/`.css` and is green |
| 10 | File list matches the plan exactly | **Confirmed** — see above |

No plaintext is written to disk, no secret or key is logged, key derivation and keychain use are
untouched, SQLCipher keying is untouched, and the fix pass changed nothing on any of those axes.
**No security gate is breached.**

---

## 5. Outstanding human gates — unperformed, disclosed, still open

Recorded the way `advances/CONNECT/review.md` §4 records its equivalent. Neither is satisfied and
neither is being waved through; the PASS above is a statement about the code, not about these.

1. **D-2's Windows measurement (refined.md §6 first bullet and §10; plan.md "Manual measurement —
   D-2's bet").** Not performed. This environment has no Windows host, no packaged build target and
   no way to reproduce a main-process UI freeze. All five sub-steps are outstanding: whether
   "Leyendo el archivo…" and the disabled-button state are presented *before* the freeze or after
   it; whether the title bar reads "(No responde)"; whether a second click during the freeze starts
   a second import; whether the summary is visible without scrolling afterwards; and D-1's export
   size / conversation count / per-phase wall-clock. **Until it is run, it remains unknown whether
   the advance's central bet (O1: two rAFs plus a task is enough for Chromium to present the busy
   frame before main blocks) holds at all.** If it fails, refined.md D-2 and plan.md are explicit:
   escalate to O2 as its own advance with its own security review — do not ship quietly.
2. **plan.md's "Manual bilingual check (required, not optional)."** Not performed — no display.
   It asks whether the picker, status region and both buttons sit together on one screen in `en`
   and in the longer `es` strings, and whether a forced failure (choosing a non-export file) shows
   the error in the status region. C1's fix makes the DOM order correct and contiguous, which is
   the necessary half; the sufficient half is a pair of eyes at 1100×720.

To close them, either real results get recorded in this file, or Oscar records an explicit
deferral — e.g. `Deferred (§5.1 Windows measurement, §5.2 bilingual check): Oscar <date>` at the
top of this file, in his own hand. **An agent must not write that line on its own** (CLAUDE.md's
approval-marker rule). Merging on this PASS without one of those two means shipping V1–V8's repairs
— all independently worth having — while D-2's bet stays untested.

---

## 6. First-pass findings — disposition

| First pass | Status now | Evidence |
| --- | --- | --- |
| **C1** status region at the top of the screen, buttons inside `.import-listing` | **Closed** | `import.tsx:307-346` after all stage branches, `:348-365` `.actions` as a sibling; hardened case 7 (`import.dom.test.tsx:276-283`) verified by mutation to fail if it drifts back |
| **W1** `:empty { display: none }` removes the live region from the a11y tree | **Closed** | `screens.css:288-297` zeroes border/padding/margin instead; the element stays in the tree, and with no children it still costs no visible box |
| **W2** DOM case 5 proved nothing | **Closed** | Rewritten as one batched `act()` (`import.dom.test.tsx:219-222`); verified by mutation — without `import.tsx:150`'s guard it fails with 2 calls |
| **W3** "the vault is busy" for a file-read crash | **Closed (with a doc side-effect)** | `import-handlers.ts:66-72` → `UNREADABLE_FILE`; see W3 below for the stale spec text |
| **W4** duplicated `DomainError("STORAGE_ERROR", …)` literal | **Closed** | Only one copy remains (`import-handlers.ts:44-46`, in `runImportWithBusyRetry`, where it is accurate) |
| **S1** stale comment on the scroll effect | **Closed** | `import.tsx:202-204` now describes what the effect does |
| **S4** mislabelled use-case test case | **Closed** | `import-conversations.use-case.test.ts:92-96` now says why the case is green |
| **S2** `t(…, { ...counts })` spread | Open (cosmetic) | `import.tsx:189` |
| **S3** `handleChooseFile` gates on `workingRef` but never sets it | Open — **and now has a sharper failure mode**; see W1 below | `import.tsx:89-100` |
| **S5** unlabelled project-name input → `getByRole("textbox", { name: "" })` | Open (out of advance scope, §4 defers input work) | `import.tsx:290-296`, `import.dom.test.tsx:118` |
| **S6** `next-paint.test.ts` covers only the fallback branch | Open (P-D5 accepted it knowingly) | `next-paint.test.ts:9-22` |

---

## 7. Issues, prioritized

### Critical

None. C1 is closed and I could not find another blocking defect on a full re-check.

### Warning

**W1 — the chooser's guard reads the gate but never sets it, and the new gate turns an old race
into a guaranteed mismatch.** `handleChooseFile` (`import.tsx:89-100`) checks
`workingRef.current !== null` but never assigns it, so the dialog itself is ungated. Two clicks
delivered in the same task (exactly the OS-buffered case D-9 exists for, and the case DOM 5 now
proves is real for the action buttons) run two `bridge.dialog.chooseImportFile()` calls. When the
second resolves, `setHandle`/`setDisplayName` at `:94-95` run unconditionally, but the follow-up
`loadListing` is rejected by its own gate at `:103` if the first listing is still in flight — so the
screen ends up showing **file B's name and handle over file A's listing**, and a subsequent import
would run file B's handle against file A's selection indices. Before this advance the second
`loadListing` was not gated, so the two eventually agreed; the new gate makes the mismatch
deterministic instead of racy. Not an acceptance breach (§6's re-entrancy bullet is about a *run*,
and D-8's "disable the chooser while it runs" is implemented at `:217`), and the window is narrow —
but it is a correctness regression introduced by this diff. *Suggested fix, one line:* re-check the
gate after the dialog resolves, before mutating state —
```ts
const chosen = await bridge.dialog.chooseImportFile();
if (chosen === null) return;              // the user pressed Cancel — a silent no-op
if (workingRef.current !== null) return;  // a second dialog resolved after the first already started reading
setHandle(chosen.handle);
```
(Alternatively gate the dialog itself, but that needs `beginWork`/`endWork` restructuring so
`loadListing`'s own gate does not then reject the legitimate call.)

**W2 — the summary renders the project name that is on screen *now*, not the one the run used.**
`import.tsx:326` passes `resolvedProjectName() ?? ""` into `import.importSummary`, evaluated at
render time, while the request captured its own `projectName` at `:151` before `beginWork`. Change
the `<select>` or the new-project `<input>` during a run — neither is disabled (only the checkboxes
are, per P-D7) — and the "Se importaron N elementos … en 'X'" line names a project that was never
written. Pre-existing (the old code did the same) and out of §6's letter, but this advance's whole
point is that the summary is the answer to "did it save?", and it now sits where the user is
looking. *Suggested fix:* store the run's project name alongside `resultMode`/`resultOutcome` in
`beginWork`'s sibling state and render that; or disable the picker and the name input while
`working !== null`, matching P-D7's reasoning for the checkboxes.

**W3 — refined.md D-9 Option B and plan.md Slice 5 now describe code that no longer exists.** Both
say the two read-only channels map a throw to `STORAGE_ERROR`; `import-handlers.ts:70` returns
`UNREADABLE_FILE`. The code is the better of the two and I endorse it (§2 D1), but the approved
spec/plan text is now stale, and nothing records the amendment the way refined.md §2.6 records the
"sumalo" amendment. *Suggested fix:* a one-line note in refined.md D-9 (or in plan.md Slice 5)
saying the code was changed on review and why — Oscar approved a plan whose text now disagrees with
what shipped.

### Suggestion

- **S1 — `renderer/state/next-paint.ts` is not state.** `state/` is already a grab-bag
  (`focus-refresh.ts`, `overlay-nav.ts`, `diagnostic-rows.ts`), so this is consistent rather than
  novel, and P-D5 chose it explicitly with Oscar's approval. But "opening a folder tells you what's
  in it" (CLAUDE.md) is weakened by every such addition. If a second timing helper ever appears,
  that is the moment to cut `renderer/timing/` and move both.
- **S2 — the listed-stage condition is now written twice.** `stage === "listed" && listing !== null`
  appears at `import.tsx:239` and `:348`; if one ever gains a clause the other will not.
  A `const isListed = stage === "listed" && listing !== null;` beside `canSubmit` (`:193`) reads
  better and cannot drift.
- **S3 — the CSS comment at `screens.css:277-280` still says the region is "Hidden until it has
  something to say".** After W1's fix it is not hidden, it is box-zeroed; the very next comment
  block (`:288-292`) explains exactly that. Delete the stale half-sentence.
- **S4 — `t("import.importing", { ...counts })` (`import.tsx:189`).** The spread exists only to
  satisfy the params index signature and reads as if something were being merged; a
  `Record`-compatible `SelectionCounts`, or a named `const params`, reads better and allocates one
  object fewer per render while busy.
- **S5 — two DOM cases settle a deferred promise as their last statement without awaiting**
  (`import.dom.test.tsx:191`, `:230`). Harmless today (both suites are green and Vitest does not
  fail on the act warning), but a state update after the test body has returned is the classic
  source of cross-test flake. `await screen.findByText(…)` after each settle costs one line.
- **S6 — the project-name input still has no `<label>`** (`import.tsx:290-296`), which is why the
  DOM test must select it with `getByRole("textbox", { name: "" })` (`import.dom.test.tsx:118`) — a
  selector that now encodes the a11y gap. §4 defers input work, so this is a follow-up, not a
  finding against this advance.
- **S7 — record P-D1.** Nothing in the repo states which branch decision was taken (§2 D4). A line
  in plan.md would close it.

---

## 8. What this PASS does and does not say

It says: every code-level acceptance criterion in refined.md §6 is met and independently
re-derived; the first pass's Critical and all four Warnings are genuinely closed (two of them
verified by mutating a copy of the tree and watching the tests fail); the plan was followed, its one
material deviation is safer than the text it deviates from; both suites are green at 324 + 792; the
file list is exactly the one the plan promised; and no security surface moved — no key, no keychain
call, no SQLCipher keying, no new IPC channel, no path in the renderer, no logged secret.

It does **not** say that D-2's bet works. §5.1 and §5.2 are unperformed human gates, not findings I
have cleared. Before this is treated as done, Oscar should either record the Windows measurement and
the bilingual check in this file, or record an explicit deferral line here in his own hand — and if
the measurement later shows the pre-click frame persisting, this advance's copy, layout, result and
validation fixes still stand, but O1 does not, and D-2 = O2 becomes a separate advance with its own
security review.
