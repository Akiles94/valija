# GUI-LAYOUT — Review (re-review after `47eb93a`)

Verdict: FAIL

**Reviewed:** `feat/desktop-GUI`, `bfd8ac9~1...HEAD` (`47eb93a`), 22 commits — the 21 reviewed in the
first pass plus one review-fix commit.
**Against:** `advances/GUI-LAYOUT/refined.md` (Gate R closed 2026-09-15) and
`advances/GUI-LAYOUT/plan.md` (`Approved: Oscar 2026-09-16`, line 3).
**Prior verdict:** FAIL on acceptance criterion #48 (Settings axis), plus W1–W5 and S1–S7.

**Verdict in one line:** `47eb93a` genuinely fixes **all thirteen** items the first review raised —
C1, W1–W5 and S1–S7 are each real, correct, and where behaviour changed, covered by a test (930
desktop tests, +2, both suites green). But re-reviewing the shell CSS in the course of checking W1
surfaced a **defect the first pass missed and this commit does not touch**: `.workspace` is an
unconditional `220px | 1fr` grid, and the relocation wizard is the one screen inside it that renders
**without** a sidebar — so it auto-places into the empty 220px sidebar track and the whole wizard is
squeezed into ~172px of usable width, with the 1fr column blank beside it. That is a regression this
advance introduced (`.workspace` carried no CSS before it) against §5.9's "a full-focus centred
flow", and it fails acceptance criterion #45. It is a one-line CSS fix.

---

## 1. Size

| Slice | Files | Lines |
|---|---|---|
| Whole range (`--stat`) | 54 | **+6 308 / −762** |
| — `advances/GUI-LAYOUT/*.md` (idea/refined/plan/review) | 4 | +3 032 |
| — `desktop/src/**` (prod + tests) | 49 | +3 234 / −752 |
| `47eb93a` alone, code+tests | 12 | **+134 / −58** |
| — of which tests (3 `__dom-tests__` files) | 3 | +32 / −2 |
| — of which production TSX/CSS | 9 | +102 / −56 |

The fix commit is proportionate: no file grew materially, no new module appeared, and the only test
edits are two added cases plus one assertion whose accessible name legitimately changed (S2).

---

## 2. Acceptance criteria (refined.md §9)

Legend: **MET** / **NOT MET** / **UNCLEAR** (counts as not met). Rows marked **(re-v)** were
re-verified against `47eb93a`'s diff in this pass; the rest are carried from the first pass, where
each was verified mechanically, and are untouched by this commit.

### Shell and navigation (§3.1)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `nav-bar.tsx` gone; `base.css` `.nav-bar*` rules gone | MET | `app.shell.test.ts:20-33` |
| 2 | Sidebar on every unlocked screen, today's order, spacer, Lock now, Settings | MET **(re-v)** | `workspace-sidebar.tsx:44-70`; only change is the `.settings-gear` → `.sidebar-settings` class rename (S5) |
| 3 | Icon **and** label per entry; icon `aria-hidden` | MET | `workspace-sidebar.tsx:57-58`; `icons.tsx` |
| 4 | Active entry `aria-current="page"` + non-colour-only; drill-downs have none | MET | `layout.css:47-53` (accent + inset bar + weight 600) |
| 5 | The four §5.0 trails; non-final segments go where Back went | MET **(re-v)** | `workspace-chrome.ts:29-93`; `breadcrumb.tsx:18-39` — the S1 key change is `key={label}` → `key={index}`, no trail/target change |
| 6 | Trail from a pure, unit-tested mapping | MET | `workspace-chrome.test.ts` |
| 7 | Lock now / Settings behaviour unchanged | MET | `app.tsx:325-333` |

### Dashboard (§3.2 step 5)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 8 | No text input of any kind | MET | no `input`/`<form>` in `dashboard.tsx` |
| 9 | Card grid, 2 cols at ~1120px, icon + name + count + last activity | MET | `screens.css:17-23` |
| 10 | `const header` block intact, 4 branches, no `setView`; test unmodified | MET | `import-entry-points.test.ts` byte-identical (verified by `sha256` this pass) |
| 11 | Empty branch keeps `connectATool` + `importHistory` | MET | untouched |

