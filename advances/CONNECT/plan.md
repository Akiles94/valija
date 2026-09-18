Approved: Oscar 2026-08-29

# CONNECT — Execution plan

> Implementation must **not** begin until Oscar has reviewed this file and added an
> `Approved: Oscar <date>` line at the very top. The `guard-implementation.sh` hook enforces
> that no `src/**`, `desktop/**` build-affecting, `package.json`, or build-config edit lands
> before that line exists. This planner does **not** write that line.

## Gate P resolutions (Oscar, 2026-08-29)

All seven "Decisions to confirm" are settled. Implementation follows these:
- **D1 = branch from `feat/desktop-GUI`** — verified: GUI is not merged to `main` (26 commits ahead), so `main` would give an empty `desktop/` tree.
- **D2 = `node` + resolved JS entry** — `{ command: "node", args: ["<npm -g prefix>/…/valija/dist/program.js", "mcp"] }`; avoids the Windows `.cmd`-shim spawn hazard.
- **D3 = renderer-only lock reason** — no `session-guard.ts` change; manual lock never returns `VAULT_LOCKED`.
- **D4 = yes, `ensureValijaInstalled`** — Connect / `install` run `npm i -g valija` when valija is not resolvable; on failure fall back to the Node-missing warning + manual snippet (non-blocking).
- **D5 = D2 full** — configurable TTL end-to-end (fifth `AppPreferences` key + container rebuild + per-client env), recorded as a deliberate CONNECT amendment to the GUI "four keys" invariant.
- **D6 = i18n only** — change only the two `step3Body` strings; README/SPEC/CHANGELOG document the *real* MCP prompt and stay untouched.
- **D7 = reconciled** — a TTL change updates the desktop container/preference immediately, but each client's `env` is rewritten only on its next Connect press (never a silent host-file rewrite); Settings shows a "reconnect each tool to apply" note.

## Branch

`feat/connect` (following `{feature}/{ADVANCE}`).

**Branch from `feat/desktop-GUI`, not `main`.** CONNECT edits files the GUI advance introduced
under `desktop/**` (`lock-aware-bridge.ts`, `connect-tools.tsx`, `nav-bar.tsx`, `settings.tsx`,
the i18n catalogs, the preferences plumbing). Those files exist on `feat/desktop-GUI`; if they
are not yet merged to `main`, branching from `main` would give an empty desktop tree. See
*Decisions to confirm* D1 — if GUI has already merged to `main` by implementation time, branch
from `main` instead.

---

## Plan summary

Four independent problems, sequenced so the cheap honest wins (P4 copy, P2 states, P3 lock
visibility) land and stay green **before** the load-bearing, hard-to-validate P1 launch-mechanism
change, with the P3 configurable-TTL work last because it is the largest and couples to the same
installer entry P1 rewrites.

- **Slice 1 — P4 copy.** Rewrite `connect.step3Body` (en + es) to natural language, drop the
  literal `/save-context`. Isolated, one test.
- **Slice 2 — P2 honest per-client states.** Replace the lone `connected` boolean with the §5
  state set, derived by a pure renderer function from `tools:status` config presence +
  `VaultStatus` + `NodeProbe`. No new polling.
- **Slice 3 — P3(B)+(C) lock visibility & auto-lock signal.** A LOCKED/UNLOCKED indicator in the
  NavBar chrome, and a "se bloqueó por inactividad" banner on the LockedScreen driven by a lock
  *reason* the renderer already knows (manual vs. lazily-discovered idle). No new timers, no
  domain change.
- **Slice 4 — P1/D-A reliable first launch.** New `mcp-launch.ts` unit that resolves the installed
  `valija` bin and ensures it is installed; installer + CLI `install` + desktop connect write
  `{ command: "<resolved valija bin>", args: ["mcp"] }`. Explicit cross-platform manual validation.
- **Slice 5 — P3(D) configurable TTL end-to-end (D-D=D2).** Settings "Bloqueo automático" control;
  chosen minutes written into each client's `env.VALIJA_AUTOLOCK_MINUTES` on Connect and fed to
  the desktop container; "Nunca" is explicit.
- **Slice 6 — docs.** Ship `advances/CONNECT/docs.connect.md` and update README/CHANGELOG in the
  same commit as the code (per CLAUDE.md "docs ship in the same commit").

