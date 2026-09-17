# GUI-LAYOUT — Review

Verdict: FAIL

**Reviewed:** `feat/desktop-GUI`, `bfd8ac9~1...HEAD` (`42931f2`), 21 commits — 4 doc-only (idea /
refined / Gate R / plan / Gate P) + 16 implementation+docs commits, one per slice 1–16.
**Against:** `advances/GUI-LAYOUT/refined.md` (Gate R closed 2026-09-15) and
`advances/GUI-LAYOUT/plan.md` (`Approved: Oscar 2026-09-16`, line 3).

**Verdict in one line:** the advance is overwhelmingly correct — the two riskiest things in it
(Import's select-all semantics and D-9's pinned partition) are right, every hard gate holds, and both
suites are genuinely green — but **one §9 acceptance criterion is not met**: Settings ships a
horizontal tab strip across the top, not the "left mini-tab list with the selected section's content
on the right" that §3.4 step 21, §5.10 and §9 all name. Four further §5 requirements are missed or
implemented as unreachable code. None of it is a security or behaviour regression; all of it is
fixable in a small diff.

---

## 1. Size

| Slice of the diff | Lines |
|---|---|
| Total range (`--stat`) | 53 files, **+5 829 / −763** |
| — `advances/GUI-LAYOUT/{idea,refined,plan}.md` | +2 628 |
| — Tests (new + extended) | **+895 / −8** |
| — Production TSX/TS/CSS/catalogs/`docs/gui.md` | **+2 306 / −755** |

Against the plan's estimate of "~2,300 production lines + ~850 test lines" this is accurate to within
a few percent. No file is oversized: the largest new production file is `styles/screens.css`
(+496 net, one commented section per screen, per D-17) and the largest new TSX is
`components/icons.tsx` (168 lines of eleven 6–12-line SVG components).

---

## 2. Acceptance criteria (refined.md §9)

Legend: **MET** / **NOT MET** / **UNCLEAR** (counts as not met).

### Shell and navigation (§3.1)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `nav-bar.tsx` gone; `base.css` `.nav-bar*` rules gone with it | MET | `components/nav-bar.tsx` deleted (−55); `styles/base.css` −19 (the 3 rules); `app.shell.test.ts:20-33` asserts all four facts |
| 2 | Sidebar on every unlocked screen: brand, 4 destinations in today's order, spacer, Lock now, Settings | MET | `components/workspace-sidebar.tsx:44-70`; order from `state/workspace-nav.ts` `NAV_DESTINATIONS`; `app.tsx:325-331` mounts it only when `chrome.sidebar` |
| 3 | Each entry: icon **and** existing label; icon `aria-hidden` | MET | `workspace-sidebar.tsx:57-58` (`NAV_ICONS` + `t(NAV_LABELS[…])`); every icon in `components/icons.tsx` carries `aria-hidden="true"` and no `xmlns` |
| 4 | Active entry has `aria-current="page"` + non-colour-only treatment; drill-downs have no active entry | MET | `workspace-sidebar.tsx:53-54`; `styles/layout.css:45-50` (accent **+** `inset 3px 0 0` bar **+** `font-weight: 600`); `state/workspace-chrome.ts:36-66` returns `active: null` for all five drill-downs |
| 5 | The four breadcrumb trails of §5.0; non-final segments go where the old Back buttons went | MET | `workspace-chrome.ts:18-66` (project → dashboard; pack → that project); `components/breadcrumb.tsx:29-35` |
| 6 | Trail from a pure, unit-tested mapping over `WorkspaceView` | MET | `state/workspace-chrome.ts` (switch with no `default`); `workspace-chrome.test.ts` (116 lines, one case per variant + the final-segment/`target` invariant loop) |
| 7 | Lock now still locks/resets/routes; Settings opens the same overlay | MET | `app.tsx:325-331` passes the unchanged `onLock`/`onOpenSettings`; `overlay-nav.ts` untouched |

### Dashboard (§3.2 step 5)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 8 | **No text input of any kind** | MET | `grep -n "input\|<form" screens/dashboard.tsx` → no match |
| 9 | Card grid, 2 columns at ~1120px, icon + name + count + last-activity | MET | `screens.css:17-23` `repeat(auto-fill, minmax(320px, 1fr))`; content width ≈ 1120 − 220 − 48 = 852 → 2 cols (`320×2+16=656` fits, `320×3+32=992` does not); `dashboard.tsx:121` `<ProjectIcon />` |
| 10 | `const header` block intact, four branches, no `setView`/`workspace-nav`; `import-entry-points.test.ts` unmodified | MET | `dashboard.tsx` diff is **+2 lines only** (an import and the icon); `import-entry-points.test.ts` byte-unchanged and green |
| 11 | Empty branch still offers `connectATool` + `importHistory` | MET | untouched in the diff |

