Verdict: FAIL

# CURATION — Review (first pass)

**Reviewed:** `feat/curation-CURATION`, `git diff main...HEAD`. That is 12 commits: 4 docs/ritual
commits and 7 implementation slices (`c45b8f9` … `3c3e76e`).
**Against:** `advances/CURATION/refined.md` (Gate R approved 2026-10-17, D-A…D-P at defaults) and
`advances/CURATION/plan.md` (`Approved: Oscar 2026-10-17`, line 1; P-1…P-10 at defaults, suffix-free
class names).
**Suites (re-run by me):** root `typecheck && lint && test` passes, **376 / 376** (62 files).
`desktop/` `typecheck && lint && test` passes, **983 / 983** (66 files). Both exit 0.

**Verdict in one line:** the security-critical core is sound. `supersedes` is atomic, scoped to one
project, and refuses pinned, imported and archived targets, and it leaks nothing across projects. All
writes go through `session.write`, there is no migration, and the fixtures are byte-identical. Two
problems block the merge, and both are small to fix:

- **C1.** The desktop shows the error for a refused curation action and then clears it in the same
  tick. The DOM test that claims to cover this only passes because it catches the brief moment the
  error is on screen.
- **C2.** The test that should prove "ambiguous prefix lists the candidates" (spec §12) asserts
  nothing. Its only assertion would pass even if no candidate were listed.

Both fall under the same gate: the tests have to prove what they claim to prove.

---

## 1. Size

| Slice | Lines |
|---|---|
| Whole range (`--stat`) | 58 files, +4 003 / −89 |
| `advances/CURATION/*.md` | +1 806 (spec + plan) |
| Production (`src/**`, `desktop/src/**`, non-test; includes CSS + catalogs) | **+917 / −63** (plan estimate ~880) |
| Tests | +1 197 / −8 |
| Docs (SPEC, specs ×3, README, gui.md, CHANGELOG) | +83 / −18 |

The production size is within about 4% of the plan. No dependency files changed (`package*.json`
diff is empty).

---

