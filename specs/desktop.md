# Spec: desktop — the Electron companion app

Not a bounded context under `src/` — a separate workspace (`desktop/`) whose main process composes
the **existing** `src/` container and whose sandboxed renderer is a bilingual UI over an enumerated
IPC surface. Ubiquitous language: **overlay, workspace view, preferences, IPC channel, tour, session
phase**. Depends on `src/`'s composition root (`buildContainer`) only through the enumerated IPC
surface below; the renderer never imports `src/` directly (`contextIsolation: true`,
`nodeIntegration: false`).

## The IPC surface (`shared/ipc/channels.ts`, `main/ipc/schemas.ts`, `main/ipc/handlers/`)

A **closed, enumerated set** — 37 channels across ten areas (still 37 after SECRET-WARN, which only widened two request schemas and one outcome), each with a zod schema in the same
idiom `src/delivery/mcp/server.ts` uses. `register-handlers.test.ts` asserts the registered channel
set **equals** the tuple: no extra channel, no missing one, no generic `invoke("run", …)` escape
hatch. Every handler is four lines — validate, call the use case, map `Result` to a wire shape,
return — and goes through `VaultSessions.withSession` per action; a test asserts the vault folder
carries no `-wal`/`-shm`/`-journal` sidecar after a scripted sequence of handler calls (no session
outlives an action).

| Area | Channels | Notes |
|---|---|---|
| `vault:*` | `init · readRecoveryKit · unlock · lock · status · upgradeCheck` | `readRecoveryKit` is single-shot — a nonce consumed on first read, `null` on a second call |
| `content:*` | `projects · show · search · pack · export · copy · setPinned · setArchived · edit` | Same use cases the CLI calls; `pack`/`export` are byte-identical to `valija export`. `show` takes `includeArchived`. (CURATION) `setPinned`/`setArchived` write through the same use cases as the CLI — one lineage bump per real change, none on a no-op — and return only `{ changed }`; (A1) `edit { id, content?, tags?, type? }` goes through `EditItem` and returns only `{ changed, changedFields }`. Its zod caps are abuse limits set well above the domain's (100 tags × 256 chars, 1 MB), so an over-limit edit reaches `EditItem` and comes back as its real code (`TOO_MANY_TAGS`, `INVALID_TAG`, `CONTENT_TOO_LARGE`). (SECRET-WARN) `edit` also takes `allowSecrets?: boolean` (strict, optional — **Save anyway**); without it, content that looks like a secret comes back as `{ code: "POSSIBLE_SECRET" }` only. The schema field is load-bearing: `z.object` strips unknown keys, so without it the flag would be dropped and Save anyway would loop |
| `sync:*` | `status` | Pure read, never a write — `sync-panel.no-write.test.ts` asserts no keychain/file change |
| `diagnostics:*` | `run · copyReport` | `run` calls `src/delivery/diagnostics.ts`'s `runDiagnostics`, never re-derives a check; `copyReport` never re-runs the checks, it takes the rows the renderer already has |
| `relocation:*` | `preflight · move · retryClient · pointAtExisting` | `move` orchestrates `LockVault` → `RelocateVault` → per-client config re-pointing → container rebuild — the "no use case calls another" rule the vault module's `RelocateVault` itself can't hold, so this orchestration lives here |
| `import:*` | `list · preview · run` | One vault write, one lineage bump, however many conversations selected. (SECRET-WARN) `run` takes `allowSecrets?: boolean` (**Import anyway**); `preview` does not (its schema strips it). Both return `ImportOutcomeResponse` with required `refused` and `blockingChunks` (`{ conversationIndex, title \| null, part, findings: { kind, firstLine, lastLine }[] }`): a refused import is a successful outcome with nothing written, and the blocking list crosses **as data, never as an error message**. `toOutcome` maps every field explicitly — never a spread of a domain object — so no matched text or future field can cross |
| `tools:*` | `status · connect · nodeStatus` | `connect` calls `installIntoClient` unchanged (backup, then merge); `nodeStatus` spawns `node --version`/`npm --version` on PATH (D-W), only from an explicit Connect-screen action |
| `preferences:*` | `read · write` | See **Preferences** below — `write`'s request type has no `vaultPath` field (§8.6): a filesystem path never originates in the renderer |
| `dialog:*` | `chooseImportFile · chooseVaultFolder · chooseProjectFolder` | The **only** origin of an absolute filesystem path anywhere in `desktop/` — the main process opens the native dialog and keeps the path; the renderer receives a display name and an opaque handle. (PROJECT-DETECT) `chooseProjectFolder` mints `pf-` handles into **its own** map (P-10): only `bindings:*` can redeem one, and `relocation:*`/`import:*` never can |
| `bindings:*` | `inspect · link · unlink · list` | (PROJECT-DETECT) Same use cases as the CLI's `which · link · unlink · links` (`ResolveProject`, `LinkWorkspace`, `UnlinkWorkspace`, `ListProjectBindings`); one lineage bump per real link/unlink, none on a no-op or rejection. No request carries a path — a folder arrives only as a `pf-` handle, and `by` is a closed `folder \| repository` enum (P-13). `inspect` never reads `VALIJA_PROJECT` (D-D). `list`/`unlink` return a display target (home as `~`, remotes normalized with credentials already stripped). The handlers take no preferences store, so nothing binding-related reaches the preferences file |

