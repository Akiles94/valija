Verdict: PASS

# GUI · Slice 11 — The welcome tour, the Settings screen, and the shell they need — Review

**Branch:** `feat/desktop-GUI` · **Commits:** `8cc7f01` + `200f432` (reviewed together as one slice) ·
**Base:** `ad85718` (Slice 10, merged and reviewed) · **Plan:** third revision,
`Approved: Oscar 2026-08-25`.
**Reviewed:** the diff `ad85718..200f432` read in full, independently of either commit message. Both
suites run by hand, not taken on trust. This is the **second pass**; it re-derives every finding
rather than accepting the fix-up commit's account of itself.

The three blockers from the first pass are genuinely closed, and each was verified the same way it
was raised — by tracing, not by reading the claim:

- **C1** the cascade was traced by hand, element by element. `base.css:32-35`'s `[data-theme]` rule
  paints on the attribute itself, so the recovery kit's nested `data-theme="dark"` now computes its
  **own** `color`/`background` from the dark set and its descendants inherit *that* computed colour.
  The raw key goes from ≈1.05:1 to ≈13:1; §8.17's clipboard warning from ≈1.7:1 to legible amber on
  dark. **Closed.**
- **C2** `relocationFinished` (`app.tsx:117-123`) resets the view *and* locks, and it is wired end to
  end (`app.tsx:157` → `Router`'s `onVaultRelocated` prop `:175,185` → `:261` → `Workspace` `:280` →
  `RelocateVaultScreen onDone` `:328`). I grepped every path back into `unlocked` and every `onDone`
  call site in the wizard: there is exactly one, and it is covered. **Closed.**
- **C3** `state/overlay-nav.ts` + `state/preferences-write.ts` (+ `workspace-nav.ts`) are plain-TS
  modules with 122 lines of headless tests, running under the default `node` environment;
  `__dom-tests__/` was **not** touched and still holds exactly the two P-D5 screens. The
  `{header}`-count assertion is a real strengthening, not a re-worded grep. **Closed.**

What remains are three warnings and six suggestions, none of which touches a hard gate.

---