### Project detail (§3.2 steps 6–7)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 12 | `<select>` gone; wrapping chip row of *All types* + `ITEM_TYPES` + *Imported*, single-select + keyboard nav | MET | `project.tsx:84-121` `<fieldset className="chip-row">` + `<legend className="sr-only">` + native radios (D-11 Option 2); `screens.css:452-459` wraps, no scroll, no overflow menu |
| 13 | A chip issues the same `bridge.content.show` call | MET | the `useEffect`, its `[project, typeFilter]` deps and the call body are untouched in the diff |
| 14 | Pinned grouped above the rest, by a pure, tested **stable partition** | MET | `state/pinned-partition.ts:7-16` — a single forward pass pushing into two arrays, provably order-preserving, **not** a sort; `pinned-partition.test.ts` asserts arrival order in both groups for the mixed case |
| 15 | `ItemCard` unchanged; `project.dom.test.tsx` passes | MET | `item-card.tsx` not in the diff; the DOM test's only change is the 1-line `onBack` removal with the required comment |

### Search (§3.2 steps 8–9)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 16 | Master-detail split; left column project · type · date · one-line truncated preview | MET | `search.tsx:104-121`; `screens.css:167-171` truncates by CSS (`nowrap`/`ellipsis`), never by slicing the string (§7.5) |
| 17 | First hit selected on completion; re-run / scope change re-selects the first of the new set | MET | `search.tsx:51,63` `setSelectedId(null)`; `state/search-selection.ts:10-12`; `search.dom.test.tsx` cases 1 and 3 |
| 18 | Right panel shows full content + Open project routing | MET | `search.tsx:127-133`; `app.tsx:346-349` wires `onOpenProject`; DOM case 4 |
| 19 | Call shape / hit order / empty-query behaviour unchanged, no new IPC | MET | only `setSelectedId(null)` was added to the two early-return paths |
| 20 | Selecting a hit performs no IPC and no re-query | MET | `search.dom.test.tsx:100-114` asserts `search` called exactly once across a selection change |

### Context pack (§3.2 steps 10–11)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 21 | Rendered by default, visible toggle to the literal `<pre>` | MET | `pack-preview.tsx:26,91-96`; `aria-pressed` carries the state non-visually |
| 22 | **DOM test proves Copy sends the exact original markdown while the rendered view shows**, and the raw view's text equals it | MET | `pack-preview.dom.test.tsx:73-99` — three cases, `toHaveBeenCalledWith({ text: MARKDOWN })` and `pre.pack-text.textContent === MARKDOWN` |
| 23 | Export still `bridge.content.export({project, format})`; select + success line unchanged | MET | `handleCopy`/`handleExport` are **not touched at all** in the diff; DOM case 4 |
| 24 | One toolbar; the amended notice is accurate in both views and in both catalogs | MET | `screens.css:113`+ `.pack-toolbar`; `en.ts`/`es.ts` `pack.notTranslatedNotice` amended exactly to D-P6's proposed sentences |

### Connect tools (§3.2 step 12)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 25 | Card grid; three steps permanently visible in a rail, same copy, no expand/collapse | MET | `connect-tools.tsx:110-140`; `stepsOpen` and the whole `.disclosure` are gone (the advance's one sanctioned state removal); `screens.css:251-257` auto-fill grid |
| 26 | Node/npm warning in the rail under the same condition, never disables Connect | MET | `connect-tools.tsx:133-141` still gated on `nodeWarningNeeded`; the Connect button's `disabled` is still only `connecting === entry.client` |
| 27 | Card states unchanged (name, connected/not, "Points at", connecting-disabled, both success variants, `configUnreadable` snippet + copy) | MET | the JSX moved wholesale; the only content change is the added per-state class (`client-status connected` / `not-connected`), which is D-21c's own seam |

