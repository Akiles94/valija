# GUI-LAYOUT — restructuring the desktop app's screen layouts · Refined Spec

**Status:** **Gate R closed** (Oscar, 2026-09-15). Every decision below (D-1 … D-22) is approved as
written, including D-9 (the pinned-item grouping/reordering, confirmed even though it diverges from
`valija show`'s order per CARDS D-I — Oscar: "La D9 si, aunque cambie lo anterior"). All other
defaults confirmed as-is, no changes requested. Nothing here is implementation.

**Directory:** `GUI-LAYOUT` — a UI-structure advance, deliberately not a milestone number (same
posture as `GUI`, `CARDS`, `CONNECT`, `IMPORT-FEEDBACK`).
**Source idea:** `advances/GUI-LAYOUT/idea.md` — captured from an interactive, screen-by-screen
design review with Oscar against a wireframe canvas
(`https://claude.ai/artifact/6TXhfijgqEoNaCtJyPU4fT`, one page per screen, chosen option annotated
"ELEGIDA ✓"). **The planner cannot open that canvas.** §5 of this document restates every structural
decision from it in words; §5 is the layout source of truth for this advance.
**Inherits (and does not reopen):** `advances/GUI/refined.md` §5.1 ("the GUI is a delivery adapter"),
D-A (no curation), D-I (fork is reported, never resolved), D-Q (theme mechanism + the recovery-kit
exception), D-T (plain-language Sync panel vs. support-grade Diagnostics), D-U(b)/(c)/(d) (tour
semantics; Settings is not a config editor), D-V(b)/(d)/(e)/(f)/(g) (catalog-driven copy, byte-pinned
English artifacts, `Intl` formatting, no `src/**` change for localization, one neutral Spanish),
`GUI` §9's byte-identity pins on `renderRecoveryKit`, `manualInstructions()` and
`renderContextPackMarkdown`; `advances/CARDS/refined.md` D-A (the light-Markdown subset), D-E (pure
parser + React adapter), §7 (untrusted-content rendering rules); `advances/IMPORT-ENTRY/refined.md`
D-1/D-6 (Import reachable from every dashboard branch, after it "Check my setup");
`advances/IMPORT-FEEDBACK/refined.md` D-4 (one status region), D-6 (bounded conversation list), D-7
(stale state cleared per run), D-9 (single-flight, never stranded), D-14 (project-name hint).
**Touches exactly one process:** the renderer. See §4.3 for the two prop-wiring exceptions in
`app.tsx` and the single reviewed exception in §6 D-4.

---

## 1. Goal

**Re-lay-out the 13 existing desktop screens onto a persistent left-sidebar shell (workspace), a
shared split-panel shell (entry cluster) and a mini-tabbed Settings panel — changing only the
arrangement, grouping and affordance shape of elements that already exist, without changing a color
or type token, a use case, an IPC message, a stored byte, or what any screen is able to do.**

Three phrases carry the whole scope:

- **"Arrangement, not style."** `tokens.css` is untouched: no color, font, radius or theme-mechanism
  change (D-Q stands). Icons are *new content* added to existing controls, never a new visual
  language and never the only signal for a state.
- **"The same screens, doing the same things."** No screen gains or loses a capability. Every
  `bridge.*` call, every use case, every error path, every guard (single-flight import, no-auto-run
  diagnostics, kit gating, fork non-resolution) survives byte-for-byte in behaviour.
- **"13 screens."** Dashboard, Project detail, Search, Context pack, Connect tools, Import,
  Diagnostics, Sync & safety, Relocation wizard, Settings, the four-screen entry cluster (No vault /
  Create vault / Locked / Migration confirm), Recovery kit, Onboarding tour — plus the shell that
  replaces `components/nav-bar.tsx`.

---

## 2. Ground truth read from the repo (so the planner does not re-derive it)

Every fact below was verified in the current tree. They are constraints, not background.

1. **`components/nav-bar.tsx` is a 55-line horizontal bar** of six plain text buttons (Dashboard /
   Search / Connect / Sync, then `lock-button`, then `settings-gear`), rendered by `app.tsx`'s
   `Workspace` above every unlocked screen. Its styling is 3 rules in `base.css` (`.nav-bar`,
   `.nav-bar .lock-button`, its `:hover`).
2. **`app.tsx` owns all routing.** `WorkspaceView` (`state/workspace-nav.ts`) is a 9-variant union;
   `OverlayState` (`state/overlay-nav.ts`) holds `tour` / `settings` **above** the phase switch.
   **Settings and the tour are full-screen replacements today, not layered modals** — there is no
   backdrop, no focus trap, no Escape handler anywhere in the tree. See D-16.
3. **Only three components exist** (`nav-bar.tsx`, `item-card.tsx`, `markdown-content.tsx`), plus
   pure view-logic modules under `state/` (`diagnostic-rows.ts`, `import-selection.ts`,
   `workspace-nav.ts`, `overlay-nav.ts`, `project-slug.ts`, `next-paint.ts`, …). Pure view logic
   living beside its screen as a tested module is the established pattern.
4. **Styles are three files, imported in order** by `app-main.tsx`: `tokens.css` (8 custom properties
   × 2 themes), `base.css` (layout primitives, `.screen` at `max-width: 720px`, plus the rule that
   vertically centres every standalone `.screen` that is not `.settings`/`.recovery-kit` at
   `max-width: 480px`), `screens.css` (one commented section per screen).
5. **The window is `1100 × 720` with no `minWidth`/`minHeight`** (`main/windows/main-window.ts`), so
   the user can resize it arbitrarily narrow today. The mockups' reference width is ~1120px. See D-4.
6. **CSP is strict and is not in scope**: `default-src 'self'`, `script-src 'self'`,
   `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `connect-src 'none'`; navigation off
   `file:` is denied; `setWindowOpenHandler` returns `deny`.
7. **`main/infra/no-network-surface.test.ts` scans every non-`.test.ts` `.ts`/`.tsx`/`.css` under
   `desktop/src`** for `crashReporter`, `setInterval`, `fetch(`, `XMLHttpRequest`, `http://`,
   `https://`. **Consequence for icons: an inline `<svg>` must not carry
   `xmlns="http://www.w3.org/2000/svg"`** — it would fail the suite. The two existing icons
   (`connect-tools.tsx`'s chevron, `item-card.tsx`'s star) already omit it and are the house style:
   inline `<svg aria-hidden="true">`, `stroke`/`fill="currentColor"`, sized in markup.
8. **Catalog parity is machine-enforced twice**: `es.ts` is typed `Catalog`, and
   `catalogs/catalogs.test.ts` walks both trees for key-path and placeholder parity, and checks
   plural shapes. Any new key lands in `en.ts` **and** `es.ts` in the same commit.
9. **Three existing tests assert *structure* of files this advance rewrites**, and they are
   invariants, not obstacles:
   - `screens/import-entry-points.test.ts` parses `dashboard.tsx` for a literal
     `const header = (` … block, asserts the Import action lives inside it, that
     `onImportHistory` precedes `onCheckSetup`, that `{header}` appears in **exactly four** return
     branches, and that `dashboard.tsx` never mentions `setView`/`workspace-nav`.
   - `screens/diagnostics.no-auto-run.test.ts` asserts `diagnostics.tsx` contains **no `useEffect`
     at all** and that both probe-backed reads happen inside `handleRunChecks`.
   - `app.theme.test.ts` asserts `app.tsx` still renders `data-theme={theme}` from `useTheme()`, and
     that `recovery-kit.tsx` still hardcodes `data-theme="dark"` and never imports the theme context.
10. **DOM tests exist and the P-D5 confinement has already been widened twice**: `__dom-tests__/`
    holds `recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx` (GUI), `project.dom.test.tsx`
    (CARDS) and `import.dom.test.tsx` (IMPORT-FEEDBACK). jsdom + `@testing-library/react` are
    available; jsdom reports `scrollHeight === 0` and does not lay out, so **no acceptance criterion
    here may depend on measured pixels**.
11. **`import.tsx` is the post-IMPORT-FEEDBACK version (382 lines)** and carries behaviour the layout
    must preserve exactly: a single `aria-live="polite"` / `aria-busy` `.import-status` region
    holding busy, error and result (D-4); `workingRef` single-flight (D-9); `beginWork`/`endWork`
    resetting stale state (D-7); `waitForNextPaint()` before the main process blocks; the
    `scrollIntoView({block:"nearest"})` effect on the status region; the slug hint under the
    new-project field (D-14); every control disabled while `working !== null`. **The conversation
    list is already bounded** (`max-height: 320px; overflow-y: auto`) precisely so the picker and
    actions are not pushed off-screen by a 640-conversation export (D-6).
12. **`diagnosticRows()` is pure and already returns the ordered row list** with `key`, `name`,
    `status`, `explanation`, `detail`, optional `extra`, `ok`, `fatal`. Keys are the fixed check
    names (`node`, `tool-node`, `sqlcipher`, `keychain`, `vault`, `journal`, `sync`, `lineage`,
    `auto-lock`) plus one per client from `tools:status`.
13. **`import-selection.ts` is pure and tested**: `buildPickSpec` (comma-joined original 1-based
    indices, `undefined` when empty), `allChecked(listing)`, `countSelection(listing, checked)`,
    `sortListingByDate`. **There is no "select all visible" helper today.**
14. **`CARDS` deferred `search.tsx` explicitly** ("identical root cause… do not import the new
    renderer into it") and pinned `pack-preview.tsx` as a verbatim `<pre>`. GUI-LAYOUT is the advance
    that reopens both — deliberately, and as amendments, not by accident (D-7, D-10).
15. **`CARDS` D-I decided pinned items are *not* hoisted**: `item-repo.ts` returns
    `ORDER BY created_at DESC` and the GUI matches `valija show` exactly. idea.md §2's "Fijados
    section at the top" contradicts this. See D-9 — this is the one decision in this advance that
    changes observable ordering.
16. **`advances/CONNECT/` has an approved plan but has not landed in the renderer** (connect-tools.tsx
    still shows the single connected/not-connected boolean, and there is no lock indicator in the app
    chrome). CONNECT will add per-client states, a **persistent LOCKED/UNLOCKED indicator in the app
    chrome**, and possibly a fifth Settings section (auto-lock TTL). See D-21 — GUI-LAYOUT must leave
    room for both rather than design them.

---

## 3. User walkthrough (observable behaviour)

Ana has a vault with four projects and has connected Claude Code. Nothing she can *do* changes in
this advance; where things are, and how many clicks they take, does.

### 3.1 The shell

| # | What Ana does | What she sees back |
|---|---|---|
| 1 | Launches the app, unlocks | The window is split: a **fixed left sidebar** (brand mark + "Valija" at the top; **Dashboard · Search · Connect · Sync** as nav entries, each an icon plus its existing label; a spacer; **Lock now** and **Settings** pinned at the bottom) and the screen content to its right. The horizontal top bar is gone. |
| 2 | Clicks **Search** | The sidebar's Search entry is marked active (highlight **plus** `aria-current`, never colour alone); the content area swaps. No page scroll of the sidebar, ever. |
| 3 | Clicks a project card from Dashboard | Same sidebar, **no sidebar item active**, and a breadcrumb at the top of the content area: `Dashboard / product-launch`. The old `← Volver` button is gone; clicking the `Dashboard` segment goes back. |
| 4 | Presses **Lock now**, or is auto-locked | Exactly today's behaviour (`lockNow()` → reset workspace view → locked screen). The sidebar is not rendered while locked. |

### 3.2 The screens she uses daily

| # | What Ana does | What she sees back |
|---|---|---|
| 5 | Lands on the Dashboard | `<h1>` and the two existing actions (**Import your chat history**, **Check my setup**) in a header row, then the four projects as a **card grid** (2 columns at the reference width), each card: a small generic icon, the project name, item count and last-activity line. **There is no filter/search box on this screen** — asked for, then explicitly rejected in review (§5.1). |
| 6 | Opens **product-launch** | Breadcrumb, `<h1>`, then a toolbar row: a **row of type chips** (All · decision · progress · preference · … · Imported) on the left, **Context pack** on the right. Below: a **Pinned** section label with the pinned items under it, then the rest of the items — same cards, same content, same Markdown rendering, same Show more toggle. |
| 7 | Clicks a chip | The list re-filters exactly as the old `<select>` did — same `bridge.content.show` call, same values including `imported`. |
| 8 | Opens **Search**, types "sqlcipher" | The query field, project-scope `<select>` and result count stay. Below them a **two-column split**: a narrow left list (project · type · date · one-line truncated preview, one row per hit) and a right panel showing the **full content** of the selected hit plus a **"Open project"** action. The first hit is selected automatically. |
| 9 | Clicks another hit / presses ↓ | The right panel swaps. Nothing re-queries; this is a pure re-render over the same `SearchHit[]`. |
| 10 | Clicks **Context pack** on a project | Breadcrumb `Dashboard / product-launch / Context pack`. The pack is shown **rendered** by default (headings, lists, bold), with a **Raw Markdown** toggle that swaps to the literal monospace `<pre>`. One toolbar holds the notice, **Copy**, the format `<select>` and **Export…**. |
| 11 | Clicks **Copy**, then **Export…** | Both act on **the exact original markdown string**, in either view. What lands on the clipboard and in the file is byte-identical to `valija export` — unchanged, and pinned by `GUI` §9. |
| 12 | Opens **Connect** | Client cards in a **grid**; to their right a permanently visible rail holding the 3-step "How to use it with your tools" list (no longer behind a closed disclosure) and, when applicable, the Node/npm warning. Card contents, states and the manual-snippet fallback are unchanged. |

### 3.3 The 100-conversation import (the requirement raised by name)

| # | What Ana does | What she sees back |
|---|---|---|
| 13 | Dashboard → **Import your chat history** → picks a 137-conversation ChatGPT export | The listing stage as a **table**: columns *checkbox · title · date · estimated chunks*, **compact rows**, in a bounded scroll area. **The header row stays fixed while the body scrolls** — the column meaning and the header checkbox never leave the screen. |
| 14 | Types "migration" in the filter | The table narrows to 12 rows. Next to the filter sits an explicit **"Select all" text link**; the header also carries a **checkbox** doing the same job. |
| 15 | Clicks **Select all** (or the header checkbox) | All **12 visible** rows become checked. Rows hidden by the filter keep whatever state they had — the selection of things she cannot see is never silently changed (D-12). Clicking again unchecks the 12 visible rows only. |
| 16 | Looks right | A **persistent right rail**, which does not move as the table scrolls: file name, detected format, **"31 of 137 selected"**, the destination picker (existing project `<select>` or new-project name + its "will be saved as" hint), then **Preview** and **Import**. |
| 17 | Clicks **Preview**, then **Import** | Identical behaviour to today: buttons and rows disable, the busy sentence and the "may stop responding" warning appear in the **single status region**, the result summary / per-conversation failures / "imported items don't appear in context packs" notice render in that same region afterwards, and it is scrolled into view. One region, one live announcement — as IMPORT-FEEDBACK D-4 requires. |

### 3.4 The occasional screens

| # | What Ana does | What she sees back |
|---|---|---|
| 18 | **Check my setup** → **Run checks** | Breadcrumb `Dashboard / Check my setup`. The two probe-disclosure notices above; **Run checks** and **Copy report** in a small toolbar next to the title. Results as a **table in three labelled sections**: *System* (Node × 2, encryption engine, keychain), *Vault* (vault, database file, sync folder, write history, auto-lock), *Connected tools* (one row per client). Each row: status dot + name + detail (the old per-row explanation folds into the detail column). Nothing runs until she clicks. |
| 19 | Opens **Sync** | A **grid of small stat cards** — folder (path + cloud-recognition line), file state (at rest / not), auto-lock TTL, generation + last writer — plus a wide card for the device-state folder. **Move my vault…** sits top-right of the header as the primary action, **Check my setup** beside it as secondary. If conflicted copies or stale backups exist, a **banner above the grid** states it with the existing guidance copy — **and still offers no "resolve" affordance** (D-I). |
| 20 | Clicks **Move my vault…** | A full-focus, centred flow with **no sidebar**, headed by a 3-step indicator: *1 Choose folder → 2 Review and confirm → 3 Done*. The choose / preflight / moving / failed / done stages behave exactly as today; the preflight content is one centred card. Refusals, the lock notice, client re-point results, retries and the `VALIJA_HOME` copy line are unchanged, wording included. |
| 21 | Opens **Settings** (gear, bottom of the sidebar — or from the locked screen) | One panel with a **left mini-tab list** — *Appearance · Language · Vault & sync · Help* — and the selected section on the right. Theme and language are **segmented controls** instead of radio stacks; the same three options each; the same two Vault & sync buttons or the same locked-state notice; the same replay-tour button. Nothing new is configurable. |

### 3.5 First-run screens

| # | What a new user does | What they see back |
|---|---|---|
| 22 | Launches with no vault | A **split screen**: a fixed-width dark panel on the left (brand mark, "Valija", a one-line tagline, three short trust bullets — encryption, you hold the passphrase, works with Claude/ChatGPT/Cursor) and the screen's real content on the right (*"No vault on this machine yet."*, **Create a vault**, **I already have one**, the explainer). |
| 23 | Creates a vault / unlocks / confirms a migration | The **same shell**, same left panel, verbatim the same copy, on all four entry screens. The locked screen keeps its Settings gear (now top-right of the right panel) and its fork banner, unchanged in content. |
| 24 | Sees the recovery kit | **Still permanently dark** (D-Q's exception — not reopened). New: a banner at the top, *"This is shown once. It will not appear again."* Then the existing title, the English-only notice, the kit `<pre>` (monospace, byte-pinned, never reformatted), **Copy key** and its clipboard warning. The acknowledgement checkbox and its confirm button now sit in **their own bordered box** at the bottom. Confirm is still disabled until the box is ticked, the kit is still read once, and no route out exists until acknowledgement. |
| 25 | Watches the tour | A **thin progress bar** at the top replaces the dots; **left/right arrow icon buttons** flank the slide; **Get started** stays a text button on the last slide; **Skip** moves to the top-right, muted, present on every slide. Slide order, copy, and the fact that Skip and Get started both mark the tour seen are unchanged (D-U(b)). |

### 3.6 How the result is used afterwards — and what deliberately does not change

| Surface | Effect of this advance |
|---|---|
| The desktop window | **The only thing that changes.** Arrangement, grouping, affordance shape, icons. |
| What the user can *do* | **Nothing added, nothing removed.** No curation, no new write path, no new setting (D-A, D-U(d)). |
| Vault bytes, schema, crypto, `vault.json`, lineage | **Untouched.** This advance performs no vault write it did not already perform; the only vault write in the app remains the import batch, unchanged. |
| Context pack markdown (clipboard, export file, `valija export`) | **Byte-identical.** The rendered view is a lens over the same string; Copy and Export read the original (`GUI` §9). |
| Recovery kit text, manual install snippet | **Byte-identical, still English** (`GUI` §9, D-V(d)). |
| MCP tools, prompts, transport | **Untouched.** The GUI is not an MCP client. |
| The `valija` CLI | **Untouched** — except that the Project screen's *display order* now groups pinned items above the rest, which `valija show` does not do (D-9; documented, not hidden). |
| IPC / preload surface | **Unchanged.** No channel added, removed or re-shaped. |
| App preferences file | **Unchanged — still exactly four keys.** No layout state is persisted: not the selected search hit, not the pack view mode, not the Settings tab, not sidebar state (§7.4). |
| `docs/gui.md` | Updated in the same commit for the navigation change, the pack's two views, the import table's selection rules and the Project screen's pinned grouping. |

---

## 4. Scope

### 4.1 In

1. Replacing `components/nav-bar.tsx` with a persistent left-sidebar shell, and adding a breadcrumb
   for the four drill-down screens (Project, Context pack, Import, Diagnostics).
2. The 13 per-screen layout changes specified in §5.
3. A shared entry-cluster shell (the split panel) used by No vault / Create vault / Locked /
   Migration confirm.
4. New inline SVG icons for sidebar entries, chips, table headers, stat cards, status dots,
   onboarding arrows and card marks — decorative, `aria-hidden`, never the only signal for a state.
5. New CSS, in the existing token vocabulary only, organised per §6 D-17.
6. New catalog entries in **both** `en.ts` and `es.ts` for every new user-visible string (§6 D-19's
   inventory), plus accessible names for every new icon-only control.
7. New pure view-logic modules for anything derived (diagnostics grouping, breadcrumb model,
   relocation step mapping, select-all-visible policy, search selection defaults) with unit tests,
   plus DOM tests per §6 D-18.
8. `docs/gui.md` updates shipped in the same commit (§3.6's last row).

### 4.2 Out — explicit non-goals

- **Any change to `tokens.css`**, any new custom property, any font, radius or spacing-scale change,
  any change to the light/dark mechanism, and any change to the recovery kit's permanent dark
  (D-Q).
- **Any change under `src/**`.** Zero files. Any diff there is a bug in the plan.
- **Any change to `desktop/src/main/**`, `desktop/src/preload/**`, or `shared/ipc/messages.ts`** —
  with the single reviewed exception considered in D-4 (window `minWidth`), which defaults to *not*
  being taken.
- **Any behavioural change to a use case, an error path, a guard or a gate**: the kit's once-only
  read and acknowledgement gate, diagnostics' no-auto-run, import's single-flight and status region,
  relocation's five-stage machine and refusals, fork non-resolution, the tour's seen-flag semantics.
- **Any new capability**: no curation, no new filter on Dashboard (§5.1), no bulk actions beyond the
  import selection that already exists, no per-item copy, no keyboard-shortcut system, no drag and
  drop, no resizable/collapsible sidebar persistence, no window-state persistence.
- **CONNECT's work** (per-client state set, lock indicator, auto-lock TTL) — that advance owns it;
  this one only leaves room (D-21).
- **A real layered modal for Settings** (backdrop, focus trap, Escape) — D-16 keeps today's mount
  model; promoting it is its own change with its own a11y acceptance criteria.
- **Animation/transition work** beyond what already exists (the chevron's `transform` transition).
- **Copy rewrites of existing strings.** Existing sentences keep their wording; only *new* strings
  are authored, plus the two forced revisits named in D-10 (`pack.notTranslatedNotice`) and D-9
  (the pinned grouping's effect on the "same rows `valija show` prints" claim in docs).

### 4.3 The two wiring exceptions inside `app.tsx`

Both are routing props, not logic:

- `SearchScreen` gains an `onOpenProject(project)` callback so §5.3's "Open project" action can
  route; `app.tsx` supplies `setView({ screen: "project", project })`, exactly as Dashboard's
  `onSelectProject` already does.
- `Workspace` renders the sidebar shell instead of `NavBar` and passes each drill-down screen the
  breadcrumb data it needs (or renders the breadcrumb itself — D-3). `ProjectScreen.onBack` /
  `PackPreviewScreen.onBack` are re-used or replaced by breadcrumb navigation; the callback names may
  change, the destinations may not.

`ImportScreen` and `DiagnosticsScreen` currently take only `bridge`. If a breadcrumb is rendered by
the shell (D-3's default) neither prop list changes.

---

## 5. Per-screen specification

Each entry states **what changes** and **what explicitly does not**. "Unchanged" means the reviewer
should see the same elements, the same copy, the same calls and the same conditions.

### 5.0 The shell (replaces `components/nav-bar.tsx`)

**Changes.** A persistent left sidebar, rendered by `Workspace` for every unlocked screen:
brand mark + `common.appName` at the top; the four destinations in **today's order** — Dashboard,
Search, Connect, Sync — each an icon plus its existing label (`dashboard.title`, `search.title`,
`connect.navLabel`, `sync.title`); a flexible spacer; **Lock now** (`common.lockNow`, keeping its
danger-coloured treatment) and **Settings** (`common.settings`) pinned at the bottom. The active
entry is marked with both a visual treatment and `aria-current="page"`. The sidebar is a landmark
(`<nav>`) with an accessible name. The sidebar does not scroll with the content.

**Drill-down screens** (Project, Context pack, Import, Diagnostics — and Relocation, which is
handled by §5.9) show **no active sidebar entry** and render a breadcrumb at the top of the content
area instead. Breadcrumb trails:

| Screen | Trail |
|---|---|
| Project detail | `Dashboard / {project}` |
| Context pack | `Dashboard / {project} / Context pack` |
| Diagnostics | `Dashboard / Check my setup` |
| Import | `Dashboard / Import your chat history` |

Non-final segments are activatable controls that navigate; the final segment is plain text marked
`aria-current="page"`. Segment labels reuse existing catalog keys (`dashboard.title`, `pack.title`,
`diagnostics.title`, `import.title`) and the raw project name.

**Does not change.** The four destinations, their order, their targets; the lock action's behaviour
(`lockNow()` → `resetWorkspaceView()` → locked); the Settings entry opening the same overlay from the
same state machine; `WorkspaceView`'s variants; `overlay-nav.ts`; the fact that the sidebar exists
only inside `Workspace` (never on entry-cluster screens, the recovery kit, the tour, the relocation
wizard or Settings).

### 5.1 Dashboard (`screens/dashboard.tsx`)

**Changes.** Sidebar shell, Dashboard active. The header becomes a header row: `<h1>` left, the two
existing actions right. Project rows become a **card grid** (2 columns at the reference width;
responsive rule per D-8). Each card carries a small **generic, decorative** icon (no per-project
colour, no branding, no avatar), the project name, the item count and the last-activity line.

**Does not change — and one hard prohibition.** **No filter or search input is added to this
screen.** The mockups proposed a "Buscar proyectos…" name-filter next to the header actions; Oscar
rejected it during review as confusable with the Search destination (which is full-text content
search, not a name filter) and asked for it to be removed rather than relabelled. A reviewer finding
any text input on the Dashboard fails this advance. Also unchanged: the data (`ListProjects`, same
fields, same order), the loading/error/empty branches, `dashboard.emptyTitle` and the
`connectATool` + `importHistory` pair in the empty branch, the focus-refresh wiring, and — per
fact 9 — the `const header = (…)` block containing Import before "Check my setup", used in **exactly
four** return branches, with no `setView`/`workspace-nav` reference in the file.

### 5.2 Project detail (`screens/project.tsx`)

**Changes.**
- Sidebar shell, no active entry, breadcrumb replaces the `common.back` button.
- The type `<select>` becomes a **row of chips**: `All types`, each `ITEM_TYPES` value shown as its
  raw domain word, and `Imported` — same values, same single-select semantics, same
  `bridge.content.show` call on change. Chips wrap when they do not fit (no horizontal scroll, no
  overflow menu). Exactly one is selected at any time and the selected one is conveyed
  non-visually (D-11).
- The **Context pack** button moves onto the same toolbar row, right-aligned.
- Pinned items are grouped under a **Pinned** section label above the rest (see D-9 — this changes
  display order and is the one ordering divergence in this advance).

**Does not change.** `ItemCard` in every respect: card shape, header row, the pinned star + word,
type label untranslated, `formatDate`, Markdown rendering via `MarkdownContent`, the long-content
predicate and Show more/Show less toggle, tag pills. The empty state, the error paragraph, the
loading behaviour, the focus refresh, and the rule that filter changes remount the list (resetting
expansion).

### 5.3 Search (`screens/search.tsx`)

**Changes.** Sidebar shell, Search active. The flat `<ul>` of hits becomes a **master-detail split**:

- **Left column** — one row per hit: project name, type, date, and a **one-line truncated preview**
  of the content. Rows are selectable controls; the selected row is marked visually and
  non-visually.
- **Right panel** — the **full content** of the selected hit, plus an **Open project** action routing
  to that hit's project (§4.3).
- **Selection rules:** the first hit is selected when a search completes; re-running a search or
  changing the project scope re-selects the first hit of the new result set; an empty result set
  shows the existing `search.noResults` copy and an empty detail panel with a short placeholder.
- The query input, scope `<select>`, submit button and result count stay, above the split (spanning
  both columns or over the left column — planner's call).

**Does not change.** `SearchContext`/`bridge.content.search`'s call shape, the hits' order, the
`ALL_PROJECTS` sentinel behaviour, the empty-query early return (which clears results), the error
path through `errorCopy`, and the fact that the screen does no polling.

**Named scope call:** the detail panel renders the hit's content through the existing
`MarkdownContent` (see D-10's sibling decision in §6 D-13). The left column's preview stays plain
truncated text.

### 5.4 Context pack (`screens/pack-preview.tsx`)

**Changes.** Sidebar shell, breadcrumb. The `<pre>` becomes a **rendered view by default** using the
existing light-Markdown pipeline, with a **toggle** switching to the literal monospace `<pre>` view.
The explainer notice, **Copy**, the format `<select>` and **Export…** are grouped into one toolbar.

**Does not change — and one invariant a reviewer must test.** **Copy and Export act on the exact
original markdown string in both views**: the same `markdown` value returned by `bridge.content.pack`
goes to `bridge.content.copy`, and Export continues to call `bridge.content.export({project,format})`
which renders in the trusted process. The rendered view never round-trips into either. The
`GUI` §9 byte-identity pin on `renderContextPackMarkdown` is untouched. Also unchanged: the export
success line, the error path, the fact that the pack text is never translated (D-V(d)), and the
absence of any write.

### 5.5 Connect tools (`screens/connect-tools.tsx`)

**Changes.** Sidebar shell, Connect active. Client cards become a **grid**. The "How to use it with
your tools" disclosure is **replaced by an always-visible right-hand rail** carrying the same three
steps with the same copy and the same numbered treatment; the Node/npm warning renders in that rail
when applicable. No click-to-expand remains for the steps.

**Does not change.** Per-card content and states: client name, connected/not-connected label,
"Points at {vaultPath}" for connected clients, the Connect button and its disabled-while-connecting
state, the success detail (with and without a backup path), and the `configUnreadable` manual-snippet
fallback including its `<pre>` and copy button. The Node warning is still **informational only** and
never disables Connect (D-W). The mount-time `tools.status()` + `tools.nodeStatus()` reads stay as
they are. **`stepsOpen` state disappears with the disclosure** — that is the only state removal in
this advance.

### 5.6 Import chat history (`screens/import.tsx`)

**Changes.**
- Sidebar shell, no active entry; breadcrumb per §5.0 (idea.md called it optional — D-3 makes it
  consistent with the other drill-downs).
- The listing stage's `<label>` rows become a **table**: columns *checkbox · title · date · estimated
  chunks*, with **compact row density** (denser than the current 4px/6px padding while staying
  pointer- and keyboard-usable).
- **The header row is sticky** while the body scrolls, inside a bounded scroll container (the
  existing `max-height` mechanism from IMPORT-FEEDBACK D-6 — keep a bounded list, do not let the
  table grow unbounded).
- **Two select-all affordances, both required** (asked for by name, not designer's judgement):
  a **checkbox in the table header**, and an explicit **"Select all" text link next to the filter
  input**. Both operate on the same rule (D-12): they act on the **currently visible (filtered)
  rows only**, and never change the checked state of rows the filter is hiding. The header checkbox
  reflects the visible rows' state (all visible checked / none / partial).
- The destination picker, the selected-count line and **Preview** / **Import** move into a
  **persistent right-hand rail** that does not move as the table scrolls: file name, detected format,
  "N of M selected", the project `<select>` (plus the new-project name field and its slug hint when
  "New project…" is chosen), then the two buttons.
- The single status region (busy / error / result) moves with the actions into the rail, **directly
  above or below the buttons** — one region, still `aria-live="polite"`, still `aria-busy`, still
  scrolled into view when a run finishes (D-13 covers placement).

**Does not change.** Every behaviour named in fact 11: single-flight `workingRef` gating on file
choice, listing, preview and import; `beginWork`/`endWork` clearing stale result/error; the
`waitForNextPaint()` call before the main process blocks; `import.mayStopResponding`; the busy copy
(`detectingFormat` / `previewing` / `importing`, with the short forms on the buttons); every control
disabled while working; the `UNSUPPORTED_SOURCE` → `formatOverride` stage and its three format
buttons; sort-by-date as the `--since` stand-in; `buildPickSpec`'s original-index semantics
(selection survives sorting and filtering); the required project before submit; the preview/import
summaries, per-conversation failures, and the "imported items don't appear in context packs" notice;
the explainer at the top; the `REJECTED_CALL_CODE` catch path.

### 5.7 Diagnostics (`screens/diagnostics.tsx`)

**Changes.** Sidebar shell, breadcrumb. **Run checks** and **Copy report** move into a small toolbar
beside the title; the two probe-disclosure notices stay, just above the table. The `<ul>` of
`CheckRow`s becomes a **table grouped into three labelled sections** — *System* (`node`,
`tool-node`, `sqlcipher`, `keychain`), *Vault* (`vault`, `journal`, `sync`, `lineage`, `auto-lock`),
*Connected tools* (one row per client). Each row is: **status dot** (ok / warning / fatal, reusing
the existing severity classification and keeping the existing status **word** beside it — the dot is
never the only signal) · name · detail. The per-row `explanation` folds into the detail column
instead of occupying its own paragraph; the optional `extra` line (a client's vault path) stays.

**Does not change.** `diagnosticRows()`'s output, its ordering within a group, its content, and the
`bridge.diagnostics.run` / `tools.status` / `tools.nodeStatus` triple inside `handleRunChecks`.
Grouping is a **pure client-side partition over that list** (D-14), not a change to what
`diagnostics.run()` returns. The app-Node vs tool-Node distinction survives as two separate rows.
`Copy report` still copies the same English payload and still shows its notice. **`diagnostics.tsx`
must still contain no `useEffect`** (fact 9) — nothing on this screen may run on mount.

### 5.8 Sync & safety (`screens/sync.tsx`)

**Changes.** Sidebar shell, Sync active. The stack of `<p>` facts becomes a **grid of small stat
cards**: *Folder* (path + the cloud-recognition line), *File state* (at rest / not at rest),
*Auto-lock* (TTL or "disabled"), *Generation* (+ this-device / other-device last writer), plus a
**wide card** for the device-state folder path. Conflicted-copy and stale-backup warnings become a
**banner above the grid**, carrying the existing counts and the existing `sync.conflictGuidance`
explainer. **Move my vault…** becomes the header's right-hand primary action; **Check my setup**
stays beside it as secondary.

**Does not change.** The data (`VaultStatus` + `sync.status`, same fields, same mount-time read, no
polling), the plural-aware counts, the "displayed, never editable" rule (D-U(d)) — no field on this
screen becomes an input — and the absence of any resolve/merge/delete affordance for a conflict
(D-I, never renegotiated). Loading and error branches keep their current shape.

### 5.9 Vault relocation wizard (`screens/relocate-vault.tsx`)

**Changes.** **No sidebar** — a full-focus centred flow using the entry cluster's visual language.
A **3-step indicator** at the top: *1 Choose folder → 2 Review and confirm → 3 Done*, mapped from
the existing `Stage` union per D-15. The preflight content (destination name, cloud-recognition
line, refusal copy, clients-to-repoint list with per-client unreadable warnings, the lock notice,
Confirm) is laid out as **one centred card** under the indicator — no information added or removed.

**Does not change.** Anything at all about the five-stage state machine, `relocation.preflight` /
`move` / `retryClient`, the refusal-code mapping, the "choose again" path, the moving and
moveFailed states, the done view's rewritten/failed client lists, the per-client manual snippet and
**Try again**, the shell-aware `VALIJA_HOME` copy line, or `onDone`'s hand-back to the locked
screen. The relocation use case and its ports are untouched.

### 5.10 Settings (`screens/settings.tsx`)

**Changes.** The four stacked `<section>`s become a **left mini-tab list** (*Appearance · Language ·
Vault & sync · Help*) with the selected section's content on the right. The theme radio group and the
language radio group each become a **segmented control** with the same three options and the same
values. The panel is a bordered, centred surface rather than a full-bleed column.

**Does not change.** `SettingsScreen`'s props and every behaviour behind them: it imports no bridge
and makes no IPC call; it opens no vault session; `onUpdatePreferences` still receives the same
patches; the Vault & sync section still shows the two buttons when unlocked and the locked-state
notice otherwise; Help still holds only the replay-tour button; Close still closes. **Exactly four
sections, no fifth, no new preference** (D-U(d)) — subject to D-21's forward-compatibility note.
The mount model stays as it is today (D-16): a full-screen replacement, not a layered modal.

### 5.11 Entry cluster — No vault / Create vault / Locked / Migration confirm

**Changes.** One shared split shell applied identically to all four screens:

- A **fixed-width dark left panel**: brand mark, "Valija", a one-line tagline, three short trust
  bullets (encryption · you hold the passphrase · works with Claude/ChatGPT/Cursor).
- A **right panel** holding the screen's real content: title, body/warning text, form fields,
  buttons — same elements, same order, same copy as today.
- The left panel's copy is **identical on all four screens**; it is framing, not per-screen content,
  and belongs in one shared component rather than four copies.
- **The copy is new and must enter the catalogs** (`en.ts` + `es.ts`), never hardcoded (D-V).
- The panel's "dark" treatment is achieved with the **existing** mechanism, not new tokens (D-20).

**Does not change.** `no-vault.tsx`'s two actions, its folder-picker → `relocation.pointAtExisting`
path and error copy; `create-vault.tsx`'s renderer-side passphrase validation (length, mismatch,
caught before IPC), its loss warning, its deriving state; `locked.tsx`'s unlock submit, the
passphrase/recovery-key toggle, the single renderer→main credential crossing, the upgrade-required
route, the Settings gear (relocated to the right panel's top-right) and `ForkNoticeBanner`'s content;
`migration-confirm.tsx`'s mount-time `upgradeCheck`, backup-path sentence, Cancel/Continue and their
targets.

### 5.12 Recovery kit (`screens/recovery-kit.tsx`)

**Changes.** A **banner at the top** — new copy, new catalog key — stating that this is shown once
and will not appear again, above the existing title and English-only notice. The acknowledgement
checkbox and its confirm button move into **their own bordered box** at the bottom, so the gating
step reads as a distinct, weightier step.

**Does not change.** The screen stays **permanently dark** and must still hardcode `data-theme="dark"`
and never import the theme context (D-Q's exception, fact 9). The kit `<pre>` stays monospace and
byte-exact (`GUI` §9) — never re-wrapped, re-cased, re-rendered as Markdown, or split. The once-only
read on mount, the "Copy key" button and its clipboard warning, the confirm-disabled-until-checked
rule, the clearing of kit text on dismissal, and the invariant that **no route out exists before
acknowledgement** all stand, and the existing DOM test that asserts them must keep passing.

### 5.13 Onboarding tour (`screens/onboarding.tsx`)

**Changes.** The dot indicator becomes a **thin progress bar** (current slide / total) with an
accessible value. Back/Next text buttons become **left/right arrow icon buttons** flanking the slide
content; each keeps an accessible name from the existing `common.back` / `common.next` keys. The
right arrow is absent on the last slide, where **Get started** remains a text button. **Skip** moves
to the top-right, always visible, de-emphasised.

**Does not change.** `onboarding-tour.ts`'s slide sequence and `nextSlide`/`previousSlide`; the slide
copy; the rule that Skip and Get started both call `onDone` and both mark the tour seen (D-U(b));
the tour opening no session, reading no vault content and writing nothing itself; the auto-play and
replay routing in `overlay-nav.ts`.

---

## 6. Decisions (options, trade-offs, defaults)

Every entry has a **Default** the planner may execute without asking. Gate R confirms or overrides.

### D-1. Icon source — inline SVG vs. an icon package
*(idea.md open question 1)*

- **Option 1 — hand-authored inline SVG, no dependency.** Matches the two icons already in the tree
  (chevron, star), zero bundle cost beyond the markup, no supply-chain surface in a local-first
  E2EE product, and no build-config change. Cost: each icon is hand-written once and the set is
  maintained by us.
- **Option 2 — an icon library** (e.g. a React icon package). Faster to author, consistent grid,
  hundreds of icons for free. Cost: a new runtime dependency in the renderer of a product whose
  whole posture is dependency-shyness, tree-shaking to trust, a licence to track, and — the specific
  gotcha — **many packages emit `xmlns="http://www.w3.org/2000/svg"`, which fails
  `no-network-surface.test.ts` (fact 7)** unless the emitted markup is verified.

**Default: Option 1 — inline SVG, no new package.** Reason: the house style already exists, the icon
count here is small (roughly 6 nav + 4 status/dot + ~6 affordance icons), and it keeps
`desktop/package.json` untouched, which is itself an acceptance criterion. *Trade-off:* hand-drawn
icons will not be pixel-identical to the canvas; that is acceptable — the canvas is structural, and
§5 is the source of truth. Rider: icons are `aria-hidden="true"` and decorative; every icon-only
control (onboarding arrows, sort toggle, breadcrumb chevrons if any) carries a text accessible name
from the catalog.

### D-2. Shared components vs. screen-local markup
*(idea.md open question 2)*

- **Option 1 — extract everything reusable up front** (sidebar, breadcrumb, stat card, sectioned
  table, chip row, segmented control, split shell, rail). DRY from day one; risks inventing a
  design-system layer nobody asked for, with props that exist to serve two slightly different
  callers.
- **Option 2 — keep everything local to each screen.** Smallest diff per screen; guarantees drift
  between the Diagnostics table and the Import table, and four copies of the entry-cluster panel —
  which idea.md explicitly rules out for that panel.
- **Option 3 — extract only what is genuinely used by two or more screens *and* is structural**, and
  leave the rest as screen-local markup + a `screens.css` section.

**Default: Option 3, with an explicit list.** Extract as components: the **sidebar shell**, the
**breadcrumb**, and the **entry-cluster split panel** (idea.md names this one directly). Everything
else — stat cards, sectioned tables, chips, segmented controls, rails — stays screen-local markup
styled in that screen's `screens.css` section, and is promoted to `components/` only when a third
screen needs it. Reason: the three extracted pieces are shell-level and appear on 4–9 screens each;
the rest look similar but differ in data shape (a diagnostics section is rows with severity; an
import table is selectable rows with a sticky header). *Trade-off:* some CSS repetition between the
two tables — cheaper than a premature `<DataTable>` abstraction.

### D-3. Where the breadcrumb lives and what it renders

- **Option 1 — the shell renders it**, from the current `WorkspaceView`. Screens keep their props;
  one place knows every trail; `ProjectScreen.onBack`/`PackPreviewScreen.onBack` can disappear.
- **Option 2 — each screen renders its own**, receiving segments as props. More flexible, four
  places to keep consistent.

**Default: Option 1** — the shell derives the trail from `WorkspaceView` through a **pure, tested
mapping function** (view → segments), so "which screens show a breadcrumb and what it says" is
unit-testable without a DOM. Import gets a breadcrumb like the other three drill-downs (idea.md left
it optional; consistency wins). Rider: the trail's non-final segments navigate to the same
destinations today's Back buttons do — Project → Dashboard, Context pack → that project.

### D-4. Narrow-window behaviour (the responsive floor)
*(flagged by idea.md's last bullet: the window has no `minWidth` today — fact 5)*

- **Option 1 — CSS-only graceful degradation**, renderer-only: one breakpoint at which two-column
  layouts (Search split, Import table + rail, Connect grid + rail, Dashboard grid) collapse to a
  single column, the sidebar keeps its labels, and nothing is clipped or horizontally scrolled.
- **Option 2 — set `minWidth`/`minHeight` on the `BrowserWindow`** (e.g. 900 × 600) so the layouts
  never have to degrade. One line, but it is a **main-process change** in an advance scoped to the
  renderer, and it changes what the user can do with their window.
- **Option 3 — do nothing**; accept clipping below ~1120px.

**Default: Option 1**, with **Option 2 named as a recommended one-line follow-up** for the advance
that next touches `main/`. Reason: it keeps the "renderer only" boundary intact, and Option 3 ships
a visibly broken window at a size the user can reach today. Concretely, the default asks for **one
breakpoint** (the planner picks the value; ~900px is the natural candidate) below which each
two-column layout stacks vertically with the rail/detail panel below the primary content, and above
which the reference two-column arrangement applies. *Trade-off:* a second layout per split screen to
eyeball; no test can assert it (jsdom does not lay out), so it is review-by-eye — state that plainly.

### D-5. Sidebar behaviour and width

- **Option 1 — fixed-width, labels always visible, never collapsible.**
- **Option 2 — collapsible to an icon rail**, user-toggled, state persisted.
- **Option 3 — auto-collapse to icons below the D-4 breakpoint.**

**Default: Option 1.** Reason: Option 2 needs a fifth preferences key (forbidden — §7.4 and D-U(d)),
and Option 3 makes every nav item icon-only at exactly the width where a confused user most needs
words, while adding an untestable layout branch. *Trade-off:* the sidebar costs its width at every
size; acceptable for a 4-item nav.

### D-6. Active-state signalling in the sidebar

**Default:** the active entry is conveyed by **`aria-current="page"` plus a visual treatment built
from existing tokens** (`--color-accent` / `--color-surface`), never by colour alone, and the
`button.active` idiom already in `base.css` is reused rather than replaced. Drill-down screens have
**no** active entry, so `aria-current` is absent everywhere on those screens — the breadcrumb carries
the "where am I" signal instead.

### D-7. Reopening CARDS' deferrals (Search and Context pack)

CARDS §4 Out said, in writing: do not restyle `search.tsx`, do not import the Markdown renderer into
it, and keep `pack-preview.tsx` a verbatim `<pre>`.

- **Option 1 — honour CARDS literally**: Search becomes a split of *unstyled* rows, and the pack
  keeps only the `<pre>`. Contradicts idea.md §3 and §4, which Oscar chose from mockups.
- **Option 2 — treat GUI-LAYOUT as the follow-up advance CARDS named**, and record both as explicit
  amendments in this spec (done: §5.3, §5.4) and in `docs/gui.md`.

**Default: Option 2.** Reason: CARDS deferred these to "a follow-up advance"; this is it, and the
deferral was about sequencing, not prohibition. *Trade-off:* a reviewer reading CARDS alone will see
an apparent violation — hence the explicit amendment note here and in the docs.

### D-8. Dashboard grid column rule

- **Option 1 — fixed 2 columns** at the reference width with a single-column fallback below D-4's
  breakpoint. Matches the mockup exactly; wastes space on a maximised 27" display.
- **Option 2 — content-driven auto-fill** (a min card width, filling as many columns as fit).
  Matches the mockup at ~1120px and scales up.

**Default: Option 2**, with a minimum card width chosen so the reference width yields **2 columns**
(so the mockup is honoured at the size it was drawn for). *Trade-off:* at very wide windows cards get
small and numerous — acceptable, and better than a 2-column column of half-empty cards.

### D-9. Does the Pinned section change item order? *(the one genuine conflict)*

idea.md §2 asks for a "Fijados" section label grouping pinned items **at the top**. CARDS D-I decided
the opposite: keep `ORDER BY created_at DESC` so the GUI list matches `valija show` exactly.

- **Option 1 — group and hoist**: pinned items move above the rest under a *Pinned* label; the
  remainder follow under a second label (or no label). Matches the mockup and the review intent.
  **Cost:** the GUI's list order no longer matches `valija show`, and CARDS D-I is amended.
- **Option 2 — label without reordering**: render a *Pinned* label only when pinned items happen to
  be contiguous at the top. Fragile and usually invisible — effectively no change.
- **Option 3 — keep CARDS D-I, drop the section label.** Honours the prior decision; ignores the
  review outcome.

**Default: Option 1 — group and hoist**, implemented as a **pure partition** over the already-fetched
list (pinned first in their existing relative order, then the rest in their existing relative
order — a stable partition, never a re-sort), with the divergence from `valija show` stated in
`docs/gui.md`. Reason: the Project screen is a reading surface for a non-terminal user, and Oscar
reviewed and chose the grouped layout; CLI-order parity was a CARDS-era default, not a product
promise. *Trade-off:* someone comparing GUI and CLI side by side sees a different order — which is
why it is documented rather than silent. **Flag at Gate R: this is the only user-visible ordering
change in the advance; overriding it to Option 3 costs only the section label.**
New keys: a *Pinned* section label (the existing `project.pinned` word is the per-card badge — decide
whether to reuse it or add `project.pinnedSection`), and optionally an "Other items" label.

### D-10. The pack's two views, and the notice that promises one of them

`pack.notTranslatedNotice` currently reads: *"This is your saved content, shown exactly as it will be
exported — never translated."* In the rendered view, "exactly as it will be exported" stops being
literally true of what is on screen.

- **Option 1 — keep the copy unchanged.** Zero copy churn; the sentence is now slightly false in the
  default view of a product that is careful about exactly this kind of claim.
- **Option 2 — keep the sentence and let the toggle carry the nuance** (the raw view is one click
  away, labelled).
- **Option 3 — amend the notice** so it is true in both views (e.g. it says the content is never
  translated, and that the raw view shows the exact export text), plus toggle labels.

**Default: Option 3** — amend `pack.notTranslatedNotice` in both catalogs and add two toggle labels.
Reason: this app's copy discipline treats "what exactly is this text?" as a security-adjacent
promise (`GUI` §8.17); leaving a now-inaccurate sentence in place to avoid touching copy is the worse
trade. *Trade-off:* it breaks §4.2's "no copy rewrites" rule once, deliberately and in one place.
**Which view is default: rendered** (idea.md §4). The chosen view is **component state only**, never
persisted (§7.4).

### D-11. Chip row semantics and accessibility (Project type filter)

- **Option 1 — buttons with `aria-pressed`**, one visually selected.
- **Option 2 — a radio group** (`role="radiogroup"` + radio semantics), which matches the
  single-select reality and gives arrow-key navigation for free.
- **Option 3 — a `<select>` kept underneath for assistive tech** (duplicate control). Rejected: two
  sources of truth.

**Default: Option 2** — the chips are a single-select group, so radio semantics describe them
honestly, and keyboard users keep the arrow-key behaviour the `<select>` gave them today.
*Trade-off:* slightly more markup than plain buttons. Rider: the selected chip is distinguished by
more than colour (weight/border/inset mark), because `--color-accent` on `--color-surface` is the only
tool available and colour alone is not enough.

### D-12. Import "select all" semantics *(explicitly requested behaviour — get this exactly right)*

The rule must be stated because `allChecked(listing)` today *replaces* the whole set.

- **Option 1 — replace**: selecting all sets the checked set to exactly the visible rows, dropping
  selections of rows hidden by the filter. Simple; silently discards work the user did before
  filtering.
- **Option 2 — union / difference over visible rows only**: "select all" adds every visible row's
  index to the set; "deselect all" removes every visible row's index; rows hidden by the filter are
  never touched.
- **Option 3 — operate on the whole listing regardless of filter.** Contradicts idea.md and makes
  the filter a lie.

**Default: Option 2.** Reason: it matches idea.md's "toggles every index currently in
`visibleListing`" and it is the only option where the on-screen state and the user's mental model
agree; it also composes with `buildPickSpec`'s original-index semantics unchanged. Riders:
- The **header checkbox** reflects the visible set: checked when every visible row is checked,
  unchecked when none is, and **indeterminate** when some are (a partial state must be visible, not
  rendered as "unchecked").
- The **"Select all" link** performs the same operation as checking the header checkbox.
- The behaviour lives in a **pure function in `state/import-selection.ts`** (alongside
  `buildPickSpec`) and is unit-tested for: all-visible-checked, none, partial, filter-hidden rows
  preserved, and empty visible set.
- The rail's count is *"N of M selected"* where **M is the full listing length** and N is the total
  checked count (not the visible count) — otherwise the number changes when the user types in the
  filter, which is exactly the confusion this rule exists to avoid.

### D-13. Where the import status region goes in the two-column layout

IMPORT-FEEDBACK D-4 put one `aria-live` region "immediately above the actions — where the user's eyes
and cursor already are", mounted unconditionally.

- **Option 1 — in the rail, directly above the Preview/Import buttons.** Keeps D-4's intent exactly:
  the region is next to the controls that trigger it and is never scrolled away by the table.
- **Option 2 — full width below the table.** More room for long failure lists; further from the
  buttons and back to being pushed around by content.
- **Option 3 — two regions (busy in the rail, results below).** Rejected outright: two live regions
  double the announcements and contradict D-4.

**Default: Option 1**, with the rail allowed to scroll internally if a long failure list overflows.
*Trade-off:* long per-conversation failure lists are narrower than today. Rider: the region stays
mounted unconditionally, keeps `aria-live="polite"` and `aria-busy`, and keeps its
`scrollIntoView({block:"nearest"})` on completion.

### D-14. How Diagnostics rows are grouped, and what happens to an unknown key

- **Option 1 — a pure `groupDiagnosticRows(rows)` in `state/`**, mapping the known keys to the three
  sections in a declared order, with **any unrecognised key falling into a final group that renders
  only when non-empty**. Additive-safe: a future check added to `doctor.ts` appears somewhere visible
  instead of vanishing.
- **Option 2 — hard-code three arrays of keys and drop anything unmatched.** Simpler, and silently
  hides a future check — the worst failure mode for a diagnostics screen.
- **Option 3 — group by a new field returned from the main process.** Cleanest conceptually; touches
  IPC and `doctor.ts`, which this advance forbids.

**Default: Option 1.** The grouping module is pure and unit-tested (each known key lands in its
expected section; an unknown key lands in the fallback group; empty groups do not render). Client
rows are identified the same way `diagnostic-rows.ts` already does (membership in `tools:status`).
*Trade-off:* a fourth, rarely-seen group exists in the code.

### D-15. Relocation `Stage` → 3-step indicator mapping

**Default:** `choose` → step 1 · `preflight` and `moveFailed` → step 2 · `moving` → step 2 (shown as
in-progress) · `done` → step 3. The mapping is a **pure function** with a unit test, so the indicator
cannot drift from the state machine. Steps are labelled from three new catalog keys and the current
step is conveyed non-visually as well as visually. *Alternative considered:* giving `moving` its own
step — rejected because it would make the indicator show 4 states against a 3-step label set.

### D-16. Settings: keep the current mount model, or make it a real modal?

- **Option 1 — keep today's full-screen replacement**, restyled as a centred panel with mini-tabs.
  Zero risk to `overlay-nav.ts`; no focus trap, no backdrop, no Escape handling to get right.
- **Option 2 — a true layered modal** over the workspace: backdrop, `role="dialog"`,
  `aria-modal="true"`, focus trap, Escape to close, focus restoration. Closer to idea.md's
  "modal/overlay" wording, and a genuinely better UX — but it is **new interactive behaviour with
  its own accessibility acceptance criteria**, not a layout change, and it must also work on the
  locked screen.

**Default: Option 1.** Reason: idea.md's parenthetical ("it already is one") shows the intent was
*keep it as it is*, and a focus-trapped dialog is a separate piece of work that deserves its own
criteria rather than riding in on a layout advance. *Trade-off:* the panel still covers the whole
window rather than floating over it. The same reasoning applies to the tour overlay, which also stays
a full-screen replacement.

### D-17. Where the new CSS lives

- **Option 1 — everything in `screens.css`**, continuing one-section-per-screen, with shell rules at
  the top. The file is already ~465 lines and would roughly double.
- **Option 2 — a new `styles/layout.css`** for shell-level rules (sidebar, breadcrumb, entry split
  panel, the D-4 breakpoint), imported by `app-main.tsx` between `base.css` and `screens.css`;
  per-screen rules stay in `screens.css` sections.
- **Option 3 — one CSS file per screen.** Too granular for this codebase's size and import ordering.

**Default: Option 2.** Reason: the shell is genuinely not "a screen", and cascade order stays
explicit and readable. Riders: no new custom property may be declared anywhere (D-Q); the
`no-network-surface` scan covers `.css` so no `url(...)`-with-scheme and no remote font may appear;
`base.css`'s existing `.nav-bar` rules are **removed** with the component they style, and the rule
that vertically centres standalone `.screen`s is revisited for the new split shell.

### D-18. Test depth for a layout advance

Layout is the hardest thing in this codebase to assert, and three existing structural tests
(fact 9) constrain the rewrite.

- **Option 1 — pure-logic unit tests only** (breadcrumb mapping, diagnostics grouping, select-all
  policy, relocation step mapping, search-selection defaults), plus keeping the three existing
  structural tests green.
- **Option 2 — Option 1 plus DOM tests for the interactions this advance actually invents**: the
  import header-checkbox / select-all / filter interaction, the search master-detail selection, and
  the pack view toggle (asserting Copy still sends the original string in both views).
- **Option 3 — Option 2 plus visual/snapshot tests.** Rejected: snapshots of markup in flux produce
  churn and assert nothing a reviewer cares about.

**Default: Option 2.** The three DOM tests it names each cover a rule a reviewer would otherwise have
to take on trust — especially **"Copy sends the original markdown in the rendered view"**, which is a
byte-identity property, and **"filtered-out selections survive select-all"**, which is the explicitly
requested behaviour. Existing DOM tests (recovery kit, relocation, project, import) must keep passing;
where a rewrite genuinely invalidates a test's structural assumption, the test is updated in the same
commit with a comment explaining why — never deleted, and never for the three invariants in fact 9,
which must remain literally true.

### D-19. New catalog keys (inventory — names are the planner's call, existence is not)

Every entry below lands in **both** `en.ts` and `es.ts` in the same commit, with matching
placeholders and plural shapes:

| Area | Needed for | Rough count |
|---|---|---|
| Shell | accessible name for the sidebar `<nav>`; accessible name for the breadcrumb `<nav>` | 2 |
| Entry panel | tagline + 3 trust bullets | 4 |
| Recovery kit | the once-only banner | 1 |
| Project | *Pinned* section label (and, if used, an "Other items" label) | 1–2 |
| Context pack | two view-toggle labels + the amended notice (D-10) | 2 + 1 amended |
| Import | "Select all" link, header-checkbox accessible name, three column headers, "N of M selected" (plural-aware), rail labels for file name / format if not already covered | ~7 |
| Diagnostics | three section titles + the fallback group title (D-14) | 4 |
| Sync | stat-card titles (folder / file state / auto-lock / generation / device state) where no key exists | ~3–5 |
| Relocation | three step labels | 3 |
| Onboarding | progress accessible label (e.g. "Slide {current} of {total}") | 1 |

Rules that apply to all of them: no sentence is assembled by concatenation; counts go through a
plural form; nothing user-visible is hardcoded in a component; icon-only controls get their name from
a key, not from a tooltip. Spanish is the one neutral Latin-American catalog, "tú" forms (D-V(g)).

### D-20. How the entry cluster's dark left panel is achieved without new tokens

- **Option 1 — a `data-theme="dark"` subtree**, exactly the mechanism `recovery-kit.tsx` already uses
  and `base.css` already paints (`[data-theme] { background; color }`). Zero new tokens, works in
  both app themes, and is the established precedent.
- **Option 2 — style the panel from `--color-surface`.** Token-faithful but *not dark* in the light
  theme, so it does not match the reviewed mockup.
- **Option 3 — new custom properties for the panel.** Forbidden (§4.2).

**Default: Option 1**, with a rider: in the **dark** app theme the panel and the content panel become
near-identical, so the split must remain legible through a border/divider built from
`--color-border`, not through a new colour. *Trade-off:* the panel ignores the user's light-theme
choice by design — the same deliberate exception D-Q already grants the recovery kit, applied for
framing rather than for gravity. If Gate R dislikes that, Option 2 is a one-line change.

### D-21. Forward compatibility with CONNECT (approved plan, not yet landed)

CONNECT will add per-client states, **a persistent LOCKED/UNLOCKED indicator in the app chrome**, and
possibly an auto-lock section in Settings — all of which land in surfaces this advance rewrites.

**Default:** GUI-LAYOUT **implements none of it**, and only avoids blocking it:
(a) the sidebar's bottom cluster leaves an obvious place for a lock-state indicator beside the Lock
button, and the sidebar component's shape does not assume "exactly six entries";
(b) the Settings mini-tab list is driven by a list of sections rather than four hardcoded branches,
so a fifth tab is an addition rather than a rewrite — **without adding a fifth tab here**;
(c) the Connect screen's card markup does not hardcode a two-state connected/not-connected assumption
in CSS that a six-state set would have to fight.
Whichever advance lands second absorbs the merge; naming the three seams now makes that cheap.

### D-22. Selection / view state ownership
*(idea.md open question 3)*

- **Option 1 — local `useState` per screen**, matching every screen in this codebase today.
- **Option 2 — a shared hook or context** for master-detail selection.

**Default: Option 1 — local `useState`, no new shared hook, nothing persisted.** Reason: the two
cases (a selected search hit, a set of checked import rows) share no lifecycle and no data shape; a
shared abstraction would exist to serve two callers that never coordinate. Rider: the *derivations*
over that state (select-all policy, default selection) are pure functions in `state/`, unit-tested —
that is where the reuse and the testability live, not in a hook.

---

## 7. Security-sensitive surfaces — what must not weaken

This advance touches no crypto, no key handling, no keychain call and no data at rest. Its risk is
entirely in *what the window shows and promises*. Each item is a review check.

1. **Byte-pinned artifacts stay byte-pinned.** The recovery kit `<pre>`, the manual install snippet
   and the context pack's raw view render their strings verbatim — no re-wrapping, no
   re-capitalisation, no trimming, no Markdown interpretation of the kit or the snippet. The pack's
   **rendered** view is a display lens only; **Copy and Export must send the original string**
   (§5.4, D-18's DOM test).
2. **The recovery kit's gate does not move.** Permanently dark, read once, no route out before the
   acknowledgement checkbox is ticked, kit text cleared on dismissal, and the screen still never
   imports the theme context. The new banner and the new bordered box sit *around* that logic.
3. **No secret gains a new rendering path.** The passphrase and recovery key still cross
   renderer→main once and are never retained, logged, echoed, or placed in any new element. No new
   element displays a key, a passphrase, or a derived value.
4. **Nothing new is persisted.** The preferences file keeps **exactly four keys**. The selected search
   hit, the pack view mode, the Settings tab, chip selection, checked import rows, sidebar state and
   expansion state are session memory only — persisting any of them would write vault metadata
   (project names, item ids, file names) into a plaintext file outside the vault.
5. **Untrusted content stays untrusted.** Search hit content and pack markdown are AI- or
   import-authored text. Rendering them follows CARDS §7 exactly: React elements only — no
   `dangerouslySetInnerHTML`, no `innerHTML`, no `DOMParser`, no `eval`/`new Function`, no `<a>`,
   `<img>`, `<iframe>` or `style` attribute derived from content. Truncated previews are cosmetic,
   never a claim that anything is hidden from anyone with access to the unlocked window.
6. **No network surface, no timers.** No `fetch`, no `setInterval`, no `http://`/`https://` anywhere
   in `desktop/src` — **including an SVG `xmlns` attribute** (fact 7). Icons are inline markup; no
   asset is fetched; no remote font; CSS uses gradients, not `url(...)` with a scheme. CSP and the
   window's navigation handlers in `main-window.ts` are untouched.
7. **No polling is introduced.** Data still refreshes on mount, on user action and on window focus
   (`wireFocusRefresh`). A sidebar that refreshed status on a timer would silently defeat idle
   auto-lock (`GUI` §5.1) — it must not exist.
8. **Diagnostics still runs nothing on mount.** The keychain probe and the Node probe are user-
   initiated only; their disclosure notices stay visible *before* the run; `diagnostics.tsx` keeps no
   `useEffect`.
9. **Import's guards survive the rail.** Single-flight, disabled controls while working, one status
   region, stale-state reset per run, the "may stop responding" warning, and one lineage bump per
   import batch — none of which may be weakened by moving the buttons.
10. **Fork and conflict are still reported, never resolved.** The new Sync banner adds no resolve,
    merge, delete or "keep this one" affordance (D-I).
11. **Relocation's refusals and ordering are untouched.** The step indicator is decoration over the
    existing machine; it must never let a user reach step 3 without the move having succeeded, and it
    must not suppress or reword a refusal.
12. **Settings gains no capability.** No field can set `VALIJA_HOME`, `VALIJA_STATE_HOME` or
    `VALIJA_AUTOLOCK_MINUTES`; no destroy/re-key/re-initialize path appears; the panel still opens no
    vault session and makes no IPC call of its own (D-U(d)).
13. **State is never conveyed by colour alone** — status dots keep their word, the active nav entry
    keeps `aria-current`, the selected chip keeps a non-colour mark, the header checkbox's partial
    state is a real indeterminate. This is an honesty property in a screen whose job is to report
    whether the user's encrypted vault is healthy.

---

## 8. Architecture notes (clean architecture inside a delivery adapter)

The renderer is a delivery adapter (`GUI` §5.1); the discipline that applies here is the same one
`state/diagnostic-rows.ts` and `content/light-markdown.ts` already demonstrate.

- **Pure view logic lives in `state/` (or `content/`), not in components.** Everything this advance
  derives is a total function over data the screen already has: breadcrumb segments from a
  `WorkspaceView`; three diagnostic sections from `DiagnosticRow[]`; a pinned/rest partition from
  `ItemRow[]`; a select-all-visible transition from `(checked, visibleRows)`; a step index from a
  relocation `Stage`; a default selection from `SearchHit[]`. Each is unit-tested in the plain Node
  environment, with no DOM and no i18n inside it.
- **Components are adapters over those functions.** They translate (via `useT()`), render, and wire
  callbacks. No component computes grouping or selection rules inline.
- **Language-blind cores.** Pure modules never import the catalog; labels are resolved at the
  component edge — the same rule CARDS applied to the Markdown parser.
- **The shell owns navigation; screens own their data.** Screens continue to receive callbacks and
  never import `workspace-nav`/`setView` (an existing, tested rule for `dashboard.tsx` — keep it true
  for every screen).
- **No new kind of thing without a folder that names it.** A new component goes in
  `renderer/components/`; new pure logic in `renderer/state/`; new shell styles in
  `renderer/styles/`. No bare file at a layer root.
- **Small units.** Prefer splitting a large screen (Import especially) into a table part, a rail part
  and a result part within its own file or a screen-local folder over a single 500-line component.
- **The boundary holds:** no use case, port, repository, DTO or error constructor is touched; no
  `locale` parameter appears anywhere in `src/` (D-V(f)); no IPC message changes shape.

---

## 9. Acceptance criteria (reviewer checklist)

Every item traces to a walkthrough step in §3 or a constraint in §2/§7.

**Shell and navigation (§3.1)**
- [ ] `components/nav-bar.tsx`'s horizontal bar no longer renders anywhere; `base.css`'s `.nav-bar*`
      rules are gone with it.
- [ ] Every unlocked screen renders the left sidebar: brand mark, the four destinations in the order
      Dashboard · Search · Connect · Sync, a spacer, then Lock now and Settings.
- [ ] Each nav entry shows an icon **and** its existing label; the icon is `aria-hidden`.
- [ ] The active destination carries `aria-current="page"` and a non-colour-only visual treatment;
      drill-down screens have no active entry.
- [ ] Project, Context pack, Import and Diagnostics each render the breadcrumb trail in §5.0; the
      non-final segments navigate to the destinations the old Back buttons used.
- [ ] The trail is produced by a pure, unit-tested mapping from `WorkspaceView`.
- [ ] Lock now still locks, resets the workspace view, and routes to the locked screen; Settings still
      opens the same overlay from the same state.

**Dashboard (§3.2 step 5)**
- [ ] **No text input of any kind exists on the Dashboard.**
- [ ] Projects render as a card grid, 2 columns at ~1120px, each card showing a decorative icon, the
      name, the item count and the last-activity line.
- [ ] `dashboard.tsx` still declares a `const header = (…)` block containing the Import action before
      "Check my setup", still interpolates `{header}` in exactly four branches, and still contains no
      `setView`/`workspace-nav` reference — `import-entry-points.test.ts` passes unmodified.
- [ ] The empty branch still offers `connectATool` and `importHistory`.

**Project detail (§3.2 steps 6–7)**
- [ ] The `<select>` is gone; a wrapping chip row offers *All types*, every `ITEM_TYPES` value and
      *Imported*, with single-select semantics and keyboard navigation.
- [ ] Selecting a chip issues the same `bridge.content.show` call the `<select>` issued.
- [ ] Pinned items render under a *Pinned* section label above the rest, produced by a pure, tested
      **stable partition** (relative order within each group unchanged) — D-9.
- [ ] `ItemCard` is unchanged: card shape, header, star + pinned word, untranslated type label, tag
      pills, Markdown rendering, Show more/Show less. `project.dom.test.tsx` passes.

**Search (§3.2 steps 8–9)**
- [ ] The results render as a master-detail split; the left column shows project, type, date and a
      one-line truncated preview per hit.
- [ ] The first hit is selected when a search completes; re-running a search or changing scope
      re-selects the first hit of the new set.
- [ ] The right panel shows the selected hit's full content and an "Open project" action that routes
      to that project.
- [ ] `bridge.content.search`'s call shape, the hit order and the empty-query behaviour are unchanged;
      no new IPC call appears.
- [ ] Selecting a hit performs no network, no IPC and no re-query.

**Context pack (§3.2 steps 10–11)**
- [ ] The pack renders in a readable view by default, with a visible toggle to the literal `<pre>`.
- [ ] **A DOM test proves Copy sends the exact original markdown string while the rendered view is
      showing**, and that the raw view's text equals that string.
- [ ] Export still calls `bridge.content.export({project, format})`; the markdown/JSON `<select>` and
      the success line are unchanged.
- [ ] The notice, Copy, format select and Export sit in one toolbar; the amended notice (D-10) is
      accurate in both views and present in both catalogs.

**Connect tools (§3.2 step 12)**
- [ ] Client cards render as a grid; the three steps are permanently visible in a rail with the same
      copy and no expand/collapse control.
- [ ] The Node/npm warning renders in the rail under the same condition and still never disables
      Connect.
- [ ] Card states — name, connected/not, "Points at", Connect (with its connecting-disabled state),
      success detail with and without backup path, and the `configUnreadable` snippet + copy button —
      are unchanged.

**Import (§3.3 — the explicitly requested behaviour)**
- [ ] The listing renders as a table with checkbox / title / date / estimated-chunks columns and
      visibly compact rows.
- [ ] **The header row remains visible while the body scrolls**, inside a bounded scroll container
      (the list never grows unbounded — IMPORT-FEEDBACK D-6 preserved).
- [ ] **Both** select-all affordances exist: a checkbox in the table header **and** a distinct
      "Select all" text link beside the filter input.
- [ ] Both operate on **visible rows only**; a row hidden by the filter keeps its previous checked
      state — proven by a unit test and a DOM test (type a filter, deselect all, clear the filter,
      previously-checked hidden rows are still checked).
- [ ] The header checkbox shows a real **indeterminate** state when some but not all visible rows are
      checked.
- [ ] The rail is persistent and does not move as the table scrolls; it holds file name, format,
      "N of M selected" (M = full listing length), the destination picker (+ new-project field and its
      slug hint), Preview and Import.
- [ ] Exactly **one** `aria-live="polite"` status region exists, holding busy, error and result, with
      `aria-busy` and the completion `scrollIntoView` preserved.
- [ ] Single-flight gating, per-run state reset, `waitForNextPaint`, the "may stop responding"
      warning, the disabled-while-working rule, the format-override stage, the sort toggle, the
      summaries, per-conversation failures and the excluded-from-packs notice all behave as before;
      `import.dom.test.tsx` passes (updated only where a structural assumption genuinely moved, with
      a comment).
- [ ] `buildPickSpec` still emits original 1-based indices; selection survives sorting and filtering.

**Diagnostics (§3.4 step 18)**
- [ ] Rows render as a table in three labelled sections (System / Vault / Connected tools) in the
      declared order, produced by a pure, unit-tested grouping over `diagnosticRows()`'s output.
- [ ] An unrecognised check key lands in a fallback group that renders only when non-empty (test).
- [ ] Each row shows a severity dot **and** the existing status word; the explanation folds into the
      detail column; a client row's vault-path `extra` line survives.
- [ ] Run checks and Copy report sit in a toolbar beside the title; both probe notices remain above
      the table and are visible before any run.
- [ ] **`diagnostics.tsx` still contains no `useEffect`** and both probe-backed reads still happen
      only inside `handleRunChecks` — `diagnostics.no-auto-run.test.ts` passes unmodified.

**Sync & safety (§3.4 step 19)**
- [ ] The facts render as stat cards plus a wide device-state card; the same values are shown, from
      the same single mount-time read, with no polling.
- [ ] Conflicted-copy / stale-backup warnings render as a banner above the grid with the existing
      counts and guidance copy, and **no resolve affordance of any kind**.
- [ ] Nothing on the screen is editable; Move my vault… is the header's primary action and Check my
      setup remains available.

**Relocation wizard (§3.4 step 20)**
- [ ] The screen renders without the sidebar, in the entry cluster's visual language, with a 3-step
      indicator whose mapping from `Stage` is a pure, unit-tested function and whose current step is
      conveyed non-visually too.
- [ ] Preflight content is one centred card containing exactly today's information; refusal copy,
      the clients-to-repoint list, the unreadable-config warning, the lock notice, the moving and
      failed states, the done view (rewritten/failed clients, manual snippets, Try again), the
      shell-aware `VALIJA_HOME` line and its copy button are unchanged.
- [ ] `relocate-vault.dom.test.tsx` passes.

**Settings (§3.4 step 21)**
- [ ] The panel renders a left mini-tab list with exactly the four existing sections and the selected
      section's content on the right; **no fifth tab, no new preference.**
- [ ] Theme and language render as segmented controls with the same three options and the same
      update calls; the tab list has correct tab semantics and keyboard behaviour.
- [ ] `SettingsScreen` still imports no bridge and makes no IPC call; the locked-state notice still
      replaces the two Vault & sync buttons when locked; Help still holds only the replay button.
- [ ] Settings still opens from the locked screen.

**Entry cluster (§3.5 steps 22–23)**
- [ ] All four screens render the same split shell with one shared left-panel component; the panel's
      copy is identical on all four and comes from the catalogs in both languages.
- [ ] The panel's dark treatment introduces **no new custom property**, and the split stays legible in
      the dark app theme.
- [ ] Each screen's own content, copy, validation and routing are unchanged; the locked screen keeps
      its Settings gear and its fork banner.

**Recovery kit (§3.5 step 24)**
- [ ] The once-only banner renders above the title, from a new key present in both catalogs.
- [ ] The acknowledgement checkbox and confirm button sit in their own bordered box; confirm is still
      disabled until checked; no route out exists before acknowledgement.
- [ ] The kit `<pre>` is byte-identical to `renderRecoveryKit`'s output and still monospace; the
      screen still hardcodes `data-theme="dark"` and never imports the theme context;
      `recovery-kit.dom.test.tsx` and `app.theme.test.ts` pass.

**Onboarding (§3.5 step 25)**
- [ ] A progress bar replaces the dots and exposes its position accessibly; arrow icon buttons replace
      Back/Next and carry accessible names from existing keys; the forward arrow is absent on the last
      slide, where Get started remains; Skip is top-right on every slide.
- [ ] Slide order, copy and the "both Skip and Get started mark the tour seen" rule are unchanged; the
      tour still opens no session and writes nothing itself.

**Global / non-regression**
- [ ] `git diff --stat` shows **no file under `src/`**, none under `desktop/src/main/**` or
      `desktop/src/preload/**`, no change to `shared/ipc/messages.ts`, and no dependency change in
      `desktop/package.json` (D-1 default) — with the only possible exception being D-4 Option 2 if
      Gate R chooses it.
- [ ] `tokens.css` is byte-identical; no new CSS custom property is declared anywhere.
- [ ] Every new user-visible string exists in `en.ts` **and** `es.ts`; `catalogs.test.ts` and the
      `Catalog` typecheck pass; no user-facing sentence is hardcoded in a component and none is built
      by concatenation; counts use plural forms.
- [ ] Every icon-only control has a text accessible name; no state is signalled by colour alone.
- [ ] `no-network-surface.test.ts` passes — in particular no `xmlns="http://…"` on any new SVG, no
      `setInterval`, no `url(...)` with a scheme in CSS.
- [ ] `main-window.ts`'s CSP, navigation handlers and permission handler are unchanged.
- [ ] Shell styles live in their own stylesheet, per-screen styles in their `screens.css` section;
      import order in `app-main.tsx` is explicit.
- [ ] No preferences key is added; no layout or selection state is persisted.
- [ ] At the D-4 breakpoint every two-column layout collapses to one column with nothing clipped and
      no horizontal scrollbar.
- [ ] `docs/gui.md` is updated in the same commit for: the sidebar/breadcrumb navigation, the pack's
      two views (and that export/copy are unaffected), the import table's selection rules, and the
      Project screen's pinned grouping and its divergence from `valija show`.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at repo root and in `desktop/`.

---

## 10. Slicing guidance (not binding — the planner slices)

The dependency structure, stated so the planner can slice freely:

- **Two pieces everything else sits on**: the sidebar shell + breadcrumb (§5.0, blocks §5.1–§5.8),
  and the entry split panel (§5.11, blocks nothing else but is shared by four screens).
- **Fully independent of each other**, once the shell exists: Dashboard, Project, Search, Context
  pack, Connect, Import, Diagnostics, Sync.
- **Independent of the shell entirely**: Relocation wizard, Settings, Recovery kit, Onboarding.
- **Riskiest, and worth its own slice**: Import (§5.6) — the most behaviour to preserve (fact 11),
  the explicitly-requested selection rules (D-12), and the most existing test surface.
- **Cheapest to get wrong quietly**: Diagnostics (the no-`useEffect` invariant) and Dashboard (the
  `const header` structural test).
- idea.md's suggested 8-slice order is a reasonable starting point and is explicitly **not binding**.

---

## 11. Biggest risk

**A layout rewrite silently drops a behaviour that no layout test can see.** The screens being
restructured are exactly the ones carrying the product's most carefully-argued small rules — import's
single-flight gate and its single `aria-live` region, diagnostics' refusal to probe on mount, the
recovery kit's acknowledgement gate and permanent dark, the pack's byte-identity between what is
displayed and what is copied, the Sync panel's deliberate absence of a resolve button, the dashboard
header's four-branch Import route. Each of those was won in a prior advance, some of them in a
review finding; each is one careless JSX reshuffle away from disappearing, and none of them is
visible in a screenshot. The mitigations are structural and mandatory: the three existing structural
tests (fact 9) must remain literally true rather than be edited to fit, the four existing DOM tests
must keep passing, D-18's three new DOM tests cover the properties this advance actually invents, and
§5 states "does not change" per screen explicitly so a reviewer can diff intent against behaviour
rather than against a picture.

*Runner-up:* **D-9's pinned grouping is the one change here that alters what the user sees as
"the order of my data"** — it amends a decision (CARDS D-I) that was taken deliberately for
CLI parity. It is cheap to reverse now and awkward to reverse after it ships, which is why it is
called out at Gate R rather than buried in §5.2.