## 1. Acceptance criteria (`refined.md` §9, "Onboarding tour and Settings" 1768–1792, "Language"
1794–1799, plus D-Q's theme criterion at §4.8 step 38)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Tour shown automatically **exactly once per installation**, first time this installation reaches the dashboard, on **both** branches, **driven in tests by the persisted flag** | **Met** | `overlay-nav.ts:23-31` is branch-agnostic by construction — the entry branch is not a parameter — and `app.tsx:87-90` is its only caller. The criterion's own clause is now satisfied: `overlay-nav.test.ts:24-41` drives all four cases from `PREFS(tourSeen)` alone (locked → no tour; unlocked + `false` → tour; unlocked + `true` → no tour; an overlay already open is never interrupted) |
| 2 | **Skip** on every slide, sets the seen-flag, returns the user where the tour interrupted them; dots, **Back**, **Next**, **Get started** behave | **Met** | `onboarding.tsx:52-63`: Skip renders unconditionally, Back is suppressed on slide 1 via `previousSlide`, Get started replaces Next on the last slide, four dots at `:44-48`. Both exits route to `onDone` → `finishTour`, which writes through `tourSeenWrite` (`preferences-write.ts:19-22`, tested at `preferences-write.test.ts:39-46`). "Returns the user where they were" is now the module's `returnTo` field, tested both ways (`overlay-nav.test.ts:44-54`) |
| 3 | Seen-flag is **per installation, not per vault** | **Met** | `tourSeenWrite` emits exactly `{theme, language, tourSeen}` and `preferences-handlers.ts:14` merges over the device-local file; no vault id is involved anywhere |
| 4 | Tour opens **no vault session**, reads no vault content, no network, does not touch the idle-lock clock, writes nothing but its boolean | **Met** | `onboarding.tsx:1-8` imports only the policy, a type and `useT`; `onboarding-settings.no-session.test.ts:26-28` asserts the absence of a `state/bridge.js` import structurally. `no-network-surface.test.ts` covers the file, and now the stylesheets too |
| 5 | Tour **never appears before the recovery-kit acknowledgement**; four slides satisfy D-U(c)'s three guardrails **in both languages** | **Met** | Two independent guards: `overlay-nav.ts:29` refuses any phase but `unlocked` (so `kit-pending` can never open it), and `app.tsx:129,131` additionally gate on `canNavigateAwayFrom(state)`; `Router` returns the kit before the switch (`:189-199`). Copy re-read line by line in both catalogs: slide 2 *"not from this window"* / *"no desde esta ventana"*; slide 3 *browse/search/carry* — *"Explora, busca y llévalo contigo"*, no curation verb; slide 4 *"There is no password reset"* / *"No existe un restablecimiento de contraseña"*, no marketing adjective |
| 6 | **Show the welcome tour again** replays the same slides, any number of times, and **changes no other state** | **Met** | `settings.tsx:111-113` → `onReplayTour` → `replayTourFromSettings()` (`app.tsx:137`), same component, unbounded. "Changes no other state" is now literally true: `finishTour` (`app.tsx:107-115`) skips the write entirely when `shouldPlayTour(prefs)` is false, and `finishTourOverlay` returns the user to Settings (`overlay-nav.ts:43-45`, `overlay-nav.test.ts:50-53`) |
| 7 | Settings reachable **while the vault is locked**; opening it opens no session and touches no vault file | **Met** | Gear at `locked.tsx:65-70`; the overlay lives above the phase switch (`app.tsx:131`) exactly as P-D15 requires; `canNavigateAwayFrom` is true for `locked` (`session-state.ts:70-72`); `onboarding-settings.no-session.test.ts:30-32` asserts no bridge import |
| 8 | Settings contains **exactly the four sections D-U names**; Vault & sync **navigates to the existing** Diagnostics screen and relocation wizard; **no editable field** for `VALIJA_HOME` / `VALIJA_STATE_HOME` / `VALIJA_AUTOLOCK_MINUTES` | **Met (narrowing now disclosed)** | Four `<section>`s at `settings.tsx:41,62,83,109` and no fifth; the two buttons set an existing `WorkspaceView` (`app.tsx:138-145`); the only inputs are six radios bound to `theme` and `language`. The locked-state narrowing is unchanged in behaviour but is no longer silent — see W3 |
| 9 | Settings offers no path to destroying, re-keying or re-initializing a vault | **Met** | No such callback exists in the component's props, and the no-bridge-import scan makes it structurally impossible for the screen to reach one |
| 10 | Switching language applies **live** — no restart, no re-unlock | **Met** | `updatePreferences` (`app.tsx:95-98`) writes then re-reads and replaces `App`'s `preferences`; `I18nProvider`'s memo is keyed on `preferences.language` (`i18n-context.tsx:28-32`), so every `t()` consumer re-renders. The vault session is untouched. `preferences-write.test.ts:29-35` pins the merge that makes it safe |
| 11 | Both catalogs have identical key sets; no hardcoded user-facing string in a component | **Met** | Three keys added to each of `en.ts` / `es.ts`; `catalogs.test.ts` walks both directions and is green. Every string in `onboarding.tsx` / `settings.tsx` goes through `t()` |
| 12 | **The window re-themes immediately** on an Appearance change, and the recovery-kit screen stays permanently high-contrast dark (§4.8 step 38, D-Q) | **Met** | First half: `ThemedRoot` (`app.tsx:57-64`) sets `data-theme` from `useTheme()`; `theme-context.tsx:16-18` recomputes on every `preferences` change; `tokens.css` rebinds the custom properties. Second half, traced by hand: `[data-theme] {background; color}` (`base.css:32-35`) applies to the recovery kit's own div (`recovery-kit.tsx:51`), which also matches `[data-theme="dark"]`, so `var(--color-bg)`/`var(--color-text)` resolve **against its own** declarations → `#17181c` / `#f2f2f3`; descendants inherit that computed colour, `.kit-text`'s `var(--color-surface)` resolves to `#1f2126`, `.warning` to `#f5c451` on dark. `.recovery-kit {min-height:100vh}` (`screens.css:29-31`) makes it fill the window vertically. Cosmetic remainder in W1 |
| 13 | The app-preferences file still contains exactly four keys (§8.4) | **Met** | Every renderer write now funnels through `mergePreferencesWrite` (`preferences-write.ts:11-16`), which drops `vaultPath` by construction and is tested for it (`preferences-write.test.ts:14-21`); `preferences-handlers.ts:14` carries `vaultPath` forward. §8.6 holds: no path originates in the renderer |

