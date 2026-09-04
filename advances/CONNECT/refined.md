# CONNECT — honest connection state and a reliable first run · Refined Spec

**Status:** **Gate R resolved (Oscar, 2026-08-29).** The §8 decisions are settled below; the spec
awaits Oscar's explicit go to planning.

### Gate R resolutions
- **D-A = A1** — global install + resolved `valija` bin path in the written config (`{ command:
  "<resolved valija bin>", args: ["mcp"] }`). Fixes both the GUI Connect path and the CLI `install`
  path from one source (the published package). The cross-platform bin-path portability risk (§10)
  is the load-bearing thing the plan must handle and validate on win32/darwin/linux with a cold cache.
- **D-D = D2** — TTL becomes configurable from Settings **and** is written into each connected
  client's `env` block (`VALIJA_AUTOLOCK_MINUTES`, like `VALIJA_HOME`) so the MCP subprocess honours
  it. "Disabled/never" is an explicit visible choice; the default stays 15 min; auto-lock is never
  silently widened (§6.3).
- **D-B = default** — lock indicator lives in the NavBar chrome, always visible while a vault exists.
- **D-C = default (C1)** — auto-lock signalled in-app; SessionGuard must distinguish an idle lock
  from a manual lock so the LockedScreen/banner can say *"se bloqueó por inactividad."* No new timers.
- **D-E = default (E1)** — no server self-probe; P2 states come from config + Node + vault
  preconditions only.