### Project detail (§3.2 steps 6–7)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 12 | `<select>` gone; wrapping chip row, single-select + keyboard nav | MET **(re-v)** | `project.tsx:91-125` unchanged; S6 hid the native radio (`screens.css:470-476`) — radio semantics, tab order and arrow-key behaviour are preserved because the input is `opacity: 0`, not `display: none`. See **S1** for the focus-ring consequence |
| 13 | A chip issues the same `bridge.content.show` call | MET | `useEffect` deps and body untouched |
| 14 | Pinned grouped above the rest by a pure, tested stable partition | MET **(re-v)** | `state/pinned-partition.ts` unchanged; `project.tsx:85` merely lifts the call out of the JSX IIFE (S3) |
| 15 | `ItemCard` unchanged; `project.dom.test.tsx` passes | MET **(re-v)** | `item-card.tsx` still absent from the diff; the DOM test gained one additive case, no existing case edited |

### Search (§3.2 steps 8–9)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 16 | Master-detail split; left column project · type · date · truncated preview | MET **(re-v)** | `search.tsx:103-140`; truncation still CSS-only (`screens.css:167-171`) |
| 17 | First hit selected on completion; re-run/scope change re-selects | MET | `search-selection.ts:10-12`; DOM cases 1 and 3 |
| 18 | Right panel shows full content + Open project routing | MET **(re-v)** | `search.tsx:125-138` — the panel moved out of the non-empty branch but its contents are identical |
| 19 | Call shape / hit order / empty-query behaviour unchanged, no new IPC | MET | only the JSX nesting changed in `47eb93a`; no handler touched |
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
| 28 | Table with checkbox/title/date/chunks, compact rows | MET | `conversation-table.tsx:39-89`; `screens.css:657-660` |
| 29 | Sticky header, bounded scroll container | MET | `screens.css:646-651`, `662-667` |
| 30 | **Both** affordances: header checkbox **and** a "Select all" text link | MET **(re-v)** | `conversation-table.tsx:43-58` + `import-screen.tsx:277-286`; both still present, both now share the same swapped label (S2) |
| 31 | Both operate on visible rows only; hidden rows keep state | MET | `import-selection.ts:62-77`; 7 unit cases + DOM case 14 |
| 32 | Real `indeterminate` for a partial visible set | MET **(re-v)** | `conversation-table.tsx:51-53` ref callback untouched by the label change; DOM case 15 |
| 33 | Persistent rail with file, format, "N of M selected" (M = full listing), picker, Preview, Import | MET **(re-v)** | `import-screen.tsx:303-358`; `screens.css:639-645` now bounds it (W5) without moving anything |
| 34 | Exactly one `aria-live="polite"` region, `aria-busy`, completion `scrollIntoView` | MET | `import-status.tsx:32`; DOM case 18 |
| 35 | Every IMPORT-FEEDBACK guard survives; `import.dom.test.tsx` passes | MET **(re-v)** | the only edit in `47eb93a` is one query's accessible name (`"Select all"` → `"Deselect all"`) with an explaining comment — the assertion itself (`toBeDisabled()`) is unweakened, and it moved because S2 deliberately changed that name |
| 36 | `buildPickSpec` still emits original 1-based indices | MET | untouched; unit test |

### Diagnostics (§3.4 step 18)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 37 | Three labelled sections from a pure, tested grouping | MET | `diagnostic-groups.ts:31-45` |
| 38 | Unknown key → fallback group, rendered only when non-empty | MET | `diagnostic-groups.ts:17-22,42` |
| 39 | Severity dot **and** status word; explanation in detail; `extra` survives | MET | `diagnostics.tsx:40-50` |
| 40 | Toolbar beside the title; both probe notices above the table | MET | `diagnostics.tsx:118-130` |
| 41 | **Zero `useEffect`**; probes only in `handleRunChecks`; test unmodified | MET **(re-v)** | `47eb93a` adds one `<caption>` element (`diagnostics.tsx:143`) and nothing else; `diagnostics.no-auto-run.test.ts` still byte-identical (`sha256` checked) and green |

### Sync & safety (§3.4 step 19)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 42 | Stat cards + wide device card, same single mount-time read | MET | `sync.tsx:100-157` |
| 43 | Conflict/stale banner, **no resolve affordance** | MET | `sync.tsx:97-111` — `<p>`s only |
| 44 | Nothing editable; Move my vault… primary | MET | `sync.tsx:87-96` |