### Import (§3.3 — the explicitly requested behaviour)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 28 | Table with checkbox / title / date / estimated-chunks, visibly compact rows | MET | `screens/import/conversation-table.tsx:39-89`; `screens.css:657-660` `padding: 2px 6px` (denser than the old 4/6px), `font-size: 0.9rem` |
| 29 | Header row stays visible while the body scrolls, inside a bounded container | MET | `screens.css:646-651` `max-height: 320px; overflow-y: auto` (IMPORT-FEEDBACK D-6 carried over verbatim) + `662-667` `position: sticky; top: 0` on `thead th` |
| 30 | **Both** affordances: header checkbox **and** a distinct "Select all" text link beside the filter | MET | `conversation-table.tsx:43-52`; `import-screen.tsx:277-286` |
| 31 | Both operate on **visible rows only**; hidden rows keep their state | MET | `state/import-selection.ts:63-77` is a true union/difference (`next.add`/`next.delete` over `visible` only, `allVisibleChecked` guarded by `visible.length > 0` so an empty visible set is a no-op); proven by 7 unit cases **and** `import.dom.test.tsx` case 14 (filter → select all → clear filter → hidden row still checked) |
| 32 | Real `indeterminate` when some but not all visible rows are checked | MET | `conversation-table.tsx:48-50` ref callback (no `useEffect` added); `import.dom.test.tsx` case 15 asserts `headerCheckbox.indeterminate === true` |
| 33 | Persistent rail with file, format, "N of M selected" (M = full listing), picker (+ new-project field and slug hint), Preview, Import | MET | `import-screen.tsx:303-358`; `t("import.selectedCount", { count: checked.size, total: listing.length })` — **total is the full listing**, proven by DOM case 16 under an active filter |
| 34 | Exactly one `aria-live="polite"` region, with `aria-busy` and the completion `scrollIntoView` | MET | `screens/import/import-status.tsx:32` (a verbatim move); mounted unconditionally at `import-screen.tsx:331`; DOM case 18 counts exactly one at all three stages; the `scrollIntoView` effect is byte-identical |
| 35 | Single-flight, per-run reset, `waitForNextPaint`, "may stop responding", disabled-while-working, format-override, sort toggle, summaries, failures, excluded-from-packs notice; `import.dom.test.tsx` passes | MET | a line-by-line `diff` of the old `import.tsx` against `import/import-screen.tsx` shows **no handler, guard, ref or effect changed** — only the import paths, the `detectedFormat` display state, and the JSX rearrangement; the 14 pre-existing DOM cases are untouched and green; DOM case 17 pins the new controls into the disabled set |
| 36 | `buildPickSpec` still emits original 1-based indices; selection survives sorting and filtering | MET | `buildPickSpec` untouched; `import-selection.test.ts` has an explicit post-toggle `buildPickSpec` case |

### Diagnostics (§3.4 step 18)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 37 | Table in three labelled sections in the declared order, from a pure unit-tested grouping | MET | `state/diagnostic-groups.ts:31-45`; `diagnostic-groups.test.ts` (64 lines) |
| 38 | Unknown key lands in a fallback group that renders only when non-empty | MET | `diagnostic-groups.ts:17-22,42` (`GROUP_ORDER.filter(length > 0)`); test asserts both halves |
| 39 | Severity dot **and** the status word; explanation folds into the detail column; `extra` survives | MET | `diagnostics.tsx:40-50` |
| 40 | Run checks + Copy report in a toolbar beside the title; both probe notices above the table, visible before any run | MET | `diagnostics.tsx:118-130` then the two `.explainer` paragraphs |
| 41 | **Zero `useEffect`**; both probes only inside `handleRunChecks`; `diagnostics.no-auto-run.test.ts` unmodified | MET | no `useEffect` added (grouping computed inline at `diagnostics.tsx:113-116`); the test file is byte-unchanged and green |

### Sync & safety (§3.4 step 19)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 42 | Stat cards + a wide device-state card, same values, same single mount-time read, no polling | MET | `sync.tsx:100-157`; the `Promise.all` read and `SyncData` shape are untouched |
| 43 | Conflict/stale warnings as a banner with existing counts and guidance, **no resolve affordance** | MET | `sync.tsx:97-111` — only `<p>`s inside `.sync-banner`; no button, no handler (D-I holds) |
| 44 | Nothing editable; Move my vault… primary, Check my setup beside it | MET | `sync.tsx:87-96`; no `<input>` on the screen |

### Relocation wizard (§3.4 step 20)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 45 | No sidebar; 3-step indicator from a pure unit-tested mapping; current step conveyed non-visually | MET | `workspace-chrome.ts:68-69` returns `sidebar: false`; `state/relocation-steps.ts` + `relocation-steps.test.ts`; `relocate-vault.tsx:102-112` `aria-current="step"` |
| 46 | Preflight is one centred card with exactly today's information; every stage/refusal/retry/copy-line unchanged | MET | the only edits are `<div className="preflight">` → `"preflight-card"` and the added `<ol>`; the machine is untouched |
| 47 | `relocate-vault.dom.test.tsx` passes | MET | byte-unchanged, green |

