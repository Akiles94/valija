# IMPORT-ENTRY — Import is reachable from a non-empty dashboard · Refined Spec

**Status:** Approved at Gate R (Oscar, 2026-09-04) — all defaults confirmed as-is (D-1..D-7),
including D-4 as the source-scan option.
**Type:** Hotfix. Renderer-only, presentation-layer only. No domain, no application, no IPC,
no schema, no crypto, no main-process change.
**Predecessor:** the GUI advance (`advances/GUI/`) — this advance repairs a reachability gap
left by its Slice 9/11 wiring; it does not revise any of its decisions.
**Legend:** each decision below lists the options on the table and a **Default:** line. The
main agent carries these to Oscar at Gate R; nothing here is settled until he says so.

---

## 1. Goal

**Make the *Import your chat history* entry point reachable from the dashboard no matter how
many projects the vault holds** — today it renders only in the `projects.length === 0` branch,
so a user with any content in their vault has no route to `ImportScreen` from the GUI at all.

That is the whole advance. Nothing about the import flow itself, the dashboard's layout, or
the navigation model changes.

---

## 2. User walkthrough — the workflow from the user's perspective

### 2.1 Today (the bug)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 1 | Fresh vault | Unlocks a vault with no content | Dashboard, empty state: **Connect an AI tool** and **Import your chat history** |
| 2 | Imports once | Clicks **Import your chat history**, imports 312 items into `valija` | Import result screen; the vault now has one project |
| 3 | Comes back later | Clicks **Dashboard** in the nav bar | The project-cards list. **Import your chat history is gone.** The nav bar offers Dashboard / Search / Connect tools / Sync — no Import. Settings has no Import either |
| 4 | Gives up | — | The only remaining route to import is `valija import <file>` in a terminal — i.e. the GUI is no longer at CLI parity, which the GUI advance's §1 goal explicitly claims |

The asymmetry that hides the bug: the empty state's *other* action, **Connect an AI tool**,
duplicates a nav-bar destination, so it survives the branch switch. **Import** does not — it is
a drill-down with exactly one entry point, and that entry point lives in the branch a user
leaves the moment the feature works.