### Relocation wizard (§3.4 step 20)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 45 | No sidebar; **in the entry cluster's visual language**; 3-step indicator from a pure tested mapping, conveyed non-visually | **NOT MET** | The mapping and the indicator are right (`state/relocation-steps.ts`, `relocate-vault.tsx:102-112`, `aria-current="step"`) and `workspace-chrome.ts:93` does return `sidebar: false`. But `app.tsx:325-333` still wraps the screen in `.workspace`, which is unconditionally `grid-template-columns: 220px minmax(0, 1fr)` (`layout.css:11-15`) with **no rule anywhere for the sidebar-less case** (`grep ":has"`/`workspace` over all three stylesheets: nothing). With the sidebar not rendered, `.workspace-content` is the only child and CSS grid auto-places it in **column 1 — the 220px sidebar track** — leaving `.screen.relocate-vault { max-width: 560px; margin: auto }` (`screens.css:420-423`) with a 220px containing block and `.workspace-content > .screen`'s 24px padding, i.e. ~172px of usable width, next to a blank 1fr column. §5.9 asks for "a **full-focus centred** flow using the entry cluster's visual language". See **C1**. |
| 46 | Preflight is one centred card with exactly today's information; every stage/refusal/retry/copy-line unchanged | MET (markup) | `relocate-vault.tsx` content and machine untouched; `.preflight-card` is correct markup — it is only the containing column that is wrong (C1) |
| 47 | `relocate-vault.dom.test.tsx` passes | MET | byte-identical (`sha256` checked), green — and jsdom cannot see C1 |

### Settings (§3.4 step 21)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 48 | **Left mini-tab list** with the four sections and the selected section **on the right**; no fifth tab | **MET (was NOT MET)** **(re-v)** | `screens.css:749-787`: `.screen.settings { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 8px 24px }`, `.screen.settings > h1, .screen.settings > button { grid-column: 1 / -1 }`, `.settings-tabs { flex-direction: column; align-items: stretch }`, and the selected tab's `border-bottom` replaced by `box-shadow: inset 3px 0 0 var(--color-accent)` + `background: var(--color-surface)` + `font-weight: 600`. **The auto-placement does work for `settings.tsx`'s DOM order** (h1 → tablist → exactly one tabpanel → Close): the `1 / -1` h1 takes row 1; the tablist, auto in both axes, cannot fit beside it so it wraps to row 2 col 1; the tabpanel auto-places at row 2 col 2; the Close button's definite column-start of 1 is less than the cursor's column 2, so it increments to row 3 and spans. Exactly one tabpanel is always mounted (`settings.tsx:91,120,145,176` cover all four `SectionId`s), so column 2 is never empty. The 900px collapse is in the existing block (`layout.css:203-210`): one column + `flex-direction: row; flex-wrap: wrap`, and the inset bar keeps the non-colour signal |
| 49 | Segmented controls, same options/update calls; tab semantics + keyboard | MET | `settings.tsx:87-141`; `tab-navigation.ts` + its 51-line test |
| 50 | No bridge, no IPC; locked notice; Help holds only replay | MET | no new import; `onboarding-settings.no-session.test.ts` unmodified |
| 51 | Settings still opens from the locked screen | MET | `locked.tsx:68` untouched |

### Entry cluster (§3.5 steps 22–23)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 52 | One shared left panel, identical copy, both catalogs | MET | `components/entry-shell.tsx`; `app.tsx:231-287` |
| 53 | Dark treatment adds no custom property; split legible in dark | MET | `entry-shell.tsx:16`; `layout.css:120`; `app.theme.test.ts:31-35` |
| 54 | Each screen's content/copy/validation/routing unchanged | MET | none of the four screens is in the diff |

### Recovery kit (§3.5 step 24)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 55 | Once-only banner above the title, new key in both catalogs | MET | `recovery-kit.tsx:53` |
| 56 | Checkbox + confirm in their own box; still gated; no route out | MET | `recovery-kit.tsx:61-73` |
| 57 | `<pre>` byte-identical, permanent dark, no theme import; both tests pass | MET | `recovery-kit.dom.test.tsx` byte-identical (`sha256` checked), green |

