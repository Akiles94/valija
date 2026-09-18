# GUI-LAYOUT — idea capture

Raw input for the task-refiner. Written after an interactive design-review session
with Oscar, screen by screen, using a mockup canvas (Claude Design) to compare
layout options per screen. This is idea capture only — not a spec.

## Goal (as told by Oscar)

The current desktop GUI (shipped by the `GUI` advance) works but its layout is
plain and inconsistent: a bare top nav bar, dense unstructured screens, a couple
of redundant controls. Oscar reviewed every screen and picked a concrete layout
for each. This advance's job is to carry those layout decisions into the real
`desktop/src/renderer` code.

**Explicitly out of scope: visual style.** Oscar looked at 4 different color/type
"skins" early in the session and decided to keep the app's *current* visual style
(the palette and type in `desktop/src/renderer/styles/tokens.css` and `base.css`
as they ship today). Nothing in this advance should change a color token, a font,
a border radius value, or the dark/light theme mechanism — only the *arrangement*
of elements changes: what's a sidebar vs. a top bar, what's a flat list vs. a
grouped table, where actions live, etc.

**Visual reference.** All decisions below were made by comparing wireframe
mockups (structure-only, gray/neutral, no real color) on a published canvas:
https://claude.ai/artifact/6TXhfijgqEoNaCtJyPU4fT — every page of that canvas
holds one screen's options (A/B/C), with the chosen one annotated "ELEGIDA ✓".
The mockups use plausible sample content, not the app's real i18n strings —
copy stays whatever `desktop/src/shared/i18n/catalogs/*.ts` already has.

## Global navigation change