**No polling, anywhere.** State refreshes on user action and the window's `focus` event only
(`renderer/state/focus-refresh.ts`) — a scripted polling refresh would silently reset the idle
auto-lock clock the same way a real `SessionGuard`-backed read does (M3 D-I), so `focus`-only is a
structural choice, not a convenience. `no-network-surface.test.ts` asserts no `setInterval` (or
`fetch`/`XMLHttpRequest`/`http(s)://`/`crashReporter`) anywhere in `desktop/src`, including its
`.css` files.

**Discovering an auto-lock mid-screen never dead-ends.** Because state only refreshes on action or
focus (never a push from main), a screen finds out the vault auto-locked underneath it the same way
it finds out about any other failure: the next bridge call it makes comes back `VAULT_LOCKED`.
`renderer/state/lock-aware-bridge.ts` wraps the bridge once, in `app.tsx`, before it reaches any
screen — any `VAULT_LOCKED` result from any call routes the app back to `LockedScreen`
(`setState(afterLock())`), rather than leaving the screen showing a translated error with no way to
unlock. This is why `Router`/`Workspace` take `bridge` as an explicit prop instead of closing over
the module-level bridge singleton every screen used to reach directly.

**The nav bar's "Lock now"** (`NavBar`'s red `lock-button`, styled with `--color-danger`) is the
first UI path to `vault:lock` — until it shipped, the only ways a vault ever locked were the idle
auto-lock TTL and relocation's own lock-first-then-move step. `App.lockNow()` calls it through the
same lock-aware bridge, then runs the identical reset `relocationFinished()` does
(`resetWorkspaceView()` + `afterLock()`), so the next unlock lands back on the dashboard either way.

## Preferences (`main/application/ports/app-preferences.ts`, `main/infra/file-app-preferences-store.ts`)

`AppPreferences` — **exactly four keys, no fifth** (§8.4): `vaultPath: string | null` (a location
*hint*, never configuration — `VALIJA_HOME` always wins over it), `theme: SystemOr<"light"|"dark">`,
`language: SystemOr<Language>`, `tourSeen: boolean`. `FileAppPreferencesStore` persists this as JSON
at `app.getPath("userData")/preferences.json`, atomic write (temp file + rename), and returns
`DEFAULT_PREFERENCES` on any read/parse failure rather than throwing — this file is read before the
first window exists, so a corrupt file must not block launch. `preferences:write`'s request type
(`PreferencesWriteRequest`) omits `vaultPath` entirely; the handler carries it forward from the
existing file (`{ ...store.read(), ...req }`), so a renderer write can never set or clear it.

`resolveVaultRoot(env, preferences) = env.VALIJA_HOME ?? preferences.vaultPath ?? undefined` — the
one line the whole precedence rule reduces to; `undefined` falls through to `resolveVaultPaths()`'s
own `~/.valija`.

## `system-or-override.ts` — one mechanism, two consumers

`type SystemOr<T> = "system" | T` and `resolveSystemOrOverride<T>(choice, system): T`. Built once,
used for both theme (`theme-resolution.ts`, over `nativeTheme.shouldUseDarkColors`) and language
(`language-resolution.ts`, over `matchLanguage(osLocale)` — primary-subtag match: `es`/`es-EC`/
`es-419`/`es-ES` → `es`, anything else → `en`). The recovery-kit screen never calls the theme
resolver at all — it hardcodes its own permanently-dark styling, structural rather than a runtime
branch.