## 2. Acceptance criteria (spec §12)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | pin/unpin/archive/unarchive/edit per §5, incl. no-ops and every §6 code | **Met** | `src/context/domain/services/item-curation.ts` (`refuseUncuratable` checks imported → archived; `setPinned` guards only `pinned=true`; `setArchived` total; `applyEdit`; `archiveSuperseded` → `ITEM_PINNED`). Tested in `item-curation.test.ts` and the three use-case tests |
| 2 | One bump per change, zero per rejection/no-op | **Met** | `saveIfChanged` (`item-curation-steps.ts:25`) is the only curation route into `session.write`. Generation probes in `set-item-pinned` (one bump, repeat zero, ambiguous zero, archived zero), `set-item-archived` (repeat zero), `edit-item` (identical zero, rejection zero) and `save-context` (each refusal zero) |
| 3 | Every change sets `updatedAt = now`; edit keeps id/createdAt/source/pinned | **Met** (weakly tested, see W1) | Domain: `item-curation.test.ts` asserts `updatedAt: now` for pin/archive/edit. Persistence goes through the existing upsert of `updated_at`. `edit-item.use-case.test.ts` "edits all three" checks id/createdAt/pinned/source kept |
| 4 | Imported: archive/unarchive ok; pin/edit → `ITEM_NOT_CURATABLE` | **Met** | `set-item-archived` "works on imported items", `set-item-pinned` "refuses an imported item", `edit-item` "refuses archived and imported" |
| 5 | Re-import does not un-archive (D-H) | **Met** | `import-items.use-case.ts:95-96`; `import-items.use-case.test.ts` "keeps a chunk the user archived archived across a re-import" |
| 6 | No use case calls another; unscoped `archive()` gone | **Met** | Shared steps live in `application/services/item-curation-steps.ts`. `grep -rn "\.archive(" src desktop/src` returns nothing. The port loses `archive` (`ports/repositories.ts`) |
| 7 | `show` prints every full id; `--archived` includes and marks | **Met** | `render.ts:34` `itemHeaderLine`; `render.test.ts`; `content-commands.ts` passes `includeArchived`; `show-project.use-case.test.ts`. The CLI flag wiring itself is not tested (S2) |
| 8 | Full id or ≥6 prefix; ambiguous → `ITEM_ID_AMBIGUOUS` **listing candidates**; unknown → `ITEM_NOT_FOUND` | **Not met (unproven)** | The implementation lists candidates (`item-curation-steps.ts:37-41`), but no test proves it. See **C2** |
| 9 | `edit` from file/stdin, tags replace, type among five, no flags → `NOTHING_TO_EDIT`, no editor/temp file | **Met** | `curation-commands.ts` `readContent` (`readFileSync(path === "-" ? 0 : path)`). `EditItem.parseInput` uses `parseItemType` (five types; `"imported"` → `INVALID_ITEM_TYPE`, tested). `grep spawn\|child_process\|tmpdir\|writeFileSync curation-commands.ts` returns nothing. The stdin branch is untested (plan A5, accepted) |
| 10 | After `edit`, search finds new and not old | **Met** | `item-repo.test.ts` "re-indexes FTS…", `edit-item.use-case.test.ts` "re-indexes search", CLI test "edit reads content from a file…" |
| 11 | Still 5 tools; only `supersedes` added | **Met** | `server.test.ts` "keeps every tool's input schema exactly as declared" checks the exact key sets for all five tools |
| 12 | Supersede is atomic; response names both ids | **Met** | `save-context.use-case.ts:62-75`: the target is checked before any save, and both saves happen in one `session.write`. `commitWrite` rolls back on `err` (`vault-sessions.ts:115-139`). `server.test.ts` asserts `Item id: … Archived superseded item <oldId>.` |
| 13 | Bad target (unknown/other project/archived/pinned/imported) fails whole call; nothing saved | **Met** | `save-context.use-case.test.ts` "fails atomically" checks every code, generation unchanged, and the item count unchanged. "does not create the project" proves the rollback also undoes project creation. The other-project message omits the other project's name (`retireSuperseded`, one template for both cases) |
| 14 | `search_context` lines include id; `get_context` unchanged | **Met** | `server.ts:155`; `server.test.ts` "search_context lines carry the item id". `context-pack-markdown.ts` and fixtures are untouched (diff empty) |
| 15 | No MCP response contains an archived item | **Met** | `server.test.ts` "supersedes archives the old item, and it never surfaces again" (`get_context` and `search_context`: neither the word nor the id). No new MCP read path: `findById`/`findByIdPrefix` are reachable only from use cases whose output has no content |
| 16 | Cards: Pin/Unpin, Archive; Show archived with Unarchive; list reloads after each action | **Met** | `item-actions.ts`, `item-card.tsx`, `project.tsx`; DOM tests cases 1–4 |
| 17 | Channels in `CHANNELS`/`SCHEMAS`/`ChannelMap`/bridge; closed-set test passes; handlers call use cases only | **Met** | `channels.ts:69-70,110-117`, `schemas.ts:42-43`, `preload/index.ts`, `bridge.ts`. `register-handlers.test.ts` is green. Handlers call only `getContainer().setItemPinned` / `setItemArchived` |
| 18 | Every new string and error code in `en.ts` + `es.ts`; `catalogs.test.ts` passes | **Met** | 6 `errors.*` + 10 `project.*` keys in each catalog; `error-copy.test.ts` and `catalogs.test.ts` are green. Copy never says "deleted" |
| 19 | "Show archived" not persisted | **Met** | `project.tsx` holds `showArchived` in `useState` only and never touches `preferences`. DOM test "never persists…" |
| 20 | No migration; schema v3 | **Met** | `git diff main...HEAD --stat -- src/shared/infra/migrations*` is empty |
| 21 | Golden fixtures byte-identical; conformance test unmodified | **Met** | The diff for `src/testing/__fixtures__`, `context-pack.ts`, `context-pack-markdown.ts`, `docs/vault-format.md` and the conformance tests is empty |
| 22 | Docs: gui.md boundary rewritten; SPEC §5/§7/§8, specs ×3, README, CHANGELOG | **Met** | All present. gui.md "Curate your content" was rewritten as "Edit or delete your content" with honest archive copy. `specs/desktop.md` 29 → 31 |
| 23 | Loops green, root and `desktop/` | **Met** | 376 / 983, re-run by me |

