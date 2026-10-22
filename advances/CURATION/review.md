Verdict: PASS

# CURATION — Review (fourth pass: third-pass fixes for Amendment A1)

**Reviewed:** `feat/curation-CURATION`, `git diff main...HEAD` (whole branch), focusing on `a6ef166`
("fix(CURATION A1): address third-pass review …"), the only commit since the third-pass FAIL.
**Against:** `advances/CURATION/refined.md` (D-K amendment), `advances/CURATION/plan.md` (line 1
`Approved: Oscar 2026-10-17`; line 2 `Approved (Amendment A1): Oscar 2026-10-17`; §"Amendment A1 —
Slice 9"), `CLAUDE.md` Conventions and "Surface parity", and the third-pass `review.md`.
**Suites (re-run by me):**
- Root `npm run typecheck && npm run lint && npm run test`: green, **377 / 377** (62 files). The
  single lint "info" is the existing `biome.json` deprecation notice.
- `desktop/` `npm run typecheck && npm run lint && npm run test`: green, **1020 / 1020** (67 files).
  That is 1013 at the third pass plus 7 new tests: 3 handler, 1 schema, 3 DOM.

**Verdict in one line:** C1 is fixed at the real boundary, with tests that go through the production
schema and the real-vault handler. W1–W3 and S1 are addressed. No hard gate is breached.

---

## 1. Size

| Slice | Lines |
|---|---|
| Whole branch vs `main` (`--shortstat`) | 62 files, +4 881 / −89 (includes `advances/**` docs) |
| A1 production (`desktop/src`, non-test, `2eb41d8..HEAD`) | +338 / −7 (third pass: +308 / −7) |
| This fix commit, code + spec (`b1051db..HEAD`, excluding review.md) | +94 / −11 across 7 files: `schemas.ts` +6/−4, `item-edit-dialog.tsx` +28/−3, `project.tsx` +3, `specs/desktop.md` +2/−2, tests +55/−2 |

The fix is small and stays inside the files the third pass named.

---

## 2. Third-pass claims, verified one by one

| Claim | Status | Evidence |
|---|---|---|
| **C1.1** `content:edit` caps raised to abuse limits so `EditItem` decides | **Met** | `desktop/src/main/ipc/schemas.ts:44-52`: `content ≤ 1_000_000`, `tags ≤ 100 × ≤ 256`, `type ≤ 64`, `id ≤ 64`. The comment explains why. The payload is still bounded (roughly 1 MB plus 25.6 KB of tags) |
| **C1.1** `schemas.test.ts` shows 11 tags, a 33-char tag and 40 000-char content pass | **Met** | `schemas.test.ts:138-142`. The rejection test moved to 1 000 001 chars and 101 tags (`:131-134`) |
| **C1.3a** Each over-limit input goes through the real schema and real-vault handler and returns its real code | **Met** | `content-handlers.curation.test.ts:103-112` (`it.each`). It asserts `SCHEMAS["content:edit"].safeParse(request).success === true` and then `toEqual({ ok: false, error: { code } })` for `TOO_MANY_TAGS`, `INVALID_TAG` and `CONTENT_TOO_LARGE`. This uses the actual `EditItem` against a real unlocked test vault. No mock |
| Existing DOM "refused save" test (11 tags → `TOO_MANY_TAGS` copy) | **Now a true positive** | `project.dom.test.tsx:431`. The mocked response is now one production returns, as the test above proves |
| **C1.2** `saveEdit` catches a rejected call, shows `errorCopy("UNEXPECTED")`, keeps the dialog open with the text | **Met** | `project.tsx` `saveEdit`, the `catch` before `finally`. This matches `import-screen.tsx:34,111` (`REJECTED_CALL_CODE = "UNEXPECTED"`). `saving` resets in `finally`, so Save is enabled again |
| **C1.3b** DOM test with `mockRejectedValueOnce` | **Met** | `project.dom.test.tsx` "shows the generic copy and stays open when the edit call itself is rejected". It asserts the `UNEXPECTED` copy from the real catalog (`copyForErrorCode`), that the dialog is present, that the textarea still holds `"new text"`, and that Save is not disabled |
| **W1** Focus returns to the opener only if it is still connected; test for initial focus and return on Cancel | **Met** | `item-edit-dialog.tsx:32-39` (`opener?.isConnected`). DOM "focuses the content when it opens and returns focus to Edit on Cancel". After a reload, focus falls to `<body>` without an error, which the third pass offered as the acceptable alternative. The code comment records this |
| **W2** Tab / Shift+Tab trapped in the dialog; test | **Met** | `item-edit-dialog.tsx:41-56` `trapTab`, wired at `:70`. DOM "keeps Tab inside the dialog" checks the wrap in both directions (Save → Content, Content → Save). See S-a for a remaining gap |
| **W3** Escape ignored while saving | **Met (no test)** | `item-edit-dialog.tsx:72` `if (event.key === "Escape" && !saving)`. No test covers it (S-b) |
| **S1** `specs/desktop.md` mentions edit in `itemActionsFor` and the reason for the schema caps | **Met** | `specs/desktop.md:23` (caps rationale and the three codes) and `:120` ("pin/unpin + edit + archive — `edit` opens the edit dialog…") |

---

## 3. Amendment A1 behaviour (plan.md §A1)

| # | Plan statement | Status | Evidence |
|---|---|---|---|
| A1-1 | `"edit"` only for live, non-imported items | Met | Unchanged since third pass |
| A1-2 | Modal, pre-filled | Met | Unchanged |
| A1-3 | Escape / Cancel close without saving | Met | Escape is now also blocked while saving, the same as Cancel's `disabled={saving}` |
| A1-4 | Focus returns to the Edit button | **Met** | W1 above, with a test |
| A1-5 | One item at a time | Met | Unchanged |
| A1-6 | Only differing fields; no change → no call | Met | Unchanged |
| A1-7 | Emptied tags clear tags (`--tags ""` parity) | Met | Unchanged |
| A1-8 | Response only `{ changed, changedFields }`; list reloads | Met | Unchanged. The new handler tests also use `toEqual` on the whole error response |
| A1-9 | Refused edits (`CONTENT_EMPTY`, `CONTENT_TOO_LARGE`, `TOO_MANY_TAGS`, `INVALID_TAG`, `ITEM_ARCHIVED`, …) show catalog copy and keep the form open | **Met** (was NOT MET) | Every user-typable input now reaches `EditItem` and comes back as its code (§2, C1.1/C1.3a). Only a payload over 1 MB or 100 tags still throws at the schema, and that now shows the `UNEXPECTED` copy instead of failing silently (C1.2) |
| A1-10 | Draft only in React state | Met | Unchanged. The catch path does not persist anything |
| A1-11 | Schema caps (`content ≤ 40 000`, `tags ≤ 10 × 32`, `type` string) | **Deviated, justified and safe** | See §5 |
| A1-12 | Docs | Met | `specs/desktop.md` updated in the same commit as the code |
| A1-13 | Both loops green | Met | 377 / 1020 |

## 4. Acceptance criteria (refined.md §12), whole branch

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1–15 | Domain, use cases, CLI, MCP, supersede | Met | `src/**` has not changed since the second pass. Root 377 / 377 |
| 16 | Desktop card actions (Pin/Unpin, Edit, Archive; Show archived; reload after each) | Met | Unchanged since the third pass |
| 17 | Channel closed set updated deliberately (32) | Met | Unchanged |
| 18 | i18n in both catalogs, neutral Spanish | Met | No new keys. `UNEXPECTED` copy already exists |
| 19–21 | Toggle not persisted, no migration, fixtures | Met | Unchanged |
| 22 | Docs ship with the code | Met | `specs/desktop.md` in `a6ef166` |
| 23 | Loops green, root and `desktop/` | Met | Re-run by me |
| D-K (amended) | Desktop edit through `content:edit` over `EditItem`, same semantics as `valija edit` | **Met** (was Not met) | 11 tags, a 33+ char tag and over-32 KB content now give the same codes as the CLI, proven end to end through the real schema and handler |

**Result: 23 / 23 original criteria met, plus the D-K amendment.**

### Surface parity (`CLAUDE.md`)

The parity table from the third pass still holds. The one divergence, edit semantics on over-limit
input, is now closed: CLI and desktop return the same codes for the same input.

---

## 5. Plan adherence

- **Deviation: A1-11 schema caps.** `plan.md:1317` still describes `content ≤ 40_000` and
  `tags ≤ 10 × 32`. The code uses 1 MB / 100 × 256 / type 64. This follows the third-pass review's
  preferred fix, keeps the domain as the single source of truth for the limits, and is recorded where
  it matters: the schema comment and `specs/desktop.md:23`. It is **safe**. The schema is a payload
  bound, not a security control. `EditItem`'s parsers (`parseContent`, `parseTags`, `parseItemType`)
  still enforce 32 KB, 10 tags, tag grammar and the type enum before anything is written. The real-vault
  test proves the refusals. No unvalidated field can pass: `z.object` still strips unknown keys.
- No other deviations. The fix touches only the files the third pass named.

---

## 6. Hard gates

| Gate | Status |
|---|---|
| Security surface | **No breach.** No secret, key or content is logged. The renderer still shows only `errorCopy(code)`, never `error.message`, and the `catch` discards the error object. No content crosses IPC back (`toEqual` on whole responses). The draft is not persisted. No KDF, keychain, SQLCipher or MCP change. The looser zod caps are not a weakening, because the domain enforces the real limits before any write (§5). `register-handlers.ts:66-68` puts zod's issue text, not the input values, into the thrown message, as it already did for every channel |
| Tests for new behaviour / suites pass | **OK.** Every behaviour in the fix has a test except W3's Escape-while-saving guard (S-b, non-blocking: one boolean in a handler whose other branches are tested). Both suites pass |
| Ritual | **OK.** `refined.md`, then `plan.md` with `Approved:` (line 1) and `Approved (Amendment A1):` (line 2), then this review. The third-pass observation about when the A1 approval line was committed still stands as recorded. It is not a breach |
| Naming / placement | **OK.** No new files. `trapTab` is a local helper in the component and named as an action. The renderer is not a `domain/application/infra` layer |

---

## 7. Issues

### Critical

None.

### Warnings

**W4 (carried, for Oscar). Manual Electron check.** Run `cd desktop && npm run dev` against a real
vault in light and dark themes. Check `.modal-backdrop`, `.modal` and `.hint` contrast, plus the
second-pass visuals (`.item-row.archived`, `.item-action`, `.notice`, stacked `.error`). Also check
with a real keyboard that Tab wraps inside the dialog and that focus lands on Edit after Cancel. The
DOM tests cover the logic, not the visuals or the real focus order.

### Suggestions (non-blocking)

- **S-a. Focus trap gaps.** `trapTab` runs only for keydown events inside the dialog. If focus
  leaves the dialog without Tab (for example a click on `.modal-backdrop`, which is not focusable,
  moves focus to `<body>`), the next Tab reaches the background, and Escape stops working. Two ways
  to close this: make the backdrop `inert`-complement (`inert` on the screen's other content while
  `editing !== null`), or call `contentRef.current?.focus()` on a backdrop `mousedown`. Separately,
  the selector `"textarea, input, select, button:not([disabled])"` does not exclude disabled
  form fields. None are disabled today, but `:not([disabled])` on all four would keep the selector
  correct if `saving` ever disables the fields.
- **S-b. Test W3.** Add a DOM test: make `bridge.content.edit` return a pending promise, press
  Escape, assert the dialog is still present, then resolve the promise with a refusal and assert the
  copy is shown.
- **S-c. Stale plan text.** `plan.md:1317` still gives the old caps. A one-line note under the A1
  section ("caps raised to abuse limits in the fourth-pass fix; see `specs/desktop.md`") would stop
  the plan from contradicting the code. If Oscar treats the approved plan as frozen, the spec note
  is enough.
- **S-d. Style nit.** `item-edit-dialog.tsx:29-30`: the blank line between `contentRef` and
  `dialogRef` splits two related refs. Put them together.
- S2–S5 from the third pass (`parseTagsInput` cross-reference to `splitTags`, unused
  `changedFields`, `useState(() => draftFor(item))`, normalizing tags before comparing) are still
  open. Older minor suggestions (second-pass S8, S9; first-pass S3–S7) are also still open. All are
  minor.

---

## 8. Merge readiness

PASS. W4 (manual Electron check in both themes, including keyboard focus) is still Oscar's to do
before `git-ops` merges. S-a and S-b are worth folding into a follow-up.
