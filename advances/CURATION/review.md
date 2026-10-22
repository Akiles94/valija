Verdict: FAIL

# CURATION — Review (third pass: Amendment A1 + surface parity)

**Reviewed:** `feat/curation-CURATION`, `git diff main...HEAD`. That covers the whole branch. The
focus is the commits since the second-pass PASS (`2eb41d8`): `7769842` (merge of main, which
brought only `CLAUDE.md`'s "Surface parity" rule), `646fe59` (A1 docs), `9eadc36` (slice 9 code),
and `b1051db` (A1 docs).
**Against:** `advances/CURATION/refined.md` (D-K amendment at lines 370-373),
`advances/CURATION/plan.md` (line 1 `Approved: Oscar 2026-10-17`; line 2
`Approved (Amendment A1): Oscar 2026-10-17`; the "Amendment A1 — Slice 9" section at lines 1281-1324),
and `CLAUDE.md` "Surface parity (every advance)".
**Suites (I re-ran both):**
- Root `npm run typecheck && npm run lint && npm run test` passes, **377 / 377** (62 files). The one
  lint "info" is the existing `biome.json` deprecation notice.
- `desktop/` `npm run typecheck && npm run lint && npm run test` passes, **1013 / 1013** (67 files).
  The second pass counted 983. The difference is the main merge plus A1's tests.

**Verdict in one line:** A1 is mostly sound, and the branch now meets the parity rule. The
problem is the plan's own promise that a refused edit (`TOO_MANY_TAGS`, `INVALID_TAG`,
`CONTENT_TOO_LARGE`) "shows catalog copy and keeps the form open". For realistic inputs it does not:
the IPC schema throws before `EditItem` runs, and the renderer shows nothing. The DOM test that claims
to prove this mocks a response production can never return. This is the same kind of defect as the
first pass's C1, so it blocks.

---

## 1. Size

| Slice | Lines |
|---|---|
| Whole branch vs `main` (`--shortstat`) | 62 files, +4 704 / −89 |
| Whole-branch production (`src/**`, `desktop/src/**`, non-test, incl. CSS) | +1 225 / −63 |
| A1 production (`desktop/src`, non-test, `2eb41d8..HEAD`) | **+308 / −7** across 14 files. That includes 51 lines of CSS and the 102-line `item-edit-dialog.tsx` |
| A1 tests | +179 / −4 across 5 files |

The plan estimated about 185 production lines for slice 9: dialog ~80, `project.tsx` +15, and no
CSS line at all. The actual figure is about 65% over (dialog 102, `project.tsx` +54, CSS +51). The
growth is explainable (modal styling, separate save state) and no dependency file changed. It is noted,
not blocking.

---

## 2. Amendment A1: behaviour, point by point (plan.md §A1 "Behaviour")

