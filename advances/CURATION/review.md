Verdict: PASS

# CURATION — Review (second pass)

**Reviewed:** `feat/curation-CURATION`, `git diff main...HEAD`. That is 13 commits: the 12 from the
first pass plus `7c1e807` ("fix(CURATION): address review C1, C2, W1, S1 …"). This pass checks the
fix commit's claims against the code, re-runs both loops, and re-checks the whole diff for regressions.
**Against:** `advances/CURATION/refined.md` (Gate R approved 2026-10-17) and
`advances/CURATION/plan.md` (`Approved: Oscar 2026-10-17`, line 1).
**Suites (re-run by me after `7c1e807`):**
- Root `npm run typecheck && npm run lint && npm run test` passes, **377 / 377** (62 files). The one
  new test is the CLI `show` case.
- `desktop/` `npm run typecheck && npm run lint && npm run test` passes, **983 / 983** (66 files).
- The root lint's single "info" is the pre-existing `biome.json` `recommended` deprecation notice.
  `biome.json` is not in this diff.

**Verdict in one line:** both blockers from the first pass are fixed, and the tests now prove what
they claim. W1, S1 and S2 are fixed too. Every acceptance criterion is met and no hard gate is
breached. W2 (the manual Electron check in light and dark themes) is still open. It is Oscar's to do
before shipping. It does not block this verdict.

---

## 1. Size

| Slice | Lines |
|---|---|
| Whole range (`--stat`) | 59 files, +4 239 / −89 (includes the first-pass `review.md`) |
| Production (`src/**`, `desktop/src/**`, non-test) | **+924 / −63** (first pass +917; the fix adds 7 net lines in `project.tsx`) |
| Tests | +1 229 / −8 |
| Fix commit `7c1e807` (code only) | `project.tsx` +12/−5, `project.dom.test.tsx` +3, `set-item-pinned.use-case.test.ts` +26/−8, `curation-commands.test.ts` +12/−1 |

Still within about 5% of the plan's ~880 production lines. No dependency files changed.

---

## 2. Claims in the fix commit, verified

| Claim | Verified? | Evidence |
|---|---|---|
| **C1:** action errors live in their own `actionError` state, which the reload does not clear | **Yes** | `desktop/src/renderer/screens/project.tsx:51-52` declares `actionError`. `load()` (`:57-58`) still clears only `error` and `items`. `runAction` (`:84-95`) clears `actionError` at its start and sets it on `!result.ok`. It is rendered as its own `<p className="error">` (`:174`). |
| **C1:** the DOM test waits for the second `show` and asserts the copy is still there | **Yes, and it would catch the old bug** | `project.dom.test.tsx:353-356`: `waitFor(show called ×2)`, then `findByText("refused")`. `load()` sets `items` to null, so this only resolves once the reload has committed. Then `getByText(<ITEM_ARCHIVED copy>)`. Under the old code, `load()` → `setError(null)` would remove the copy before this point, and `getByText` would throw. |
| **C2:** fresh vault, exact message with both full ids, 5-id cap with ", and more" | **Yes** | `set-item-pinned.use-case.test.ts:62-86`. A fresh `makeUnlockedVault()` with a new `SeqIds` and the reference `"01SEQ00000"`. `toBe(`"01SEQ00000" matches several items: ${ids.join(", ")}. Use more characters.`)` pins the full message, so leaving out either candidate fails it. After 7 items it checks that exactly 5 `01SEQ\d{6}` ids are listed (the quoted reference has only 5 digits, so the regex cannot count it) and that the message contains `", and more. Use more characters."`. It also asserts zero generation bump. This matches `ambiguityMessage` in `item-curation-steps.ts:37-41`. |
| **W1:** the pin test asserts the stored `updatedAt` equals the clock after advancing | **Yes** | `set-item-pinned.use-case.test.ts:43-44` reads the item back with `session.items.findById(id)` after `clock.advanceMinutes(5)` and compares it with `clock.now()`. A non-bumped `updatedAt` would still hold the save time, five minutes earlier, so the test would fail. This proves `updatedAt = now` after persistence, not only in the domain. |
| **S1:** `runAction` uses try/finally | **Yes** | `project.tsx:86-94`. `busyId` is reset and the reload fires even if the IPC promise rejects. The rejection itself still propagates to the `onAction` caller, which matches the other screens. |
| **S2:** CLI test for `show` ids and `--archived` | **Yes** | `curation-commands.test.ts:93-102`. Plain `show` does not contain the archived id; `{ archived: true }` prints `id <full id>  [archived]`. This covers the `showCommand` → `includeArchived` wiring. It does not cover the Commander `--archived` flag declaration in `program.ts`, which is acceptable. |
| **W2:** manual Electron check still open | **Correct, still open** | This is a headless container. It stays Oscar's check before shipping. |