### Plan items (`plan.md:844-950`)

| Item | Verdict | Evidence |
|---|---|---|
| 84 — `onboarding.tsx` renders from `policies/onboarding-tour.ts`'s slide list; opens no session, writes nothing itself | **Met** | `onboarding.tsx:2-7` (P-D14's sanctioned import); the component holds only `useState<SlideId>` |
| 85 — the four slides' copy guardrails, reviewed as content | **Met** | See criterion 5. Read in both languages, line by line, including a search for `organiza / edita / fija / elimina / etiqueta` — none present |
| 86 — **the ordering invariant, with the test that drives it from the persisted flag** | **Met** | The invariant is doubly enforced (criterion 5) and `overlay-nav.test.ts:24-41` is the test the item asks for, driven by `PREFS(tourSeen)` and nothing else. See S3 for the one case worth adding |
| 87 — `settings.tsx`, four sections, live language, Vault & sync links to the existing screens (P-D12) | **Met** | See criterion 8; P-D12 followed exactly — no read-only environment block is duplicated |
| 88 — "what Settings is not", **asserted by tests** | **Met (structurally)** | The no-bridge-import scan is stronger than it looks: a screen that cannot reach IPC cannot re-key, destroy or re-initialize anything, and cannot persist an environment override. The literal "no `VALIJA_HOME` field" assertion is still absent — S4 |
| 89 — the gear reaches the locked screen | **Met** | `locked.tsx:65-70`, plus `nav-bar.tsx:38-40` for every workspace screen |
| 89a — Diagnostics gains its dashboard entry point; header in **every** branch; exactly one `<DiagnosticsScreen` mount; two catalog keys | **Met** | `dashboard.tsx:58-66` builds `header` once and all four returns render it (`:70,79,88,104`); `diagnostics-entry-points.test.ts:27-35` now counts `{header}` occurrences and requires exactly 4, which is the item's distinguishing requirement made mechanical. `app.tsx:295` / `:138-141` wire both callbacks to the single mount at `:323` |
| 89b — `tokens.css` / `base.css` / `screens.css`; theme applied once on the shell root; `no-network-surface.test.ts` glob extended to `.css` | **Met** | Files exist, imported from `app-main.tsx:3-5`, P-D6 system font stack with no `@font-face`; `app.theme.test.ts` pins the single application point and the kit's hardcoded `dark`; the glob change (`no-network-surface.test.ts:21-33`) is correct and green over the three stylesheets. `.sr-only` is now defined (`base.css:129-138`), closing the first pass's W3 |
| 90 — five named tests | **Met (four of five directly, one by mechanism)** | (1) auto-play driven by the flag — `overlay-nav.test.ts:24-41`; (2) Skip sets the flag and returns the user where they were — `:44-53` + `preferences-write.test.ts:39-46`; (3) replay changes nothing else — `finishTourOverlay` + the `shouldPlayTour` write guard; (4) no idle-clock effect — the no-bridge-import scan; (5) live language — `preferences-write.test.ts:29-35` pins the merge, `i18n-context.tsx`'s key does the rest, but nothing asserts the re-render itself, which P-D5 forbids testing in a DOM. See S5 |
| P-D15 — overlays in `app.tsx`, guarded by `canNavigateAwayFrom` | **Met** | `app.tsx:71,129-146`, with the decision itself extracted to `overlay-nav.ts` |
| P-D11 — source-scan test rather than a third jsdom screen | **Met** | `diagnostics-entry-points.test.ts` in the named idiom; `__dom-tests__/` still holds exactly `recovery-kit.dom.test.tsx` and `relocate-vault.dom.test.tsx`, and no new `@vitest-environment jsdom` pragma appears anywhere in the diff (checked by grepping added lines) |
| P-D20 — `.css` in the glob | **Met** | `no-network-surface.test.ts:21-33` |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** No secret, key or passphrase is logged, written or newly crossed over IPC; no `console.*` in any new file (added lines grepped for `console.`, `passphrase`, `secret`, `fetch(`, `http`, `localStorage` — the only hits are the words "key" in `Record` keys and prose). Key derivation, keychain use and SQLCipher keying are untouched: **no file under the repo's `src/` is modified at all**, no IPC channel, no zod schema, no preload method. Every renderer write goes through `mergePreferencesWrite`, which cannot emit `vaultPath` (§8.6), and `preferences-handlers.ts` carries it forward. CSP (`windows/main-window.ts:4-13`) unchanged and already permitted `style-src 'self' 'unsafe-inline'`. No MCP change. **The one security-copy consequence of the first pass is repaired**: §8.17's clipboard warning and the one-time raw key are now high-contrast on the kit's own dark subtree |
| Tests for new behaviour, suite green | **Met.** Root **57 files / 301 tests**, desktop **44 files / 623 tests** — both counts exactly as claimed, both green, typecheck and lint clean in both trees, all six commands run by hand. Nothing is skipped, `.todo`'d or `xit`'d (grepped; the single "skip" hit in the tree is an `import-handlers` fixture field named `skipped`). The three previously-missing test items are now real headless unit tests over pure modules. One residual, judged below the gate rather than at it — W2 |
| Advance ritual | **Met.** `refined.md:3` `Approved: Oscar 2026-08-20` (Gate R closed); `plan.md:3` `Approved: Oscar 2026-08-25` (third revision, Gate P re-closed); this `review.md` closes the trail. No `package.json`, lockfile, `electron.vite.config.ts` or `electron-builder.yml` edit in the diff |
| Conventions, naming, placement | **Met.** `screens/onboarding.tsx`, `screens/settings.tsx`, `renderer/styles/{tokens,base,screens}.css` and the two source-scan tests land where `plan.md` §9's approved tree puts them. The first pass's one placement objection is resolved: the overlay decision and the preferences-write narrowing now live in `renderer/state/` as plain-TS modules beside `session-state.ts` / `workspace-nav.ts` / `unlock-outcome.ts`, which is what `plan.md:1898` ("plain TS view state … all `.test.ts`'d"), `plan.md:1411` and `refined.md:489-492` require. `overlay-nav.ts` names itself after `workspace-nav.ts`; `preferences-write.ts` sits with the other derivation modules. `renderer/` is not a `domain/application/infra` layer root, so `app.theme.test.ts` beside `app.tsx` is not a bare-file breach, and it follows the `no-network-surface.test.ts` idiom. The renderer → `main/application/policies` imports (`shouldPlayTour`, `markTourSeen`, `resolveTheme`, `resolveSystemOrOverride`) are P-D14's confirmed shape |