### Settings (§3.4 step 21)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 48 | **Left mini-tab list** with the four sections and the selected section's content **on the right**; no fifth tab | **NOT MET** | `styles/screens.css:745-764`: `.settings-tabs { display: flex; gap: 4px; border-bottom: 1px solid …; margin-bottom: 20px }` and `.settings-tabs [aria-selected="true"] { border-bottom: 2px solid … }` — a **horizontal strip across the top**, with the `role="tabpanel"` in normal flow *below* it (`settings.tsx:64-183`). `.screen.settings` is a single 640px column with no two-column rule anywhere. See **C1**. (The four-sections / no-fifth-tab half of the criterion *is* met: `settings.tsx:12-17` `SECTIONS`.) |
| 49 | Segmented controls, same three options and update calls; correct tab semantics and keyboard behaviour | MET | `settings.tsx:87-141` (same radios, same `onUpdatePreferences` payloads); `role="tablist"`/`tab`/`tabpanel`, roving `tabIndex`, `state/tab-navigation.ts` + 51-line test for arrows/Home/End/wrap/no-op |
| 50 | No bridge, no IPC; locked-state notice replaces the two buttons; Help holds only the replay button | MET | no new import in `settings.tsx`; `onboarding-settings.no-session.test.ts` unmodified and green |
| 51 | Settings still opens from the locked screen | MET | `locked.tsx` untouched; `app.tsx` still passes `onOpenSettings` into it |

