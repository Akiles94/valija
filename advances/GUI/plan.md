# GUI — desktop companion for valija · Implementation Plan

Approved: Oscar 2026-08-20

**Spec:** `advances/GUI/refined.md` (Gate R **closed** — Oscar, 2026-08-20, fifth revision; all
eighteen items §0 originally flagged as open now carry `Decided:` lines).
**Companion:** `advances/GUI/mockups.md` — validated direction (card dashboard, this colour/type
language, dark mode, onboarding + settings in scope). **Not** pixel specs, not approved copy, not
a commitment to markup. Where the two disagree, `refined.md` governs.

**Branch (the implementer creates it after approval, not before):** `feat/desktop-GUI`

**Second revision, 2026-08-20 — Gate P closed.** Oscar reviewed this plan and confirmed, one item
at a time through an interactive prompt: every one of Group A's 18 defaults, exactly as adopted
below; **P-D3** (modify `UnlockVault` for the D-J(b) confirmation gate) confirmed as written;
**P-D5 reversed** — DOM-level tests are added for the recovery-kit and vault-relocation screens,
not skipped; **P-D10 rejected** — there is no de-scope lever, all 12 slices ship, "todo junto, sin
retirada"; and, separately from Group A/B, Oscar caught a gap neither `refined.md`'s fourth
revision nor this plan's first cut had: relocating the vault does nothing for the **separate OS
process** every connected AI tool's MCP server runs as, unless that process's own config is also
re-pointed. `refined.md`'s fifth revision closes that gap at the spec level (D-R(a), rewritten, and
new D-W); this revision closes it at the plan level — Slice 1 gains a mandatory client-`env` spike,
Slice 4 gains a shared client-config-writer change, and Slice 8 gains the re-pointing step itself.
See the marginal **(2026-08-20)** notes throughout for exactly what moved.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** The gate is live and real for this advance: `guard-implementation.sh` matches
> `*/src/*`, `*/package.json`, `*/tsconfig*.json` — which already covers `desktop/src/**`,
> `desktop/package.json` and `desktop/tsconfig*.json` today, before the D-L hook change of Slice 1.
> Do not work around it. **That line is now recorded above.**

---

## 0. What this revision resolved

**The first cut of this plan flagged a contradiction: `refined.md`'s fourth revision claimed
nothing was open while its own §7 body still marked 18 items `Open — Gate R`.** That plan adopted
all 18 written defaults verbatim rather than guess which sentence was true, and listed them in §6
for Oscar to confirm or overturn at Gate P.

**Both things are now settled.** `refined.md`'s fifth revision closes all 18 items with dated
`Decided:` lines (§7 there), and Oscar walked through every one of them individually through an
interactive prompt at Gate P — recorded in §6 below, item by item. Seventeen of the eighteen landed
exactly on the written default; **D-R(a) did not**, in the specific sense that Oscar's own question
surfaced a requirement the default's *analysis* had missed entirely, not that he rejected the
option it recommended. See A-2 in §6 for exactly what changed.

**One of the 18 was cheap to honour and one was not** — D-J(b)'s "pre-flight the schema before
migrating" collides with the fact that `UnlockVault` already migrates as a side effect of
`readLineage()`. That is a real code fact the spec did not have, it forces a change to the
product's most safety-critical use case, and it is written up as **P-D3** in §6 rather than buried
in a slice. Oscar confirmed P-D3 explicitly at Gate P.

**A second gap, caught by Oscar, not found by either refining pass.** The relocation wizard (D-R)
was designed, through three planning passes, as a file-move-plus-memory operation. Oscar asked what
happens to a connected AI tool after the vault moves, and the honest answer — verified in
`src/delivery/cli/installer.ts` — is: **nothing**, because the MCP server every AI client talks to
is a separate OS process (`npx -y valija mcp`) that reads its own config, never the desktop app's
preferences. A relocated vault would silently detach every already-connected tool while the app
reported success. `refined.md`'s fifth revision rewrote D-R(a) to require re-pointing every
connected client's MCP config as part of relocation, and added D-W (the app must detect and warn
when Node/npm is not runnable, since that is what the spawned MCP process needs). **This plan
folds both into Slice 1 (a new mandatory spike), Slice 4 (a shared client-config-writer change),
Slice 8 (the re-pointing step itself) and Slice 9 (the Node/npm warning in the connect flow) —
see the `(2026-08-20)` marks in each.**

---

## 1. Summary

This advance ships an Electron desktop application in a new top-level `desktop/` workspace (D-L
Option 1) whose main process composes the **existing** `src/` container and whose sandboxed
renderer is a bilingual UI over an enumerated IPC surface. It reaches full CLI parity for a human
user minus curation (D-P Option 5), plus two surfaces the CLI has no counterpart for (Settings and
the welcome tour, D-U), plus one genuinely new capability (the vault-relocation wizard, D-R).

Four properties drive the slice order, and three of them are scheduling decisions rather than
technical ones:

1. **The platform is proved before any screen is written** (Slice 1). Electron plus three native
   modules across macOS/Windows/Linux, and D-H's mandatory macOS keychain-ACL spike, are the two
   items whose failure would invalidate work built on top of them. No substitution of `argon2`,
   `@napi-rs/keyring` or `better-sqlite3-multiple-ciphers` is permitted to make packaging easier
   (§8.1) — if the rebuild is hard, that is a finding, not a licence to swap a library.