**No gate breached.**

---

## 3. Line count (`desktop/src` only; `advances/**` excluded)

| | Lines |
|---|---|
| Production — `settings.tsx` 121 · `base.css` 139 · `app.tsx` +139/−19 · `screens.css` 89 · `onboarding.tsx` 66 · `overlay-nav.ts` 49 · `tokens.css` 33 · `preferences-write.ts` 22 · `dashboard.tsx` +17/−4 · `workspace-nav.ts` +10 · `diagnostic-rows.ts` +9 · `locked.tsx` +8 · `nav-bar.tsx` +6/−1 · `diagnostics.tsx` +5/−1 · `app-main.tsx` +3 · catalogs +8 | **724 added / 25 removed** |
| Of which CSS | 261 (budget was ~320 — `plan.md:1640`) |
| Tests — `overlay-nav.test.ts` 66 · `diagnostics-entry-points.test.ts` 50 · `preferences-write.test.ts` 47 · `onboarding-settings.no-session.test.ts` 33 · `app.theme.test.ts` 27 · `workspace-nav.test.ts` 9 · glob edit 7 | **239 added / 1 removed** |
| Test : production ratio | **0.33** overall; **0.52** against the 463 non-CSS production lines (was 0.19) |

Proportionate. The two new screens are still the right size (66 and 121 lines, one render each), the
three extracted state modules are 81 lines carrying 122 lines of tests, and no file in the diff is
oversized.

