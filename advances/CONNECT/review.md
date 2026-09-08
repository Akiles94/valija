Verdict: PASS

# CONNECT — change review (third pass)

Reviewed at `52b6199` ("fix(CONNECT): close review's second-pass warnings (W1–W4)"), on top of
`2653879` and `3e2e230`, diffed against `bcb573d`. 48 files.

| Category | Lines |
| --- | --- |
| Production TS/TSX | **+591 / −127** (plan estimated ~300) |
| Tests | +488 / −37 |
| Docs + CSS (excluding this file) | +179 / −23 |

Suites, re-run by me at review time on the current working tree (not taken on trust, not taken from
the commit message):

| Suite | Result |
| --- | --- |
| root `npm run typecheck && npm run lint && npm run test` | **pass, exit 0** — 58 files, **318 tests** |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | **pass, exit 0** — 52 files, **757 tests** |

Identical counts to the second pass: nothing regressed, and the one commit added since
(`52b6199`) is confined to seven files — `container.ts`, `mcp-launch.ts`, `connect-tools.tsx`, the
two catalogs, `docs/gui.md`, and this file. I re-derived that commit's whole diff line by line
rather than trusting its message, and re-checked the security surface, the placement rules, and the
spot evidence for every acceptance criterion at current line numbers.

**The single blocker from the second pass — refined.md §7 P1 bullet 4 / §10's cold-cache
first-launch validation on win32/darwin/linux — has been deferred by Oscar (§4). That was the only
thing outstanding. Every other acceptance criterion is met, no hard gate is breached, and I found
no new Critical.** Four Warnings remain open (§5); none breaches a criterion or a gate, and I would
not hold the merge for them, but three of them are documentation that still contradicts the code in
an advance whose entire purpose is to stop the product saying things that aren't true.

---

## 1. Acceptance criteria (refined.md §7)

