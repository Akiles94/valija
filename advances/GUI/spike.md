# GUI Slice 1 spike — platform proof, run log and results

## What this spike answers, and what it does not

`plan.md` Slice 1 names four unknowns that must be answered before any product screen is built:
the native-module ABI question (A3), the macOS keychain-ACL question (D-H), the per-client MCP
`env`-block question (D-R(a)'s spike), and — as a byproduct of actually running the platform —
whatever `electron-vite`/bundling surprises show up only when code runs, not when it typechecks.

**This implementation session runs inside a single headless Linux (x86_64) container with no
display server, no D-Bus secret-service daemon, and a network policy that allows the npm
registry but not `electronjs.org`.** That is enough to answer the ABI question completely and to
catch two real bugs a build/typecheck pass alone would have missed. It is **not** enough to
answer the macOS ACL question or the client-`env` question — both are recorded below as still
open, exactly as the plan always said they would need a human on real hardware. Nothing below is
extrapolated from the Linux result to macOS or Windows; where this session could not run
something, it says so instead of guessing.

---

## Environment this spike ran in

- Container: Linux x86_64, Node v22.22.2 (system), `npm` 10.x.
- Electron installed: **43.4.1**, bundling **Node v24.18.1 (NODE_MODULE_VERSION 148)**.
- System Node's own ABI: **NODE_MODULE_VERSION 127**.
- `xvfb` present (`Xvfb`/`xvfb-run`), so Electron could run with a virtual display.
- No D-Bus session/system bus (`Failed to connect to socket /run/dbus/system_bus_socket`), so no
  secret-service backend for `@napi-rs/keyring` to talk to.
- Outbound HTTPS is proxied; the npm registry is reachable, `electronjs.org` is not (proxy policy
  denial, confirmed via the proxy status endpoint — not a transient failure, and per this
  environment's own guidance, not something to route around).

---

## A3 — which native modules need an Electron rebuild: **answered, and confirmed by running, not guessing**

Plan §5 Assumption A3 predicted: `@napi-rs/keyring` and `argon2` are N-API and load under
Electron without a rebuild; `better-sqlite3-multiple-ciphers` is not N-API and needs
`@electron/rebuild`. **Confirmed exactly**, with one caveat about how the first check was run.

A first pass that only called `require("better-sqlite3-multiple-ciphers")` reported "loaded OK"
for all three modules. That result was **wrong, and is called out here rather than left in the
record**: `require()` on this package only loads its JS wrapper; the native `.node` binary is not
`dlopen`'d until a `Database` instance is actually constructed. Re-run with a functional check
(construct a `Database`, set the `sqlcipher` pragma, run a query) under Electron's own bundled
Node, launched with `--no-sandbox` (this container runs as root, which Electron refuses to run
sandboxed) via `electron <script>.cjs`:

| Module | Result | Detail |
|---|---|---|
| `argon2` | **loads and is usable** | module object present; N-API confirmed |
| `@napi-rs/keyring` | **loads and is usable** | `Entry` constructor present; N-API confirmed |
| `better-sqlite3-multiple-ciphers` | **fails to load, exactly as predicted** | `Error: The module '.../better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 148.` |

**The rebuild itself could not be completed in this container.** `npx electron-rebuild -f -w
better-sqlite3-multiple-ciphers` invokes `node-gyp`, which needs to download Electron's headers
from `www.electronjs.org`; the proxy status endpoint recorded that host as a `connect_rejected`
(403) policy denial. This environment's own operating guidance is explicit: do not retry or route
around a 403/407 policy denial, report the blocked host instead. **Recorded, not worked around:**
a real rebuild — and therefore full confirmation that the rebuilt binary loads under Electron —
still needs to run either in `desktop.yml`'s CI matrix (which may have a different egress policy)
or on a developer machine with unrestricted network access. Nothing here contradicts A3's
prediction; the prediction is confirmed for the "does it fail without a rebuild" half and
unverified for the "does the rebuilt binary then work" half.

**No library was substituted to make this easier**, per §8.1 — the finding is "the rebuild step
is real and this container can't run it," not a reason to reach for a different SQLCipher
binding.

---

## Two real bugs this spike caught, both fixed in this commit

Neither of these would have shown up in `tsc --noEmit` or the headless vitest suite — both needed
the packaged bundle actually running, which is the whole reason "run it, don't just typecheck it"
is Slice 1's standard.

### Bug 1 — the preload script's build output didn't match what `main` expected

`electron.vite.config.ts`'s default preload build emitted `out/preload/index.mjs` (ESM, because
`desktop/package.json` declares `"type": "module"`), while `main/index.ts` looked for
`out/preload/index.js`. Electron loaded no preload at all — silently, no thrown error — so
`window.spike` was `undefined` in the renderer and every button threw
`TypeError: Cannot read properties of undefined`. **Fix:** the preload build now forces CJS output
via `rollupOptions.output.format: "cjs"` with `entryFileNames: "[name].js"`, which is also the
safer choice on its own merits — sandboxed preload scripts (`webPreferences.sandbox: true`, which
this app sets from Slice 1 on) are the context where Electron's ESM-preload support is least
proven. **This is exactly the shape of bug Slice 5's real preload/IPC surface must watch for
again** — its own "Done when" already requires the app to boot to a working shell, not just to
typecheck.

### Bug 2 — a path computed from source-tree depth breaks once the bundler flattens the tree

`spike-handlers.ts` located the golden-vault fixture with
`join(import.meta.dirname, "../../../../src/testing/__fixtures__/golden-vault")`, counting `../`
segments from the file's position in `desktop/src/main/spike/`. That is wrong for the *running*
code: `electron-vite` bundles the whole main process into one file, so at runtime
`import.meta.dirname` is `desktop/out/main/`, not `desktop/src/main/spike/` — one directory level
shallower. The button failed with `ENOENT: /home/user/src/testing/...` (climbed one level too
far). **Fix:** the path now climbs three levels, not four, with a comment explaining why the
bundle's location — not the source file's — is what governs the arithmetic. **This is a
narrow, spike-local bug** (only spike/test code resolves fixture paths this way; production code
resolves the vault root from `VALIJA_HOME`/preferences, never from `import.meta.dirname`), but any
future slice that reads a bundled file by relative path from the compiled output should expect
the same trap.

Both fixes are in this commit. After both, the golden-vault button's *only* remaining failure is
the same A3 SQLCipher-ABI issue already explained above (`Module did not self-register`, the same
root cause, not a new one) — confirmed by re-running end to end.

---

## How the buttons were actually exercised

Beyond `npm run build`, the three spike buttons were driven for real: the built app was launched
under `xvfb-run` with Playwright's Electron driver (`_electron.launch`, available in this
container's global toolchain), each button was clicked, and the rendered result text was read
back — not inferred from logs. That is how bugs 1 and 2 above were found; a build-only check would
have reported success on a window that silently couldn't do anything. The driver script itself was
throwaway ad hoc tooling for this session and was not committed — it added no capability beyond
what a person clicking the same three buttons in a running window would see.

| Button | Result in this container | Why |
|---|---|---|
| Load SQLCipher | **FAIL** | A3's un-rebuilt-binary case, expected and explained above |
| Keychain round-trip | **FAIL** | `AccessDenied` from `@napi-rs/keyring` — this container has no D-Bus secret-service backend at all (confirmed separately: no system/session bus present). This is a **container limitation, not a code defect** — the same class of gap the macOS ACL question already expected to need real hardware for, just surfacing on Linux too. Unverified here: what this looks like on a Linux desktop *with* a running keyring (gnome-keyring/kwallet) — expected to work, not yet confirmed |
| Open the golden vault | **FAIL** | Same root cause as button 1 (transitively opens the SQLCipher binding) |

None of these three failures is a surprise given the container's own limits, and none was left
unexplained.

---

## D-H — the macOS keychain-ACL spike: **NOT ANSWERED, still needs a real macOS desktop session**

Unchanged from what the plan always said. This container has no macOS runtime to test on. CI on
`macos-latest` (once `desktop.yml` runs) gives a first signal but — per the plan's own words —
"cannot distinguish 'prompts the user' from 'fails with `errSecInteractionNotAllowed`.'" **Both**
interactions D-H names — the GUI reading the entry `valija unlock` created, and the GUI creating
the `doctor-probe` entry — still need Oscar (or another agent with real macOS desktop access) to
run the packaged app and report what actually happens.

## D-R(a)'s client-`env` spike: **NOT ANSWERED, still needs the three real client apps**

Confirming whether Claude Code, Claude Desktop and Cursor each honour a per-server `"env"` block
in their `mcpServers.valija` entry requires launching each real client against a config this
spike writes, which this container cannot do (no GUI client apps installed, and installing them
is outside a coding sandbox's reach). This — like D-H — is recorded as open, not guessed at.

---

## Summary — what Slice 1's "Done when" actually has, and what it's still waiting on

| Requirement (plan.md Slice 1 "Done when") | Status |
|---|---|
| Workspace scaffolding, hardened window, guard-implementation.sh extended | **Done**, this commit |
| `electron-vite build` succeeds, main resolves `../../src/**` via `.js`→`.ts` (Assumption A2) | **Confirmed** — the build transforms the `src/` modules the spike imports without a custom resolver |
| Which native modules need a rebuild (A3) | **Confirmed** by functional test: `better-sqlite3-multiple-ciphers` yes, `argon2`/`@napi-rs/keyring` no |
| The rebuilt binary actually loads under Electron | **Not verified here** — `electron-rebuild` needs `electronjs.org`, blocked by this container's egress policy; must run in CI or on a developer machine |
| Packaged artifacts for macOS/Windows/Linux, with SHA-256s | **Not produced in this session** — no code-signing identity, no Windows/macOS build hosts available here; this is `desktop.yml`'s job once it runs in CI |
| macOS ACL answer (D-H) | **Open — needs Oscar on real macOS hardware** |
| Client-`env` answer (D-R(a)'s spike) | **Open — needs the three real client apps** |
| Spike renderer deleted | **Done, in Slice 6** — see the note below on why that slice, not a later one |

Slice 1 is **platform-proof complete**: the code exists, is typechecked, linted, and its two
headless guard tests (`dependency-parity.test.ts`, `no-network-surface.test.ts`) are green; the
Linux-reachable half of the native-module question is answered with a real functional run, not an
assumption; two real bugs surfaced by actually running the app are fixed. The two items that can
only be answered by a human on real hardware are still open, exactly as the plan said they would
be — see the note below on how to answer D-H now that the spike UI is gone.

---

## Update, Slice 6 — the spike renderer is retired, deliberately, not deferred

The original plan for this file assumed the spike window (`window.spike`, `spike.tsx`) would stay
in the tree until D-H's macOS answer and D-R(a)'s client-`env` answer both landed, on the theory
that deleting it first would remove the tool that answers them. Slice 6 replaces the entire
renderer with the real first-run and session screens (`no-vault.tsx`, `create-vault.tsx`,
`recovery-kit.tsx`, `locked.tsx`, `migration-confirm.tsx`), and at that point keeping the spike
alive stopped being free — it would have meant either a second renderer entry point or a
dev-only route inside the real one, both of which are exactly the kind of scaffolding this advance
tries not to accumulate.

**The real flow answers D-H at least as well as the spike did, and more faithfully:**

- The spike's "keychain round-trip" button exercised `OsKeychain` directly against a synthetic
  `doctor-probe` entry. The real flow now exercises the *same* `OsKeychain` code path through the
  *actual* product behaviour: `vault:init` writes the session key via `CreateVault`
  (`this.keychain.setKey`), and `vault:status` reads it back via `VaultStatus`
  (`this.keychain.getKey`) — the exact read `UnlockVault` created being read by a second binary is
  D-H's own framing of the question.
- What the spike covered that the real flow does not yet: the `doctor-probe` entry specifically
  (diagnostics' own probe, Slice 10) and the "load SQLCipher" / "open the golden vault" checks
  (superseded by `vault:init`/`vault:status` opening a real, non-golden database).

**To answer D-H now:** on a real macOS desktop session, run `valija init` in a terminal, then open
the packaged app and let it read that same vault's status (or the reverse: create the vault from
the app, then run `valija status` in a terminal) — and separately, once Slice 10 lands, run the
app's diagnostics screen for the `doctor-probe` interaction. Record *prompts once / prompts every
time / silent / fails* for each interaction, exactly as originally specified.

**D-R(a)'s client-`env` spike is unaffected by this change** — it never depended on Valija's own
UI; it needs the three real client apps (Claude Code, Claude Desktop, Cursor) and a hand-written
config, both independent of whether Valija's renderer has a spike screen or not.

---

## Update, Slice 6 — the native-module rebuild gap (from Slice 1) blocks the "Done when" e2e proof

Slice 6's plan.md "Done when" asks for a real vault created and unlocked from the window, cross-
checked against `valija status` in a terminal. Attempting this for real, via Playwright driving
the actual packaged Electron build under this container's `xvfb`, reproduces exactly the gap Slice
1 already found and left open — not a new Slice 6 defect:

- The full renderer flow up through the IPC boundary works correctly, in both languages: no-vault
  → create-vault → `vault:init` submit → a real IPC round trip to main → a real `STORAGE_ERROR`
  coming back → `errorCopy()` rendering it correctly in English (*"Something went wrong reading or
  writing the vault files."*) and in Spanish (*"Algo salió mal al leer o escribir los archivos de
  la bóveda."*, verified by pre-seeding `preferences.json` with `language: "es"` before launch).
- The failure itself is `CreateVault` hitting the same wall Slice 1's functional test already
  proved: `better-sqlite3-multiple-ciphers`'s native binary is built for this sandbox's system
  Node (v22, `NODE_MODULE_VERSION` 127), not Electron 43.4.1's bundled Node (v24.18.1,
  `NODE_MODULE_VERSION` 148) — confirmed unchanged by re-checking the built `.node` file and the
  Electron version in this session. `electron-rebuild` still needs `electronjs.org`, still blocked
  by this container's egress policy (§ the table above), so no vault file write can succeed inside
  this sandbox — with or without a spike screen, and regardless of which slice runs it.
- This means Slice 6's own recovery-kit and locked screens are verified by the DOM-level test
  (`recovery-kit.dom.test.tsx`, against the golden fixture, per P-D5's reversal) and by headless
  tests of every pure decision (`session-state.ts`, `unlock-outcome.ts`,
  `create-vault-validation.ts`) and handler-level hygiene tests (`vault-handlers.hygiene.test.ts`),
  but **not** by a real create → kit → unlock → `valija status` run end to end — that specific
  proof stays blocked on the same rebuild this table already lists as open, for the same reason.

Nothing here is new work to do inside this sandbox: it is the same CI/developer-machine dependency
Slice 1 already named, now confirmed to gate one more thing (Slice 6's "Done when", not just
packaging).

---

## Update, Slice 11 — Electron itself downloads fine; only the native-module rebuild is blocked

Worth separating, since it changes what a future session should try first: **Electron's own binary
downloads successfully in this container** (`node_modules/electron/dist`, 314 MB, via `install.js` —
that traffic is not the `www.electronjs.org` host `node-gyp` needs), and `xvfb-run`/`Xvfb` are both
present. So `electron-vite dev`/`build` and a headless-display launch are *not* blocked by policy —
only `node-gyp`'s fetch of Node/Electron headers is (`electron-rebuild -f -w
better-sqlite3-multiple-ciphers` still fails with the same `403` on `www.electronjs.org` this
container's egress policy already recorded). A vault-backed screenshot therefore still can't be
taken here, for the same reason Slice 6 hit. **Confirmed again, not newly found** — recorded here so
whoever picks up Slice 12's screenshots (item 96) doesn't have to re-derive it: the golden fixture's
plaintext (`seed.json`, `manifest.json`, `expected-*`) is real and usable without SQLCipher at all,
so a fake `window.valija` bridge serving that plaintext could drive the real renderer under
Playwright for screenshots *without* needing the blocked rebuild — untried here, kept out of this
slice's scope on purpose (Oscar's own token-economy instruction for this advance's tail), but a
cheaper path than waiting for a developer machine if it's wanted before Slice 13.

## Update, Slice 12 — screenshots deferred, per item 96 and A13, honestly rather than silently

`docs/gui.md` ships in this slice with its screenshot section stating plainly that the images are
not yet included and why (the same rebuild gap above), rather than fabricating them or quietly
dropping the section. This is a human gate to schedule with Oscar, exactly like D-H's macOS ACL
answer — on a developer machine or in `desktop.yml`'s CI (which already runs `npm run test`/`build`
on three OSes with no egress restriction), the rebuild succeeds and the golden-vault screenshots
(or the mock-bridge shortcut above) can be taken in both languages and dropped into
`docs/images/gui/` without touching `docs/gui.md`'s prose.

---

## Update, Slice 13 — packaging config, the release job, and the final gates this environment can run

**Confirmed a third time, this time at the level that actually matters: `npm run package` itself
fails, not just a standalone `electron-rebuild` call.** `npm run package -- --linux` was run in
this container. `electron-builder` starts its own `npmRebuild: true` step, calls `@electron/rebuild`
internally exactly as `electron-rebuild -f -w …` does by hand, and hits the identical `403` on
`www.electronjs.org` node-gyp needs for `argon2` (the smaller, N-API-adjacent module, hit here
before it would have reached `better-sqlite3-multiple-ciphers`). Same root cause as Slices 1, 11 and
12 already recorded — the packaging command itself, not just a diagnostic tool around it, is
egress-blocked in this environment.

One incidental finding from that run, worth a line since it explains a gap Slice 12's `docs/gui.md`
had to work around by hand: `electron-builder` printed its own suggestion — *"consider to remove
excess dependency... simply add script `\"postinstall\": \"electron-builder install-app-deps\"` to
your `package.json`."* That would make `npm ci` alone rebuild native modules for Electron
automatically, closing the exact gap `docs/gui.md`'s "Running from source" section documents
manually. **Deliberately not added here** — it's a dev-workflow change outside this slice's scope
(packaging, release, final gates), and this environment cannot verify it does what it claims for the
same rebuild-is-blocked reason. Left as a note for whoever next touches `desktop/package.json`.

**What this slice adds, verified working in this environment:**

- `.github/workflows/desktop.yml` — the tag-gated `Package` step gains a `Checksum artifacts` step
  (`sha256sum` over whatever `*.dmg`/`*.exe`/`*.AppImage` files `electron-builder` produced, one file
  per OS matrix leg) and an `Upload artifacts` step. A new `release` job, gated on all three `build`
  matrix legs succeeding, downloads every OS's artifacts + checksums, combines them into one
  `checksums.txt`, and publishes a **draft** GitHub release via `softprops/action-gh-release` — draft
  on purpose, so a maintainer reviews and publishes it manually rather than an unsigned build going
  out unattended. This closes item 95's "computes and publishes each artifact's SHA-256" — verified
  by reading the workflow's own logic and by the local `sha256sum` step succeeding against a
  hand-built file in this container, not by an actual tagged CI run (this environment cannot push a
  tag or trigger CI itself).
- `desktop/src/main/infra/no-auto-update.test.ts` (new) — P-D19's guard test: `electron-builder.yml`
  has no top-level `publish:` key, `desktop/package.json` has no `electron-updater` dependency. Green
  in this environment (625 desktop tests, up from 623).

**Item 98's final gate checks, run against `origin/main` — what could be checked here, and what
couldn't:**

| Check | Result |
|---|---|
| `git diff main...HEAD --name-only` — `src/` confined to Slices 4/8's files | **Confirmed** — every changed `src/` path is one `context-pack-export.ts`/`diagnostics.ts`/the vault-relocation-and-upgrade-gate set names |
| `git diff main...HEAD -- src/delivery/mcp/` empty | **`server.ts` itself: byte-for-byte unchanged.** `server.test.ts` changed — mechanically, because `Container`'s shape grew the `folder`/`mover`/`checkVaultUpgrade`/`relocateVault` fields Slices 4 and 8 added, so the test's fixture needed the same fields to satisfy the type. No MCP tool, prompt, or behavior changed; the literal directory-wide diff is not empty, the production file is |
| `git diff main...HEAD -- package.json` empty | **Confirmed empty** (root `package.json`) |
| `.github/workflows/ci.yml` unchanged | **Confirmed empty diff** |
| root `typecheck && lint && test && build` green, test count up | **Green** — 301 tests (main has none of this advance's tests, so this is "up" by construction) |
| desktop suite green | **Green on this container's OS (Linux x86_64) only** — 625 tests. Windows and macOS are `desktop.yml`'s job, not reachable from here |
| native modules load in the packaged app, every target | **Not verified** — packaging itself fails here (above); no packaged artifact exists to check |
| zero-network walkthrough against the **packaged** artifact, both languages | **Not verified** — same reason; there is no packaged artifact in this environment to walk through |

**What remains open for Slice 13, honestly, not silently:** the native-module-loads-in-packaged-app
half of A3, the actual cross-OS packaging run, and the zero-network walkthrough in both languages
against a real packaged artifact all need `desktop.yml`'s own CI run (unrestricted egress, three real
OS runners) or a developer machine. The workflow changes that make that CI run produce checksummed,
published artifacts once it does run are in this commit and are what this environment could verify.
