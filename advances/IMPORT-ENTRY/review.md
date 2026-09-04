Verdict: PASS

# IMPORT-ENTRY — change review

**Reviewed:** working-tree diff on `feat/desktop-GUI` (HEAD `ef8baa7`, an unrelated pre-existing
commit from 2026-08-27 — the advance is entirely uncommitted at review time).
**Spec:** `advances/IMPORT-ENTRY/refined.md` (Gate R closed, Oscar 2026-09-04).
**Plan:** `advances/IMPORT-ENTRY/plan.md`, line 1 carries
`Approved: Oscar 2026-09-04 — branch: feat/desktop-GUI (P-D1 overridden…)`.

I re-derived every claim below from the tree, not from the hand-off note.

---

## 1. Diff scope

`git diff --name-only` + `git status --porcelain -uall`:

```
 M desktop/src/renderer/screens/dashboard.tsx
 M desktop/src/renderer/styles/screens.css
 M docs/gui.md
?? desktop/src/renderer/screens/import-entry-points.test.ts
?? advances/IMPORT-ENTRY/plan.md, refined.md          (advance ritual artifacts)
```

Exactly the four paths `plan.md` §9 mandates, plus the ritual documents. **Nothing** under `src/`,
`desktop/src/main/**`, `desktop/src/preload/**`, `desktop/src/shared/ipc/**`, no catalog
(`en.ts`/`es.ts`), no `package.json`, no `package-lock.json`, no `CHANGELOG.md` (P-D2 default held),
no vitest/electron config.

### Line count

| File | + | − | Plan estimate |
|---|---|---|---|
| `desktop/src/renderer/screens/dashboard.tsx` | 11 | 4 | +7 net — **exact** |
| `desktop/src/renderer/styles/screens.css` | 4 | 0 | +4 — **exact** |
| `docs/gui.md` | 4 | 2 | ~2 rewrapped lines + one clause — close |
| `desktop/src/renderer/screens/import-entry-points.test.ts` (new) | 58 | — | ~50 — close |
| **Total** | **77** | **6** | ≈11 production / ≈50 test / ≈2 docs |

---