- **D-F = default** — already-connected clients are re-written on the next per-client **Conectar**
  press (and whenever D-D's TTL changes), never by a silent background rewrite of a host-owned file.
- **D-G = default** — P4 copy mirrors the existing onboarding tone, dropping the `/save-context`
  clause; exact strings approved by Oscar at implementation.

**Directory:** `CONNECT`, deliberately not a milestone number — same posture `GUI`/`MOBILE` held.
**Origin:** a debugging session (2026-08-28) where the desktop app showed **"Conectado"** while
Valija did nothing inside Claude Code. Four failure modes surfaced; three hit **every** real user.
**Inherits from:** `advances/GUI/refined.md` (the `D-n` idiom, the no-polling rule, the D-R(a)
"the MCP server is a separate OS process that does not read the desktop preferences file" fact, and
D-W "Node/npm is a real external dependency this app detects but does not bundle").

Read §1 and §3 first: two of the four problems are **already partly solved in the current code**,
and the spec is only honest if it says which parts exist today and which are genuinely missing.

---

## 1. Goal

**Make Valija's connection state honest and its first run reliable, so a non-terminal user can
trust what the desktop app tells them.** Concretely: (P1) installing Valija into an AI tool must
make the MCP server start reliably and fast on the first launch, without a per-launch network
fetch that can exceed the host tool's connect timeout; (P2) the desktop app's per-client status
must reflect *real* preconditions with distinct, honest states instead of a single "Conectado";
(P3) the vault's lock state must be visible in the app, the user must get a signal when idle
auto-lock re-locks the vault, and the app must not weaken the encryption/keychain model while
doing so; (P4) onboarding copy must stop telling users to type a `/save-context` slash command
that does not exist and steer them to natural language instead.

This advance does **not** add any new MCP tool, change the vault format, or bundle Node.

---

## 2. Ground truth read from the repo (so the planner does not re-derive it)

- **The installer writes an on-demand fetch.** `src/delivery/cli/installer.ts` writes
  `{ command: "npx", args: ["-y", "valija", "mcp"] }` (optionally with `env.VALIJA_HOME`) into
  each client's `mcpServers.valija`. On a cold npx cache the first launch downloads `valija` from
  npm; on a slow link this exceeds Claude Code's 30 s connect timeout → `CONNECT_TIMEOUT`. This is
  P1. Clients supported: `claude-code` (`~/.claude.json`), `claude-desktop`
  (per-OS path), `cursor` (`~/.cursor/mcp.json`).
- **`~/.claude.json` is owned by the host app.** Claude Code desktop rewrites that file from
  memory, so a runtime hand-edit is unreliable. The P1 fix must go through Valija's own install
  path (a config the client treats as authoritative), not by patching the host's file behind its
  back at runtime.
- **The desktop app bundles Valija's core** — `desktop/**` imports the same
  `src/delivery/container.js`, use-cases, and `OsKeychain`. The MCP server the AI tool launches is
  a **separate OS process** (`npx -y valija mcp`) that shares the OS keychain but **not** the
  desktop preferences file (D-R(a)'s fact, still true here).
- **The keychain is shared across processes** — `src/vault/infra/keyring.ts` (`OsKeychain`), keyed
  by `vaultId`. A GUI-driven unlock writes the key the MCP subprocess reads. Confirmed ground truth.
- **GUI unlock already exists.** `desktop/src/renderer/screens/locked.tsx` +
  `vault-handlers.ts`'s `vault:unlock` already take a passphrase (or recovery key) in the app and
  call `UnlockVault`, writing the key to the same keychain. **P3(a) — "unlock from the GUI" — is
  therefore already shipped.** The genuinely missing P3 parts are the *visible lock indicator*, the
  *auto-lock signal*, and *configurable TTL* (§6).
- **Per-client status today is presence-only.** `desktop/src/main/ipc/handlers/tools-handlers.ts`
  `tools:status` returns `connected = configFileExists && mcpServers.valija.env.VALIJA_HOME defined`.
  `desktop/src/renderer/screens/connect-tools.tsx` renders that single boolean as
  `common.connected` / `common.notConnected`. This is P2.
- **Real state already exists, unused by the cards.** `src/delivery/diagnostics.ts`
  `runDiagnostics` computes vault `initialized`/`unlocked` (via `VaultStatus`), per-client config
  presence (`checkClient`), and a `NodeProbe` result feeds the connect screen's Node/npm warning.
  The desktop Diagnostics screen already surfaces these. P2 is about bringing that honesty onto the
  per-client cards, not inventing a parallel check.
- **Auto-lock is lazy and silent.** `src/vault/application/policies/session-guard.ts` drops the
  keychain key on the next session open past the TTL; there is **no daemon and no event**. TTL comes
  from `process.env.VALIJA_AUTOLOCK_MINUTES` (`src/delivery/container.ts:61`; note the real name is
  `VALIJA_AUTOLOCK_MINUTES`, *not* `VALIJA_AUTO_LOCK_TTL`), parsed by `parseAutoLockTtl` (default
  15, `0`/`off` disables). The desktop app discovers a lock only lazily via
  `desktop/src/renderer/state/lock-aware-bridge.ts`, which routes to `LockedScreen` on the next
  `VAULT_LOCKED` result. There is no push/notification (the GUI advance's §6 "no-polling" rule). P3.
- **The fake slash-command copy is `connect.step3Body`** in both catalogs:
  `desktop/src/shared/i18n/catalogs/en.ts:143-147` and `.../es.ts:143-147`. It literally tells the
  user to `use the "/save-context" command`. P4. (Onboarding slides in the same catalogs already
  correctly say saving happens *inside* the AI tool — they do not mention the slash command.)

---

## 3. What is in scope vs. deferred

**In scope (the four problems):**
- **P1** — remove the per-launch network round-trip from the config the installer writes, so the
  MCP server starts fast and reliably on first launch across claude-code / claude-desktop / cursor
  on win32 / darwin / linux.
- **P2** — replace the single "connected" boolean on the per-client cards with a small set of
  distinct, honest states derived from real preconditions.
- **P3** — make lock state visible, signal the user when idle auto-lock fires, and decide whether
  the TTL becomes user-configurable — all without weakening the security model.
- **P4** — correct the onboarding/connect copy to steer users to natural language and drop the
  non-existent slash command, in both `en` and `es`.

**Explicitly deferred (not this advance):**
- Bundling a Node runtime inside the desktop app (D-W still stands: detect, don't bundle).
- A background daemon that eagerly enforces auto-lock or pushes lock events over IPC on a timer
  (only considered as an *option* in §8 D-C; the default avoids it).
- Any live probe of the *host tool's* actual MCP session — Valija cannot observe Claude Code's
  internal connection; it can only assert its own preconditions. "Truly connected in the host tool"
  is out of scope by nature.
- New MCP tools/prompts, vault-format changes, sync/lineage changes.
- Auto-restarting or re-pointing already-connected clients beyond what P1's install path writes.

---

## 4. User walkthrough (observable behaviour)

Two people, one machine. **Ana** is a non-terminal user; **the vault already exists** (she created
it in the app earlier).

**First-run connect (P1 + P2 + P4).**
1. Ana opens the desktop app, unlocks with her passphrase (existing `LockedScreen`), lands on the
   Dashboard, clicks **"Conectar una herramienta de IA"**.
2. On the Connect screen each client card shows an **honest status** (P2), e.g. Claude Code =
   *"No conectado"*, and the 3-step helper's step 3 now reads *"Pídele que guarde o recuerde algo"*
   with a natural-language example and **no** `/save-context` command (P4).
3. She clicks **Conectar** on the Claude Code card. Valija writes the client config so the server
   launches **without a cold-cache download** (P1 — exact mechanism is D-A). The card updates to
   the appropriate post-connect state (e.g. *"Listo — reinicia Claude Code"*).
4. She restarts Claude Code. **On the very first launch the `valija` MCP server connects within the
   host's timeout** — no `CONNECT_TIMEOUT`, even on a machine that never fetched `valija` before.
5. Back in Claude Code she types, in natural language, *"recuerda que prefiero TypeScript"*. The
   `save_context` tool fires; the item appears on the app's Dashboard. (This is what step 3's copy
   now tells her to do.)

**How the status is *used* afterward (and how it is not):** the per-client card states are read on
mount and on window focus only (existing `wireFocusRefresh` pattern — **no new polling loop**). The
card reflects Valija's own preconditions (config present, Node runnable, vault initialized/unlocked)
and deliberately does **not** claim the host tool has a live session, because Valija cannot see that.
The wording of the "ready" state must make that distinction (e.g. *"Listo para usar"*, not
*"Conectado"*).

**Mid-session auto-lock (P3).**
6. Ana walks away. After the idle TTL the vault auto-locks: the next MCP call from Claude Code (or
   her next action in the app) finds the key gone and returns `VAULT_LOCKED`.
7. The desktop app **shows a persistent lock indicator** (LOCKED vs UNLOCKED, always visible in the
   app chrome — D-B) and **signals that auto-lock fired** (D-C) rather than silently dead-ending.
   She re-enters her passphrase in the app; the key returns to the keychain; Claude Code works again
   on its next call.
8. If TTL is made configurable (D-D), she can raise or disable it from Settings; the walkthrough
   step for that reads: Settings → "Bloqueo automático" → choose an interval / "Nunca".

Example — the config the installer writes today vs. the shape P1 must move away from (mechanism is
D-A, not fixed here):

```jsonc
// today (P1 bug): per-launch fetch, can time out cold
"valija": { "command": "npx", "args": ["-y", "valija", "mcp"], "env": { "VALIJA_HOME": "…" } }
// after CONNECT: an entry that launches an already-present binary/script with no network round-trip
```

Every acceptance criterion in §7 traces back to a numbered step here.

---

## 5. P2 — the exact set of per-client states

Each client card shows exactly one state, computed from preconditions Valija can actually observe.
Proposed canonical set (final wording is copy, but the *states* are the contract):

| State id | Meaning (precondition) | Honest label direction |
| --- | --- | --- |
| `not-installed` | client config file absent, or `mcpServers.valija` absent | "No conectado" |
| `config-invalid` | config file present but not valid JSON / not an object | "Configuración ilegible" + manual snippet (existing `configUnreadable` path) |
| `node-missing` | valija installed in config but `NodeProbe` says node/npm not runnable (only relevant if D-A keeps a Node launcher) | "Conectado, pero falta Node.js" |
| `vault-not-initialized` | installed, but no vault exists yet | "Conectado — crea tu bóveda" |
| `vault-locked` | installed + vault initialized but locked (keychain empty / idle-expired) | "Conectado, pero la bóveda está bloqueada" |
| `ready` | installed + Node ok + vault initialized + unlocked | "Listo para usar" (NOT "Conectado") |

Notes for the planner:
- These map onto data that already exists: config presence (`checkClient`/`tools:status`),
  `NodeProbe`, and `VaultStatus.{initialized,unlocked}`. **Prefer reusing `runDiagnostics` /
  `VaultStatus` over inventing a second "is it healthy" computation** (the GUI advance's D-T rule).
- Vault state is global (one vault), so `vault-locked`/`vault-not-initialized`/`ready` are the same
  across all three cards in a given moment; only the per-client config/Node parts differ. That is
  fine and honest.
- Whether a genuine *server self-probe* is added (spawn `valija mcp`, do the MCP `initialize`
  handshake, confirm it starts) is **D-E** — the default is no probe, because config+precondition
  states already catch every one of the four reported failures, and a spawn-on-render probe adds a
  process launch to a screen render.

---

## 6. P3 — lock visibility, auto-lock signal, TTL, and the security wall

**Already done:** passphrase-based unlock from the GUI (do not re-spec it).

**To add:**
- **(B) Persistent lock indicator** — LOCKED / UNLOCKED visible in the app chrome whenever a vault
  exists (not buried in Diagnostics). Reads `VaultStatus.unlocked`.
- **(C) Auto-lock signal** — when the vault is discovered auto-locked, the app must *tell the user
  why* (idle timeout), not just silently route to the locked screen. Minimum bar: the LockedScreen
  (or a banner) states "se bloqueó por inactividad" when the last transition was an idle lock. An OS
  notification is an option (D-C) but not required by default.
- **(D) TTL configurability** — decide whether the 15-minute default becomes user-adjustable from
  Settings. Critical gotcha (D-D): the MCP subprocess reads `VALIJA_AUTOLOCK_MINUTES` from its
  environment, **not** the desktop preferences file. A TTL chosen in the app only reaches the MCP
  process if it is written into each client config's `env` block (exactly like `VALIJA_HOME` is
  today). A Settings toggle that only changes the app's own container has no effect on the tool-side
  server — that inconsistency would itself be dishonest.

**Security constraints (must not be weakened — call these out in review):**
1. The passphrase may cross renderer→main **once per unlock** and must not be retained, logged, or
   persisted in plaintext (the existing `locked.tsx` comment and §5.1 of the GUI spec already hold
   this line; keep it).
2. No storing the passphrase or derived key anywhere except the OS keychain, keyed by `vaultId`, via
   the existing `OsKeychain`.
3. Auto-lock may only ever *tighten* the unlocked window (SessionGuard's own invariant). If TTL
   becomes configurable, "disabled/never" must be an explicit, visible choice — the default stays 15
   minutes; nothing in this advance may silently widen or remove auto-lock.
4. No plaintext export of the key to the preferences file. If D-D writes TTL into client `env`,
   that value is a number of minutes only — never a secret.
5. Any auto-lock notification must not include vault contents or the passphrase.

---

## 7. Acceptance criteria (reviewer checklist)

**P1 — reliable first launch** (walkthrough steps 3-4)
- [ ] After `Connect` (GUI or `valija install`), the written `mcpServers.valija` entry launches the
      server with **no per-launch npm network fetch** (no bare `npx -y valija` that downloads on a
      cold cache). Mechanism per D-A.
- [ ] The entry still works on win32, darwin, and linux for claude-code, claude-desktop, and cursor,
      and still carries `env.VALIJA_HOME` when the desktop app supplies it (parity with today).
- [ ] The fix goes through Valija's install path / an authoritative config — no runtime hand-edit of
      a host-owned file (`~/.claude.json`) behind the host app's back.
- [ ] A cold-cache first launch connects within the host's connect timeout in a documented manual
      test (no `CONNECT_TIMEOUT`).
- [ ] `manualInstructions` and the connect screen's copy match whatever new entry shape D-A picks
      (no stale `npx -y` snippet left in copy or tests).

**P2 — honest per-client status** (walkthrough step 2)
- [ ] Each client card renders exactly one of the §5 states, derived from real preconditions, not a
      lone `connected` boolean.
- [ ] The `ready` state's label does **not** assert "Conectado"/"Connected" to the host tool; it
      says "ready/listo" (or equivalent) and the distinction is documented in copy.
- [ ] State computation reuses `VaultStatus`/`runDiagnostics`/`NodeProbe`, not a parallel re-derivation.
- [ ] Status refreshes on mount and window focus only — **no new `setInterval`/polling loop**.
- [ ] `vault-locked` and `not-installed` are visually and textually distinct (the original bug was
      that both looked "Conectado").

**P3 — lock visibility, signal, TTL** (walkthrough steps 6-8)
- [ ] A LOCKED/UNLOCKED indicator is visible in the app chrome whenever a vault exists.
- [ ] When the vault is discovered auto-locked, the app states the reason (idle timeout), not just a
      generic locked screen.
- [ ] Security constraints §6.1–§6.5 hold: no plaintext passphrase/key at rest, keychain-only,
      single-crossing passphrase, auto-lock never silently widened.
- [ ] If D-D lands "configurable TTL," the chosen value reaches the MCP subprocess (written to client
      `env`), and "disabled" is an explicit visible choice; if D-D lands "not now," the app does not
      pretend to change a TTL the server won't honour.

**P4 — copy fix** (walkthrough steps 2, 5)
- [ ] `connect.step3Body` in `en.ts` and `es.ts` no longer instructs the user to type
      `/save-context` (or `/mcp__valija__save-context`).
- [ ] The replacement steers to natural language with a concrete example, consistent with how the
      onboarding slides already describe saving.
- [ ] No other surface (README, tour, diagnostics copy) still advertises the slash command — verified
      by a repo search in the review.

**Cross-cutting**
- [ ] Module-first layout respected: new logic lands in kind-named subfolders
      (`policies/`, `services/`, `use-cases/`, `ports/`), no bare files at a layer root; tech-named
      adapters for any new infra.
- [ ] Tests per layer; docs ship in the same commit.

---

## 8. Open decisions (resolve at Gate R)

**D-A — P1 launch mechanism.** *Open — Gate R.*
How does the written config avoid the cold-cache fetch? Options:
- **(A1) Global install + resolved binary path.** On Connect, ensure `valija` is installed
  (`npm i -g valija` or already-present bin) and write `{ command: "<resolved valija bin>", args:
  ["mcp"] }`. *Pro:* no per-launch download; standard. *Con:* requires npm at connect time; global
  bin path differs per OS/Node manager; updates need a re-install.
- **(A2) Desktop app ships the server; point config at it.** Write `{ command: "<node>", args:
  ["<app-bundled>/valija-mcp.js", "mcp"] }` (or a small launcher the app installs). *Pro:* zero
  network, version pinned to the app the user already trusts. *Con:* still needs a Node to run the
  script (D-W dependency stays); path must survive app updates; CLI-only users (no desktop app)
  don't benefit.
- **(A3) Pre-warm the npx cache on Connect, keep `npx -y valija mcp`.** *Pro:* smallest change.
  *Con:* fragile — cache can be evicted; still one network-shaped step; doesn't fix CLI `install`.
- **Default: A1**, because it removes the per-launch network round-trip for *both* the GUI and the
  CLI `install` path with the least new surface, keeps a single source of truth (the published
  package), and matches the "config the client treats as authoritative" constraint. A2 is the
  stronger long-term answer once Node bundling is on the table (deferred), so keep its analysis.
  **Reason to revisit:** if Oscar wants desktop-only users insulated from npm entirely, pick A2.

**D-B — where the lock indicator lives.** *Open — Gate R.*
Options: (B1) in the existing `NavBar` chrome (always visible while unlocked); (B2) a dedicated
badge on Dashboard + Connect only. **Default: B1** — a global lock badge in the nav chrome, because
lock state is global and the origin bug was precisely that it was invisible outside Diagnostics.

**D-C — how the auto-lock signal is delivered.** *Open — Gate R.*
Options: (C1) *lazy, in-app only* — when the next action discovers `VAULT_LOCKED`, route to a
LockedScreen that says "locked due to inactivity" (needs a way to know the cause was idle vs. manual
lock; SessionGuard could distinguish). (C2) *OS notification* fired from a single `setTimeout`
scheduled in main aligned to the TTL. *Pro C1:* honours the no-polling rule, no new timers, no
notification permission. *Con C1:* the user isn't told until they return to the app. *Pro C2:*
proactive. *Con C2:* introduces a timer/daemon-ish surface the GUI spec deliberately avoided, and
the real lock is still lazy so the notification could fire before/after the actual key drop.
**Default: C1**, extended so the SessionGuard's idle-lock path is distinguishable from a manual lock
(so the app can say *why*). C2 is deferred as an enhancement.

**D-D — configurable TTL, and does it reach the server?** *Open — Gate R.*
Options: (D1) *not now* — keep 15 min default, only add visibility + signal; document that TTL is
env-only. (D2) *Settings toggle written into each connected client's `env` block* (like
`VALIJA_HOME`), so the MCP subprocess actually honours it, plus the desktop container. *Pro D1:*
smallest, no cross-process inconsistency risk. *Con D1:* leaves a real papercut (silent re-lock at a
fixed interval). *Pro D2:* genuinely fixes the papercut end-to-end. *Con D2:* must re-write every
connected client config on change (re-pointing surface, like D-R(a)); a client connected *after* the
change needs the current value; a not-yet-restarted client keeps the old value until restart.
**Default: D2 but scoped to "write the chosen TTL into client `env` on Connect and on change,"**
because a Settings toggle that the tool-side server ignores would reproduce exactly the kind of
dishonesty this advance exists to remove. If D2 is judged too large, fall back to **D1** and label
the Settings area read-only ("Bloqueo automático: 15 min, configúralo con VALIJA_AUTOLOCK_MINUTES").

**D-E — real server self-probe for P2?** *Open — Gate R.*
Options: (E1) no probe — states from config + preconditions only. (E2) spawn `valija mcp` and do an
MCP `initialize` handshake to confirm the server starts, surfacing a `server-unresponsive` state.
**Default: E1**, because the four reported failures are all caught by config/Node/vault
preconditions, and a spawn-per-render probe adds a process launch and latency to a screen the user
opens often. Keep E2's analysis for a later "deep health check" advance.

**D-F — scope of "already-connected clients" on a P1/TTL change.** *Open — Gate R.*
When D-A (and D-D=D2) change what the config should contain, must existing connected clients be
re-written, or only newly-connected ones? **Default: re-write on the next `Connect` press per
client** (no silent background rewrite of host-owned files), consistent with the "don't hand-edit
behind the host's back" constraint. A one-line note in the card can prompt "Reconnect to apply the
faster launch."

**D-G — copy replacement wording (P4).** *Open — Gate R.* Low-risk. **Default:** mirror the
existing correct onboarding tone — e.g. ES *'Dile algo como "recuerda que prefiero TypeScript";
Valija revisará la sesión y lo guardará. Lo que guarde aparece aquí, en el Panel.'* and the EN
equivalent — dropping the `/save-context` clause entirely. Oscar to approve exact strings.

---

## 9. Affected areas of the codebase (for the planner, not a plan)

- **P1:** `src/delivery/cli/installer.ts` (`MCP_COMMAND`/`MCP_ARGS`/`mcpEntry`/`manualInstructions`),
  its callers `desktop/src/main/ipc/handlers/tools-handlers.ts` and the CLI `install` command; any
  new "ensure valija is installed / resolve bin path" step (new kind-named unit, not a loose file).
- **P2:** `desktop/src/main/ipc/handlers/tools-handlers.ts` (`tools:status` shape),
  `desktop/src/shared/ipc/messages.ts` (`ToolsStatusEntry`), `.../screens/connect-tools.tsx`,
  `.../state/diagnostic-rows.ts`, and reuse of `src/delivery/diagnostics.ts` / `VaultStatus`.
- **P3:** `desktop/src/renderer/state/lock-aware-bridge.ts`, `.../screens/locked.tsx`,
  `.../components/nav-bar.*` (indicator), `.../screens/settings.tsx` (if D-D=D2),
  `src/vault/application/policies/session-guard.ts` (distinguish idle vs manual lock, if D-C needs
  it), `src/vault/domain/values/auto-lock-ttl.ts`, `src/delivery/container.ts`
  (`VALIJA_AUTOLOCK_MINUTES`), and the installer `env` block (if D-D=D2).
- **P4:** `desktop/src/shared/i18n/catalogs/en.ts` and `es.ts` (`connect.step3Body`); repo-wide
  search for other `/save-context` mentions.

---

## 10. Biggest risk

**P1's launch mechanism (D-A) is the load-bearing decision and the easiest to get subtly wrong
cross-platform.** A resolved-binary or bundled-script path that is correct on the dev machine can be
wrong under a different Node version manager, a per-user vs. global npm prefix, or after an app
update — and because the host tool (Claude Code) owns and rewrites its own config, a stale or
non-portable path fails exactly the same way the original `CONNECT_TIMEOUT` did: silently, on
someone else's machine. This must be validated on all three OSes with a cold cache before the
advance is called done.
