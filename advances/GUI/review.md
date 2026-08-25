Verdict: FAIL

# GUI · Slice 11 — The welcome tour, the Settings screen, and the shell they need — Review

**Branch:** `feat/desktop-GUI` · **Commit:** `8cc7f01` · **Base:** `ad85718` (Slice 10, merged and
reviewed) · **Plan:** third revision, `Approved: Oscar 2026-08-25`.
**Reviewed:** the diff `ad85718..8cc7f01` read in full, independently of the commit message. Both
suites run by hand, not taken on trust.

Three things hold this slice: a stylesheet that **breaks the recovery-kit screen in light theme**
(the raw key renders dark-on-dark and the clipboard warning yellow-on-white), a **navigation
regression** introduced by lifting `WorkspaceView` into `App` (a user who relocates their vault and
unlocks again lands back inside the relocation wizard), and **item 86's and item 90's tests, none of
which were written** — the three new test files are text greps that would pass on a materially
broken implementation.

The rest of the slice is good: the tour copy meets D-U(c) in both languages, neither new screen
imports the bridge, Settings has exactly four sections and no editable environment field, P-D12 and
P-D14 and P-D15 are followed as approved, and W4 is genuinely closed for the unlocked case.

---

## 1. Acceptance criteria (`refined.md` §9, "Onboarding tour and Settings" 1768–1792, "Language"
1794–1799, plus D-Q's theme criterion at §4.8 step 38)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Tour shown automatically **exactly once per installation**, first time this installation reaches the dashboard, on **both** branches, **driven in tests by the persisted flag** | **Not met** | The wiring exists and is correct by reading — `app.tsx:75-79` triggers on `state.phase === "unlocked" && shouldPlayTour(preferences)`, which is branch-agnostic, and `finishTour` (`app.tsx:99-102`) writes before clearing. But the criterion's own clause — *"driven in tests by the persisted flag rather than by manual observation"* — has **no test**. `onboarding-tour.test.ts` (Slice 3) tests the policy function; nothing tests that the app opens the overlay, that finishing writes the flag, or that it never re-opens. See C3 |
| 2 | **Skip** on every slide, sets the seen-flag, returns the user where the tour interrupted them; dots, **Back**, **Next**, **Get started** behave | **Met (auto-play), narrowed (replay)** | `onboarding.tsx:52-63`: Skip is unconditional, Back is suppressed on slide 1 via `previousSlide`, Get started replaces Next on the last slide, four dots at `:44-48`. Both exits route to `onDone` → `finishTour`. Replayed from Settings, the exit returns to the **workspace**, not to Settings — see W4 |
| 3 | Seen-flag is **per installation, not per vault** | **Met** | `finishTour` writes only `tourSeen` through `preferences:write`, whose handler (`preferences-handlers.ts:13-15`) merges over the device-local file; no vault id is involved anywhere |
| 4 | Tour opens **no vault session**, reads no vault content, no network, does not touch the idle-lock clock, writes nothing but its boolean | **Met** | `onboarding.tsx` imports only the policy, a type, and `useT` — `onboarding-settings.no-session.test.ts:26-28` asserts the absence of a `state/bridge.js` import structurally. `no-network-surface.test.ts` covers the file |
| 5 | Tour **never appears before the recovery-kit acknowledgement**; four slides satisfy D-U(c)'s three guardrails **in both languages** | **Met** | Guard: `app.tsx:108,110` gate both overlays on `canNavigateAwayFrom(state)`, and `Router` returns the kit before the switch (`:165-175`). Copy: `en.ts`/`es.ts` `onboarding.*` — slide 2 says saving happens *"from inside an AI tool you've connected — not from this window"* / *"no desde esta ventana"*; slide 3 uses *browse/search/carry* and *"Explora, busca y llévalo contigo"*, no curation verb, no *"organiza"*; slide 4 states *"There is no password reset"* / *"No existe un restablecimiento de contraseña"* with no marketing adjective |
| 6 | **Show the welcome tour again** replays the same slides, any number of times, and **changes no other state** | **Met (with a caveat)** | `settings.tsx:100-102` → `onReplayTour` → `setOverlay("tour")` (`app.tsx:116`), same component, unbounded. Caveat: each replay's exit re-writes the preferences file (`finishTour` always calls `updatePreferences`), and drops the user in the workspace rather than back in Settings — W4 |
| 7 | Settings reachable **while the vault is locked**; opening it opens no session and touches no vault file | **Met** | Gear at `locked.tsx:65-70`; the overlay lives above the phase switch (`app.tsx:110`) exactly as P-D15 requires; `onboarding-settings.no-session.test.ts:30-32` asserts no bridge import |
| 8 | Settings contains **exactly the four sections D-U names**; Vault & sync **navigates to the existing** Diagnostics screen and relocation wizard; **no editable field** for `VALIJA_HOME` / `VALIJA_STATE_HOME` / `VALIJA_AUTOLOCK_MINUTES` | **Met (narrowed)** | Four `<section>`s at `settings.tsx:42,64,86,98` and no fifth; the two buttons set an existing `WorkspaceView` rather than mounting anything new (`app.tsx:117-124`); the only inputs on the screen are six radios bound to `theme` and `language`. **Narrowing:** both entries render only when `unlocked === true` (`settings.tsx:88`), so from the locked screen — the one reachability the criterion above singles out — Vault & sync is a sentence and nothing else. See W1 |
| 9 | Settings offers no path to destroying, re-keying or re-initializing a vault | **Met** | No such callback exists in the component's props |
| 10 | Switching language applies **live** — no restart, no re-unlock | **Met** | `updatePreferences` (`app.tsx:83-93`) writes then re-reads and replaces `App`'s `preferences`, which is the prop `I18nProvider` keys off; the vault session is untouched |
| 11 | Both catalogs have identical key sets; no hardcoded user-facing string in a component | **Met** | Three keys added to each of `en.ts` / `es.ts`; `catalogs.test.ts` walks both directions and is green. Every string in `onboarding.tsx` / `settings.tsx` goes through `t()` |
| 12 | **The window re-themes immediately** on an Appearance change, and the recovery-kit screen stays permanently high-contrast dark (§4.8 step 38, D-Q) | **Not met** | The first half works: `ThemedRoot` (`app.tsx:43-50`) sets `data-theme` from `useTheme()` and `tokens.css` rebinds the custom properties, so an Appearance change re-themes without a reload. The second half does not: `recovery-kit.tsx:52`'s nested `data-theme="dark"` **cannot** repaint that screen, because the only rules that set `background`/`color` for a screen body are on `.app-shell` (`base.css:29-33`), and an inherited computed `color` is not recomputed when a descendant redefines the variable. See C1 |
| 13 | The app-preferences file still contains exactly four keys (§8.4) | **Met** | The renderer sends `PreferencesWriteRequest` (three keys, no `vaultPath` — `app.tsx:85-90`), and `preferences-handlers.ts:14` carries `vaultPath` forward from the file. §8.6 holds: no path originates in the renderer |