## 2. Acceptance criteria (`refined.md` §6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Import visible from a dashboard with ≥1 project card; click lands on `ImportScreen` | **Met** | `dashboard.tsx:64` button → `onImportHistory`; the populated branch interpolates `{header}` at `dashboard.tsx:111`; `app.tsx:323` `onImportHistory={() => setView({ screen: "import" })}`; `app.tsx:328` mounts `<ImportScreen bridge={bridge} />` |
| 2 | Same entry point in the empty, loading and error branches | **Met** | Button lives inside the shared `header` const (`dashboard.tsx:60–72`), interpolated at lines 77 (error), 86 (loading), 95 (empty), 111 (populated) |
| 3 | Empty state keeps the Connect / Import pair (D-2 A) | **Met** | `dashboard.tsx:97–104` untouched by the diff — the hunk stops at line 72 |
| 4 | Exactly four `{header}` interpolations; `diagnostics-entry-points.test.ts:27–34` passes untouched | **Met** | That file is not in the diff; ran it verbatim — 5/5 green, including the `toHaveLength(4)` assertion |
| 5 | `app.tsx` mounts exactly one `<ImportScreen`; dashboard navigates by caller-supplied callback, never imports `bridge.js`/`workspace-nav` | **Met** (per A2's approved reading) | `import-entry-points.test.ts:52–57` asserts the mount count and `onImportHistory=`; lines 47–50 assert `not.toContain("setView")` / `not.toContain("workspace-nav")`. See §5 below on the literal `bridge.js` clause |
| 6 | No new i18n key (D-3 A) | **Met** | Diff touches no catalog; `en.ts:94` / `es.ts:95` `importHistory` already existed; `catalogs.test.ts` still green in the full run |
| 7 | A test that **fails against pre-fix `dashboard.tsx`**, not a bare `toContain` | **Met** | Verified independently, read-only: extracted `git show HEAD:…/dashboard.tsx` and replayed the test's exact string logic. Pre-fix `headerBlock(...)` yields the old two-child header, so `HEADER.toContain("onImportHistory")` → **false** and `HEADER.toContain("dashboard.importHistory")` → **false** (test 1 fails red). A whole-file `toContain("onImportHistory")` → **true** pre-fix, confirming the header slice is doing the load-bearing work |
| 8 | `typecheck && lint && test` green in `desktop/` and root | **Met** | `desktop/`: tsc (both projects) clean, `biome check .` 128 files clean, vitest **47 files / 650 tests passed**. Root: tsc clean, `biome check .` 291 files clean (one pre-existing config-migration *info*, unrelated), vitest **57 files / 301 tests passed** |
| 9 | Diff touches no `src/`, no `desktop/src/main/**`, no `desktop/src/shared/ipc/**`, no `package.json` | **Met** | §1 above |
| 10 | Two header buttons render as a group at the right; **Check my setup** has not moved (D-5, D-6) | **Met** | `screens.css:13–16` `.dashboard-header .header-actions { display:flex; gap:8px; }`; `.dashboard-header` (lines 4–9, `space-between`) untouched, so it now has exactly two children (h1, group). Import is first in source order (`dashboard.tsx:64`), Check my setup second (`:67`), pinned by the `indexOf` assertion at `import-entry-points.test.ts:39` |
| 11 | Both languages render without wrapping or clipping at the default window size (`es` explicitly) | **Met by construction** — see W1 | Not verifiable headlessly, so I derived it: `.screen` is `max-width:720px; padding:24px` (`base.css:43–47`), i.e. a 672px content column; the dashboard sits under `.workspace` (`app.tsx:311`), **not** as a direct child of `.app-shell`, so the 480px `.app-shell > .screen:not(...)` rule (`base.css:60–64`) does not apply. Spanish worst case: `h1` "Panel" (1.5rem) + 16px gap + "Importar tu historial de chats" + 8px + "Revisar mi configuración", each button `padding:8px 16px` + 1px borders ≈ **550px of 672px**. No `white-space:nowrap` exists on `button` (`base.css:80–88`; the only `nowrap` is `.sr-only`), so the degenerate failure mode is intra-button wrapping, never clipping. Window default 1100×720 (`main/windows/main-window.ts:17`) |
| 12 | `docs/gui.md` states where the entry point lives (D-7 A) | **Met** | `docs/gui.md:167–168`, in the same voice as §"Diagnostics" line 180 |

**Twelve of twelve met.** None unclear.

---

## 3. Plan adherence (`plan.md` §2)

| Step | Verdict |
|---|---|
| 1 — `dashboard.tsx` header JSX | **Verbatim.** The wrapper `<div className="header-actions">`, the Import button before Check my setup, and P-D5's three extra comment lines (`dashboard.tsx:57–59`) match the plan's block character for character. Props, `useEffect`, `bridge.content.projects()`, and lines 74–137 untouched |
| 2 — `screens.css` rule | **Verbatim**, inserted immediately after `.dashboard-header h1 { margin: 0; }`, keeping the `/* dashboard.tsx */` section contiguous. `.dashboard-header` itself not edited |
| 3 — `import-entry-points.test.ts` | **Verbatim**, including the docblock, the throwing `headerBlock` helper, and all five `it`s. Picked up by `desktop/vitest.config.ts`'s `src/**/*.test.ts` with no config change (A6 holds) |
| 4 — `docs/gui.md` clause | **Wording verbatim**, but the rewrap is ragged — see S1 |
| 5 — gates | All six commands re-run by me; all green |

Deviations: **one**, cosmetic (S1). No undocumented deviation.

---

## 4. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened? | **No.** Zero new IPC channels, zero preload/bridge surface change, no zod schema touched, no keychain/Argon2id/SQLCipher code in the diff, no `Database` handle, no key or session observed by the header. No path string, no `href`, no URL, no `shell.openExternal`, no telemetry added — the import file handle still originates in `bridge.dialog.chooseImportFile()` (main process). `grep -n "console\." dashboard.tsx` → no match: no logging sink added, so no secret can leak through one. MCP surface (5 tools + 2 prompts) untouched because nothing under `src/` is touched; likewise `SPEC.md` §10a's pack exclusion and the single `ImportConversations` → `ImportItems` write path. Net writes added by this advance: **zero** |
| Tests for new behavior + suite passing? | **Yes.** New test present, proven red against pre-fix source, and both suites green (650 + 301) |
| Advance ritual evidenced? | **Yes.** `refined.md` (Gate R approved in its header, line 3) → `plan.md` with `Approved: Oscar 2026-09-04` on line 1 → this `review.md`. P-D1's branch override is recorded on that same line, so shipping on `feat/desktop-GUI` is authorized rather than a silent deviation |
| Naming / placement / clean-architecture conventions? | **Yes.** No file created under any `domain/`, `application/`, or `infra/` folder — so CLAUDE.md's "no bare files at a layer root" rule has nothing to bite on. The new test sits beside the screens it reads, named for the guarantee it guards, exactly mirroring `diagnostics-entry-points.test.ts`. `.header-actions` is kebab-case like every neighbouring class and is scoped under `.dashboard-header` so it cannot leak. No new domain term, no new prop, no new component |

No gate breached.

---

## 5. `refined.md` A2 — the literal "never imports `bridge.js`" clause

Criterion 5 reads "…and never imports `bridge.js` or `workspace-nav`". `dashboard.tsx:3` has
`import type { ValijaBridge } from "../state/bridge.js";` — pre-existing, type-only, erased at
compile time, and required by the `bridge` prop the component uses at line 38. The diff does not
touch it, and §8 forbids touching the props. The plan's A2 declared this reading and Gate P approved
it. I accept it: the property the criterion is protecting — *the dashboard does not navigate itself*
— is asserted mechanically (`not.toContain("setView")`, `not.toContain("workspace-nav")`) and holds.
For the record, `diagnostics-entry-points.test.ts`'s docblock already asserts the same loose claim
("neither imports `bridge.js`"), so the imprecision predates this advance. **Not a defect here**; if
Oscar wants the clause to mean something literal, it is a spec rewording, not a code change.

---

## 6. Issues

### Critical

None.

### Warning

- **W1 — the required manual bilingual check is unrecorded.** `plan.md` §4 marks the `en`/`es`
  header walkthrough "**Manual, required**", and A5 says a clipped Spanish header must be *reported*,
  not silently patched with `flex-wrap`. Nothing in the tree records that anyone ran
  `npm run dev` and looked. I closed criterion 11 by deriving the layout from the stylesheets
  (fixed 672px column, ~550px worst-case Spanish header, no `nowrap` on `button`), which is strong
  evidence but is not the check the plan asked for. **Action:** before shipping, run the two-minute
  walkthrough (unlock a vault with ≥1 project → look at the header in `en` → switch to `es` in
  Settings → look again → click Import → confirm `ImportScreen`'s "choose" stage → nav bar
  **Dashboard** returns) and say so in the commit body. This does not gate the merge on its own —
  the diff is correct either way — but the plan promised it.

- **W2 — `headerBlock` can slice past the header and pass vacuously in one refactor shape.**
  `import-entry-points.test.ts:22–23` takes the *first* `\n  );` after `const header = (`. If a
  future edit changes the header constant's closing indentation without renaming it, the guard's
  `start < 0 || end < start` throw does **not** fire: `indexOf` finds the next two-space-indented
  `);`, which is the component's final `return (…)` close at `dashboard.tsx:136`. The slice would
  then be the whole component body, and the empty branch's own `onImportHistory` /
  `dashboard.importHistory` (lines 101–102) would satisfy tests 1 and 2 — reinstating precisely the
  bug this file exists to catch. Cheap hardening, one line, no new dependency: after slicing, assert
  the block is really just the header, e.g.
  `expect(HEADER).not.toContain("projects.length === 0")`, or bound the search with
  `source.indexOf("\n\n", start)`. Worth doing because this test is the *only* mechanical guard on
  the advance.

- **W3 — the D-6 ordering assertion is vacuously true when Import is absent.**
  `import-entry-points.test.ts:39`: against the pre-fix header, `HEADER.indexOf("onImportHistory")`
  is `-1` and `HEADER.indexOf("onCheckSetup")` is `21`, so `-1 < 21` **passes**. I verified this on
  the pre-fix source. It is harmless today because test 1 in the same file fails loudly in that
  scenario, but read alone the assertion asserts nothing. Prefer
  `expect(HEADER.indexOf("onImportHistory")).toBeGreaterThanOrEqual(0)` first, or fold the ordering
  into test 1.

### Suggestion

- **S1 — `docs/gui.md:170` is a 38-character orphan line** in a paragraph that otherwise wraps at
  88–100 columns (`plan.md` step 4 said the paragraph "rewraps at the file's existing width"; it was
  only partially rewrapped). Reflow lines 167–174 so the clause reads as one paragraph. Pure
  cosmetics — Biome does not format Markdown here, so nothing catches it.

- **S2 — duplicate accessible name on the empty dashboard.** D-2 Option A (approved) means an empty
  vault renders two buttons whose accessible name is identical ("Import your chat history" /
  "Importar tu historial de chats") — one in the header, one in `.actions`. Sighted users get
  position as the disambiguator; a screen-reader user hears the same button twice in one view. Not a
  defect of this advance (the spec chose it, and the duplication is empty-state-only), but if it ever
  bothers anyone, the header instance is the one that should carry an `aria-label` variant or the
  shorter `dashboard.importHistoryShort` copy from D-3 Option B — a follow-up, not a change here.

- **S3 — `.header-actions` is a global class name in a global stylesheet.** The *rule* is correctly
  scoped (`.dashboard-header .header-actions`), so nothing leaks *out*; but the class name itself is
  generic enough that a future screen adding its own `.header-actions { … }` rule would leak *in*.
  `.dashboard-header-actions` would be immune. Low value — the plan settled this selector at D-5 and
  every neighbouring class follows the same convention — so change it only if a second header ever
  wants the pattern.

- **S4 — both entry-point tests now `readFileSync` `dashboard.tsx` and `app.tsx` independently** and
  both assert the `{header}` count of 4. `plan.md` §4 deliberately duplicates that invariant so the
  fix's own test owns what it could break; I agree with the reasoning and note the redundancy only so
  a future reader does not "tidy" one away. Four small synchronous reads at module scope, ~2ms — no
  performance concern.

---

## 7. Nothing that would flip this to FAIL

The advance does exactly what it says: it moves one button into an element that already renders in
all four branches, proves it with a test that demonstrably fails against the old file, documents it
in the one place the docs describe the feature, and touches nothing else. W1–W3 are worth fixing —
W2 in particular, since it is the guard's own blind spot — but none of them makes a shipped user
worse off or leaves an acceptance criterion unmet, so they are follow-ups, not blockers.

---

## 8. Post-review addendum (main agent, before ship)

Oscar asked for W2 and S1 to be applied before shipping; both are done and re-verified:

- **W2 fixed** — `import-entry-points.test.ts`'s first `it` now also asserts
  `expect(HEADER).not.toContain("projects.length === 0")`, closing the over-run failure mode this
  finding named. Re-ran the full `desktop/` suite after the change: 47 files / 650 tests, still green.
- **S1 fixed** — `docs/gui.md`'s §"Importing your chat history" paragraph (lines 167–172) reflowed as
  one continuous paragraph; no more orphan line.
- **W1 addressed, with stronger evidence than either of us had at first pass** — rather than
  deriving the layout from the stylesheet only, rendered the actual `header` markup and the real
  `screens.css`/`base.css`/`tokens.css` in Chromium (via Playwright, headless, no Electron/keychain
  boot needed since this is a presentation-only change) at 1080px and 800px, in both `en` and `es`.
  Confirms: both buttons render as a single right-aligned group, `es`'s longer labels
  ("Importar tu historial de chats" / "Revisar mi configuración") neither wrap nor clip at either
  width, and the result matches Oscar's own screenshot of the running app (title, card, spacing)
  with the new Import button now present. Screenshots are scratch artifacts, not committed.
- **W3, S2, S3, S4 — left as documented follow-ups**, not applied. They don't change behavior, aren't
  part of what Oscar asked to fix now, and are already fully described above for whoever picks them
  up later.

Diff scope unchanged by these fixes: still exactly
`desktop/src/renderer/screens/dashboard.tsx`, `desktop/src/renderer/styles/screens.css`,
`desktop/src/renderer/screens/import-entry-points.test.ts`, `docs/gui.md`. Verdict stands: **PASS**.