### Onboarding (§3.5 step 25)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 58 | Progress bar replaces the dots and exposes its position accessibly; arrow icon buttons named from existing keys; no forward arrow on the last slide; Skip top-right | MET **(re-v)** | `onboarding.tsx:45-54` — the whole `role="progressbar"` block (`aria-valuemin/max/now` + `aria-label`) moved **above** `.onboarding-nav` (W4), and `screens.css:99` is now `margin: 32px auto 20px` so it clears the absolutely-positioned Skip (`screens.css:69-76`) and sits above the slide. Arrows, last-slide rule and Skip unchanged |
| 59 | Slide order/copy/both-mark-seen unchanged; no session, no write | MET | `onboarding-tour.ts` untouched |

### Global / non-regression

| # | Criterion | Verdict | Evidence (all re-run mechanically this pass, not taken from the commit message) |
|---|---|---|---|
| 60 | No file under `src/`, `desktop/src/main/**`, `desktop/src/preload/**`, `shared/ipc/`; no `desktop/package.json` change | MET **(re-v)** | `git diff --stat bfd8ac9~1...HEAD -- src/ desktop/src/main/ desktop/src/preload/ desktop/src/shared/ipc/ desktop/package.json` → **empty**; `git show --stat 47eb93a -- <same>` → **empty** |
| 61 | `tokens.css` byte-identical; no new custom property anywhere | MET **(re-v)** | `sha256(tokens.css)` = `cb64d6f3…f669ff` at base and at HEAD; `grep -nE "^\s*--[a-zA-Z-]+\s*:"` over `base/layout/screens.css` → no match |
| 62 | Every new string in `en.ts` **and** `es.ts`; `catalogs.test.ts` + `Catalog` typecheck pass; nothing hardcoded/concatenated; plural forms | MET **(re-v)** | `47eb93a` adds **no** new key — it only reaches two that already existed (`search.noSelection`, `import.deselectAllVisible`), one of which was the dead copy W2 complained about; `desktop/src/shared/i18n/catalogs/catalogs.test.ts` is byte-identical to base (`sha256 b0816ae0…`) and green |
| 63 | Every icon-only control has a text accessible name; no state signalled by colour alone | MET **(re-v)** | the header checkbox's name now swaps with its action (S2); the selected chip keeps `font-weight: 600` + `border-color` after S6 hid the input; the selected settings tab keeps weight + inset bar after C1 |
| 64 | `no-network-surface.test.ts` passes — no `xmlns`, no `setInterval`, no `url(scheme)` | MET **(re-v)** | test byte-identical (`sha256` checked) and green; `grep -rnE "xmlns\|setInterval\|url\((https?\|data\|file):"` over `desktop/src/renderer` (non-test) → only the two pre-existing prose comments in `project.tsx:60` and `dashboard.tsx:49` |
| 65 | `main-window.ts` CSP/navigation/permission handlers unchanged | MET **(re-v)** | `sha256` identical at base and HEAD: `6c32bf4f…bbaf65` |
| 66 | Shell styles in their own stylesheet; per-screen in `screens.css`; explicit import order | MET | `layout.css` stays shell-level (the C1 defect is *in* that file, not a placement error) |
| 67 | No preferences key added; no layout/selection state persisted | MET | `preferences-write.ts` / `app-preferences.ts` absent from the whole range |
| 68 | At the D-4 breakpoint every two-column layout collapses to one column | MET (eyeball) **(re-v)** | one `@media (max-width: 900px)` block, `layout.css:166-211`, now also covering `.import-rail` (W5) and `.screen.settings` + `.settings-tabs` (C1). Note the irony recorded under **C1**: the relocation wizard is the one screen that renders *correctly* below 900px, because there `.workspace` is a single `1fr` column |
| 69 | `docs/gui.md` updated in the same commit for navigation, the pack's two views, import selection rules, pinned grouping | MET **(re-v)** | all four edits still present; nothing in `47eb93a` invalidates them — `docs/gui.md:291-300` describes Settings' four sections without claiming an axis, and the Search section (`:146-158`) does not describe the empty-result state, so W2/C1 introduced no doc drift |
| 70 | `npm run typecheck && npm run lint && npm run test` pass at repo root **and** in `desktop/` | MET **(re-v)** | run by this reviewer: root `tsc --noEmit` clean, `biome check` clean (1 pre-existing config-migration *info*), **57 files / 303 tests passed**; desktop both `tsc` projects clean, `biome check` clean over 164 files, **64 files / 930 tests passed** — exactly the claimed +2 over the 928 of the first pass |