### Plan items (`plan.md:844-950`)

| Item | Verdict | Evidence |
|---|---|---|
| 84 — `onboarding.tsx` renders from `policies/onboarding-tour.ts`'s slide list; opens no session, writes nothing itself | **Met** | `onboarding.tsx:2-7` imports `SLIDE_IDS` / `nextSlide` / `previousSlide` (P-D14's sanctioned `main/application/policies` import, same as `theme-context.tsx`); the component holds only `useState<SlideId>` |
| 85 — the four slides' copy guardrails, reviewed as content | **Met** | See criterion 5. Read in both languages, line by line |
| 86 — **the ordering invariant, with the test that drives it from the persisted flag** | **Not met** | The invariant is enforced (criterion 5). The **test item 86 asks for was not written** — no file in the diff exercises the ordering at all. `session-state.test.ts:67-75` (Slice 6) tests `canNavigateAwayFrom` in isolation, which is the pre-existing half |
| 87 — `settings.tsx`, four sections, live language, Vault & sync links to the existing screens (P-D12) | **Met (narrowed)** | See criterion 8; P-D12 followed exactly — no read-only environment block is duplicated, the section is two links plus `settings.vaultAndSyncSeeSync` |
| 88 — "what Settings is not", **asserted by tests** | **Partially met** | The no-bridge-import scan asserts "opens no session, touches no vault file". Nothing asserts "no editable field for the environment-resolved settings" or "no path to re-initializing a vault" — both are true by reading, neither is guarded |
| 89 — the gear reaches the locked screen | **Met** | `locked.tsx:65-70`, plus `nav-bar.tsx:38-40` for every workspace screen |
| 89a — Diagnostics gains its dashboard entry point; header in **every** branch; exactly one `<DiagnosticsScreen` mount; two catalog keys | **Met (weakly tested)** | `dashboard.tsx:58-66` builds `header` once and all four branches render it (`:71,81,91,104`) — verified by reading. `app.tsx:271` and `:117-120` wire both callbacks to the single mount at `:299`. `dashboard.checkMySetup` present in both catalogs. The test does **not** prove the item's distinguishing requirement — see C3 |
| 89b — `tokens.css` / `base.css` / `screens.css`; theme applied once on the shell root; `no-network-surface.test.ts` glob extended to `.css` | **Partially met** | Files exist, are imported from `app-main.tsx:3-5`, use the P-D6 system font stack with no `@font-face`, and the glob change (`no-network-surface.test.ts:25`) is correct and green over the three new files. But the per-screen half covers 5 of 16 screens, `.sr-only` is used by `locked.tsx:112` and defined nowhere (W3), and the recovery-kit exemption the item explicitly claims to preserve is broken (C1) |
| 90 — five named tests | **Not met** | Nothing tests "shown automatically exactly once, on both branches, driven by the flag", "Skip sets the flag and returns the user where they were", "replay changes nothing else", or "switching language re-renders every visible string". Only "opening Settings / watching the tour do not extend the idle-lock clock" is covered, and indirectly, by the no-bridge-import scan |
| P-D15 — overlays in `app.tsx`, guarded by `canNavigateAwayFrom` | **Met** | `app.tsx:57,108-137`, exactly as approved |
| P-D11 — source-scan test rather than a third jsdom screen | **Met in form** | `diagnostics-entry-points.test.ts` exists in the named idiom; P-D5's boundary is untouched (`__dom-tests__/` still holds exactly `recovery-kit.dom.test.tsx` and `relocate-vault.dom.test.tsx`). Its assertions are weaker than the idiom it copies — see C3 |
| P-D20 — `.css` in the glob | **Met** | `no-network-surface.test.ts:21-25,33` |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** No secret, key or passphrase is logged, written or newly crossed over IPC; no `console.*` in any new file. Key derivation, keychain use and SQLCipher keying are untouched — this slice touches no `src/` file and adds **no IPC channel, no zod schema, no preload method**. `updatePreferences` sends exactly `{theme, language, tourSeen}`, so §8.6's "filesystem paths never originate in the renderer" still holds structurally, and `preferences-handlers.ts:14` carries `vaultPath` forward. CSP (`main-window.ts:4-13`) is unchanged and already permitted `style-src 'self' 'unsafe-inline'`, so the new stylesheets need no relaxation. No MCP change. **One security-copy consequence, not a surface change but named here on purpose:** C1 renders §8.17's clipboard warning at ~1.7:1 contrast on the recovery-kit screen |
| Tests for new behaviour, suite green | **Breached.** The suites pass — root **57 files / 301 tests**, desktop **41 files / 604 tests**, typecheck and lint clean in both, all six run by hand. But **item 86's named test and four of item 90's five named tests do not exist**, and the 108 new test lines against 559 new production lines are entirely `String.includes` greps. See C3 |
| Advance ritual | **Met.** `refined.md:3` `Approved: Oscar 2026-08-20` (Gate R closed); `plan.md:3` `Approved: Oscar 2026-08-25` (third revision, Gate P re-closed); this `review.md` closes the trail. No `package.json`, lockfile or build-config edit in the diff |
| Conventions, naming, placement | **Met.** `screens/onboarding.tsx`, `screens/settings.tsx`, `renderer/styles/{tokens,base,screens}.css` and `screens/diagnostics-entry-points.test.ts` land exactly where `plan.md` §9's approved tree puts them. `renderer/` is not a `domain/application/infra` layer root, so `app.theme.test.ts` beside `app.tsx` is not a bare-file breach, and it follows the `no-network-surface.test.ts` / `diagnostics.no-auto-run.test.ts` naming idiom. The renderer→`main/application/policies` import is P-D14's confirmed shape and is type-only at the port boundary. **One placement objection, and it is the root of C3:** the new overlay view state is inline `useState` in `app.tsx` rather than a plain-TS module in `renderer/state/`, where `session-state.ts`, `workspace-nav.ts`, `import-selection.ts`, `unlock-outcome.ts` and `diagnostic-rows.ts` all live and where `plan.md` §9 says view state goes ("plain TS view state … all `.test.ts`'d"), and where `refined.md:489-492` requires it ("View state … the tour's play/skip logic … plain TypeScript, unit-tested headlessly") |

