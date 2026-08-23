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
| Spike renderer deleted | **Not yet** — left in place deliberately; deleting it before the two open items above are answered would remove the tool used to answer them |

Slice 1 is **partially complete**: the platform-proof code exists, is typechecked, linted, and
its two headless guard tests (`dependency-parity.test.ts`, `no-network-surface.test.ts`) are
green; the Linux-reachable half of the native-module question is answered with a real functional
run, not an assumption; two real bugs surfaced by actually running the app are fixed. The two
items that can only be answered by a human on real hardware are still open, exactly as the plan
said they would be.