---

## 4. Issues

### Critical

**None.** C1, C2 and C3 are closed; the verification is in §5.

### Warning (does not by itself hold the merge)

**W1 — the recovery kit is now a dark 720px column on a light 1100px window, not a dark screen.**
The contrast defect is genuinely fixed, which is what mattered, but D-Q's wording is *"the
recovery-kit screen stays permanently high-contrast dark"* and only the content column is. The div
that carries `data-theme="dark"` is the same div that carries `.screen`
(`recovery-kit.tsx:51`), and `.screen` is `max-width: 720px; margin: 0 auto` (`base.css:41-45`); the
window defaults to 1100×720 (`windows/main-window.ts:16-17`), so in **light** theme the exempt screen
renders with ~190px of white gutter on each side. Harmless for legibility, wrong for a screen whose
whole point is to look unmistakably different, and Slice 12 photographs it. Two-line fix: split the
wrapper so the attribute is on a full-bleed element —
`<div className="recovery-kit" data-theme="dark"><div className="screen">…</div></div>` — and drop
`recovery-kit` from the `.screen` class list. Not charged against criterion 12 because the fix
shipped is precisely the one the first pass prescribed, and the binding half (the one-time key and
the §8.17 warning being readable) is met.

**W2 — S4's new `fatal` field is the one piece of new behaviour in this diff with no assertion on
it.** `DiagnosticRow.fatal` (`diagnostic-rows.ts:18`), `isFatal` (`:61-63`) and the hardcoded
`fatal: false` on the tool-Node row (`:95`) ship untested, and `diagnostics.tsx:29`'s
`ok ? "ok" : fatal ? "fatal" : "warning"` is inside a component P-D5 forbids rendering in a test.
I re-read `diagnostic-rows.test.ts` in full: it is still green and still meaningfully tests what it
claims — every assertion uses optional-property access (`rows.find(...)?.status`), not a whole-row
`toEqual`, so the new required field breaks nothing and hides nothing, and Slice 10's own criterion 3
is *improved* rather than regressed (a non-fatal warning no longer paints with `--color-danger`).
But `it("labels ok / warning / fatal correctly for a regular check")` at `:52-68` already feeds the
exact three inputs — `{ok:true}`, `{ok:false}`, `{ok:false,fatal:true}` — and asserts only `status`.
Three added lines (`expect(rows.find((r) => r.key === "node")?.fatal).toBe(true)` and the two
`false` cases) would close it. Judged below the tests-for-new-behaviour gate rather than at it,
deliberately and on the record: it is one derived boolean whose branch condition is character-for-
character the already-tested `statusLabel` condition (`:56-59`), in a module whose every other
derivation is covered. It is the closest call in the slice; add the assertions in Slice 12's pass.

