# GUI-LAYOUT — Left sidebar + breadcrumb navigation overhaul · Ship report

**Branch:** `feat/desktop-GUI` → merged into `main` with `--no-ff`
**Merge commit:** `ed3500d2e5d69a38b4d6622b1af2e59a837bb3ab`
**Base:** `main` (`8fb2ba1d678b565cfa2a805e92eb50db254819ba`)
**Review verdict:** `PASS` (third pass, `advances/GUI-LAYOUT/review.md`)

## What was done

Per Gate P (`plan.md`, `Approved: Oscar 2026-09-16`), this advance replaces the desktop app's top
navigation bar with a left sidebar + breadcrumb, and reworks each screen's internal layout to fit —
a structural/navigation change, not a visual-style or design-token change. Implemented slice by
slice, `typecheck && lint && test` green at every step:

1. Shell chrome logic (`state/workspace-chrome.ts`, pure) — the `WorkspaceView` → `{ sidebar, active,
   trail }` mapping, with `relocate-vault` as the sole `sidebar: false` view.
2. Sidebar + breadcrumb components, `layout.css`, and `app.tsx` wiring.
3. Dashboard card grid.
4. Project chips + pinned/rest grouping (`state/pinned-partition.ts`).
5. Search master-detail split (`state/search-selection.ts`).
6. Context pack rendered/raw toggle.
7. Connect-tools grid + rail.
8. Diagnostics grouped table (`state/diagnostic-groups.ts`).
9. Sync stat cards + banner.
10. Import table + rail + select-all — the riskiest slice, touching `import-selection.ts` and the
    conversation-table/import-screen split.
11. Entry-cluster split shell (`components/entry-shell.tsx`).
12. Relocation wizard step indicator (`state/relocation-steps.ts`).
13. Settings mini-tabs + segmented controls (`state/tab-navigation.ts`, ARIA APG roving focus).
14. Recovery-kit banner + gate box.
15. Onboarding progress bar + arrows.
16. `docs/gui.md` + a full acceptance sweep against `refined.md`.

No change to `tokens.css`, `main-window.ts`, the six structural/invariant tests
(`import-entry-points.test.ts`, `diagnostics.no-auto-run.test.ts`, `no-network-surface.test.ts`,
`recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`, `catalogs.test.ts`), or any file under
`src/`, `desktop/src/main/`, `desktop/src/preload/`, `desktop/src/shared/ipc/`.

## Review summary

Three passes. **Pass 1: FAIL** — Critical C1 (the Settings screen rendered a horizontal top strip
instead of the left mini-tab list §9/§5.10/§3.4-step-21 call for) plus warnings W1–W5 and several
suggestions. Fix commit `47eb93a` restructured `.screen.settings`/`.settings-tabs` to a CSS grid with
a left tab column, fixed the sidebar losing its own scroll (`.workspace { height: 100vh }`), the
unreachable `search.noSelection` copy key, an empty "Other items" heading on all-pinned projects, the
onboarding progress bar's position, and an unbounded import rail.

**Pass 2: FAIL** — the W1 fix regressed `relocate-vault`, the one screen with `sidebar: false`:
`.workspace-content` became the grid's only child and landed in the 220px sidebar-width column
instead of spanning full width. Fix commit `63c05d8` (24 lines, CSS-only) added
`.workspace:not(:has(.sidebar)) { grid-template-columns: minmax(0, 1fr) }`, plus two focus-ring gaps
on `.chip`/`.segmented`.

**Pass 3: PASS.** The reviewer traced the whole causal chain independently rather than trusting the
commit message — `workspaceChrome` returning `sidebar: false` only for `relocate-vault` (unit-tested),
`app.tsx` omitting `<WorkspaceSidebar>` for that case, and `.sidebar` having exactly one emitter in the
renderer — and confirmed all **70 of 70 acceptance criteria** met, no hard gate breached (security
surface, missing tests, ritual evidence, naming/architecture all clean), both suites green at
**303 / 930** tests.

## What is lacking (non-blocking, per review.md §7)

- **S1** — `.workspace:not(:has(.sidebar))` infers intent from a missing child class rather than an
  explicit `full-focus` modifier; correct today, but silently stops applying if anything else inside
  `.workspace-content` ever gets a `sidebar` class.
- **S2** — the select/deselect-all label ternary is duplicated between `conversation-table.tsx` and
  `import-screen.tsx` instead of derived once and passed down.
- **S3** — `workspace-sidebar.tsx`'s `sidebar-settings` class matches no stylesheet rule (dead hook).
- **S4** — the diagnostics `<caption>` duplicates its group's `<h2>` verbatim, double-announced to
  screen readers.

None touch the security surface, the test suite, the advance ritual, or the repo's architectural
conventions.

## Merge note: superseding a prior revert

`main`'s tip before this merge (`8fb2ba1`) was itself a revert of an earlier merge (`19097e1`,
2026-09-01) that had brought the desktop GUI + project-cards (CARDS) work into `main`, reverted ten
minutes later with no rationale recorded. `feat/desktop-GUI` never incorporated that revert and kept
building forward through IMPORT-ENTRY, IMPORT-FEEDBACK, PROJECT-NAME-SLUG, and this advance, unaware
of it.

Oscar decided explicitly to proceed with merging `feat/desktop-GUI` into `main`, superseding that
revert. Before merging, it was confirmed that `main`'s current tree is byte-identical to its
pre-merge tip (`4bd8cb9`), and that commit is an ancestor of `feat/desktop-GUI` — meaning this merge
is mathematically equivalent to a fast-forward: `feat/desktop-GUI`'s tip is a strict superset of
`main`'s content, so nothing on `main` is lost. The merge brings back, in one commit: the desktop
Electron GUI shell and project item cards (GUI, CARDS — both previously `Verdict: PASS`), the importer
entry-point and UX-feedback fixes (IMPORT-ENTRY, IMPORT-FEEDBACK), project-name slugging
(PROJECT-NAME-SLUG), and this advance's navigation overhaul (GUI-LAYOUT).

An initial file-by-file conflict resolution missed files that were unchanged on `feat/desktop-GUI`
since the merge-base but deleted on `main` by the revert (e.g. `desktop/package.json`,
`desktop/tsconfig.json`, `desktop/vitest.config.ts`) — git's 3-way merge does not flag "deleted on one
side, unchanged on the other" as a conflict, so these were silently dropped rather than restored. This
was caught before committing by comparing the full merge-base tree against the resolved index; the
merge was redone with `git read-tree --reset -u feat/desktop-GUI` (safe specifically because of the
fast-forward-equivalence proven above) and re-verified to be byte-for-byte identical to
`feat/desktop-GUI`'s tip before committing.

## Post-merge verification

Run against `main` at `ed3500d` after the merge:

- Root: `npm run typecheck` — clean. `npm run lint` — clean (327 files, 1 pre-existing `biome.json`
  migration info). `npm run test` — 57 files, 303 tests, all passing.
- `desktop/`: `npm run typecheck` — clean (both `tsconfig.json` and `tsconfig.web.json` projects).
  `npm run lint` — clean (164 files). `npm run test` — 64 files, 930 tests, all passing.

`main` is green.