### Entry cluster (§3.5 steps 22–23)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 52 | All four screens share one left-panel component; its copy is identical and comes from both catalogs | MET | `components/entry-shell.tsx`; `app.tsx:231-287` wraps `no-vault`, `creating`, `locked`, `upgrade-required`; `entry.*` in `en.ts` **and** `es.ts` |
| 53 | Dark treatment introduces **no new custom property**; the split stays legible in the dark theme | MET | `entry-shell.tsx:16` `data-theme="dark"` (D-20 Option 1); `layout.css:117` `border-right: 1px solid var(--color-border)` (D-20's rider); `app.theme.test.ts:31-35` pins both halves |
| 54 | Each screen's content, copy, validation and routing unchanged; locked keeps its gear and fork banner | MET | none of `no-vault.tsx` / `create-vault.tsx` / `locked.tsx` / `migration-confirm.tsx` appears in the diff |

### Recovery kit (§3.5 step 24)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 55 | Once-only banner above the title, from a new key in both catalogs | MET | `recovery-kit.tsx:53`; `recoveryKit.shownOnceBanner` in both |
| 56 | Checkbox + confirm in their own bordered box; confirm still disabled until checked; no route out | MET | `recovery-kit.tsx:61-73` — markup added *around* the gate, a plain `<p>` banner with no dismiss control, so the "exactly two buttons before acknowledgement" assertion still holds |
| 57 | `<pre>` byte-identical and monospace; still hardcodes `data-theme="dark"`, never imports the theme context; `recovery-kit.dom.test.tsx` and `app.theme.test.ts` pass | MET | `<pre className="kit-text">` untouched; both tests green, the kit test byte-unchanged |

### Onboarding (§3.5 step 25)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 58 | Progress bar replaces the dots and exposes its position accessibly; arrow icon buttons with names from existing keys; no forward arrow on the last slide; Skip top-right on every slide | MET | `onboarding.tsx:37-38,66-88`; `role="progressbar"` with `aria-valuemin/max/now` + `aria-label` from the new `onboarding.progressLabel`; `aria-label={t("common.back")}`/`{t("common.next")}` on the icon buttons; `screens.css:72-79` positions Skip top-right. (§5.13 asks for the bar **at the top** — see **W4**.) |
| 59 | Slide order, copy and the both-mark-seen rule unchanged; the tour opens no session and writes nothing | MET | `onboarding-tour.ts` untouched; both Skip and Get started still call `onDone` |

### Global / non-regression

| # | Criterion | Verdict | Evidence (all re-verified mechanically, not taken from a commit message) |
|---|---|---|---|
| 60 | No file under `src/`, `desktop/src/main/**`, `desktop/src/preload/**`, `shared/ipc/messages.ts`; no `desktop/package.json` dependency change | MET | `git diff --stat bfd8ac9~1...HEAD -- src/ desktop/src/main/ desktop/src/preload/ desktop/src/shared/ipc/ desktop/package.json` → **empty** |
| 61 | `tokens.css` byte-identical; no new custom property declared anywhere | MET | `sha256(tokens.css)` identical before/after (`cb64d6f3…f669ff`); `grep -nE "^\s*--[a-zA-Z-]+\s*:"` over `base/layout/screens.css` → **no match** |
| 62 | Every new string in `en.ts` **and** `es.ts`; `catalogs.test.ts` + the `Catalog` typecheck pass; nothing hardcoded or concatenated; counts use plural forms | MET | the two catalog diffs are key-for-key symmetric (33 added, 1 amended, `connect.stepsSummary` deleted from both per D-P7); `import.selectedCount` is a `PluralForm`; `catalogs.test.ts` unmodified and green |
| 63 | Every icon-only control has a text accessible name; no state signalled by colour alone | MET | `aria-label` on the onboarding arrows and the header checkbox; the sort control is a real `<button>` with the "Date" text; diagnostics dots keep the status **word**; `aria-current` (nav, hit row, relocation step), `aria-pressed` (pack toggle), `aria-sort` (date column), real `indeterminate`; every selected-state CSS rule adds weight/border/inset bar, verified at `layout.css:45-50` and `screens.css:128-133,163-166,432-435,470-475,760-763,788-793` |
| 64 | `no-network-surface.test.ts` passes — no `xmlns`, no `setInterval`, no `url(scheme)` | MET | test file byte-unchanged and green; `icons.tsx` carries no `xmlns`; `grep "url("` over the three stylesheets matches only two prose comments |
| 65 | `main-window.ts`'s CSP, navigation and permission handlers unchanged | MET | `sha256` identical before/after (`6c32bf4f…bbaf65`) |
| 66 | Shell styles in their own stylesheet; per-screen styles in `screens.css`; explicit import order | MET | `styles/layout.css` is strictly shell-level; `app-main.tsx` imports it between `base.css` and `screens.css` |
| 67 | No preferences key added; no layout/selection state persisted | MET | `preferences-write.ts`, `app-preferences.ts` and the four-key file are absent from the diff; every new piece of state is a `useState` |
| 68 | At the D-4 breakpoint every two-column layout collapses to one column | MET (eyeball) | exactly one `@media (max-width: 900px)` at `layout.css:163-195`, covering `.workspace`, `.sidebar`, `.search-split`, `.connect-body`, `.import-body`, `.entry-shell`; `.project-cards` and `.stat-cards` are `auto-fill` and collapse on their own |
| 69 | `docs/gui.md` updated in the same commit for navigation, the pack's two views, import selection rules, and the pinned-grouping divergence | MET | all four edits present — new `## Getting around`; "Either view is a display choice only"; the select-all paragraph; and an explicit "**One deliberate divergence from the CLI, worth stating plainly**" paragraph naming `valija show` |
| 70 | `npm run typecheck && npm run lint && npm run test` pass at repo root **and** in `desktop/` | MET | run by this reviewer: root **exit 0** — 57 files / **303 tests** passed, `biome check` clean (1 pre-existing config-migration *info*); desktop **exit 0** — 64 files / **928 tests** passed, both `tsc` projects clean |

**Tally: 69 met, 1 not met (#48).**

---

## 3. Requirements in §5 / §3 that are not §9 checkboxes but are still spec

| Requirement | Verdict | Evidence |
|---|---|---|
| §5.0 / §3.1 step 2 — "The sidebar does not scroll with the content" / "No page scroll of the sidebar, ever" | **NOT MET** | see **W1** |
| §5.3 — "an empty result set shows the existing `search.noResults` copy **and an empty detail panel with a short placeholder**" | **NOT MET** | see **W2** |
| §5.2 / D-9 — "a *Pinned* section label with the pinned items under it, **then the rest of the items**" | partially | see **W3** (empty "Other items" section when everything is pinned) |
| §5.13 / §3.5 step 25 — "A thin progress bar **at the top** replaces the dots" | **NOT MET** | see **W4** |
| D-13 rider — "the rail allowed to scroll internally if a long failure list overflows" | **NOT MET** | see **W5** |
| §4.2 — "no animation/transition work beyond what already exists" | deviation | see **S4** |

---

## 4. Plan adherence

Followed, slice for slice. Every file in `plan.md` §4 "Repo structure after execution" exists exactly
as drawn, and nothing outside it changed. The riskiest slice was executed in the prescribed
10a → 10b → 10c order: the pure policy landed first with its unit tests, then the folder move
(verified here by a line-by-line `diff` of the old `screens/import.tsx` against
`screens/import/import-screen.tsx` — no handler, guard, ref, effect or catalog call differs), then
the new UI. All ten Gate-P decisions were executed as their stated defaults, including the two that
could have been fudged: D-P7 (`connect.stepsSummary` genuinely deleted from **both** catalogs rather
than left as dead copy) and D-P10 (`main-window.ts` untouched — `minWidth` not taken).

Deviations from the plan, all silent:

- **Slice 13** — the plan says `.settings-tabs [aria-selected="true"]` gets "accent **+** left bar",
  i.e. a vertical left list; the implementation shipped a top strip with a bottom bar. This is
  **C1**, and it is a deviation from the *spec*, not just the plan.
- **Slice 5** — the plan says "Empty result set: existing `search.noResults` copy +
  `search.noSelection` placeholder in the detail panel"; the implementation renders the copy
  *instead of* the split, leaving the placeholder unreachable (**W2**).
- **Slice 15** — the plan's progress bar is described in §5.13 as being at the top; it shipped last
  in the DOM, below the slide (**W4**).

None of these is justified anywhere in the diff or the docs.

---

## 5. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain touched, SQLCipher unkeyed, MCP tools widened) | **No breach.** Zero files under `src/`, `desktop/src/main/`, `desktop/src/preload/`, `shared/ipc/`. `main-window.ts` byte-identical (CSP, `setWindowOpenHandler`, navigation guard). No `dangerouslySetInnerHTML`, `innerHTML`, `DOMParser`, `eval`, `new Function`, `localStorage`, `fetch`, `setInterval` anywhere in the changed renderer (the only two `setInterval` hits are pre-existing prose comments). No new element renders a key, passphrase or derived value; the recovery kit's once-only read, permanent dark and acknowledgement gate are intact and still pinned by an unmodified DOM test. Untrusted content (search hits, pack markdown) reaches the DOM only through `MarkdownContent`, and both new DOM tests include an `<img onerror>` payload case. Nothing new is persisted — the four-key preferences file is untouched. |
| Tests missing for new behaviour / suite not passing | **No breach.** 6 new pure modules each ship a unit test; the three DOM properties this advance invents (pack byte-identity, search master-detail, import select-all-over-visible) each ship a DOM test; `import.dom.test.tsx` gained 5 cases with the 14 existing ones untouched. Both suites verified green by this reviewer (303 + 928). The six tests required to survive unmodified — `import-entry-points.test.ts`, `diagnostics.no-auto-run.test.ts`, `no-network-surface.test.ts`, `recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`, `catalogs.test.ts` — are **byte-unchanged**, and `app.theme.test.ts` gained exactly one additive case plus a docstring sentence. Nothing was weakened or gamed. |
| Advance ritual not evidenced | **No breach.** `refined.md` (Gate R closed) → `plan.md` carrying `Approved: Oscar 2026-09-16` on line 3 → this `review.md`. The Gate-P commit (`eb43984`) precedes the first implementation commit (`4948875`). |
| Naming / clean-architecture / file placement | **No breach.** The renderer is a delivery adapter whose kind-folders are `components/`, `screens/`, `state/`, `content/`, `styles/`; every new file lands in the one that names its kind, and Import's four parts live in the screen-local `screens/import/` folder that §8 of `refined.md` prescribes — no bare file at a layer root, no new *kind* of object without a folder. Naming follows the established renderer conventions (kebab-case modules; camelCase pure functions named for what they return — `workspaceChrome`, `partitionPinnedItems`, `selectedHit`, `groupDiagnosticRows`, `relocationProgress`, `nextTabId`, `visibleSelectionState`, `toggleVisibleSelection`; PascalCase components named for what they are — `WorkspaceSidebar`, `Breadcrumb`, `EntryShell`, `ConversationTable`, `DestinationPicker`, `ImportStatus`). Pure view logic is language-blind (`workspace-chrome.ts` imports `TranslationKey` type-only). One small naming nit at **S5**. |

**No hard gate is breached.** The FAIL is on acceptance criterion #48 alone (plus the §5 misses in §3).

---

## 6. Issues, prioritised

### Critical — blocks the merge

**C1. Settings is a top tab strip, not a left mini-tab list (§9 Settings item 1, §5.10, §3.4 step 21).**
`desktop/src/renderer/styles/screens.css:745-764`:

```css
.settings-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
}
.settings-tabs [aria-selected="true"] {
  border-bottom: 2px solid var(--color-accent);
}
```

`.screen.settings` (`screens.css:739-744`) is a single 640px column, and `settings.tsx:64-183`
renders the `role="tabpanel"` in normal flow after the `role="tablist"` — so the tabs sit across the
top and the section content sits underneath. The spec says "left mini-tab list … and the selected
section on the right" in three separate places, and the plan's own slice 13 asked for a **left bar**
on the selected tab. The ARIA is correct and the four sections are right; only the axis is wrong.

*Proposed fix (CSS-only, no TSX change needed beyond one wrapper if you want the heading to stay
full-width):* make `.screen.settings` a grid and let the tablist be the first column —

```css
.screen.settings { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 24px; }
.screen.settings > h1, .screen.settings > button { grid-column: 1 / -1; }
.settings-tabs { flex-direction: column; align-items: stretch; border-bottom: none; margin-bottom: 0; }
.settings-tabs [role="tab"] { text-align: left; margin-bottom: 0; }
.settings-tabs [aria-selected="true"] { border-bottom: none; box-shadow: inset 3px 0 0 var(--color-accent); }
```

and add the column collapse to `layout.css`'s existing 900px block. Keep the non-colour signal
(`font-weight: 600` plus the inset bar), which the current rule already gets right in spirit.

### Warning — real defects, fix before merge

**W1. The sidebar will scroll away with the content; `.workspace-content { overflow-y: auto }` never
engages.** `styles/layout.css:8-12,66-68`:

```css
.workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; }
.workspace-content { overflow-y: auto; }
```

`.workspace` is a flex item of `.app-shell` (`base.css:37-41`, `min-height: 100vh`, no `height`), its
implicit grid row is `auto`, and a scroll container still makes a full max-content contribution to an
`auto` row — so the row grows past the viewport instead of the content scrolling inside it, the
document scrolls, and the sidebar (which is inside `.workspace`) goes with it. §5.0 says "The sidebar
does not scroll with the content" and §3.1 step 2 says "No page scroll of the sidebar, ever". This is
reachable on any long screen (a project with many items, a full diagnostics run).
*Proposed fix, one line:* `.workspace { height: 100vh; }` (keep `min-height` or drop it) — or, if you
prefer not to pin the grid to the viewport, `.sidebar { position: sticky; top: 0; align-self: start;
max-height: 100vh; }`. The plan called this "review-by-eye"; please eyeball it against a long
Diagnostics run before shipping either way.

**W2. Search's empty-result branch never renders the detail placeholder, and `search.noSelection` is
unreachable dead copy.** `screens/search.tsx:103-121`: when `results.length === 0` the screen renders
`search.noResults` *instead of* `.search-split`, so `.hit-detail` is never mounted; and inside the
non-empty branch `selectedHit` (`state/search-selection.ts:10-12`) can only return `null` for an
empty array — so the `hit === null ? <p>{t("search.noSelection")}</p>` arm at `search.tsx:128` is
dead. §5.3 asks for "the existing `search.noResults` copy **and** an empty detail panel with a short
placeholder", and the plan says the same. The result is a new catalog key in both languages with no
render site — the exact thing D-P7 rejected for `connect.stepsSummary` ("dead copy is worse than a
small diff"). No test covers the empty-result case either (`search.dom.test.tsx`'s `runQuery` helper
awaits `findByRole("list")`, which cannot resolve when there are no hits).
*Proposed fix:* render the split unconditionally and put `search.noResults` in the (empty) left
column, keeping `search.noSelection` in the detail panel; add a DOM case for the empty result set
with its own await.

**W3. A project whose items are all pinned renders an empty "Other items" heading and an empty
`<ul>`.** `screens/project.tsx:132-145`: the guard is `if (pinned.length === 0) return itemList(items)`,
but there is no matching guard on `rest`. `partitionPinnedItems` handles the all-pinned case correctly
and `pinned-partition.test.ts` covers it — the bug is only in the screen, which is also the one layer
with no test for it.
*Proposed fix:* `{rest.length > 0 && (<><h2 …>{t("project.otherItems")}</h2>{itemList(rest)}</>)}`,
plus a `project.dom.test.tsx` case for an all-pinned listing.

**W4. The onboarding progress bar is at the bottom, not "at the top".** `screens/onboarding.tsx:78-88`
places `.slide-progress` last in the DOM, and `screens.css:95-102` gives it `margin: 20px auto 0`
below `.onboarding-nav`. §5.13 and §3.5 step 25 both say "a thin progress bar **at the top** replaces
the dots". (The dots it replaces were mid-screen, so this is not a like-for-like carry-over.)
*Proposed fix:* move the `<div className="slide-progress">` above `.onboarding-nav` and change the
margin to `0 auto 20px`.

**W5. `.import-rail { overflow-y: auto }` can never scroll, so D-13's rider is unmet.**
`screens.css:630-636` gives the rail `overflow-y: auto` with no height constraint; `.import-body` is
a grid whose row is `auto`, so a long per-conversation failure list simply makes the rail (and the
row) taller rather than scrolling inside it. D-13's default is "Option 1, **with the rail allowed to
scroll internally if a long failure list overflows**".
*Proposed fix:* `.import-rail { max-height: 520px; }` (or `align-self: start; max-height: calc(100vh
- 200px);`) alongside the existing `overflow-y: auto`, and drop it inside the 900px block where the
rail is stacked below the table.

### Suggestion — not blocking

**S1. `Breadcrumb`'s React key can collide.** `components/breadcrumb.tsx:23` uses `key={label}`. On
the Context pack trail the segments are `[dashboard.title, <project>, pack.title]`, so a project named
`context pack` / `dashboard` (or their Spanish equivalents, where the project name is raw user text)
produces duplicate keys and a React reconciliation warning. The trail is a short, positionally stable
list; `key={index}` is the honest key here.

**S2. The header checkbox's accessible name does not swap with its action.**
`screens/import/conversation-table.tsx:45` hardcodes `aria-label={t("import.selectAllVisible")}` even
when activating it will *deselect* — while the text link two elements away correctly swaps to
`import.deselectAllVisible` (`import-screen.tsx:283-285`). D-P8's own argument ("a control labelled
'Select all' that deselects is a small lie") applies to both controls; `headerState` is already in
scope. Sighted users read the checkmark, screen-reader users read the label.

**S3. The pinned/rest render is an IIFE inside JSX.** `screens/project.tsx:132-145` wraps the
partition in `(() => { … })()`. Lifting `const { pinned, rest } = partitionPinnedItems(items ?? [])`
to just above the `return` (it is a total function over already-fetched data, so it costs nothing)
and rendering two plain conditionals reads better and makes W3's guard obvious.

**S4. One new transition, which §4.2 puts out of scope.** `screens.css:680-683` adds
`transition: transform 0.15s` to `.sort-arrow`. §4.2 out: "Animation/transition work beyond what
already exists (the chevron's `transform` transition)". It is a fair like-for-like replacement for the
disclosure chevron this advance deleted, but it is not what the scope line says — worth a sentence in
the commit message, or drop it.

**S5. `className="settings-gear"` now names two different things.**
`components/workspace-sidebar.tsx:66` reuses the class on a button that renders a gear icon **and** a
"Settings" label, while `screens/locked.tsx:68` uses it for a lone icon button — and
`layout.css:156-160` absolutely positions the latter. Nothing breaks today (the rule is scoped to
`.entry-content`), but a future rule written against `.settings-gear` will hit both. Consider
`className="sidebar-settings"` for the sidebar entry, or no class at all (the sidebar's own
`.sidebar button` rule already styles it).

**S6. Chips show their native radio, segmented controls hide theirs.** `screens.css:460-469` leaves
the `.chip` radio visible, while `screens.css:779-787` visually hides the `.segmented` one with a
comment explaining why. Both are single-select pills authored in this advance; the inconsistency is
visible side by side. Whichever way you go, apply it to both (the `.segmented` treatment — hidden
input, `:has(input:checked)` on the label, focus ring preserved — is the better of the two and is
already written).

**S7. The diagnostics `<table>` has no `<thead>` or `<caption>`.** `screens/diagnostics.tsx:141-158`
emits `<table><tbody>` only. §5.7 does not ask for column headers, so this is not a miss — but a
header-less data table is announced poorly by screen readers. A visually-hidden `<caption>` reusing
the section title, or `role="presentation"` if you consider it a layout table, would make the intent
explicit.

---

## 7. What flips this to PASS

1. **C1** — Settings laid out as a left mini-tab list with the section content to its right (and its
   collapse added to the existing 900px block). This is the one unmet §9 acceptance criterion.
2. **W1** — the sidebar demonstrably stays put while a long screen scrolls (one line in
   `layout.css`), since §5.0 and §3.1 both state it in the imperative.
3. **W2** — either render the detail panel on an empty result set (with a DOM case for it) or, if
   you'd rather keep today's behaviour, drop `search.noSelection` from both catalogs and the dead
   branch from `search.tsx`, and record the §5.3 amendment in `docs/gui.md`. Do not leave an
   unreachable key.
4. **W3** — guard the "Other items" section on `rest.length > 0`, with a DOM case for an all-pinned
   project.
5. **W4** — move the progress bar above the slide, or get an explicit amendment for keeping it below.
6. **W5** — bound the rail's height so D-13's "scroll internally" rider is real, or amend D-13.

Everything else in §6 is a suggestion and does not gate the merge. Re-run both suites after the
changes; nothing above should touch a test that is currently required to stay unmodified.