| # | Plan statement | Status | Evidence |
|---|---|---|---|
| A1-1 | `itemActionsFor` adds `"edit"` only for live, non-imported items | **Met** | `renderer/state/item-actions.ts:13-19`; `item-actions.test.ts` table; DOM "offers no Edit on archived or imported items" |
| A1-2 | Modal, pre-filled with content, tags (comma-joined) and type | **Met** | `item-edit-dialog.tsx:41-47` (`role="dialog"`, `aria-modal`, `aria-labelledby`); `item-edit.ts:10-12` `draftFor`; DOM "opens a modal pre-filled…" |
| A1-3 | Escape or Cancel closes without saving | **Met** (with caveats W2, W3) | `item-edit-dialog.tsx:46-48, 89-91`; DOM "Escape and Cancel close without saving" |
| A1-4 | Focus returns to the Edit button | **Partially met, untested** (W1) | `item-edit-dialog.tsx:30-34` restores `document.activeElement` from mount time. No test asserts focus. After a reload while the dialog is open (a save, or `wireFocusRefresh`), the opener element has been unmounted, so focus falls to `<body>` |
| A1-5 | One item edits at a time | **Met** | Single `editing` state, `project.tsx:61` |
| A1-6 | Save sends only differing fields; nothing changed → no call, closes | **Met** | `item-edit.ts:23-38`; `project.tsx:117-122`; pure tests and DOM "closes without a call" |
| A1-7 | `--tags ""` parity: an emptied tags field clears the tags | **Met** | `parseTagsInput` (`item-edit.ts:15-20`) is the same split/trim/filter as the CLI's `splitTags` (`src/delivery/cli/curation-commands.ts:83-88`). Both feed `EditItem`'s `tags: []` → clear. Tested by `item-edit.test.ts` "sends an empty tag list" and the DOM save test (`tags: []`) |
| A1-8 | Response carries only `{ changed, changedFields }`; no content crosses back; list reloads | **Met** | `content-handlers.ts:81-85`; `messages.ts` `ContentEditResponse`; real-vault handler test uses `toEqual` on the whole response; `project.tsx:131-133` bumps `reloadToken` |
| A1-9 | A refused or invalid edit (`CONTENT_EMPTY`, `CONTENT_TOO_LARGE`, `TOO_MANY_TAGS`, `INVALID_TAG`, `ITEM_ARCHIVED`, …) shows catalog copy and keeps the form open with the user's text | **NOT MET** (C1) | See C1. It holds for `CONTENT_EMPTY`, `ITEM_ARCHIVED`, and `CONTENT_TOO_LARGE` between 32 KB and 40 000 chars. It fails for 11+ tags, any tag over 32 chars, and content over 40 000 chars: the user sees no copy |
| A1-10 | Draft lives only in React state; never preferences, never a file | **Met** | `ItemEditDialog` `useState(initial)`. No `preferences`/file calls in `project.tsx` or the dialog. The draft survives reloads because the dialog is rendered outside the `items` branches (`project.tsx:252-260`) |
| A1-11 | Schema: `id` ≤ 64, `content` ≤ 40 000, `tags` ≤ 10 × ≤ 32, `type` string | **Met as written**, but the caps are what cause C1 | `schemas.ts:44-50`; `schemas.test.ts` |
| A1-12 | Docs: `gui.md`, `specs/desktop.md`, `CHANGELOG.md`, `refined.md` D-K | **Met** (one stale sentence, S1) | `docs/gui.md:174-183, 377-379`; `specs/desktop.md:12, 23, 121`; `CHANGELOG.md:9-13`; `refined.md:370-373` |
| A1-13 | Done when: both loops green | **Met** | 377 / 1013, re-run by me |

### Security-specific checks requested

| Check | Result |
|---|---|
| No content crosses IPC back | **OK.** The handler maps to `{ changed, changedFields }` only. `changedFields` is field names. Errors go through `toIpcResult`, which returns only `{ code }`. The real-vault test `"returns only the error code"` asserts this with `toEqual` |
| Draft never persisted | **OK.** Component state only; nothing reaches preferences, localStorage or a file |
| Renderer never shows `error.message` | **OK.** `errorCopy(result.error.code)` only (`project.tsx:127`) |
| Request shape | **OK.** zod `z.object` strips unknown keys, so `{ id, ...fields }` in the handler cannot forward anything the schema didn't declare |
| Write path | **OK.** Only `EditItem`. No new domain, use-case, MCP, KDF, keychain or SQLCipher change |

---

## 3. Acceptance criteria (spec §12), whole branch

Rows 1–23 were all met at the second pass. A1 does not touch `src/**`, so rows 1–15 and 19–21 are
unchanged and stay **Met**. Rows that A1 touches:

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1–15 | Domain, use cases, CLI, MCP, supersede | **Met** | Unchanged since second pass; root suite 377/377 |
| 16 | Desktop cards: Pin/Unpin, Archive; Show archived with Unarchive; reload after each action | **Met** | Now also Edit (D-K amendment). Order Pin/Edit/Archive asserted in DOM test |
| 17 | Channels: closed set updated deliberately | **Met** | `channels.ts` +`content:edit` (31 → 32); `register-handlers` equality test passes; `specs/desktop.md:12` says 32 |
| 18 | i18n: new copy in both catalogs | **Met** | `en.ts`/`es.ts` `project.edit*`, `save`, `cancel`. Neutral Spanish, no voseo ("Separa…", "Déjalo…") |
| 19–21 | Toggle not persisted, no migration, fixtures | **Met** | Unchanged |
| 22 | Docs ship with the code | **Met** | See A1-12 |
| 23 | Loops green, root and `desktop/` | **Met** | 377 / 1013 |
| D-K (amended) | Desktop edit through `content:edit` over `EditItem`, same semantics as `valija edit` | **Not met** | Same semantics for valid input and for most refusals. Not the same for the input classes in C1: `valija edit --tags` with 11 tags prints `TOO_MANY_TAGS`, while the desktop silently does nothing |

**Result: 23 / 23 original criteria met. The A1 amendment is not met (A1-9 / D-K semantics).**

---

## 4. Surface parity (`CLAUDE.md`, new rule)