Today `desktop/src/renderer/components/nav-bar.tsx` is a horizontal top bar:
Dashboard / Search / Connect tools / Sync tabs, then a Lock button, then a
Settings gear — all plain text buttons, no icons, rendered above every unlocked
workspace screen (`app.tsx`'s `Workspace`).

**Decided:** replace it with a **persistent left sidebar** carrying the same
items in the same order (brand mark at top; Dashboard/Search/Connect
tools/Sync as nav entries; a spacer; Lock and Settings at the bottom). Icons
are added throughout the mockups (stroke-based, 24px grid) — Oscar did not
object to adding icons; this is a layout/structure decision, not new visual
style, and should carry into the implementation using whatever icon approach
the planner judges cheapest (inline SVG matching the mockups is fine, no new
dependency needed).

Screens reached by drilling into a workspace screen (Project detail, Context
pack, Import, Diagnostics) keep the same sidebar shell but show **no active
sidebar item** and add a small breadcrumb at the top instead (e.g.
"Dashboard / product-launch"), replacing today's plain "← Back" button.

Screens that are *not* part of the unlocked workspace shell — the entry
cluster (No vault / Create vault / Locked), the recovery kit, the onboarding
tour, the migration-confirm screen, and the Settings overlay — do **not**
get the sidebar; see their own sections below.

## Per-screen decisions

### 1. Dashboard (`screens/dashboard.tsx`)
- Sidebar nav (Dashboard active), no top bar.
- Header: `<h1>` title, then the two existing actions ("Import your chat
  history", "Check my setup") as buttons — same as today, just restyled to
  sit in the new shell.
- **Resolved during review, not just a mockup detail:** the mockups initially
  added a "Buscar proyectos…" (filter-by-name) input next to the header
  actions. Oscar rejected it as confusingly similar to the "Search" nav item
  (which does full-text content search, not a name filter) and asked for it
  to be **removed entirely** rather than kept-and-relabeled. **Do not add any
  filter/search input to the Dashboard.** The empty state and the
  `dashboard.emptyTitle` / `connectATool` branch are unaffected.
- Project cards: same data as today (`ListProjects` — name, item count, last
  activity), rendered as a **grid** (2 columns in the mockup at 1120px; the
  planner should decide the responsive column count) instead of today's
  vertical list. Each card: a small icon (decorative, generic — no per-project
  color/branding was decided), name, item count + last-activity line.

### 2. Project detail (`screens/project.tsx`)
- Sidebar shell, no active item, breadcrumb "Dashboard / {project}" replacing
  the `common.back` button.
- Type filter: replace the `<select>` with a **row of chips/pills** (one per
  `ITEM_TYPES` value plus "All" and "Imported"), same values, same behavior
  (clicking one re-filters, same as changing the select today).
- "Context pack" button stays, moves to the same toolbar row as the chips
  (top-right).
- Item list: **unchanged in content model** — still `ItemCard` (pinned
  marker, type, date, Markdown content, tags), still ordered the same way.
  The only layout change: pinned items get a small "Fijados" section label
  above them so they're visually grouped at the top (today pinned items are
  interleaved with an inline star + "Pinned" label only).

### 3. Search (`screens/search.tsx`)
- Sidebar (Search active).
- **Structural change:** today's flat `<ul>` of hits becomes a **master-detail
  split** — a narrow left column listing every hit (project name, type, date,
  a one-line truncated preview) and a right panel showing the **full content**
  of whichever hit is selected, plus a "go to project" affordance. Clicking a
  row in the left column selects it; the first hit is selected by default
  after a search runs.
- The search input, project-scope `<select>` and result count stay, now
  sitting above the left column (or spanning both, planner's call).
- No change to `SearchContext`/the IPC call shape — this is a rendering
  change over the same `SearchHit[]`.

### 4. Context pack (`screens/pack-preview.tsx`)
- Sidebar shell, breadcrumb "Dashboard / {project} / Context pack".
- **Structural change:** today's `<pre>` block (raw markdown, monospace)
  becomes a **rendered view by default** (headings, lists, bold — a light
  Markdown render, reusing `content/light-markdown.ts` / `MarkdownContent`
  from the CARDS advance if that's a fit) with a toggle button ("Vista
  legible" / "Markdown crudo") to switch to the literal `<pre>` text.
  **Copy and Export must still act on the exact original markdown string**
  regardless of which view is showing — this is a display-only change, the
  §9 byte-identity pin on `renderContextPackMarkdown`'s output is untouched.
- The `pack.notTranslatedNotice` explainer, Copy button, format `<select>`
  and Export button stay, grouped in one toolbar.

### 5. Connect tools (`screens/connect-tools.tsx`)
- Sidebar (Connect tools active).
- Client cards become a **grid** (was a vertical list of full-width rows).
- The collapsible "How to use it with your tools" disclosure (today closed
  by default, 3 steps) and the Node/npm missing warning become an
  **always-visible right-hand rail** next to the grid — no more click-to-expand
  for the steps. Same 3 steps, same copy, same conditional warning.
- Per-card content (name, connected/not status, "points at", Connect/Reconnect
  button, success/manual-fallback states) is unchanged in substance.

### 6. Import chat history (`screens/import.tsx`)
- Sidebar (no active item — reached from Dashboard), breadcrumb optional
  (planner's call; not mockup-critical).
- The "listed" stage's conversation list becomes a **table** (checkbox,
  title, date, estimated chunks columns) instead of the current `<label>`
  rows.
- **Oscar's explicit requirement, raised after seeing the first version:**
  this table must stay usable when a real export has **100+ conversations**.
  Concretely:
  - The table header is **sticky** while the body scrolls.
  - A **checkbox in the header** toggles all *visible* (filtered) rows, plus
    an explicit **"Seleccionar todas" text link** next to the filter input as
    a second, more discoverable way to do the same thing. Both must exist —
    this was asked for explicitly, not left as designer's judgment.
  - Rows are visually compact (denser padding than the mockups' first pass)
    so more fit on screen at once.
  - This maps onto the existing `checked: Set<number>` / `allChecked()` /
    `buildPickSpec()` state in `state/import-selection.ts` — "select all"
    toggles every index currently in `visibleListing`, not the full unfiltered
    listing, mirroring how the filter already narrows what's operated on.
- The destination picker (existing-project `<select>` / new-project name
  input), the selected-count, and the Preview/Import buttons move into a
  **persistent right-hand rail** next to the table (file name, format,
  "N of M selected", the project picker, Preview and Import buttons) instead
  of a bottom bar — chosen over a floating bottom bar so the destination and
  actions never move as the table scrolls.
- Preview/import result rendering (`import.previewSummary` /
  `import.importSummary`, per-conversation failures, the
  `excludedFromPacksNotice`) is unchanged in content and placement logic —
  still shown after the rail's action runs.

### 7. Diagnostics / "Check my setup" (`screens/diagnostics.tsx`)
- Sidebar shell, breadcrumb "Dashboard / Revisar mi instalación".
- Today's flat `<ul>` of `CheckRow`s becomes a **table grouped into three
  labeled sections**: Sistema (node, tool-node, sqlcipher, keychain), Bóveda
  (vault, journal, sync, lineage, auto-lock), Herramientas conectadas (one row
  per client). Section grouping is presentational only — `diagnosticRows()`'s
  output and ordering are the data source; the planner should add a
  client-side grouping step (by the existing `key` prefixes / fixed check
  names) rather than changing what `diagnostics.run()` returns.
- Each row: a status dot (ok/warning/fatal — reuse the existing severity
  classification), name, and detail text. The current per-row `explanation`
  paragraph collapses into the detail column rather than its own line.
- "Run checks" and "Copy report" move into a small toolbar at the top next to
  the title; the two probe-disclosure notices stay, just above the table.

### 8. Sync & safety (`screens/sync.tsx`)
- Sidebar (Sync active).
- Today's stack of `<p>` facts becomes a **grid of small stat cards**: Carpeta
  (path + cloud-recognition line), Estado del archivo (at-rest/not),
  Auto-bloqueo (TTL), Generación (+ last-writer), plus a wide card for the
  device state folder path. Same data (`VaultStatusOutput` +
  `VaultFolderInspection`), same "displayed, never editable" rule (D-U(d) in
  `GUI/refined.md` — nothing here becomes an input).
- Conflicted-copies / stale-backups warnings become a **banner above the
  grid** (was inline `<p className="warning">`s) when present, keeping the
  existing `sync.conflictGuidance` explainer text and **no "resolve" affordance**
  (D-I — never renegotiate this).
- "Move my vault…" moves to the top-right of the header (primary button);
  "Check my setup" stays as a secondary action.

### 9. Vault relocation wizard (`screens/relocate-vault.tsx`)
- No sidebar — full-focus centered flow, matching the entry-cluster visual
  language (see below).
- Add a **3-step indicator** at the top of the screen ("1 Elegir carpeta → 2
  Revisar y confirmar → 3 Listo") that reflects the existing `Stage` union
  (`choose` / `preflight` & `moveFailed` / `moving` / `done` collapse onto
  the 3 displayed steps — planner decides the exact mapping). This is a
  **presentational wrapper only**: the existing 5-stage state machine,
  refusal codes, client re-point results, and the `export VALIJA_HOME=…`
  copy-line stay exactly as implemented; nothing about the relocation
  use case or its ports changes.
- The preflight view's content (destination folder, cloud-recognition line,
  clients-to-repoint list, the lock notice, Confirm) is laid out as a single
  centered card under the step indicator — no new information is added or
  removed versus today's `PreflightView`.

### 10. Settings (`screens/settings.tsx`)
- Rendered as a **modal/overlay** (it already is one, reachable from
  anywhere including the locked screen) with a **left mini-tab list**
  (Apariencia / Idioma / Bóveda y sync / Ayuda) and the selected section's
  content on the right — replacing today's four stacked `<section>`s.
- Exactly the same 4 sections, same fields (theme radio → segmented
  control, language radio → segmented control, the two Vault & sync buttons
  or the locked-notice fallback, the replay-tour button). No fifth tab, no
  new preference — `SettingsScreen`'s props and behavior are unchanged, this
  is a render-only restructuring.

### 11. Entry cluster — No vault / Create vault / Locked / Migration confirm
(`screens/no-vault.tsx`, `create-vault.tsx`, `locked.tsx`,
`migration-confirm.tsx`)

**Decided as one shared shell**, applied identically to all four screens
(migration-confirm reuses the same shell without its own mockup round, since
it's structurally a smaller variant of the same form pattern):

- A **split layout**: a fixed-width dark left panel (brand mark, "Valija",
  a one-line tagline, and 3 short trust bullets — encryption, "you hold the
  passphrase", "works with Claude/ChatGPT/Cursor") and a white right panel
  holding the actual screen content (title, body/warning text, form fields,
  buttons).
- The **left panel's copy is identical across all four screens** — it is
  decorative framing, not per-screen content, so it should likely become one
  shared component the planner names (something like `AuthPanel` /
  `TrustPanel`) rather than four copies.
- `locked.tsx` additionally keeps its Settings-gear affordance (now probably
  top-right of the right panel rather than a lone top-left button) and the
  fork-notice banner (`ForkNoticeBanner`), unchanged in content.
- **This left panel's copy is new, mockup-authored text** (not yet in any
  i18n catalog) — the planner/implementer must add it as real catalog
  entries in both `en.ts` and `es.ts`, not hardcode it, per the existing
  "no hardcoded user-facing string" rule this codebase already follows.

### 12. Recovery kit (`screens/recovery-kit.tsx`)
- **Stays permanently dark/high-contrast** — this is an existing, deliberate
  exception (`GUI/refined.md` D-Q) and is not reopened here.
- Layout: a **banner at the top** ("Esto se muestra una sola vez. No vuelve a
  aparecer.") — new copy, needs a catalog entry — above the existing title
  and `recoveryKit.englishNotice` explainer; the kit `<pre>` block stays
  monospace (this text is byte-pinned, §9, never reformatted); the Copy
  button and `copyKeyWarning` stay directly under it; the acknowledgement
  checkbox + confirm button move into their **own visually bordered box**
  at the bottom so the final gating step reads as a distinct, weightier
  step rather than just the last two lines on the page. No change to the
  "confirm disabled until checked" logic, the once-only read, or the
  English-only kit text.

### 13. Onboarding tour (`screens/onboarding.tsx`)
- Replace the dot-based position indicator with a **thin progress bar** at
  the top (fraction = current slide / total).
- Replace the **Back/Next text buttons** with **left/right arrow icon
  buttons** flanking the slide content (a lightbox/gallery feel); "Get
  started" stays a text button on the last slide (there is no "next" arrow
  once `nextSlide()` returns null). "Skip" moves to the top-right, always
  visible, de-emphasized (text-only, muted).
- No change to `onboarding-tour.ts`'s slide sequence, skip semantics, or the
  fact that Skip and "Get started" both mark the tour seen (D-U(b)).

## What does NOT change anywhere in this advance

- No new use case, port, repository, IPC message, or MCP surface. Every
  screen above already exists and already calls the same `bridge.*` methods;
  this advance is `desktop/src/renderer` presentation only (components +
  `styles/*.css`), same boundary `GUI/refined.md` §5.1 already draws
  ("the GUI is a delivery adapter").
- No color, font, spacing-scale or radius change — `tokens.css` is untouched.
  Icons are new (the mockups add stroke-SVG icons throughout, absent from the
  code today) but are a structural/content addition to existing buttons and
  nav items, not a style change; treat them as decorative, `aria-hidden`,
  never the only signal for a state (labels stay).
- No theme (D-Q) or language (D-V) mechanism change. Every new or moved
  string (the new left-panel trust copy, the recovery-kit banner, the
  onboarding progress semantics) must go through the existing i18n catalog
  (`shared/i18n/catalogs/en.ts` + `es.ts`) and `useT()`, in both languages,
  exactly like every existing string — no exceptions, no hardcoded copy.
- No curation, no new write path, nothing touching `D-A`'s boundary.
- Responsive/breakpoint behavior below the mockups' ~1120px reference width
  is not specified here — flag it as an open question for the refiner/planner
  if the app's window can be resized narrower than that today.

## Suggested slicing (not binding — planner's call)

The 13 screens above are naturally independent (each is its own component,
most share only the new sidebar shell and the new `AuthPanel`/`TrustPanel`).
A sensible slice order, front-loading the two shared pieces everything else
depends on:

1. Sidebar shell (replaces `nav-bar.tsx`) + breadcrumb pattern used by
   Project/Pack/Diagnostics/Import.
2. Shared `AuthPanel` + the 4 entry-cluster screens + migration-confirm.
3. Dashboard (incl. removing the filter that was never added to code) +
   Project detail.
4. Search + Context pack.
5. Connect tools + Import.
6. Diagnostics + Sync & safety.
7. Relocate wizard + Settings.
8. Recovery kit + Onboarding tour.

## Open questions for the refiner to settle with a default

- Icon source: hand-authored inline SVG (matches the mockups exactly, no
  dependency) vs. an icon library dependency. Given `SPEC.md` §9's "no
  network call at runtime" and the project's general dependency-shyness,
  default should probably be inline SVG, no new package — but the refiner
  should confirm this is the right default weighing bundle size / maintenance.
- Whether the new sidebar's width, breadcrumb component, and stat-card /
  table-section components should live in `desktop/src/renderer/components/`
  as shared pieces (several screens reuse the same shapes: stat cards in
  Sync, section-grouped tables in Diagnostics and Import) or stay local to
  each screen file — a DRY-vs-premature-abstraction call the refiner should
  make explicit with a default.
- Master-detail selection state (Search's left-column selection, Import's
  row checkboxes) — whether this is `useState` local to each screen
  (consistent with the codebase's existing per-screen state style) or needs
  a shared hook. Default: local `useState`, no new shared hook, matching how
  every other screen in this codebase already manages its own state.