**Tally: 69 met, 1 not met (#45).** #48 flipped from NOT MET to MET.

---

## 3. §5 / §3 requirements that are not §9 checkboxes — status of the first pass's five

| Requirement | Was | Now | Evidence |
|---|---|---|---|
| §5.0 / §3.1 step 2 — "The sidebar does not scroll with the content", "No page scroll of the sidebar, ever" | NOT MET (W1) | **MET** | `layout.css:11-15` is now `height: 100vh`. With a definite block size, the single implicit row's base size is 0 (`.workspace-content`'s `overflow-y: auto` zeroes its automatic minimum size) and the *maximize tracks* step caps the row at the container's 100vh rather than at the item's max-content height — so `.workspace-content` is stretched to exactly 100vh and its own `overflow-y: auto` finally engages. The sidebar stays. The added comment (`layout.css:8-10`) states the reasoning, which is the right thing to leave behind for a rule whose whole point is invisible |
| §5.3 — empty result set shows `search.noResults` **and** an empty detail panel with a short placeholder | NOT MET (W2) | **MET** | `search.tsx:103-140`: `.search-split` is now rendered unconditionally under `results !== null`, with `search.noResults` occupying the left column when empty and `.hit-detail` (bordered, `screens.css:175-179`) always mounted. `search.noSelection` is no longer dead copy. New DOM case `search.dom.test.tsx:156-173` asserts all three facts (`.search-split` present, no `list` role, `.hit-detail` text equals the placeholder) — and it genuinely could not have passed before, since the old branch never mounted `.hit-detail` |
| §5.2 / D-9 — "*Pinned* … then the rest of the items" | partial (W3) | **MET** | `project.tsx:142-147` guards on `rest.length > 0`; `project.dom.test.tsx:116-124` covers the all-pinned listing and asserts exactly one `ul.item-list` and no "Other items" heading. S3 is folded in: the partition is now a plain `const` above the `return` (`project.tsx:85`) instead of a JSX IIFE, which is what made the missing guard visible |
| §5.13 / §3.5 step 25 — progress bar **at the top** | NOT MET (W4) | **MET** | `onboarding.tsx:45-54` before `.onboarding-nav`; `screens.css:99` `margin: 32px auto 20px` |
| D-13 rider — "the rail allowed to scroll internally if a long failure list overflows" | NOT MET (W5) | **MET** | `screens.css:639-645` `max-height: calc(100vh - 160px)` beside the existing `overflow-y: auto`, with the comment naming D-13; `layout.css:189-191` relaxes it to `none` inside the 900px block where the rail stacks below the table. The magic 160px is arbitrary but bounded, which is what the rider asks for |
| §4.2 — "no animation/transition work beyond what already exists" | deviation (S4) | **MET** | `screens.css:689-691`: the `.sort-arrow` `transition` is gone; the `.asc` rotation (a static transform, not an animation) remains |

---

## 4. Plan adherence