| Capability | CLI | Desktop | Parity |
|---|---|---|---|
| Pin / Unpin | `valija pin` / `unpin <id>` | card Pin / Unpin | Yes |
| Archive / Unarchive | `valija archive` / `unarchive <id>` (prints an Undo hint) | card Archive / Unarchive + Undo notice | Yes |
| Edit content / tags / type | `valija edit <id> --content-file/--tags/--type` | card Edit → modal | **Yes for capability.** Semantics diverge on the C1 inputs |
| Clear tags | `--tags ""` | empty tags field | Yes |
| Show archived | `valija show --archived` (marks `[archived]`) | "Show archived" toggle, own section | Yes |
| Item ids visible | `show` prints full ids | ids are internal to cards; the desktop addresses items by click | Acceptable: ids are a CLI addressing mechanism, not a capability |
| Supersede | none (no CLI save) | none (no desktop save) | Symmetric. MCP-only, which the rule allows ("MCP deliberately narrower") |

The branch satisfies the parity rule for the CURATION capabilities. Once C1 is fixed, the edit
semantics will match as well.

---

## 5. Plan adherence

- Every file in the A1 file table is present. `item-card.tsx` (type rename only) and `screens.css`
  are additions the plan didn't list. Both are justified: the card has to accept `CardAction`, and a
  modal needs styling. The CSS uses only existing tokens.
- Splitting `ItemAction` (bridge calls) from `CardAction` (adds `edit`) is a sound deviation. It
  keeps `performItemAction` as the single action → channel map and prevents "edit" from reaching it.
- `editError`/`saving` are separate from `actionError`/`busyId`. That is consistent with the C1 fix
  from the first pass.

---

## 6. Hard gates

| Gate | Status |
|---|---|
| Security surface | **No breach.** See §2 security table |
| Tests for new behaviour / suite passes | **Breach (part of C1).** Both suites pass, but the test for the refusal path (`project.dom.test.tsx` "keeps the dialog open with the user's text on a refused save") mocks `bridge.content.edit` to resolve `TOO_MANY_TAGS` for an 11-tag input. Production can never produce that response: the real schema rejects 11 tags (`schemas.test.ts` asserts exactly that) and throws. The test proves behaviour that does not exist, and no test covers the rejected-promise path |
| Ritual | **OK, with one observation.** `refined.md` D-K amendment, then the plan's A1 section, then line 2 `Approved (Amendment A1): Oscar 2026-10-17`, then this review. The approval line was committed in `9eadc36`, the same commit as the slice 9 code, not before it. `guard-implementation.sh` checks the working tree at edit time, so the gate was mechanically satisfied. I can't verify from git whether Oscar's say-so came first; the orchestrator asserts it did |
| Naming / placement | **OK.** `renderer/state/item-edit.ts` sits next to `item-actions.ts`, `focus-refresh.ts` and the other pure view-state modules. `renderer/components/item-edit-dialog.tsx` sits next to `item-card.tsx`. Both are kebab-case. Exported names (`draftFor`, `editRequestFor`, `parseTagsInput`, `EditDraft`, `ItemEditDialog`, `CardAction`) match the renderer's style. The renderer is not a `domain/application/infra` layer, so the no-bare-file rule does not apply |

---

## 7. Issues

### Critical

**C1. Refused edits beyond the IPC schema caps show no copy; the test for this path is a false
positive.**

- `desktop/src/main/ipc/schemas.ts:44-50` caps `tags` at 10 entries of at most 32 chars, and
  `content` at 40 000 chars.
- `register-handlers.ts:66-68` *throws* on a schema failure. It does not return an `IpcResult`.
- `project.tsx:123-136` (`saveEdit`) has `try/finally` and no `catch`. The rejection propagates to
  `onSave={(draft) => void saveEdit(…)}` as an unhandled rejection. `saving` resets, the dialog
  stays open, and **no message is shown**. The user presses Save and nothing visibly happens.
- Inputs that trigger this are realistic: typing 11 tags (the domain's `MAX_TAGS` is 10, and
  `parseTags` counts raw entries, so `TOO_MANY_TAGS` is the code the CLI would give); a tag of 33+
  chars (CLI: `INVALID_TAG`); pasting a document over 40 000 chars (CLI: `CONTENT_TOO_LARGE`).
- The plan (A1 "Behaviour") names exactly these codes as ones that must show catalog copy. The D-K
  amendment requires the same semantics as `valija edit`.
- `project.dom.test.tsx` ("keeps the dialog open … on a refused save") types 11 tags and mocks a
  `TOO_MANY_TAGS` response, so it passes against a path production cannot reach.

