# CONNECT — honest connection state and a reliable first run

Ships four independent fixes to the desktop app's connection story, found in a single debugging
session where the app showed "Conectado" while Valija did nothing inside Claude Code.

## P1 — a reliable first launch

`valija install <client>` and the desktop's **Connect** button used to write
`{ command: "npx", args: ["-y", "valija", "mcp"] }` into the client's config. On a cold `npx` cache
this downloads `valija` from npm on every single launch — slow enough on some connections to blow
past Claude Code's 30-second connect timeout, producing `CONNECT_TIMEOUT` on a machine that had
never used Valija before.

Both paths now go through `resolveMcpLaunch()` (`src/delivery/cli/mcp-launch.ts`), which resolves
the global npm prefix once and writes `{ command: "node", args: ["<prefix>/…/valija/dist/program.js",
"mcp"] }` — no per-launch network fetch, and no dependency on the Windows `.cmd`-shim spawn path some
MCP hosts don't support. `ensureValijaInstalled()` runs `npm i -g valija` first when the resolved
entry isn't present yet, so a first-time Connect on a machine that never had `valija` doesn't write a
config pointing at nothing; a failure falls back to the existing Node-missing / manual-snippet path
rather than blocking Connect.

**Not verifiable by this advance's automated tests:** the actual cold-cache, cross-platform first
launch (win32/darwin/linux, several Node version managers) needs a real machine per OS — see
`review.md` for what was and wasn't validated here.

## P2 — honest per-client status

Each client card on the Connect screen now renders exactly one of six states, computed from real
preconditions instead of a lone "Conectado"/"Connected" boolean:

| State | Meaning |
| --- | --- |
| Not connected | no config entry for `valija` |
| Config unreadable | the client's config file isn't valid JSON |
| Connected, but Node.js is missing | entry present, but `node`/`npm` don't run |
| Connected — create your vault | entry present, but no vault exists yet |
| Connected, but the vault is locked | entry present, vault exists, but is locked |
| Ready to use | entry present, Node runs, vault unlocked |

The state is derived by a pure function (`clientConnectionState`,
`desktop/src/renderer/state/client-connection-state.ts`) combining `tools:status`'s now-tri-state
`presence` with the already-fetched `VaultStatus`/`NodeStatus` — no second "is it healthy"
computation, no new polling (still mount + window-focus only). "Ready to use" deliberately never
says "Connected": Valija can assert its own preconditions, never that the AI tool has a live session.

## P3 — lock visibility and an auto-lock signal

A LOCKED/UNLOCKED indicator now sits in the workspace nav bar, next to "Lock now", whenever a vault
is unlocked. When the vault is discovered auto-locked from inactivity, the locked screen shows a
banner ("Locked due to inactivity" / "Se bloqueó por inactividad") — a manual "Lock now" press shows
no such banner, since the user already knows why. The distinction is carried entirely in
`SessionState`'s new `reason?: "idle" | "manual"` field, set by the renderer at the two points that
already know which happened; `session-guard.ts` is untouched.

**Auto-lock is now configurable** from Settings (5/15/30/60 minutes, or an explicit "Nunca"/"Never").
Because the MCP subprocess reads `VALIJA_AUTOLOCK_MINUTES` from its own environment — not the
desktop's preferences file — the chosen value is written into each client's config `env` block,
exactly like `VALIJA_HOME` already is, on that client's next Connect press (never a silent background
rewrite of a host-owned file). The desktop's own `SessionGuard` picks up a change immediately via a
container rebuild. The default stays 15 minutes; disabling auto-lock is always an explicit, visible
choice — nothing in this advance can silently widen or remove it.

This required a deliberate amendment to the GUI advance's "`AppPreferences` is exactly four keys"
invariant: `autoLockMinutes` is a fifth, device-local, user-chosen preference — never vault content,
never a secret.

## P4 — copy fix

The desktop's onboarding copy told users to type a `/save-context` command in their AI tool. The
prompt is real (registered in the MCP server, documented in `README.md`/`docs/SPEC.md`), but Claude
Code namespaces MCP prompts, so a bare `/save-context` is never something the user can actually type.
`connect.step3Body` (English and Spanish) now steers to natural language with a concrete example
instead. `README.md`/`docs/SPEC.md` describe the genuine prompt and were left untouched.

## What did not change

No new MCP tool, no vault-format change, no bundled Node runtime. The CLI's own `install`/`mcp`
commands are unaffected in shape — only the config entry they write, and a new install-if-missing
step before writing it.