Unchanged from the first pass: followed slice for slice, every file in `plan.md` §4's repo structure
present and nothing outside it. `47eb93a` adds no file, no module and no catalog key — it is a pure
fix pass, which is the right shape for one. Two of the three silent deviations the first review
recorded are now closed by the fixes (slice 13's left bar, slice 5's placeholder); the third
(slice 15's progress-bar position) likewise. No new deviation was introduced.

---

## 5. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain touched, SQLCipher unkeyed, MCP tools widened) | **No breach.** `47eb93a` touches nine renderer files and two stylesheets, nothing else. `main-window.ts` still byte-identical (`sha256 6c32bf4f…bbaf65`), CSP and navigation handlers included. Zero files under `src/`, `desktop/src/main/`, `desktop/src/preload/`, `shared/ipc/` across the whole range. No `dangerouslySetInnerHTML`, `innerHTML`, `DOMParser`, `eval`, `localStorage`, `fetch` or `setInterval` anywhere in the changed renderer. The three renderer changes that touch *content* all route it through the existing safe paths: the search detail panel still renders through `MarkdownContent` (and the existing `<img onerror>` payload case still passes), the diagnostics `<caption>` renders a catalog key, and the header checkbox's label is a catalog key. Nothing new is persisted; the preferences file still has four keys. The recovery kit, the import guards and the Sync banner are untouched by this commit |
| Tests missing for new behaviour / suite not passing | **No breach.** The two behaviour changes in `47eb93a` (W2's always-rendered split, W3's guarded section) each ship a DOM case that fails against the old code; S2's label swap moved one existing assertion's query, with a comment, without weakening it. All six tests required to stay unmodified are **byte-identical** to base, re-verified by `sha256` in this pass: `import-entry-points.test.ts`, `diagnostics.no-auto-run.test.ts`, `no-network-surface.test.ts`, `recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`, `catalogs.test.ts`. Both suites run green by this reviewer: root 303, desktop 930 |
| Advance ritual not evidenced | **No breach.** `refined.md` (Gate R closed 2026-09-15) → `plan.md` with `Approved: Oscar 2026-09-16` on line 3 → `review.md`. `47eb93a` also committed the first review's `review.md`, so the FAIL → fix → re-review trail is in the history rather than only in the working tree |
| Naming / clean-architecture / file placement | **No breach.** No file added or moved. The one rename (`settings-gear` → `sidebar-settings`, S5) improves it: `.settings-gear` now names exactly one thing again, `locked.tsx:68`'s lone gear button, which is what `base.css:96`'s `.settings-gear + h1` and `layout.css:159`'s absolute positioning were written against. `partitionPinnedItems` moving to a `const` keeps pure view logic in `state/` and its call at the component edge (§8). Nothing new lands at a layer root |

**No hard gate is breached.** The FAIL is on acceptance criterion #45 alone.

---

## 6. Issues, prioritised

### Critical — blocks the merge

**C1. The relocation wizard renders inside the 220px sidebar column (§9 Relocation item 1, §5.9).**
`app.tsx:325-333` wraps every workspace view — including `relocate-vault`, the one view for which
`workspaceChrome` returns `sidebar: false` (`state/workspace-chrome.ts:93`) — in:

```css
/* layout.css:11-15 */
.workspace {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: 100vh;
}
```

There is no rule anywhere for the case where the sidebar is absent (`grep -rn "workspace" styles/*.css`
returns only these rules plus `.workspace-content`; `grep -rn ":has" styles/*.css` returns only the two
chip/segmented rules). When `{chrome.sidebar && <WorkspaceSidebar …>}` renders nothing, React emits no
placeholder, so `.workspace-content` is the grid's **only** item and CSS grid's auto-placement puts it
at row 1, **column 1** — the fixed 220px track. `.workspace-content > .screen` then adds 24px of
padding either side (`layout.css:73-77`), leaving the wizard ~172px of usable width, with the `1fr`
column blank to its right. `.screen.relocate-vault { max-width: 560px; margin: auto }`
(`screens.css:420-423`) cannot help: its containing block is 220px.

§5.9 asks for "**No sidebar** — a full-focus centred flow using the entry cluster's visual language",
and §9 item 45 repeats "in the entry cluster's visual language". A 172px strip beside a blank half-
window is neither. This is a regression **introduced by this advance**: before it, `.workspace` carried
no CSS at all (`git show bfd8ac9~1:…/base.css | grep workspace` and the same for `screens.css` both
return nothing), so the wizard rendered full-width and centred at `.screen`'s 720px.

It is invisible to the test suite by construction — jsdom does not lay out, so
`relocate-vault.dom.test.tsx` passes either way — and it is invisible below 900px, where the media
query collapses `.workspace` to a single `1fr` column and the wizard renders correctly. That is the
worst possible combination for catching it by eye.

Why this matters more than a cosmetic squeeze: this is the screen where a user reads a refusal, a
clients-to-repoint list, a lock notice and the shell-aware `VALIJA_HOME` line they are expected to
copy — §7.11's "must not suppress or reword a refusal" is about content, but content laid out at
172px with long unbreakable paths is functionally close to suppressed.

*Proposed fix, one rule (pick either):*

```css
/* layout.css — the relocation wizard is the one workspace view with no sidebar (§5.9). */
.workspace:not(:has(.sidebar)) {
  grid-template-columns: minmax(0, 1fr);
}
```

or, if you would rather not depend on `:has()` for layout (it is already used for the chips, so this
is a style call, not a support one), have `app.tsx` render the sidebar-less view without the
`.workspace` wrapper — `<div className={chrome.sidebar ? "workspace" : "workspace full-focus"}>` with
`.full-focus { grid-template-columns: minmax(0, 1fr) }` — which also reads more honestly than a
selector that infers intent from a missing child. Please eyeball the wizard at ~1120px afterwards;
it is the only way to see it.

### Warning — real defect, worth fixing before merge

**W1. Below 900px the collapsed sidebar strip stretches to a large slice of the viewport on short
screens.** `layout.css:11-15` pins `.workspace` to `height: 100vh`; inside the 900px block
(`layout.css:167-177`) the grid becomes one column and the sidebar becomes a wrapped row, so there are
now **two** implicit `auto` rows in a container with a definite height. After *maximize tracks* freezes
both at their content heights, grid's *stretch auto tracks* step (`align-content: normal`) divides the
remaining free space **equally** between them — so on a short screen (an empty dashboard, Settings,
a fresh Sync panel) the nav strip grows to roughly half the leftover height and draws its
`border-bottom` in the middle of the window. This is not a regression from `47eb93a` — the same stretch
applied under the old `min-height: 100vh`, since grid falls back to a definite min-size for that step —
but W1's fix is the natural moment to close it.
*Proposed fix, one line inside the existing 900px block:*
`.workspace { grid-template-rows: auto minmax(0, 1fr); }` — which also makes the >900px pinning
explicit rather than emergent.

### Suggestion — not blocking

**S1. Hiding the chip's radio (S6's fix) removed its only focus indicator.** `screens.css:470-476` now
gives `.chip input` `opacity: 0`, matching `.segmented input` (`screens.css:801-807`) — the right call
for consistency, and the radio stays in the tab order and in the accessibility tree. But
`grep -rn "focus" styles/` returns **nothing**: there is no `:focus`/`:focus-visible` rule anywhere in
the three stylesheets, so the UA focus ring is painted on a transparent 1×1 box and is invisible. For a
radio group this is mostly masked — arrow keys move focus *and* selection, so the checked style follows
focus — but tabbing into the group, or focusing without changing selection, now shows nothing, where
before S6 the native radio showed a ring. One rule covers both patterns:
`.chip:has(input:focus-visible), .segmented label:has(input:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.
(§4.2 forbids *new tokens*, not an outline built from an existing one.)

**S2. The select/deselect label ternary is now duplicated.** `conversation-table.tsx:45-49` and
`import-screen.tsx:283-285` each compute `headerState === "all" ? deselectAllVisible : selectAllVisible`.
They must not drift — that is exactly the lie D-P8 was written to prevent. `import-screen.tsx` already
owns `headerState`; deriving the key once there and passing it down (`selectAllLabelKey`) makes the
invariant structural instead of a convention.

**S3. `className="sidebar-settings"` now matches no rule.** The rename (S5) is right, but the new class
is styled by nothing — `.sidebar button` (`layout.css:35-45`) does all the work. Either drop the
attribute or add the rule it implies; a class that exists only as a future hook reads as a missing
stylesheet entry to the next person.

**S4. The diagnostics `<caption>` duplicates the visible `<h2>` verbatim.** `diagnostics.tsx:142-143`
renders `<h2>{t(SECTION_LABELS[group.id])}</h2>` immediately followed by
`<caption className="sr-only">{t(SECTION_LABELS[group.id])}</caption>`, so a screen-reader user hears
"System" as a heading and again as the table's name. It is what the first review asked for and it is
better than an unnamed table, but `<table aria-labelledby={headingId}>` pointing at the `<h2>` gives
the same association with one announcement and no duplicated string.

---

## 7. What flips this to PASS

1. **C1** — the relocation wizard laid out full-width and centred, not inside the 220px sidebar track.
   One CSS rule, or one conditional class in `app.tsx`. This is the only unmet acceptance criterion
   (#45), and it needs an eyeball at ~1120px because no test in this repo can see it.

That is the whole list. **W1** is a genuine defect and cheap enough that it should ride along, but it
does not breach a stated criterion, and S1–S4 are suggestions. Everything the first review raised —
C1, W1–W5, S1–S7 — is genuinely fixed, the two claimed new tests exist and are real, both suites are
green at 303 and 930, and the entire non-regression block (no `src/`, no `main/`, no `preload/`, no
`shared/ipc/`, no `desktop/package.json`, byte-identical `tokens.css` and `main-window.ts`, six
byte-identical pinned tests) was re-verified mechanically in this pass and holds.