Each slice ends green on `npm run typecheck && npm run lint && npm run test` (run in repo root
and, where desktop files change, the desktop workspace's own scripts).

---

## Ground-truth notes that shape the plan

- **`/save-context` is a *real* MCP prompt**, registered in `src/delivery/mcp/server.ts` (line
  ~165) and documented in `README.md`, `docs/SPEC.md`, `CHANGELOG.md`. The refined spec's phrase
  "a slash command that does not exist" is slightly inaccurate: the prompt exists, but Claude Code
  surfaces MCP prompts *namespaced* as `/mcp__valija__save-context`, so telling the user to type
  `/save-context` is what is wrong. **P4's code change is scoped to the two i18n catalogs only.**
  The README/SPEC/CHANGELOG mentions describe the genuine prompt and are left alone — see
  *Decisions to confirm* D6.
- **The renderer already distinguishes manual from idle lock without any domain change.** A manual
  lock goes through `app.tsx#lockNow → lockAwareBridge.vault.lock()`, which returns a *success*
  result (never `VAULT_LOCKED`), so `withLockDetection`'s `onLocked` never fires for it. The only
  path that reaches `onLocked` is a key that vanished underneath an unlocked session — i.e. idle
  auto-lock (the desktop's own `SessionGuard`, or the MCP subprocess's, dropping the shared key).
  So the reason can be carried in the renderer's `SessionState`, and `session-guard.ts` need **not**
  be touched. See *Decisions to confirm* D3.
- **`tools:status` must stay a config-only read** (its file comment guarantees it never opens
  `vault.db` or touches the keychain). P2 therefore keeps the vault/Node parts in the renderer,
  combining the already-fetched global `VaultStatus`/`NodeProbe` with the per-client config read.
- **`AppPreferences` is documented as "exactly four keys and no fifth … never configuration."**
  D-D=D2 needs a persisted user-chosen TTL that also reaches the desktop container, which means a
  fifth key. This is a deliberate cross-advance amendment — see *Decisions to confirm* D5.

---

## Slice 1 — P4 copy fix

**Goal.** `connect.step3Body` steers to natural language with a concrete example and no literal
`/save-context`, in both catalogs, mirroring the onboarding tone already in `onboarding.slide2Body`.

**Files touched**
- `desktop/src/shared/i18n/catalogs/en.ts` — rewrite `connect.step3Body`.
- `desktop/src/shared/i18n/catalogs/es.ts` — rewrite `connect.step3Body`.

Recommended strings (final wording is Oscar's per D-G):
- EN: `'Say something like "remember that I prefer TypeScript over JavaScript." It reviews the session and saves it for you — picking the project, type (decision, progress, preference…), and tags. Whatever it saves shows up here, on the Dashboard.'`
- ES: `'Dile algo como "recuerda que prefiero TypeScript sobre JavaScript". Valija revisará la sesión y lo guardará por ti, eligiendo el proyecto, el tipo (decisión, avance, preferencia…) y las etiquetas. Lo que guarde aparecerá aquí, en el Panel.'`

**Tests**
- Add `desktop/src/shared/i18n/catalogs/connect-copy.test.ts` (or extend an existing catalog test
  if one asserts parity): assert `en.connect.step3Body` and `es.connect.step3Body` do **not**
  contain `/save-context` and do contain the natural-language cue. Layer: pure data assertion.

**Stays green.** Pure string edits; no type or handler changes.

**Est. production lines:** ~4 changed (2 strings). Tests ~12.

---

## Slice 2 — P2 honest per-client states

**Goal.** Each client card shows exactly one of the §5 states, computed from real preconditions,
reusing `VaultStatus`/`NodeProbe`, refreshed on mount + focus only.

**Files touched**
- `desktop/src/shared/ipc/messages.ts` — replace `ToolsStatusEntry.connected: boolean` with
  `presence: "not-installed" | "installed" | "config-invalid"`, keep `vaultPath?`.
- `desktop/src/main/ipc/handlers/tools-handlers.ts` — `tools:status` computes `presence` from the
  config read only (absent file or no `mcpServers.valija` → `not-installed`; invalid JSON →
  `config-invalid`; valija entry present → `installed`). Still no vault/keychain access.
- **New** `desktop/src/renderer/state/client-connection-state.ts` — pure function
  `clientConnectionState(entry, vault, node) → ClientConnectionState`, where
  `ClientConnectionState = "not-installed" | "config-invalid" | "node-missing" | "vault-not-initialized" | "vault-locked" | "ready"` (the §5 ids verbatim). Precedence: config-invalid →
  not-installed → node-missing → vault-not-initialized → vault-locked → ready. Placement mirrors the
  existing pure, headless-tested `state/diagnostic-rows.ts`.
- `desktop/src/renderer/screens/connect-tools.tsx` — also fetch `bridge.vault.status()` on
  mount+focus (reuse existing `wireFocusRefresh`; no new interval), map each entry through
  `clientConnectionState`, render a per-state label + the manual snippet path for `config-invalid`.
- `desktop/src/shared/i18n/catalogs/en.ts` + `es.ts` — add a `connect.status.<stateId>` label per
  state; the `ready` label says "Listo para usar" / "Ready to use", **not** "Conectado".
- `desktop/src/renderer/styles/screens.css` — replace the `.client-status.connected` rule with
  per-state classes (or a single data-attribute) so `vault-locked` and `not-installed` are visually
  distinct (acceptance P2 bullet 5).

**Follow-on edits (same slice, to keep the tree compiling)**
- `desktop/src/renderer/state/diagnostic-rows.test.ts` — fixtures build `ToolsStatusEntry` with
  `connected`; change to `presence`. `diagnostic-rows.ts` itself reads only `client`/`vaultPath`,
  so no logic change there.
- `desktop/src/main/ipc/handlers/tools-handlers.test.ts` — assert `presence` values instead of
  `connected`.

**Tests**
- **New** `client-connection-state.test.ts` — table-driven: every §5 state, plus precedence
  (e.g. installed + node-missing + locked → `node-missing`). Layer: renderer pure state.
- Updated `tools-handlers.test.ts` — the three `presence` outcomes (absent / valija-present /
  invalid JSON). Layer: main handler.

**Stays green.** The `presence` rename is compile-checked across the four consumers; tests updated
in the same slice.

**Est. production lines:** ~70 (state fn ~40, handler ~15, screen ~15, css ~10, labels ~12).
Tests ~90.

---

## Slice 3 — P3(B) lock indicator + P3(C) auto-lock signal

**Goal.** A persistent LOCKED/UNLOCKED indicator in the NavBar chrome, and a
"se bloqueó por inactividad" message on the LockedScreen when the lock was an idle auto-lock — no
new timers, no `session-guard.ts` change.

**Files touched**
- `desktop/src/renderer/state/session-state.ts` — the `locked` variant carries an optional reason:
  `{ phase: "locked"; reason?: "idle" | "manual" }`. `afterLock(reason?)` sets it; `afterStatusCheck`'s
  cold-start locked keeps `reason` undefined (unknown at boot → no banner).
- `desktop/src/renderer/app.tsx` — `lockNow` → `afterLock("manual")`; the `withLockDetection`
  `onLocked` → `afterLock("idle")`; pass `reason` into `LockedScreen`; pass `unlocked` (always true
  where `NavBar` renders, but drive it from state for honesty) into `NavBar`.
- `desktop/src/renderer/components/nav-bar.tsx` — add a lock-status badge element (reads a new
  `unlocked` prop), placed in the existing nav chrome next to the "Lock now" button.
- `desktop/src/renderer/screens/locked.tsx` — accept `reason?: "idle" | "manual"`; when
  `reason === "idle"`, render a banner from a new catalog key above the passphrase form.
- `desktop/src/shared/i18n/catalogs/en.ts` + `es.ts` — add `locked.autoLockedBanner`
  ("Locked due to inactivity." / "Se bloqueó por inactividad.") and `nav.lockIndicatorUnlocked` /
  `nav.lockIndicatorLocked` labels (+ an `sr-only` accessible label).
- `desktop/src/renderer/styles/*.css` — the badge style (small dot/label in the nav).

**Tests**
- `desktop/src/renderer/state/session-state.test.ts` — extend: `afterLock("idle")` and
  `afterLock("manual")` carry the reason; `afterStatusCheck` locked has no reason.
- Optionally a tiny pure helper `lockedBannerVisible(reason)` if the JSX conditional is non-trivial,
  tested headlessly — otherwise the conditional is inline and covered by the session-state test.

**Security note (order matters).** This slice touches **only** presentation/state routing. The
passphrase still crosses renderer→main exactly once via the untouched `locked.tsx#handleSubmit`
(the §6.1 single-crossing comment stays verbatim); no key or passphrase is read, logged, or
persisted here. The banner text carries no vault contents (§6.5).

**Est. production lines:** ~45 (session-state ~8, app wiring ~6, nav badge ~12, locked banner ~8,
labels ~8, css ~6). Tests ~25.

---

## Slice 4 — P1 / D-A reliable first launch (the load-bearing slice)

**Goal.** After Connect (GUI or `valija install`), the written `mcpServers.valija` entry launches
an already-present `valija` with **no per-launch npm network fetch**, on win32/darwin/linux for all
three clients, still carrying `env.VALIJA_HOME` when supplied.

**Files touched**
- **New** `src/delivery/cli/mcp-launch.ts` — two cohesive functions:
  - `resolveMcpLaunch(platform?): { command: string; args: string[] }` — returns the entry command
    for the installed `valija`. Recommended default (see D2): resolve the npm global prefix once via
    `execFileSync("npm", ["prefix", "-g"])` (or `["root", "-g"]`) and return `{ command: "node",
    args: ["<prefix>/lib/node_modules/valija/dist/program.js", "mcp"] }` on posix /
    `["<prefix>/node_modules/valija/dist/program.js", "mcp"]` on win32 — pointing `node` at the
    installed JS entry avoids the Windows `.cmd`-shim spawn hazard while keeping the "resolved
    valija bin" shape D-A asks for. The alternative (write the `valija`/`valija.cmd` shim directly
    as `command`) is D2's other option.
  - `ensureValijaInstalled(): void` — if `valija` is not already resolvable, run
    `execFileSync("npm", ["i", "-g", "valija"])`; surfaces a typed failure the caller turns into the
    existing Node-missing / manual-snippet path rather than throwing raw (see D4).
  - Placement: beside `installer.ts` in `src/delivery/cli/`, its sole consumer. `src/delivery` is
    the composition/delivery root (its peers `container.ts`, `diagnostics.ts`, `cli/installer.ts`,
    `cli/doctor.ts` are all single-purpose files there), so a self-describing sibling is consistent
    with the established convention — this is not a bounded-context `domain/application/infra` layer
    subject to the kind-subfolder rule.
- `src/delivery/cli/installer.ts` — `mcpEntry`, `MCP_ENTRY`, and `manualInstructions` build their
  `command`/`args` from `resolveMcpLaunch()` instead of the hard-coded `npx`/`-y valija mcp`.
  Signature of `installIntoClient` is unchanged in this slice (the TTL param arrives in Slice 5).
- `src/delivery/cli/program.ts` — the `install` command calls `ensureValijaInstalled()` before
  `installIntoClient`, and on its failure prints the existing manual-instructions fallback.
- `desktop/src/main/ipc/handlers/tools-handlers.ts` — `connectClient` calls `ensureValijaInstalled()`
  before `installIntoClient`; an ensure failure maps to the existing `configUnreadable`/manual-snippet
  outcome (no new outcome id needed) plus the existing Node-missing warning already shown on the
  screen.

**Follow-on edits**
- `src/delivery/cli/installer.test.ts` — the `expect(...).toEqual({ command: "npx", args: [...] })`
  assertions change to the new entry shape. Because the shape now depends on the machine's npm
  prefix, inject/stub `resolveMcpLaunch` (export it so the test can pass a fake prefix) rather than
  asserting an absolute path — assert `command`/`args` structure and that `env.VALIJA_HOME` parity
  holds.
- `desktop/src/main/ipc/handlers/tools-handlers.test.ts` — stub `ensureValijaInstalled` so the test
  does not shell out; assert connect still returns `connected` and that ensure is invoked.

**Cross-platform validation (cannot run in CI — call it out for the implementer/reviewer).**
Per §7 and §10, before the advance is called done, do a **cold-cache first-launch** manual test on
**all three OSes** (win32, darwin, linux):
1. Uninstall global `valija` and clear the npx cache.
2. Run Connect (GUI) and `valija install claude-code` (CLI).
3. Inspect the written `mcpServers.valija` entry — confirm no `npx -y` and a resolvable command.
4. Restart the host tool and confirm the `valija` MCP server connects **within the host's connect
   timeout** with no `CONNECT_TIMEOUT`, on a machine that never fetched `valija` before.
5. Repeat under at least one Node version manager (nvm/fnm/Volta) and a per-user npm prefix, since
   that is exactly where a resolved path silently breaks (§10).
Record the results in `advances/CONNECT/review.md`.

**Security note.** No secret is involved; the entry carries only `command`, `args`, and (already)
`env.VALIJA_HOME` — a path, never a key. `ensureValijaInstalled` shells out to `npm` only, never to
a URL the app constructs.

**Est. production lines:** ~70 (mcp-launch ~45, installer edits ~10, program ~6, tools-handlers ~10).
Tests ~50.

---

## Slice 5 — P3(D) configurable TTL end-to-end (D-D = D2)

**Goal.** A "Bloqueo automático" control in Settings whose chosen value (an interval or "Nunca")
is written into each connected client's `env.VALIJA_AUTOLOCK_MINUTES` **and** honoured by the
desktop container, with the default staying 15 min and "disabled" always an explicit visible choice.

**Files touched**
- `src/vault/domain/values/auto-lock-ttl.ts` — add `formatAutoLockMinutes(ttl: number | null):
  string` (`null → "off"`, otherwise the integer) so the env value is produced from the same domain
  unit that `parseAutoLockTtl` consumes — a round-trip pair, tested together. No change to the parse
  rules.
- `src/delivery/cli/installer.ts` — `installIntoClient` and `mcpEntry` gain an optional
  `autoLockMinutes?: number | null`; when provided, the entry's `env` block also carries
  `VALIJA_AUTOLOCK_MINUTES: formatAutoLockMinutes(...)` alongside `VALIJA_HOME`. The CLI call site
  passes nothing (byte-identical output preserved, as it does for `VALIJA_HOME` today).
- `src/delivery/container.ts` + `buildContainer` — `options` gains `autoLockMinutes?: number | null`;
  when present it overrides the `process.env.VALIJA_AUTOLOCK_MINUTES` parse, so the desktop can pass
  the persisted preference. CLI/MCP behaviour unchanged (they pass no override → env parse as today).
- `desktop/src/main/application/ports/app-preferences.ts` — add a fifth key `autoLockMinutes:
  number | null` (default `15`) to `AppPreferences` + `DEFAULT_PREFERENCES`; update the "exactly four
  keys" comment to record the CONNECT amendment (D5).
- `desktop/src/main/infra/file-app-preferences-store.ts` — read/write/migrate the new key
  (default when absent from an older file).
- `desktop/src/shared/ipc/messages.ts` — add `autoLockMinutes` to `AppPreferencesMessage` and to
  `PreferencesWriteRequest`.
- `desktop/src/renderer/state/preferences-write.ts` — carry `autoLockMinutes` through
  `mergePreferencesWrite` / `tourSeenWrite`.
- `desktop/src/main/index.ts` — pass `preferences.autoLockMinutes` into `buildContainer`, and into
  `rebuildContainer`, so the desktop's own `SessionGuard` uses the chosen TTL.
- `desktop/src/main/ipc/handlers/tools-handlers.ts` — `connectClient` passes the current
  `autoLockMinutes` (read from the preferences store) into `installIntoClient`, so a Connect writes
  the chosen TTL into that client's env (D-F: on the Connect press, never a silent background rewrite).
- `desktop/src/renderer/screens/settings.tsx` — a fifth section "Bloqueo automático": a small set of
  interval radios (5 / 15 / 30 / 60 min) plus an explicit "Nunca" option, calling
  `onUpdatePreferences({ autoLockMinutes })`. Update the component's "no field here can set
  VALIJA_AUTOLOCK_MINUTES" comment. Add a one-line note: connected tools apply the new value on
  their next reconnect (D-F).
- `desktop/src/renderer/app.tsx` — `updatePreferences` already re-reads preferences; ensure a TTL
  change triggers `rebuildContainer` via a preferences-write handler path (or a dedicated
  `preferences:write` that rebuilds when `autoLockMinutes` changed).
- `desktop/src/shared/i18n/catalogs/en.ts` + `es.ts` — `settings.autoLock*` labels, interval names,
  "Nunca"/"Never", and the reconnect-to-apply note.

**Tests**
- `src/vault/domain/values/auto-lock-ttl.test.ts` — extend/add: `formatAutoLockMinutes` round-trips
  with `parseAutoLockTtl` (15 → "15" → 15; null → "off" → null). Layer: domain value.
- `src/delivery/cli/installer.test.ts` — with `autoLockMinutes` supplied, the env block carries both
  `VALIJA_HOME` and `VALIJA_AUTOLOCK_MINUTES`; with it omitted, output is unchanged. Layer: delivery.
- `desktop/src/main/infra/file-app-preferences-store.test.ts` — default when the key is absent;
  round-trips a chosen value and `null`. Layer: main infra.
- `desktop/src/renderer/state/preferences-write.test.ts` — `autoLockMinutes` flows through the merge.
- A small pure `settings`-options test if the interval list is extracted; otherwise covered above.

**Security note (§6.3, §6.4 — review-critical).** The env value is a **number of minutes or "off",
never a secret**. "Disabled/never" is an explicit, visible choice; the default stays 15; no code
path here widens or removes auto-lock silently — `SessionGuard` still only ever tightens. The
value is written to client `env` (a config file), never a key export.

**Est. production lines:** ~110 (domain ~10, installer ~10, container ~8, prefs port/store ~20,
messages ~6, prefs-write ~6, index ~6, tools-handlers ~6, settings ~25, labels ~13). Tests ~90.

> **Scope flag.** If D2's full surface (fifth preference key + container rebuild + per-client env
> rewrite) is judged too large at review, the refined spec's own fallback is **D1**: keep 15 min,
> render the Settings section read-only ("Bloqueo automático: 15 min — configúralo con
> `VALIJA_AUTOLOCK_MINUTES`"), and drop everything in this slice except the read-only label. This
> is a genuine fork — see *Decisions to confirm* D5.

---

## Slice 6 — docs (same-commit rule)

**Goal.** Ship documentation with the code (CLAUDE.md convention).

**Files touched**
- **New** `advances/CONNECT/docs.connect.md` — the four fixes, the new launch mechanism, the P2
  state set, the auto-lock signal, and the configurable TTL.
- `README.md` — if the launch mechanism section describes `npx -y valija`, update it to the resolved
  entry (P1 acceptance bullet 5: "no stale `npx -y` snippet left in copy").
- `CHANGELOG.md` — a CONNECT entry.

**Tests.** None (docs). Green by construction.

**Est. production lines:** docs only, ~0 production TS.

---

## Test plan by layer, tied to acceptance criteria

| Acceptance (refined §7) | Test | Layer |
| --- | --- | --- |
| P1: entry has no `npx -y` fetch; `VALIJA_HOME` parity | `installer.test.ts` (updated) | delivery |
| P1: cold-cache first launch within timeout on 3 OSes | **manual**, recorded in review.md | manual |
| P2: each card one §5 state from real preconditions | `client-connection-state.test.ts` | renderer state |
| P2: `presence` from config only, no vault/keychain read | `tools-handlers.test.ts` (updated) | main handler |
| P2: no new polling | code review of `connect-tools.tsx` (focus/mount only) | review |
| P3(B): lock indicator visible in chrome | `nav-bar` prop + `app.tsx` wiring; visual check | renderer |
| P3(C): idle lock states the reason | `session-state.test.ts` (reason carried) | renderer state |
| P3 security §6.1–§6.5 | review of `locked.tsx` (single crossing) + Slice 5 env-value review | review |
| P3(D): chosen TTL reaches client env + container; "disabled" explicit | `installer.test.ts`, `file-app-preferences-store.test.ts`, `auto-lock-ttl.test.ts` | delivery/infra/domain |
| P4: `step3Body` drops `/save-context`, natural-language cue | `connect-copy.test.ts` | i18n data |
| P4: no other UI surface advertises the slash command | repo grep in review (README/SPEC excluded as real-prompt docs — D6) | review |

---

## Security order-of-operations checklist (for the implementer)

1. **Never widen the unlock window.** Slice 5's default `autoLockMinutes` stays 15; "Nunca" is the
   only way to disable and it is an explicit, labelled choice. `session-guard.ts` is not modified,
   so its "only ever tightens" invariant is preserved by construction.
2. **Passphrase crosses once.** Slice 3 must not add any read of the passphrase/key; the
   `locked.tsx` single-crossing comment stays. The lock *reason* is a UI enum, derived with no
   secret material.
3. **Keychain-only, keyed by `vaultId`.** No slice writes key material anywhere else; the TTL in
   client `env` is minutes-or-"off", never a secret (§6.4).
4. **`tools:status` stays a config-only read** — Slice 2 keeps vault/Node parts in the renderer;
   the handler never opens `vault.db` or the keychain.
5. **No host-file hand-edit behind the host's back** — P1 and TTL both go only through Valija's own
   `installIntoClient` write path, triggered by an explicit Connect press (D-F), never a background
   rewrite.
6. **`ensureValijaInstalled` shells only to `npm`** — never to an app-constructed URL; no network
   request the app itself makes.

---

## Decisions to confirm

**D1 — Branch base.** *Recommended:* branch `feat/connect` from `feat/desktop-GUI`, because CONNECT
edits desktop files the GUI advance owns. *If* GUI is already merged to `main`, branch from `main`.
Trade-off: branching from GUI carries any un-merged GUI work into CONNECT's diff; the orchestrator
should confirm GUI's merge state first.

**D2 — How to resolve the bin path (P1's load-bearing detail).**
*Recommended:* `{ command: "node", args: ["<globalPrefix>/.../valija/dist/program.js", "mcp"] }`,
resolving `<globalPrefix>` from `npm prefix -g`. *Trade-off:* sidesteps the Windows `.cmd`-shim
spawn hazard (some MCP hosts spawn without a shell and fail on `.cmd`) and is stable after a global
install, but needs `node` on PATH (already a hard dependency per D-W) and reaches inside the global
`node_modules` layout, which differs slightly between npm/pnpm/Volta. *Alternative:* write the
`valija` / `valija.cmd` shim directly as `command` (closest to D-A's "resolved valija bin" wording),
simpler, but risks the Windows shim spawn failure. **Decide before Slice 4.**

**D3 — Where the lock *reason* lives.** *Recommended:* infer it in the renderer (manual = the
explicit `lockNow` path; idle = the lazily-discovered `VAULT_LOCKED` path), leaving
`session-guard.ts` untouched. *Trade-off:* zero domain surface and no new error field, and it is
correct because manual lock never returns `VAULT_LOCKED`; but it relies on that invariant holding —
if a future manual-lock path ever surfaced `VAULT_LOCKED`, the banner would misattribute. The
alternative (plumb a reason code through the domain/IPC) is more explicit but touches four layers
for a cosmetic string. **Recommend the renderer-only approach.**

**D4 — Does Connect/`install` run `npm i -g valija`?** *Recommended:* yes — `ensureValijaInstalled`
installs when `valija` is not already resolvable, so a first-time user is not left with a config
that points at a missing binary. *Trade-off:* a global install can require elevated permissions
(some Linux/npm-prefix setups) and adds latency to the first Connect; on failure we fall back to the
existing Node-missing warning + manual snippet rather than blocking. *Alternative:* assume `valija`
is already installed and only resolve — simpler, but reproduces a silent-failure mode on a fresh
machine. **Decide before Slice 4.**

**D5 — Configurable-TTL scope (D-D=D2 full vs D1 fallback), incl. the "fifth preference key".**
D-D is settled as D2, but D2 requires adding `autoLockMinutes` to `AppPreferences`, which is
documented as "exactly four keys and no fifth … never configuration" (a GUI-advance invariant).
*Recommended:* proceed with D2 and record the CONNECT amendment in the `app-preferences.ts` and
`settings.tsx` comments — a device-local, user-chosen TTL is a legitimate preference. *Trade-off:*
larger surface (container rebuild on change, per-client env rewrite on Connect). *Fallback (spec's
own):* D1 — keep 15 min, render the Settings section read-only. **This is the biggest scope fork;
confirm at Gate P.**

**D6 — P4 repo-wide `/save-context` scope.** The slash *prompt is real* (registered in the MCP
server, documented in README/SPEC/CHANGELOG as `/save-context` and `/load-context`). *Recommended:*
change **only** the two i18n `step3Body` strings; leave README/SPEC/CHANGELOG, which document the
genuine prompt, untouched. *Trade-off:* the refined §7 P4 bullet says "no other surface … still
advertises the slash command," which could be read as also editing those docs; but removing accurate
prompt documentation would be wrong. Confirm that leaving the prompt docs is acceptable.

**D7 — D-D vs D-F on TTL change.** D-D says write the TTL "on Connect **and on change**"; D-F says
already-connected clients are re-written "on the next per-client Connect press … never by a silent
background rewrite of a host-owned file." *Recommended reconciliation:* a TTL change updates the
desktop container/preference immediately (visible), but client `env` is rewritten only on the next
Connect press, with a Settings note "reconnect each tool to apply." *Trade-off:* a connected tool
keeps the old TTL until its next reconnect — but that avoids silently rewriting host-owned config
(claude.json) behind the host's back, which D-F forbids. Confirm this reading of the two decisions.

---

## Repo structure after execution

```
valija/
├─ advances/
│  └─ CONNECT/
│     ├─ refined.md
│     ├─ plan.md                                   (this file)
│     ├─ docs.connect.md                           NEW  (Slice 6)
│     └─ review.md                                 NEW  (reviewer; records the 3-OS manual test)
├─ src/
│  ├─ delivery/
│  │  ├─ container.ts                              CHANGED (Slice 5: autoLockMinutes option)
│  │  └─ cli/
│  │     ├─ mcp-launch.ts                          NEW  (Slice 4: resolveMcpLaunch, ensureValijaInstalled)
│  │     ├─ mcp-launch.test.ts                     NEW  (Slice 4)
│  │     ├─ installer.ts                           CHANGED (Slices 4+5: resolved entry, TTL env)
│  │     ├─ installer.test.ts                      CHANGED (Slices 4+5)
│  │     └─ program.ts                             CHANGED (Slice 4: ensureValijaInstalled in install)
│  └─ vault/
│     └─ domain/values/
│        ├─ auto-lock-ttl.ts                       CHANGED (Slice 5: formatAutoLockMinutes)
│        └─ auto-lock-ttl.test.ts                  CHANGED (Slice 5)
├─ desktop/src/
│  ├─ main/
│  │  ├─ index.ts                                  CHANGED (Slice 5: pass autoLockMinutes to container)
│  │  ├─ application/ports/app-preferences.ts      CHANGED (Slice 5: fifth key)
│  │  ├─ infra/file-app-preferences-store.ts       CHANGED (Slice 5)
│  │  ├─ infra/file-app-preferences-store.test.ts  CHANGED (Slice 5)
│  │  └─ ipc/handlers/
│  │     ├─ tools-handlers.ts                      CHANGED (Slices 2+4+5)
│  │     └─ tools-handlers.test.ts                 CHANGED (Slices 2+4)
│  ├─ shared/
│  │  ├─ ipc/messages.ts                           CHANGED (Slices 2+5)
│  │  └─ i18n/catalogs/
│  │     ├─ en.ts                                  CHANGED (Slices 1+2+3+5)
│  │     ├─ es.ts                                  CHANGED (Slices 1+2+3+5)
│  │     └─ connect-copy.test.ts                   NEW  (Slice 1)
│  └─ renderer/
│     ├─ app.tsx                                   CHANGED (Slices 3+5)
│     ├─ components/nav-bar.tsx                     CHANGED (Slice 3: lock indicator)
│     ├─ screens/
│     │  ├─ connect-tools.tsx                       CHANGED (Slice 2)
│     │  ├─ locked.tsx                              CHANGED (Slice 3: idle banner)
│     │  └─ settings.tsx                            CHANGED (Slice 5: auto-lock section)
│     ├─ state/
│     │  ├─ client-connection-state.ts             NEW  (Slice 2)
│     │  ├─ client-connection-state.test.ts        NEW  (Slice 2)
│     │  ├─ session-state.ts                        CHANGED (Slice 3: lock reason)
│     │  ├─ session-state.test.ts                   CHANGED (Slice 3)
│     │  ├─ diagnostic-rows.test.ts                 CHANGED (Slice 2: presence fixtures)
│     │  ├─ preferences-write.ts                    CHANGED (Slice 5)
│     │  └─ preferences-write.test.ts               CHANGED (Slice 5)
│     └─ styles/screens.css (+ nav css)            CHANGED (Slices 2+3)
├─ README.md                                       CHANGED (Slice 6: launch mechanism copy)
└─ CHANGELOG.md                                    CHANGED (Slice 6)
```

No new bounded-context module is introduced. The one new production unit outside a screen —
`src/delivery/cli/mcp-launch.ts` — sits beside its only consumer `installer.ts` in the delivery
root, consistent with that folder's existing single-purpose files; the one new renderer unit —
`state/client-connection-state.ts` — mirrors the existing pure, headless-tested `state/diagnostic-rows.ts`.

---

## Naming / DDD / placement review

- `resolveMcpLaunch`, `ensureValijaInstalled` — verb-first, ubiquitous-language ("the MCP launch
  command", "ensure valija installed"); consistent with `installIntoClient`, `clientConfigPath`.
- `clientConnectionState` + the §5 state ids (`not-installed`, `config-invalid`, `node-missing`,
  `vault-not-initialized`, `vault-locked`, `ready`) are lifted verbatim from the spec's own
  contract table — matches existing renderer pure-state naming (`diagnosticRows`, `classifyUnlockResult`).
- `formatAutoLockMinutes` pairs with the existing `parseAutoLockTtl`/`isIdleExpired` in the same
  domain value file — a total formatter, no new subfolder needed (it is the same *kind* as the
  existing parser, in the existing `values/` file).
- `ToolsStatusEntry.presence` replaces the misleading `connected` boolean; `SessionState`'s
  `reason` is a closed union — both parse-don't-validate-friendly, catalog-mapped copy only.
- Placement: no bare files added at any bounded-context layer root. `mcp-launch.ts` is a delivery
  composition file (self-describing, sibling to `installer.ts`); no new *kind* of application/domain
  object is introduced that would need a new subfolder.

---

## Total estimated production-line count and risks

**Estimated production lines (TS, excluding tests and docs):** ~300
(Slice 1 ~4, Slice 2 ~70, Slice 3 ~45, Slice 4 ~70, Slice 5 ~110). Tests add ~250.

**Risks**
1. **P1 cross-platform bin resolution (§10) — the top risk.** A path correct on the dev machine can
   be wrong under a different Node manager or npm prefix, failing silently on someone else's
   machine exactly like the original `CONNECT_TIMEOUT`. Mitigation: D2's `node`+resolved-JS shape
   and the mandatory 3-OS cold-cache manual test recorded in review.md. This cannot be caught by CI.
2. **D-D=D2 scope creep.** The configurable-TTL slice reaches domain, delivery, main infra, IPC, and
   two screens, and amends a GUI-advance invariant (four-key preferences). If it runs long, the D1
   fallback (read-only Settings label) is pre-approved by the spec — decide at Gate P (D5).
3. **D-D vs D-F ambiguity (D7).** The two settled decisions pull in slightly different directions on
   whether a TTL change rewrites already-connected clients; the plan proposes a reconciliation but
   it needs Oscar's confirmation to avoid either a silent host-file rewrite or a dishonest,
   tool-ignored setting.
4. **`ensureValijaInstalled` side effects (D4).** A global `npm i -g` may need elevated rights or
   add first-Connect latency; the fallback to the manual snippet keeps it non-blocking, but the
   behaviour should be confirmed.
5. **Presence rename fan-out.** Changing `ToolsStatusEntry.connected → presence` touches four files
   plus two tests and a CSS rule; low risk but must all land in Slice 2 to stay green.
```

Approval note: implementation must not begin until this file carries an `Approved:` line added by Oscar.
