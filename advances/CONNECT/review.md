Verdict: FAIL

# CONNECT — change review

Reviewed: working tree as committed in `3e2e230` ("feat(CONNECT): honest connection state and a
reliable first run"), diffed against `bcb573d`. 46 files, **+463 / −118 production TS lines**
(plan estimated ~300 net), +387/−34 test lines, +165/−19 docs/CSS lines.

Suites, run by me at review time:

| Suite | Result |
| --- | --- |
| root `npm run typecheck && npm run lint && npm run test` | pass — 58 files, **310 tests** |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | pass — 52 files, **754 tests** |

The advance is close. P2, P3, and P4 are honest, well-tested work that does what the spec asked.
**P1 — the load-bearing slice — is broken on win32 and on any machine whose `npm` is not on the
launching process's `PATH`, and its own fallback path throws inside the `catch` that is supposed to
produce it.** The repo already documents the exact hazard, twenty lines of a sibling file away.
That plus the untested `ensureValijaInstalled` is why this is a FAIL rather than a PASS-with-notes.

---

## 1. Acceptance criteria (refined.md §7)

### P1 — reliable first launch

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Written entry has no per-launch npm fetch (no bare `npx -y valija`) | **Met** (happy path) | `src/delivery/cli/mcp-launch.ts:29` returns `{ command: "node", args: [entryPath, "mcp"] }`; `installer.ts:19` builds every entry from it; `installer.test.ts` asserts `command !== "npx"` |
| 2 | Entry still works on **win32**, darwin, linux for all three clients; `env.VALIJA_HOME` parity | **NOT MET** | `mcp-launch.ts:23` and `:45` call `execFileSync("npm", …)` with no `shell: true`. On Windows `npm` exists only as `npm.cmd`; libuv's spawn resolves only `.com`/`.exe`, so this throws `ENOENT`/`EINVAL`. The repo states this itself in `desktop/src/main/infra/child-process-node-probe.ts:5-9`: *"`shell: true` is required on Windows: `execFile` alone cannot resolve a `.cmd` shim (how `npm` itself is installed there)."* `VALIJA_HOME` parity itself is fine (`installer.test.ts` cases 2-5) |
| 3 | Goes through Valija's own install path, no runtime hand-edit of a host-owned file | **Met** | Only `installIntoClient` writes; `tools-handlers.ts:106-116` writes on the explicit Connect press only |
| 4 | Cold-cache first launch inside the host timeout, documented manual test | **NOT MET (unverified)** | Not performed — see §4. plan.md Slice 4 asks for the 3-OS results to be recorded here; they cannot be produced in this sandbox (no win32/darwin host, no way to clear a real npm cache per platform). Disclosed by the orchestrator, not hidden — but the criterion is not met, and issue C1 is exactly the class of bug this test exists to catch |
| 5 | `manualInstructions` and connect copy match the new shape; no stale `npx -y` in copy or tests | **NOT MET (docs)** | `installer.ts:113-117` and `installer.test.ts` are updated correctly, `docs/gui.md` and `CHANGELOG.md` too — but `docs/SPEC.md:106` still reads *"Started as `valija mcp` (client config: `npx -y valija mcp`)"*, which is now false about what Valija writes. (`docs/SPEC.md:58` is a historical D3 rationale and can stay.) `README.md` has no such snippet, so the plan's "README changed" line correctly became a `docs/gui.md` change |

### P2 — honest per-client status

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Exactly one of the §5 states per card, not a lone boolean | **Met** | `client-connection-state.ts:8-35`; `connect-tools.tsx:153-160`; `messages.ts:180-186` replaces `connected: boolean` with the `presence` tri-state. Caveat W3 below |
| 2 | `ready` never asserts "Connected" | **Met** | `en.ts:"ready: Ready to use"`, `es.ts:"ready: Listo para usar"`; the distinction is spelled out in `docs/gui.md` §Connecting your AI tools |
| 3 | Reuses `VaultStatus`/`NodeProbe`, no parallel re-derivation | **Met** | `clientConnectionState(entry, vault, node)` takes the already-fetched `VaultStatusResponse`/`NodeStatusResponse`; `tools:status` stays a config-only read (`tools-handlers.ts:39-51`, hygiene test at `tools-handlers.test.ts:170-180`) |
| 4 | Mount + window focus only, no new polling | **Met** | `connect-tools.tsx:45-63` uses `wireFocusRefresh`; `focus-refresh.ts` adds a `focus` listener only. No `setInterval` anywhere in the diff |
| 5 | `vault-locked` and `not-installed` visually and textually distinct | **Met** | Text: "No conectado" vs "Conectado, pero la bóveda está bloqueada". Visual: `screens.css` gives `state-vault-locked` the warning colour, `state-not-installed` the muted default, `state-config-invalid` the danger colour |

### P3 — lock visibility, signal, TTL

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | LOCKED/UNLOCKED indicator in the app chrome whenever a vault exists | **Met per the approved plan** | `nav-bar.tsx:49-51`; `app.tsx:290` passes `unlocked={state.phase === "unlocked"}`. The `locked` branch of that ternary is unreachable (NavBar renders only inside the unlocked `Workspace`), which plan.md lines 170-171 explicitly anticipated and Oscar approved. See S4 |
| 2 | An auto-lock states the reason, not a generic locked screen | **Met** | `session-state.ts:61-68` (`afterLock(reason?)`), `app.tsx:96` (`onLocked → afterLock("idle")`), `app.tsx:141` (`lockNow → afterLock("manual")`), `locked.tsx:74` banner; tests in `session-state.test.ts:67-77` |
| 3 | Security §6.1–§6.5 hold | **Met** | No passphrase/key code touched anywhere in the diff (`locked.tsx` gains only a `reason` prop and one `<p>`); no new keychain call; TTL travels as minutes-or-`"off"` (`auto-lock-ttl.ts:33`); `session-guard.ts` untouched, so "only ever tightens" is preserved by construction; the container rebuild reuses `FileDeviceIdentity`'s persisted `lastActivity`, so changing the TTL does **not** reset the idle clock; default stays 15 (`app-preferences.ts:36`), "Never" is an explicit visible radio (`settings.tsx:106-114`) |
| 4 | Chosen TTL reaches the MCP subprocess; "disabled" explicit | **Met** | `installer.ts:19-27` writes `VALIJA_AUTOLOCK_MINUTES`; `tools-handlers.ts:113` supplies the current preference on each Connect; `installer.test.ts` covers 30 → `"30"`, null → `"off"`, omitted → absent; `container.ts:65-68` + `index.ts:35-45` feed the desktop's own guard; `schemas.ts:86` validates `int().positive().nullable()` |

### P4 — copy fix

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | `connect.step3Body` no longer instructs `/save-context` | **Met** | `en.ts:151-154`, `es.ts:152-155`; asserted in `connect-copy.test.ts` |
| 2 | Steers to natural language with a concrete example | **Met** | Both catalogs use the "remember that I prefer TypeScript over JavaScript" example, matching `onboarding.slide2Body`'s tone |
| 3 | No other surface advertises the slash command | **Met** | `rg save-context desktop/` returns only `connect-copy.test.ts`'s own doc comment. `README.md`/`docs/SPEC.md`/`CHANGELOG.md` document the *real* MCP prompt and are correctly left alone per approved D6 |

### Cross-cutting

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Module-first layout, kind-named subfolders, no bare files at a layer root | **Met** | `mcp-launch.ts` sits in `src/delivery/cli/` beside `installer.ts`, `doctor.ts`, `program.ts` — the delivery/composition root, not a bounded-context `domain/application/infra` layer, so the kind-subfolder rule does not apply (plan §"Naming / DDD / placement review", approved). `client-connection-state.ts` mirrors `state/diagnostic-rows.ts`. `formatAutoLockMinutes` joins `parseAutoLockTtl` in the same existing `domain/values/` file — same kind, right place. Naming (`resolveMcpLaunch`, `ensureValijaInstalled`, `clientConnectionState`, `presence`) is verb-first and consistent. One idiom wobble: `ValijaInstallError` (C3) |
| 2 | Tests per layer; docs in the same commit | **NOT MET (tests)** | Docs ship in the commit (`advances/CONNECT/docs.connect.md`, `docs/gui.md`, `CHANGELOG.md`) — good. But `ensureValijaInstalled` — the riskiest new function in the advance, it installs software globally — has **zero tests**: `mcp-launch.test.ts` covers only `resolveMcpLaunch`, and `tools-handlers.test.ts:15-18` mocks the whole module away. Neither the "already installed → skip" branch nor the `ValijaInstallError` wrapping is exercised anywhere |

---

## 2. Hard gates

| Gate | Result |
| --- | --- |
| Security surface not weakened | **PASS.** No secret or key is logged, written, or moved. `stdio: "ignore"` on the install keeps npm output out of the app (`mcp-launch.ts:45`). The desktop discards the caught message (`tools-handlers.ts:79-81`, asserted at `tools-handlers.test.ts:110`). Key derivation, `OsKeychain`, and SQLCipher keying are untouched. The new client-`env` value is minutes-or-`"off"`. No new MCP tool or prompt. The one new outbound action — `npm i -g valija` — is a shell-out to `npm` only, never to an app-constructed URL, and `docs/gui.md` was updated to stop claiming the app "never makes a network request of any kind" |
| Tests present for new behaviour; suite green | **FAIL.** Both suites are green (310 + 754), but `ensureValijaInstalled` is entirely untested (see cross-cutting #2) |
| Advance ritual evidenced | **PASS.** `refined.md` (Gate R resolved 2026-08-29) → `plan.md` carrying `Approved: Oscar 2026-08-29` on line 1 → this `review.md` |
| Naming / clean architecture / file placement | **PASS**, with the `ValijaInstallError` note in C3 |
| P1 works on the three target OSes | **FAIL** (C1) |

---

## 3. Issues

### Critical

**C1 — `execFileSync("npm", …)` without `shell: true` breaks Connect and `valija install` on
Windows, and on any host whose `PATH` lacks npm.**
`src/delivery/cli/mcp-launch.ts:23` (the default-argument shell-out) and `:45` (the global install).
The repo's own `desktop/src/main/infra/child-process-node-probe.ts:5-9` says why this cannot work on
win32. Consequences, all on the exact path P1 exists to make reliable:

- win32: `resolveMcpLaunch()` throws → `mcpEntry` throws → `installIntoClient` throws → Connect and
  `valija install` both fail, and the manual fallback throws too (C2). §10's "fails silently on
  someone else's machine" scenario, reproduced.
- darwin/linux GUI launch: an Electron app started from Finder/Dock inherits launchd's minimal
  `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`). With nvm/fnm/Volta or Homebrew-on-Apple-Silicon npm,
  `npm` is not on it — same `ENOENT`, same crash. This is a **regression**: before CONNECT, Connect
  always wrote the config and merely showed the Node-missing warning.

*Fix:* pass `{ shell: true }` on both calls (args are literals, so no injection surface — the
node-probe comment makes the same argument), and treat a failed prefix resolution as a typed,
recoverable outcome rather than a thrown error escaping `mcpEntry`.

**C2 — the fallback path throws from inside the `catch` that is meant to produce it.**
`manualInstructions` now calls `resolveMcpLaunch()` (`installer.ts:116`), and both callers invoke it
*inside* their catch blocks: `tools-handlers.ts:79-81` and `program.ts:106-109`. When the reason for
the catch is that npm can't be reached (C1, or a broken prefix), `manualInstructions` throws again
and the exception escapes:

- Desktop: it escapes `connectClient` before `toIpcResult` runs → `ipcMain.handle` rejects →
  `connect-tools.tsx:65-71` awaits with no `try`/`catch`, so `setConnecting(null)` never runs and the
  card's button stays disabled forever, with no message. The "expected, recoverable content" contract
  in `tools-handlers.ts:53-62` is not actually honoured.
- CLI: the throw escapes the `install` action → `program.parseAsync().catch` prints a raw
  `spawnSync npm ENOENT` and exits 1 **without printing the manual snippet at all**.

*Fix:* resolve the launch entry once, up front, into a value (or a `Result`); build the manual
snippet from data already in hand so the fallback cannot fail. Add a `try`/`catch` (or `finally` for
`setConnecting`) around `handleConnect`'s await so a rejected IPC call can never strand the button.

**C3 — `ensureValijaInstalled` is untested, and its typed error is dead with a false comment.**
`mcp-launch.ts:32-33` documents `ValijaInstallError` as *"callers catch this specifically"* — no
caller does: `tools-handlers.ts:79` and `program.ts:106` both use a bare `catch`, and the class is
imported nowhere (verified by repo grep). So the class is dead weight carrying an untrue claim, and
it is also a deviation from the repo's `Result`/`vaultErr`/`DomainError` idiom for expected failures.
Combined with the missing tests for both of the function's branches, this is the "tests missing for
new behaviour" gate.
*Fix:* either return a `Result` (repo idiom) or drop the class and fix the comment — and test both
branches (already-present entry → no spawn; spawn failure → typed failure), injecting the command
runner so the test never shells out.

### Warning

**W1 — nothing verifies the resolved path exists after installing.** `ensureValijaInstalled`
(`mcp-launch.ts:41-49`) checks `existsSync(entryPath)` *before* installing but never after, and
`installIntoClient` never checks at all. Under pnpm, Volta, or a per-user prefix whose global layout
isn't `<prefix>/lib/node_modules`, `npm i -g valija` "succeeds" and Valija then writes a config
pointing at a file that does not exist — the host tool fails to start the server, silently, exactly
like the original `CONNECT_TIMEOUT`. This is refined.md §10's stated top risk, left unmitigated in
code and unvalidated by the manual test that was supposed to catch it.
*Fix:* after ensure, assert `existsSync(entryPath)`; if it is still missing, return the
`configUnreadable`/manual-snippet outcome instead of writing a dead path — turning a silent host-side
failure into a visible one, which is this advance's whole thesis.

**W2 — a synchronous, unbounded `npm i -g valija` on the Electron main process.**
`tools-handlers.ts:72` calls `ensureValijaInstalled()`, which `execFileSync`s a global install with
no `timeout`. The main process — every IPC handler, the window — is frozen for the duration, which on
a slow or stalled registry connection is minutes or forever, with no progress indication and no
cancel. plan.md D4 disclosed *latency*; it did not weigh freezing the app. Minimum: pass a `timeout`.
Better: make the ensure step async (`execFile`) and let the handler await it.

**W3 — an unresolved vault status is reported as `vault-not-initialized`, which is a guess.**
`client-connection-state.ts:32` (`if (vault === null || !vault.initialized)`) directly contradicts
its own doc comment three lines above (*"`null` only before their own fetch resolves, in which case
that check is skipped rather than guessed at"*) and the test name that pins it
(`client-connection-state.test.ts:67`: *"treats a not-yet-loaded vault status as
vault-not-initialized, **never a guess**"* — it is precisely a guess). The `node === null` branch
correctly skips; the vault branch does not. Impact: every mount briefly shows "Conectado — crea tu
bóveda" to a user who has a vault, and if `bridge.vault.status()` returns `!ok` the error is swallowed
(`connect-tools.tsx:52-54`) and the card shows that wrong state permanently. In an advance about not
lying to the user, this is the wrong default.
*Fix:* either skip the vault checks while `vault === null` (symmetrical with `node`), or add an
explicit `unknown`/loading state to the union and render "…" for it.

**W4 — the root test suite now shells out to real `npm`.** `installer.test.ts` deliberately does not
stub `resolveMcpLaunch` (its new comment says so), so eight-plus tests spawn `npm prefix -g`. plan.md
Slice 4 explicitly instructed the opposite: *"inject/stub `resolveMcpLaunch` (export it so the test
can pass a fake prefix) rather than asserting an absolute path."* The deviation makes the root suite
depend on a working npm on `PATH` and adds real subprocess spawns to a unit test. It passes here, but
it is a CI-fragility regression and an unjustified departure from the approved plan.

**W5 — `docs/SPEC.md:106` still documents the old `npx -y valija mcp` client config** (P1 criterion 5).

**W6 — the manual snippet no longer tells the user how to make it work.** The old `npx -y` snippet was
self-installing; the new one names a path under the global prefix with no accompanying
`npm i -g valija` instruction (`installer.ts:113-117`). A user who lands on the fallback because the
install failed is handed a config pointing at a file that isn't there.

### Suggestion

- **S1 — hide the shell-out.** `resolveMcpLaunch(platform = process.platform, globalPrefix =
  execFileSync(…))` spawns a subprocess from a *default argument*, invisible at every call site, and
  re-spawns on every call — up to three `npm prefix -g` spawns per Connect (ensure, `mcpEntry`,
  `manualInstructions`). Extract a named `globalNpmPrefix()` that memoises per process, and make the
  parameter explicit.
- **S2 — `tools:status` parses each client config twice** (`currentVaultPath` then `clientPresence`,
  `tools-handlers.ts:22-51`): six file reads and six `JSON.parse`s per call, on mount and on every
  window focus. One read returning `{ presence, vaultPath }` would be faster and shorter.
- **S3 — pin D3's invariant.** The idle-vs-manual attribution rests on "`vault.lock()` never returns
  `VAULT_LOCKED`". I verified that holds today (`lock-vault.use-case.ts` returns `ok` on every path),
  but nothing guards it; a one-line test in the lock-vault suite would stop a future change from
  silently mislabelling a manual lock as an idle one.
- **S4 — the NavBar indicator can only ever read "Unlocked".** Approved by plan.md, so not a defect —
  but as shipped it is a constant label, not an indicator. Consider `role="status"` on the span, and
  either drop the dead branch or reuse the component on the locked screen so the badge means something.
- **S5 — a globally-exported `VALIJA_AUTOLOCK_MINUTES=5` is silently overwritten with `15`** on the
  next Connect, because the desktop always writes its preference (default 15) into the client `env`.
  Not a §6.3 breach — 15 is the documented default and the user's own Connect press triggers it — but
  worth one line in `docs/gui.md` for users who had already tightened the TTL by hand.
- **S6 — CSS gives `not-installed` no colour of its own**, only the inherited muted default. It reads
  fine, but an explicit rule beside the other five would keep the state set complete in one place.

---

## 4. Manual cross-platform validation (plan.md Slice 4) — NOT PERFORMED

plan.md requires, before the advance is done, a cold-cache first-launch test on **win32, darwin and
linux**, under at least one Node version manager and a per-user npm prefix, with the results recorded
here. For the record:

| OS | Node manager | Cold-cache first launch | Result |
| --- | --- | --- | --- |
| win32 | — | not run | **not verified** |
| darwin | — | not run | **not verified** |
| linux | — | not run | **not verified** |

This environment has no win32/darwin host and no way to clear a real npm cache per platform. The gap
was disclosed by the orchestrator rather than hidden, and I am not counting it as dishonesty — but it
is not met, and C1 is a concrete demonstration that this test was load-bearing rather than
ceremonial: a five-minute run on Windows would have caught it.

---

## 5. What flips this to PASS

1. **C1** — `{ shell: true }` (or an equivalent Windows-safe resolution) on both `npm` invocations in
   `mcp-launch.ts`, and a failed prefix resolution that returns a value instead of throwing out of
   `mcpEntry`.
2. **C2** — a `manualInstructions` that cannot throw (resolve the entry once, up front), plus
   `handleConnect` guarded so a rejected IPC call cannot strand the Connect button.
3. **C3** — tests for both branches of `ensureValijaInstalled` with the command runner injected, and
   `ValijaInstallError` either genuinely used by its callers or removed along with its comment.
4. **W1** — verify the resolved entry exists before writing it; fall back to the manual snippet when
   it does not.
5. **W3** — stop reporting an unresolved vault status as `vault-not-initialized`; make the code, its
   doc comment, and the test name agree.
6. **W5** — update `docs/SPEC.md:106` to the resolved-`node` entry.
7. Re-run both suites green, and record the §4 three-OS results (or have Oscar explicitly accept them
   as deferred, in writing, in this file).

W2, W4, W6 and the suggestions are not blocking, but W2 (a frozen main process with no timeout) and
W4 (a unit suite that shells out, against the plan's explicit instruction) should not survive much
longer than this advance.