**To flip to PASS**, all three are needed:
1. Let the domain decide for every user-typable input. Either loosen the schema caps well past the
   domain's (e.g. `tags: z.array(z.string().max(256)).max(100)`, `content: z.string().max(1_000_000)`,
   still bounding the payload), or pre-check in the renderer and map to the same codes
   (`TOO_MANY_TAGS` / `INVALID_TAG` / `CONTENT_TOO_LARGE`). The first option keeps one source of
   truth and is preferred. Update the schema comment and `schemas.test.ts` to match.
2. Add a `catch` to `saveEdit` that sets `editError(errorCopy("UNEXPECTED"))`. This follows the
   established `REJECTED_CALL_CODE` pattern in `screens/import/import-screen.tsx:34,110-111`, so no
   rejected call is ever silent.
3. Add tests that use the real boundary: (a) a schema-plus-handler test showing an 11-tag request
   passes `SCHEMAS["content:edit"]` and the real-vault handler returns
   `{ ok: false, error: { code: "TOO_MANY_TAGS" } }`; (b) a DOM test where `bridge.content.edit`
   *rejects*, asserting the dialog stays open with the user's text and shows the `UNEXPECTED` copy.

### Warnings

**W1. Focus return is unverified and breaks after a reload.** `item-edit-dialog.tsx:30-34` stores
`document.activeElement` at mount and focuses it on unmount. No test checks this, although the plan
states it. After a successful save, or a window-focus reload while the dialog is open, `load()` sets
`items` to `null` (`project.tsx:69`). That unmounts the card, so the stored opener is detached and
focus falls to `<body>`. Fix: add a DOM test that Cancel returns focus to the Edit button
(`document.activeElement`). For the reload case, store the item id and refocus the card's Edit
button by id after reload, or accept `<body>` explicitly and document it.

**W2. No focus containment; the background stays keyboard-reachable.** The dialog sets
`aria-modal="true"`, but Tab can leave it and reach the toolbar, type chips, and other cards'
Pin/Archive buttons behind the backdrop. The backdrop blocks only the mouse. Escape is handled by
`onKeyDown` on the dialog, so once focus leaves, Escape no longer closes it. Fix: mark the rest of
the screen `inert` while `editing !== null`, or use a native `<dialog>` with `showModal()`, which
provides inertness, Escape, and focus containment. If jsdom limits are the concern, `inert` on the
sibling content is enough. Add a DOM test.

**W3. Escape while saving closes the dialog and loses the outcome.** Cancel is `disabled={saving}`,
but Escape is not guarded (`item-edit-dialog.tsx:46-48`). Pressing Escape mid-save unmounts the
dialog. If the save is then refused, `editError` is set on a closed dialog and the user never sees
it, and may believe the edit was saved. Fix: `if (event.key === "Escape" && !saving) onCancel();`.

**W4 (carried, for Oscar). Manual Electron check.** Run `cd desktop && npm run dev` against a real
vault in light and dark themes. Check the new `.modal-backdrop` (`color-mix` at 70% of `--color-bg`),
`.modal`, the `.hint` contrast, plus the second-pass items (`.item-row.archived`, `.item-action`,
`.notice`, stacked `.error`). The DOM tests do not cover visuals.

### Suggestions (non-blocking)

- **S1.** `specs/desktop.md:120` still says `itemActionsFor` gives "else pin/unpin + archive". It
  should now say "pin/unpin + edit + archive".
- **S2.** `parseTagsInput` (`item-edit.ts:15-20`) duplicates the CLI's `splitTags`
  (`curation-commands.ts:83-88`). The renderer cannot import `delivery/cli`, so the duplication is
  defensible. A comment cross-referencing the CLI function would keep the two from drifting.
- **S3.** `ContentEditResponse.changedFields` is never read by the renderer. Either use it (e.g. a
  short "Saved: content, tags" notice, matching the CLI's `(content, tags)` output) or drop it to
  keep the wire contract minimal.
- **S4.** `initial={draftFor(editing)}` is recomputed on every render of `ProjectScreen` while the
  dialog is open, and ignored after mount. It is cheap, but `useState(() => draftFor(item))` inside
  the dialog, passing the item itself, makes the "initial only" intent explicit.
- **S5.** `editRequestFor` compares raw typed tags with stored, normalized tags. Typing `DB` for a
  stored `db` sends a request that the domain turns into a no-op (`changed: false`). This is harmless
  and matches the CLI, but normalizing (`toLowerCase()`) before comparing would avoid the round trip.
- Second-pass S8, S9 and first-pass S3–S7 are still open. All are minor.

---

## 8. What flips this to PASS

Fix C1 (all three parts), and re-run both loops. W1–W3 are strongly recommended in the same pass,
since they are small and in the same component. W4 stays Oscar's manual check before `git-ops` merges.