**Result: 22 of 23 met. #8 is not proven by any test.**

---

## 3. Plan adherence

The plan was followed slice by slice: same files, same names, same placement. Deviations:

| Deviation | Assessment |
|---|---|
| The slice 6 "handler never imports a repository" grep test was not added | **Justified.** `desktop/src/main/ipc/handlers/import-no-reimplementation.test.ts` scans every non-test `.ts/.tsx` under `desktop/src` for `context/infra/item-repo`, `project-repo` and `vault-sessions`, so `content-handlers.ts` is already covered. A second grep test would be duplication. |
| The slice 7 manual Electron check (`npm run dev`, light/dark) was not performed | **Not verified.** It is not blocking by itself, but see W2. |
| Final-gate grep 6 matched `.execute(` | A false positive on `exec`. My narrower grep (`spawn\|child_process\|tmpdir\|writeFileSync\|execSync`) returns nothing. |
| Slice 7 plan step 3 + DOM case 5 ("error renders catalog copy") | The plan's own step order (setError, then reload) cancels the error. The implementation followed the steps literally, so the stated outcome is not delivered. See C1. |

---

## 4. Hard gates

| Gate | Status |
|---|---|
| Security surface (§10) | **No breach.** Parsing happens before any session opens (lock-first tests for `INVALID_ITEM_ID`, `NOTHING_TO_EDIT`, malformed `supersedes`). The `[A-Za-z0-9-]` charset gates `LIKE`, and every value is a bound parameter. `toIpcResult` strips messages, so ambiguity candidate ids never reach the renderer. The response is `{ changed }` only. No `console.*` in `src/context`. No plaintext temp file and no inline `--content`. No new dependency. Error messages echo at most 70 chars of input and never contain content. |
| Tests for new behaviour / suite passes | **Breached (C1, C2):** two tests claim properties they do not prove. The suites themselves pass. |
| Ritual | **OK.** `refined.md` records Gate R; `plan.md` line 1 is `Approved: Oscar 2026-10-17`; commit `63e9072` (Gate P) precedes the first implementation commit `c45b8f9`. |
| Naming / placement | **OK.** `domain/values/item-id.ts`, `domain/services/item-curation.ts`, `application/services/item-curation-steps.ts` (a new kind-named subfolder, with the precedent `vault/application/services/`), `application/dto/item-curation-output.ts`, `use-cases/*.use-case.ts`. No bare files at layer roots. The `item-repo.ts` placement is pre-existing (plan F9). |

---

## 5. Issues

### Critical (block the merge)

**C1. A refused action's error copy is wiped by the reload it triggers.** `desktop/src/renderer/screens/project.tsx:82-89`

```ts
if (!result.ok) setError(errorCopy(result.error.code));   // line 85
...
setReloadToken((n) => n + 1);                             // line 88
```

React batches these updates into one render. The changed `reloadToken` then re-runs the effect, and
`load()` runs `setError(null)` unconditionally (line 57). So the error is on screen for exactly one
commit and is gone before the user can read it. In practice a click on Pin that is refused (for
example, the item was archived from the CLI meanwhile, giving `ITEM_ARCHIVED`, or a stale id giving
`ITEM_NOT_FOUND`) gives **no feedback at all**. The reload then succeeds and silently shows the true
state. `VAULT_LOCKED` happens to survive only because the reload fails again.

The DOM test "renders the catalog copy for a refused action" (`project.dom.test.tsx:342-354`) passes
only because `findByText` can observe that one transient commit. It never checks that the text is
still there once the reload has finished.

*To fix:*
- Keep action errors in their own state (e.g. `actionError`), rendered beside `error`, set in
  `runAction` and cleared only at the start of the next `runAction` (or when the notice is
  dismissed). `load()` keeps clearing only the load error.
- Strengthen the test: after `findByText(...)`, run
  `await waitFor(() => expect(bridge.content.show).toHaveBeenCalledTimes(2))`, then assert that
  `screen.getByText("That item is archived — unarchive it first.")` is still present.

