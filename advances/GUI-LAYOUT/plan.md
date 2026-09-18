# GUI-LAYOUT — Plan

Approved: Oscar 2026-09-16

**Status: Gate P closed** (Oscar, 2026-09-16, "Aprobado" — all ten Decisions to confirm, D-P1…D-P10,
accepted as their stated defaults). Implementation may now proceed slice by slice.

```
Approved: Oscar <date>
```

**Spec:** `advances/GUI-LAYOUT/refined.md` (Gate R closed 2026-09-15; D-1 … D-22 approved as
written, including D-9). This plan executes those defaults; it does not re-open them. Where the spec
left something to "the planner's call", the call is made here and listed in §8 *Decisions to confirm*
so Oscar can override before any code is written.

**Branch (per the working agreement's `{feature}/{ADVANCE}` rule → `gui-layout/GUI-LAYOUT`):**
this plan **recommends overriding that convention and continuing on `feat/desktop-GUI`**, the branch
this repo has used for every desktop-GUI advance so far (`GUI`, `CARDS`, `IMPORT-ENTRY`,
`IMPORT-FEEDBACK`, `PROJECT-NAME-SLUG` — see `advances/CARDS/plan.md` §Branch and
`advances/PROJECT-NAME-SLUG/plan.md` §Branch, both explicit overrides for the same reason).
`main` has no `desktop/` tree, so a branch off `main` starts from an empty renderer. This is
**D-P1** in §8 — Oscar picks; the implementer does **not** create any branch until he has.

**Start from the current HEAD of `feat/desktop-GUI`, not a snapshot.** Before Slice 0 the
implementer runs `git status` (tree must be clean), `git log --oneline -5`, and confirms
`desktop/src/renderer/screens/import.tsx` is the 382-line post-IMPORT-FEEDBACK + PROJECT-NAME-SLUG
version (it carries `previewProjectSlug` and `.project-slug-hint`). If it is not, stop and re-plan:
this plan's Import slice is written against that exact file.

---

## 0. What this advance is, in one paragraph

Thirteen existing renderer screens are re-laid-out onto a persistent left sidebar, four breadcrumbs,
a shared entry-cluster split panel and a mini-tabbed Settings panel. **No `src/**` file, no
`desktop/src/main/**`, no `desktop/src/preload/**`, no `shared/ipc/messages.ts`, no `tokens.css`, no
`desktop/package.json` dependency changes.** Every `bridge.*` call, guard, error path and byte-pinned
artifact survives unchanged. New work is: 4 new components, 6 new pure modules under `state/`, one
new stylesheet, one screen-local folder for Import, ~33 new catalog keys in both languages, 3 new DOM
tests, 6 new unit-test files, and a `docs/gui.md` update.

---

## 1. Slice map (ordered, each independently checkable)

Every slice ends with `npm run typecheck && npm run lint && npm run test` green **in `desktop/`**
and `npm run lint && npm run typecheck && npm run test` green **at the repo root** (root `biome check .`
covers `desktop/` too; root `vitest` does not run desktop tests — both must be run). Commit per slice.

| # | Slice | Blocks / blocked by | Est. prod lines |
|---|---|---|---|
| 0 | Baseline + branch | — | 0 |
| 1 | Shell chrome logic (pure) | blocks 2 | ~70 |
| 2 | Sidebar + breadcrumb + `layout.css` + `app.tsx` wiring | blocks 3–9 | ~350 |
| 3 | Dashboard card grid | needs 2 | ~45 |
| 4 | Project: chips + pinned grouping | needs 2 | ~135 |
| 5 | Search master–detail | needs 2 | ~190 |
| 6 | Context pack: two views | needs 2 | ~90 |
| 7 | Connect: grid + rail | needs 2 | ~105 |
| 8 | Diagnostics: grouped table | needs 2 | ~190 |
| 9 | Sync: stat cards + banner | needs 2 | ~160 |
| 10 | **Import: table + rail + select-all** (riskiest) | needs 2 | ~300 |
| 11 | Entry cluster split shell (4 screens) | independent | ~180 |
| 12 | Relocation wizard: 3-step indicator | needs 1 (no-sidebar chrome) | ~135 |
| 13 | Settings: mini-tabs + segmented controls | independent | ~200 |
| 14 | Recovery kit: banner + gate box | independent | ~45 |
| 15 | Onboarding: progress bar + arrows | independent | ~105 |
| 16 | `docs/gui.md` + acceptance sweep | last | ~0 (docs) |

Slices 3–9 and 11–15 are independent of each other; they may be reordered or parallelised, but
**2 must land before 3–10**. Slice 10 is deliberately alone and late-but-not-last, so it gets a full
attention window and is not the thing being rushed at the end.

---

### Slice 0 — Baseline

**Do.** Confirm clean tree and current HEAD of `feat/desktop-GUI` (see the branch note above). Run
the full suite twice (root + `desktop/`) and record that it is green *before* any edit — so a later
failure is unambiguously this advance's.

**Check.** Both suites green; `git diff --stat` empty.

---

### Slice 1 — Shell chrome logic (pure, headless)

The shell's whole "where am I" model, derived from `WorkspaceView`, before any JSX exists. D-3
Option 1, D-6, §5.0, §5.9's "no sidebar on relocation".

**Files**

- `desktop/src/renderer/state/workspace-nav.ts` *(modified, additive)* — add:
  ```ts
  export type NavDestination = "dashboard" | "search" | "connect-tools" | "sync";
  /** Today's order, unchanged (§5.0). Driven from a list, not four hardcoded entries, so CONNECT can add a lock indicator / a fifth entry without a rewrite (D-21a). */
  export const NAV_DESTINATIONS: readonly NavDestination[] = ["dashboard", "search", "connect-tools", "sync"];
  ```
  `WorkspaceView`'s nine variants and `resetWorkspaceView()` are **untouched**.
- **New** `desktop/src/renderer/state/workspace-chrome.ts`:
  ```ts
  export type BreadcrumbLabel = { key: TranslationKey } | { raw: string };
  export interface BreadcrumbSegment {
    label: BreadcrumbLabel;
    /** Where this segment navigates; `null` on the final segment, which is plain text with aria-current="page". */
    target: WorkspaceView | null;
  }
  export interface WorkspaceChrome {
    sidebar: boolean;                      // false only for relocate-vault (§5.9)
    active: NavDestination | null;         // null on every drill-down (D-6)
    trail: readonly BreadcrumbSegment[];   // empty when there is no breadcrumb
  }
  export function workspaceChrome(view: WorkspaceView): WorkspaceChrome;
  ```
  Language-blind: it imports `type { TranslationKey }` only (type-only, erased — the same thing
  `diagnostic-rows.ts` already does) and never the catalog. A `switch` over `view.screen` with no
  `default` branch, so a future `WorkspaceView` variant is a typecheck failure, not a silent
  "no chrome".
- **New** `desktop/src/renderer/state/workspace-chrome.test.ts`.

**Red → green.** Write `workspace-chrome.test.ts` first: one case per `WorkspaceView` variant (9),
asserting `sidebar`, `active` and the exact `trail`:

| view | sidebar | active | trail |
|---|---|---|---|
| `dashboard` / `search` / `connect-tools` / `sync` | true | that destination | `[]` |
| `project` | true | `null` | `dashboard.title →dashboard` · `{raw: project}` (final) |
| `pack-preview` | true | `null` | `dashboard.title` · `{raw: project}` →`project` · `pack.title` (final) |
| `import` | true | `null` | `dashboard.title` · `import.title` (final) |
| `diagnostics` | true | `null` | `dashboard.title` · `diagnostics.title` (final) |
| `relocate-vault` | **false** | `null` | `[]` |

Plus: every non-final segment has a non-null `target`; every final segment has `target === null`
(a loop over all nine views — this is the invariant a breadcrumb bug would break).

**Acceptance covered:** §9 "The trail is produced by a pure, unit-tested mapping from
`WorkspaceView`"; "drill-down screens have no active entry"; §5.0's trail table.

---

### Slice 2 — Sidebar shell, breadcrumb, `layout.css`, `app.tsx` wiring

The load-bearing slice. Everything from §5.0, D-1, D-2 (the three extracted components), D-5, D-6,
D-17.

**Files**

- **New** `desktop/src/renderer/components/workspace-sidebar.tsx` → `WorkspaceSidebar`
  ```ts
  { active: NavDestination | null; onNavigate: (d: NavDestination) => void;
    onOpenSettings: () => void; onLock: () => void }
  ```
  Renders `<nav className="sidebar" aria-label={t("shell.primaryNav")}>`: brand mark +
  `t("common.appName")`; `NAV_DESTINATIONS.map(...)` each a `<button>` with an `aria-hidden` icon +
  its existing label (`dashboard.title`, `search.title`, `connect.navLabel`, `sync.title`) and, when
  active, `className="active"` **and** `aria-current="page"`; a `<div className="sidebar-spacer" />`;
  then **Lock now** (keeping `className="lock-button"` and its danger treatment) and **Settings**.
  A module-level `const NAV_LABELS: Record<NavDestination, TranslationKey>` and
  `const NAV_ICONS: Record<NavDestination, ReactNode>` keep the JSX one line per entry.
- **New** `desktop/src/renderer/components/breadcrumb.tsx` → `Breadcrumb`
  ```ts
  { trail: readonly BreadcrumbSegment[]; onNavigate: (view: WorkspaceView) => void }
  ```
  Returns `null` for an empty trail. Otherwise `<nav className="breadcrumb" aria-label={t("shell.breadcrumb")}>`
  with `<button>` for each non-final segment, an `aria-hidden` `/` separator span between segments,
  and `<span aria-current="page">` for the final one. Label resolution at this edge:
  `"key" in segment.label ? t(segment.label.key) : segment.label.raw`.
- **New** `desktop/src/renderer/components/icons.tsx` — one file, ~10 tiny components (§8's
  Decisions to confirm, D-P3). **Every one:** `<svg width=… height=… viewBox=… aria-hidden="true">`,
  `stroke`/`fill="currentColor"`, **no `xmlns` attribute** (fact 7 — an `xmlns="http://…"` fails
  `no-network-surface.test.ts`, and `aria-hidden` is also what keeps Biome's `a11y/noSvgWithoutTitle`
  quiet). Set: `BrandMark`, `DashboardIcon`, `SearchIcon`, `ConnectIcon`, `SyncIcon`, `LockIcon`,
  `GearIcon`, `ProjectIcon`, `ArrowLeftIcon`, `ArrowRightIcon`, `SortArrowIcon`.
- **Deleted** `desktop/src/renderer/components/nav-bar.tsx` (55 lines).
- `desktop/src/renderer/app.tsx` *(modified)* — `Workspace` becomes:
  ```tsx
  const chrome = workspaceChrome(view);
  <div className="workspace">
    {chrome.sidebar && <WorkspaceSidebar active={chrome.active} onNavigate={(screen) => setView({ screen })} … />}
    <div className="workspace-content">
      <Breadcrumb trail={chrome.trail} onNavigate={setView} />
      {/* the existing per-screen blocks, unchanged except the two prop edits below */}
    </div>
  </div>
  ```
  Two prop edits only: `ProjectScreen` and `PackPreviewScreen` lose `onBack` (§4.3 — the breadcrumb's
  non-final segments now navigate to exactly the destinations those buttons did: Project → dashboard,
  Context pack → that project). `NavBar`'s import is removed. Everything else in `app.tsx` —
  the overlay switch, the phase switch, `lockNow`, `relocationFinished`, `ThemedRoot` — is untouched.
- `desktop/src/renderer/screens/project.tsx`, `pack-preview.tsx` *(modified)* — drop the `onBack`
  prop and its `<button>{t("common.back")}</button>`. Nothing else in this slice.
- **New** `desktop/src/renderer/styles/layout.css` (D-17 Option 2) — shell-level rules only:
  `.workspace` (grid `220px minmax(0,1fr)`, full height), `.sidebar` (fixed width, never scrolls with
  content, its own `overflow: hidden`), `.sidebar button`, `.sidebar button.active` (accent **plus** a
  3px inset bar and `font-weight: 600` — never colour alone, D-6), `.sidebar-spacer { flex: 1 }`,
  `.workspace-content { overflow-y: auto }`, `.workspace-content > .screen { max-width: 1040px }`
  (see D-P5), `.breadcrumb`, `.crumb-sep`, `.entry-shell` (slice 11), and **one** `@media (max-width: 900px)`
  block (D-4 Option 1) that collapses the two-column layouts. No new custom property; no `url(...)`.
- `desktop/src/renderer/app-main.tsx` *(modified)* — `import "./styles/layout.css";` between
  `base.css` and `screens.css`, so cascade order stays explicit.
- `desktop/src/renderer/styles/base.css` *(modified)* — delete `.nav-bar`, `.nav-bar .lock-button`,
  `.nav-bar .lock-button:hover`; update the `.settings-gear + h1` comment, which currently explains
  itself by reference to `.nav-bar .settings-gear` (the rule itself stays — `locked.tsx` still has a
  lone gear). Leave `.app-shell > .screen:not(.settings):not(.recovery-kit)` in place: after this
  advance its only consumer is the onboarding tour (slice 11 adds the entry-shell's own centring rule
  in `layout.css`).
- `desktop/src/shared/i18n/catalogs/en.ts` + `es.ts` *(modified)* — new `shell` namespace:
  `shell.primaryNav` ("Main navigation" / "Navegación principal"),
  `shell.breadcrumb` ("Breadcrumb" / "Ruta de navegación").

**Red → green.**
1. **New** `desktop/src/renderer/app.shell.test.ts` (source-scan, the house style of
   `app.theme.test.ts` / `import-entry-points.test.ts`): `app.tsx` contains exactly one
   `<WorkspaceSidebar`, contains `workspaceChrome(`, contains **no** `NavBar`/`nav-bar` reference;
   `nav-bar.tsx` no longer exists (`existsSync` false); `base.css` contains no `.nav-bar` selector.
   Written first — it fails, then the slice makes it pass.
2. `desktop/src/renderer/screens/__dom-tests__/project.dom.test.tsx` *(modified, 1 line)* — remove
   `onBack={vi.fn()}` (it is now an excess prop → a typecheck error). Add a one-line comment saying
   why (GUI-LAYOUT §4.3: the shell's breadcrumb replaced the per-screen Back button). This is the
   only structural assumption that genuinely moved.
3. `state/workspace-nav.test.ts` *(modified, additive)* — `NAV_DESTINATIONS` is the four destinations
   in today's order.

**Acceptance covered:** the whole "Shell and navigation" block of §9, plus §9's
"Shell styles live in their own stylesheet… import order in `app-main.tsx` is explicit".

**Eyeball-only (jsdom does not lay out, §2 fact 10):** the sidebar not scrolling with content; the
900px collapse. State this plainly in the commit message.

---

### Slice 3 — Dashboard card grid (§5.1, D-8)

**Files:** `screens/dashboard.tsx` (add a `<ProjectIcon />` inside the existing `.project-card`
button, above `.project-name`), `styles/screens.css` (`.project-cards` becomes
`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`, gap 16px; card padding/border/hover).

**Hard prohibitions in this slice — the two ways it fails quietly:**
1. **No text input of any kind may be added.** No filter, no search box (§5.1 — asked for, then
   rejected; a reviewer finding one fails the advance).
2. **`const header = (…)` is not touched at all.** It is already the header row §5.1 asks for
   (`.dashboard-header` + `.header-actions`); the change is CSS. `import-entry-points.test.ts`
   slices the file from `const header = (` to the first `\n  );` — any re-indent or re-wrap of that
   block risks it. Leave it byte-identical and let `screens.css` do the work.
   `import-entry-points.test.ts` and `diagnostics-entry-points.test.ts` must pass **unmodified**.

**Check:** 2 columns at ~1120px (sidebar 220 + padding 48 → ~830px content; `320×2+16 = 656 ≤ 830`,
`320×3+32 = 992 > 830`). Eyeball. Suite green with both entry-point tests untouched.

**Est.** ~10 tsx + ~35 css.

---

### Slice 4 — Project: chip row + pinned grouping (§5.2, D-9, D-11)

**Files**

- **New** `desktop/src/renderer/state/pinned-partition.ts`:
  ```ts
  export interface PinnedPartition<T> { pinned: T[]; rest: T[] }
  /** A stable partition, never a re-sort: relative order inside each group is exactly the order the rows arrived in (D-9). */
  export function partitionPinnedItems<T extends { pinned: boolean }>(items: readonly T[]): PinnedPartition<T>;
  ```
  Generic over `{ pinned: boolean }` so it never imports the screen's local `ItemRow`.
- **New** `state/pinned-partition.test.ts` — **red first**: all-pinned, none-pinned, mixed (asserting
  the exact relative order of both groups against a fixture whose ids encode arrival order), empty.
- `screens/project.tsx` *(modified)* — the `<select>` becomes a chip row:
  `<fieldset className="chip-row"><legend className="sr-only">{t("project.typeFilterLabel")}</legend>`
  then one `<label className="chip">` + `<input type="radio" name="type-filter" value={…} checked={…}
  onChange={() => setTypeFilter(…)} />` per option — `All types`, each `ITEM_TYPES` value shown as its
  raw domain word, `Imported`. Native radios give arrow-key navigation and single-select semantics for
  free (D-11 Option 2) with **no** `role="radiogroup"` (a `<fieldset>`+`<legend>` is the semantic
  equivalent and avoids Biome's `a11y/useSemanticElements`). The **Context pack** button moves onto the
  same toolbar row, right-aligned. The list becomes: when `pinned.length > 0`, `<h2>{t("project.pinnedSection")}</h2>`
  + `<ul className="item-list">` + `<h2>{t("project.otherItems")}</h2>` + a second `<ul className="item-list">`;
  when there are no pinned items, exactly today's single unlabelled list.
  `handleTypeChange`'s `ChangeEvent<HTMLSelectElement>` signature goes away; the `useEffect`,
  its deps `[project, typeFilter]`, the `bridge.content.show` call shape, the focus refresh, the
  error/empty branches and **`ItemCard` in every respect** are untouched.
- `styles/screens.css` — `.chip-row` (wraps, no horizontal scroll, no overflow menu), `.chip`
  (selected = accent background **+** border + `font-weight: 600`, so not colour alone), `.project-toolbar`,
  `.item-section-title`.
- Catalogs: `project.pinnedSection` ("Pinned" / "Fijados"), `project.otherItems` ("Other items" /
  "Otros elementos"), `project.typeFilterLabel` ("Filter by type" / "Filtrar por tipo").

**Check:** `project.dom.test.tsx` passes (it asserts `ul.item-list li.item-row` counts and card
internals — both survive two lists). Chip click issues the same `content.show` call.

---

### Slice 5 — Search master–detail (§5.3, D-7 Option 2, §4.3)

**Files**

- **New** `desktop/src/renderer/state/search-selection.ts`:
  ```ts
  /**
   * The selected hit, derived — never stored twice. Falls back to the first hit when the stored id
   * is absent (a new result set) or null (a fresh search), which is what makes "the first hit is
   * selected when a search completes" true with no effect and no re-query.
   */
  export function selectedHit<T extends { id: string }>(hits: readonly T[], selectedId: string | null): T | null;
  ```
- **New** `state/search-selection.test.ts` — **red first**: empty hits → `null`; `selectedId === null`
  → first; stale id → first; matching id → that hit; single hit.
- `screens/search.tsx` *(modified)* — add `onOpenProject: (project: string) => void` to the props
  (§4.3) and `const [selectedId, setSelectedId] = useState<string | null>(null)`. `runSearch` calls
  `setSelectedId(null)` alongside `setResults(...)` — that one line is what makes "re-running a search
  or changing scope re-selects the first hit of the new set" literally true. Layout: the query input,
  scope `<select>`, submit button and `.result-count` stay above a `<div className="search-split">`
  with `<ul className="hit-list">` (one `<li><button className="hit-row" aria-current={selected}>`:
  project · type · date · a one-line preview `<span className="hit-preview">{hit.content}</span>`
  **truncated by CSS, never sliced in JS** — cosmetic, §7.5) and `<div className="hit-detail">`
  holding `<MarkdownContent content={hit.content} />` plus an **Open project** button. Empty result
  set: existing `search.noResults` copy + `search.noSelection` placeholder in the detail panel.
  `bridge.content.search`'s call shape, hit order, `ALL_PROJECTS`, the empty-query early return and
  `errorCopy` are untouched.
- `app.tsx` — `onOpenProject={(project) => setView({ screen: "project", project })}` (one line, the
  same shape Dashboard's `onSelectProject` already has).
- `styles/screens.css` — `.search-split` (grid `minmax(0,320px) minmax(0,1fr)`), `.hit-row`,
  `.hit-row[aria-current="true"]` (accent **+** left bar), `.hit-preview` (`white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis`), `.hit-detail`. Single column below the 900px breakpoint.
- Catalogs: `search.openProject`, `search.noSelection`.

**New DOM test** `screens/__dom-tests__/search.dom.test.tsx` (D-18 Option 2) — **red first**:
1. after a search, the first hit's full content is in the detail panel;
2. clicking the second hit swaps the detail panel **and `content.search` was called exactly once**
   (no re-query, no IPC on selection — §9);
3. re-running the search re-selects the first hit even when the previously selected hit is still in
   the result set;
4. **Open project** calls `onOpenProject` with the selected hit's project;
5. a hit whose content is `<img src=x onerror=alert(1)>` produces no `img`/`a` element and shows as
   text (CARDS §7 / §7.5, since this is the first time Search renders untrusted content).

---

### Slice 6 — Context pack: rendered + raw (§5.4, D-7, D-10, §7.1)

**Files**

- `screens/pack-preview.tsx` *(modified)* — `const [view, setView] = useState<"rendered" | "raw">("rendered")`
  (component state only, never persisted — §7.4). One toolbar holds: the notice, two
  `<button aria-pressed>` view toggles (`pack.viewRendered` / `pack.viewRaw` — `aria-pressed` carries
  the state non-visually), **Copy**, the format `<select>`, **Export…**. Body:
  `view === "raw" ? <pre className="pack-text">{markdown}</pre> : <MarkdownContent content={markdown} />`.
  **`handleCopy` and `handleExport` are not touched at all** — they already read the `markdown` state
  and `{project, format}`; the rendered view must never round-trip into either, and no DOM read is
  introduced anywhere.
- Catalogs: `pack.viewRendered` ("Rendered" / "Con formato"), `pack.viewRaw` ("Raw Markdown" /
  "Markdown sin formato"), and the **one sanctioned copy amendment** (D-10 Option 3), proposed text:
  - EN `pack.notTranslatedNotice`: *"This is your saved content, never translated. The raw view shows
    the exact Markdown that Copy puts on your clipboard."*
  - ES: *"Este es tu contenido guardado; nunca se traduce. La vista sin formato muestra exactamente el
    Markdown que Copiar pone en tu portapapeles."*
  (It says *Copy*, not *Export*, because Export can also produce JSON — the sentence has to stay true
  in both format choices. Oscar's call at Gate P: **D-P6**.)
- `styles/screens.css` — `.pack-toolbar`, `.pack-view-toggle button[aria-pressed="true"]`.

**New DOM test** `screens/__dom-tests__/pack-preview.dom.test.tsx` — **red first**, and this is the
byte-identity one §9 calls out by name:
1. with the **rendered** view showing (the default), clicking Copy calls
   `bridge.content.copy` with `{ text: <the exact original markdown string> }`;
2. switching to raw, the `<pre class="pack-text">`'s `textContent` **equals that same string** exactly;
3. clicking Copy in the raw view sends the identical string;
4. Export still calls `bridge.content.export({ project, format })` with the `<select>`'s value;
5. the rendered view contains no literal `##`/`**` and no `img`/`a` element.

---

### Slice 7 — Connect: card grid + always-visible rail (§5.5, D-21c)

**Files**

- `screens/connect-tools.tsx` *(modified)* — delete `stepsOpen` state and the whole `.disclosure`
  (the advance's only state removal, §5.5), replace with
  `<aside className="connect-rail">` holding `<h2>{t("connect.stepsTitle")}</h2>`, the **same**
  `<ol className="steps-list">` with the same three step keys and numbered treatment, and the Node/npm
  warning block **under the same condition** (`nodeWarningNeeded`) — still informational, still never
  disabling Connect. `.client-cards` becomes the left column. Per-card content, states, the mount-time
  `tools.status()` + `tools.nodeStatus()` reads, the `configUnreadable` snippet and its copy button
  are untouched.
- `styles/screens.css` — `.connect-body` (grid: cards + rail), `.client-cards` auto-fill grid,
  `.connect-rail`; drop the `.disclosure*` rules; **keep `.client-status` state styling driven by a
  class per state rather than a `.connected` boolean baked into the layout** (D-21c: CONNECT will ship
  six states). Single column below 900px, rail below the cards.
- Catalogs: no new key. `connect.stepsSummary` ("3 steps") loses its only render site — see **D-P7**.

---

### Slice 8 — Diagnostics: grouped table (§5.7, D-14, §7.8)

**Files**

- **New** `desktop/src/renderer/state/diagnostic-groups.ts`:
  ```ts
  export type DiagnosticGroupId = "system" | "vault" | "tools" | "other";
  export interface DiagnosticGroup { id: DiagnosticGroupId; rows: DiagnosticRow[] }
  /**
   * A pure client-side partition over diagnosticRows()' output — never a change to what
   * diagnostics.run() returns. Order inside a group is the order diagnosticRows() produced.
   * An unrecognised key lands in "other" so a check added to doctor.ts later appears somewhere
   * visible instead of vanishing (D-14). Empty groups are not emitted.
   */
  export function groupDiagnosticRows(rows: readonly DiagnosticRow[], clients: readonly string[]): DiagnosticGroup[];
  ```
  `system` = `node`, `tool-node`, `sqlcipher`, `keychain`; `vault` = `vault`, `journal`, `sync`,
  `lineage`, `auto-lock`; `tools` = membership in `clients` (the same `tools:status` test
  `diagnostic-rows.ts` already uses); everything else → `other`.
- **New** `state/diagnostic-groups.test.ts` — **red first**: each known key lands in its section; a
  client key lands in `tools`; an unknown key lands in `other`; groups with no rows are absent from
  the result; group order is system → vault → tools → other; row order inside a group is preserved.
- `screens/diagnostics.tsx` *(modified)* — `Run checks` and `Copy report` move into a
  `<div className="screen-toolbar">` beside the `<h1>`; both probe notices stay **above** the table;
  `CheckRow` becomes a `<tr>`: `<td>` status dot (`<span className="status-dot ok|warning|fatal" aria-hidden="true"/>`)
  **plus the existing status word** · `<td>` name · `<td>` detail, with `explanation` folded into the
  detail cell (as a second line inside the same cell) and the optional `extra` line kept. One
  `<table>` per group under an `<h2>` from `diagnostics.section*`.
  **Hard invariant: this file must still contain zero `useEffect`.** The grouping is computed inline
  during render from `rows` (`groupDiagnosticRows(rows, (toolsStatus ?? []).map(e => e.client))`),
  exactly as `rows` is today. `handleRunChecks` keeps all three probe-backed reads.
  `diagnostics.no-auto-run.test.ts` must pass **unmodified** — run it explicitly at the end of the slice.
- `styles/screens.css` — `.diagnostic-section`, `.diagnostic-table`, `.status-dot.ok|.warning|.fatal`
  (colour only as a *second* signal; the word stays).
- Catalogs: `diagnostics.sectionSystem` / `sectionVault` / `sectionTools` / `sectionOther`
  ("System / Vault / Connected tools / Other checks" · "Sistema / Bóveda / Herramientas conectadas /
  Otras comprobaciones").

---

### Slice 9 — Sync: stat cards + banner (§5.8, D-I)

**Files**

- `screens/sync.tsx` *(modified)* — header row: `<h1>` left, **Move my vault…** as the right-hand
  primary action with **Check my setup** beside it as secondary. Below: the conflicted-copy /
  stale-backup **banner** (existing plural-aware counts + existing `sync.conflictGuidance`, **and no
  resolve/merge/delete affordance of any kind** — D-I, never renegotiated), then a
  `<div className="stat-cards">` with four small cards (Folder: path + the cloud-recognition line ·
  File state: at rest / not · Auto-lock: TTL or disabled · Write history: generation + last writer)
  and one wide card (device-state folder). The single mount-time `Promise.all([vault.status, sync.status])`
  read, the `SyncData` shape, the loading/error branches and the "displayed, never editable" rule are
  untouched — **no field on this screen becomes an input**.
- `styles/screens.css` — `.sync-banner`, `.stat-cards` (auto-fill grid), `.stat-card`, `.stat-card.wide`
  (`grid-column: 1 / -1`), `.stat-card-title`, `.stat-card-value`.
- Catalogs: `sync.fileState` ("File state" / "Estado del archivo"), `sync.autoLockTitle`
  ("Auto-lock" / "Bloqueo automático"), `sync.generationTitle` ("Write history" /
  "Historial de escritura"). Folder and device-state cards reuse `sync.vaultFolder` / `sync.stateHome`.

---

### Slice 10 — Import: table, rail, select-all (§5.6, D-12, D-13, fact 11, §7.9)

The riskiest slice: the most behaviour to preserve and the most existing test surface. Do it in the
order below — **pure logic first, then the move, then the new UI** — so a regression is attributable.

**10a — the select-all policy (pure, red first)**

- `desktop/src/renderer/state/import-selection.ts` *(modified, additive — `buildPickSpec`,
  `allChecked`, `countSelection`, `sortListingByDate` are untouched)*:
  ```ts
  export type VisibleSelectionState = "none" | "some" | "all";
  /** What the header checkbox shows: "all"/"none"/"some" over the *visible* rows only. An empty visible set is "none" — never "all" (an `every` over [] would lie). */
  export function visibleSelectionState(checked: ReadonlySet<number>, visible: readonly ImportListingRow[]): VisibleSelectionState;
  /**
   * D-12 Option 2 — a union/difference over the visible rows only: selecting adds every visible
   * row's original index, deselecting removes them, and a row the filter is hiding is never
   * touched. Composes with buildPickSpec's original-index semantics unchanged.
   */
  export function toggleVisibleSelection(checked: ReadonlySet<number>, visible: readonly ImportListingRow[]): Set<number>;
  ```
- `state/import-selection.test.ts` *(modified, additive)* — the five cases D-12 names: all visible
  checked → deselects exactly those; none checked → selects exactly those; partial → selects the rest
  of the visible ones; **rows hidden by the filter keep their checked state through both directions**;
  empty visible set → state `"none"` and the toggle is a no-op. Plus: after a toggle, `buildPickSpec`
  still emits sorted original 1-based indices.

**10b — the screen-local folder move (no behaviour change in this step)**

- **New** `desktop/src/renderer/screens/import/import-screen.tsx` — the current `import.tsx` moved
  verbatim (state, refs, handlers, guards), import paths adjusted by one `../`.
- **Deleted** `desktop/src/renderer/screens/import.tsx`.
- `app.tsx` — import path → `./screens/import/import-screen.js`.
- `screens/__dom-tests__/import.dom.test.tsx` — import path → `../import/import-screen.js`, with a
  one-line comment recording the move. **No assertion changes in this step**; the 14 existing cases
  must pass untouched before 10c starts. If any of them goes red here, the move is wrong — fix it
  before adding a single line of new UI.

**10c — table + rail**

- **New** `screens/import/conversation-table.tsx` → `ConversationTable`
  ```ts
  { rows: readonly ImportListingRow[]; checked: ReadonlySet<number>; disabled: boolean;
    headerState: VisibleSelectionState; sortDirection: SortDirection; language: Language;
    onToggleRow: (index: number) => void; onToggleVisible: () => void; onToggleSort: () => void }
  ```
  A `<div className="conversation-scroll">` (keeps IMPORT-FEEDBACK D-6's bounded
  `max-height: 320px; overflow-y: auto`) wrapping `<table className="conversation-table">`.
  `<thead>` is **sticky** (`position: sticky; top: 0`) and holds: the header checkbox
  (`aria-label={t("import.selectAllVisible")}`, `checked = headerState === "all"`, and a **real
  indeterminate** via a ref callback `ref={(el) => { if (el) el.indeterminate = headerState === "some"; }}`
  — React has no `indeterminate` prop, and a ref callback avoids adding a `useEffect`),
  `import.columnTitle`, a Date header that is a `<button>` toggling sort with `aria-sort` on the
  `<th>` (so the direction is conveyed non-visually and the button keeps a real text name), and
  `import.columnChunks`. One `<tr>` per row; the row checkbox carries `aria-label={row.title}`.
  Compact density (~2px/6px padding) — denser than today, still pointer- and keyboard-usable.
- **New** `screens/import/destination-picker.tsx` → `DestinationPicker` — the existing
  `<label>{t("import.projectLabel")}<select>…</select></label>`, the new-project field with
  `htmlFor="new-project-name"` and the `#new-project-name-hint` slug hint, **moved verbatim** (the
  existing DOM tests find them by `getByLabelText("Import into")` / `"Project name"` — that must keep
  working).
- **New** `screens/import/import-status.tsx` → `ImportStatus` — the existing single region, moved
  verbatim: `className="import-status"`, `aria-live="polite"`, `aria-busy`, the busy sentence +
  `import.mayStopResponding`, the error, the result summary, the per-conversation failure list and the
  excluded-from-packs notice. Takes `statusRef: RefObject<HTMLDivElement | null>` as a plain prop
  (React 19 — no `forwardRef` needed).
- `screens/import/import-screen.tsx` — layout becomes:
  ```tsx
  <div className="screen import">
    <h1/><p className="explainer"/>
    <div className={stage === "listed" ? "import-body" : "import-body single"}>
      <div className="import-main">
        {/* choose button | format-override buttons | file name + conversationCount + filter input + "Select all" link + <ConversationTable/> */}
      </div>
      <aside className="import-rail">
        {stage === "listed" && <>{file name} {detected format} {selected count} <DestinationPicker/></>}
        <ImportStatus … statusRef={statusRef} />            {/* ALWAYS mounted, exactly one */}
        {stage === "listed" && <div className="actions">Preview / Import</div>}
      </aside>
    </div>
  </div>
  ```
  **Why the rail element is unconditional:** the status region must stay mounted at every stage (a
  `loadListing` error and the "Reading the file…" busy line appear while `stage === "choose"` —
  `import.dom.test.tsx` cases 4 and 6 depend on it) and `.actions` must still *follow* `.import-status`
  in document order (case 7). `.import-body.single` collapses the grid to one column so the rail does
  not reserve empty width before a file is chosen.
  New state: `const [detectedFormat, setDetectedFormat] = useState<string | null>(null)` set from the
  `result.value.source` that `bridge.import.list` already returns (display only — no new call).
  **Untouched:** `workingRef` single-flight as the first statement of every handler, `beginWork`/`endWork`,
  `await waitForNextPaint()` before the main process blocks, the `scrollIntoView({block:"nearest"})`
  effect, `every control disabled while working !== null` (including the new header checkbox, the
  "Select all" link and the sort button), the `UNSUPPORTED_SOURCE` → `formatOverride` stage,
  `buildPickSpec`'s original-index semantics, `REJECTED_CALL_CODE`, and every catalog string already
  rendered.
- `styles/screens.css` — replace the `.conversation-list`/`.conversation-row` rules with
  `.import-body` (grid: main + 300px rail), `.import-body.single`, `.conversation-scroll`,
  `.conversation-table`, `.conversation-table thead th` (sticky), `.import-rail` (its own
  `overflow-y: auto` so a long failure list scrolls inside it — D-13's rider), `.link-button`.
  **Keep `.import-status`, `.import-status:empty`, `.import-busy`, `.import-failures`,
  `.project-slug-hint` exactly as they are.** Single column below 900px, rail below the table.
- Catalogs: `import.columnTitle` ("Conversation" / "Conversación"), `import.columnDate` ("Date" /
  "Fecha"), `import.columnChunks` ("Estimated items" / "Elementos estimados"),
  `import.selectAllVisible` ("Select all" / "Seleccionar todo"), `import.deselectAllVisible`
  ("Deselect all" / "Deseleccionar todo" — see **D-P8**), `import.fileLabel` ("File" / "Archivo"),
  `import.formatLabel` ("Format" / "Formato"), and the plural-aware
  `import.selectedCount` — EN `{one: "{count} of {total} selected", other: "{count} of {total} selected"}`,
  ES `{one: "{count} de {total} seleccionada", other: "{count} de {total} seleccionadas"}`.
  **N is the total checked count, M (`total`) is the full listing length** (D-12's last rider — the
  number must not change when the user types in the filter).

**New DOM cases** appended to `import.dom.test.tsx` (D-18's "filtered-out selections survive
select-all", the explicitly requested behaviour) — **red first**:
1. a 3-row listing, filter to 1 row, click **Select all** → only visible rows change; clear the
   filter → the previously-checked hidden rows are still checked;
2. the same via the header checkbox, and the header checkbox is `indeterminate` when some but not
   all visible rows are checked;
3. the rail count reads "N of M selected" with M = full listing length while a filter is active;
4. every control (header checkbox, Select all link, row checkboxes, sort button, Preview, Import) is
   disabled while `working !== null`;
5. exactly one element with `aria-live="polite"` exists in the tree at every stage.

---

### Slice 11 — Entry cluster split shell (§5.11, D-20)

**Files**

- **New** `desktop/src/renderer/components/entry-shell.tsx` → `EntryShell({ children })`:
  ```tsx
  <div className="entry-shell">
    {/* D-Q/D-20: a static dark subtree via the existing data-theme mechanism — the same one
        recovery-kit.tsx uses. No new custom property; this file must never import theme-context. */}
    <aside className="entry-brand" data-theme="dark">
      <BrandMark /> <span>{t("common.appName")}</span>
      <p>{t("entry.tagline")}</p>
      <ul>{three trust bullets}</ul>
    </aside>
    <div className="entry-content">{children}</div>
  </div>
  ```
- `app.tsx` *(modified)* — the Router wraps the four entry cases (`no-vault`, `creating`, `locked`,
  `upgrade-required`) in `<EntryShell>`. **The four screen files themselves are not touched at all**
  except `locked.tsx`, which is untouched in markup too — its `.settings-gear` moves to the right
  panel's top-right **by CSS**. Every validation path, error copy, routing callback and the single
  renderer→main credential crossing stays byte-identical.
- `styles/layout.css` — `.entry-shell` (grid: fixed-width dark panel + content), `.entry-brand`
  (**plus `border-right: 1px solid var(--color-border)`**, D-20's rider: in the dark app theme the two
  panels are near-identical and the split must stay legible), `.entry-content > .screen`
  (`margin: auto; max-width: 480px; width: 100%` — the centring that `base.css`'s
  `.app-shell > .screen` rule no longer reaches now that the screens are nested),
  `.entry-content .settings-gear` (top-right). Single column below 900px, brand panel above.
- Catalogs: new `entry` namespace — `entry.tagline`, `entry.trustEncrypted`, `entry.trustPassphrase`,
  `entry.trustTools` (proposed text in §5 of this plan's catalog inventory below).
- `app.theme.test.ts` *(modified, additive)* — a third case: `entry-shell.tsx` hardcodes
  `data-theme="dark"` and never imports `theme-context.js`. The two existing cases are untouched; the
  file's docstring gains one sentence recording the second sanctioned static-dark subtree (D-20).

---

### Slice 12 — Relocation wizard: 3-step indicator (§5.9, D-15)

**Files**

- **New** `desktop/src/renderer/state/relocation-steps.ts`:
  ```ts
  export type RelocationStageName = "choose" | "preflight" | "moving" | "moveFailed" | "done";
  export interface RelocationProgress { current: 1 | 2 | 3; inProgress: boolean }
  /** D-15: choose→1 · preflight/moveFailed→2 · moving→2 (in progress) · done→3. Decoration over the existing machine — it can never advance a step the machine has not reached. */
  export function relocationProgress(stage: RelocationStageName): RelocationProgress;
  ```
  The screen calls `relocationProgress(stage.step)`; if `Stage` ever gains a variant, that call stops
  typechecking — the indicator cannot silently drift from the state machine.
- **New** `state/relocation-steps.test.ts` — **red first**: all five stage names; `moving` is step 2
  with `inProgress: true`; only `done` yields 3.
- `screens/relocate-vault.tsx` *(modified)* — an `<ol className="step-indicator">` under the title,
  three `<li>` from `relocate.step1|2|3`, the current one carrying **`aria-current="step"`** (state
  conveyed non-visually with no new catalog key). `PreflightView`'s content is wrapped in one centred
  `<div className="preflight-card">` — **no information added or removed**. The five-stage machine,
  `relocation.preflight`/`move`/`retryClient`, `refusalCopy`, the choose-again path, `DoneView`,
  `envLineFor`, the copy button and `onDone` are untouched. No sidebar: already guaranteed by
  `workspaceChrome({screen:"relocate-vault"}).sidebar === false` from slice 1.
- `styles/screens.css` — `.step-indicator`, `.step-indicator li[aria-current="step"]`,
  `.preflight-card`; the screen reuses the entry cluster's centred visual language
  (`max-width: 560px; margin: auto`).
- Catalogs: `relocate.step1` ("Choose folder" / "Elegir carpeta"), `relocate.step2` ("Review and
  confirm" / "Revisar y confirmar"), `relocate.step3` ("Done" / "Listo").

**Check:** `relocate-vault.dom.test.tsx` passes unmodified (it drives the flow by visible text, all
of which is unchanged).

---

### Slice 13 — Settings: mini-tabs + segmented controls (§5.10, D-16, D-21b)

**Files**

- **New** `desktop/src/renderer/state/tab-navigation.ts`:
  ```ts
  /** Roving-focus arrow-key behaviour for a tablist (ARIA APG): Left/Up previous, Right/Down next, Home/End ends, wrapping; any other key returns the current id unchanged. */
  export function nextTabId<T extends string>(ids: readonly T[], current: T, key: string): T;
  ```
- **New** `state/tab-navigation.test.ts` — **red first**: each arrow, Home/End, wrap at both ends,
  an unrelated key is a no-op, a single-tab list.
- `screens/settings.tsx` *(modified)* — a module-level
  `const SECTIONS = [{ id: "appearance", title: "settings.appearance" }, …] as const` **drives** the
  mini-tab list (D-21b: a fifth tab becomes an addition, not a rewrite — **and no fifth tab is added
  here**). `<div role="tablist">` of `<button role="tab" aria-selected aria-controls tabIndex>` +
  `<div role="tabpanel">`. Theme and language become segmented controls: the **same radio inputs with
  the same three values and the same `onUpdatePreferences` calls**, wrapped in
  `<fieldset className="segmented">` + an `sr-only` `<legend>` reusing the existing section title key
  — no new interaction code and no new preference. The component still imports no bridge, makes no
  IPC call, opens no vault session; the Vault & sync locked-state branch and Help are untouched;
  Close still closes. Mount model unchanged (D-16: full-screen replacement, not a layered modal).
- `styles/screens.css` — `.settings` becomes a bordered centred surface, `.settings-tabs`,
  `.settings-tabs [aria-selected="true"]` (accent **+** left bar), `.segmented`,
  `.segmented label`, `.segmented input:checked + span` (border + weight, not colour alone).
- Catalogs: none.

**Check:** `onboarding-settings.no-session.test.ts` and `diagnostics-entry-points.test.ts` pass
unmodified (the latter greps for `onOpenDiagnostics` and `settings.openDiagnostics` — both survive).

---

### Slice 14 — Recovery kit: banner + gate box (§5.12, §7.2)

**Files**

- `screens/recovery-kit.tsx` *(modified)* — a `<p className="kit-banner">{t("recoveryKit.shownOnceBanner")}</p>`
  **above** the existing `<h1>`, and the acknowledgement `<label>` + confirm `<button>` moved into a
  `<div className="kit-gate">`. **Nothing else.** The once-only mount read, `data-theme="dark"`, the
  absence of a `theme-context` import, the byte-exact `<pre className="kit-text">`, Copy key + its
  clipboard warning, confirm-disabled-until-checked, `setKitText(null)` on dismissal and
  `onAcknowledged` as the only way out all stay.
  **Hard constraint:** `recovery-kit.dom.test.tsx` asserts **exactly two buttons** exist before
  acknowledgement — the banner must be plain text with **no dismiss control**, and the gate box adds
  no button.
- `styles/screens.css` — `.recovery-kit .kit-banner`, `.recovery-kit .kit-gate` (bordered box).
- Catalogs: `recoveryKit.shownOnceBanner` — EN *"This is shown once. It will not appear again."* /
  ES *"Esto se muestra una sola vez. No volverá a aparecer."*

**Check:** `recovery-kit.dom.test.tsx` and `app.theme.test.ts` pass unmodified.

---

### Slice 15 — Onboarding: progress bar + arrow buttons (§5.13)

**Files**

- `screens/onboarding.tsx` *(modified)* — `.slide-dots` becomes
  `<div className="slide-progress" role="progressbar" aria-valuemin={1} aria-valuemax={SLIDE_IDS.length}
  aria-valuenow={current} aria-label={t("onboarding.progressLabel", { current, total })}>` with an
  inner filled bar sized by an inline width percentage (a computed style value, not a token change).
  Back/Next become `<button>` icon buttons flanking the slide, each with an accessible name from the
  **existing** `common.back` / `common.next` keys and an `aria-hidden` arrow icon; the forward arrow
  is absent on the last slide, where **Get started** stays a text button; **Skip** moves to the
  top-right, de-emphasised, present on every slide. `nextSlide`/`previousSlide`, the slide sequence,
  the copy, and "Skip and Get started both call `onDone`" are untouched.
- `styles/screens.css` — `.slide-progress`, `.slide-progress-fill`, `.onboarding-nav`,
  `.onboarding-skip`; drop `.dot`/`.dot.active`.
- Catalogs: `onboarding.progressLabel` — EN *"Slide {current} of {total}"* / ES
  *"Diapositiva {current} de {total}"*.

---

### Slice 16 — Docs + acceptance sweep

- `docs/gui.md` *(modified, same commit as the code per §4.1.8)* — four edits:
  1. **Navigation**: the left sidebar (Dashboard · Search · Connect · Sync, with Lock now and Settings
     at the bottom) and the breadcrumb on the four drill-down screens, replacing the top bar.
  2. **Context pack**: it now shows a readable rendered view by default with a **Raw Markdown**
     toggle, and *Copy and Export are unaffected* — both still produce exactly what
     `valija export <project>` writes.
  3. **Import**: the table, the two select-all affordances, and the rule that they act on the rows the
     filter is currently showing and never change a hidden row's state.
  4. **Project ordering (D-9)**: pinned items are grouped above the rest in the GUI, which
     `valija show` does not do — stated, not hidden, as an explicit amendment of CARDS D-I. Also note
     Search's new split view and that the pack now has two views, as the CARDS §4-Out amendments D-7
     records.
- Walk §9's ~90-item checklist top to bottom against the working app and tick it in the commit
  message (or a scratch note for the reviewer). Confirm the global block mechanically:
  `git diff --stat main...HEAD -- src/ desktop/src/main/ desktop/src/preload/ desktop/src/shared/ipc/ desktop/package.json desktop/src/renderer/styles/tokens.css`
  must be **empty**, and `grep -rn "\-\-color-" desktop/src/renderer/styles/*.css | grep -v tokens.css`
  must show only `var(--color-…)` *uses*, never a declaration.

---

## 2. Test plan, by layer, tied to §9

| Layer | File | What it pins | §9 criterion |
|---|---|---|---|
| Pure (node) | `state/workspace-chrome.test.ts` **new** | trail per view, no active entry on drill-downs, no sidebar on relocation | Shell block, items 4–6 |
| Pure | `state/workspace-nav.test.ts` *(extended)* | the four destinations, in today's order | Shell item 2 |
| Pure | `state/pinned-partition.test.ts` **new** | stable partition, relative order preserved | Project item 3 |
| Pure | `state/search-selection.test.ts` **new** | first-hit default, stale-id fallback | Search item 2 |
| Pure | `state/diagnostic-groups.test.ts` **new** | three sections + non-empty fallback group | Diagnostics items 1–2 |
| Pure | `state/import-selection.test.ts` *(extended)* | visible-only union/difference, indeterminate state, hidden rows preserved, pick-spec unchanged | Import items 4–5, 8 |
| Pure | `state/relocation-steps.test.ts` **new** | stage → step mapping | Relocation item 1 |
| Pure | `state/tab-navigation.test.ts` **new** | tablist arrow/Home/End behaviour | Settings item 2 |
| Source-scan | `app.shell.test.ts` **new** | NavBar gone, one sidebar, chrome derived | Shell item 1 |
| Source-scan | `diagnostics.no-auto-run.test.ts` **unmodified** | no `useEffect`; both probes inside `handleRunChecks` | Diagnostics item 5 |
| Source-scan | `import-entry-points.test.ts` **unmodified** | `const header` block, 4 branches, no `setView` | Dashboard item 3 |
| Source-scan | `app.theme.test.ts` *(one additive case)* | kit stays dark; entry panel is the second sanctioned static-dark subtree | Recovery kit item 3 |
| Catalog | `catalogs.test.ts` **unmodified** | key-path + placeholder + plural parity for all ~33 new keys | Global item 3 |
| DOM | `pack-preview.dom.test.tsx` **new** | **Copy sends the exact original markdown in the rendered view**; raw text equals it | Pack item 2 |
| DOM | `search.dom.test.tsx` **new** | master-detail selection, no re-query, Open project, untrusted content | Search items 1–5 |
| DOM | `import.dom.test.tsx` *(14 existing cases unmodified + 5 new)* | select-all over visible rows, indeterminate, "N of M", disabled-while-working, one live region | Import items 3–7 |
| DOM | `project.dom.test.tsx` *(1-line prop removal, commented)* | `ItemCard` unchanged in every respect | Project item 4 |
| DOM | `recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx` **unmodified** | the kit gate; the relocation machine | Kit item 3, Relocation item 3 |
| Scan | `no-network-surface.test.ts` **unmodified** | no `xmlns="http://…"`, no `setInterval`, no `url(scheme)` in CSS | Global item 5 |

**Two testing constraints the implementer must not fight:**

1. **jsdom does not lay out** (`scrollHeight === 0`, no measured pixels). Nothing here asserts a
   sticky header, a column count or a breakpoint. Those four things are **review-by-eye** and must be
   named as such in the commit message: sticky import header, 2-column dashboard at ~1120px, the
   900px collapse of all four two-column layouts, and the sidebar not scrolling with content.
2. **`no-network-surface.test.ts` scans `.test.tsx` too** (it only excludes `*.test.ts`). A new DOM
   test must not contain the literal string `http://` or `https://` outside a `//` comment line —
   including in a fixture asserting that an SVG carries no `xmlns`. Assert the *absence* of the
   attribute name, never the URL.

---

## 3. Security-sensitive order of operations

No key, no keychain call, no crypto and no data at rest is touched. The risk is entirely in what the
window shows and promises (§7). Do these in this order, and never "clean up" past them:

1. **Pack (slice 6): write the DOM test before the rendered view exists.** The property is
   byte-identity between what Copy/Export send and `bridge.content.pack`'s `markdown`. Implement the
   rendered view as a *pure read* of the same state variable — never a `setState` round-trip, never a
   read back out of the DOM, never a re-serialisation. If the test is written after the feature, it
   will be written to fit whatever the feature does.
2. **Recovery kit (slice 14): add markup around the gate, never inside it.** Run
   `recovery-kit.dom.test.tsx` *before* the edit (green) and immediately after. Two buttons before
   acknowledgement, one checkbox, no links, no route out.
3. **Import (slice 10): `workingRef.current !== null` stays the first statement of every handler**,
   `beginWork` stays before `await waitForNextPaint()`, `endWork` stays in a `finally`, and the new
   controls (header checkbox, Select all link, sort button) are added to the
   `disabled={working !== null}` set in the same edit that adds them — not afterwards. Exactly one
   `aria-live` region, mounted unconditionally, at every stage.
4. **Diagnostics (slice 8): no `useEffect` may enter the file.** Grouping is computed during render.
   Run `diagnostics.no-auto-run.test.ts` at the end of the slice, before committing.
5. **Icons/CSS (slice 2 and every slice after it): run `no-network-surface.test.ts`** after adding any
   `<svg>` or CSS rule. No `xmlns`, no `url(http…)`, no remote font, no `setInterval`.
6. **Nothing new is persisted, ever.** `preferences-write.ts`, `app-preferences.ts` and the four-key
   preferences file are **not** in any slice's file list. Selected search hit, pack view mode, Settings
   tab, chip selection, checked import rows and sidebar state are component state only — persisting any
   of them would write vault metadata (project names, item ids, file names) into a plaintext file
   outside the vault (§7.4).
7. **Untrusted content** (search hit content, pack markdown) reaches the DOM only through
   `MarkdownContent`. No `dangerouslySetInnerHTML`, no `innerHTML`, no `DOMParser`, no `<a>`/`<img>`/
   `<iframe>`, no `style` attribute derived from content. The search preview is truncated by **CSS**,
   not by slicing the string (cosmetic, never a hiding claim — §7.5).
8. **No new polling.** No `setInterval`, no new `useEffect` that refreshes on a timer. Data still
   refreshes on mount, on user action and on window focus (`wireFocusRefresh`) — a sidebar that polled
   status would silently defeat idle auto-lock (§7.7).
9. **No new capability.** No resolve/merge/delete affordance on Sync (§7.10), no field that can set
   `VALIJA_HOME`/`VALIJA_STATE_HOME`/`VALIJA_AUTOLOCK_MINUTES` in Settings (§7.12), no fifth tab, no
   curation, no filter input on the Dashboard.
10. **Colour is never the only signal** (§7.13): `aria-current` on the active nav entry and the
    selected search row, `aria-pressed` on the pack toggle, `aria-sort` on the date column, a real
    `indeterminate` on the header checkbox, `aria-current="step"` on the relocation indicator, and the
    status **word** beside every diagnostics dot.

---

## 4. Repo structure after execution

Only `desktop/src/renderer/**`, the two catalogs and `docs/gui.md` change. `src/**`,
`desktop/src/main/**`, `desktop/src/preload/**`, `desktop/src/shared/ipc/**`, `desktop/package.json`
and `styles/tokens.css` are untouched (shown for contrast, elided where unchanged).

```
valija/
├── advances/GUI-LAYOUT/
│   ├── idea.md                      (unchanged)
│   ├── refined.md                   (unchanged)
│   ├── plan.md                      ← this file
│   └── review.md                    (written by change-reviewer, later)
├── docs/gui.md                      ~ updated (slice 16)
├── src/**                           UNTOUCHED — zero files
└── desktop/
    ├── package.json                 UNTOUCHED — no dependency added (D-1)
    └── src/
        ├── main/**                  UNTOUCHED (incl. windows/main-window.ts, CSP, no minWidth — D-4 Opt 1)
        ├── preload/**               UNTOUCHED
        ├── shared/
        │   ├── ipc/messages.ts      UNTOUCHED
        │   └── i18n/catalogs/
        │       ├── en.ts            ~ +33 keys, 1 amended (pack.notTranslatedNotice, D-10)
        │       └── es.ts            ~ same 33 keys, same amendment
        └── renderer/
            ├── app-main.tsx         ~ + import "./styles/layout.css"
            ├── app.tsx              ~ Workspace renders the sidebar + breadcrumb; EntryShell wraps
            │                          the four entry cases; SearchScreen gains onOpenProject;
            │                          Project/PackPreview lose onBack
            ├── app.theme.test.ts    ~ + one case (entry-shell's static dark subtree)
            ├── app.shell.test.ts    + NEW (source-scan: NavBar gone, one sidebar)
            ├── components/
            │   ├── nav-bar.tsx      — DELETED
            │   ├── workspace-sidebar.tsx   + NEW  (WorkspaceSidebar)
            │   ├── breadcrumb.tsx          + NEW  (Breadcrumb)
            │   ├── entry-shell.tsx         + NEW  (EntryShell — static data-theme="dark" panel)
            │   ├── icons.tsx               + NEW  (~10 inline SVGs, aria-hidden, no xmlns)
            │   ├── item-card.tsx           UNCHANGED
            │   └── markdown-content.tsx    UNCHANGED
            ├── content/                    UNCHANGED (light-markdown, long-content)
            ├── screens/
            │   ├── dashboard.tsx           ~ card icon only; `const header` block byte-identical
            │   ├── project.tsx             ~ chip row, pinned grouping, no Back button
            │   ├── search.tsx              ~ master-detail split, onOpenProject
            │   ├── pack-preview.tsx        ~ rendered/raw toggle, one toolbar, no Back button
            │   ├── connect-tools.tsx       ~ card grid + always-visible rail (stepsOpen removed)
            │   ├── diagnostics.tsx         ~ grouped table + toolbar (still zero useEffect)
            │   ├── sync.tsx                ~ stat cards + banner + header actions
            │   ├── relocate-vault.tsx      ~ 3-step indicator + centred preflight card
            │   ├── settings.tsx            ~ mini-tabs + segmented controls (four sections)
            │   ├── recovery-kit.tsx        ~ once-only banner + bordered gate box
            │   ├── onboarding.tsx          ~ progress bar + arrow icon buttons + top-right Skip
            │   ├── no-vault.tsx            UNCHANGED (wrapped by EntryShell in app.tsx)
            │   ├── create-vault.tsx        UNCHANGED (wrapped)
            │   ├── locked.tsx              UNCHANGED (wrapped; gear repositioned by CSS)
            │   ├── migration-confirm.tsx   UNCHANGED (wrapped)
            │   ├── import.tsx              — DELETED (moved into import/)
            │   ├── import/                 + NEW screen-local folder (§8 "prefer splitting… a screen-local folder")
            │   │   ├── import-screen.tsx        + NEW  (ImportScreen: state, guards, handlers, layout)
            │   │   ├── conversation-table.tsx   + NEW  (ConversationTable: sticky header, select-all, sort)
            │   │   ├── destination-picker.tsx   + NEW  (DestinationPicker: project select + new-name + slug hint)
            │   │   └── import-status.tsx        + NEW  (ImportStatus: the single aria-live region)
            │   ├── import-entry-points.test.ts        UNCHANGED (must pass as-is)
            │   ├── diagnostics.no-auto-run.test.ts    UNCHANGED (must pass as-is)
            │   ├── diagnostics-entry-points.test.ts   UNCHANGED
            │   ├── onboarding-settings.no-session.test.ts  UNCHANGED
            │   └── __dom-tests__/
            │       ├── recovery-kit.dom.test.tsx   UNCHANGED
            │       ├── relocate-vault.dom.test.tsx UNCHANGED
            │       ├── project.dom.test.tsx        ~ one prop removed, commented
            │       ├── import.dom.test.tsx         ~ import path + 5 new cases (14 existing untouched)
            │       ├── search.dom.test.tsx         + NEW
            │       └── pack-preview.dom.test.tsx   + NEW
            ├── state/
            │   ├── workspace-nav.ts        ~ + NavDestination, NAV_DESTINATIONS
            │   ├── workspace-nav.test.ts   ~ + one case
            │   ├── workspace-chrome.ts     + NEW  (workspaceChrome: sidebar · active · trail)
            │   ├── workspace-chrome.test.ts+ NEW
            │   ├── pinned-partition.ts     + NEW  (partitionPinnedItems)
            │   ├── pinned-partition.test.ts+ NEW
            │   ├── search-selection.ts     + NEW  (selectedHit)
            │   ├── search-selection.test.ts+ NEW
            │   ├── diagnostic-groups.ts    + NEW  (groupDiagnosticRows)
            │   ├── diagnostic-groups.test.ts + NEW
            │   ├── relocation-steps.ts     + NEW  (relocationProgress)
            │   ├── relocation-steps.test.ts+ NEW
            │   ├── tab-navigation.ts       + NEW  (nextTabId)
            │   ├── tab-navigation.test.ts  + NEW
            │   ├── import-selection.ts     ~ + visibleSelectionState, toggleVisibleSelection
            │   ├── import-selection.test.ts~ + 6 cases
            │   ├── diagnostic-rows.ts / diagnostic-detail.ts / project-slug.ts / next-paint.ts /
            │   │   focus-refresh.ts / session-state.ts / overlay-nav.ts / unlock-outcome.ts /
            │   │   preferences-write.ts / create-vault-validation.ts / lock-aware-bridge.ts /
            │   │   bridge.ts / i18n-context.tsx / theme-context.tsx        ALL UNCHANGED
            └── styles/
                ├── tokens.css      UNTOUCHED — byte-identical, no new custom property
                ├── base.css        ~ .nav-bar* rules removed; one comment updated
                ├── layout.css      + NEW (shell: sidebar, breadcrumb, entry split, the 900px breakpoint)
                └── screens.css     ~ per-screen sections rewritten in place, one per screen
```

**Placement check (CLAUDE.md "no bare files at a layer's root", step 9a).** The renderer is a delivery
adapter, not a bounded context with `domain/application/infra`; its kind-folders are `components/`,
`screens/`, `state/`, `content/`, `styles/`, `testing/`. Every new file lands in the folder that names
its kind — components in `components/`, pure view logic in `state/`, the new stylesheet in `styles/`,
Import's parts in a screen-local folder under `screens/` — exactly as §8 of `refined.md` prescribes.
No new *kind* of object is introduced, so no new subfolder is needed beyond `screens/import/`.

**Naming check (step 9).** `parseX`/`createX`/`XUseCase`/`xxxErr` are `src/**` conventions and do not
apply here; the renderer's established conventions are kebab-case module files, camelCase pure
functions named after what they return (`diagnosticRows`, `buildPickSpec`, `previewProjectSlug`,
`autoTourOverlay`), PascalCase components named after what they are (`NavBar`, `ItemCard`,
`MarkdownContent`). The new names follow that: `workspaceChrome`, `partitionPinnedItems`,
`selectedHit`, `groupDiagnosticRows`, `relocationProgress`, `nextTabId`, `visibleSelectionState`,
`toggleVisibleSelection`; `WorkspaceSidebar`, `Breadcrumb`, `EntryShell`, `ConversationTable`,
`DestinationPicker`, `ImportStatus`. Ubiquitous language is taken from `refined.md` itself — *shell*,
*chrome*, *breadcrumb trail*, *destination*, *drill-down*, *rail*, *entry cluster*, *pinned*,
*conversation*, *listing*, *stage*, *step* — not invented. Two names worth Oscar's eye are in §8
(**D-P9**).

---

## 5. New catalog keys (exact inventory — both files, same commit)

33 new keys + 1 amended. Every one lands in `en.ts` **and** `es.ts` in the same commit;
`catalogs.test.ts` enforces key-path, placeholder and plural parity mechanically, and `es.ts`'s
`: Catalog` annotation makes a miss a typecheck failure.

| Namespace | Keys | Slice |
|---|---|---|
| `shell` *(new)* | `primaryNav`, `breadcrumb` | 2 |
| `project` | `pinnedSection`, `otherItems`, `typeFilterLabel` | 4 |
| `search` | `openProject`, `noSelection` | 5 |
| `pack` | `viewRendered`, `viewRaw`, **amended** `notTranslatedNotice` | 6 |
| `diagnostics` | `sectionSystem`, `sectionVault`, `sectionTools`, `sectionOther` | 8 |
| `sync` | `fileState`, `autoLockTitle`, `generationTitle` | 9 |
| `import` | `columnTitle`, `columnDate`, `columnChunks`, `selectAllVisible`, `deselectAllVisible`, `fileLabel`, `formatLabel`, `selectedCount` *(plural)* | 10 |
| `entry` *(new)* | `tagline`, `trustEncrypted`, `trustPassphrase`, `trustTools` | 11 |
| `relocate` | `step1`, `step2`, `step3` | 12 |
| `recoveryKit` | `shownOnceBanner` | 14 |
| `onboarding` | `progressLabel` *(`{current}`, `{total}`)* | 15 |

Proposed `entry` copy (new user-facing prose — worth Oscar's eye at Gate P):
EN — tagline *"Your AI context, encrypted and on your machine."*; bullets *"End-to-end encrypted on
this machine."* / *"You hold the passphrase — there is no reset."* / *"Works with Claude, ChatGPT and
Cursor."*
ES — *"Tu contexto de IA, cifrado y en tu equipo."*; *"Cifrado de extremo a extremo en este equipo."* /
*"Tú tienes la frase de contraseña; no hay forma de restablecerla."* / *"Funciona con Claude, ChatGPT
y Cursor."*

Rules applied to all of them (D-19): no sentence assembled by concatenation, counts through a plural
form, nothing user-visible hardcoded in a component, every icon-only control named from a key, one
neutral Latin-American Spanish with "tú" forms.

---

## 6. Assumptions (each one a place this plan could be wrong)

1. **`feat/desktop-GUI`'s HEAD is the tree I read today.** `import.tsx` is 382 lines and carries the
   slug hint; `connect-tools.tsx` still has the `stepsOpen` disclosure and a boolean `connected`;
   CONNECT has not landed. If anything has landed since, slices 7 and 10 need re-reading first.
2. **CONNECT is the only approved-but-unlanded advance touching these files.** Derived from
   `advances/*/review.md` presence: CONNECT has a plan and no review; IMPORT-FEEDBACK and
   PROJECT-NAME-SLUG were fast-tracked and their code is visibly in the tree.
3. **Removing `onBack` from `ProjectScreen`/`PackPreviewScreen` is within §4.3's "callback names may
   change, destinations may not."** If Oscar reads §4.3 as "keep the props and have the breadcrumb
   call them", slice 2 changes shape (and `project.dom.test.tsx` needs no edit).
4. **The `<h2>` section labels on the Project screen do not disturb `project.dom.test.tsx`.** It
   queries `ul.item-list li.item-row` and `findAllByRole("listitem")`, both of which tolerate two lists.
5. **Biome's recommended a11y rules accept `role="tablist"`/`role="tab"`/`role="progressbar"` and
   `aria-hidden` SVGs**, and would flag `role="radiogroup"` on a `<div>` — which is why the chip row
   and the segmented controls use `<fieldset>`+`<legend>` instead. If lint disagrees in either
   direction, the fix is markup-local and does not change behaviour.
6. **React 19's ref-callback form sets `indeterminate` without a `useEffect`.** If it misbehaves, the
   fallback is a `useEffect` **in `conversation-table.tsx`** — never in `diagnostics.tsx`.
7. **The window is ~1120px wide at the reference size** and 220px is an acceptable sidebar width, so
   `minmax(320px, 1fr)` yields exactly 2 dashboard columns there (arithmetic in slice 3).
8. **`detectedFormat` may be displayed.** §3.3 step 16 lists "detected format" in the rail; the value
   already comes back from `bridge.import.list` as `result.value.source` and is currently discarded.
   Showing it is display of data already in hand, not a new capability or a new call.
9. **Unused catalog keys are harmless** if Oscar declines D-P7; no test asserts key usage.
10. **jsdom's `scrollIntoView` stays absent/no-op**, so the existing optional-call form
    (`statusRef.current?.scrollIntoView?.(…)`) keeps working after the move into the rail.
11. **`docs/gui.md` has no screenshots that must be regenerated** for this advance (its `## Screenshots`
    section is the one place that could contradict a new layout — the implementer checks it in slice 16
    and reports if it does).

---

## 7. Risks

1. **The stated biggest risk (§11): a layout rewrite silently drops a behaviour no layout test can
   see.** Mitigation is structural and already in the slices: the three structural tests stay
   *unmodified* (slices 3, 8, 14), the four existing DOM tests keep passing, three new DOM tests cover
   what this advance invents, and each slice's "does not change" list is copied from §5 into its commit
   message so the reviewer diffs intent against behaviour.
2. **Import is 40% of the risk in 15% of the slices.** The 10a → 10b → 10c split exists precisely so a
   red test says *which* of "the policy", "the move" or "the new UI" broke.
3. **Merge collisions with CONNECT** — see D-P2. `components/nav-bar.tsx` is **deleted** here and
   **edited** by CONNECT's slice 3; that is a delete/modify conflict, not a text conflict, and needs a
   human decision whichever way it lands.
4. **The pack notice amendment (D-10) is the one deliberate copy change** in an advance whose §4.2
   forbids copy rewrites. If the proposed sentence is wrong, it is wrong in a security-adjacent place
   (§7.1). It is in §8 for Oscar to approve or replace.
5. **D-9's pinned grouping is the only user-visible ordering change** and amends CARDS D-I. Cheap to
   reverse now (drop the partition and the two labels), awkward after it ships. Gate R already
   confirmed it; slice 4 keeps it to one pure function + two `<h2>`s so reversing stays a small diff.
6. **CSS volume.** ~800 of the ~2,300 production lines are CSS across two files, none of it covered by
   a test. Keeping `layout.css` strictly shell-level and `screens.css` strictly one-section-per-screen
   (D-17) is what keeps it reviewable; a rule that does not belong to exactly one of those two homes is
   a smell.
7. **Breadth.** Thirteen screens in one advance means the last slices are the tired ones — which is why
   Recovery kit (14) and Onboarding (15) are the two smallest and most mechanically-tested, and why the
   §9 sweep is its own slice rather than a final skim.

**Estimated production lines: ~2,300** (≈1,350 TSX/TS, ≈800 CSS, ≈90 catalog, ≈60 docs), plus
**~850 test lines**. The Import slice's ~300 includes ~230 lines that are *moved*, not written.

---

## 8. Decisions to confirm (Gate P)

Each has a recommended default the implementer will execute if Oscar says nothing beyond "approved".

**D-P1 — Branch name.** *Default: stay on `feat/desktop-GUI`.* The working agreement says
`{feature}/{ADVANCE}` (→ `gui-layout/GUI-LAYOUT`), but every desktop-GUI advance so far explicitly
overrode that, because `main` has no `desktop/` tree and these advances build on each other.
*Trade-off:* a longer shared branch with more unmerged history vs. a branch that starts from an empty
renderer and a guaranteed merge conflict with everything. If Oscar prefers the convention, the branch
must be cut **from `feat/desktop-GUI`**, not from `main`.

**D-P2 — Sequencing against CONNECT (collisions beyond what D-21 flags).** *Default: land GUI-LAYOUT
first; CONNECT re-targets onto the new layout.* CONNECT's approved plan collides at five file-level
points, four more than D-21's three named seams:
(a) **`components/nav-bar.tsx`** — CONNECT slice 3 adds a lock badge to it; **this advance deletes the
file**. CONNECT must re-point at `components/workspace-sidebar.tsx` (the seam D-21a leaves: the
bottom cluster beside Lock now, and a list-driven entry set).
(b) **`screens/locked.tsx`** — CONNECT adds an idle-lock banner above the passphrase form; this advance
wraps the screen in `EntryShell` (no markup change), so the two are mergeable but touch the same file.
(c) **`screens/connect-tools.tsx` + `screens.css`** — CONNECT rewrites the card body for six states and
replaces `.client-status.connected`; this advance restructures the same screen into grid + rail. Slice 7
is deliberately one commit touching one screen so the rebase is small, and keeps per-state classes
rather than a two-state assumption (D-21c).
(d) **`shared/ipc/messages.ts`'s `ToolsStatusEntry.connected` → `presence`** — CONNECT changes the field
this advance's connect screen reads. Whichever lands second adapts one expression.
(e) **`screens/settings.tsx`** — CONNECT adds a fifth section; the mini-tab list is list-driven so that
is an addition, not a rewrite (D-21b) — but it is still the same file.
*Trade-off of the default:* CONNECT's diff gets re-based onto a screen whose markup moved. The reverse
order is worse: CONNECT would land a lock badge into a nav bar this advance then deletes.

**D-P3 — Icon home.** *Default: one `components/icons.tsx` with ~10 tiny components.* Cohesive, and it
puts every `<svg>` in one file so the "no `xmlns`" rule (fact 7) has one place to check.
*Alternative:* `components/icons/` with one file per icon — tidier by CLAUDE.md's instinct, but ten
6-line files. *Trade-off:* a single grab-bag file vs. folder noise.

**D-P4 — Import's screen-local folder.** *Default: move the screen into `screens/import/` as four
files* (`import-screen.tsx`, `conversation-table.tsx`, `destination-picker.tsx`, `import-status.tsx`),
per §8's "prefer splitting a large screen… within a screen-local folder". Costs two import-path edits
(`app.tsx`, the DOM test). *Alternative:* keep `screens/import.tsx` and add siblings — avoids the path
churn but leaves a ~520-line screen or puts non-screen files in `screens/`.

**D-P5 — Workspace screens widen from 720px to 1040px.** *Default: yes* — `.screen`'s 720px cap cannot
hold a two-column split at the reference width, so `layout.css` overrides it for
`.workspace-content > .screen` only (entry screens keep 480px, Settings and the recovery kit keep their
own). *Trade-off:* a visibly wider Dashboard/Project/Diagnostics than today, which §5 implies but never
states. This is the one global measurement change in the advance.

**D-P6 — The amended pack notice (D-10 Option 3).** *Default:* the EN/ES sentences in slice 6, which
promise only that **Copy** sends exactly the raw view's text (not Export, which can produce JSON).
*Alternative:* any wording Oscar prefers; this is security-adjacent copy (§7.1) and is the advance's one
sanctioned copy rewrite.

**D-P7 — `connect.stepsSummary` ("3 steps") loses its render site** when the disclosure goes.
*Default: delete the key from both catalogs* (dead copy is worse than a small diff). *Alternative:* leave
it — no test enforces usage.

**D-P8 — Two labels for the import select-all link.** *Default: add both `selectAllVisible` ("Select
all") and `deselectAllVisible` ("Deselect all"), swapping by state.* D-19's inventory listed one key,
but a control labelled "Select all" that deselects is a small lie, and §3.3 step 15 explicitly makes it
a toggle. *Trade-off:* one key beyond the inventory.

**D-P9 — Two names worth a second opinion.**
(a) `state/workspace-chrome.ts` / `workspaceChrome(view)` bundles *sidebar visibility · active
destination · breadcrumb trail* into one record. *Alternative:* three separate helpers. The bundle wins
because all three answer "where am I" from the same input and are tested in one table.
(b) `components/entry-shell.tsx` / `EntryShell` for §5.11's shared split panel. *Alternatives:*
`EntrySplit`, `EntryPanel` (rejected: sounds like only the left panel).

**D-P10 — `minWidth` on the BrowserWindow stays untaken (D-4 Option 2).** *Default: do not touch
`main/windows/main-window.ts`* — the renderer-only boundary is itself an acceptance criterion. Recorded
here as the recommended one-line follow-up (`minWidth: 900, minHeight: 600`) for the next advance that
touches `main/`.

---

**Implementation must not begin until this file carries an `Approved:` line written by Oscar (or by an
agent solely on his explicit say-so).** The orchestrator halts at Gate P until then.