### P1 — reliable first launch

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Written entry has no per-launch npm fetch (no bare `npx -y valija`) | **Met** | `src/delivery/cli/mcp-launch.ts:58-69` returns `{ command: "node", args: [<prefix>/…/valija/dist/program.js, "mcp"] }`; `installer.ts:22-34` builds every written entry from it; `installer.test.ts:41-50` pins the shape, `:112` pins "no npx" in the manual snippet, `mcp-launch.test.ts:24-27` pins it in the entry. `package.json:10-17` confirms `dist/program.js` is the published bin and `dist` ships in `files`, so the resolved path is real for a standard `npm i -g`. Repo-wide `rg "npx -y valija"` (excluding `advances/`): only `docs/SPEC.md:58` (the historical D3 decision record), `docs/SPEC.md:106` and `installer.ts:16` (both describing what CONNECT moved *away from*), and a markdown-parser fixture (`light-markdown.test.ts:115`) — no installer copy |
| 2 | Entry still works on win32, darwin, linux for all three clients; `env.VALIJA_HOME` parity | **Met at code level; runtime unverified on real win32/darwin hosts** (see #4 and §4) | Both shell-outs pass `{ shell: true }` (`mcp-launch.ts:27`, `:93`) so `npm.cmd` resolves on Windows, matching `child-process-node-probe.ts:5-13`'s own reasoning. The win32 branch (`<prefix>/node_modules/…`, no `lib/`) matches npm's real Windows global layout; the posix branch (`<prefix>/lib/node_modules/…`) matches npm's. `mcp-launch.test.ts:5-32` covers linux/darwin/win32/null. `VALIJA_HOME` parity: `installer.ts:29`, `installer.test.ts:52-61`, `:78-82`. Per-client paths untouched (`installer.ts:36-55`) |
| 3 | Goes through Valija's own install path, no runtime hand-edit of a host-owned file | **Met** | `installIntoClient` (`installer.ts:108-119`) is the only writer; `tools-handlers.ts:108-116` writes only on an explicit Connect press; no background rewrite anywhere in the diff |
| 4 | Cold-cache first launch inside the host timeout, in a documented manual test | **Not performed — formally deferred by Oscar on 2026-09-08 (§4)** | The test was not run; the requirement was waived by the spec's owner, not satisfied. §4 records the deferral, its exact provenance and form, and the residual risk that stays open |
| 5 | `manualInstructions` and connect copy match the new shape; no stale `npx -y` in copy or tests | **Met** | `docs/SPEC.md:106` describes the resolved `dist/program.js` entry; `installer.ts:141` leads the manual snippet with `npm i -g valija`; `installer.test.ts:98-124` pins both the resolved and the fill-in-yourself template; `docs/gui.md:176-191`, `CHANGELOG.md` updated |

### P2 — honest per-client status

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Exactly one of the §5 states per card, not a lone boolean | **Met** | `client-connection-state.ts:8-40`; `messages.ts` replaces `connected: boolean` with the `presence` tri-state; `connect-tools.tsx:165-169` renders exactly one label. The union adds a seventh id, `checking` — not in §5's table, but it is the honest answer to "vault/node haven't loaded yet", it names the same concept `SessionState`'s own `checking` phase does, and it never displaces a real state (`client-connection-state.ts:33-35`, tests `:63-78`) |
| 2 | `ready` never asserts "Connected" | **Met** | `en.ts` `ready: "Ready to use"`, `es.ts` `"Listo para usar"`; the distinction is spelled out for users in `docs/gui.md:160-172` |
| 3 | Reuses `VaultStatus`/`NodeProbe`, no parallel re-derivation | **Met** | `clientConnectionState(entry, vault, node)` consumes the already-fetched `VaultStatusResponse`/`NodeStatusResponse` (`connect-tools.tsx:51-59`, `:165`); `tools:status` stays a config-only read (`tools-handlers.ts:39-51`, `:84-89`), with the hygiene test proving neither keychain nor `vault.db` is touched |
| 4 | Mount + window focus only, no new polling | **Met** | `connect-tools.tsx:48-68` (`wireFocusRefresh`, explicit "No setInterval" comment at `:62`). `git diff bcb573d..HEAD | grep setInterval`: no production hit |
| 5 | `vault-locked` and `not-installed` visually and textually distinct | **Met** | Text: "No conectado" vs "Conectado, pero la bóveda está bloqueada" (`es.ts`). Visual: `screens.css:197-211` — `state-vault-locked` warning, `state-config-invalid` danger, `state-not-installed`/`state-checking` muted, `state-ready` accent |

### P3 — lock visibility, signal, TTL

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | LOCKED/UNLOCKED indicator in the app chrome whenever a vault exists | **Met per the approved plan** | `nav-bar.tsx:49-51`, styled `base.css:182-199`; `app.tsx` passes `unlocked={state.phase === "unlocked"}`. The `locked` branch is unreachable (NavBar renders only inside the unlocked `Workspace`) — plan.md:170-171 anticipated exactly this and it was approved. See S5 |
| 2 | An auto-lock states the reason, not a generic locked screen | **Met** | `session-state.ts:61-68` (`afterLock(reason?)`), `app.tsx` (`onLocked → afterLock("idle")`, `lockNow → afterLock("manual")`), `locked.tsx:74` renders the banner; `session-state.test.ts:67-77` pins reason-carrying and the no-reason cold start. D3's invariant (a manual `vault.lock()` never returns `VAULT_LOCKED`) still holds in `lock-vault.use-case.ts` |
| 3 | Security §6.1–§6.5 hold | **Met** | Re-verified at HEAD: `git diff --stat bcb573d..HEAD -- src/vault/infra src/context/infra src/delivery/mcp src/vault/application/policies` is **empty** — no passphrase, key, Argon2, keychain, SQLCipher-keying or SessionGuard code is touched at all, so "auto-lock only ever tightens" is preserved by construction. `locked.tsx` gains only a `reason` prop and one `<p>`; the single-crossing comment is intact. The TTL travels as minutes-or-`"off"` (`auto-lock-ttl.ts:27-33`), never a secret. `stdio: "ignore"` on the install (`mcp-launch.ts:93`) keeps npm output out of the app; the desktop discards the caught message (`tools-handlers.ts:79-81`). The container rebuild reuses `FileDeviceIdentity`'s persisted `lastActivity`, so a TTL change does not reset the idle clock. Default stays 15 (`app-preferences.ts`), "Never" is an explicit visible radio (`settings.tsx:106-114`), effective TTL visible in Diagnostics (`diagnostics.ts:142-155`). `52b6199` **tightened** this further: `container.ts:73-79` now lets a set `VALIJA_AUTOLOCK_MINUTES` win over the persisted preference, so a terminal session that exported a shorter TTL is never widened back to 15 — the pre-CONNECT behaviour is preserved exactly for anyone with the env var set. See W3 for the visibility wrinkle that creates |
| 4 | Chosen TTL reaches the MCP subprocess; "disabled" explicit | **Met** | `installer.ts:30-32` writes `VALIJA_AUTOLOCK_MINUTES`; `tools-handlers.ts:113` supplies the current preference on each Connect (`tools-handlers.test.ts:117-127`); `installer.test.ts:63-82` covers 30 → `"30"`, null → `"off"`, omitted → absent; `index.ts:29-46` + `preferences-handlers.ts:20-30` feed the desktop's own guard on change (`preferences-handlers.test.ts:64-91`); `schemas.ts:86` validates `int().positive().nullable()`; `file-app-preferences-store.ts:33-41` refuses to default a persisted `null` back to 15 (`file-app-preferences-store.test.ts:60-73`) |

### P4 — copy fix

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | `connect.step3Body` no longer instructs `/save-context` | **Met** | `en.ts:151-154`, `es.ts:152-155`; pinned in `connect-copy.test.ts:18-21` for both catalogs |
| 2 | Natural language with a concrete example | **Met** | Both catalogs use the "remember that I prefer TypeScript over JavaScript" example, matching `onboarding.slide2Body`'s tone; `connect-copy.test.ts:23-25` |
| 3 | No other surface advertises the slash command | **Met** | `rg save-context desktop/src src README.md`: only the test's own doc comment, the real MCP prompt registration (`mcp/server.ts:165`), and `README.md:178`, which documents the genuine prompt — left alone per approved D6 |

### Cross-cutting

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Module-first layout, kind-named subfolders, no bare files at a layer root | **Met** | `src/delivery/cli/mcp-launch.ts` sits beside `installer.ts`/`doctor.ts`/`program.ts` in the delivery/composition root — not a bounded-context `domain/application/infra` layer, so CLAUDE.md's kind-subfolder rule does not bite; plan §"Naming / DDD / placement review" says so and was approved. `client-connection-state.ts` mirrors the existing pure `state/diagnostic-rows.ts`. `formatAutoLockMinutes` joins `parseAutoLockTtl` in the existing `domain/values/auto-lock-ttl.ts` — same kind, right file. Naming (`resolveMcpLaunch`, `ensureValijaInstalled`, `clientConnectionState`, `presence`, `checking`, `connectFailed`) is verb-first / ubiquitous-language and consistent with the codebase. No new bounded context, no new *kind* of application object introduced |
| 2 | Tests per layer; docs in the same commit | **Met** | `mcp-launch.test.ts:35-89` covers all four `ensureValijaInstalled` paths with all three collaborators injected; `installer.test.ts:13-18` mocks `mcp-launch.js` so the root suite never shells out to real npm. Layers covered: domain (`auto-lock-ttl.test.ts`), delivery (`installer.test.ts`, `mcp-launch.test.ts`), main handler (`tools-handlers.test.ts`, `preferences-handlers.test.ts`), main infra (`file-app-preferences-store.test.ts`), IPC schema (`schemas.test.ts`), renderer state (`client-connection-state.test.ts`, `session-state.test.ts`, `preferences-write.test.ts`), i18n data (`connect-copy.test.ts`). Docs ship in-commit (`advances/CONNECT/docs.connect.md`, `docs/gui.md`, `docs/SPEC.md`, `CHANGELOG.md`). One untested seam remains — `container.ts`'s TTL precedence, W2 below — but it is a Warning, not an uncovered *feature* |

---

## 2. Closure check on the previous two passes

Re-derived from the diff, not from commit messages.

| Issue | Pass | Closed? | What I verified at HEAD |
| --- | --- | --- | --- |
| **C1** `execFileSync("npm", …)` without `shell: true` | 1st | **Yes** | `mcp-launch.ts:27`, `:93`; args stay literals, so no injection surface. `resolveMcpLaunch` returns `null` instead of throwing (`:62-63`) and the failure is recoverable end to end |
| **C2** fallback threw from inside the catch meant to produce it | 1st | **Yes** | `manualInstructions` (`installer.ts:129-145`) has no throwing path; `connect-tools.tsx:74-82` wraps the await in `try`/`finally` |
| **C3** `ensureValijaInstalled` untested; dead `ValijaInstallError` | 1st | **Yes** | Class gone (`rg ValijaInstallError`: no hits); three injectable collaborators (`mcp-launch.ts:90-96`), five tests |
| **W1** nothing verified the entry exists after installing | 1st | **Yes** | `mcp-launch.ts:106-110` re-checks and throws a readable error; `mcp-launch.test.ts:79-89` pins it |
| **W2** unbounded synchronous install | 1st | **Partly** | `timeout: 120_000` (`mcp-launch.ts:93`) — the minimum bar. Still synchronous; `globalNpmPrefix` still has no timeout. See S1 |
| **W3** `vault === null` reported as `vault-not-initialized` | 1st | **Yes** | `client-connection-state.ts:35` |
| **W4** root suite shelled out to real npm | 1st | **Yes** | `installer.test.ts:13-18` |
| **W5/W6** stale `npx -y` in SPEC; snippet with no install command | 1st | **Yes** | `docs/SPEC.md:106`, `installer.ts:141` |
| **W1** failure message misattributed the cause | 2nd | **Yes** | `failureInvalidConfig` is gone repo-wide (`rg`: zero hits); replaced by the cause-neutral `connect.connectFailed` in both catalogs (`en.ts:172`, `es.ts:169`) and at the one call site (`connect-tools.tsx:201`). The `es` catalog is typed `Catalog`, so the rename is compile-enforced across both — and typecheck passes. Residual nitpick in S6: the *IPC outcome id* is still `configUnreadable` |
| **W2** `docs/gui.md` claimed Connect writes the config without npm | 2nd | **Yes, for the paragraph named** | `docs/gui.md:176-191` now describes the real fallback and separates "Valija's own npm resolution" from "your AI tool's Node"; `connect-tools.tsx:27-36`'s comment corrected. **But the same file still contradicts itself elsewhere — see W1 below** |
| **W3** preference silently outranked `VALIJA_AUTOLOCK_MINUTES` | 2nd | **Code: yes. Docs: no** | `container.ts:73-79` checks the env var first, matching `resolveVaultRoot`'s `VALIJA_HOME` precedent, with the reasoning in the option's doc comment. The README documentation half of the fix was not done, and the new precedence has no test — see W2/W4 |
| **W4** `shell: true` comment overclaimed | 2nd | **Yes** | `mcp-launch.ts:10-24` now scopes the claim to Windows `npm.cmd` and explicitly names the `null` return as the handling for the macOS-GUI-`PATH` case, rather than pretending `sh -c` sources a profile. Accurate as written |

No new Critical. No regression: both suites match the second pass exactly (318 + 757), and the
security-sensitive paths remain byte-untouched.

---

## 3. Hard gates

| Gate | Result |
| --- | --- |
| Security surface not weakened | **PASS.** No secret or key is logged, written, or moved. `src/vault/infra/**`, `src/context/infra/**`, `src/delivery/mcp/**`, `src/vault/application/policies/**` are untouched (verified by `git diff --stat` on those paths: empty). No new MCP tool or prompt. The new client-`env` value is minutes-or-`"off"`. `preferences.json` gains one non-secret integer, and the "no raw key in any file the app wrote" hygiene test passes. The one new outbound action is `npm i -g valija` — a shell-out to `npm`, never a URL the app constructs — and `docs/gui.md:176-191` says so. `52b6199` moved the auto-lock precedence in the *tightening* direction |
| Tests present for new behaviour; suites green | **PASS.** 318 + 757, both exit 0, run by me at HEAD. Every new unit has a test at its layer |
| Advance ritual evidenced | **PASS.** `refined.md` (Gate R resolved 2026-08-29) → `plan.md` line 1 `Approved: Oscar 2026-08-29` → this `review.md`. The §4 deferral is recorded here per CLAUDE.md's own provision that an approval marker may be written "by the agent solely on Oscar's explicit say-so" |
| Naming / clean architecture / file placement | **PASS.** See cross-cutting #1. No bare file added at any bounded-context layer root |
| Spec-mandated cross-platform validation (refined §10, §7 P1-4, plan Slice 4) | **Deferred by Oscar, 2026-09-08 — no longer blocking.** §4 |

---

## 4. Manual cross-platform validation (refined.md §10 / §7 P1-4 / plan.md Slice 4) — NOT PERFORMED, DEFERRED BY OSCAR

| OS | Node manager | Cold-cache first launch | Result |
| --- | --- | --- | --- |
| win32 | — | not run | **not verified** |
| darwin | — | not run | **not verified** |
| linux | — | not run | **not verified** |

**Oscar's deferral (2026-09-08).** Asked directly during this session, through the interactive
question prompt, whether to (1) run the validation himself, (2) defer it in writing and accept the
risk, or (3) pause CONNECT until real machines are available, **Oscar selected option (2): defer the
validation and accept the risk.** The option he chose was presented to him as "you approve in
writing deferring it — I record a line accepting the risk, and we continue. The real risk: C1 (the
Windows bug) was already found and fixed without needing real Windows, so much of what the test was
looking for is already covered by code review."

**Honest provenance, stated plainly because the second pass demanded a durable, attributable
record.** This is an *interactive multiple-choice selection by the human operating the session*, not
free-form prose Oscar typed, and not a paragraph in his own words. I did not observe the prompt
myself — as a subagent I never see the human directly; it was relayed to me by the orchestrating
agent, the same channel through which every human gate in this repo reaches a reviewer. I am
recording it as such, rather than dressing it up as Oscar's own sentence, per CLAUDE.md's provision
that an approval marker may be added "by the agent solely on Oscar's explicit say-so".

**Suggested countersignature (not a blocker).** If the project wants this waiver to carry the same
durability as the other gates, Oscar can add one line at the top of this file in his own hand, e.g.
`Deferred (§4 cross-platform validation): Oscar 2026-09-08`. Nothing in this review depends on it.

**The risk that stays open, unchanged by the deferral.** §10 is right that a resolved global path is
the easiest thing here to get subtly wrong on someone else's machine, and the first pass's C1 was
exactly a win32 `PATH` bug. What code review *has* covered: the win32/posix layout split
(`mcp-launch.ts:64-67`, tested per-platform), `shell: true` for `npm.cmd`, a `null` return instead of
a throw when npm is unreachable, and — importantly — a post-install existence re-check
(`mcp-launch.ts:106-110`) that turns a mismatched global layout (pnpm, Volta, a per-user prefix)
into a *visible* manual-snippet fallback rather than a silently dead config. What code review cannot
cover: whether a real cold-cache first launch lands inside Claude Code's 30 s connect timeout on
each OS, and whether the resolved path is right under a real Node version manager.

**Recommended before any public release** (carried forward, not required for this merge): the plan's
Slice 4 procedure — uninstall global `valija`, clear the npx cache, run both GUI Connect and
`valija install claude-code`, inspect the written entry, restart the host tool, confirm no
`CONNECT_TIMEOUT` — on win32, darwin and linux, including one Node version manager and one per-user
npm prefix. Suggestion S2 below (`npm root -g` instead of `npm prefix -g` plus a hand-built layout
branch) would shrink this blind spot without needing those machines.

---

## 5. Issues

### Critical

**None.** All three from the first pass are closed, the second pass found none, and this pass found
none.

### Warning

**W1 — `docs/gui.md` now contradicts itself about auto-lock, in the advance about not saying untrue
things.** The Settings section was correctly updated (`docs/gui.md:286-296`: auto-lock "is the one
exception, and deliberately so (CONNECT)"), but two later passages in the *same file* were not:

- `docs/gui.md:366-367`, under **What this app deliberately does not do**: "Configure anything
  environment-resolved — `VALIJA_HOME`, `VALIJA_STATE_HOME`, and `VALIJA_AUTOLOCK_MINUTES` stay
  shell environment variables, shown read-only in the Sync panel." Since CONNECT, Settings sets
  auto-lock with four radios and a "Never" (`settings.tsx:93-115`). The bullet is now false.
- `docs/gui.md:373-375`: "The same is true of `VALIJA_STATE_HOME` and `VALIJA_AUTOLOCK_MINUTES`: if
  you've overridden either in a shell profile, this app uses their defaults instead." Wrong in both
  directions after `52b6199`: a double-clicked app uses the *persisted preference* (15 only if never
  changed), and an app launched from a shell that exported the variable now honours the **env**.

*Fix (docs only, no code):* drop `VALIJA_AUTOLOCK_MINUTES` from the 366-367 bullet and add a clause
naming Settings → Auto-lock as the exception; rewrite 373-375 as "auto-lock uses the value you chose
in Settings, unless `VALIJA_AUTOLOCK_MINUTES` is set in the environment the app was launched from, in
which case that wins."

**W2 — the new env-over-preference precedence has no test.** `container.ts:73-79` is now a
three-branch resolution (env set → parse it; else an explicit option → use it; else the default) and
it decides how long an unlocked vault stays unlocked. Nothing asserts it: `rg buildContainer` over
test files hits only `register-handlers.test.ts`, `relocation-handlers.test.ts` and
`content-handlers.session-safety.test.ts`, none of which exercises the TTL. A regression here would
be silent and security-adjacent. *Fix:* a small `src/delivery/container.test.ts` with three cases —
`VALIJA_AUTOLOCK_MINUTES=5` + `autoLockMinutes: 30` → guard TTL 5; env unset + `autoLockMinutes: 30`
→ 30; both absent → 15 — asserting through the constructed `SessionGuard`'s TTL or `VaultStatus`'s
`autoLock.ttlMinutes`.

**W3 — Settings can display an auto-lock value that is not in effect, with no note saying so.** The
radio is checked from `preferences.autoLockMinutes` (`settings.tsx:100`), but after `52b6199` a set
`VALIJA_AUTOLOCK_MINUTES` overrides it in the container. Launch the app from a shell that exported
`VALIJA_AUTOLOCK_MINUTES=5` with a stored preference of 60, and Settings shows "60 min" while the
vault actually locks after 5. This is the safe direction (tighter, never wider) and the *effective*
value is honestly visible in Diagnostics' auto-lock row (`diagnostics.ts:142-155`), so it is not a
§6.3 breach — but it is precisely the class of "the screen says one thing, the system does another"
that this advance exists to remove. *Fix:* pass a flag down from main when
`process.env.VALIJA_AUTOLOCK_MINUTES` is set and render a one-line explainer under the section ("An
environment variable is overriding this: X minutes"), or disable the radios in that case.

**W4 — `README.md`'s configuration table still describes auto-lock as env-only.** `README.md:188`
documents `VALIJA_AUTOLOCK_MINUTES` with no mention that the desktop app now has its own persisted
preference, nor of which wins. This was the documentation half of the second pass's W3 and is the
one part of it that was not done. *Fix:* one cell — "Idle auto-lock timeout in minutes; `0` or `off`
disables it. Wins over the desktop app's Settings → Auto-lock choice when set in the app's
environment."

### Suggestion

- **S1 — bound and un-block the install shell-out.** `globalNpmPrefix` (`mcp-launch.ts:25-31`) has
  no `timeout`, and `ensureValijaInstalled` is still synchronous on Electron's main process for up to
  120 s with no progress or cancel. Add a timeout to the prefix call, and consider an async
  `execFile` the handler awaits so the window stays responsive.
- **S2 — prefer `npm root -g` over `npm prefix -g` plus a hand-built layout branch.** `npm root -g`
  returns the global `node_modules` directory directly, deleting the win32/posix `lib/` branch
  entirely and being correct under more setups (pnpm, Volta, per-user prefixes). This is the single
  highest-value change available against the §4 risk that stays deferred, and plan.md D2 already
  listed it as the alternative.
- **S3 — pin the installed version.** `npm i -g valija` (`mcp-launch.ts:105`) installs whatever is
  latest, alongside a desktop app that bundles its own core (`package.json` 0.3.0). Installing
  `valija@<the app's own version>` would make the MCP subprocess's vault-format expectations
  deterministic.
- **S4 — a failed `bridge.vault.status()` leaves the card on "Checking…" forever.**
  `connect-tools.tsx:57-59` drops `!result.ok` silently. Better than the old wrong state, but a
  permanent spinner is its own small lie; surface the failure instead.
- **S5 — the NavBar indicator can only ever read "Unlocked"** (plan-approved, so not a defect):
  consider `role="status"` on the span, and either drop the dead `locked` branch or reuse the badge
  on the LockedScreen so it means something.
- **S6 — the IPC outcome id `configUnreadable` now outlives its meaning.** The user-facing string was
  correctly made cause-neutral (`connect.connectFailed`), but the outcome it renders from is still
  called `configUnreadable` (`tools-handlers.ts:80`, `messages.ts`) while covering npm-resolution and
  install failures too. The handler's comment explains it and the plan approved "no new outcome id",
  so this is cosmetic — but `connectFailed` or `manualFallback` would let the id read as what it is.
- **S7 — options-object injection.** `resolveMcpLaunch(platform?, resolvePrefix?)` and
  `ensureValijaInstalled(resolveLaunch?, runInstall?, checkExists?)` take two and three positional
  optional function parameters; a single `deps` object would read better at the call sites
  (`mcp-launch.test.ts:70-76` has to pass the first two just to override the third).
- **S8 — `installIntoClient` copies the backup before the entry can throw** (`installer.ts:114-116`):
  a `mcpEntry` failure leaves an orphan `.backup-<ts>` beside the untouched config. Practically
  unreachable today (ensure resolves the same memoised prefix first), but resolving the entry before
  `backupExisting` would make it structurally impossible.
- **S9 — pin P3's user-visible behaviour with a DOM test.** The repo has a DOM harness
  (`screens/__dom-tests__/`); the idle banner (`locked.tsx:74`) and the nav badge are covered only
  indirectly, through `session-state.test.ts`.
- **S10 — `README.md:200` still says "no network calls at runtime"** without the connect-time
  `npm i -g valija` caveat that `docs/gui.md` now carries, and `README.md:178` describes
  `valija install <client>` without mentioning that it may run a global install.
- **S11 — production lines came in at ~+591 against the plan's ~300 estimate.** Not a defect (the
  house style is comment-dense and the `presence`/preferences renames fanned out), but worth knowing
  for the next estimate.
- **S12 — branch name deviates from the plan.** plan.md §Branch names `feat/connect`; the work sits
  on `claude/valija-desktop-launch-strategy-4mwugz`. Almost certainly environment-imposed rather than
  chosen, and it affects nothing but the merge commit's wording — noted for the record only.

---

## 6. Standing recommendation

This PASS covers the code, the tests, and the ritual. It does **not** assert that the cold-cache
first launch has been verified on win32, darwin or linux — that check is deferred, not done, and §4
says so on the record. Before CONNECT reaches users on machines other than a developer's, run plan
Slice 4's procedure (or land S2, which removes most of the layout guesswork it was meant to catch)
and append the results to §4.