### 2.2 After this advance

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 1 | Any dashboard state | Opens **Dashboard** — empty, populated, still loading, or showing a load error | The header reads `Panel` / `Dashboard` with **Import your chat history** and **Check my setup** beside it. Both are present in all four states |
| 2 | Imports again | Clicks **Import your chat history** from a dashboard that already lists projects | The exact same `ImportScreen` the empty state reaches: the explainer, the native file picker, list → filter → sort → select → **Preview** → **Import**. Byte-identical flow, unchanged |
| 3 | Returns | Clicks **Dashboard** in the nav bar | Back on the dashboard, project counts refreshed on focus as they already are |
| 4 | Empty state | A first-run user, zero projects | Unchanged from today: the emptyTitle line plus the **Connect an AI tool** / **Import your chat history** pair (§4.2 step 8 of the GUI spec, and the tour's slide 2, both pin this pair) — *plus* the same header button, per **D-2** |

Example, in terms of what a reviewer clicks:

```
unlock → Dashboard (>=1 project card visible)
       → header: [ Import your chat history ] [ Check my setup ]
       → click Import your chat history
       → ImportScreen (stage "choose": explainer + "Choose a file…")
       → nav bar: Dashboard   # the way back; ImportScreen has no Back button today, and gains none here
```

### 2.3 How the imported data is used afterward — unchanged, and stated so it is not re-litigated

| Surface | Imported items |
|---|---|
| Project item list (type filter `imported`) | shown |
| Search | searchable |
| **Context pack** (GUI, `valija export`, MCP pack responses) | **excluded — `docs/SPEC.md` §10a**, unchanged by this advance |
| MCP tool surface (5 tools + 2 prompts) | **unchanged — no new tool, no new argument** |
| Lineage stamp | one bump per import batch, as `ImportItems` already does — this advance adds no write of any kind |
| `valija` CLI | untouched |

This advance moves a button. It changes **no** row of that table.

---

## 3. Context snapshot (load-bearing facts a planner must not contradict)

- `/home/user/valija/desktop/src/renderer/screens/dashboard.tsx` has **four return branches**:
  error (67–74), loading (76–83), empty (85–100), populated (102–129). A shared `header`
  element (58–65) — `<h1>` plus one **Check my setup** button — is interpolated into all four.
  `onImportHistory` is called from exactly one place: line 94, inside the empty branch's
  `<div className="actions">`.
- `/home/user/valija/desktop/src/renderer/app.tsx` line 323 wires
  `onImportHistory={() => setView({ screen: "import" })}`, and line 328 mounts the single
  `<ImportScreen bridge={bridge} />`. `WorkspaceView` already carries `{ screen: "import" }`.
- `/home/user/valija/desktop/src/renderer/components/nav-bar.tsx` has exactly four top-level
  destinations (dashboard, search, connect-tools, sync) plus lock and the settings gear. Its
  own doc comment, `workspace-nav.ts`'s doc comment, and `app.tsx`'s `Workspace` comment all
  agree — three times over — that **import is a drill-down, not a nav destination**. That is a
  prior decision, not an oversight.
- `ImportScreen` takes only `{ bridge }` — **no `onBack`**. The return path is the nav bar.
- i18n keys already exist in both catalogs: `dashboard.importHistory`
  (`en.ts:94` "Import your chat history" / `es.ts:95` "Importar tu historial de chats") and
  `dashboard.checkMySetup` (`en.ts:95` / `es.ts:96` "Revisar mi configuración").
  `catalogs.test.ts` enforces en/es key-set and placeholder parity in both directions.
- Styling: `.dashboard-header` (`styles/screens.css:4–9`) is
  `display:flex; align-items:center; justify-content:space-between; gap:16px` with **two**
  children today. `.actions` (`styles/base.css:163–167`) is `display:flex; gap:8px;
  margin-top:16px`.
- **Existing test that must keep passing:**
  `/home/user/valija/desktop/src/renderer/screens/diagnostics-entry-points.test.ts:27–34`
  asserts `dashboard.tsx` contains exactly **four** `{header}` interpolations, and (lines
  22–25) that it mentions `onCheckSetup` and `dashboard.checkMySetup`. Any fix that
  restructures the branches breaks this test.
- **Prior testing decisions that bind this advance:** GUI plan **P-D5** confines jsdom/DOM
  tests to exactly two screens (`recovery-kit.tsx`, `relocate-vault.tsx`) — "not a blanket
  DOM-testing policy". **P-D11** chose a source-scanning test, explicitly *instead of* a third
  jsdom test, for precisely this question (a dashboard entry point's wiring). See **D-4**.
- `docs/gui.md` §"Importing your chat history" (lines 165–172) describes the feature but never
  says where the button lives; §"Diagnostics" (176–182) does name its two entry points.
- There are **no other tests and no screenshots** that depend on the dashboard's markup.

---

## 4. Open decisions (defaults chosen; Gate R confirms or overrides)

### D-1 — Where the always-visible entry point goes

- **Option 1 — the dashboard header** (`header`, dashboard.tsx:58–65), beside **Check my
  setup**. It already renders in all four branches for exactly this reason (GUI item 89a: "a
  header that shows in every branch it already has"). One file, ~4 lines of JSX, one small CSS
  rule. Reuses a pattern the codebase already committed to.
- **Option 2 — a fifth nav-bar destination.** Contradicts three doc comments and the GUI spec's
  navigation model (import is a drill-down); would also require `NavBar`'s `onNavigate` union
  and `active` handling to change, plus a nav label key. Bigger blast radius, re-opens a settled
  decision.
- **Option 3 — repeat the `.actions` block in the populated branch.** Duplicated markup in one
  file, and still absent from the loading and error branches.
- **Option 4 — an entry point on the project screen** ("import into this project"). A different,
  larger feature (pre-selected target project); out of the hotfix's scope.
- **Default: Option 1.** Smallest change, uses the header contract item 89a already
  established, and fixes all four branches at once rather than one.

### D-2 — Does the empty state keep its own Import button?

- **Option A — keep it (button appears twice on the empty dashboard).** The GUI spec pins the
  empty state's pair: §4.2 step 8 ("two next steps that are both reachable in-app"), and D-U(c)
  requires the tour's slide 2 to point at *the same two*. Keeping it means the hotfix contradicts
  nothing and the diff is purely additive. Cost: on an empty vault the same label shows twice.
- **Option B — remove it from the empty state, header only.** One instance, cleaner empty state.
  Cost: silently narrows a spec'd first-run affordance and desynchronises the empty state from
  the tour's slide 2 — a copy/UX decision this hotfix has no mandate to make.
- **Default: Option A (keep both).** Additive-only is the right shape for a hotfix; the
  duplication is visible on the empty dashboard only, and mirrors the precedent that Diagnostics
  is deliberately reachable two ways. If Oscar dislikes the duplication, Option B is a one-line
  deletion and needs no other change here.

### D-3 — Label for the header button

- **Option A — reuse `dashboard.importHistory`** ("Import your chat history" / "Importar tu
  historial de chats"). No catalog change, no new translation, and identical text makes it
  obvious the two buttons (D-2 Option A) are the same action.
- **Option B — a new short key** (e.g. `dashboard.importHistoryShort` → "Import history" /
  "Importar historial"). Fits a header better; costs two catalog entries in both `en.ts` and
  `es.ts` (parity is machine-checked, so the risk is nil but the copy is new and unreviewed).
- **Default: Option A.** Zero new copy is the correct default for a hotfix; the Spanish label is
  the longer of the two and still fits the header at the app's minimum window width.

### D-4 — How the fix is proven by test

- **Option A — a new source-scan test**, e.g. `screens/import-entry-points.test.ts`, in the
  established idiom of `diagnostics-entry-points.test.ts`: assert that `dashboard.tsx`'s
  `header` block mentions `onImportHistory`/`dashboard.importHistory` (by slicing the source
  between `const header = (` and its close, so a match inside the empty branch cannot satisfy
  it), that `{header}` still appears **4** times, and that `app.tsx` mounts exactly one
  `<ImportScreen`. Consistent with P-D5 and P-D11. Proves the wiring, not the pixels.
- **Option B — extend `diagnostics-entry-points.test.ts`.** Fewer files, but the file's name and
  its docblock are about Diagnostics; import assertions there are misfiled.
- **Option C — a jsdom DOM test** rendering `DashboardScreen` with a fake bridge returning one
  project row and asserting the Import button is in the document. This is the only option that
  proves the actual bug (a *rendered branch*) rather than source text. Cost: reverses P-D5 for a
  third screen and overrides P-D11 on the very question P-D11 answered; needs a full fake
  `ValijaBridge` (~40 lines, as `relocate-vault.dom.test.tsx` shows).
- **Default: Option A**, with the header-slice assertion (not a bare `toContain`) so the test
  would have failed against today's code. Trade-off accepted and named: a source scan cannot see
  a rendering regression. **Oscar should override to Option C if he wants the regression itself
  under test rather than its wiring** — that is the one place this hotfix trades rigour for
  respecting a prior decision.

### D-5 — Header layout with two buttons

- `.dashboard-header` is `justify-content: space-between`; a third child would spread `h1`,
  Import and Check-my-setup across the full width and read as broken.
- **Option A — wrap the two buttons in a group element** with a new rule
  (`.dashboard-header .header-actions { display:flex; gap:8px; }`), ~3 lines in
  `styles/screens.css`, `.dashboard-header` untouched.
- **Option B — reuse the existing `.actions` class inside the header** plus a
  `margin-top: 0` override — reuses a class but the override is a smell and `.actions` is
  semantically the "next steps" row.
- **Option C — no wrapper**, accept the spread layout. Rejected on sight.
- **Default: Option A.**

### D-6 — Button order inside the header group

- **Option A — Import first, Check my setup last.** Check my setup keeps its current position at
  the far right; nothing a user already knows moves.
- **Option B — Check my setup first, Import last.** Puts the newly-important action closest to
  the edge; moves an existing control.
- **Default: Option A.**

### D-7 — Docs

- **Option A — one clause in `docs/gui.md` §"Importing your chat history"** naming the entry
  point ("…reachable from the dashboard header at any time, empty vault or not"), matching how
  the Diagnostics section already names its two entry points. Honours CLAUDE.md's "docs ship in
  the same commit as the code".
- **Option B — no doc change**; the doc never claimed a location, so nothing is factually wrong.
- **Default: Option A**, one sentence, no restructuring of the page.

---

## 5. Scope

### In scope

- `desktop/src/renderer/screens/dashboard.tsx` — the header gains an Import action wired to the
  **existing** `onImportHistory` prop.
- `desktop/src/renderer/styles/screens.css` — one grouping rule (D-5).
- One new (or extended) renderer test proving reachability (D-4).
- One sentence in `docs/gui.md` (D-7).

### Explicitly out of scope / deferred

| Deferred | Why |
|---|---|
| A nav-bar entry for Import | Contradicts the settled "import is a drill-down" model (D-1 Option 2). A navigation-model change deserves its own advance |
| An `onBack` prop on `ImportScreen` | Real gap, but a separate one — the nav bar already provides a way back. Not this advance |
| Nav-bar `active` state while on a drill-down (no item highlights on import/project/diagnostics) | Pre-existing, cosmetic, unrelated |
| Any change to the import flow: file picking, format detection, selection, preview, run | Untouched. Not one line of `import.tsx` |
| Dashboard redesign, empty-state copy rewrite, tour slide-2 copy | Oscar's explicit instruction: minimal hotfix |
| An "import into this project" entry point on the project screen | Different feature (pre-selected target) |
| Anything in `src/` — use cases, IPC channels, preload API, zod schemas, main process | This advance adds **no** channel and touches **no** trust boundary |

---

## 6. Acceptance criteria

A reviewer can verify each of these against the diff and a running app.

- [ ] From a dashboard showing **at least one project card**, the Import entry point is visible
      and clicking it lands on `ImportScreen` (`view.screen === "import"`).
- [ ] The same entry point is visible in the **empty**, **loading**, and **error** dashboard
      branches — i.e. it lives inside the shared `header`, not in any single branch.
- [ ] The empty state still offers the **Connect an AI tool** / **Import your chat history**
      pair (per D-2 Option A) — or, if Oscar picks Option B, only Connect, and the change is
      recorded as a deliberate departure from GUI §4.2 step 8.
- [ ] `dashboard.tsx` still has exactly **four** `{header}` interpolations — the existing
      assertion in `diagnostics-entry-points.test.ts:27–34` passes untouched.
- [ ] `app.tsx` still mounts exactly **one** `<ImportScreen`, and `dashboard.tsx` still receives
      `onImportHistory` as a prop — the dashboard navigates through a caller-supplied callback
      and never imports `bridge.js` or `workspace-nav`.
- [ ] No new i18n key (D-3 Option A), or, if Option B, both catalogs gain it and
      `catalogs.test.ts` parity passes.
- [ ] A test exists that **fails against the pre-fix `dashboard.tsx`** and passes after — not a
      bare `toContain("onImportHistory")`, which the old file already satisfies.
- [ ] `npm run typecheck && npm run lint && npm run test` are green, in the repo root and in
      `desktop/` as the project's scripts require.
- [ ] The diff touches **no** file under `src/`, no `desktop/src/main/**`, no
      `desktop/src/shared/ipc/**`, and no `package.json`.
- [ ] The two header buttons render as a group at the right of the header, not spread across it
      (D-5), and **Check my setup** has not moved (D-6).
- [ ] Both languages render without the header wrapping or clipping at the app's default window
      size — check `es` (the longer label) explicitly.
- [ ] `docs/gui.md` states where the Import entry point lives (D-7 Option A).

---

## 7. Security-sensitive surfaces — what must not weaken

This change is presentation-only, and the review should confirm that literally:

- **No new IPC channel, no preload API change, no zod schema change.** The renderer's
  `ValijaBridge` surface is a closed, enumerated list; this advance adds nothing to it.
- **No filesystem path originates in the renderer.** The import file handle still comes from
  `bridge.dialog.chooseImportFile()` — a native dialog the **main** process opens and keeps.
  Moving a button must not introduce a path string in renderer code.
- **No vault session, no key material, no keychain access** is created, held, or observed by the
  dashboard header. The dashboard opens no `Database` handle; it calls `bridge.content.projects()`
  and nothing else.
- **No new write path.** The advance creates zero vault writes and zero lineage bumps. Import
  still routes through the single `ImportConversations` → `ImportItems` path, once, from
  `ImportScreen`.
- **MCP surface unchanged**: 5 tools + 2 prompts, no new tool, no new argument, no new transport.
- **No network call, no telemetry, no URL opened** (`SPEC.md` §9) — an added button must not
  bring a link with it.
- **Imported items stay excluded from context packs** (`SPEC.md` §10a). Making import easier to
  reach must not be paired with any change to that exclusion.

---

## 8. Architecture notes (clean architecture / DDD / hexagonal)

- The fix lives entirely in the **renderer presentation layer**. `DashboardScreen` is a view: it
  receives navigation as callbacks (`onImportHistory`, `onCheckSetup`, `onSelectProject`,
  `onConnectTool`) and never decides where to go. **Keep it that way** — the fix must not
  introduce `setView`, a router import, or `bridge.js` into `dashboard.tsx`.
- **No new prop is needed.** `onImportHistory` already exists on the component's interface and is
  already wired in `app.tsx:323`. If a planner finds itself changing the component's props, the
  chosen option has drifted from D-1 Option 1.
- **No domain, application, or infra file changes.** There is no port, no use case, no policy, no
  value object involved; a new file under any `domain/`/`application/`/`infra/` folder is a
  signal that scope has crept.
- **File placement:** the only candidate new file is a test beside the screens it guards
  (`desktop/src/renderer/screens/import-entry-points.test.ts`), matching the precedent of
  `diagnostics-entry-points.test.ts`, named for what it guards. No bare file at a layer root.

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **A source-scan test (D-4 Option A) cannot see a rendering regression** — the same class of gap this advance is fixing could recur and pass CI | **Highest** | Assert on the sliced `header` block (so the test fails against today's code) plus the `{header}` count of 4. Escalate to D-4 Option C at Gate R if Oscar wants the branch itself under test |
| Header layout breaks at small widths or in Spanish (longer labels) | Medium | D-5's grouping rule; manual bilingual check listed in the acceptance criteria |
| Scope creep into a nav-bar redesign or an `onBack` for `ImportScreen` | Medium | §5's deferral table; the diff must touch at most four files |
| D-2 Option A leaves a duplicated label on the empty dashboard | Low | Cosmetic, empty state only, and reversible in one line |
| The existing `{header}` count assertion is broken by an over-eager refactor | Low | Named explicitly in §3 and in the acceptance criteria |

---

## 10. Gate R checklist for Oscar

| # | Decision | Default |
|---|---|---|
| D-1 | Where the always-visible entry point goes | Dashboard **header**, beside Check my setup |
| D-2 | Empty state keeps its own Import button | **Yes** — additive only, appears twice on an empty vault |
| D-3 | Label | **Reuse** `dashboard.importHistory`, no new catalog key |
| D-4 | Test form | **Source scan** (`import-entry-points.test.ts`), per P-D5/P-D11 — override to jsdom if the rendered branch should be under test |
| D-5 | Header layout | Wrap both buttons in a grouping element + 3 CSS lines |
| D-6 | Button order | **Import first**, Check my setup stays rightmost |
| D-7 | Docs | One clause in `docs/gui.md` naming the entry point |