---

## 3. Acceptance criteria (spec §12)

Rows 1–7 and 9–23 are unchanged from the first pass and stay **Met**. The fix commit touches only
`project.tsx` and tests, and I re-checked that it changes nothing those rows rely on. The rows that
change:

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | pin/unpin/archive/unarchive/edit per §5, incl. no-ops and every §6 code | **Met** | `item-curation.ts`; domain and use-case tests (first pass) |
| 2 | One bump per change, zero per rejection/no-op | **Met** | `saveIfChanged`; generation probes, now including the fresh-vault ambiguity case |
| 3 | Every change sets `updatedAt = now`; edit keeps id/createdAt/source/pinned | **Met** (W1 closed) | Domain tests, plus the persisted check at `set-item-pinned.use-case.test.ts:43-44` |
| 4 | Imported: archive/unarchive ok; pin/edit → `ITEM_NOT_CURATABLE` | **Met** | Unchanged |
| 5 | Re-import does not un-archive | **Met** | Unchanged |
| 6 | No use case calls another; unscoped `archive()` gone | **Met** | Unchanged |
| 7 | `show` prints every full id; `--archived` includes and marks | **Met** (S2 closed) | `render.ts`, `render.test.ts`, and the new `curation-commands.test.ts:93-102` |
| 8 | Full id or ≥6 prefix; ambiguous → `ITEM_ID_AMBIGUOUS` **listing candidates**; unknown → `ITEM_NOT_FOUND` | **Met** (was "not met") | `item-curation-steps.ts:10-22,37-41`; `set-item-pinned.use-case.test.ts:62-86` (exact message, cap of 5, ", and more"); unknown → `ITEM_NOT_FOUND` test unchanged |
| 9–15 | edit input, FTS, 5 MCP tools, atomic supersede, bad targets, search ids, no archived in MCP | **Met** | Unchanged |
| 16 | Cards: Pin/Unpin, Archive; Show archived with Unarchive; reload after each action | **Met** | `finally { setReloadToken }` makes sure the reload happens even on a rejected IPC call |
| 17–22 | Channels, i18n, toggle not persisted, no migration, fixtures, docs | **Met** | Unchanged |
| 23 | Loops green, root and `desktop/` | **Met** | 377 / 983, re-run by me |

**Result: 23 of 23 met.**

---

## 4. Plan adherence

As in the first pass. The plan's slice 7 step order (setError, then reload) is now superseded by the
`actionError` split. This deviation is **justified**: it is what delivers the plan's own stated
outcome ("error renders catalog copy"). The missing manual Electron check (W2) is the one remaining
gap from the plan's slice 7 "Done when".

---

## 5. Hard gates

| Gate | Status |
|---|---|
| Security surface | **No breach.** The fix changes only renderer state and tests. `actionError` holds catalog copy from `errorCopy(code)`, never `error.message`, so candidate ids and other details still never reach the renderer. No IPC, schema, MCP, keychain, KDF or SQLCipher changes. |
| Tests for new behaviour / suite passes | **OK.** C1 and C2 are now proven by tests that would fail under the old behaviour. Both suites pass. |
| Ritual | **OK.** `refined.md` → `plan.md` (`Approved: Oscar 2026-10-17`, line 1, commit `63e9072`, before the first implementation commit `c45b8f9`) → this `review.md`. |
| Naming / placement | **OK.** No new files in the fix commit. Placement as accepted in the first pass. |

---

## 6. Issues

### Critical

None.

### Warnings

**W2 (still open, for Oscar).** Run `cd desktop && npm run dev` against a real vault in light and
dark themes before shipping. Check that the new `.item-row.archived`, `.item-action`, `.notice` and
the stacked `.error` lines render legibly. The DOM tests do not cover visual contrast.

### Suggestions (non-blocking)

- **S8.** If an action is refused with `VAULT_LOCKED`, the reload also fails with `VAULT_LOCKED`.
  Both `error` and `actionError` then render the same sentence twice (`project.tsx:173-174`). One fix
  is `{actionError !== null && actionError !== error && …}`, or skip the reload when the action
  failed on a lock. This is cosmetic.
- **S9.** `set-item-pinned.use-case.test.ts:85`: the fresh vault's `rmSync` runs only if every
  assertion before it passes. A failure leaks a temp dir. Move it to a `try/finally` or an
  `afterAll`, like the shared vault. This only affects tests.
- First-pass suggestions S3–S7 (declaration order of `toItemWithProject`, a redundant `as string`,
  stdin read before id parse, the `LIKE` prefix scan, and the Undo button not disabled while busy)
  are still open. All of them are minor and none blocks the merge.

---

## 7. Notes for Ship

PASS is granted on the code and tests. Oscar should still do W2, the visual check, before
`git-ops` merges.