**W3 — the locked-state narrowing of Vault & sync is disclosed but not yet recorded where a user or
a future maintainer will find it.** W1 of the first pass offered two honest exits; the slice took
(b), and the comment at `settings.tsx:84-93` is exactly the clearly-flagged narrowing that option
required — it names the affected user ("someone who cannot unlock has no route to *Check my
setup*"), names the reason, and names where the record is owed. The locked branch now renders
`settings.vaultAndSyncLocked` in both catalogs (`en.ts:293`, `es.ts:301`) rather than an empty
section, so nothing vanishes silently on screen either. The debt itself is still open: `docs/gui.md`
(Slice 12) and a `refined.md` amendment. Carry it as a named Slice 12 obligation, the way W4 was
carried, or it will be forgotten the way W4 nearly was.

### Suggestion

**S1 — `.check-row.warning` accidentally inherits the global `.warning` colour, inverting the
emphasis between warnings and failures.** `base.css:101-103` paints any `.warning` element with
`--color-warning`, and `diagnostics.tsx:29` now puts that same class name on the whole `<li>`, so a
warning row's *entire* text — name, status, explanation, detail — turns amber, while a **fatal** row
gets only a red border and ordinary text. Legibility is fine in both themes (`#8a5a00` on white,
`#f5c451` on `#17181c`), but the louder treatment is on the less severe row. Either scope the base
rule (`p.warning`) or name the severity classes so they cannot collide —
`.check-row--warning` / `.check-row--fatal` — and give the fatal row's status the danger colour.

**S2 — `resetWorkspaceView()` is a named alias for a constant, and the invariant it exists to
express still lives only in a comment.** `workspace-nav.ts:22-24` returns `INITIAL_WORKSPACE_VIEW`,
and its test (`workspace-nav.test.ts:5-8`) is close to tautological. The real rule — *the view is
reset at every transition out of `unlocked`* — is enforced by `app.tsx:117-123` pairing two setters
and by a comment asking future callers to do the same. Today that is airtight (I grepped: `afterLock`
has exactly two call sites, and the other is the `no-vault` → `locked` transition where the view is
already initial), but it is one careless `setState(afterLock())` away from regressing to C2. A
combined transition — `lockFromWorkspace(): { state: SessionState; view: WorkspaceView }`, or folding
the view into the session state — makes the pairing impossible to forget and gives the test something
non-trivial to assert.

**S3 — `overlay-nav.test.ts` covers `locked` but never `kit-pending`, which is the phase item 86 is
actually about.** `autoTourOverlay`'s `state.phase !== "unlocked"` guard covers both, and the
`locked` case exercises the same branch, so this is not a hole in the code — but the test that
*names* the ordering invariant should assert the state the invariant is about. One line:
`expect(autoTourOverlay(CLOSED_OVERLAY, { phase: "kit-pending" }, PREFS(false))).toEqual(CLOSED_OVERLAY)`.

**S4 — item 88's two negative claims are still proven only by implication.** The no-bridge-import
scan makes them true, but `onboarding-settings.no-session.test.ts` could say so directly, in the same
source-scan idiom and for the same cost: `expect(SETTINGS).not.toMatch(/VALIJA_(HOME|STATE_HOME|AUTOLOCK_MINUTES)/)`
and an assertion that the file contains no `<input` whose `type` is `text`. Cheap, and it makes the
guarantee legible to the next reader instead of requiring the inference.

**S5 — a rejected `preferences:write` is still an unhandled promise rejection.** `finishTour`
(`app.tsx:107-115`) now closes in a `finally`, which is the right fix for the trap — but the
rejection is re-thrown out of the `try` into `void finishTour()` (`:130`), and the same holds for
`void updatePreferences(patch)` (`:135`). Nothing is logged that shouldn't be (preferences only), and
no state is corrupted, but the user gets no signal at all when a radio silently does nothing. A
`catch` that surfaces one localized sentence — or, at minimum, `.catch(() => {})` at the two call
sites to keep the rejection deliberate rather than accidental — closes it.

**S6 — `updatePreferences` closes over the render's `prefs`, so two fast successive changes can
clobber each other.** `app.tsx:93,95-98`: the base of the merge is the value captured at render
time, not the latest. Click *Dark* and then *Español* before the first write's re-read resolves and
the second write reverts the theme. The window is milliseconds wide and the pre-existing code had the
same shape, so this is not new — but the fix is small (merge inside a `setPreferences` updater, or
serialize writes through a single in-flight promise) and this is the slice that made preference
writes a user-facing control.

**S7 — an OS theme change mid-session is still not followed** (carried from the first pass, still
within spec). `theme-context.tsx:16-18` reads `matchMedia(...).matches` inside a `useMemo` keyed on
`preferences`, so with Appearance on *Follow system* the window picks up an OS switch only on
relaunch. D-Q's binding criterion is the *user's* Appearance change, which works — and now that the
theme is actually painted, a `matchMedia` change listener is ~5 lines and adds no timer.

**S8 — no gear on `no-vault.tsx` / `create-vault.tsx`** (carried, still within spec). §4.8 step 37
names "dashboard, project view, or the locked screen". Noting it once more because a Spanish speaker
on an English-locale OS meets the §8.17 passphrase warning before any surface offers the language
switch.

---

## 5. What was verified by hand rather than taken on trust

- `npm run typecheck && npm run lint && npm run test` in `desktop/` **and** at the repo root. All six
  green. **Desktop: 44 files / 623 tests. Root: 57 files / 301 tests** — both counts as claimed. Root
  lint prints the same pre-existing `biome migrate` info as last pass, unrelated to this diff.
- **C1 re-derived, not assumed.** `[data-theme]` is `(0,1,0)`, the same specificity as
  `[data-theme="light"]`, but they set disjoint properties, so there is no conflict to resolve. On
  the kit's div both selectors match: the custom properties resolve from the **dark** block and the
  `var()`s in the paint rule resolve against that element's own computed values, so it repaints
  itself rather than inheriting the shell's already-computed `color`. Descendants then inherit
  `#f2f2f3`; `.kit-text`'s `var(--color-surface)` → `#1f2126` (≈13:1); `.warning` → `#f5c451` on
  `#17181c`; `.explainer` → `#a2a6ad`; `button` → dark surface, light text. `resolveTheme` can only
  return `"light" | "dark"` (`theme-resolution.ts` via `theme-context.tsx:16-18`), so `[data-theme]`
  never matches a third value. `box-sizing: border-box` is global, so `min-height: 100vh` plus 24px
  padding does not produce a second scrollbar against `.app-shell`'s own `100vh`.
- **C2 re-derived.** `relocationFinished` traced through all four hops to `RelocateVaultScreen`'s
  `onDone`; `grep -n onDone src/renderer/screens/relocate-vault.tsx` returns three lines — the prop,
  its type and `onUnlockAgain={onDone}` at `:131`, reachable only from `stage.step === "done"`. So
  there is exactly one path back and it resets. `afterLock` has two call sites in `app.tsx` (`:122`
  and `:210`); the second is `no-vault` → `locked`, where the view is already initial and no
  workspace has existed. No idle-lock or session-expiry subscription exists in the renderer yet
  (grepped), so no third path.
- **C3 re-derived.** `vitest.config.ts` sets `environment: "node"` globally and jsdom is opted into
  per file by the `// @vitest-environment jsdom` pragma; grepping the added lines for that pragma
  returns nothing, and `screens/__dom-tests__/` still contains exactly the two P-D5 files. The new
  tests are therefore genuinely headless. `diagnostics-entry-points.test.ts:33` counts `{header}` and
  requires exactly 4; `dashboard.tsx` has exactly four returns (`:68,77,86,102`), each rendering `{header}` (`:70,79,88,104`) —
  the count would fail if a branch dropped the header, which is what the old presence-only assertion
  could not do.
- **W2 checked against Slice 10.** `diagnostic-rows.test.ts` re-read end to end: all nine cases use
  `?.` property access, none does a whole-row `toEqual`, so the new required field cannot silently
  satisfy a stale assertion. Green, and still testing what it claims.
- Both tour catalogs re-read in English and Spanish against D-U(c)'s three guardrails, including the
  search for `organiza / edita / fija / elimina / etiqueta` — none present.
- `preferences-handlers.ts` re-read: unchanged by this slice, and the renderer's three-key write
  still cannot clobber `vaultPath` (§8.6). `windows/main-window.ts` re-read: CSP unchanged, and the
  bundled stylesheets need no relaxation of `style-src 'self' 'unsafe-inline'`.
- `git diff --numstat ad85718..200f432`: the only non-`advances/` paths are under `desktop/src`. No
  `package.json`, no lockfile, no build config, and no file under the repo's `src/` — the "root suite
  unchanged" claim is structural, not incidental.
- `exactOptionalPropertyTypes: true` is inherited by both desktop tsconfigs, so
  `Partial<PreferencesWriteRequest>` cannot smuggle an explicit `undefined` through
  `mergePreferencesWrite`'s spread.

---

## 6. Standing obligations for Slice 12

Not merge gates; named here so they are not lost:

1. **W3** — record the locked-state Vault & sync narrowing in `docs/gui.md` **and** as a `refined.md`
   amendment. The code comment is the promise; these are the payment.
2. **W1** — full-bleed the recovery kit before the bilingual screenshots are taken.
3. **W2** — three assertions on `DiagnosticRow.fatal`.