2. **i18n is Slice 2, not Slice 12** (`refined.md` §11's third risk, third bullet). D-V touches
   every user-facing string, blocks on nothing in `src/` (D-V(f)), and costs one lookup call per
   string when it exists first. Every screen slice after this one writes keys, never sentences.
3. **Relocation is Slice 8 of 12** — its own slice, with four slices of runway behind it. It is the
   advance's biggest risk (`refined.md` §11) and the only code here that moves the real vault's
   files **and re-points every connected AI client's MCP config** (D-R(a), rewritten 2026-08-20). It
   is deliberately not last, so it is never built under end-of-advance time pressure. **All 12
   slices ship; there is no lever to drop the wizard under schedule pressure** — Oscar rejected that
   option explicitly at Gate P (P-D10, §6).
4. **`src/` is touched in exactly four places, all of them landed before the desktop needs them**
   (Slices 4 and 8): the relocation use case D-R(c) puts there, the schema-upgrade gate D-J(b)
   forces, three small shared-composition extractions that make "byte-identical to
   `valija export`" and "the same checks `doctor` runs" *structural* rather than a test that rots,
   and — **new 2026-08-20** — a `vaultPath` parameter on `installer.ts`'s `installIntoClient`, the
   one piece of `src/` that D-R(a)'s companion step and the ordinary connect flow now share.
   Everything else in `desktop/` is a window over code that already ships.

The advance is large: roughly **5,600 production lines**, ~1,570 test lines and ~840 documentation
lines, across 12 slices. §8 treats that size as a first-class risk (R2), and treats relocation's
now-wider blast radius as the top risk (R1) — both **without** a de-scope lever, since Oscar
rejected one at Gate P (P-D10, §6).

---

## 2. Ordered steps

**Check command after every slice** — both, always:

```
npm run typecheck && npm run lint && npm run test          # repo root (unchanged surface)
npm --prefix desktop run typecheck && npm --prefix desktop run test
```

From Slice 1 on, root `npm run lint` (Biome, `includes: ["**"]`) also covers `desktop/**`, so the
desktop tree is formatted and linted by the repo's single Biome config — one style, no second
config file. Slices that touch `src/` must show the root test count going **up**, never sideways.

---

### Slice 1 — `desktop/` workspace, Electron shell, native-module ABI proof, D-H keychain spike

**Goal:** prove the platform and answer D-H's blocking unknown before one line of product UI
exists. Nothing user-facing ships in this slice; a throwaway spike window is deleted at its end.

1. **Extend `.claude/hooks/guard-implementation.sh`** (D-L's explicit obligation). Add
   `|*/desktop/*|desktop/*` to the `case` at line 37. Note in the commit message *why* it is
   nearly a no-op today: `*/src/*`, `*/package.json` and `*/tsconfig*.json` already match
   `desktop/src/**`, `desktop/package.json` and `desktop/tsconfig*.json`; what the new glob adds is
   `desktop/electron.vite.config.ts`, `desktop/electron-builder.yml` and
   `desktop/vitest.config.ts`. **This is a governance change and is part of what Oscar approves at
   Gate P** — it is not an implementation detail, and it must not be made before approval.
2. **`desktop/package.json`** — a standalone package (`"private": true`, `"name": "valija-desktop"`,
   `"type": "module"`), **deliberately not** an npm workspace of the root package. Reason: the root
   CI matrix runs `npm ci` on 3 OSes × 2 Node versions and §9 requires it be "neither slowed nor
   gated by desktop packaging"; a workspace would install Electron six times per CI run. Its own
   `package-lock.json` is committed.
   - `dependencies`: `better-sqlite3-multiple-ciphers`, `argon2`, `@napi-rs/keyring`, `ulid`,
     `zod`, `fflate` — **pinned to the exact versions in the root `package.json`**.
   - `devDependencies`: `electron`, `electron-vite`, `electron-builder`, `vite`, `react`,
     `react-dom`, `@types/react`, `@types/react-dom`, `typescript`, `vitest`, `@electron/rebuild`,
     **`jsdom`, `@testing-library/react`, `@testing-library/jest-dom`** (P-D5, reversed 2026-08-20 —
     DOM-level tests for the recovery-kit and relocation-wizard screens only, Slices 6 and 8).
   - Scripts: `dev` (`electron-vite dev`), `build` (`electron-vite build`), `package`
     (`electron-builder`), `typecheck`, `test`, `lint`.
3. **`desktop/src/main/infra/dependency-parity.test.ts`** — reads both `package.json` files and
   asserts the six shared dependency versions are identical strings. This is the mechanical guard
   against §8.1's "a crypto change wearing a build-tooling disguise": the day someone bumps
   `argon2` in one file only, a test fails instead of a vault becoming unopenable in one surface.
4. **`desktop/electron.vite.config.ts`** — three build targets (main, preload, renderer).
   `build.rollupOptions.external` lists the three native modules. The main bundle follows relative
   imports into `../../src/**` (this is D-F's whole rationale: the GUI *is* the CLI's code).
   `desktop/tsconfig.json` (main+preload, `types: ["node"]`), `desktop/tsconfig.web.json`
   (renderer, `lib: ["ES2022","DOM"]`, `jsx: "react-jsx"`), both extending the root compiler
   options (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
   `desktop/vitest.config.ts` — `include: ["src/**/*.test.ts"]`, `environment: "node"`.
5. **`desktop/src/main/index.ts`** — the bootstrap, in the order §3 of this plan fixes:
   `app.setName("Valija")` → single-instance lock → read preferences → resolve the vault root →
   `buildContainer({ vaultRoot })` → register IPC handlers → create the window. Never any other
   order.
6. **`desktop/src/main/windows/main-window.ts`** — `BrowserWindow` with `sandbox: true`,
   `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`,
   `devTools: !app.isPackaged`; a CSP header applied via `onHeadersReceived`
   (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
   connect-src 'none'; font-src 'self'; object-src 'none'; frame-src 'none'`); `will-navigate`
   denied for any non-`file:` target; `setWindowOpenHandler` returning `{ action: "deny" }`;
   `session.setPermissionRequestHandler(() => false)`. **All of it at creation time, in this slice**
   — hardening added later is hardening that gets forgotten.
7. **`crashReporter` is never started** and no `@sentry/*`-shaped dependency exists. A test greps
   the desktop tree for `crashReporter`, `setInterval`, `fetch(`, `XMLHttpRequest`, `http://` and
   `https://` and asserts zero matches outside comments (§8.3, §8.5).
8. **A throwaway spike renderer** (`desktop/src/renderer/spike.tsx`, deleted at the end of this
   slice) with three buttons, each reporting pass/fail and the exact error text:
   *load SQLCipher* (`new Db(":memory:")` + `pragma cipher='sqlcipher'`) · *keychain round-trip*
   (write, read, delete `doctor-probe` — **the same probe `doctor.ts` uses**, so the ACL question is
   answered for the real code path) · *open the golden vault* (`src/testing/__fixtures__/
   golden-vault/`, whose passphrase and key are published test values by design).
9. **Build unsigned artifacts** for macOS (arm64 + x64), Windows (x64) and Linux (x86_64) with
   `electron-builder`; `asarUnpack` the three native modules; `npmRebuild` on. Record which modules
   actually needed an Electron rebuild — the expectation to *verify, not assume*, is that
   `@napi-rs/keyring` and `argon2` are N-API and load as-is while
   `better-sqlite3-multiple-ciphers` needs `@electron/rebuild`.
10. **`.github/workflows/desktop.yml`** — a **new, separate** workflow (`ubuntu`/`windows`/`macos`)
    running the desktop typecheck, tests and `electron-vite build`. `ci.yml` is not touched, so the
    existing matrix is neither slowed nor gated (§9). Packaging runs on tag only.
11. **HUMAN GATE — the macOS ACL answer.** CI on `macos-latest` gives a first signal, but a
    headless runner cannot distinguish "prompts the user" from "fails with
    `errSecInteractionNotAllowed`". The definitive answer — *silent / prompts once / prompts every
    time / fails* — needs one run on a real macOS desktop session, for **both** interactions D-H
    names: the GUI reading the entry `valija unlock` created, and the GUI creating the
    `doctor-probe` entry. No agent can do this.
11a. **The client-`env` spike (D-R(a)'s mandatory spike, new 2026-08-20).** D-R(a)'s companion
    step — re-pointing every connected client's MCP entry during relocation — only works if each
    client actually **reads** a per-server `"env"` block in `mcpServers.valija` before spawning
    `npx -y valija mcp`, rather than caching the process's inherited environment or ignoring the
    key. This is answered **per client in `CLIENTS`** (`claude-code`, `claude-desktop`, `cursor`),
    not assumed for all three: write a config entry with `"env": { "VALIJA_HOME": "<test path>" }`
    pointing at a throwaway vault created from the golden fixture, launch the client, and confirm
    it reads from that path rather than `~/.valija`. Record **honours / ignores / undocumented
    behaviour** per client. A client that does not honour it gets that limitation named in
    `docs/gui.md` (Slice 12) and falls back to the manual snippet at relocation time (§4.7 step
    34', Slice 8) — the named-but-rejected fallback (a vault-path argument on `valija mcp`) stays
    rejected, since it is new CLI surface. Closes §6 In item 20's mandatory-spike requirement.
    Where a client cannot be exercised end-to-end in this environment, the spike record says so
    explicitly rather than assuming success — the same honesty standard `spike.md` already holds
    D-H's answer to.
12. **`advances/GUI/spike.md`** (new, in `advances/M4/spike.md`'s idiom) — per-OS results, Electron
    and Node ABI versions, which modules were rebuilt, the artifact SHA-256s, the ACL answer with
    the exact macOS version, **and the per-client `env`-honouring answer from step 11a**. §6 In
    items 19 and 20, and §9's "recorded, with the exact macOS version" criterion, are closed here,
    and both answers are carried into `docs/gui.md` in Slice 12.
13. **`.gitignore`** — `desktop/node_modules`, `desktop/out`, `desktop/dist`, `desktop/release`.
    **`biome.json`** — exclude those same build outputs.

**Done when:** the spike window opens on all three OSes from a packaged artifact (not only
`electron-vite dev`), all three native modules load in the packaged app, `spike.md` records the
per-OS results, the macOS ACL answer, **and the per-client `env`-honouring answer from step 11a**,
root `npm ci`/`ci.yml` are provably unaffected, and the
spike renderer has been deleted.

---

### Slice 2 — i18n foundation: catalogs, lookup, plurals, formats, error copy

**Goal:** the whole string mechanism exists before any screen writes a string, so no screen is ever
retrofitted (`refined.md` §11). D-V(b) Option 1, D-V(c) Option 1, D-V(e) Option 1, D-V(g) Option 1.

14. **`desktop/src/shared/i18n/languages.ts`** — `type Language = "en" | "es"`,
    `SYSTEM = "system"`, and `matchLanguage(osLocale: string): Language` doing the **primary-subtag
    match** of D-V(g) Option 1: `es`, `es-EC`, `es-419`, `es-ES` → `es`; `en-*` → `en`; anything
    else → `en`. One region-neutral Spanish catalog, on purpose.
15. **`desktop/src/shared/i18n/catalogs/en.ts`** — the source-of-truth catalog, a nested const
    object **namespaced by screen** (`createVault.*`, `recoveryKit.*`, `locked.*`, `dashboard.*`,
    `project.*`, `search.*`, `pack.*`, `connect.*`, `import.*`, `diagnostics.*`, `sync.*`,
    `relocate.*`, `migration.*`, `onboarding.*`, `settings.*`, `errors.*`, `common.*`), so coverage
    is reviewable one screen at a time. Values may carry `{named}` placeholders and, for counts, a
    `{ one, other }` pair. **No value is ever built by concatenating fragments** — word order
    differs between the two languages.
16. **`desktop/src/shared/i18n/catalogs/es.ts`** — declared `const es: typeof en = { … }`. A
    missing or misspelled key is then a **typecheck failure**, not a runtime blank; the test in
    step 19 covers the extra-keys direction that the type cannot. Copy is **neutral Latin American
    Spanish, "tú" forms, no voseo** (D-V(c)) — this is a content constraint, and for the four
    surfaces §8.17 names it is a security artifact reviewed as such.
17. **`desktop/src/shared/i18n/translate.ts`** — `createTranslator(language)` returning
    `t(key, params?)`. Resolution: active catalog → English fallback → **throw in tests / return the
    key in production** (never a silent blank). Counts route through `Intl.PluralRules(language)`.
18. **`desktop/src/shared/i18n/format.ts`** — `formatDate`, `formatDateTime`, `formatCount`,
    `formatMinutes`, bound to the active language via `Intl` (D-V(e) Option 1). There is no `Intl`
    usage anywhere in `src/` and this slice adds none.
19. **`desktop/src/shared/i18n/error-copy.ts`** — the D-V(d) rule made mechanical: a map from
    `DomainError.code` to a catalog key, plus a generic fallback that **names the code** and never
    renders `DomainError.message`. Includes the codes this advance adds (Slices 4 and 8).
20. **Tests** (`translate.test.ts`, `catalogs.test.ts`, `error-copy.test.ts`):
    identical key sets in both directions (deep walk, not just `typeof`) · every placeholder in an
    `es` value exists in its `en` counterpart · plural forms resolve in both languages · the
    fallback names the code · **and a source-scanning test** that reads
    `src/vault/domain/errors.ts`, `src/context/domain/errors.ts` and
    `src/importers/domain/errors.ts`, extracts each `type …ErrorCode` union's string literals, and
    asserts every one has copy in both catalogs. That last test is what makes "every error code
    reachable from the IPC surface has copy in both languages" (§9) stay true when a future advance
    adds a code.

**Done when:** both catalogs typecheck as one shape, the key-set and error-coverage tests are
green, and no screen exists yet.

---

### Slice 3 — Preferences store, "system or override", language/theme/tour/location policies

**Goal:** one store, one port, four keys, all headless-testable — D-R(a) Option 1, D-Q Option 2,
D-U(b) Option 1, D-V(a) (recorded). **Build the "system or override" mechanism once and use it
twice**, exactly as D-Q's fourth-revision note instructs.

21. **`desktop/src/main/application/ports/app-preferences.ts`** — the port and its data:
    ```ts
    export interface AppPreferences {
      vaultPath: string | null;      // D-R(a) — a location hint, never configuration
      theme: SystemOr<"light" | "dark">;   // D-Q
      language: SystemOr<Language>;        // D-V
      tourSeen: boolean;                   // D-U(b)
    }
    export interface AppPreferencesStore {
      read(): AppPreferences;
      write(next: AppPreferences): void;
    }
    export const DEFAULT_PREFERENCES: AppPreferences = { … };
    ```
    **Exactly four keys and no fifth** (§8.4). No "last project viewed", no "resume where you left
    off", no tour progress counter — the things the tour and the language switch tempt someone to
    add on the way past.
22. **`desktop/src/main/infra/file-app-preferences-store.ts`** — `FileAppPreferencesStore`, a JSON
    file at `app.getPath("userData")/preferences.json` (`~/Library/Application Support/Valija`,
    `%APPDATA%\Valija`, `~/.config/Valija`, given `app.setName("Valija")` runs first). Atomic write
    (temp file + `renameSync`, the same discipline `file-device-identity.ts` already uses). A
    missing or corrupt file returns `DEFAULT_PREFERENCES` and never throws — this file is read
    before the first window exists, so a parse error must not be a failure to launch. **Writes only
    the four permitted keys**, so an unknown key added by hand is dropped rather than persisted:
    §9's "exactly four keys" criterion is then structural.
23. **`desktop/src/main/application/policies/system-or-override.ts`** — the one mechanism:
    `type SystemOr<T> = "system" | T` and
    `resolveSystemOrOverride<T>(choice: SystemOr<T>, system: T): T`. Six lines, used by both the
    theme and the language. Do not derive the interaction pattern a second time.
24. **`.../policies/language-resolution.ts`** — `resolveLanguage(preferences, osLocale)` =
    `resolveSystemOrOverride(preferences.language, matchLanguage(osLocale))`. The OS value is the
    **initial value of the override**, never a separate code path (D-V(g)'s rider).
25. **`.../policies/theme-resolution.ts`** — the same shape over
    `nativeTheme.shouldUseDarkColors`. The recovery-kit screen is exempt and permanently dark
    (D-Q's exception, enforced in Slice 6 by that screen not consuming the theme at all).
26. **`.../policies/onboarding-tour.ts`** — plain TypeScript, no React: `shouldPlayTour(prefs)`,
    the ordered slide ids, `nextSlide`/`previousSlide`, and the rule that **Skip sets the seen
    flag** (D-U(b)'s rider) so a skipped tour never nags again. D-U(a) Option 2: the tour plays the
    first time *this installation* reaches the dashboard, on **either** branch of §4.2 step 3.
27. **`.../policies/vault-location.ts`** — `resolveVaultRoot(env, preferences)`:
    ```ts
    return env.VALIJA_HOME ?? preferences.vaultPath ?? undefined;   // undefined ⇒ ~/.valija
    ```
    **`VALIJA_HOME` always wins** (D-R(a)'s mandatory precedence rule), the remembered location is
    consulted only when it is unset, and the default falls through to `resolveVaultPaths()`'s own
    `~/.valija`. The whole precedence rule is one readable line.
28. **Tests** for each policy: env-wins-over-remembered; corrupt preferences file → defaults;
    write→read round-trip keeps exactly four keys; unknown key dropped; `es-419` → `es`, `fr-FR` →
    `en`; skip marks seen; replay does not clear the flag; theme and language use the *same*
    resolver.

**Done when:** the store, the four policies and the one shared resolver are green headlessly, with
no Electron window involved in any test (the `app.getPath` call is injected, not imported, so the
adapter is testable with a temp dir).

---

### Slice 4 — The `src/` changes the desktop needs (excluding the relocation use case itself)

**Goal:** land every gated-tree change the shell depends on, with the CLI's behaviour provably
unchanged, before the IPC surface is written against it. Four items, each small, each making a
§9 criterion structural instead of a test that rots. **One of the four (29a, new 2026-08-20) lands
here rather than in Slice 8 because both Slice 8's relocation wizard and Slice 9's ordinary connect
flow depend on it, and Slice 8 comes first.**

29. **`src/delivery/container.ts` — `buildContainer(options?: { vaultRoot?: string })`.** The CLI
    keeps calling `buildContainer()`. The desktop passes the root Slice 3's policy resolved, and
    calls it again after a successful relocation. Also **expose the already-constructed
    `folder: VaultFolder`** on `Container` (it exists inside the function today), so the sync panel
    and `doctor.ts` stop constructing a second `FileVaultFolder`.
29a. **`src/delivery/cli/installer.ts` — the shared client-config writer gains a vault-path
    parameter** (D-R(a)'s companion requirement, new 2026-08-20). `installIntoClient` (and the
    merge helper beneath it) takes an optional `vaultPath?: string`. When present, the written
    `mcpServers.valija` entry gains `"env": { "VALIJA_HOME": vaultPath }` alongside the unchanged
    `command`/`args`; when absent, the entry is written exactly as today, with no `env` block.
    **The CLI's `install` command passes nothing, so its output is byte-identical** — the existing
    `installer.test.ts` cases must still pass unchanged, which is the mechanical proof. **The GUI
    always passes it**, from both the connect flow (Slice 9, every connect action, not only an
    unusual vault location) and the relocation wizard's re-pointing step (Slice 8). This is one
    function serving both call sites, per `refined.md` §5.1's "one function that knows how to
    touch a client config" — Slice 8 does not get its own copy.
30. **`src/delivery/context-pack-export.ts` (new)** — `exportProjectMarkdown(c, project)` and
    `exportProjectJson(c, project)`, lifted verbatim from the two private consts in
    `content-commands.ts`, which now calls them. This is what makes §9's "byte-identical to the
    stdout of `valija export <project>`" a **structural property**: there is one composition of
    `getContextPack({ budgetTokens: Number.POSITIVE_INFINITY })` + `renderContextPackMarkdown`, and
    both surfaces call it. No CLI behaviour changes; the existing tests are the proof.
31. **The D-J(b) schema gate** — this is P-D3 in §6, and it exists because of a code fact the spec
    did not carry: **`UnlockVault` already migrates**, through `store.readLineage()` →
    `FileVaultStore.readLineage()` → `migrate(db, path)`. A GUI cannot "pre-flight the schema
    version before calling migrate" unless unlock itself can be told to stop. So:
    - **`VaultStore.readSchemaVersion(keyHex): Result<number, DomainError>`** (port + `FileVaultStore`
      implementation): open with `openVaultDb`, read the existing exported `schemaVersion(db)`,
      close. **It does not call `migrate`.** `openVaultDb`'s `wal_checkpoint`/`journal_mode` writes
      are the same bytes any read already touches (`refined.md` §3, fourth fact) — no table is
      rebuilt and no data is migrated.
    - **`src/shared/infra/migrations.ts`** exports `LATEST_SCHEMA_VERSION` and
      `pendingMigrations(current): { version: number; backsUpCiphertext: boolean }[]`, so the
      confirmation screen can name the ciphertext backup that migrations 002/003 take rather than
      hardcoding it in the UI.
    - **`UnlockInput` gains `upgradeConfirmed?: boolean`.** When the schema is behind and it is not
      `true`, `UnlockVault` returns `vaultErr("VAULT_UPGRADE_REQUIRED", …)` **before** touching
      `readLineage`, so nothing is migrated. `unlockCommand` passes `upgradeConfirmed: true` at its
      single call site — the CLI keeps migrating silently, byte-for-byte as today.
    - **`src/vault/application/use-cases/check-vault-upgrade.use-case.ts` (new)** —
      `CheckVaultUpgrade implements AsyncUseCase<UnlockInput, VaultUpgradeOutput>` where
      `VaultUpgradeOutput = { required, from, to, backsUpCiphertext }`. Called by the GUI **only**
      after unlock has refused, to describe the upgrade in the confirmation screen. The upgrade
      path therefore derives the key three times (~3s once in a vault's lifetime, behind a
      "Checking your vault…" state); **the ordinary unlock path derives exactly once and pays one
      extra `openVaultDb` (milliseconds)**. That cost profile is the reason for this shape.
    - **`VAULT_UPGRADE_REQUIRED`** added to `VaultErrorCode`.
32. **`src/shared/infra/sqlite.ts` — make the busy timeout explicit** (D-J(a) Option 1, and §9's
    "explicit in code, not inherited from a library default"):
    `new SqliteDatabase(dbPath, { timeout: SQLITE_BUSY_TIMEOUT_MS })` with the constant set to
    **the library's current default value**, verified against the installed version's typings at
    implementation time, and a comment saying that is deliberate. Behaviour is unchanged for the
    CLI and the MCP server; the question "what timeout are we actually running with?" now has an
    answer in the source. The bounded retry lives in the desktop's import handler (Slice 9), not
    here.
33. **Tests** (all under `src/`, all in the root suite): a vault built at schema 2 (using the
    technique `src/shared/infra/migrations.test.ts` already uses) refuses to unlock without
    confirmation **and its on-disk `schema_version` is unchanged afterwards**; the same vault
    unlocks and migrates with `upgradeConfirmed: true`; a current-schema vault never refuses;
    `CheckVaultUpgrade` reports `{ from: 2, to: 3, backsUpCiphertext: true }`; the CLI's
    `unlockCommand` path still migrates silently; `exportProjectMarkdown` equals the golden
    fixture's `expected-export.md` under the fixed clock; **`installIntoClient` called with no
    `vaultPath` writes byte-identical output to today's fixtures (existing `installer.test.ts`
    cases, unchanged), and called with a `vaultPath` writes the same entry plus an `"env"` block
    naming it, for each client in `CLIENTS`.**
34. **Specs, same commit** (`specs/README.md` rule 1): `specs/vault.md` gains the upgrade gate and
    `readSchemaVersion`; `specs/delivery.md` gains the container parameter and the pack-export
    helper.

**Done when:** the root suite is green with a higher test count, `git diff -- src/delivery/mcp/` is
empty, and every CLI command behaves exactly as before.

---

### Slice 5 — The IPC trust boundary

**Goal:** one enumerated, closed channel list; zod validation at the boundary exactly as the MCP
server does; **no filesystem path ever originating in the renderer** (§8.6); sessions per action.

35. **`desktop/src/shared/ipc/channels.ts`** — the channel names as a `const` tuple and the
    request/response **types** only. No zod here, so the renderer never bundles a validator it must
    not be trusted to run.
36. **`desktop/src/main/ipc/schemas.ts`** — one zod schema per channel, in the same idiom
    `src/delivery/mcp/server.ts` uses. Channels that take nothing take `z.void()`, explicitly.
37. **`desktop/src/main/ipc/handlers/`** — one file per area, each handler four lines long:
    validate, call the use case, map `Result` to a wire shape, return. `vault-handlers.ts` (init,
    unlock, lock, status, upgrade-check, upgrade-confirm) · `content-handlers.ts` (projects, show,
    search, pack, export, copy) · `import-handlers.ts` · `tools-handlers.ts` ·
    `diagnostics-handlers.ts` · `relocation-handlers.ts` (Slice 8) · `preferences-handlers.ts` ·
    `dialog-handlers.ts`. **Errors cross the boundary as `{ code }` plus structured data, never as
    `DomainError.message`** (D-V(d), §5.1) — the one exception is the diagnostics Copy-report
    payload built in main (Slice 10).
38. **`desktop/src/main/ipc/register-handlers.ts`** — registers exactly the channels in the tuple.
    A test asserts `ipcMain`'s registered channel set **equals** the enumerated list: no extra
    channel, no missing one, no `invoke("run", …)`-shaped generic escape hatch.
39. **`desktop/src/main/application/ports/file-picker.ts` + `.../infra/electron-file-picker.ts`** —
    `chooseImportFile()`, `chooseExportTarget(suggestedName)`, `chooseVaultFolder()`. **The main
    process opens the dialog and keeps the absolute path**; the renderer receives only a display
    name and an opaque handle. `import:list` and `import:run` then act on "the import the user just
    chose" — there is no channel anywhere that accepts a path, a SQL string, a module name or a
    shell command, and a test asserts that no zod schema in `schemas.ts` contains a free-form
    string field named like a path.
40. **`desktop/src/preload/index.ts`** — `contextBridge.exposeInMainWorld("valija", { … })`, one
    method per channel, hand-written, no loop over the tuple that could pick up a channel nobody
    reviewed. Nothing else is exposed; `window.require` does not exist (sandboxed).
41. **`desktop/src/renderer/state/bridge.ts`** — the typed client the screens use, so no component
    ever touches `window.valija` directly and every screen is testable against a fake bridge.
42. **Sessions per action, never long-lived.** Every handler calls a use case that goes through
    `VaultSessions.withSession` and returns; nothing holds a `Database`. A test asserts the vault
    folder has no `-wal`/`-shm`/`-journal` sidecar after a scripted sequence of handler calls.
43. **No polling.** State refreshes on user action and on the window's `focus` event only. The
    grep test from Slice 1 (`setInterval`) is the enforcement; the reason is worth a comment in
    `bridge.ts`: browse/search/pack reads go through `SessionGuard`, which records device activity
    and therefore **resets the idle auto-lock clock**, so a polling refresh would silently disable
    auto-lock (M3 D-I).

**Done when:** the channel-set equality test, the schema-rejection tests and the sidecar test are
green, and the app boots to an empty shell that can call `status`.

---

### Slice 6 — First run and session: no-vault, create, recovery kit, unlock, migration confirm

**Goal:** the security-critical screens, in both languages, with §8.2's mitigations structural
rather than promised.

44. **`no-vault.tsx`** (§4.2 step 3) — *"No vault on this machine yet"*, two choices:
    **Create a vault** · **I already have one** (which explains where valija looks and offers the
    point-me-at-it path — wired to the wizard in Slice 8).
45. **`create-vault.tsx`** (step 4) — passphrase twice; the CLI's own warning, localized: minimum 8
    characters, *"if you lose it AND the recovery kit, your data is gone. No reset exists."*
    Mismatch is caught **in the renderer before any IPC call**, and `parsePassphrase`'s rules are
    enforced by `CreateVault` — never re-implemented here (§9). The derive step shows
    *"Creating your encrypted vault (about a second)…"*; the window stays responsive because
    Argon2id runs in the main process, not the renderer.
46. **`recovery-kit.tsx`** (step 6) — the **exact output of `renderRecoveryKit`**, rendered as
    preformatted text, in a **permanently high-contrast dark** treatment that does not read the
    theme at all (D-Q's exception, made structural by that screen never importing the theme hook).
    One localized sentence above it explains that the kit is written and stored in English so it
    reads identically everywhere (D-V(d) option (a), §8.17) — **and nobody "fixes" this by
    translating `renderRecoveryKit`** (`refined.md` §11, fourth risk).
    Mitigations, none optional: a **single-shot** main-process handler (the kit is held behind a
    nonce consumed on first read, so it cannot be re-requested); no file write of any kind; a
    **Copy key** button whose label warns that the clipboard is readable by other applications, in
    the active UI language; an explicit *"I have stored this somewhere offline"* checkbox gating
    the only way forward; renderer state cleared on dismissal.
47. **`locked.tsx`** (step 9) — passphrase field, plus the secondary **"I only have my recovery
    key"** path (D-P parity gap 2, default (b)): masked input, never persisted, never logged, never
    echoed, discarded as soon as `UnlockVault` returns. §8.2's mitigations apply to it in full.
    Step 9' is free: if `valija unlock` already ran in a terminal, `status` reports unlocked and
    this screen never appears.
48. **The fork notice** (step 9'') — `VAULT_FORK_DETECTED` rendered **from the code** into plain
    localized language, naming the vault folder, with a pointer to the Sync panel. **No merge
    button, no "keep this one", no deletion of a conflicted copy** (D-I).
49. **`migration-confirm.tsx`** (D-J(b), §6 In item 13) — shown only on `VAULT_UPGRADE_REQUIRED`.
    It names what will happen in plain words, including the **ciphertext backup** that migrations
    002/003 take on a populated vault, and offers Cancel (which leaves the vault locked and
    untouched) or Continue (which re-unlocks with `upgradeConfirmed: true`). A first-run vault
    never sees it. Its copy is one of §8.17's security-relevant surfaces in **both** languages.
50. **`renderer/state/session-state.ts`** — plain TypeScript: the locked/unlocking/unlocked/
    upgrade-required/kit-pending state machine, unit-tested headlessly, including the invariant
    that **nothing can be navigated to between the kit and its acknowledgement** (D-U(a)'s hard
    requirement; the tour arrives in Slice 11 and this invariant is what blocks it).
51. **Tests:** kit shown once and unobtainable afterwards (second call to the handler fails) ·
    passphrase mismatch never reaches IPC · after a scripted init, the preferences file contains
    exactly the four keys and no hex-looking 64-character string exists in any file the app wrote ·
    `VAULT_ALREADY_EXISTS` renders from the code, in both languages · the upgrade screen appears
    only for a behind-schema vault · **(P-D5, reversed 2026-08-20) a DOM-level test
    (`jsdom` + `@testing-library/react`) renders `recovery-kit.tsx` against the golden fixture's
    key material, asserts the displayed text equals `renderRecoveryKit`'s output verbatim, asserts
    Copy key and the acknowledgement checkbox are the only interactive elements reachable before
    acknowledgement, and asserts no route change is possible until the checkbox is checked.**

**Done when:** a real vault can be created and unlocked from the window in both languages, and
`valija status` in a terminal reports the same vault, unlocked, with one keychain entry and one
device identity.

---

### Slice 7 — The read shell: browse, search, pack, export — and the Sync & safety panel

**Goal:** everything that only reads, including the cheap half of D-R, so the advance has shippable
user value before the risky slice starts.

52. **`dashboard.tsx`** (step 10) — project cards (name, item count, last activity) from
    `ListProjects`, the same rows `valija projects` prints. Dates and counts through Slice 2's
    `Intl` formatters. Empty state: *"No context saved yet"* with the two next steps §4.2 step 8
    names — **Connect an AI tool** and **Import your chat history**.
53. **`project.tsx`** (step 11) — `ShowProject` with a type filter mirroring `--type`, **`imported`
    included**. Same use case ⇒ same order and content by construction.
54. **`search.tsx`** (step 12) — `SearchContext`, optional project narrowing.
55. **`pack-preview.tsx`** (steps 13–14) — the markdown from `exportProjectMarkdown` (Slice 4),
    rendered in the trusted process and displayed as a string; **Copy** to clipboard; **Export…**
    through the native save dialog, with a **format choice (markdown / JSON)** per D-P parity gap 1,
    default (b). The pack is vault content and is **never translated** (D-V(d)).
56. **`sync.tsx`** (§4.6 step 27) — a pure read over `VaultStatusOutput` + `VaultFolderInspection`:
    vault folder path, recognized-sync-folder hint, conflicted copies, stale `.pre-NNN.bak`
    backups, at-rest state, generation and whether **this** device wrote it last, auto-lock TTL and
    idle minutes. **Displayed, never editable** (D-U(d)); the environment-resolved values are shown
    read-only. Conflict guidance is `docs/sync.md`'s, in plain words, with **no "resolve" button**
    (D-I). It also carries the **Move my vault…** entry point Slice 8 fills in, and — per the
    honest gap in §5 A6 — it displays the resolved `VALIJA_STATE_HOME` path so a user who overrode
    it in a shell profile can see that the app did not inherit it.
57. **The byte-identity test** (§9's headline shell criterion):
    `expect(desktopPackFor("alpha")).toBe(readFileSync("expected-export.md"))` under the fixed
    clock, plus an assertion that it equals `exportProjectMarkdown(container, "alpha")` — the same
    function the CLI calls. Run in **both** languages to prove the pack is not translated.
58. **Tests:** project list / item list / search results match the CLI's use-case output against
    the golden fixture · no `setInterval` refresh · a focus-driven refresh opens and closes a
    session · the sync panel performs **no write at all** (generation unchanged, no keychain change,
    no new file in the vault folder).

**Done when:** a user can browse, search, read a pack, copy it, export it to a chosen file, and see
their sync status — in English and in Spanish — with the pack byte-identical to `valija export`.

---

### Slice 8 — Vault relocation: the `src/` use case, the wizard, and re-pointing connected clients

**Goal:** the advance's biggest risk, in its own slice, with four slices of runway behind it and
four still ahead. D-R(a) Option 1 · D-R(b) Option 2 · D-R(c) Option 1 · D-R(d) Option 1. **Widened,
2026-08-20:** D-R(a)'s rewrite makes this slice's scope "move the vault's files **and** re-point
every already-connected AI client's MCP config" — one user action with three effects
(`refined.md` §4.7's own framing), not two. Nothing about the file-move logic below changed; steps
66–67 gained the re-pointing half, and a new step 67a states the failure-isolation rule plainly.

**This slice lands in `src/vault/` as well as `desktop/`** (D-R(c) Option 1) — the plan says so at
Gate P because it means gated code changes, as D-R(c)'s own note requires.

59. **`src/vault/domain/errors.ts`** — new codes, each a refusal the GUI localizes from the code:
    `RELOCATION_DESTINATION_OCCUPIED` · `RELOCATION_DESTINATION_UNUSABLE` ·
    `RELOCATION_DESTINATION_NESTED` · `RELOCATION_SOURCE_UNSETTLED` · `RELOCATION_COPY_FAILED` ·
    `RELOCATION_VERIFY_FAILED` · `RELOCATION_ROLLBACK_FAILED` · `VAULT_MUST_BE_LOCKED`.
60. **`src/vault/domain/services/vault-relocation.ts`** — `refuseUnsafeRelocation(request):
    DomainError | null`, pure, no I/O, taking plain paths plus the two inspections. Every §4.7 step
    30 refusal in one readable list, in this order:
    - the destination already contains `vault.json` **or** `vault.db` → **refuse, never merge**;
    - the destination is missing, or not a writable directory;
    - the destination **is** the current vault folder, or sits **inside** it (path containment
      checked after `resolve()`, case-insensitively on win32/darwin);
    - the current folder has an unresolved **conflicted copy** or a stale `.pre-NNN.bak` (moving
      mid-fork is exactly when people lose data — D-I(3));
    - the current folder has a `-wal`/`-shm`/`-journal` **sidecar** (not at rest — D-R(d)).
61. **`src/vault/application/ports/vault-mover.ts`** — `VaultMover`, five methods, each trivially
    fakeable: `inspect(root): VaultRootInspection` (`{ exists, writable, hasHeader, hasDb }`) ·
    `copy(from: VaultPaths, to: VaultPaths): void` · `matches(from, to): boolean` (SHA-256 of both
    files) · `discard(paths: VaultPaths): void` (remove partials, best effort) ·
    `remove(paths: VaultPaths): void`.
62. **`src/vault/infra/file-vault-mover.ts`** — `FileVaultMover`. `copyFileSync` + `mkdirSync`, so
    a **cross-filesystem destination works** (a Dropbox folder on another volume is a normal case;
    `rename` would fail with `EXDEV` — D-R(b) Option 1's trap). Digests via `node:crypto`.
63. **`src/vault/application/use-cases/relocate-vault.use-case.ts`** — `RelocateVault`, and the
    safety ordering is readable top to bottom in this one file, each line an action:
    ```
    read the header                       → VAULT_NOT_FOUND if absent
    refuse if the keychain still holds the key   → VAULT_MUST_BE_LOCKED   (belt-and-braces on D-R(d))
    refuseUnsafeRelocation(...)           → return the typed refusal, having written nothing
    mover.copy(source, destination)       → on throw: mover.discard(destination); RELOCATION_COPY_FAILED
    mover.matches(source, destination)    → false: discard; RELOCATION_VERIFY_FAILED
    readVaultHeader(destination.header)   → not ok: discard; RELOCATION_VERIFY_FAILED
    mover.remove(source)                  → on throw: discard destination, keep source; see 64
    ok({ root, vaultId, generation })
    ```
    **The source is removed only after the destination is verified complete and correct.** Never
    the other order, never "delete then copy" (§8.12).
64. **The one genuinely awkward failure, decided here rather than discovered later:** if the copy
    verifies but **removing the source fails**, the app would be left with two openable vaults
    carrying the same vault id — the exact fork scenario M3 spent an advance on. The rule:
    **roll back** — discard the destination copy, leave the source as the one vault, return
    `RELOCATION_COPY_FAILED`-class refusal naming the source folder, and **do not change the
    remembered location**. If the rollback discard *also* fails, return `RELOCATION_ROLLBACK_FAILED`
    with **both folder paths** named in the localized copy and an instruction to delete one — the
    only outcome in this design where the user must act, and it is stated plainly rather than
    silently tolerated.
65. **What relocation must never touch**, asserted by tests, not by intention: nothing under
    `VALIJA_STATE_HOME` is moved, copied or created inside the destination (D-I(4)); the
    preferences file is device state and never lands inside the vault folder or the destination
    (D-I(5), §8.4); the keychain entry is keyed by vault id, which does not change, so no entry is
    created, duplicated or orphaned — the only keychain effect is the deliberate lock (§8.12).
66. **`desktop/src/renderer/screens/relocate-vault.tsx`** — the wizard, §4.7 steps 28–36:
    the plain-words explainer (*valija does not talk to Dropbox, iCloud, OneDrive or anything else…
    this moves it there, remembers where it went, and updates the AI tools you've connected so they
    keep finding it*) · the native folder picker (path originates in **main**, §8.6) · the
    sync-folder recognition shown as **informational, never a gate** · the pre-flight refusals
    rendered **before anything is written**, each from a typed code in the active language, **plus
    the list of which connected clients will be re-pointed and a warning, before anything is
    written, for any client whose config could not be read or parsed** (§4.7 step 30, D-R(a)) · the
    *"Valija will lock your vault before moving it. You'll enter your passphrase again afterwards."*
    confirmation · the move · the result, **including a per-client re-point outcome — "Claude
    Desktop, Cursor and Claude Code now point at the new folder. Restart them to pick it up," with
    any client that could not be rewritten named individually alongside the manual snippet and a
    Try again action** (§4.7 step 34') · the **`export VALIJA_HOME="…"` line with a copy button**,
    because the CLI does not read the app's preferences and this wizard does not re-point it
    (§4.7 step 35) · the re-unlock.
67. **`desktop/src/main/ipc/handlers/relocation-handlers.ts`** — the orchestration the use-case rule
    "no use case calls another" keeps out of `src/`, in the fixed order D-R(a)'s consequences bind
    (`refined.md` §4.7 steps 30–34'): `lockVault.execute()` → `relocateVault.execute()` → **only on
    success** `preferences.write({ ...prefs, vaultPath: newRoot })` → **rebuild the container** with
    the new root → **re-point every currently-connected client** (67a) → the window re-renders
    locked. On any failure **before** the move succeeds, the preferences are untouched and no client
    config is read or written — client re-pointing is strictly the last step, never interleaved with
    the move.
67a. **Client re-pointing is a loop over `CLIENTS`, calling the same shared writer connect uses**
    (`installIntoClient` with Slice 4 step 29a's `vaultPath`, through `installer.ts`'s existing
    backup-and-merge discipline) — **not** a second config-writing implementation. Each client's
    result (rewritten / not connected / config unreadable) is collected and returned individually to
    the renderer, never summarized into one pass/fail. **The binding rule, stated once so no future
    edit "simplifies" it away:** a client re-pointing failure is reported and is **never** a reason
    to roll the vault move back or to touch the vault again — the vault has already moved
    successfully and rolling it backwards to fix a third-party config file is strictly more
    dangerous than a stale entry (D-R(a) rider 4). A client that fails is left exactly as it was,
    named in the result, with the manual snippet and a **Try again** action that re-runs only the
    writer for that one client.
68. **The mirror flow** (§4.7's last line, reachable from `no-vault.tsx`): a user who already has a
    vault somewhere unusual picks that folder and the app **records the location without moving
    anything** — the pre-flight for this variant only checks that the chosen folder actually
    contains a readable `vault.json`.
69. **Tests — the heart of this slice**, against a temp filesystem plus a fake `VaultMover` that can
    be told to throw at each stage:
    - each refusal fires **before** any write, with nothing changed on disk;
    - a simulated failure at **copy**, at **verify**, and at **source removal** each leaves exactly
      one openable vault, removes partial destination files, and does not change the remembered
      location;
    - after a successful move the **old folder contains neither `vault.db` nor `vault.json`**, and
      the vault opens at the new location with the **same passphrase, same vault id and same
      lineage generation**;
    - a **cross-filesystem** destination works (simulated by a mover whose `copy` is exercised and
      whose `rename` is never called — asserted by the absence of `renameSync` in
      `file-vault-mover.ts`);
    - a destination that already contains a vault is refused, and **nothing at that destination is
      modified**;
    - the wizard refuses while a fork is unresolved;
    - the remembered location survives a relaunch, and `VALIJA_HOME` in the app's environment takes
      precedence over it;
    - **(new, 2026-08-20) a client-config-writer failure for one client never touches the vault**:
      given a mock writer that throws for `cursor` only, the vault has still moved, the source
      folder is still gone, `claude-desktop` and `claude-code` are still rewritten, and `cursor`'s
      result names the failure without retrying the move or discarding the destination;
    - **(new) client configs are read and written only after `relocateVault.execute()` returns
      `ok`** — a mock writer that would throw on *any* call is asserted never to be invoked when a
      pre-flight refusal or a simulated move failure occurs first;
    - **(new) the pre-flight lists exactly the clients currently in `mcpServers`**, and a client
      with an unreadable or non-JSON config is named in that list before the move starts, not
      discovered only afterward;
    - **(P-D5, reversed 2026-08-20) a DOM-level test** (`jsdom` + `@testing-library/react`) drives
      `relocate-vault.tsx` through a fake bridge across three runs — a pre-flight refusal (destination
      occupied), a full successful move, and a move that succeeds but where the fake client-config
      writer throws for exactly one client — asserting in the last case that the **Try again** button
      rendered for that client's row calls the writer again for that client alone, and that the other
      two clients' rows show their success state undisturbed.
70. **Specs, same commit:** `specs/vault.md` gains the relocation contract — the refusal codes, the
    ordering guarantee, and the rollback rule. `specs/delivery.md` gains `installIntoClient`'s
    `vaultPath` parameter (Slice 4 step 29a) and its call sites in both the connect flow and
    relocation.

**Done when:** all of step 69 is green, a real vault can be moved into a real synced folder and
opened there with the same passphrase, **and** a relocation against a real Claude Desktop / Cursor
/ Claude Code config leaves each already-connected client pointing at the new folder (or, for a
client the client-`env` spike found does not honour the block, produces the documented manual-
snippet fallback instead).

---

### Slice 9 — Connect your AI tools, and import chat history

**Goal:** the two remaining write paths, both wrapping code that already ships. D-P Option 5,
D-S Option 2, D-J(a) Option 1, **D-W (new 2026-08-20).**

71. **`connect-tools.tsx`** (§4.4) — one card per `CLIENTS` entry, each showing connected / not
    connected using **the same check `doctor` makes** (`mcpServers.valija` present in that client's
    config), **and, for a connected client, which vault folder its entry currently names** (D-R(a),
    read from the same config file). **Connect** calls `installIntoClient` with the app's **current**
    vault path (Slice 4 step 29a) — backup, then merge — and reports the config path, the backup
    path, and *"Restart <client> to pick it up."* **This is the first place `installIntoClient` is
    ever called with a `vaultPath`, always, not only when the vault is somewhere unusual** (D-R(a)
    rider 5) — so there is no class of client entry relocation later has to *add* the key to rather
    than update. Failures (client not installed, config not valid JSON) render in plain language
    from the failure `installer.ts` already surfaces, with `manualInstructions()`'s block offered as
    a fallback and a copy button. **That block stays English** — it is a JSON snippet and paths
    meant to be pasted (D-V(d)). A test proves a connect action **never opens `vault.db`, never
    touches the keychain**, and leaves lock state and lineage untouched.
71a. **The Node/npm check** (D-W, new 2026-08-20) — before offering to connect, a **real executable
    probe**, not `process.versions.node` (which inside Electron is the bundled runtime, not the
    system Node `npx` would use — `refined.md` §3 fact 6's specific trap): spawn `node --version`
    and `npm --version` on `PATH` and check both resolve. `desktop/src/main/infra/node-probe.ts`,
    behind a small port so it is fakeable in tests. If either is missing, the screen states plainly
    that connected tools run valija through Node.js, that it is not installed, that connecting will
    still write the setting but the tool will not reach the vault until Node is installed, with a
    docs link — **and still allows Connect**, because the user may install Node minutes later
    (§4.4 step 16', explicit non-block). This is a **warning only**: no CLI surface changes, no
    Node runtime is bundled, and no MCP server is hosted by the app (both named as future work,
    not designed here, per D-W's non-goals). A test asserts the probe is a genuine child-process
    spawn (not a `process.versions` read) and that a missing Node does not disable the Connect
    button.
72. **`import.tsx`** (§4.5) — the explainer (this reads a file *you* downloaded; valija never
    contacts either service) · the native open dialog filtered to `.json`/`.zip` · format
    auto-detection with the format override appearing **only** when detection fails, mirroring
    `UNSUPPORTED_SOURCE`'s own advice · the conversation list (index, date, title, estimated
    chunks — the rows `--list` prints), **sortable by date** (which is what covers `--since`) ·
    checkboxes (which *are* `--pick`) and a filter box (which *is* `--query`) · a **required**
    target project, existing or new · **Preview** (the dry-run) · **Import**.
73. **Non-negotiables from D-S, each a test:** a target project is required before any write · a
    dry-run preview is reachable before the real import · per-conversation failures are **listed,
    never summarized away**.
74. **One vault write, one lineage bump.** The handler calls `ImportConversations` once; it must not
    be chunked per conversation for a nicer progress bar (§5.1). The test reads the generation
    before and after and asserts a delta of exactly 1 for N conversations.
75. **D-J(a)'s bounded retry** lives here and nowhere else: on `SQLITE_BUSY` from a contended write
    (a GUI import racing an MCP `save_context`), retry a small fixed number of times with a short
    backoff, then surface **localized copy keyed off the error code** — never a raw SQLite string.
    The retry count and backoff are constants in `import-handlers.ts`, not inherited defaults.
76. **The result screen** states in plain language that imported items are searchable and visible in
    the project but **do not appear in context packs** (`SPEC.md` §10a) — without this sentence, a
    user who imports 312 items, opens **Context pack** and sees no change concludes the import
    failed. A test asserts the project's pack is byte-unchanged by the import.
77. **Tests:** re-importing the same file does not duplicate items (deterministic ids) · the
    `FileExportReader` caps (128 MiB per entry / 256 MiB total) still apply and **no temp file is
    written** (the reader inflates in memory) · a large import leaves the window responsive (the
    read+parse+write runs in main; the renderer shows progress state) · **no parser, chunker,
    selection rule, archive reader or repository write is re-implemented in `desktop/`** — a grep
    test asserts the desktop tree imports `ImportConversations` and nothing from
    `src/importers/infra/parsers/`.

**Done when:** an export file can be listed, previewed and imported from the window, with one
lineage bump; a connect action wires Claude Desktop without touching the vault and always writes
the current vault path into its entry; and a machine with no runnable Node/npm sees the warning
without losing the ability to connect.

---

### Slice 10 — Diagnostics (D-T's split), and the Copy report

**Goal:** `doctor`'s checks, presented for D-N's audience, with the checks themselves coming from
the existing logic rather than being re-derived. D-T Option 3.

78. **`src/delivery/diagnostics.ts` (new)** — the check *computation* lifted out of
    `src/delivery/cli/doctor.ts`: `runDiagnostics(c): Promise<DiagnosticCheck[]>`, where
    `DiagnosticCheck = { name, ok, detail, fatal? }` — the same shape, the same `name` values
    (`node`, `sqlcipher`, `keychain`, `vault`, `journal`, `sync`, `lineage`, `auto-lock`, and one
    per client), the same order. `doctorCommand` shrinks to a loop that prints them and exits 1 on
    a fatal failure — **its output is byte-identical**, which the existing tests must show.
79. **`diagnostics.tsx`** (§4.6 step 26) — one row per check, each with a **plain-language
    explanation** keyed off `check.name`, so no CLI jargon (`sqlcipher`, `journal`, `lineage`)
    reaches user-facing copy. Fatal failures are visually distinguished from warnings the way the
    CLI's exit code distinguishes them.
80. **The keychain-probe disclosure** (step 26') — **before** running, the screen states that the
    keychain check **writes and immediately deletes a probe entry**, and that on macOS this may
    raise a keychain prompt (with the exact behaviour Slice 1's spike recorded). Diagnostics
    **never runs automatically, silently, or on a timer** — a test asserts the handler is only
    reachable from an explicit user action.
81. **Copy report** (step 26'') — built in the **main** process, **English in both UI languages**,
    and the one place a raw `DomainError.message` may appear. It carries the check rows, the app and
    Electron versions, the OS, the vault path, the schema version and the generation. It carries
    **no** vault content, no project names, no item text, no key material — a test asserts the
    payload contains none of the golden vault's item strings.
82. **Second entry points, not second implementations** — the Sync panel (Slice 7) and Settings
    (Slice 11) both navigate here; there is exactly one diagnostics screen.
83. **Specs, same commit:** `specs/delivery.md` gains the extracted diagnostics module.

**Done when:** the diagnostics screen shows the same verdicts `valija doctor` prints for the same
machine, the CLI's stdout is unchanged, and the report copies as English.

---

### Slice 11 — The welcome tour and the Settings screen

**Goal:** the two surfaces with no CLI counterpart, built on Slice 3's policies, writing one
boolean and nothing else. D-U(a) Option 2 · D-U(b) Option 1 · D-U(c) with its guardrails ·
D-U(d) Option 1.

84. **`onboarding.tsx`** (§4.2 step 7') — four slides, position dots, **Back** / **Next**,
    **Get started** on the last, and **Skip on every slide**. Rendered from
    `policies/onboarding-tour.ts`'s slide list, so the sequence and the skip semantics are already
    unit-tested headlessly. It **opens no vault session, reads no vault content, makes no network
    request, does not touch the idle-lock clock, and writes nothing but its own boolean**.
85. **The copy guardrails are binding, and they are reviewed as content, not as decoration**
    (D-U(c), §8.17):
    - **Slide 1** — free copy: what the vault is for, and the tools it works with.
    - **Slide 2** — *save once, use everywhere*, and **where saving actually happens**: from inside
      an AI tool you connect, **not from this window**. It points at **Connect an AI tool** and
      **Import your chat history** — the same two next steps the empty dashboard offers. It must
      not show or imply a save button in this app.
    - **Slide 3** — browse, search, take a pack. **No** "organize", "pin", "edit", "clean up",
      "tag" or "delete", in either language. *"Organiza tu contexto"* is exactly the phrase to
      refuse.
    - **Slide 4** — encrypted at rest, nothing leaves this machine, **there is no password reset and
      the recovery kit is the only other way in**. No "military-grade", no "unhackable", no
      absence-of-servers phrased as marketing. A tour that leaves a user *more* relaxed about losing
      their passphrase has damaged §8.2's ritual.
86. **The ordering invariant** — the tour plays the first time this installation reaches the
    dashboard, on **both** branches of §4.2 step 3, and **never before the recovery-kit
    acknowledgement**. Slice 6's `session-state.ts` invariant is what enforces it; this slice adds
    the test that drives it from the persisted flag rather than by observation.
87. **`settings.tsx`** (§4.8) — exactly four sections and no fifth: **Appearance** (D-Q's override)
    · **Language** (*Follow system* / *English* / *Español*, applied **live, no restart, no
    re-unlock**) · **Vault & sync** (links to the **existing** diagnostics screen and the
    **existing** relocation wizard, plus the environment-resolved values shown **read-only**) ·
    **Help** (**Show the welcome tour again**, replayable forever, changing no state).
88. **What Settings is not**, asserted by tests: it is reachable **while the vault is locked** and
    opening it **opens no session and touches no vault file**; it exposes **no editable field** for
    `VALIJA_HOME`, `VALIJA_STATE_HOME`, `VALIJA_AUTOLOCK_MINUTES` or any other environment-resolved
    setting; it offers **no path to destroying, re-keying or re-initializing** a vault; it is not a
    path field (only the wizard's native picker chooses folders, §8.6).
89. **The gear reaches the locked screen too** — Slice 6's `locked.tsx` gains its entry point here,
    because the unlock screen is one of the screens that has to be readable in the user's language
    and theme.
90. **Tests:** tour shown automatically exactly once per installation, on both branches, driven by
    the flag · Skip sets the flag and returns the user where they were · replay changes nothing
    else · opening Settings and watching the tour do not extend the idle-lock clock (no session,
    no `recordActivity`) · switching language re-renders every visible string without a reload.

**Done when:** a first-run user sees the tour once, can skip it, can replay it from Settings, and
can switch the app to Spanish live from the locked screen.

---

### Slice 12 — Documentation, `docs/SPEC.md` corrections, packaging, and the final gates

**Goal:** the deliverables that make the advance reviewable and the artifacts installable, plus the
contract corrections D-O requires.

91. **`docs/gui.md` (new)** — for a non-technical reader (D-N), covering: install per OS **with the
    literal words the OS shows** (*"Valija can't be opened because Apple cannot check it for
    malicious software"* → right-click → Open → Open, or `xattr -d com.apple.quarantine …`;
    SmartScreen's *"Windows protected your PC"* → More info → Run anyway; the Linux `chmod +x`
    step), the published SHA-256 for each artifact, and the **run-from-source path, verified rather
    than assumed** · first run and the recovery-kit ritual · the welcome tour and how to replay it ·
    **Settings, and what it deliberately does not configure, and that it has no CLI counterpart and
    why** · the language behaviour, the three strings that stay English and why, and the
    **English-only `docs/` gap** stated openly (D-V(c)) · import, connect, diagnostics · the
    relocation wizard and its **`VALIJA_HOME` consequence for terminal users** · the macOS keychain
    behaviour Slice 1 recorded · every clipboard affordance named individually (§8.7) · and **what
    the GUI deliberately does not do** (curation, fork resolution, vault destruction, running an MCP
    server, provider artifacts, configuring environment-resolved behaviour, a third language) and
    where each of those lives.
92. **The environment gap, stated honestly** (this plan's §5 A6): an app launched from a dock or
    start-menu icon inherits no shell environment, so `VALIJA_HOME` set in a shell profile is
    invisible to it (the wizard's remembered location is the answer), and so are
    `VALIJA_STATE_HOME` and `VALIJA_AUTOLOCK_MINUTES`. The consequence for anyone who overrode
    `VALIJA_STATE_HOME` — the GUI would use the default state directory and therefore a different
    device identity — is written down, with the Sync panel's device/state display as the way to
    see it.
93. **`docs/SPEC.md` corrections** (D-O, §9):
    - **§1** — "One npm package. One binary surface: `valija`." gains a sentence acknowledging the
      desktop companion app.
    - **§2 Out** — the fused *"GUI, encrypted backup / restore → later"* line splits: encrypted
      backup/restore stays "later"; the GUI becomes shipped, pointing at `advances/GUI/`. **No
      milestone number.**
    - **§10a** — *"No new MCP tool or argument — import is CLI-only."* becomes *"No new MCP tool or
      argument — **import has no MCP surface**; it is available from the CLI and the desktop app."*
    - **D11** — gains the sentence D-O's fifth candidate asks for: the desktop app additionally
      remembers a vault location in its own preferences file, **`VALIJA_HOME` always takes
      precedence**, and that file holds **UI preferences and a location hint only — it is not
      configuration**.
94. **`specs/desktop.md` (new)** and a row in `specs/README.md`'s table — the desktop app's
    observable behaviour: the enumerated IPC surface, the four-key preferences store, the language
    resolution rules, the tour's play/skip semantics, and the relocation wizard's refusals. This is
    the repo's own spec-driven rule applied to the one tree that would otherwise have no spec.
95. **Packaging and release** — unsigned artifacts for macOS (dmg, arm64 + x64), Windows (nsis,
    x64) and Linux (AppImage, x86_64), each with a published SHA-256, built by `desktop.yml` on
    tag. `electron-builder.yml` sets `asarUnpack` for the three native modules and **no
    `publish`/auto-update configuration of any kind**.
96. **Screenshots** for `docs/gui.md`, in **both languages**, from
    `src/testing/__fixtures__/golden-vault/` only — never a real vault, never a real key, never a
    real recovery kit (§8.16), and labelled as published test data.
97. **`CHANGELOG.md`** — one `[Unreleased]` entry: the desktop app, the relocation capability, the
    schema-upgrade consent gate, and the corrected contract lines.
98. **Final gate checks, pasted into the PR description:**
    - `git diff main...HEAD --name-only` — `src/` changes confined to the files Slices 4 and 8 name;
    - `git diff main...HEAD -- src/delivery/mcp/` — **empty** (the MCP surface, byte-for-byte);
    - `git diff main...HEAD -- package.json` — **empty** (no workspaces field, no new script,
      `files` unchanged, so the published tarball is unchanged);
    - `.github/workflows/ci.yml` — **unchanged**;
    - root `npm run typecheck && npm run lint && npm run test && npm run build` — green, test count
      up;
    - the desktop suite — green on all three OSes;
    - **zero network requests verified against the built artifact**, not only the source: run the
      packaged app through a full walkthrough with the machine's network monitored, and record the
      result in `spike.md`.

**Done when:** the artifacts exist with checksums, the docs are complete in English, the three
`SPEC.md` corrections are in, and every final gate check is pasted.

---

## 3. Security-sensitive order of operations

Not advice — the sequence the code must execute, readable top to bottom in the files named.

**A. Application bootstrap (`desktop/src/main/index.ts`)**

1. `app.setName("Valija")` — **before** any `app.getPath("userData")` call, or the preferences file
   lands in a differently-named directory on every OS.
2. `app.requestSingleInstanceLock()` — a second instance quits immediately. Two windows racing on
   the preferences file, or two relocations at once, is a class of bug that costs nothing to
   delete.
3. Read preferences (`FileAppPreferencesStore.read()`), tolerating a corrupt file.
4. Resolve the vault root: `env.VALIJA_HOME ?? preferences.vaultPath ?? undefined`. **The
   environment always wins.**
5. `buildContainer({ vaultRoot })` — **the key is derived and the container composed before any
   window exists.** No renderer is alive while the vault is being located.
6. Register the enumerated IPC handlers.
7. **Then** create the `BrowserWindow`, with `sandbox`/`contextIsolation`/CSP/navigation-denial set
   at construction. Never `loadURL` a remote origin; never enable `nodeIntegration` "temporarily".
8. `crashReporter.start()` is never called. `devTools` is off in packaged builds.

**B. Vault initialization (§8.2, and the one unrecoverable failure in the product)**

9. Passphrase and confirmation are compared **in the renderer**; a mismatch never reaches IPC.
10. `CreateVault` runs in main: header written → db initialized → **key placed in the OS keychain**
    → idle clock started. `parsePassphrase`'s rules are enforced by the use case, not re-implemented.
11. `renderRecoveryKit(...)` is rendered **in main** and handed to the renderer **exactly once**,
    behind a nonce the handler consumes on first read. A second request fails. There is no code
    path that writes it to a file.
12. Nothing — **including the welcome tour** — may be shown between the kit and its acknowledgement
    (§8.17). The state machine, not the router, enforces this.
13. On acknowledgement the renderer clears its copy and main drops its reference. The raw key hex
    never enters the preferences file, a log line, `localStorage`, `IndexedDB`, `sessionStorage`, or
    any file the app writes.

**C. Unlock, and the schema gate**

14. The passphrase (or typed recovery key) crosses renderer → main **once**, is passed straight to
    `UnlockVault`, and is not retained afterwards. It is masked in the field, never echoed, never
    logged.
15. `UnlockVault` derives the key, then — **before `readLineage`, which migrates** — checks
    `readSchemaVersion`. Behind-schema without confirmation ⇒ `VAULT_UPGRADE_REQUIRED`, **nothing
    migrated, vault still locked**.
16. Only after the user confirms the migration screen does unlock run again with
    `upgradeConfirmed: true`, taking the same `migrate()` path every CLI command takes.
17. The session key never travels main → renderer. Ever. The only two secrets that cross toward the
    renderer are the recovery kit at init (once, by definition) and nothing else.

**D. Relocation (§8.12 — the ordering *is* the safety property)**

18. Pre-flight refusals first, **before anything is written**, from `refuseUnsafeRelocation`.
19. Lock: `LockVault` drops the key from the keychain (D-R(d) Option 1). The wizard states the
    re-unlock consequence **before** starting, so it reads as part of the ritual.
20. Verify at rest: no `-wal`/`-shm`/`-journal` sidecar. `RelocateVault` refuses independently if
    the keychain still holds the key, so the guarantee does not depend on the caller's ordering.
21. **Copy** both files to the destination.
22. **Verify** the destination: both files present, byte-for-byte identical by SHA-256, and
    `vault.json` parses as a valid header.
23. **Only then** remove the source.
24. Any failure: discard partial destination files, leave the source whole and openable, **do not
    change the remembered location**. If source removal fails after a verified copy, roll the
    destination back (step 64). There is no outcome in which the vault is split across two folders
    such that neither opens.
25. Nothing under `VALIJA_STATE_HOME` and no preferences file is moved, copied, or created inside
    the destination. The keychain entry is keyed by vault id, which relocation does not change.
26. Preferences are updated **after** the use case returns `ok`, then the container is rebuilt.

**E. Standing rules**

27. **Filesystem paths never originate in the renderer.** Import, export and relocation each open
    their dialog in main and keep the result there (§8.6).
28. **No network, by construction:** CSP forbids remote origins, `will-navigate` and
    `setWindowOpenHandler` deny non-local targets, translation catalogs are files inside the bundle,
    fonts are the system stack (no remote face, no embedded downloader), there is no update feed and
    no analytics. *"It's only a language file"* is exactly the shape the first exception takes.
29. **No plaintext at rest anywhere new:** no item cache, no pack cache, no search history, no
    recently-viewed list, no window-state file holding item text, no import staging file. After the
    app quits, the only new file on disk is the preferences file, with its four permitted keys.
30. **Idle auto-lock may only get tighter.** No timer, no keep-alive, no "stay unlocked while the
    window is open". Watching the tour and opening Settings open no session and therefore do not
    touch the idle clock.
31. **What may be logged:** never a passphrase, never a key in any encoding, never item content,
    never a pack, never a recovery kit. In development, the desktop logs channel names and error
    codes — never payloads.

---

## 4. Test plan → acceptance criteria

**Layers, cheapest first.** The point of the split is that almost everything is provable without a
window; only packaging and the macOS ACL question are not.

| Layer | Where it runs | What it proves |
|---|---|---|
| **`src/` unit + integration** | root `npm test` (vitest, existing suite) | The relocation use case and its refusals, the schema-upgrade gate, the pack-export helper, the extracted diagnostics module, the explicit busy timeout — all with fakes and temp directories, no Electron. |
| **Desktop headless** | `desktop/` vitest, node environment | Policies (preferences, system-or-override, language, theme, tour, vault location), i18n (catalogs, plurals, formats, error copy), IPC (channel-set equality, schema rejection, no path-shaped argument), renderer state machines, the "no session outlives an action" and "no sidecar" assertions. **No window, no DOM.** |
| **Desktop DOM-level** (P-D5, reversed 2026-08-20) | `desktop/` vitest, `jsdom` environment, `@testing-library/react` | **Exactly two screens, by name:** `recovery-kit.tsx` (kit renders verbatim, only Copy key + the checkbox are reachable pre-acknowledgement) and `relocate-vault.tsx` (pre-flight refusal, full success, and per-client re-point failure with an isolated Try again). Not a blanket policy — every other screen stays headless-only. |
| **Cross-surface conformance** | root `npm test` | Byte-identity of the pack the GUI displays against `valija export` and against the golden fixture, in both languages; CLI-write-then-GUI-import is a fast-forward, not a fork; `doctor`'s stdout unchanged after the extraction. |
| **Packaged-artifact checks** | `desktop.yml`, and by hand | Native modules load in the packaged app (not only in dev); zero network requests during a full walkthrough of the built artifact; artifact SHA-256s. |
| **Human gate** | Oscar, one macOS desktop session | D-H's ACL answer for both the CLI-created entry and the `doctor-probe` entry, on a named macOS version. |

### `refined.md` §9 criteria, mapped

| Criterion (§9) | Proven by |
|---|---|
| MCP surface byte-for-byte unchanged; no embedded MCP server | Slice 12 step 98 (`git diff -- src/delivery/mcp/` empty) + a grep test asserting `desktop/` never imports `mcp/server.js` |
| No schema/migration/format/`vault.json`/KDF/key/SQLCipher change | Slices 4 and 8 touch no migration and no crypto; the final diff review |
| No change to `argon2` / `@napi-rs/keyring` / `better-sqlite3-multiple-ciphers` | Slice 1 step 3 (the version-parity test) + the final diff on both `package.json`s |
| Every CLI command behaves as before; root checks pass; CI not slowed or gated | Slice 4 steps 33–34, Slice 10 step 78 (byte-identical `doctor` output), Slice 1 step 10 (separate workflow), Slice 12 step 98 |
| Published npm package unchanged | Slice 12 step 98 (`git diff -- package.json` empty; `files` is an allow-list) |
| `SPEC.md` §1, §2, §10a corrected; D11 gains the preferences sentence; no milestone number | Slice 12 step 93 |
| Every CLI command has its mapped GUI surface; `mcp` the only absence, stated in docs | Slices 6–10, plus `docs/gui.md` (Slice 12 step 91) |
| Both parity gaps implemented or explicitly declined | Slice 7 step 55 (`--json` in the save dialog) and Slice 6 step 47 (recovery-key unlock) — both implemented per D-P's defaults |
| Nothing beyond the map, with Settings and the tour as the two stated exceptions | Slice 5 step 38 (channel-set equality) + Slice 11 step 88 |
| No `SaveContext`, no repository mutation outside `ImportItems`, no curation affordance | Grep test over `desktop/**` for `saveContext`, `pin`, `archive`, `delete`, `rename`, `retag` + Slice 9 step 77 |
| Pack byte-identical to `valija export`, in both languages | Slice 7 step 57 |
| Project list / item list / `--type` filter / search produced by the same use cases | Slice 7 step 58, against the golden fixture |
| Sessions per action; no `Database` outlives an action | Slice 5 step 42 |
| No timer refresh; idle auto-lock not extended | Slice 5 step 43 (grep) + Slice 11 step 90 |
| After any GUI session: `vault.json` + `vault.db` only, and no preferences file in the vault folder | Slice 5 step 42 + Slice 8 step 65 |
| Behind-schema behaviour matches D-J(b) and is documented | Slice 4 step 33, Slice 6 step 49, Slice 12 step 91 |
| Init through `CreateVault`; `parsePassphrase` not re-implemented; mismatch caught first | Slice 6 steps 45, 51 |
| Kit is `renderRecoveryKit`'s exact output, once, never written, not re-openable, acknowledgement-gated | Slice 6 steps 46, 51 (the nonce test) |
| Nothing between the user and the acknowledgement — the tour never precedes it | Slice 6 step 50 + Slice 11 step 86 |
| Raw key hex in no log, no persisted renderer state, no preferences file, no written file | Slice 6 step 51 (the post-init disk scan) |
| After GUI init, `valija status` reports the same vault; one vault, one keychain entry, one identity | Slice 6 "Done when" (a manual + scripted check against a temp `VALIJA_HOME`) |
| Copy-key warns about the clipboard, in the active UI language | Slice 6 step 46 + the catalog key-set test |
| Nothing can destroy or re-initialize a vault; `VAULT_ALREADY_EXISTS` in plain language from the code | Slice 6 step 51 + Slice 11 step 88 |
| Terminal unlock leaves the GUI unlocked and vice versa; one shared keychain entry | Slice 1 step 8 (the spike round-trip) + Slice 6's "Done when" |
| macOS ACL behaviour recorded for both interactions, with the exact version, in the docs | Slice 1 steps 11–12 + Slice 12 step 91 |
| Auto-lock identical to the CLI; not extended by Settings or the tour | Slice 11 step 90 |
| `VALIJA_STATE_HOME` resolved as the CLI does; no second device id; CLI write + GUI import is a fast-forward | A cross-surface test in the root suite modelled on `src/delivery/multi-device-sync.test.ts` |
| Fork notice shown on unlock, plain language, no merge/keep/delete affordance | Slice 6 step 48 |
| Import calls `ImportConversations` → `ImportItems` unchanged; nothing re-implemented | Slice 9 step 77 (the import-graph grep) |
| Target project required; dry-run reachable | Slice 9 step 73 |
| N conversations ⇒ exactly one generation bump | Slice 9 step 74 |
| Re-import does not duplicate; per-conversation failures displayed | Slice 9 steps 73, 77 |
| Result screen states packs exclude imported items; pack unchanged by the import | Slice 9 step 76 |
| Archive caps still apply; no import temp file | Slice 9 step 77 |
| A large import does not freeze the window | Slice 9 step 77 |
| Connect uses `installer.ts` unchanged; no new config-writing logic | Slice 9 step 71 |
| Connect never opens `vault.db`, never touches the keychain, changes no lock state or lineage | Slice 9 step 71 (the assertion test) |
| Every `installer.ts` failure mode in plain language, with manual instructions offered | Slice 9 step 71 |
| Diagnostics runs `doctor.ts`'s checks, re-deriving none; fatal vs warning distinguished | Slice 10 steps 78–79 |
| Probe disclosed before running; never automatic, silent, or on a timer | Slice 10 step 80 |
| Sync panel shows only the named fields, all read-only | Slice 7 step 56 |
| Sync panel performs no write of any kind | Slice 7 step 58 |
| Copy report is English in both languages and the only place a raw message may appear | Slice 10 step 81 |
| Wizard refuses, before writing, on each of the six conditions, in the active language, from a code | Slice 8 steps 60, 69 |
| Nothing deleted at the source until the destination is verified | Slice 8 steps 63, 69 |
| Simulated failure at each stage: one openable vault, partials cleaned, location unchanged | Slice 8 step 69 |
| After success: old folder empty of both files; same passphrase, vault id and generation at the new location | Slice 8 step 69 |
| A cross-filesystem destination works | Slice 8 steps 62, 69 |
| Verifiably at rest before the move; re-unlock stated up front | Slice 8 steps 60, 63, 66 |
| Nothing under `VALIJA_STATE_HOME`, no preferences file, moved or created in the destination | Slice 8 step 65 |
| New location survives relaunch; `VALIJA_HOME` takes precedence | Slice 3 step 28 + Slice 8 step 69 |
| The `VALIJA_HOME` line with a copy action, and the docs explaining the CLI does not read preferences | Slice 8 step 66 + Slice 12 step 91 |
| **(new, 2026-08-20)** Every already-connected client's MCP config is re-pointed after a successful move, through the same writer `connect` uses, never before the move succeeds | Slice 4 step 29a + Slice 8 steps 67, 67a, 69 |
| **(new)** A client re-pointing failure is reported per client, never rolls the vault back, and offers a manual snippet + Try again | Slice 8 steps 66, 67a, 69 |
| **(new)** Whether each `CLIENTS` entry honours a per-server `env` block is verified and recorded per client, with the exact macOS-spike-style honesty standard | Slice 1 step 11a |
| **(new)** The app detects whether Node/npm are runnable (a real probe, not `process.versions`) and warns without blocking Connect | Slice 9 step 71a |
| Preferences file has exactly four keys and nothing else | Slice 3 steps 22, 28 |
| Tour shown automatically exactly once per installation, on both branches, driven by the flag | Slice 11 step 90 |
| Skip on every slide, sets the flag, returns the user where they were; dots/Back/Next/Get started | Slice 11 steps 84, 90 |
| Tour opens no session, reads nothing, no network, no idle-clock effect, writes one boolean | Slice 11 steps 84, 90 |
| Tour never precedes the acknowledgement; no slide claims a capability not shipped | Slice 11 steps 85, 86 |
| Replay works any number of times and changes no other state | Slice 11 step 90 |
| Settings reachable while locked; opens no session; touches no vault file | Slice 11 steps 87–89 |
| Exactly four sections; Vault & sync navigates to existing screens; no editable env field | Slice 11 steps 87–88 |
| No path to destroying, re-keying or re-initializing | Slice 11 step 88 |
| Docs state Settings has no CLI counterpart and why | Slice 12 step 91 |
| App opens in the OS language when en/es, English otherwise; override persists | Slice 3 step 28 |
| Language applies live, no restart, no re-unlock | Slice 11 step 90 |
| Identical key sets; no hardcoded string; no concatenated sentence; plural-aware counts | Slice 2 step 20 + a lint-style test asserting no `.tsx` under `screens/` contains a bare quoted sentence |
| A Spanish walkthrough shows no English UI string but the three documented exceptions | Slice 12's bilingual screenshot pass + the key-set test |
| Errors rendered from `code`, never `message`; every reachable code has copy or a code-naming fallback | Slice 2 steps 19–20 (the source-scanning coverage test) |
| **No `src/` file modified for localization**; no `locale` parameter anywhere; CLI output unchanged | Slice 12 step 98's diff review — the `src/` changes in Slices 4 and 8 are relocation, the upgrade gate and composition extraction, and none of them mentions a locale |
| Catalogs load from the bundle; zero network holds in both languages, verified against the artifact | Slice 12 step 98 |
| Dates, numbers and durations formatted for the active language | Slice 2 step 20 |
| The four §8.17 surfaces reviewed in Spanish as security copy; `docs/` recorded as English | Slice 2 step 16 (content rule), Slice 12 steps 91–92 |
| Renderer hardening flags; preload exposes a fixed enumerated API validating at the boundary | Slice 1 step 6 + Slice 5 steps 36–40 |
| No channel accepts SQL/module/shell/path; all three paths come from native dialogs | Slice 5 steps 38–39 |
| Zero network requests; CSP; navigation denied — verified against the built artifact | Slice 1 steps 6–7 + Slice 12 step 98 |
| After quitting, no new plaintext file/cache/index/crash dump; preferences the only new file | Slice 6 step 51 + Slice 12 step 98 |
| Screenshots and docs use only the golden fixture, in both languages | Slice 12 step 96 |
| The busy/retry behaviour explicit in code; a contended write produces the documented outcome | Slice 4 step 32 + Slice 9 step 75 |
| Unsigned artifacts for three OSes with SHA-256; native modules load in the packaged app | Slice 1 step 9 + Slice 12 step 95 |
| First-launch friction documented per OS in the OS's own words; run-from-source verified | Slice 12 step 91 |
| Docs state what the GUI deliberately does not do, and where those live | Slice 12 step 91 |

---

## 5. Assumptions — each one a place this plan could be wrong

- **A1 — `refined.md`'s 18 `Open — Gate R` items are governed by their written `Default:` lines.**
  §0 explains why this reading was chosen over the header's "nothing remains open". If Oscar
  intended some other outcome for any of them, §6 names the affected slices.
- **A2 — Vite resolves `./x.js` specifiers to `./x.ts`** when the main bundle follows relative
  imports into `../../src/**` (the repo is NodeNext with explicit `.js` extensions). If it does not,
  the fallback is a five-line resolver plugin in `electron.vite.config.ts`, or building the main
  process with `tsup` (already a devDependency) and letting electron-vite handle only the renderer.
  Verified in Slice 1, before anything depends on it.
- **A3 — `@napi-rs/keyring` and `argon2` are N-API and load under Electron without a rebuild, while
  `better-sqlite3-multiple-ciphers` needs `@electron/rebuild`.** This is the expectation, not a
  fact; Slice 1 measures it per OS. **No library is substituted** whatever the answer (§8.1) — a
  hard rebuild is a schedule finding, not a licence to swap crypto.
- **A4 — `better-sqlite3`'s `timeout` option default is 5000 ms.** Slice 4 step 32 pins the constant
  to whatever the installed version actually documents; the point is that the value becomes
  explicit, not that it changes.
- **A5 — a behind-schema vault can be constructed in a test** by the technique
  `src/shared/infra/migrations.test.ts` already uses. If it cannot, Slice 4's upgrade-gate tests
  need a small fixture builder instead, and the slice grows by ~40 lines.
- **A6 — an app launched from a dock or start-menu icon inherits no shell environment.** This is why
  D-R(a) exists, and it has two consequences the spec does not spell out: a user who overrode
  `VALIJA_AUTOLOCK_MINUTES` in a shell profile gets the 15-minute default in the GUI, and a user who
  overrode **`VALIJA_STATE_HOME`** gets the default state directory — hence a **different device
  identity**, hence potential false fork warnings. Neither can be fixed from inside the app without
  a fifth preferences key, which §8.4 forbids. Slice 12 documents both, and the Sync panel displays
  the resolved state path so the situation is visible rather than mysterious.
- **A7 — Oscar has access to a macOS desktop session** for Slice 1's human gate. If not, D-H's
  answer is recorded as *"CI signal only — silent on a headless runner; unverified in a desktop
  session"*, which is honest but weaker than §9 asks for, and the docs must say exactly that rather
  than imply the question was answered.
- **A8 — Biome 2.5 lints `.tsx` under the existing root config** without a new plugin. If some rule
  fights React idioms, the fix is a scoped `overrides` entry in `biome.json`, never a second config
  file.
- **A9 — the golden-vault fixture is usable from the desktop test suite** by importing
  `src/testing/golden-vault.ts` relatively. It is plain TypeScript with no Electron dependency, so
  this should hold.
- **A10 — `electron-builder` can produce all three artifact types from CI runners** without signing
  credentials (D-G: unsigned, deliberately). macOS x64 + arm64 from `macos-latest` may need two
  passes; if universal builds prove awkward, ship two macOS artifacts, which is what §4.1 step 0's
  filename already implies.
- **A11 — no `src/` behaviour defect surfaces.** If building the GUI proves a CLI behaviour wrong
  (rather than merely undocumented), this plan has no slice for it: record it as an escalation for
  the next Gate R rather than widening this advance.
- **A12 — `advances/GUI/plan.md` is the most recently modified `plan.md`**, so
  `guard-implementation.sh` resolves to it without `VALIJA_ADVANCE` being set. Exporting
  `VALIJA_ADVANCE=GUI` makes it deterministic and is recommended.

---

## 6. Decisions to confirm

**Both groups are now closed.** Oscar confirmed every Group A row and every disputed Group B item
individually, through an interactive prompt, on 2026-08-20. This section is kept — not deleted —
because it is the map from each decision to the slice it binds, exactly as useful post-approval as
it was at Gate P.

### Group A — `refined.md` §7's items, all confirmed 2026-08-20

Seventeen of eighteen landed exactly on the written default, unchanged. **A-2 did not** — Oscar's
own question surfaced a requirement the default's original analysis had missed, so what he
confirmed is the *rewritten* D-R(a), not the plan's first-cut description of it. That row is
marked below.

| # | Item | Confirmed (2026-08-20) | Binds |
|---|---|---|---|
| A-1 | **D-J(a)** busy/retry | **Confirmed**, Option 1 — explicit timeout + bounded retry for import; relocation guarded by D-R(d) instead | Slice 4 step 32, Slice 9 step 75 |
| A-2 | **D-R(a)** location memory | **Confirmed, rewritten.** Option 1 for where the app itself remembers (app-preferences file, `VALIJA_HOME` always wins) **plus a mandatory companion step Oscar's own question forced**: relocation must also rewrite the vault path into every already-connected client's MCP config `env` block, through the same writer `installIntoClient` already uses. See §0's second gap and `refined.md` D-R(a) for the full analysis. | Slice 1 step 11a (spike), Slice 3 (unchanged — location memory itself), Slice 4 step 29a (shared writer), Slice 8 steps 66–67a (the re-pointing itself), Slice 9 step 71 (connect always writes the path) |
| A-3 | **D-R(b)** how the move happens | **Confirmed**, Option 2 — copy, verify, then delete the source; a destination with a vault is **refused, never merged** | Slice 8 steps 61–64 |
| A-4 | **D-R(c)** where relocation lives | **Confirmed**, Option 1 — a `RelocateVault` use case in `src/vault/`, port + tech-named adapter | Slice 8 |
| A-5 | **D-R(d)** move discipline | **Confirmed**, Option 1 — lock first, verify at rest, then move | Slice 8 steps 63, 67 |
| A-6 | **D-S** import selection surface | **Confirmed**, Option 2 — behavioural parity (checkbox = `--pick`, filter = `--query`, sortable dates = `--since`, format override only when detection fails) | Slice 9 step 72 |
| A-7 | **D-T** diagnostics presentation | **Confirmed**, Option 3 — split: plain-words Sync & safety panel, near-verbatim Diagnostics screen with Copy report | Slices 7 and 10 |
| A-8 | **D-U(a)** when the tour plays | **Confirmed**, Option 2 — first time this installation reaches the dashboard, **either** branch | Slice 11 step 86 |
| A-9 | **D-U(b)** where the seen-flag lives | **Confirmed**, Option 1 — the same preferences store, fourth key; **Skip sets it** | Slice 3 step 26 |
| A-10 | **D-U(c)** slide content | **Confirmed** — the mockup's four slides with the three guardrails binding; slide 2 rewritten to point at connecting a tool | Slice 11 step 85 |
| A-11 | **D-U(d)** Settings and the CLI | **Confirmed**, Option 1 — GUI-only chrome, **no CLI counterpart**, boundary stated in the docs | Slice 11 steps 87–88 |
| A-12 | **D-V(b)** catalog mechanism | **Confirmed**, Option 1 — static catalogs in the bundle, stable ids, English source and fallback, missing key fails the suite | Slice 2 |
| A-13 | **D-V(c)** Spanish completeness | **Confirmed**, Option 1 — **structural** completeness is an acceptance criterion, literary quality is not; neutral LatAm Spanish, "tú", no voseo; **`docs/` stays English** (option (a)) | Slice 2 step 16, Slice 12 step 91 |
| A-14 | **D-V(d)** never translated | **Confirmed** — recovery kit body, manual install instructions, context-pack markdown, and `DomainError.message`; option (a) — one localized sentence of explanation | Slice 6 step 46, Slice 7 step 55 |
| A-15 | **D-V(e)** dates/numbers/plurals | **Confirmed**, Option 1 — `Intl` against the **active UI language** | Slice 2 step 18 |
| A-16 | **D-V(g)** OS-language detection | **Confirmed**, Option 1 — primary-subtag match, one region-neutral `es` catalog | Slice 2 step 14 |
| A-17 | **D-P gap 1** `export --json` | **Confirmed**, default (b) — a format choice in the save dialog | Slice 7 step 55 |
| A-18 | **D-P gap 2** `unlock --recovery-key` | **Confirmed**, default (b) — a secondary "I only have my recovery key" path, masked, never persisted | Slice 6 step 47 |

### Group B — decisions this plan had to make, confirmed or overturned 2026-08-20

- **P-D1 — `desktop/` is a standalone package, not an npm workspace.**
  *Recommend:* its own `package.json` + `package-lock.json`, installed only by desktop work and by
  `desktop.yml`. *Why:* the root CI matrix is 3 OSes × 2 Node versions and §9 forbids slowing it;
  a workspace installs Electron on every one of those jobs. *Trade-off:* six dependency versions are
  declared in two files and could drift — mitigated by Slice 1 step 3's parity test, which fails the
  build the day they disagree. *Alternative:* a real workspace plus `npm ci --workspaces=false` in
  `ci.yml`, which edits CI and depends on npm flag semantics holding across versions.

- **P-D2 — the desktop imports `src/` by relative path, not by package entry point.**
  *Recommend:* `import { buildContainer } from "../../src/delivery/container.js"`. *Why:* the
  package publishes `bin` only and has no `exports` map (D-L Option 3's stated problem); adding one
  would change the published surface. *Trade-off:* the desktop bundle is coupled to `src/`'s
  internal layout — which is exactly D-F's rationale (the GUI *is* the CLI's code) and is protected
  by both suites running in the same repo.

- **P-D3 — the D-J(b) schema gate needs a change to `UnlockVault`.** *This is the one place the
  spec's design meets a code fact it did not have.* `UnlockVault` migrates today, via
  `readLineage()`. *Recommend:* `readSchemaVersion` on `VaultStore` + an `upgradeConfirmed` flag on
  `UnlockInput`, with the CLI passing `true` so its behaviour is byte-identical, and a separate
  `CheckVaultUpgrade` use case to describe the pending upgrade. *Cost:* one extra `openVaultDb`
  (milliseconds) on every unlock; three Argon2id derivations (~3s) once, only on the upgrade path.
  *Trade-off:* it modifies the product's most safety-critical use case for a GUI requirement.
  *Alternatives:* (a) the desktop derives the key itself and passes it as `recoveryKeyHex` — no
  `src/` change, but key derivation moves into a delivery adapter, which §5.1 forbids in spirit;
  (b) drop the confirmation and migrate silently (D-J(b) **Option 1**, which Oscar explicitly
  overrode) — cheapest, and re-litigates a recorded decision.

- **P-D4 — renderer framework: React 19 + `electron-vite`.** *Recommend:* React, because it is the
  least surprising choice for a reviewer and the mockups are componentised HTML. *Why it barely
  matters:* §5.1 requires the view state and every decision to live in **plain TypeScript** modules
  under `renderer/state/`, tested headlessly; components stay thin renderers of that state.
  *Trade-off:* ~130 KB of framework in a bundle that is already an Electron runtime.
  *Alternatives:* Preact (smaller, same API), or no framework at all (smallest, and hand-rolled
  DOM updates across 16 screens is its own maintenance cost).

- **P-D5 — DOM-level component tests, added for the two highest-risk screens (reversed,
  2026-08-20).** Originally recommended against: all logic in plain TS, tested headlessly, no
  jsdom, no testing-library, on the reasoning that §5.1's "testable without a window" already
  covers the logic and a DOM layer adds dependencies for what review already catches. **Oscar
  overturned this** — the recovery-kit and relocation-wizard screens are worth machine-checking,
  not only reviewing. *Decided:* add `jsdom` + `@testing-library/react` (+ `@testing-library/
  jest-dom`) as `desktop/` devDependencies, and add DOM-level tests for exactly
  **`recovery-kit.tsx`** and **`relocate-vault.tsx`** — the one screen holding the product's only
  unrecoverable secret and the one screen moving the product's only irreplaceable file. Every other
  screen stays covered by the headless state-machine tests §5.1 already requires; this is a
  targeted addition, not a blanket DOM-testing policy. Assertions worth naming: the recovery-kit
  test renders the exact `renderRecoveryKit` fixture output and asserts the **Copy key** and
  acknowledgement checkbox are the only interactive elements before acknowledgement, and that no
  "Next"/tour-adjacent control is reachable from that DOM tree (the `session-state.ts` invariant,
  now checked at the DOM level too); the relocation test drives the wizard through a pre-flight
  refusal, a successful move, and a simulated per-client re-pointing failure, asserting the
  **Try again** action targets only the failed client. **Binds:** Slice 1 step 2 (devDependencies),
  Slice 6 step 51, Slice 8 step 69 (each gains a DOM-level counterpart), and §8/§9 below.

- **P-D6 — fonts are the system UI stack; no font file is embedded.** *Recommend:* system stack.
  *Why:* §8.5 forbids remote fonts, and an embedded face adds a binary and a licence question for a
  cosmetic gain. *Trade-off:* the app looks slightly different per OS — arguably correct for a
  desktop app. *Alternative:* embed one open-licensed face (~200 KB per weight) and record the
  licence in a `THIRD-PARTY-NOTICES.md`.

- **P-D7 — `specs/desktop.md` is added, and `specs/README.md`'s table gains a row.** *Recommend:*
  yes. *Why:* `specs/README.md` rule 1 says a change in behaviour updates the matching spec in the
  same commit, and the desktop tree would otherwise be the only behaviour in the repo with no spec.
  *Trade-off:* the table is titled "one spec per **module**, mirroring `src/`", and `desktop/` is
  not under `src/` — the row needs a one-line note saying so. *Alternative:* fold the desktop's
  behaviour into `specs/delivery.md`, which is already the CLI + MCP file and would roughly double.

- **P-D8 — the diagnostics extraction lives at `src/delivery/diagnostics.ts`.** *Recommend:* the
  delivery root, beside `container.ts` and `context-pack-markdown.ts`, which are the two existing
  files shared by more than one entry point. *Trade-off:* it is a third bare file at
  `src/delivery/`; `CLAUDE.md` allows this because `delivery/` is a composition root rather than a
  layered module, and `SPEC.md` §10's tree shows exactly that shape. *Alternative:*
  `src/delivery/diagnostics/checks.ts`, which is tidier but implies a subsystem that is one file
  long.

- **P-D9 — the `VaultMover` port takes vault-level operations, not raw file primitives.**
  *Recommend:* `inspect / copy / matches / discard / remove`, so the safety **ordering** is
  readable top-to-bottom in `relocate-vault.use-case.ts` while the I/O is fakeable per stage.
  *Trade-off:* `matches` hides the digest rule inside infra. *Alternative:* raw primitives
  (`copyFile`, `digest`, `remove`), which put the digest comparison in the use case at the cost of
  a longer, noisier method.

- **P-D10 — REJECTED, 2026-08-20. There is no de-scope lever.** Originally proposed as an escape
  hatch: if D-R's sub-decisions looked shaky during Slice 8, ship the sync-status half alone
  (Slice 7 step 56) and defer the wizard to its own advance. **Oscar rejected it outright** —
  "todo junto, sin retirada" (all of it together, no retreat) — when asked directly whether to ship
  the full 12-slice plan or keep this lever available. **This advance therefore commits to all 12
  slices, including the relocation wizard and its D-R(a) companion step, with no sanctioned partial
  ship.** R1 and R2 in §8 are not softened by this — the risk is real and stays real — but the
  response to it discovered mid-Slice-8 is *fix it*, not *cut it*. If Slice 8 turns out to be
  genuinely unshippable for a reason discovered during implementation, that is an escalation back to
  Oscar, not a decision this plan pre-authorizes the implementer to make alone.

---

## 7. Naming, placement, and ubiquitous language

**Checked against `CLAUDE.md`'s conventions and the code's own idiom (where the two differ, the
code wins — as `advances/MOBILE/plan.md` §7 established).**

| New thing | Name and place | Why it is consistent |
|---|---|---|
| Relocation use case | `RelocateVault` — `src/vault/application/use-cases/relocate-vault.use-case.ts` | Verb-phrase class implementing `UseCase`, exactly like `CreateVault` / `UnlockVault` / `LockVault`; file suffix `.use-case.ts` matches every sibling |
| Its port | `VaultMover` — `src/vault/application/ports/vault-mover.ts` | Technical ports live in `application/ports/` per `SPEC.md` §10; named for the capability, like `VaultStore` / `VaultFolder` |
| Its adapter | `FileVaultMover` — `src/vault/infra/file-vault-mover.ts` | Tech-named `File*` adapter, matching `FileVaultStore`, `FileVaultFolder`, `FileDeviceIdentity` |
| Its refusal rules | `refuseUnsafeRelocation` — `src/vault/domain/services/vault-relocation.ts` | Logic spanning several inputs with no I/O is a `domain/services/` function, like `classifyLineage` in `vault-lineage.ts` |
| Upgrade description | `CheckVaultUpgrade` — `src/vault/application/use-cases/check-vault-upgrade.use-case.ts` | Verb phrase; `VaultUpgradeOutput` mirrors `VaultStatusOutput`'s naming |
| Pack export composition | `exportProjectMarkdown` / `exportProjectJson` — `src/delivery/context-pack-export.ts` | Beside `context-pack-markdown.ts`; `delivery/` is a composition root, and these two are the existing shared-across-entry-points shape |
| Diagnostics computation | `runDiagnostics`, `DiagnosticCheck` — `src/delivery/diagnostics.ts` | Same rationale; `check.name` values are kept **unchanged** so the CLI's output stays byte-identical and the GUI has a stable key |
| Preferences | `AppPreferences` (data) + `AppPreferencesStore` (port) — `desktop/src/main/application/ports/app-preferences.ts`; `FileAppPreferencesStore` — `desktop/src/main/infra/file-app-preferences-store.ts` | One file exporting the data shape and the port mirrors `vault-folder.ts` (`VaultFolderInspection` + `VaultFolder`); the adapter is tech-named |
| File dialogs | `FilePicker` port + `ElectronFilePicker` adapter | `Electron*` is the same self-describing tech prefix as `Os*` in `OsKeychain` |
| The shared preference mechanism | `resolveSystemOrOverride` — `desktop/src/main/application/policies/system-or-override.ts` | `policies/` is an established kind in this repo (`session-guard.ts`); D-Q/D-V require one mechanism used twice, and a file named for the mechanism is what makes that visible |
| Language, theme, tour, location rules | `.../policies/language-resolution.ts`, `theme-resolution.ts`, `onboarding-tour.ts`, `vault-location.ts` | Each is a rule, not a port and not a `UseCase` — `policies/` is exactly the folder `CLAUDE.md` names for that case |
| Translation catalogs | `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | A **new kind of thing** getting its own kind-named folder, as `refined.md` §5.1 requires — never loose files beside the runtime |
| IPC contract | `desktop/src/shared/ipc/channels.ts`; schemas + handlers under `desktop/src/main/ipc/` with `handlers/` inside | A new kind (`ipc/`), with its own kind-named subfolder for the handlers |
| Screens | `desktop/src/renderer/screens/*.tsx` | A new kind, kind-named folder; components in `components/`, view state in `state/`, styles in `styles/` |

**File placement, checked against "no bare files at a layer's root."** Every new file inside a
`domain/`, `application/` or `infra/` layer sits in a kind-named subfolder (`values/`, `services/`,
`ports/`, `use-cases/`, `policies/`), or is a tech-named `infra/` adapter, which is the standing
exception. The files that sit at a folder root are all outside those layers and all have precedent:
`desktop/src/main/index.ts` (an entry point, like `src/delivery/cli/program.ts`),
`desktop/src/preload/index.ts` (the same), `desktop/src/renderer/main.tsx` and `app.tsx` (UI shell
entry points), and `src/delivery/context-pack-export.ts` / `src/delivery/diagnostics.ts`
(`delivery/` is a composition root whose tree in `SPEC.md` §10 already shows bare files —
`container.ts`, `context-pack-markdown.ts`).

**Ubiquitous language.** No new domain term is coined. `vault`, `header`, `key`, `session`, `pack`,
`item`, `project`, `lineage`, `generation`, `fork`, `device`, `sidecar`, `conflicted copy` all keep
their existing meanings. The advance's new words come from the spec itself: **relocation** (the
user-facing capability), **move** (the file operation beneath it), **preferences** (device-local UI
state, deliberately *not* "configuration" — D-U(d)), **catalog**, **channel**, **screen**, **tour**.

Three naming risks worth a second look at review:
1. **"Session" is overloaded.** `VaultSession` is a vault concept; Electron's `session` is a browser
   partition. In `desktop/`, the Electron one is always named `browserSession` — never bare
   `session`.
2. **"Location" is not a value object.** `refined.md` §3 notes there is no "vault location" concept
   in `src/`, and this plan deliberately does not invent one: `RelocateVault` takes a destination
   root string and derives paths through the existing `resolveVaultPaths`. Introducing a
   `VaultLocation` value would duplicate `VaultPaths` for no invariant.
3. **`AppPreferencesStore` is long.** It is the price of matching `VaultStore`'s pattern, and it
   keeps the data type (`AppPreferences`) distinguishable from the port in every import line.

---

## 8. Estimated line count and risks

### Production lines

| Tree | Artifact | Lines |
|---|---|---|
| `src/` | container parameter + exposed folder | ~20 |
| `src/` | `context-pack-export.ts` + `content-commands.ts` refactor | ~35 |
| `src/` | `diagnostics.ts` extraction (net new; most of it moved) | ~40 |
| `src/` | `readSchemaVersion` port + adapter | ~25 |
| `src/` | `migrations.ts` exports | ~18 |
| `src/` | `UnlockVault` upgrade gate | ~18 |
| `src/` | `CheckVaultUpgrade` | ~40 |
| `src/` | new error codes | ~10 |
| `src/` | `vault-relocation.ts` (refusal rules) | ~70 |
| `src/` | `vault-mover.ts` (port) | ~30 |
| `src/` | `relocate-vault.use-case.ts` | ~90 |
| `src/` | `file-vault-mover.ts` | ~70 |
| `src/` | explicit busy timeout | ~4 |
| `src/` | **(new, 2026-08-20) `installer.ts` `vaultPath` parameter** (Slice 4 step 29a) | ~20 |
| | **`src/` production subtotal** | **≈ 490** |
| `desktop/` | build config (package.json, electron.vite, electron-builder, 3 tsconfigs, vitest) | ~230 |
| `desktop/` | main: bootstrap + window + hardening | ~200 |
| `desktop/` | main: IPC (channels, schemas, 8 handler files, registration, **client-re-pointing loop in `relocation-handlers.ts`**) | ~460 |
| `desktop/` | main: application (ports, 5 policies, services, **`node-probe.ts` + its port**) | ~310 |
| `desktop/` | main: infra (preferences, file picker, clipboard, report builder) | ~230 |
| `desktop/` | preload | ~70 |
| `desktop/` | shared i18n runtime (translate, format, error-copy, languages) | ~190 |
| `desktop/` | catalogs, two languages | ~700 |
| `desktop/` | renderer: entry, shell, routing, bridge | ~180 |
| `desktop/` | renderer: 16 screens | ~1,500 |
| `desktop/` | renderer: components | ~320 |
| `desktop/` | renderer: view state (plain TS) | ~380 |
| `desktop/` | styles (theme tokens, base, per-screen) | ~320 |
| | **`desktop/` production subtotal** | **≈ 5,090** |
| | **Total estimated production lines** | **≈ 5,600** |

**Tests: ≈ 1,570** (~525 under `src/`, ~1,045 under `desktop/` — the increase over the first cut's
≈1,300 is **P-D5's reversal**: ≈180 lines of DOM-level tests for `recovery-kit.tsx` and
`relocate-vault.tsx`, plus ≈60 lines for the client-re-pointing scenarios in Slice 8 step 69, plus
small additions for `installer.ts`'s `vaultPath` parameter and the Node probe).
**Documentation: ≈ 840** (`docs/gui.md` ~380, `specs/desktop.md` ~180, `advances/GUI/spike.md` ~160
— gains the per-client `env`-honouring record, step 11a — `specs/vault.md` + `specs/delivery.md` +
`docs/SPEC.md` + `CHANGELOG.md` ~120), plus bilingual screenshots from the golden fixture.

### Risks

1. **R1 — Relocation is new filesystem-moving code operating on the one artifact the product cannot
   afford to corrupt, and its blast radius is wider than the fourth revision priced in.**
   `refined.md` §11's top risk, **widened 2026-08-20**. The file-move half fails **silently and
   delayed**: a stale, openable `vault.db` left behind looks like success on the day and surfaces
   weeks later as a fork. The client-re-pointing half, discovered by Oscar's own question rather
   than by either refining pass, fails the same way on the *other* side: a relocation that reports
   success while every connected AI tool silently keeps resolving the old, now-empty folder — the
   fourth revision's design would have shipped exactly this. *The sharpest form of this risk, stated
   plainly:* "everything that remembers where the vault is" now has **three** members — the app's
   preferences, connected clients' MCP configs, and the user's shell environment — and a fourth
   discovered later during implementation is a blocker to escalate, not polish to defer.
   *Mitigated by:* its own slice with runway on both sides (Slice 8 of 12); the safety ordering
   living in one readable use case rather than an IPC handler; a fake `VaultMover` that can fail at
   each stage; the explicit rollback rule for the awkward "verified but could not delete the source"
   case (step 64); the fixed ordering that never touches a client config before the vault move is
   verified (step 67); the binding rule that a client-config failure is reported and never rolls the
   vault back (step 67a); the DOM-level test exercising exactly this failure mode (P-D5, step 69);
   and the client-`env` spike (Slice 1 step 11a) answering *before* Slice 8 whether the mechanism
   even works per client, rather than discovering it mid-slice. **Not mitigated by a de-scope
   lever** — P-D10 was asked and rejected; if this risk materializes badly during Slice 8, the
   response is fix-and-continue or an explicit escalation to Oscar, not a quiet partial ship.
2. **R2 — Size. This is the largest advance the repo has attempted, at one gate.** ~5,500+ production
   lines across two trees, 12 slices, 18 confirmed decisions and two new surfaces with no CLI
   counterpart. `refined.md` §11's third risk predicted exactly this. *Mitigated by:* the slice
   order — Slices 1–7 are a complete, shippable read shell plus first run; relocation, import,
   diagnostics, tour and Settings each land whole and independently, so a slow slice delays without
   destabilizing the ones already merged. **This describes schedule shape, not a licence to drop
   scope:** P-D10 asked Oscar directly whether any slice should be treated as optional under
   schedule pressure, and the answer was no — "todo junto, sin retirada." A slice running long is
   a timeline conversation to have with Oscar, not a decision this plan pre-authorizes the
   implementer to make by quietly shipping fewer than 12. This is the risk most likely to make the
   advance long rather than to make it fail — and staying long, not shrinking, is the sanctioned
   response.
3. **R3 — Packaging and the macOS keychain ACL.** `refined.md` §11's second risk. Three native
   modules × three OSes × two macOS architectures, plus a keychain entry shared between two
   binaries where macOS may prompt on every read. *Mitigated by:* Slice 1 answering both **before**
   any UI exists, and by the fact that a bad answer is a documentation and UX problem now rather
   than a rebuild of finished screens. *Not mitigated:* if `better-sqlite3-multiple-ciphers` cannot
   be rebuilt for a target, that target does not ship — substituting the library is forbidden
   (§8.1).
4. **R4 — accepted risks getting quietly relaxed** — `refined.md` §11's fourth risk, and the one a
   plan can actually do something about. Four specific softenings to refuse: *"let them reopen the
   recovery kit"* / *"let them save it to a file"* (§8.2 — the nonce in step 46 makes reopening
   impossible rather than discouraged); *"verify before delete slows the progress bar"* (step 63);
   *"the English recovery kit in a Spanish window looks like a bug, let's translate
   `renderRecoveryKit`"* (step 46 — the correct fix is one localized sentence); and a tour slide
   that promises curation or overclaims about encryption (step 85, reviewed as content).
5. **R5 — the D-J(b) gate touches `UnlockVault`.** P-D3 modifies the product's most safety-critical
   use case to satisfy a GUI requirement. *Mitigated by:* the CLI passing `upgradeConfirmed: true`
   at one call site so its behaviour is byte-identical, and by a test asserting that a refused
   unlock leaves the on-disk `schema_version` unchanged. *Watch for:* the flag being threaded
   anywhere else, or defaulting to `true` "for convenience", which would silently delete the gate.
6. **R6 — dependency drift between the two `package.json` files.** Six shared dependencies,
   including all three crypto/storage modules. *Mitigated by:* Slice 1 step 3's parity test. This is
   §8.1's "a crypto change wearing a build-tooling disguise" made mechanically detectable.
7. **R7 — Spanish that is grammatically fine and semantically softer.** The four §8.17 surfaces
   (passphrase warning, clipboard warning, relocation refusals, migration confirmation) lose their
   force if translated for length rather than meaning. *Mitigated by:* reviewing those four as
   security artifacts, separately from the rest of the catalog, and by the neutral-LatAm /
   "tú" / no-voseo rule being a stated content constraint rather than a style preference.
8. **R8 — "it's only a language file."** The no-network rule has exactly one shape of first
   exception, and D-V(b) names it. *Mitigated by:* CSP + navigation denial as the enforcement rather
   than a promise, and by the zero-network check running against the **built artifact** (step 98),
   not the source.

---

## 9. Repo structure after execution

```
valija/
├── .claude/hooks/
│   └── guard-implementation.sh              (CHANGED: case gains */desktop/*|desktop/*  — D-L)
├── .github/workflows/
│   ├── ci.yml                               (UNCHANGED — the existing matrix is untouched)
│   └── desktop.yml                          (NEW: desktop typecheck/test/build on 3 OSes;
│                                              electron-builder packaging on tag only)
├── .gitignore                               (CHANGED: desktop/node_modules, out, dist, release)
├── biome.json                               (CHANGED: exclude desktop build outputs)
├── package.json                             (UNCHANGED — no workspaces field, no new script,
│                                              "files" allow-list still ["dist","README.md","LICENSE"])
├── tsconfig.json · tsup.config.ts · vitest.config.ts   (UNCHANGED)
├── CHANGELOG.md                             (CHANGED: one [Unreleased] entry)
│
├── docs/
│   ├── SPEC.md                              (CHANGED: §1 "one binary surface" acknowledges the
│   │                                          companion app · §2 Out line split, GUI shipped, no
│   │                                          milestone number · §10a "import is CLI-only" →
│   │                                          "import has no MCP surface" · D11 gains the
│   │                                          preferences sentence: UI preferences + a location
│   │                                          hint, VALIJA_HOME wins, not configuration)
│   ├── gui.md                               (NEW: install per OS in the OS's own words, checksums,
│   │                                          run-from-source, first run + recovery kit, tour,
│   │                                          Settings and what it does not configure, language and
│   │                                          the English-docs gap, import, connect, diagnostics,
│   │                                          relocation + its VALIJA_HOME consequence, the macOS
│   │                                          keychain answer, clipboard affordances, and what the
│   │                                          GUI deliberately does not do)
│   ├── sync.md · vault-format.md            (unchanged)
│   └── images/gui/                          (NEW: bilingual screenshots, golden fixture only)
│
├── specs/
│   ├── README.md                            (CHANGED: a desktop.md row, noted as the one spec not
│   │                                          mirroring a src/ module)
│   ├── vault.md                             (CHANGED: relocation contract + refusal codes +
│   │                                          ordering guarantee + rollback rule; the schema
│   │                                          upgrade gate and readSchemaVersion)
│   ├── delivery.md                          (CHANGED: buildContainer parameter, the pack-export
│   │                                          helper, the extracted diagnostics module, and
│   │                                          installIntoClient's vaultPath parameter — new
│   │                                          2026-08-20, D-R(a)'s companion step)
│   ├── desktop.md                           (NEW: the IPC surface, the four-key preferences store,
│   │                                          language resolution, tour semantics, wizard refusals)
│   └── context.md · importers.md · shared.md  (unchanged)
│
├── src/                                     (the only tree the CLI and MCP server share)
│   ├── delivery/
│   │   ├── container.ts                     (CHANGED: buildContainer({ vaultRoot }); exposes
│   │   │                                      folder, relocateVault, checkVaultUpgrade)
│   │   ├── context-pack-markdown.ts         (unchanged)
│   │   ├── context-pack-export.ts           (NEW: exportProjectMarkdown / exportProjectJson —
│   │   │                                      one composition, both surfaces)
│   │   ├── diagnostics.ts                   (NEW: runDiagnostics + DiagnosticCheck, lifted out of
│   │   │                                      cli/doctor.ts; check names unchanged)
│   │   ├── cli/
│   │   │   ├── doctor.ts                    (CHANGED: prints the checks, computes none)
│   │   │   ├── content-commands.ts          (CHANGED: calls context-pack-export.ts)
│   │   │   ├── vault-commands.ts            (CHANGED: passes upgradeConfirmed: true — behaviour
│   │   │   │                                  byte-identical)
│   │   │   ├── installer.ts                 (CHANGED, 2026-08-20: installIntoClient gains an
│   │   │   │                                  optional vaultPath, writing an `env` block only when
│   │   │   │                                  given; the CLI's own call site passes nothing, so its
│   │   │   │                                  output is byte-identical — D-R(a)'s companion step)
│   │   │   └── program.ts · import-command.ts · prompt.ts · render.ts  (unchanged)
│   │   └── mcp/server.ts                    (UNCHANGED — byte-for-byte, asserted by the final diff)
│   ├── shared/infra/
│   │   ├── sqlite.ts                        (CHANGED: explicit SQLITE_BUSY_TIMEOUT_MS)
│   │   └── migrations.ts                    (CHANGED: exports LATEST_SCHEMA_VERSION,
│   │                                          pendingMigrations)
│   ├── vault/
│   │   ├── domain/
│   │   │   ├── errors.ts                    (CHANGED: 8 relocation/upgrade codes)
│   │   │   └── services/vault-relocation.ts (NEW + .test.ts: refuseUnsafeRelocation)
│   │   ├── application/
│   │   │   ├── ports/vault-store.ts         (CHANGED: readSchemaVersion)
│   │   │   ├── ports/vault-mover.ts         (NEW: VaultMover)
│   │   │   └── use-cases/
│   │   │       ├── relocate-vault.use-case.ts       (NEW + .test.ts)
│   │   │       ├── check-vault-upgrade.use-case.ts  (NEW + .test.ts)
│   │   │       └── unlock-vault.use-case.ts         (CHANGED: the upgrade gate)
│   │   └── infra/
│   │       ├── file-vault-store.ts          (CHANGED: readSchemaVersion)
│   │       └── file-vault-mover.ts          (NEW + .test.ts: FileVaultMover)
│   ├── context/ · importers/ · testing/     (UNCHANGED)
│
├── desktop/                                 (NEW — the whole workspace; excluded from npm "files")
│   ├── package.json · package-lock.json     (standalone, NOT a root workspace; devDependencies
│   │                                          gain jsdom, @testing-library/react and
│   │                                          @testing-library/jest-dom — P-D5, reversed
│   │                                          2026-08-20, for exactly two DOM-level test files)
│   ├── electron.vite.config.ts · electron-builder.yml
│   ├── tsconfig.json · tsconfig.web.json · vitest.config.ts
│   ├── resources/                           (app icons)
│   └── src/
│       ├── shared/                          (pure TS — main, preload and renderer all import it)
│       │   ├── i18n/
│       │   │   ├── catalogs/en.ts · es.ts   (es typed as `typeof en`: a missing key fails tsc)
│       │   │   ├── translate.ts · format.ts · error-copy.ts · languages.ts
│       │   │   └── *.test.ts                (identical key sets, plurals, code coverage)
│       │   └── ipc/channels.ts              (the closed channel tuple + wire types, no zod)
│       ├── main/
│       │   ├── index.ts                     (the ordered bootstrap of §3.A)
│       │   ├── windows/main-window.ts       (sandbox · contextIsolation · CSP · navigation denial)
│       │   ├── ipc/
│       │   │   ├── schemas.ts               (one zod schema per channel)
│       │   │   ├── register-handlers.ts     (+ .test.ts: registered set == the tuple)
│       │   │   └── handlers/                (vault · content · import · tools · diagnostics ·
│       │   │                                  relocation · preferences · dialog)
│       │   ├── application/
│       │   │   ├── ports/app-preferences.ts · file-picker.ts ·
│       │   │   │            node-probe.ts            (NEW, D-W: real executable probe, not
│       │   │   │                                       process.versions — Slice 9 step 71a)
│       │   │   ├── policies/system-or-override.ts · language-resolution.ts ·
│       │   │   │            theme-resolution.ts · onboarding-tour.ts · vault-location.ts
│       │   │   └── services/diagnostics-report.ts   (English support artifact)
│       │   └── infra/
│       │       ├── file-app-preferences-store.ts    (atomic write, four keys, corrupt→defaults)
│       │       ├── electron-file-picker.ts          (the ONLY origin of a filesystem path)
│       │       ├── electron-clipboard.ts
│       │       ├── child-process-node-probe.ts       (NEW: spawns `node --version` / `npm
│       │       │                                       --version` on PATH — D-W, Slice 9 step 71a)
│       │       └── dependency-parity.test.ts        (the two package.json files must agree)
│       ├── preload/index.ts                 (contextBridge: one method per channel, hand-written)
│       └── renderer/
│           ├── index.html · main.tsx · app.tsx
│           ├── screens/                     (no-vault · create-vault · recovery-kit · locked ·
│           │                                  migration-confirm · dashboard · project · search ·
│           │                                  pack-preview · sync · relocate-vault · connect-tools ·
│           │                                  import · diagnostics · onboarding · settings)
│           ├── screens/__dom-tests__/       (NEW, P-D5 reversed 2026-08-20: recovery-kit.dom.test.tsx
│           │                                  and relocate-vault.dom.test.tsx — jsdom +
│           │                                  @testing-library/react, exactly these two screens)
│           ├── components/                  (shared presentational pieces)
│           ├── state/                       (plain TS view state + bridge client, all .test.ts'd)
│           └── styles/                      (theme tokens, base, per-screen; system font stack)
│
└── advances/GUI/
    ├── idea.md · refined.md · mockups.md    (unchanged)
    ├── plan.md                              (this file)
    ├── spike.md                             (NEW: per-OS native-module + ABI results, the macOS
    │                                          keychain-ACL answer with its exact version, artifact
    │                                          SHA-256s, the zero-network verification)
    └── review.md                            (NEW, written by change-reviewer)
```

---

**Plan path:** `/home/user/valija/advances/GUI/plan.md`

**Total estimated production lines: ≈ 5,600** — ≈ 490 under `src/` (the relocation use case, the
schema-upgrade gate, three shared-composition extractions, and `installer.ts`'s new `vaultPath`
parameter) and ≈ 5,090 under `desktop/` — plus ≈ 1,570 test lines (including P-D5's DOM-level
tests for exactly two screens), ≈ 840 documentation lines, and bilingual screenshots drawn only
from the published golden-vault fixture.

**Gate P is closed.** Oscar reviewed this plan and confirmed, item by item through an interactive
prompt: all 18 Group A items (§6) — seventeen exactly as written, and A-2/D-R(a) as rewritten to
require re-pointing every connected client's MCP config during relocation; **P-D3** (the change to
`UnlockVault` that D-J(b) forces); **P-D5 reversed** (DOM-level tests for the recovery-kit and
relocation-wizard screens); and **P-D10 rejected** (no de-scope lever — all 12 slices ship). The
`Approved:` line is recorded at the top of this file. Two mid-implementation human gates remain,
neither performable by an agent: **Slice 1 step 11** (the macOS keychain-ACL answer, D-H) and
**Slice 1 step 11a** (the per-client `env`-block-honouring answer, D-R(a)'s mandatory spike) —
both block Slice 8 and both should be scheduled together, on the same real macOS desktop session
where practical.