**Two gates breached: tests for new behaviour, and — through C1 — a shipped screen that no longer
meets the decision it claims to preserve.**

---

## 3. Line count

| | Lines |
|---|---|
| New production — `settings.tsx` 113 · `onboarding.tsx` 66 · `base.css` 114 · `screens.css` 77 · `tokens.css` 33 · `app.tsx` +114/−18 · `dashboard.tsx` +17/−4 · `locked.tsx` +8 · `nav-bar.tsx` +6/−1 · `app-main.tsx` +3 · catalogs +8 | **559 added / 23 removed** |
| Of which CSS | 224 (budget was ~320 — `plan.md:1640`) |
| New tests (3 files + 1 glob edit) | **108** |
| Test : production ratio | **0.19** (Slice 10's was 1.34 — 767:573) |

The production side is proportionate and the two new screens are the right size (66 and 113 lines,
each one render). The test side is not: nine `String.includes` assertions over four source files.

---

## 4. Issues

### Critical (each one holds the merge)

**C1 — the stylesheet breaks the recovery-kit screen in light theme; the raw key is rendered
dark-on-dark and the clipboard warning yellow-on-white.** `tokens.css:1-8` claims the recovery
kit's own `data-theme="dark"` is *"re-applied through the normal cascade — no separate mechanism
needed"*. That is false for **inherited** properties. The only rule that sets a screen body's
`background`/`color` is `base.css:29-33` on `.app-shell`, which `ThemedRoot` renders with the
**app's** theme. In light theme:

- `.app-shell` computes `color: #1a1a1a` and children inherit that **computed value**;
  re-declaring `--color-text` on the nested `.recovery-kit` cannot change it.
- `screens.css:26-34` gives `.recovery-kit .kit-text` `background: var(--color-surface)`, which
  **does** re-resolve inside the nested `[data-theme="dark"]` → `#1f2126`.
- Net effect: `recovery-kit.tsx:55`'s `<pre className="kit-text">` — **the raw 32-byte key, shown
  exactly once and never retrievable again (§8.2)** — is `#1a1a1a` text on a `#1f2126` box.
  Contrast ≈ 1.05:1. It is invisible.
- `base.css:88-90`'s `.warning` resolves `--color-warning` to the dark set's `#f5c451` while the
  page behind it is still white: §8.17's *"the clipboard is readable by other apps"* warning lands
  at ≈1.7:1. `.explainer` (the D-V(d) English-notice sentence) lands at ≈2.2:1.
- The screen's background stays light throughout, so D-Q's *"the recovery-kit screen is exempt and
  stays permanently high-contrast dark"* is not implemented at all — only a handful of variables
  are rebound, and the ones that matter are inherited.

Nothing in the suite can catch this: `recovery-kit.dom.test.tsx` asserts `textContent`, and jsdom
does not resolve `var()`. **What flips it:** one rule that makes the attribute carry the paint
rather than only the palette — e.g. in `base.css`, `[data-theme] { background: var(--color-bg);
color: var(--color-text); }` (with `.app-shell` keeping `min-height: 100vh`), plus
`.recovery-kit { min-height: 100vh; }` so the exempt screen actually fills the window. Then the
nested `data-theme="dark"` repaints its subtree, which is what item 89b says it does. Add a
`__dom-tests__` assertion only if P-D5's boundary permits it; otherwise a comment in `tokens.css`
that no longer claims something untrue is the minimum.

**C2 — lifting `WorkspaceView` into `App` without resetting it on lock drops a user back into the
relocation wizard after a successful move.** Before this slice, `Workspace` owned `view` locally
(`app.tsx` at `ad85718`), so locking unmounted it and re-unlocking started at
`INITIAL_WORKSPACE_VIEW`. Now `workspaceView` lives at `app.tsx:58` and is never reset. The
concrete path, straight out of `refined.md` §4.7:

1. The user completes a relocation. `RelocateVaultScreen` calls `onDone` → `onVaultRelocated` →
   `setState(afterLock())` (`app.tsx:237`) — the move locks the vault as its first step (§4.7 step
   31), so this is the normal, successful ending.
2. `workspaceView` is still `{ screen: "relocate-vault" }`.
3. The user unlocks again (§4.7 step 36) and lands **back on "Move my vault…", stage `choose`**,
   instead of the Sync panel step 36 describes — one click away from starting a second move on a
   vault that just moved.

The comment this slice left in place at `app.tsx:301-304` now describes behaviour the code no
longer has ("hands control back to the Router's own 'locked' screen rather than staying inside a
workspace the vault can no longer back" — it does stay). The same staleness applies to `import`
and `diagnostics` across any lock/unlock. **What flips it:** reset the view when the session leaves
`unlocked` — either `onVaultRelocated={() => { setWorkspaceView(INITIAL_WORKSPACE_VIEW);
setState(afterLock()); }}` plus the same at every other transition out of `unlocked`, or, better and
testable, fold the reset into the view state itself (see C3) so `afterLock()` and
`{screen:"relocate-vault"}` cannot drift apart again.

**C3 — item 86's test and four of item 90's five tests were not written, and the three tests that
were written cannot fail on the defects that matter.** This is the tests-for-new-behaviour gate.

- Untested: the tour opening at all (`app.tsx:75-79`), `finishTour`'s write-before-close ordering
  (`:99-102`) — which is the entire reason the tour does not loop — the Skip/Get-started
  equivalence, the replay path, `updatePreferences`'s patch merge (the function that decides which
  three keys the renderer is allowed to send, §8.6), and the overlay precedence including the
  kit-pending guard.
- `diagnostics-entry-points.test.ts:26-27` is `expect(DASHBOARD).toContain("onCheckSetup")` — it
  passes if the prop is destructured and never rendered, and it says nothing about item 89a's
  actual requirement, *"a header that shows in every branch it already has"*. The four branches do
  render it (`dashboard.tsx:71,81,91,104`), by reading; a `(DASHBOARD.match(/\{header\}/g) ?? [])`
  length assertion would have made that mechanical, in the same spirit as the file's own
  `<DiagnosticsScreen` count.
- `onboarding-settings.no-session.test.ts` and `app.theme.test.ts` are sound structural guards and
  should stay. They are not substitutes for item 90.

This is not a request to widen P-D5. It is the codebase's own established alternative: extract the
overlay decision into `renderer/state/overlay-nav.ts` — `type Overlay = "tour" | "settings" | null`,
`openSettings`, `openTour`, `closeOverlay`, `tourOverlayFor(state, preferences)`, and the
`afterLock`-resets-the-workspace-view rule C2 needs — and unit-test it headlessly beside
`session-state.test.ts`. That is exactly what `refined.md:489-492` and `plan.md` §9's `state/` row
already require of view state, and it is how Slice 10 fixed its own second-pass blocker (pull the
derivation out of the component, test the module). **What flips it:** that module plus tests
covering item 86 and item 90's four missing bullets.

### Warning (does not by itself hold the merge)

**W1 — Settings' Vault & sync silently disappears while the vault is locked, which is the one
reachability `refined.md` singles out.** `settings.tsx:88` gates both entries on `unlocked`, and
`app.tsx:113` supplies it. The judgement is defensible at the code level — `DiagnosticsScreen` and
`RelocateVaultScreen` are only mounted inside `Workspace` (`app.tsx:299-305`), which exists only at
`phase === "unlocked"` — and the slice's "Done when" is satisfied for the unlocked case, so this is
not charged as a criterion failure. But it is a real narrowing of §4.8: step 37 makes Settings
reachable from the locked screen, step 40 lists Vault & sync unconditionally, and P-D12 describes
the section as "two links plus a sentence" with no lock condition. The user this hurts is precise
and important: someone who *cannot unlock* and wants **Check my setup** — the screen whose whole
audience is "something is wrong" — now has no route to it anywhere in the app. `doctor` itself runs
fine on a locked vault. Two honest exits: (a) hoist Diagnostics (and, if it is safe, the wizard —
it locks first anyway) to overlay level so Settings can reach them in any phase; or (b) keep the
narrowing and record it explicitly in `docs/gui.md` (Slice 12) **and** as a `refined.md` amendment,
the way W4 was carried rather than dropped. Silently is the one option that is not available.

**W2 — a failed preferences write traps the user inside the tour with no exit.** `finishTour`
(`app.tsx:99-102`) awaits `updatePreferences` and only then calls `setOverlay(null)`; the call site
is `void finishTour()` (`:109`), so a rejected `preferences:write` (disk full, permission, a
corrupted file the store refuses) is swallowed and the overlay never closes. Both Skip and Get
started route through it, so there is no second way out and no message. Write-before-close is the
right ordering for the no-loop invariant — keep it, but close in a `finally`, or catch and close
anyway: a tour that replays next launch is a far smaller failure than an app that cannot be
dismissed. The same swallow applies to Settings' radios (`:114`), where the cost is only a control
that silently does nothing.

**W3 — `.sr-only` is used by the markup and defined by no stylesheet, so a raw device id is now
visible on the fork banner.** `locked.tsx:112` renders `<span className="sr-only">{writer}</span>`;
`base.css`/`screens.css` define no `.sr-only` rule. Before this slice there was no CSS at all and
the whole app was unstyled, so nothing regressed *relative to nothing* — but shipping a stylesheet
that omits a class the markup depends on leaves an unlabeled writer identifier sitting next to the
"Go to sync" button on the `VAULT_FORK_DETECTED` screen. Add the standard
`.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
clip: rect(0 0 0 0); white-space: nowrap; border: 0; }`. A grep of `className` literals against the
stylesheet also shows 11 of the 16 screens have no per-screen rules at all (`client-card`,
`conversation-row`, `item-row`, `preflight`, `fork-notice`, `pack-text`, …); item 89b asked for
rules "sized to what the sixteen screens already render", and Slice 12 photographs whatever this
leaves on screen.

**W4 — replaying the tour from Settings does not return the user to Settings, and re-writes the
preferences file on the way out.** §4.8 step 41 and criterion 6 say a replay "changes nothing except
which slide is on screen — no state". `finishTour` always calls `updatePreferences({tourSeen:true})`
even when the flag is already `true` (an idempotent value, but a real file write), and `setOverlay(null)`
returns the user to the Router, not to the Settings screen they launched it from — the same
sentence in criterion 2 that says Skip "returns the user to where the tour interrupted them".
Cheapest fix: remember the overlay to restore (`"settings"` when replayed, `null` when auto-played)
and skip the write when `preferences.tourSeen` is already true — both fall out naturally from the
`overlay-nav.ts` module C3 asks for.

### Suggestion

**S1 — `markTourSeen` is now dead code and its intent was re-implemented inline.**
`onboarding-tour.ts:27` exists precisely to express "sets `tourSeen` without touching any other
preference" and is tested for it (`onboarding-tour.test.ts:39-52`), but the only importer is that
test — `finishTour` hand-builds the payload instead. `plan.md:861` lists it among the things "this
slice needs on the main side [that] already exist". Either build the write from
`markTourSeen(preferences)` or delete the function and its tests; a policy that only its own test
calls is worse than either.

**S2 — `value as Language` in `settings.tsx:80` is an unsound cast that buys nothing.** `value` is
`"system" | "en" | "es"` and the parameter type is already `SystemOr<Language>`, so the assertion is
pure noise that also lies about `"system"`. Dropping it also drops the file's only `Language`
import. The Appearance block eight lines above does the same thing correctly, without a cast.

**S3 — the `preferences === null` guard inside `updatePreferences` (`app.tsx:84`) is unreachable**;
the component returned at `:81` when it was null, and TypeScript narrows the captured `const` in the
closure. It reads as if the invariant were uncertain. (Same class as Slice 10's S5.)

**S4 — Slice 10's S3 is now visible rather than latent.** `diagnostics.tsx:27` collapses fatal and
warning into `className="problem"`, and `screens.css:69-71` paints `.check-row.problem` with
`--color-danger`. A non-fatal warning row now looks identical to a fatal failure — the exact
distinction criterion 3 of Slice 10 required the screen to make, preserved in the status word only.
Emitting `ok | warning | fatal` costs two lines in the pure module that already computes it.

**S5 — `.pack-text` has no wrapping rule.** `pack-preview.tsx:71` renders the context pack in a
`<pre>`; `.kit-text` got `white-space: pre-wrap; word-break: break-word` and `.pack-text` got
nothing, so a pack with long lines overflows the 720px `.screen` container. One rule, and Slice 12's
screenshots improve with it.

**S6 — an OS theme change mid-session is not followed.** `theme-context.tsx:15-18` computes
`window.matchMedia("(prefers-color-scheme: dark)").matches` inside a `useMemo` keyed on
`preferences`, so with Appearance on *Follow system* the window only picks up an OS switch on
relaunch. D-Q's binding criterion is the *user's* Appearance change, which works — but now that the
theme is actually painted, a `matchMedia` change listener is ~5 lines and adds no timer
(`setInterval` stays forbidden).

**S7 — no gear on `no-vault.tsx` / `create-vault.tsx`.** §4.8 step 37 names "dashboard, project
view, or the locked screen", so this is within spec; noting it because a Spanish speaker on an
English-locale OS meets the passphrase warning (§8.17 security copy) before any surface offers them
the language switch.

---

## 5. What was verified by hand rather than taken on trust

- `npm run typecheck && npm run lint && npm run test` at the repo root **and** in `desktop/`. All
  six green. **Root: 57 files / 301 tests. Desktop: 41 files / 604 tests** — both counts exactly as
  claimed. Root lint prints one pre-existing `biome migrate` info, unrelated to this diff.
- `git show 8cc7f01 --numstat`: no `package.json`, no lockfile, no `electron.vite.config.ts`, no
  `electron-builder.yml`, and **no file under `src/`** is touched — the "root suite unchanged"
  claim is structural, not incidental.
- C1 was derived by reading the cascade, not assumed: `base.css` is the only file that sets
  `background`/`color` for a screen body, `screens.css:26-34` is the only rule that touches
  `.kit-text`, and `recovery-kit.tsx:52` is the only other `data-theme` in the tree. `index.html`
  carries no inline style and there is no other stylesheet in the repo.
- C2 was derived by diffing the old `Workspace` against the new one: `useState<WorkspaceView>` moved
  from the component that unmounts on lock to the component that does not, and no reset was added at
  any transition.
- Both tour catalogs read end to end in English and Spanish against D-U(c)'s three guardrails,
  including a search for "organiza", "edita", "fija", "elimina", "etiqueta" — none present.
- `screens/__dom-tests__/` still contains exactly `recovery-kit.dom.test.tsx` and
  `relocate-vault.dom.test.tsx`: P-D5's boundary was not widened, as P-D11 requires.
- The `.css` glob genuinely scans the new files (`no-network-surface.test.ts` runs `it.each` over
  every collected path, and the three stylesheets appear as their own test cases); the comment-skip
  filter only skips `//` lines, so CSS `/* */` comments are scanned too — the guard is real.
- `preferences-handlers.ts:14` re-read to confirm the renderer's three-key write cannot clobber
  `vaultPath` (§8.6).
- `main-window.ts` CSP re-read: unchanged by this slice, and the new stylesheets need no relaxation
  of it.

---

## 6. What would flip this to PASS

1. **C1** — a rule that makes `data-theme` paint its subtree (`background` + `color`), so the
   recovery kit is actually the high-contrast dark screen D-Q exempts, and the key and the clipboard
   warning are legible in light theme.
2. **C2** — reset `workspaceView` when the session leaves `unlocked`, so a completed relocation does
   not re-open the relocation wizard.
3. **C3** — item 86's test and item 90's four missing tests, on a plain-TS `renderer/state/`
   overlay module rather than inline in `app.tsx`; plus the `{header}`-in-every-branch assertion in
   `diagnostics-entry-points.test.ts`.

W1 needs a decision recorded (fix or amend), not necessarily code. W2–W4 and every S are welcome in
the same pass but do not gate it.