## The onboarding tour (`main/application/policies/onboarding-tour.ts`)

Plain TypeScript, no React, no Electron import — imported by the renderer the same way
`system-or-override.ts` and `theme-resolution.ts` already are. `SLIDE_IDS` (four, fixed order),
`nextSlide`/`previousSlide` (`null` past either end), `shouldPlayTour(preferences) = !tourSeen`,
`markTourSeen(preferences) = { ...preferences, tourSeen: true }` — Skip and finishing the last slide
both reduce to this one call (D-U(b): a skipped tour never nags again).

## Renderer view state (`renderer/state/`, all plain TypeScript, unit-tested headlessly)

- **`session-state.ts`** — the phase machine (`checking · no-vault · creating · kit-pending · locked
  · unlocking · upgrade-required · unlocked`) and its transitions (`afterStatusCheck`,
  `afterCreateSuccess`, `afterUnlockSuccess`, …). `canNavigateAwayFrom(state) = phase !==
  "kit-pending"` — the one hard invariant: nothing, including the tour, may render between the
  recovery kit and its acknowledgement.
- **`overlay-nav.ts`** (Slice 11) — the tour and Settings, held above the phase switch (P-D15,
  neither is a `WorkspaceView` screen, since Settings must open while locked). `OverlayState =
  { overlay: "tour"|"settings"|null; returnTo: "tour"|"settings"|null }`. `autoTourOverlay(current,
  state, preferences)` plays the tour the first time `state.phase === "unlocked"` and
  `shouldPlayTour(preferences)`, on either first-run branch, and never interrupts an overlay already
  open. `replayTourFromSettings()` sets `returnTo: "settings"`, so `finishTourOverlay` — called by
  both Skip and "Get started" — returns the user to Settings after a replay and to the workspace
  after an auto-played tour (D-U(b): "returns the user to where the tour interrupted them").
- **`preferences-write.ts`** (Slice 11) — `mergePreferencesWrite(current, patch)` is the one place a
  `PreferencesWriteRequest` is assembled from a partial UI patch, so a write can never carry a
  key the renderer didn't explicitly set. `tourSeenWrite(preferences)` narrows
  `markTourSeen(preferences)` to the write shape (drops `vaultPath`) rather than hand-building
  `{ tourSeen: true }` — the tour's finish handler and the preferences store's own policy agree by
  construction.
- **`workspace-nav.ts`** — `WorkspaceView` (`dashboard · project · search · pack-preview · sync ·
  relocate-vault · connect-tools · import · diagnostics`), the drill-down state inside the unlocked
  workspace. `resetWorkspaceView()` returns `INITIAL_WORKSPACE_VIEW` — called wherever the session
  leaves `"unlocked"` (today: after a successful relocation, paired with `afterLock()`), so a
  workspace view can never survive into the next unlock and reopen a screen — like the relocation
  wizard — whose job is already done.
- **`diagnostic-rows.ts`** — assembles the Diagnostics screen's rows from `runDiagnostics`'s checks
  plus the app/tool Node distinction (D-W) and each connected client's vault path. Each row carries
  `ok` and `fatal` (mirroring `doctor.ts`'s own `!check.ok && check.fatal`), so the screen — and its
  stylesheet — can distinguish a warning from a failure without re-deriving either.
- **`session-state.ts`**'s sibling modules (`unlock-outcome.ts`, `create-vault-validation.ts`,
  `import-selection.ts`, `focus-refresh.ts`, and (CURATION) `item-actions.ts`) each own one
  screen's pure decision logic — `item-actions.ts`'s `itemActionsFor` mirrors the domain's curation
  rules (archived → unarchive; imported → archive only; else pin/unpin + edit + archive — `edit` opens the edit dialog rather than calling a channel directly) so the project
  screen never offers a refused call, and `performItemAction` is the one action → channel map; `item-edit.ts` (A1) builds the edit dialog's draft and the `content:edit` request with only the changed fields (`null` → no call); (PROJECT-DETECT) `binding-link.ts`'s `linkChoicesFor` lists the inspect panel's link options, default first (repository when there is a remote, folder unless too broad, none → no Link button), mirroring `chooseLinkTarget`; (SECRET-WARN) `secret-findings.ts`'s `describeSecretFindings` renders findings (kind + lines only) in the UI language — `secrets.kinds.*` labels, sorted by line then kind precedence, capped at 5 then "and N more", unknown kinds skipped — the localized twin of the domain's `describeFindings`; none of them
  is a `UseCase` or a port — they're view state, tested the way `context/domain/services` are tested
  in `src/`, without a DOM.

