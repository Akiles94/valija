Verdict: FAIL

# CONNECT — change review (second pass)

Reviewed: `3e2e230` ("feat(CONNECT)") + `2653879` ("fix(CONNECT): address change-reviewer's FAIL
pass"), diffed against `bcb573d`. 48 files.

| Category | Lines |
| --- | --- |
| Production TS/TSX | **+566 / −123** (plan estimated ~300) |
| Tests | +488 / −37 |
| Docs + CSS (excluding this file) | +170 / −20 |

Suites, run by me at review time (not taken on trust):

| Suite | Result |
| --- | --- |
| root `npm run typecheck && npm run lint && npm run test` | pass — 58 files, **318 tests** |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | pass — 52 files, **757 tests** |

**Every code-level defect from the first pass (C1, C2, C3, W1–W6) is genuinely closed** — I
re-derived each one from the diff rather than from the commit message, and re-checked P2/P3/P4 and
the plan's security checklist from scratch. I found **no new Critical**.

The verdict is FAIL on exactly one thing, and it is not a code defect: **refined.md §7 P1 bullet 4
and §10 make a cold-cache first-launch validation on win32/darwin/linux a precondition of
done-ness** ("This must be validated on all three OSes with a cold cache before the advance is
called done"), and plan.md Slice 4 requires the results recorded in this file. They cannot be
produced in this sandbox, they were transparently disclosed by the orchestrator, and I am not
treating the disclosure as dishonesty — but an unmet criterion is unmet, and only Oscar can either
run it or record a deferral. §6 says exactly what flips this to PASS, and it is one line of human
input, not more code.

---

## 1. Acceptance criteria (refined.md §7)

### P1 — reliable first launch

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Written entry has no per-launch npm fetch (no bare `npx -y valija`) | **Met** | `src/delivery/cli/mcp-launch.ts:53-64` returns `{ command: "node", args: [<prefix>/…/valija/dist/program.js, "mcp"] }`; `installer.ts:22-34` builds every written entry from it; `installer.test.ts:41-50` pins the shape and `:112` pins "no npx" in the manual snippet, `mcp-launch.test.ts:24-27` pins it in the entry. `package.json:10-17` confirms `dist/program.js` is the published bin and `dist` ships in `files`, so the resolved path is real for a standard `npm i -g` |
| 2 | Entry still works on win32, darwin, linux for all three clients; `env.VALIJA_HOME` parity | **Met at code level; runtime unverified on win32/darwin** (see #4) | C1 closed: both shell-outs now pass `{ shell: true }` (`mcp-launch.ts:22`, `:88`), matching `child-process-node-probe.ts:5-13`'s own documented reasoning, so `npm.cmd` resolves on Windows. The win32 branch (`<prefix>/node_modules/…`, no `lib/`) matches npm's real Windows global layout; the posix branch (`<prefix>/lib/node_modules/…`) matches npm's. `mcp-launch.test.ts:5-32` covers linux/darwin/win32/null. `VALIJA_HOME` parity: `installer.test.ts:52-61`, `:78-82` |
| 3 | Goes through Valija's own install path, no runtime hand-edit of a host-owned file | **Met** | `installIntoClient` (`installer.ts:108-119`) is the only writer; `tools-handlers.ts:108-116` writes only on an explicit Connect press; no background rewrite anywhere in the diff |
| 4 | Cold-cache first launch inside the host timeout, in a documented manual test | **NOT MET (disclosed, not hidden)** | Not performed — §4 below. This is the spec's own §10 top risk and the plan's own mandatory step; it is the sole blocker |
| 5 | `manualInstructions` and connect copy match the new shape; no stale `npx -y` in copy or tests | **Met** | W5 closed: `docs/SPEC.md:106` now describes the resolved `dist/program.js` entry (`SPEC.md:58` is a historical D3 rationale and correctly untouched). W6 closed: `installer.ts:141` leads with `npm i -g valija`; `installer.test.ts:108-124` pins both the resolved and the fill-in-yourself template. `docs/gui.md:176-186`, `:353-356` and `CHANGELOG.md` updated. The remaining `npx -y valija mcp` strings are a markdown-parser fixture (`light-markdown.test.ts:115`) and the D3 decision record — neither is installer copy |

### P2 — honest per-client status

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Exactly one of the §5 states per card, not a lone boolean | **Met** | `client-connection-state.ts:28-40`; `messages.ts:180-192` replaces `connected: boolean` with the `presence` tri-state; `connect-tools.tsx:161-165` renders exactly one label. The union adds a **seventh** id, `checking` — not in §5's table, but it is the honest answer to "vault/node haven't loaded yet" that W3 demanded, it names the same concept `SessionState`'s own `checking` phase does, and it never displaces a real state (`client-connection-state.test.ts:63-78`) |
| 2 | `ready` never asserts "Connected" | **Met** | `en.ts:175` `ready: "Ready to use"`, `es.ts:178` `"Listo para usar"`; the distinction is spelled out for users in `docs/gui.md:160-168` |
| 3 | Reuses `VaultStatus`/`NodeProbe`, no parallel re-derivation | **Met** | `clientConnectionState(entry, vault, node)` consumes the already-fetched `VaultStatusResponse`/`NodeStatusResponse`; `tools:status` stays a config-only read (`tools-handlers.ts:39-51`, hygiene test `tools-handlers.test.ts:171-181` proves neither keychain nor `vault.db` is touched) |
| 4 | Mount + window focus only, no new polling | **Met** | `connect-tools.tsx:44-64` (`wireFocusRefresh`, explicit "No setInterval" comment). `rg setInterval` over the diff: no hits |
| 5 | `vault-locked` and `not-installed` visually and textually distinct | **Met** | Text: "No conectado" vs "Conectado, pero la bóveda está bloqueada" (`es.ts:171-179`). Visual: `screens.css:197-211` — `state-vault-locked` warning, `state-config-invalid` danger, `state-not-installed`/`state-checking` muted, `state-ready` accent |

### P3 — lock visibility, signal, TTL

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | LOCKED/UNLOCKED indicator in the app chrome whenever a vault exists | **Met per the approved plan** | `nav-bar.tsx:49-51`, styled `base.css:182-199`; `app.tsx:290` passes `unlocked={state.phase === "unlocked"}`. The `locked` branch is unreachable (NavBar renders only inside the unlocked `Workspace`) — plan.md:170-171 anticipated exactly this and Oscar approved it. See S5 |
| 2 | An auto-lock states the reason, not a generic locked screen | **Met** | `session-state.ts:61-68` (`afterLock(reason?)`), `app.tsx:97` (`onLocked → afterLock("idle")`), `app.tsx:141` (`lockNow → afterLock("manual")`), `app.tsx:252` passes it through, `locked.tsx:74` renders the banner; `session-state.test.ts:67-77` pins reason-carrying and the no-reason cold start. D3's invariant (a manual `vault.lock()` never returns `VAULT_LOCKED`) still holds in `lock-vault.use-case.ts` |
| 3 | Security §6.1–§6.5 hold | **Met** | Re-verified from scratch: no passphrase/key code is touched anywhere in the diff (`locked.tsx` gains only a `reason` prop and one `<p>`; the single-crossing comment is intact); no new keychain call; `session-guard.ts` is byte-identical, so "only ever tightens" is preserved by construction; the TTL travels as minutes-or-`"off"` (`auto-lock-ttl.ts:26-33`), never a secret; `stdio: "ignore"` on the install (`mcp-launch.ts:88`) keeps npm output out of the app; the desktop discards the caught message (`tools-handlers.ts:79-81`, asserted `tools-handlers.test.ts:113`); the container rebuild reuses `FileDeviceIdentity`'s persisted `lastActivity`, so a TTL change does not reset the idle clock; the default stays 15 (`app-preferences.ts:36`), "Never" is an explicit visible radio (`settings.tsx:106-114`), and the effective TTL is visible in Diagnostics (`diagnostics.ts:148-155`). See W3 for a precedence wrinkle that is visible, not silent |
| 4 | Chosen TTL reaches the MCP subprocess; "disabled" explicit | **Met** | `installer.ts:30-32` writes `VALIJA_AUTOLOCK_MINUTES`; `tools-handlers.ts:113` supplies the current preference on each Connect (`tools-handlers.test.ts:117-127`); `installer.test.ts:63-82` covers 30 → `"30"`, null → `"off"`, omitted → absent; `container.ts:65-68` + `index.ts:29-46` + `preferences-handlers.ts:20-30` feed the desktop's own guard on change (`preferences-handlers.test.ts:64-91`); `schemas.ts:86` validates `int().positive().nullable()`; `file-app-preferences-store.ts:33-41` refuses to default a persisted `null` back to 15 (`file-app-preferences-store.test.ts:60-73`) |

### P4 — copy fix

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | `connect.step3Body` no longer instructs `/save-context` | **Met** | `en.ts:151-154`, `es.ts:152-155`; pinned in `connect-copy.test.ts:18-21` for both catalogs |
| 2 | Natural language with a concrete example | **Met** | Both catalogs use the "remember that I prefer TypeScript over JavaScript" example, matching `onboarding.slide2Body`'s tone; `connect-copy.test.ts:23-25` |
| 3 | No other surface advertises the slash command | **Met** | `rg save-context desktop/src src README.md`: only the test's own doc comment, the real MCP prompt registration (`mcp/server.ts:165`), and `README.md:178`, which documents the genuine prompt — left alone per approved D6 |

### Cross-cutting

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Module-first layout, kind-named subfolders, no bare files at a layer root | **Met** | `src/delivery/cli/mcp-launch.ts` sits beside `installer.ts`/`doctor.ts`/`program.ts` in the delivery/composition root — not a bounded-context `domain/application/infra` layer, so CLAUDE.md's kind-subfolder rule does not bite; plan §"Naming / DDD / placement review" says so and was approved. `client-connection-state.ts` mirrors the existing pure `state/diagnostic-rows.ts`. `formatAutoLockMinutes` joins `parseAutoLockTtl` in the existing `domain/values/auto-lock-ttl.ts` — same kind, right file. Naming (`resolveMcpLaunch`, `ensureValijaInstalled`, `clientConnectionState`, `presence`, `checking`) is verb-first/ubiquitous-language and consistent with the codebase. C3's `ValijaInstallError` idiom wobble is gone |
| 2 | Tests per layer; docs in the same commit | **Met** | C3/W4 closed: `mcp-launch.test.ts:35-89` now covers all four `ensureValijaInstalled` paths (already-installed skip, install-then-present, unresolvable prefix, install "succeeds" but entry still missing) with all three collaborators injected, and `installer.test.ts:13-18` mocks `mcp-launch.js` instead of shelling out to real npm — the root suite no longer spawns `npm prefix -g`. Layers covered: domain (`auto-lock-ttl.test.ts`), delivery (`installer.test.ts`, `mcp-launch.test.ts`), main handler (`tools-handlers.test.ts`, `preferences-handlers.test.ts`), main infra (`file-app-preferences-store.test.ts`), IPC schema (`schemas.test.ts`), renderer state (`client-connection-state.test.ts`, `session-state.test.ts`, `preferences-write.test.ts`), i18n data (`connect-copy.test.ts`). Docs ship in-commit (`advances/CONNECT/docs.connect.md`, `docs/gui.md`, `docs/SPEC.md`, `CHANGELOG.md`) |

---

## 2. First-pass issues — closure check (each re-derived from the diff)

| Issue | Closed? | What I verified |
| --- | --- | --- |
| **C1** `execFileSync("npm", …)` without `shell: true` | **Yes** | `mcp-launch.ts:22` and `:88` both pass `{ shell: true }`; args stay literals, so no injection surface is opened. `resolveMcpLaunch` now returns `null` instead of throwing (`:53-58`), and the failure is recoverable end to end. Caveat in W4: the accompanying comment overclaims what `shell: true` fixes |
| **C2** the fallback threw from inside the catch meant to produce it | **Yes** | `manualInstructions` (`installer.ts:129-145`) has no throwing path — a `null` launch renders a fill-in template (`:132-139`) and the text always leads with `npm i -g valija`. `mcpEntry` throws a plain `Error` (`:24-26`) that `tools-handlers.ts:79-81` and `program.ts:106-109` already catch. `connect-tools.tsx:70-78` wraps the await in `try`/`finally`, so the button can never stay disabled. Pinned by `installer.test.ts:98-124` and `tools-handlers.test.ts:99-115` |
| **C3** `ensureValijaInstalled` untested; dead `ValijaInstallError` with a false comment | **Yes** | The class is gone (`rg ValijaInstallError`: no hits). Three injectable collaborators (`mcp-launch.ts:85-91`) and five tests |
| **W1** nothing verified the entry exists after installing | **Yes** | `mcp-launch.ts:101-105` re-checks and throws a readable error; `mcp-launch.test.ts:79-89` pins it, including that `runInstall` ran exactly once. This turns §10's silent-dead-config risk into a visible manual-snippet fallback |
| **W2** unbounded synchronous install freezing Electron's main process | **Partly** | `timeout: 120_000` added (`mcp-launch.ts:88`) — the minimum bar I asked for, so not blocking. Still synchronous, so the main process can block for up to two minutes with no progress or cancel, and `globalNpmPrefix` (`:20-26`) still has no timeout at all. See S1 |
| **W3** `vault === null` reported as `vault-not-initialized` | **Yes** | `client-connection-state.ts:35` returns `checking` whenever `vault === null || node === null`, before any real check; the doc comment (`:17-27`), the test names (`client-connection-state.test.ts:63-78`) and the code now agree. Threaded through `STATUS_LABEL_KEY` (`connect-tools.tsx:18`), both catalogs, and `screens.css:208-211` |
| **W4** root suite shelled out to real npm | **Yes** | `installer.test.ts:13-18` `vi.mock`s `./mcp-launch.js` with a fixed fake entry, matching `tools-handlers.test.ts:12-19`'s existing pattern; `vi.mocked(...).mockReturnValueOnce(null)` drives the two failure cases |
| **W5** `docs/SPEC.md` still documented `npx -y valija mcp` | **Yes** | `docs/SPEC.md:106` |
| **W6** manual snippet named a path with no install instructions | **Yes** | `installer.ts:141`, asserted in both `manualInstructions` tests |

---

## 3. Hard gates

| Gate | Result |
| --- | --- |
| Security surface not weakened | **PASS.** No secret or key is logged, written, or moved anywhere in the diff. Argon2/`OsKeychain`/SQLCipher keying and `src/vault/infra/**`, `src/context/infra/**`, `src/delivery/mcp/**` are untouched (`git diff --stat` on those paths: empty). No new MCP tool or prompt. The new client-`env` value is minutes-or-`"off"`. `preferences.json` gains one non-secret integer, and the "no raw key in any file the app wrote" hygiene test still passes (`vault-handlers.hygiene.test.ts:78`). The one new outbound action is `npm i -g valija` — a shell-out to `npm`, never a URL the app constructs — and `docs/gui.md:184-186` was updated to stop claiming the app makes no network request of any kind |
| Tests present for new behaviour; suites green | **PASS.** 318 + 757, both green, run by me. The two gaps the first pass named are closed |
| Advance ritual evidenced | **PASS.** `refined.md` (Gate R resolved 2026-08-29) → `plan.md` line 1 `Approved: Oscar 2026-08-29` → this `review.md` |
| Naming / clean architecture / file placement | **PASS.** See cross-cutting #1 |
| Spec-mandated cross-platform validation (refined §10, §7 P1-4, plan Slice 4) | **FAIL — not performed.** §4 |

---

## 4. Manual cross-platform validation (plan.md Slice 4) — NOT PERFORMED

| OS | Node manager | Cold-cache first launch | Result |
| --- | --- | --- | --- |
| win32 | — | not run | **not verified** |
| darwin | — | not run | **not verified** |
| linux | — | not run | **not verified** |

This environment has no win32 or darwin host and no way to clear a real per-platform npm cache. The
gap was disclosed by the orchestrator in both passes rather than hidden, and I am recording it as
such — not as dishonesty. But refined.md §10 says the mechanism "must be validated on all three OSes
with a cold cache **before the advance is called done**", refined §7 P1 bullet 4 makes it an
acceptance criterion, and plan.md Slice 4 (approved) says "Record the results in
`advances/CONNECT/review.md`". Three Oscar-approved documents make this a precondition; no
Oscar-signed deferral exists anywhere in the repo, and an agent message is not one.

It is also not ceremonial: the first pass's C1 was precisely a win32/`PATH` bug that five minutes on
a Windows box would have surfaced, and the residual risks below (global layouts under pnpm/Volta, a
GUI-launched app's `PATH` on macOS) live in exactly the same blind spot.

Minimum useful run, per plan Slice 4: uninstall global `valija`, clear the npx cache, run both GUI
Connect and `valija install claude-code`, inspect the written entry, restart the host tool and
confirm no `CONNECT_TIMEOUT` — on win32, darwin and linux, including at least one Node version
manager (nvm/fnm/Volta) and a per-user npm prefix.

---

## 5. Issues

### Critical

**None.** All three from the first pass are closed and I found no new ones.

### Warning

**W1 — the connect failure message misattributes the cause, in the advance about not misleading the
user.** An `ensureValijaInstalled` failure (npm not on `PATH`, `npm i -g` errored, entry still
missing) maps to `outcome: "configUnreadable"` (`tools-handlers.ts:79-81`, plan-approved, so not a
deviation), but the renderer then prints `connect.failureInvalidConfig` —
*"{client}'s config file isn't valid JSON — it was left untouched."* (`en.ts:167`,
`connect-tools.tsx:197-199`). For an npm failure that sentence is simply false, and it points the
user at the wrong thing to fix. The snippet below it now leads with `npm i -g valija`, which softens
but does not correct it. *Fix (one catalog key, no IPC change):* make the shared string
cause-neutral — e.g. EN *"Valija couldn't finish connecting {client} automatically. Here's how to do
it by hand:"* / ES *"Valija no pudo conectar {client} automáticamente. Así puedes hacerlo a mano:"* —
or keep the JSON-specific wording and add a second outcome id for the ensure failure.

**W2 — `docs/gui.md:181-183` now states something the code contradicts**, in a commit whose whole
point is honesty. It says: *"If the app can't find them, Connect still writes the config (so it's
ready the moment Node is installed)."* Since CONNECT, a missing `npm` makes `resolveMcpLaunch`
return `null` → `mcpEntry` throws → **no config is written at all**; the user gets the manual
snippet instead. That behaviour is a legitimate consequence of D-A=A1 (whose own §8 con is "requires
npm at connect time"), but the docs must say it. Relatedly, `connect-tools.tsx:29-31`'s comment
still claims the Node/npm warning "never disables Connect (D-W)" — the button is still enabled, but
the action now fails without npm. *Fix:* rewrite that paragraph to describe the real failure path,
and adjust the screen comment.

**W3 — the desktop preference now outranks `VALIJA_AUTOLOCK_MINUTES`, inverting this repo's own
precedence rule, and can widen the window.** `container.ts:65-68` prefers `options.autoLockMinutes`
whenever it is not `undefined`, and `index.ts:29-36` always passes the persisted preference
(default 15). A user who exports `VALIJA_AUTOLOCK_MINUTES=5` and launches the desktop app from that
shell silently gets 15. Everywhere else in this codebase the environment wins over the preference —
`app-preferences.ts:14` says of `vaultPath`: *"`VALIJA_HOME` always wins over it."* This is not a
§6.3 breach (15 is the documented default, and the effective value is visible both in Settings and
in Diagnostics' auto-lock row), but it is an inconsistency worth closing. *Fix:* mirror
`resolveVaultRoot` — apply the preference only when `process.env.VALIJA_AUTOLOCK_MINUTES` is unset,
or take the tighter of the two — and document the precedence in README's configuration table.

**W4 — the `shell: true` comment overclaims what it fixes** (`mcp-launch.ts:10-19`). `shell: true`
runs `/bin/sh -c` (or `cmd /c`), which inherits the parent's `PATH` and does **not** source a login
profile — so it does **not** "cover a GUI-launched Electron app on macOS/Linux inheriting
launchd/init's minimal `PATH`", where nvm/fnm/Volta/Homebrew npm lives only in a shell profile. The
repo's own `child-process-node-probe.ts:5-9` scopes the same claim correctly, to Windows `.cmd`
only. The runtime consequence is now benign (`null` → manual snippet, which is C1's real fix), but
the comment asserts a mitigation that does not exist and will mislead the next reader. *Fix:* trim
the comment to the Windows reason and note the residual macOS-GUI-`PATH` case as handled by the
`null` path — or genuinely handle it with a login-shell resolution on darwin
(`execFileSync(process.env.SHELL ?? "/bin/sh", ["-l", "-c", "npm prefix -g"])`).

### Suggestion

- **S1 — bound and un-block the install shell-out.** `globalNpmPrefix` (`mcp-launch.ts:20-26`) has
  no `timeout`, and `ensureValijaInstalled` is still synchronous on Electron's main process for up to
  120 s. Add a small timeout to the prefix call, and consider an async `execFile` the handler awaits
  so the window stays responsive.
- **S2 — prefer `npm root -g` over `npm prefix -g` plus a hand-built layout branch.** `npm root -g`
  returns the global `node_modules` directory directly, which deletes the win32/posix `lib/` branch
  entirely and is correct under more setups (pnpm, Volta, per-user prefixes) — precisely the layouts
  W1's post-install existence check exists to catch. plan.md D2 already listed it as the alternative.
- **S3 — pin the installed version.** `npm i -g valija` (`mcp-launch.ts:100`) installs whatever is
  latest, alongside a desktop app that bundles its own core (`package.json` 0.3.0). Installing
  `valija@<the app's own version>` would make the MCP subprocess's vault-format expectations
  deterministic instead of "whatever npm had today".
- **S4 — a failed `bridge.vault.status()` leaves the card on "Checking…" forever**
  (`connect-tools.tsx:53-55` drops `!result.ok` silently). Better than the old wrong state, but a
  permanent spinner is its own small lie; surface the failure instead.
- **S5 — the NavBar indicator can only ever read "Unlocked"** (plan-approved, so not a defect):
  consider `role="status"` on the span, and either drop the dead `locked` branch or reuse the badge
  on the LockedScreen so it means something.
- **S6 — options-object injection.** `resolveMcpLaunch(platform?, resolvePrefix?)` and
  `ensureValijaInstalled(resolveLaunch?, runInstall?, checkExists?)` take two and three positional
  optional function parameters; a single `deps` object would read better at the call sites and avoid
  "pass the first two just to override the third" (`mcp-launch.test.ts:70-76`).
- **S7 — `installIntoClient` copies the backup before the entry can throw** (`installer.ts:114-116`):
  a `mcpEntry` failure leaves an orphan `.backup-<ts>` beside the untouched config. Practically
  unreachable today (ensure resolves the same memoised prefix first), but resolving the entry before
  `backupExisting` would make it structurally impossible.
- **S8 — pin P3's user-visible behaviour with a DOM test.** The repo already has a DOM harness
  (`screens/__dom-tests__/`); the idle banner (`locked.tsx:74`) and the nav badge are currently
  covered only indirectly, through `session-state.test.ts`.
- **S9 — one line of README upkeep.** `README.md:178` still describes `valija install <client>`
  without mentioning that it may now run a global `npm i -g valija`, and `README.md:200` still says
  "no network calls at runtime" without the connect-time caveat `docs/gui.md` now carries.
- **S10 — production lines came in at ~+566 against the plan's ~300 estimate.** Not a defect (the
  house style is comment-dense and the `presence`/preferences renames fanned out), but worth knowing
  for the next estimate.

---

## 6. What flips this to PASS

Exactly one thing, and it needs a human, not code:

1. **Record the refined §7 P1-4 / §10 validation in §4 of this file** — a cold-cache first launch on
   win32, darwin and linux (at least one Node version manager and one per-user npm prefix), with no
   `CONNECT_TIMEOUT`; **or** an explicit line from Oscar, in his own words in this file or in
   `plan.md`, deferring it — the same way `Approved: Oscar <date>` records his other gates. I cannot
   write that line, and no agent message substitutes for it.

Nothing else is blocking. W1–W4 above are real and should be fixed (W1 and W2 are each a one-string
/ one-paragraph change, and both concern exactly the kind of user-facing dishonesty this advance
exists to remove), but none of them breaches an acceptance criterion or a hard gate, and I would not
hold the merge for them once §4 is settled.
