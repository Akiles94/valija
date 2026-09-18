Verdict: PASS

# GUI-LAYOUT — Review (third pass, after `63c05d8`)

**Reviewed:** `feat/desktop-GUI`, `bfd8ac9~1...HEAD` (`63c05d8`), 23 commits — the 21 implementation
commits plus two review-fix commits.
**Against:** `advances/GUI-LAYOUT/refined.md` (Gate R closed 2026-09-15) and
`advances/GUI-LAYOUT/plan.md` (`Approved: Oscar 2026-09-16`, line 3).
**Prior verdicts:** pass 1 FAIL (criterion #48, Settings axis + W1–W5 + S1–S7);
pass 2 FAIL (criterion #45 alone — the relocation wizard laid out inside the 220px sidebar track).

**Verdict in one line:** `63c05d8` is a 24-line, CSS-only commit that closes the second pass's single
blocking defect, and I verified the whole causal chain rather than the claim: `workspaceChrome` really
does return `sidebar: false` for `relocate-vault` (unit-tested), `app.tsx` really does omit the
component for that case, `WorkspaceSidebar` is the **only** thing in the renderer that emits the
`sidebar` class token, and the new `.workspace:not(:has(.sidebar))` therefore matches exactly one
screen and gives it a single full-width column. **All 70 acceptance criteria are now met**, no hard
gate is breached, and both suites are green at 303 / 930 — the desktop count unchanged, which is right
for a commit that changes no behaviour.

---

## 1. Size

| Slice | Files | Lines |
|---|---|---|
| Whole range (`--shortstat`) | 54 | **+6 276 / −762** |
| — `advances/GUI-LAYOUT/*.md` | 4 | +2 976 |
| — `desktop/src/**` (prod + tests) | 49 | +3 258 / −752 |
| — `docs/gui.md` | 1 | +42 / −10 |
| `63c05d8` alone, code | **2** | **+24 / −0** |
| — of which TSX/TS | **0** | **0** |

`63c05d8` touches `layout.css` (+12), `screens.css` (+12) and `advances/GUI-LAYOUT/review.md`.
Nothing else. The "CSS-only" claim is literally true (`git show --stat 63c05d8`), and half of those
24 lines are comments explaining *why* each rule exists — which is the right ratio for three rules
whose failure mode is invisible.

---

## 2. The fix, verified end to end

### 2.1 C1 — the sidebar-less workspace (`layout.css:17-23`)

```css
/* §5.9: relocate-vault renders with no sidebar (workspaceChrome's
   sidebar: false) — without this, .workspace-content becomes the grid's
   only item and lands in the 220px sidebar track instead of the full-width
   centred flow the screen expects. */
.workspace:not(:has(.sidebar)) {
  grid-template-columns: minmax(0, 1fr);
}
```

Every link in the chain checked in the tree, not taken from the commit message:

1. **`relocate-vault` is the sidebar-less view.** `state/workspace-chrome.ts:67-68` returns
   `{ sidebar: false, active: null, trail: [] }` for it, and it is the only branch that does — the
   other eight return `sidebar: true` (`workspace-chrome.ts:32,36,44,57,62`,
   `:100-101`). Pinned by `workspace-chrome.test.ts:83-89`, which asserts the whole object with
   `toEqual`, so a future `sidebar: true` there is a test failure, not a silent relayout.
2. **`app.tsx` really omits the component.** `app.tsx:326-333` is
   `{chrome.sidebar && (<WorkspaceSidebar … />)}` — a `false` short-circuit renders no node at all, so
   `.workspace-content` (`app.tsx:334`) is the grid's only child. `app.shell.test.ts:16-20` pins that
   there is exactly one `<WorkspaceSidebar` mount in the file and that it is derived from
   `workspaceChrome(`.
3. **`.sidebar` is emitted in exactly one place.**
   `grep -rn 'className="[^"]*sidebar' desktop/src/renderer --include=*.tsx` returns three hits:
   `workspace-sidebar.tsx:44` (`<nav className="sidebar">`), plus `sidebar-spacer` (`:61`) and
   `sidebar-settings` (`:66`) — both **different class tokens**, which `.sidebar` does not match, and
   both nested *inside* that same `<nav>` anyway. So `:has(.sidebar)` cannot be satisfied by anything
   but the real sidebar, and cannot be missed when the real sidebar is present (`:has()` is a
   descendant check and the `<nav>` is a direct child of `.workspace`).
4. **The cascade resolves the way the fix needs.** `.workspace:not(:has(.sidebar))` is specificity
   (0,2,0) — `:not()` and `:has()` take their most-specific argument — against `.workspace`'s (0,1,0)
   at `layout.css:11-15`, and it is later in the file besides. Below 900px the media query's
   `.workspace { grid-template-columns: 1fr }` (`layout.css:175-176`) is still (0,1,0), so the
   sidebar-less rule keeps winning there too; `minmax(0, 1fr)` and `1fr` are equivalent for a lone
   column (the former is strictly safer — no min-content floor), so the narrow layout is unchanged.
5. **The wizard now actually centres.** With one full-width column, `.workspace-content > .screen`
   (`layout.css:81-85`, `max-width: 1040px; margin: 0 auto; padding: 24px`) is overridden for this
   screen by `.screen.relocate-vault { max-width: 560px; margin: auto }`
   (`screens.css:420-423`) — equal specificity (0,2,0), and `screens.css` is imported after
   `layout.css` (`app-main.tsx:3-6`), so source order gives it the win. `relocate-vault.tsx:100`
   carries `className="screen relocate-vault"`, so the rule reaches. The result is a 560px card
   centred in the window, which is what §5.9's "full-focus centred flow" asks for.

This still cannot be asserted by a test (jsdom does not lay out, and `relocate-vault.dom.test.tsx` is
byte-identical to base either way), so it remains review-by-eye — but the reasoning above is
mechanical, not aesthetic, and the four facts it rests on are each grepped or unit-tested.

### 2.2 W1 — `align-content: start` at the breakpoint (`layout.css:174-181`)

Present, inside the existing `@media (max-width: 900px)` block's `.workspace` rule (line 180), with a
comment naming the cause. No second media query was introduced — D-4's "one breakpoint" holds.

I checked the rule does not trade one layout bug for another. With `height: 100vh` and
`align-content: start`, grid's *stretch auto tracks* step is skipped, so a **short** page no longer
splits leftover height between the nav strip and the content (the defect). A **tall** page is
unaffected: the *maximize tracks* step can only distribute the container's own free space, so the
content row is still capped at `100vh − (strip height)` and `.workspace-content`'s `overflow-y: auto`
(`layout.css:77-79`) still engages. The strip freezes at its max-content height first because it is
the smaller growth limit. No viewport overflow either way.

### 2.3 S1 — focus rings on the two hidden-input controls

`screens.css:483-488` (`.chip:has(input:focus-visible)`) and `screens.css:820-825`
(`.segmented label:has(input:focus-visible)`), both `outline: 2px solid var(--color-accent);
outline-offset: 2px`. Both are correct as written:

- The input is a **child** of the styled element in both markups — `project.tsx:94-99` (`<label
  className="chip"><input type="radio" …>`) and `settings.tsx:106-114` (`<label><input
  type="radio" …><span>`) — so `:has()` reaches it.
- The hidden inputs use `position: absolute` with **all offsets `auto`** (`screens.css:470-475`,
  `:808-813`), so the box stays at its static position inside the label; focusing it cannot scroll the
  page somewhere unexpected.
- On the *checked* chip — the one a Tab lands on, since tabbing into a radio group focuses the
  checked member — the chip's own background is `--color-accent`, but `outline-offset: 2px` puts a 2px
  band of page background between the fill and the ring, so the ring reads against `--color-bg`, not
  against itself.
- No new custom property: both rules reuse `--color-accent` (`tokens.css` is byte-identical, see §5).
  §4.2 forbids new tokens, not an outline built from an existing one.

---

## 3. Acceptance criteria (refined.md §9)

Rows marked **(re-v3)** were re-verified against `63c05d8` in this pass. The remainder were each
verified mechanically in passes 1 and 2 and are untouched by a commit that changes two stylesheets;
their evidence is carried forward unchanged.

### Shell and navigation (§3.1)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `nav-bar.tsx` gone; `base.css` `.nav-bar*` rules gone | MET | `app.shell.test.ts:22-33` |
| 2 | Sidebar on every unlocked screen, today's order, spacer, Lock now, Settings | MET **(re-v3)** | `workspace-sidebar.tsx:44-70`; still the sole `.sidebar` emitter |
| 3 | Icon **and** label per entry; icon `aria-hidden` | MET | `workspace-sidebar.tsx:57-58`; `icons.tsx` |
| 4 | Active entry `aria-current="page"` + non-colour-only; drill-downs have none | MET | `layout.css:55-61` (accent + inset bar + weight 600) |
| 5 | The four §5.0 trails; non-final segments go where Back went | MET | `workspace-chrome.ts:18-105`; `breadcrumb.tsx:18-39` |
| 6 | Trail from a pure, unit-tested mapping | MET **(re-v3)** | `workspace-chrome.test.ts` — including `:83-89`, the `sidebar: false` case the C1 fix depends on |
| 7 | Lock now / Settings behaviour unchanged | MET | `app.tsx:326-333` |

### Dashboard (§3.2 step 5)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 8 | No text input of any kind | MET | no `input`/`<form>` in `dashboard.tsx` |
| 9 | Card grid, 2 cols at ~1120px, icon + name + count + last activity | MET | `screens.css:17-23` |
| 10 | `const header` block intact, 4 branches, no `setView`; test unmodified | MET **(re-v3)** | `import-entry-points.test.ts` byte-identical to base (`sha256`) |
| 11 | Empty branch keeps `connectATool` + `importHistory` | MET | untouched |

### Project detail (§3.2 steps 6–7)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 12 | `<select>` gone; wrapping chip row, single-select + keyboard nav | MET **(re-v3)** | `project.tsx:91-125`; the hidden radio keeps tab order and arrow keys (`opacity: 0`, not `display: none`), and **now has a visible focus ring again** (`screens.css:485-488`) |
| 13 | A chip issues the same `bridge.content.show` call | MET | untouched |
| 14 | Pinned grouped above the rest by a pure, tested stable partition | MET | `state/pinned-partition.ts` + its test; `project.tsx:85` |
| 15 | `ItemCard` unchanged; `project.dom.test.tsx` passes | MET | `item-card.tsx` absent from the whole range |

### Search (§3.2 steps 8–9)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 16 | Master-detail split; left column project · type · date · truncated preview | MET | `search.tsx:103-140`; `screens.css:167-171` |
| 17 | First hit selected on completion; re-run/scope change re-selects | MET | `search-selection.ts:10-12`; DOM cases 1 and 3 |
| 18 | Right panel shows full content + Open project routing | MET | `search.tsx:125-138` |
| 19 | Call shape / hit order / empty-query behaviour unchanged, no new IPC | MET | no handler in the last two commits' diffs |
| 20 | Selecting a hit performs no IPC and no re-query | MET | `search.dom.test.tsx:100-114` |

### Context pack (§3.2 steps 10–11)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 21 | Rendered by default, visible toggle to the literal `<pre>` | MET | `pack-preview.tsx:26,91-96` |
| 22 | DOM test proves Copy sends the exact original markdown in both views | MET | `pack-preview.dom.test.tsx:73-99` |
| 23 | Export call, select and success line unchanged | MET | handlers untouched |
| 24 | One toolbar; amended notice accurate in both views and both catalogs | MET | `en.ts`/`es.ts` |

### Connect tools (§3.2 step 12)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 25 | Card grid; three steps permanently visible in a rail | MET | `connect-tools.tsx:110-140` |
| 26 | Node/npm warning in the rail, never disables Connect | MET | `connect-tools.tsx:133-141` |
| 27 | Card states unchanged | MET | JSX moved wholesale |

### Import (§3.3)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 28 | Table with checkbox/title/date/chunks, compact rows | MET | `import/conversation-table.tsx:39-89`; `screens.css:657-660` |
| 29 | Sticky header, bounded scroll container | MET | `screens.css:646-651`, `662-667` |
| 30 | **Both** affordances: header checkbox **and** a "Select all" text link | MET | `conversation-table.tsx:43-58` + `import/import-screen.tsx:277-286` |
| 31 | Both operate on visible rows only; hidden rows keep state | MET | `import-selection.ts:62-77`; 7 unit cases + DOM case 14 |
| 32 | Real `indeterminate` for a partial visible set | MET | `conversation-table.tsx:51-53`; DOM case 15 |
| 33 | Persistent rail with file, format, "N of M selected" (M = full listing), picker, Preview, Import | MET | `import-screen.tsx:303-358`; `screens.css:639-645` |
| 34 | Exactly one `aria-live="polite"` region, `aria-busy`, completion `scrollIntoView` | MET | `import/import-status.tsx:32`; DOM case 18 |
| 35 | Every IMPORT-FEEDBACK guard survives; `import.dom.test.tsx` passes | MET | green; no assertion weakened across either fix commit |
| 36 | `buildPickSpec` still emits original 1-based indices | MET | untouched; unit test |

### Diagnostics (§3.4 step 18)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 37 | Three labelled sections from a pure, tested grouping | MET | `state/diagnostic-groups.ts:31-45` |
| 38 | Unknown key → fallback group, rendered only when non-empty | MET | `diagnostic-groups.ts:17-22,42` |
| 39 | Severity dot **and** status word; explanation in detail; `extra` survives | MET | `diagnostics.tsx:40-50` |
| 40 | Toolbar beside the title; both probe notices above the table | MET | `diagnostics.tsx:118-130` |
| 41 | **Zero `useEffect`**; probes only in `handleRunChecks`; test unmodified | MET **(re-v3)** | `diagnostics.no-auto-run.test.ts` byte-identical to base (`sha256`), green |

### Sync & safety (§3.4 step 19)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 42 | Stat cards + wide device card, same single mount-time read | MET | `sync.tsx:100-157` |
| 43 | Conflict/stale banner, **no resolve affordance** | MET | `sync.tsx:97-111` — `<p>`s only |
| 44 | Nothing editable; Move my vault… primary | MET | `sync.tsx:87-96` |

### Relocation wizard (§3.4 step 20)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 45 | No sidebar; **in the entry cluster's visual language**; 3-step indicator from a pure tested mapping, conveyed non-visually | **MET (was NOT MET)** **(re-v3)** | `layout.css:21-23` gives the sidebar-less workspace a single `minmax(0, 1fr)` column, so `.screen.relocate-vault { max-width: 560px; margin: auto }` (`screens.css:420-423`) now centres a 560px card in the full window instead of a ~172px strip in the sidebar track. Chain verified in §2.1 above: `workspace-chrome.ts:67-68` (+ `workspace-chrome.test.ts:83-89`) → `app.tsx:326-333` (+ `app.shell.test.ts:16-20`) → `workspace-sidebar.tsx:44` as the sole `.sidebar` emitter → the selector. The indicator itself (`state/relocation-steps.ts` + test, `relocate-vault.tsx:102-112`, `aria-current="step"`) was already correct |
| 46 | Preflight is one centred card with exactly today's information; every stage/refusal/retry/copy-line unchanged | MET **(was MET markup-only)** **(re-v3)** | `relocate-vault.tsx` still absent from both fix commits' diffs; the containing column that was wrong under #45 is fixed, so the centred card is now centred in fact as well as in markup |
| 47 | `relocate-vault.dom.test.tsx` passes | MET **(re-v3)** | byte-identical to base (`sha256`), green |

### Settings (§3.4 step 21)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 48 | **Left mini-tab list** with the four sections and the selected section **on the right**; no fifth tab | MET | `screens.css:749-787` (two-column grid, `1 / -1` spans for h1 and Close, column tab list, inset-bar selected state); collapse at `layout.css:215-222` |
| 49 | Segmented controls, same options/update calls; tab semantics + keyboard | MET **(re-v3)** | `settings.tsx:87-141`; `tab-navigation.ts` + test; the segmented radios now also show a focus ring (`screens.css:822-825`) |
| 50 | No bridge, no IPC; locked notice; Help holds only replay | MET | no new import; `onboarding-settings.no-session.test.ts` unmodified |
| 51 | Settings still opens from the locked screen | MET | `locked.tsx:68` untouched |

### Entry cluster (§3.5 steps 22–23)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 52 | One shared left panel, identical copy, both catalogs | MET | `components/entry-shell.tsx`; `app.tsx:231-287` |
| 53 | Dark treatment adds no custom property; split legible in dark | MET | `entry-shell.tsx:16`; `layout.css:126-128`; `app.theme.test.ts:31-35` (additive third case; both original cases byte-unchanged) |
| 54 | Each screen's content/copy/validation/routing unchanged | MET | none of the four screens is in the diff |

### Recovery kit (§3.5 step 24)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 55 | Once-only banner above the title, new key in both catalogs | MET | `recovery-kit.tsx:53` |
| 56 | Checkbox + confirm in their own box; still gated; no route out | MET | `recovery-kit.tsx:61-73` |
| 57 | `<pre>` byte-identical, permanent dark, no theme import; both tests pass | MET **(re-v3)** | `recovery-kit.dom.test.tsx` byte-identical to base (`sha256`), green |

### Onboarding (§3.5 step 25)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 58 | Progress bar replaces the dots, exposes position accessibly, sits at the top; named arrow buttons; none on the last slide; Skip top-right | MET | `onboarding.tsx:45-54`; `screens.css:99` |
| 59 | Slide order/copy/both-mark-seen unchanged; no session, no write | MET | `onboarding-tour.ts` untouched |

### Global / non-regression

| # | Criterion | Verdict | Evidence (re-run mechanically this pass) |
|---|---|---|---|
| 60 | No file under `src/`, `desktop/src/main/**`, `desktop/src/preload/**`, `shared/ipc/`; no `desktop/package.json` change | MET **(re-v3)** | `git diff --stat bfd8ac9~1...HEAD -- src/ desktop/src/main/ desktop/src/preload/ desktop/src/shared/ipc/ desktop/package.json` → **empty**; `git show --stat 63c05d8` lists exactly three files, two of them CSS |
| 61 | `tokens.css` byte-identical; no new custom property anywhere | MET **(re-v3)** | `sha256` = `cb64d6f3…f669ff` at base **and** HEAD; the two new outlines reuse `--color-accent` |
| 62 | Every new string in `en.ts` **and** `es.ts`; parity test passes; nothing hardcoded | MET **(re-v3)** | `63c05d8` adds no key and no string at all; `catalogs.test.ts` byte-identical to base, green |
| 63 | Every icon-only control has a text accessible name; no state signalled by colour alone | MET **(re-v3)** | unchanged by a CSS-only commit, and strictly improved: focus is now a signal on the chips and segmented controls where it had none |
| 64 | `no-network-surface.test.ts` passes — no `xmlns`, no `setInterval`, no `url(scheme)` | MET **(re-v3)** | test byte-identical to base, green; the 24 new CSS lines contain no `url(`, no scheme, no `@import` |
| 65 | `main-window.ts` CSP/navigation/permission handlers unchanged | MET **(re-v3)** | `sha256` = `6c32bf4f…bbaf65` at base **and** HEAD |
| 66 | Shell styles in their own stylesheet; per-screen in `screens.css`; explicit import order | MET **(re-v3)** | the workspace-grid rules landed in `layout.css`, the chip/segmented focus rules in `screens.css`, each beside the rule it complements — correct split, and the cascade depends on that order (`app-main.tsx:3-6`), which is unchanged |
| 67 | No preferences key added; no layout/selection state persisted | MET | `preferences-write.ts` / `app-preferences.ts` absent from the whole range |
| 68 | At the D-4 breakpoint every two-column layout collapses to one column | MET (eyeball) **(re-v3)** | still exactly one `@media (max-width: 900px)` block (`layout.css:174-223`), now also fixing the row-stretch defect (§2.2) |
| 69 | `docs/gui.md` updated in the same commit for navigation, the pack's two views, import selection rules, pinned grouping | MET | all four edits present; `63c05d8` invalidates none of them (no user-visible copy or behaviour changed) |
| 70 | `npm run typecheck && npm run lint && npm run test` pass at repo root **and** in `desktop/` | MET **(re-v3)** | run by this reviewer: root `tsc --noEmit` clean, `biome check` clean over 327 files (1 pre-existing config-migration *info*), **57 files / 303 tests passed**; desktop both `tsc` projects clean, `biome check` clean over 164 files, **64 files / 930 tests passed** — unchanged from pass 2, as a CSS-only commit should be |

**Tally: 70 met, 0 not met.** #45 and #46 flip from NOT MET / markup-only to MET; #48 stayed MET from
pass 2.

---

## 4. §5 / §3 requirements that are not §9 checkboxes

All six raised in earlier passes remain closed: the sidebar no longer scrolls with the content
(`layout.css:11-15`), the empty search result shows both `search.noResults` and a placeholder detail
panel (`search.tsx:103-140` + `search.dom.test.tsx:156-173`), the all-pinned listing renders one list
and no "Other items" heading (`project.tsx:142-147` + DOM case), the tour's progress bar is at the
top, the import rail is internally bounded (D-13's rider), and the `.sort-arrow` transition that broke
§4.2's "no new animation work" is gone. `63c05d8` adds one more, previously unstated but implied by
§3.1 step 2 and §5.9: the shell must lay out correctly *without* the sidebar, which it now does.

---

## 5. Plan adherence

Unchanged across all three passes: implemented slice for slice, every file in `plan.md` §4's repo
structure present and nothing outside it. `63c05d8` adds no file, no module, no component, no catalog
key and no test — a three-rule stylesheet fix, which is the right and minimal shape for the defect it
closes. No deviation was introduced; the three silent deviations pass 1 recorded were closed in
`47eb93a` and remain closed.

---

## 6. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain touched, SQLCipher unkeyed, MCP tools widened) | **No breach.** `63c05d8` is two stylesheets and `review.md` — no TS/TSX file, no main process, no preload, no IPC. `main-window.ts` byte-identical to base (`sha256 6c32bf4f…bbaf65`), CSP and navigation handlers included. Zero files under `src/`, `desktop/src/main/`, `desktop/src/preload/`, `shared/ipc/` across the **whole** range. The 24 new CSS lines are three rules and three comments: no `url(`, no `@import`, no scheme, no `content:` string, nothing that can reach the network or the disk. `tokens.css` byte-identical. Nothing new is persisted; the preferences file still has four keys |
| Tests missing for new behaviour / suite not passing | **No breach.** This commit changes no behaviour — it changes where three boxes are drawn — so the unchanged 930 is the correct outcome, not a gap: there is no new function, no new branch and no new DOM node to test, and jsdom cannot assert layout in the first place (refined.md fact 10). The parts the fix *depends* on are tested: `workspace-chrome.test.ts:83-89` pins `sidebar: false` for `relocate-vault`, `app.shell.test.ts:16-20` pins the single `WorkspaceSidebar` mount. All six tests required to stay unmodified are byte-identical to base, re-verified by `sha256` this pass: `import-entry-points.test.ts`, `diagnostics.no-auto-run.test.ts`, `no-network-surface.test.ts`, `recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`, `catalogs.test.ts`. `app.theme.test.ts` is the one pinned-by-fact-9 test that changed, and the change is purely additive — both original cases byte-unchanged, one case added for `entry-shell.tsx`'s sanctioned static dark. Both suites green by this reviewer: root 303, desktop 930 |
| Advance ritual not evidenced | **No breach.** `refined.md` (Gate R closed 2026-09-15) → `plan.md` with `Approved: Oscar 2026-09-16` on line 3 → `review.md`. Both prior FAIL verdicts were committed (`47eb93a`, `63c05d8`), so the full FAIL → fix → re-review trail is in the history and not merely in the working tree — which is the stronger form of the evidence this gate asks for |
| Naming / clean-architecture / file placement | **No breach.** No file added, moved or renamed by this commit. The whole range adds files only into the renderer's established folders — `components/`, `screens/`, `screens/import/`, `screens/__dom-tests__/`, `state/`, `styles/` — with no bare file at a layer root (`app.tsx`, `app-main.tsx`, `app.shell.test.ts`, `app.theme.test.ts` sit beside their pre-existing siblings, `app.theme.test.ts` having been there before this advance). The new CSS lands in the file whose stated scope covers it: shell grid in `layout.css`, per-screen control states in `screens.css` |

**No hard gate is breached.**

---

## 7. Issues, prioritised

### Critical — blocks the merge

**None.** C1 from pass 2 is closed and verified in §2.1.

### Warning — real defect

**None open.** W1 from pass 2 (`align-content` at the breakpoint) is closed and verified in §2.2.

### Suggestion — not blocking, carry forward

**S1. `.workspace:not(:has(.sidebar))` infers intent from a missing child.** It is correct today —
`.sidebar` has exactly one emitter, and the CSS comment (`layout.css:17-20`) names the coupling — but
the rule silently stops applying the day any element inside `.workspace-content` is given a `sidebar`
class, and nothing in the suite would notice. The explicit form is one line in each file and reads as
what it means: `<div className={chrome.sidebar ? "workspace" : "workspace full-focus"}>`
(`app.tsx:325`) with `.workspace.full-focus { grid-template-columns: minmax(0, 1fr) }`. It would also
become assertable by the existing source-scan idiom (`app.shell.test.ts`). Not blocking: the current
rule works, and the comment mitigates.

**S2. The select/deselect label ternary is duplicated.**
`screens/import/conversation-table.tsx:45-49` and `screens/import/import-screen.tsx:282-286` each
compute `headerState === "all" ? "import.deselectAllVisible" : "import.selectAllVisible"`. They must
not drift — that is exactly the lie D-P8 was written to prevent. `import-screen.tsx` already owns
`headerState`; deriving the key once there and passing it down makes the invariant structural instead
of a convention. (Carried from pass 2, unaddressed.)

**S3. `className="sidebar-settings"` still matches no rule.** `workspace-sidebar.tsx:66` sets it and
`grep -rn sidebar-settings desktop/src/renderer/styles/` returns nothing — `.sidebar button`
(`layout.css:43-53`) does all the work. Either drop the attribute or add the rule it implies; a class
that exists only as a future hook reads as a missing stylesheet entry to the next person. (Carried
from pass 2, unaddressed.)

**S4. The diagnostics `<caption>` duplicates the visible `<h2>` verbatim.** `diagnostics.tsx:142-143`
renders the heading and then `<caption className="sr-only">` with the same string, so a screen-reader
user hears "System" twice. `<table aria-labelledby={headingId}>` pointing at the `<h2>` gives the same
association with one announcement. (Carried from pass 2, unaddressed.)

---

## 8. What was re-verified mechanically in this pass

Not taken from the commit message:

- `git show --stat 63c05d8` → 3 files, 0 TS/TSX.
- `git diff --stat bfd8ac9~1...HEAD -- src/ desktop/src/main/ desktop/src/preload/ desktop/src/shared/ipc/ desktop/package.json` → empty.
- `sha256` of `tokens.css` and `main-window.ts` at base and at HEAD → identical.
- `sha256` of the six pinned tests at base and at HEAD → identical; `app.theme.test.ts`'s diff read in
  full and confirmed additive.
- `grep -rn ':has(' desktop/src/renderer/styles/` → five rules, all accounted for.
- `grep -rn 'className="[^"]*sidebar' desktop/src/renderer --include=*.tsx` → three hits, one token.
- Root: `tsc --noEmit` clean, `biome check` 327 files clean, **57 files / 303 tests passed**.
- Desktop: both `tsc` projects clean, `biome check` 164 files clean, **64 files / 930 tests passed**.

All 70 acceptance criteria met, no hard gate breached. **PASS.**