## Screens (`renderer/screens/*.tsx`)

One file per screen, each a render of the state above plus a thin call into `bridge.ts` (the typed
client wrapping `window.valija` — never touched directly by a component, so every screen is testable
against a fake bridge). Two screens carry a jsdom + Testing Library render test
(`__dom-tests__/recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`, P-D5) for behaviour a
source-scan can't prove (a click actually navigating); every other screen's structural guarantees —
"never runs its probe automatically," "never imports the bridge," "renders in every branch" — are
proven by source-scanning tests in that same idiom instead (`diagnostics.no-auto-run.test.ts`,
`onboarding-settings.no-session.test.ts`, `diagnostics-entry-points.test.ts`, `app.theme.test.ts`),
since P-D5 confines DOM-level rendering to exactly those two files.

(PROJECT-DETECT) The project screen renders `components/bindings-section.tsx` under its toolbar:
the project's links from `bindings:list` (kind, display target, **Unlink**), and **Link a folder…**
→ `dialog:chooseProjectFolder` → `bindings:inspect` → an inspect panel (current resolution,
repository/remote, the `linkChoicesFor` radios) → `bindings:link`. The list reloads after every
link/unlink; errors render their code's catalog copy and a rejected call renders `UNEXPECTED`. All
state is in React memory — nothing reaches `preferences:write` (`project-bindings.dom.test.tsx`).

(SECRET-WARN) **Edit dialog.** `project.tsx` calls `content:edit` first (main is the only enforcer,
P-5). On `POSSIBLE_SECRET` it sets `secretRefused` instead of an error line, and the dialog stays open
with the draft. `item-edit-dialog.tsx` then runs the shared, Node-free `detectSecrets` (imported from
`src/context/domain/services/secret-detection/`) on the **current** draft and renders
`components/secret-warning.tsx` (`role="alert"`: title, the described findings, the best-effort copy,
**Edit text** → focus the textarea, **Save anyway** → the same edit plus `allowSecrets: true`) above
`.modal-actions`, so **Save** stays the last focusable control. The findings follow the draft (P-18):
remove the secret and the warning hides; if main refused but the renderer finds nothing in the
submitted text, the warning shows `errors.POSSIBLE_SECRET` instead of a list, still with Save anyway.
The matched text is never rendered.

## Relocation wizard's refusals

The refusal vocabulary and safety ordering live in `src/vault` — see [`specs/vault.md`](vault.md)'s
`refuseUnsafeRelocation` and `RelocateVault` sections. What's specific to `desktop/`:
`main/ipc/handlers/relocation-handlers.ts` sequences `LockVault` → `RelocateVault` → re-pointing
every already-connected client's MCP config → rebuilding the container with the new root — a
client-config failure is reported and **never** rolls the vault move back, since the vault itself
already succeeded and moved. Preferences (`vaultPath`) are updated only after the use case returns
`ok`; on any failure they're untouched. The wizard's own screen
(`renderer/screens/relocate-vault.tsx`) shows the pre-flight refusals before anything is written,
and — since a terminal has no way to read this app's preferences file — a copyable env-var line
after a successful move: `export VALIJA_HOME="…"` on macOS/Linux, `$env:VALIJA_HOME = "…"` on
Windows (`export` is bash/zsh syntax and PowerShell doesn't understand it), chosen from
`navigator.userAgent` in `relocate-vault.tsx`.

## What is structurally guaranteed, not just documented

- **No network of any kind.** CSP (`default-src 'self'`, `connect-src 'none'`), `will-navigate`
  denied for non-`file:` targets, `setWindowOpenHandler` returning `deny`, no `crashReporter`, and
  the source-scanning grep above — enforced against the packaged artifact, not only the source
  (Slice 13).
- **The session key never crosses main → renderer.** The only secret that ever reaches the renderer
  is the recovery kit, once, behind a consumed nonce.
- **Filesystem paths never originate in the renderer** — the three `dialog:*` channels are the only
  source of one, and a test asserts no zod schema in `schemas.ts` contains a free-form path-shaped
  string field.