**C2. The ambiguity test asserts nothing, so "listing candidates" (AC #8) is unproven.**
`src/context/application/use-cases/set-item-pinned.use-case.test.ts:59-68`

```ts
const r = pin.execute({ item: "01SEQ0", pinned: true });
expect(!r.ok && r.error.message).toContain(first.slice(0, 6));   // first.slice(0, 6) === "01SEQ0"
expect(second).toBeDefined();
```

`SeqIds` produces `01SEQ000001`, `01SEQ000002`, …, so `first.slice(0, 6)` is the reference itself.
The message always starts with `"01SEQ0" matches several items:`, so the assertion passes even if
`ambiguityMessage` listed no ids at all. `expect(second).toBeDefined()` is vacuous too. No other
test (CLI or use case) checks the candidate list; the CLI test checks only the code.

*To fix:* `expect(msg).toContain(first)` and `expect(msg).toContain(second)` (full ids). Ideally also
add one case with more than 5 matches that asserts `", and more"` and that only 5 ids are listed.
The vault already holds many `01SEQ…` items by then, so `"01SEQ0"` itself probably triggers it.

### Warnings (should fix; not blocking on their own)

**W1. The test name "advances updatedAt" asserts nothing about `updatedAt`.**
`set-item-pinned.use-case.test.ts:28` calls `clock.advanceMinutes(5)` but never reads `updatedAt`.
Neither `ContextItemView` nor `ItemCurationOutput` carries it. Across all curation paths,
`updatedAt = now` is proven only in the pure domain test, never after persistence.

*Suggested fix:* read it back through `vault.sessions.withSession((s) => ok(s.items.findById(id)))`
and compare it with `clock.now()`, or rename the test.

**W2. The manual desktop check was not run.** The plan's slice 7 "Done when" requires
`cd desktop && npm run dev` against a real vault in light **and** dark themes. The new CSS
(`.item-row.archived` dashed + muted, `.item-action` link buttons, `.notice`) has never been seen
rendered. Oscar should do that check before shipping. The DOM tests do not cover visual contrast.

### Suggestions

- **S1.** `runAction` (`project.tsx:82`) has no `try/finally`. If the IPC promise rejects, `busyId`
  stays set, so that card's buttons stay disabled until a remount, and the rejection goes unhandled.
  Most screens behave the same way (only `diagnostics.tsx` catches), so this is consistent, but a
  `finally { setBusyId(null); setReloadToken(...) }` costs two lines.
- **S2.** `show --archived` wiring (`program.ts` option → `showCommand` → `includeArchived`) has no
  test. A small `showCommand(container, "cli", { archived: true })` case in
  `curation-commands.test.ts` that asserts the `[archived]` marker would close it.
- **S3.** `item-repo.ts`: `toItemWithProject` is declared above the `toItem` it calls. It works,
  because the call happens later, but reads backwards. Move it below `toItem`.
- **S4.** `item-curation-output.ts`: `found.projectName as string` is a redundant cast, since a
  branded string is already assignable to `string`.
- **S5.** `valija edit <bad-id> --content-file -` blocks on stdin until EOF before it reports
  `INVALID_ITEM_ID`, because the file is read before the use case parses the reference. Minor UX.
  It could be fixed by parsing the reference first, but that would put domain parsing in the CLI
  adapter, so leaving it is defensible.
- **S6.** `findByIdPrefix` uses a case-insensitive `LIKE`, which cannot use the primary-key index,
  so every prefix lookup is a table scan. That is fine at single-user scale, and the exact-id path
  runs first, so the desktop and full ids never hit it. Note it only if vaults grow large.
- **S7.** The archive notice survives filter and toggle changes, and its Undo button is not disabled
  while `busyId` is set. A double click only produces a harmless no-op (`changed: false`, no bump).

---

## 6. What flips this to PASS

1. **C1:** keep a refused curation action's error visible after the reload it triggers, and extend
   the DOM test to assert that the copy is still present once `show` has been called the second time.
2. **C2:** make the ambiguity test assert both full candidate ids (ideally also the 5-id cap with
   `", and more"`).
3. Re-run both loops green.

W1 and W2 are strongly recommended in the same pass. W2 is Oscar's manual check and can happen at
Gate "Ship".
