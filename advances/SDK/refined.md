# SDK — Valija as an embeddable library (`valija/sdk`) · Refined Spec

**Status:** Approved at Gate R: Oscar 2026-10-21 (relayed by the orchestrating agent).
- All 22 decisions in §10 (D-A … D-V) are resolved.
- Five of them **differ from the original recommendation**:
  - **D-A = 3:** keychain-session reuse **and** an in-process passphrase or recovery-key unlock.
  - **D-D = 2:** the SDK can also create a vault.
  - **D-J = 1:** only the five MCP operations.
  - **D-K = 2:** no pinning.
  - **D-V:** a CLAUDE.md line, written by the implementer.
- **Four refiner resolutions inside D-A / D-D** are marked ⚑. Oscar asked the refiner to "decide and
  justify" them. They should be shown to him again at Gate P alongside the plan's *Decisions to
  confirm*.

**Directory:** `SDK`. This is a feature advance with no milestone number, like `CURATION`,
`PROJECT-DETECT` and `SECRET-WARN`.
**Branch:** `feat/sdk-SDK`. It is stacked on `SECRET-WARN`, which is stacked on `PROJECT-DETECT`, which
is stacked on `CURATION`. None of them is merged yet. This advance assumes their behaviour exactly as
written in their `refined.md`.
**Source:** Oscar's raw idea, checked against the tree on 2026-10-21. The idea: make Valija usable as
a dependency, so another product can store its end user's context in the user's own encrypted vault.
It must be the **same vault** the user already has, shared with CLI, desktop and MCP. This advance
also includes the verified gap Oscar chose to fix here: an older Valija silently opens a vault whose
schema is **newer** than it understands.
**Inherits from:** `docs/SPEC.md` §3, §4 (D6, D7, D9, D11), §7, §9, §10, §10b;
`docs/vault-format.md` §11 (the reader contract); `docs/sync.md`; `advances/GUI/` D-J(b) (the
upgrade gate); `advances/CURATION/refined.md`; `advances/PROJECT-DETECT/refined.md`;
`advances/SECRET-WARN/refined.md` (D-B, D-N: a model cannot override).
**Touches (expected):**
- `src/delivery/**`: a new `sdk/` delivery adapter and container wiring for two unlock modes.
- `src/vault/**`:
  - the newer-schema guard and a new error code
  - an in-memory `KeychainPort` adapter
  - device-identity wiring that keeps in-process activity in memory
- `src/shared/infra/**`: a migration-runner backstop and a read-only schema probe.
- `src/context/infra/vault-sessions.ts`: the guard on session open, and a "do not auto-migrate" mode.
- `desktop/src/**`: copy for the new code in `en` and `es`, and how the app reacts to it.
- `package.json` (`exports`), `tsup.config.ts` (second entry, type declarations), docs, and one line in
  `CLAUDE.md` (§14).

There is **no** new migration, **no** new MCP tool or argument, **no** new CLI command and **no** new
IPC channel.

---

## 1. Goal

**A developer can `import { openVault, createVault } from "valija/sdk"` in a Node 22 product and
use it to give that product's end user an encrypted Valija vault. That is the same `vault.json` +
`vault.db`, in the same format, that the CLI, the desktop app and MCP use.**
- **Opening:** the product either reuses the session the user unlocked with Valija, or unlocks with a
  passphrase or recovery key the user supplies. In the second case the key stays inside the product's
  process.
- **Creating:** the product can create a new vault with the same format as `valija init`, and hands
  the recovery kit to the user.
- **Operations:** exactly the five things an AI tool can do over MCP: save, save a handoff, get a
  context pack, search, and list projects.
- **Visibility:** anything written through the product shows up in the CLI, the desktop app and MCP,
  and the other way round.

**Alongside this, no Valija surface (CLI, desktop, MCP or SDK) will ever open a vault whose schema is
newer than the one it was built for. It refuses with `VAULT_SCHEMA_TOO_NEW` and does not touch the
vault.**

Five phrases carry the scope:

- **"The same vault."** There is no second format, no copy, no sidecar and no per-product vault.
  - The SDK finds the vault the same way the CLI does (D-C).
  - It writes lineage under this device's identity (D-C).
  - `createVault` output is indistinguishable from `valija init` output (D-D).
- **"Inside the product's process."** In in-process mode the derived key is never written to the OS
  keychain (D-A). Unlocking a product therefore never unlocks the user's AI tools.
- **"The five MCP operations."** The SDK has the same *capability set* as MCP (D-J), plus vault
  lifecycle: open, create, lock, close. Curation, export and diagnostics stay in Valija's own CLI and
  desktop.
- **"Exactly what Valija does."** The SDK is a new **delivery adapter** over the existing use cases.
  Domain and application layers change only for the schema guard. What the product does with the
  context once it has read it (LLM calls, UI, storage elsewhere) is the integrator's responsibility,
  and the docs say so.
- **"Does not touch the vault."** A refusal on a newer schema writes nothing: no migration, no
  lineage bump, no `meta` write, no keychain change, no backup file (D-F).

---

## 2. User walkthrough

There are three people in these examples:
- **Lucía** already uses Valija (CLI and desktop). Her vault lives in Dropbox
  (`VALIJA_HOME=~/Dropbox/valija`).
- **Mateo** has never installed Valija.
- **Acme** builds "Acme Notes", a Node/Electron assistant that embeds `valija/sdk`.

### 2.1 Integrator: wiring it in (once, at build time)

```ts
import { openVault, createVault } from "valija/sdk";      // Node ≥ 22, ESM-only (D-R)

// Mode K — reuse the session the user unlocked with Valija (no secret in the product)
const k = await openVault({ client: "acme-notes" });

// Mode P — the user typed their Valija passphrase (or recovery key) into Acme
const p = await openVault({ client: "acme-notes", passphrase });       // or { recoveryKey }

// New user without a vault
const c = await createVault({ client: "acme-notes", passphrase });
// c.value.recoveryKit → show it to the user once, never store it; c.value.vault is a Mode P handle

const vault = p.value;
await vault.save({ project: "acme-roadmap", type: "decision",
                   content: "We ship offline mode first.", tags: ["offline"] });
await vault.getContextPack({ project: "acme-roadmap" });
await vault.close();   // Mode P: forgets the key
```

Method names are illustrative. The planner finalizes them (§5). Every call returns a `Result`
(D-O) and never throws for an expected condition.

### 2.2 Lucía, Mode K (she unlocks with Valija; Acme never sees a secret)

| # | Lucía does | She sees |
|---|---|---|
| 1 | Opens Acme Notes while Valija is locked | Acme shows its own hint built from `VAULT_LOCKED`: "Unlock Valija to use your context." |
| 2 | `valija unlock` in a terminal (or unlocks in the desktop app) | `Unlocked vault 01J…`, as today. |
| 3 | "Remember that we ship offline mode first" | Acme calls `save`. The item is stored in **her** vault, with `source: "acme-notes"`. |
| 4 | Pastes a note containing `sk-ant-…` | `POSSIBLE_SECRET` with kinds and lines and no matched text. Nothing is saved. Acme cannot override (D-L). |
| 5 | Later, in Claude Code: `get_context acme-roadmap` | The pack includes Acme's decision. |
| 6 | Wants to fix or pin that item | She does it in `valija edit` / `valija pin` or in the desktop app. Acme has no curation (D-J, D-K). |
| 7 | Steps away for 15 minutes | Auto-lock fires at the next session open from **any** surface, including Acme's. Acme gets `VAULT_LOCKED`. |
| 8 | Presses Acme's "Lock Valija" button | Same as `valija lock`: the vault is locked on every surface (D-B). |

### 2.3 Lucía, Mode P (she types her passphrase into Acme)

| # | Lucía does | She sees |
|---|---|---|
| 1 | Enters her Valija passphrase in Acme's unlock dialog | Acme calls `openVault({ passphrase })`. Argon2id runs inside Acme (about a second). The open succeeds, or returns `WRONG_PASSPHRASE`. |
| 2 | Opens Claude Code, while Valija's own session is locked | `get_context` → "Vault is locked…". **Unlocking Acme did not unlock her AI tools** (the key is not in the OS keychain). |
| 3 | `valija status` in a terminal | `locked`, as before. Acme's session is invisible to the OS keychain. |
| 4 | Uses Acme for a while | Saves and packs work. Activity in Acme does **not** keep Valija's own keychain session alive (⚑ D-A.3). |
| 5 | Leaves Acme idle past `VALIJA_AUTOLOCK_MINUTES` | Acme forgets the key at the TTL. Her next action gets `VAULT_LOCKED`, and Acme asks for the passphrase again (⚑ D-A.2). |
| 6 | Presses "Lock" in Acme, or quits it | Acme forgets the key. If Valija's own keychain session happens to be unlocked, it **stays** unlocked (⚑ D-A.1). |

### 2.4 Mateo, a new user (`createVault`)

| # | Mateo does | He sees |
|---|---|---|
| 1 | First run of Acme: "Create your private vault" and picks a passphrase | Acme calls `createVault`. A weak passphrase gives `WEAK_PASSPHRASE`, the same rule as `valija init`. An existing vault at the target gives `VAULT_ALREADY_EXISTS`, and Acme offers "open existing" instead. |
| 2 | — | Acme shows the **recovery kit**, the exact text `valija init` produces, once. It asks him to print it or store it offline, and then discards it (§11.4). |
| 3 | Uses Acme | The vault is open in Mode P. Nothing is in the OS keychain. |
| 4 | Months later: `npm i -g valija`, then `valija unlock` with the same passphrase | It works. It is the same vault at `~/.valija`. `valija show acme-…` lists what Acme saved, and he can curate it there. |
| 5 | Forgets the passphrase | `valija unlock --recovery-key <hex>` (as the kit says), or `openVault({ recoveryKey })` in Acme. |

### 2.5 Version skew: the new guard

| Situation | What each surface does |
|---|---|
| Lucía updates the CLI to a release with schema v5 and unlocks. The vault migrates to v5. Acme still embeds an SDK built for v4. | Mode K: every Acme call returns `VAULT_SCHEMA_TOO_NEW` ("upgraded by a newer Valija (schema 5); this version supports up to 4; update it"). Mode P: `openVault` itself refuses. Either way the vault is untouched and her keychain session is left in place. |
| The same thing with an older `valija mcp` or an older desktop build | The same refusal, on unlock and on every tool or screen. The desktop shows en/es copy. The MCP reply tells the model to ask the user to update Valija. |
| `valija status` / `valija doctor` / desktop Diagnostics on an older build | The status is reported, not fatal: a failing `vault` row reading "schema v5 is newer than this valija (supports v4) — update valija" (D-G). |
| `valija lock` on an older build | It still locks (drops the key) and reports nothing about lineage (D-G). |
| The opposite: Acme bundles a newer SDK (v5) and Lucía's vault is v4 | `VAULT_UPGRADE_REQUIRED` in either mode, unless Acme opened with `allowUpgrade: true` (D-H). The docs explain that upgrading locks out every older Valija she has installed until she updates them. |

### 2.6 Where SDK-written data goes, and where it does not

| Surface | Sees SDK-written items? | Notes |
|---|---|---|
| CLI `show` / `search` / `export`, desktop | yes | It is the same database. **Curation happens only here.** |
| MCP `get_context` / `search_context` | yes, when the vault is unlocked for MCP | A Mode P session never unlocks MCP. |
| Lineage / fork detection | it is a write from **this device** | Same device id as the CLI, so no false fork (§8). Mode P records lineage last-seen exactly as `valija unlock` does. |
| OS keychain | **only in Mode K, and it is read, never written** | Mode P and `createVault` never write it (§11.1). |
| Acme's own storage, logs, LLM calls | **outside Valija** | That is the integrator's responsibility, and the docs say so plainly (§11.9). |
| Any network endpoint run by Valija | **none** | The SDK makes no network calls and sends no telemetry. |

---

## 3. Context snapshot (verified facts the planner builds on)

1. **The composition root** is `buildContainer({ vaultRoot? })` in `src/delivery/container.ts`.
   - It resolves the vault with `resolveVaultPaths` (option, then `VALIJA_HOME`, then `~/.valija`).
   - It resolves device state with `resolveStatePaths()` (`VALIJA_STATE_HOME`, then
     `~/.valija-state`), which has no option.
   - It reads `VALIJA_AUTOLOCK_MINUTES` and `VALIJA_PROJECT` from the environment when it is built.
   - It always wires `OsKeychain`.
   - The CLI, MCP and desktop all use it.
2. **Session model** (SPEC D6). `UnlockVault` resolves the key (`resolveUnlockKey`: Argon2id from a
   passphrase, or a recovery hex used as-is). It verifies the key and then calls
   `keychain.setKey(vaultId, keyHex)` **through the `KeychainPort`**. Every content operation opens its
   own session through `SqliteVaultSessions.open()`, which:
   - reads the header
   - reads `keychain.getKey` (`VAULT_LOCKED` if the key is missing)
   - runs the `SessionGuard` idle check
   - calls `openVaultDb`, then **`migrate(db, path)`**, on every open.

   Every keychain touch goes through the port. So an in-memory adapter wired into the same use cases
   keeps the key out of the OS keychain **without changing any use case**.
3. **Idle auto-lock** (`SessionGuard`) is lazy and has no daemon. It reads and writes
   `lastActivityAt` per vault in the shared device-local `state.json`, through `DeviceIdentity`. On
   expiry it calls `keychain.deleteKey`. `UnlockVault` and `CreateVault` also call `recordActivity`.
   - **Consequence:** if a Mode P session recorded activity in the shared state, it would keep the OS
     keychain session from expiring, silently widening another surface's unlocked window. ⚑ D-A.3
     prevents this.
4. **`CreateVault`** does the following:
   - refuses with `VAULT_ALREADY_EXISTS` when the header exists
   - validates the passphrase (`WEAK_PASSPHRASE`)
   - writes the header (`DEFAULT_KDF_PARAMS`) and initializes the database at `LATEST_SCHEMA_VERSION`
   - calls `keychain.setKey` and `recordActivity`
   - returns `{ vaultId, keyHex, createdAt }`

   `renderRecoveryKit(vaultId, keyHex, createdAt)` (`vault/infra/recovery-kit.ts`) builds the kit text
   that `valija init` prints. The text names `~/.valija/vault.db` and `valija unlock --recovery-key`
   literally, even when the vault lives elsewhere. That is existing behaviour, and this advance does not
   change it.
5. **`migrate` skips versions above the ones it knows.** If the vault's `schema_version` is higher than
   `LATEST_SCHEMA_VERSION`, nothing runs and the session goes ahead. **This is the verified gap.**
6. **Unlocking checks only `schema < LATEST`** (`VAULT_UPGRADE_REQUIRED` unless `upgradeConfirmed`).
   On a newer schema it carries on into `readLineage`, which calls `migrate` (a no-op), and then sets
   the key. So an older build **unlocks a newer vault, and then opens sessions on it**.
7. **Other paths that open the database:**
   - `VaultStatus` (`status`, `doctor` through `runDiagnostics`, desktop Diagnostics) calls
     `readLineage`, which calls `migrate`.
   - `LockVault` makes a best-effort `readLineage`, which also calls `migrate`.
   - `CheckVaultUpgrade` returns `required: false` with `from > to` on a newer vault.
   - `context-pack-export.ts` (`valija export`, desktop export) goes through sessions.
   - `RelocateVault` requires a locked vault and never opens the database.
   - `CreateVault.initializeDb` only runs on a fresh vault.
8. **Side effects of opening.** `openVaultDb` always runs `wal_checkpoint(TRUNCATE)` and
   `journal_mode = DELETE`, including inside `readSchemaVersion`. vault-format §11 forbids a *reader*
   from running those pragmas.
9. **Sessions auto-migrate a vault that is behind**, once a key is available. The unlock gate does not
   cover sessions. Today this is accepted for CLI and MCP (M2). For the SDK in Mode K it would mean a
   product migrates the user's vault silently, which D-H prevents.
10. **The journal is a rollback journal** (`DELETE`). `SQLITE_BUSY_TIMEOUT_MS = 5000`. Each write
    runs in one transaction that also bumps the lineage stamp. A device's last-seen record is written
    atomically (tmp file plus `rename`). On one device, writes are serialized, so a last-seen record
    that is stale because two processes raced classifies as a fast-forward, never as a fork. Use across
    *devices* is strictly sequential (sync.md).
11. **The use cases behind the five MCP operations:**
    - `SaveContext` (`save_context` / `save_handoff`): accepts `source?` and `supersedes?`, refuses
      secrets with no override, and auto-creates the project (D9).
    - `GetContextPack`, plus markdown rendering (`get_context`).
    - `SearchContext` (`search_context`): limit 1–100, default 20; includes imported items; excludes
      archived ones.
    - `ListProjects` (`list_projects`).
12. **The package today:** `valija@0.3.0`. It is ESM-only, Node ≥ 22, has **no `exports` and no
    `main`**, and has only a `bin`. `tsup` builds a single entry with no `.d.ts` output. The three
    native dependencies are kept external. TypeScript is `^7.0.2`.
13. **Errors.** `Result<T, DomainError>`, where `DomainError extends Error` with `code` and `message`.
    The desktop renders codes only (`copyForErrorCode`). Its `en`/`es` catalogs have a parity test.
14. **The desktop app** is unpublished and bundles its own copy of `src/`. Its version can lag behind
    the CLI's.
15. **Valija has no passphrase-change or re-key operation** (SPEC §8 lists none). A passphrase or
    recovery key that leaks stays valid for that vault, and for every synced or backed-up copy of it,
    forever. This drives §11 and §15.

---

## 4. Scope

### In

- **A public entry point, `valija/sdk`.** It is a subpath export of the existing package, ESM-only,
  ships `.d.ts` types, and is Node only (D-R). It exposes exactly the operations in §5.
- **A new delivery adapter, `src/delivery/sdk/`**, with SDK-owned DTOs and a public error shape (D-O,
  D-Q).
- **Two unlock modes (D-A):**
  - **Mode K** reuses the OS-keychain session.
  - **Mode P** takes a passphrase or recovery key and keeps the key in process only, through an
    in-memory `KeychainPort` adapter.
  - Each mode has its own auto-lock, `lock()` and `close()` behaviour (§5.1).
- **`createVault` (D-D):** the same format, header and KDF parameters as `valija init`. It returns the
  recovery-kit text, refuses an existing vault, and leaves the new vault open in Mode P.
- **Operations:** the five MCP-equivalent operations (D-J), with no pinning (D-K) and no secret
  override (D-L).
- **The vault location:** the same resolution as the CLI, with an optional `vaultRoot` (D-C).
- **The schema-version policy:**
  - A vault newer than the code is refused with `VAULT_SCHEMA_TOO_NEW` on every surface and every open
    path in §6.
  - A vault older than the code is not migrated by the SDK without `allowUpgrade` (D-H).
- **Behaviour under concurrency** with CLI, desktop, MCP and other SDK handles, specified and tested
  (§8).
- **Desktop:** `en`/`es` copy for `VAULT_SCHEMA_TOO_NEW`. It is handled as a terminal error (no retry
  loop, no upgrade-confirm screen).
- **CLI/MCP:** the refusal message. `doctor` and `status` report the condition (D-G).
- **Docs in the same commit:**
  - `docs/sdk.md`: both modes, `createVault`, the version policy, concurrency, responsibilities, a
    runnable example, and Electron native-rebuild notes.
  - README: an "Embed Valija in your product" section.
  - SPEC §1, §3, §10.
  - `specs/delivery.md`, `specs/vault.md`, `specs/shared.md`.
  - `docs/vault-format.md`: writers obey the newer-schema refusal too.
  - CHANGELOG.
  - The CLAUDE.md *Surface parity* line (D-V).

### Out (deferred or rejected)

- **Curation from the SDK:** edit, archive and unarchive, pin and unpin, listing items. These stay in
  CLI and desktop (D-J, D-K).
- **Export, `status` and diagnostics from the SDK** (D-J).
- **Importers** (D-N). Project detection and bindings (D-M). Relocation, install, doctor, `mcp`.
- **Writing the key to the OS keychain from the SDK.** Rejected permanently: D-A option 4.
- **An SDK operation that "promotes" a Mode P session into the OS keychain.** Rejected, for the same
  reason.
- **Passphrase change or re-key.** Not in Valija today. Flagged as a follow-up by §15.
- **A browser, Deno, Bun or React Native build** (D-R). **A separate npm package** (D-R).
- **An `allowSecrets` override** (D-L). **Hard delete** (CURATION D-C).
- **Any change to the MCP surface:** still five tools and two prompts.
- **Changing CLI/MCP auto-migrate behaviour** (D-I). **A `VAULT_BUSY` code** (D-S).
- **Multi-vault support.** SPEC §12 Q4 stays open.

---

## 5. SDK surface (operations, not signatures)

All operations are async (D-P) and return `Result<PublicDto, ValijaError>` (D-O). Each content
operation opens and closes its own session, as MCP does.

| Operation | Wraps | Notes |
|---|---|---|
| `openVault({ client, vaultRoot?, allowUpgrade? })` (**Mode K**) | header read | `VAULT_NOT_FOUND` if there is no vault. It needs no key and does not unlock. Lock, auto-lock and schema problems show up per call. |
| `openVault({ client, passphrase \| recoveryKey, vaultRoot?, allowUpgrade? })` (**Mode P**) | `UnlockVault`, with the in-memory keychain | It verifies the key **at open**: `WRONG_PASSPHRASE`, `VAULT_SCHEMA_TOO_NEW` or `VAULT_UPGRADE_REQUIRED`. A detected fork does not fail the open; it is returned as a non-fatal `forkNotice` in the open result, with the same wording `valija unlock` prints. Passing both a passphrase and a recovery key is a validation error. |
| `createVault({ client, passphrase, vaultRoot? })` | `CreateVault` with the in-memory keychain, plus `renderRecoveryKit` | Returns `{ vault (a Mode P handle), vaultId, recoveryKit }`. `VAULT_ALREADY_EXISTS` or `WEAK_PASSPHRASE` on refusal. |
| `save({ project, content, type?, tags?, supersedes? })` | `SaveContext` | Equivalent to `save_context`. `project` is required (D-M). Allowed types are the five saveable ones; `imported` is never accepted. `source` is the `client` label (D-U). The secret check applies with no override (D-L). A project that does not exist is auto-created (D9). |
| `saveHandoff({ project, content })` | `SaveContext` (`type: "handoff"`) | Equivalent to `save_handoff`. |
| `getContextPack({ project, budgetTokens? })` | `GetContextPack` + markdown rendering | Equivalent to `get_context`, and byte-identical to it for the same input. |
| `search({ query, project?, limit? })` | `SearchContext` | Equivalent to `search_context`. Same clamps; lines carry item ids, as on MCP. |
| `listProjects()` | `ListProjects` | Equivalent to `list_projects`, without the `(this workspace)` marker (no detection). |
| `lock()` | §5.1 | Behaviour depends on the mode. |
| `close()` | §5.1 | Ends the handle. It is lifecycle, not a vault operation. |

**Not in the SDK:**
- curation (edit, archive, unarchive, pin, unpin, listing items)
- export and status
- import
- detection and bindings
- relocate, install, doctor, `mcp`

### 5.1 Unlock modes: key lifetime, auto-lock, `lock()`, `close()`

| | **Mode K** (keychain session) | **Mode P** (in process) |
|---|---|---|
| Where the key lives | OS keychain (written by `valija unlock` or the desktop app). It is read per call and never cached. | Inside the handle's in-memory `KeychainPort` adapter. **Never** in the OS keychain. |
| Who derives it | Valija, outside the product | **Argon2id runs in the product's process** (64 MiB, t=3, on the libuv threadpool), or a recovery hex is used as-is. The passphrase string is not retained after derivation. |
| Lifetime | Whatever the user's Valija session is | From a successful `openVault` / `createVault` until `lock()`, `close()`, auto-lock expiry or process exit, whichever comes first |
| Auto-lock | Shared `SessionGuard`, shared `lastActivityAt`, TTL from `VALIJA_AUTOLOCK_MINUTES`. Expiry deletes the OS keychain key. | `SessionGuard` with the **same TTL**, but activity is tracked **per handle in memory** (⚑ D-A.3). Expiry drops the in-process key. A proactive, unref'd timer also drops it at the TTL (⚑ D-A.2). `0`/`off` disables both checks. |
| `lock()` | The global `LockVault`, the same as `valija lock` (D-B) | Drops the in-process key only. **The OS keychain is not touched** (⚑ D-A.1). |
| `close()` | Releases the handle. The vault and the keychain are unaffected. | Same as `lock()`, and the handle becomes unusable |
| After the key is gone | `VAULT_LOCKED` until the user unlocks Valija | `VAULT_LOCKED` until the integrator opens a new handle with the passphrase |
| Lineage / device identity | Shared, as today | Shared `deviceId` and last-seen records, so fork detection works. **Only activity is kept in memory.** |
| Wiping | n/a | Best effort: references are dropped, and byte buffers under the SDK's control are zeroed. **JavaScript cannot guarantee that a string is erased from memory**, and the docs say so (§11.3). |

Several Mode P handles in one process are independent, each with its own key and idle timer. A
Mode P handle never reads the OS keychain, even if Valija's own session is unlocked.

**Where the SDK sits with respect to parity.** CLAUDE.md requires CLI and desktop to stay symmetric.
The SDK is, **like MCP, a deliberately narrower surface outside that rule**. Its operations are MCP's
five, plus create, unlock and lock, which already exist on both CLI and desktop. So it adds no human
capability that one of them lacks. The one thing that must ship on every surface is the schema guard
(§6). One line in CLAUDE.md records this (D-V, §14).

---

## 6. The newer-schema guard: behaviour per open path

**The rule:** if the vault's `schema_version` is greater than `LATEST_SCHEMA_VERSION`, refuse with
`VAULT_SCHEMA_TOO_NEW`. The message names both numbers and says "update Valija". **The refusal must
not:**
- run `migrate` or write to `meta`
- bump lineage, or call `recordSeen` / `recordActivity`
- create a `.pre-00N.bak`
- set or delete a key in any keychain (OS or in-memory)
- change `vault.json`
- run the journal pragmas (D-F)

| Path | Today | After |
|---|---|---|
| `UnlockVault` (CLI `unlock`, desktop unlock, **SDK Mode P open**) | unlocks and sets the key | refuses **before** `readLineage` and before `setKey` |
| `CheckVaultUpgrade` (desktop confirm screen) | `required: false`, `from > to` | `VAULT_SCHEMA_TOO_NEW` |
| `SqliteVaultSessions.open` (every content command on CLI, MCP, desktop and SDK, including export) | opens normally | refuses. The keychain key is **kept**, because a newer surface may legitimately be using it. |
| `VaultStatus` (`status`, `doctor`, desktop Diagnostics) | reports normally | reports, with a schema-compatibility field. `doctor` shows a failing non-fatal row (D-G). |
| `LockVault` | best-effort lineage, then drops the key | still drops the key; lineage is omitted (D-G) |
| `migrate()` itself | silently skips | a backstop refusal, so any future caller fails closed (D-E) |
| `CreateVault` (CLI `init`, desktop create, SDK `createVault`), `RelocateVault` | — | unaffected (a fresh vault, or no open) |

**How each surface reports it:**
- **CLI:** `error [VAULT_SCHEMA_TOO_NEW]: …`, exit code 1.
- **MCP:** an `isError` reply telling the model to ask the user to update Valija.
- **Desktop:** the copy from the code only. It is not a lock loop and not the upgrade-confirm screen.
- **SDK:** `{ code: "VAULT_SCHEMA_TOO_NEW" }`.

---

## 7. Error codes and public shapes

| Code / shape | New? | Where |
|---|---|---|
| `VAULT_SCHEMA_TOO_NEW` | **new**, in `VaultErrorCode` | every path in §6; desktop `en.ts` and `es.ts` |
| `ValijaError` = `{ code: ValijaErrorCode; message: string }` | new public type | SDK only. `code` is a closed, documented union (below). `message` is English, for humans, and **not** covered by semver. It never contains key material, a passphrase, or refused content. |
| SDK DTOs (open result with `forkNotice?`, create result, save result, search hit, project, pack) | new public types | `src/delivery/sdk/` (D-Q) |
| `allowUpgrade?: boolean` | new SDK option | `openVault` (D-H) |

**The `ValijaErrorCode` union** is drawn from existing codes plus the new one:
- `VAULT_NOT_FOUND`, `VAULT_ALREADY_EXISTS`, `VAULT_LOCKED`
- `WRONG_PASSPHRASE`, `WEAK_PASSPHRASE`
- `KEYCHAIN_ERROR`, `STORAGE_ERROR`
- `VAULT_UPGRADE_REQUIRED`, `VAULT_SCHEMA_TOO_NEW`
- `POSSIBLE_SECRET`
- the context and validation codes the five operations can return today (the planner enumerates
  them from the use cases, including the `supersedes` failures and `PROJECT_NOT_FOUND`)

**Proposed desktop copy** (neutral Spanish, no voseo):
- **en:** "This vault was upgraded by a newer version of Valija. Update this app to open it."
- **es:** "Esta bóveda fue actualizada con una versión más reciente de Valija. Actualiza esta
  aplicación para abrirla."

---

## 8. Concurrency on one device (required behaviour and tests)

- **The model:** CLI, desktop, MCP and any number of SDK handles, in either mode and in any number of
  processes, may be open on one vault on one device. Each operation is its own short session.
  SQLite's file locks serialize writers, and a contended call waits up to 5 s.
- **Past the timeout,** the call fails as `STORAGE_ERROR`, with a "vault busy" message (D-S). The write
  rolls back completely: no partial item and no lineage bump.
- **No false fork.** Interleaved writes from several surfaces on the same device, including Mode P
  handles, never produce `VAULT_FORK_DETECTED` at the next unlock. Last-seen may lag behind, which is
  a fast-forward.
- **Visibility.** A write committed by one surface is visible to the next read on any other. Nothing
  is cached across calls.
- **Nothing left on disk.** No sidecar remains after any SDK call. `valija status` shows `DELETE` and
  no sidecars.
- **Two `createVault` races.** Two products creating a vault at the same root at the same moment is
  out of scope. The header-exists check is as racy as `valija init` is today. This is documented.
- **Multi-device rules are unchanged:** strictly sequential. The SDK docs repeat "lock before
  switching devices". In Mode P that means "close the product".
- **Required tests:**
  1. One connection holds a write transaction, and another's write waits and then succeeds.
  2. Past the timeout, the waiting call fails cleanly and the vault is consistent.
  3. Interleaved writes from a Mode K container, a Mode P handle and a CLI container sharing
     `VALIJA_STATE_HOME` produce no fork.
  4. An SDK save is visible to a CLI-container `show` straight away.

---

## 9. Packaging and stability

- **Exports:** `package.json` gains an `exports` map with `"./sdk"` (types plus import) and
  `"./package.json"`. The `bin` is unchanged. There is still no `"."` entry.
- **Build:** a second `tsup` entry, plus `.d.ts` output for the SDK entry only. **The planner must
  verify how declarations are produced under TypeScript 7**, because tsup's `dts` relies on the
  TypeScript JS API. Fallback: emit them with `tsc`/`tsgo --emitDeclarationOnly`.
- **Dependency footprint:** consumers install the whole package. This is accepted (D-R). Importing
  `valija/sdk` must not load the CLI or the MCP server modules.
- **Import must be inert:**
  - no environment read, keychain access or file I/O when the module loads
  - nothing written to stdout or stderr, ever
  - no `process.exit`, no stdin reads, no prompts
  - no timers, except the per-handle, unref'd auto-lock timer that Mode P starts
- **Semver (D-T):**
  - The SDK is `0.x`, "experimental", until 1.0. A breaking change bumps the minor version and is
    listed in the CHANGELOG.
  - Codes and DTO fields are additive only within a minor version.
  - The supported schema version is stated in `docs/sdk.md` and in every release note.
- **Native modules:** Node 22+ only. Integrators using Electron rebuild the three native modules for
  Electron's ABI, and the docs say how. Mode P and `createVault` need `argon2` but not
  `@napi-rs/keyring`. Mode K needs the keychain.

---

## 10. Decisions (resolved at Gate R, 2026-10-21)

### D-A. Unlock model. **Resolved: option 3, both modes.** *(Not the original default.)*
- **Mode K** reuses the OS-keychain session.
- **Mode P** takes a passphrase or recovery key supplied by the integrator. The key is held in process
  through an in-memory `KeychainPort` adapter and is **never** written to the OS keychain.
- **Option 4 stays rejected:** a passphrase unlock that writes the OS keychain would silently unlock
  every MCP client too.
- **Trade-offs accepted:**
  - The product's process now sees the passphrase or the recovery key, and runs Argon2.
  - A user who has no Valija install can still use a vault.
  - §11 and §15 carry the consequences.

**Refiner resolutions inside D-A** (⚑, to show Oscar again at Gate P):
- **⚑ D-A.1 — In Mode P, `lock()` and `close()` drop the in-process key only and do not clear the OS
  keychain.**
  - *Why:* the user's Valija session is a separate grant, made by the user in Valija. It may be serving
    Claude or Cursor right now. A product that never touched the keychain should not revoke it as a
    side effect.
  - *Alternative:* also run the global `LockVault`. This is safer if the product's "Lock" button is
    read as "lock everything", but it reaches beyond the product's own grant.
- **⚑ D-A.2 — Mode P auto-lock** uses `SessionGuard`'s lazy check at every call, **plus** a proactive,
  unref'd timer that drops the key at the TTL.
  - *Why:* a long-running product may sit idle for hours. The lazy check alone would keep the key in
    memory until the next call. The timer bounds how long it stays there, and being unref'd it never
    keeps the process alive.
  - *Alternative:* lazy only, matching the "no daemon" stance. The key would then outlive the TTL in
    memory.
- **⚑ D-A.3 — Mode P keeps idle activity in memory, per handle.** It never writes the shared
  `lastActivityAt`. Lineage last-seen and the device id stay shared.
  - *Why:* otherwise activity in the product would keep the OS-keychain session from auto-locking,
    which widens another surface's unlocked window (§3 fact 3).
  - *Alternative:* share the activity record, so there is "one idle clock for everything". Rejected,
    because it lets a product extend an unlock it does not hold.

### D-B. Locking and auto-lock. **Resolved: option 1 (default).**
- In Mode K, `lock()` is the global `LockVault`.
- In both modes, auto-lock uses the TTL from `VALIJA_AUTOLOCK_MINUTES` only. The SDK has no option to
  change the TTL.
- Mode P's specifics are in D-A.1–D-A.3.

### D-C. Vault and state location. **Resolved: option 1 (default).**
- The vault is found through `vaultRoot`, then `VALIJA_HOME`, then `~/.valija`.
- Device state is always the shared `VALIJA_STATE_HOME`.
- A vault relocated from the desktop app is found only through `VALIJA_HOME` or `vaultRoot`. This is
  documented.

### D-D. Creating a vault. **Resolved: option 2, `createVault`.** *(Not the original default.)*
- **Format:** the same use case (`CreateVault`), header, `DEFAULT_KDF_PARAMS`, initial schema and
  passphrase rule as `valija init`. The result is byte-for-byte the same kind of vault.
- **Refusal:** `VAULT_ALREADY_EXISTS` if a header exists at the target. Nothing is overwritten.
- **Output:** `{ vault, vaultId, recoveryKit }`, where `recoveryKit` is the exact `renderRecoveryKit`
  text. The handle is open in **Mode P**, and nothing is written to the OS keychain.
- **⚑ D-D.1 — no kit file.** The SDK writes no recovery-kit file and keeps no copy. The integrator
  **must** present the kit to the user, once, and **must not** store, log, sync or transmit it. The
  docs and the type's doc comment say this.
- **Trade-off accepted:** a third party briefly holds the raw key hex. It is mitigated only by the
  documentation (§11.4, §15).

### D-E. Where the newer-schema guard lives. **Resolved: option 3 (default).**
- Explicit refusals in `UnlockVault`, `CheckVaultUpgrade`, `SqliteVaultSessions` and `VaultStatus`.
- A fail-closed backstop in the migration runner.
- Both read one comparison helper.

### D-F. May the probe touch the file? **Resolved: option 2 (default).**
The schema probe is read-only and runs no journal pragmas, as the vault-format §11 reader contract
requires. A hot journal must still produce a clear error. The planner verifies this.

### D-G. `status`, `doctor` and `lock` on a newer vault. **Resolved: option 1 (default).**
- `status` and `doctor` report it as a non-fatal failing row.
- `lock` still drops the key.
- These live on CLI and desktop only. The SDK has no `status` (D-J).

### D-H. SDK newer than the vault. **Resolved: option 1 (default).**
- In either mode, a behind-schema vault gives `VAULT_UPGRADE_REQUIRED` unless the integrator opened
  with `allowUpgrade: true`.
- Mode K needs the session adapter's "do not auto-migrate" mode.
- Mode P passes the flag to `UnlockVault` as `upgradeConfirmed`.
- **Consequence to document:** once a vault is upgraded, every older Valija the user has installed
  refuses it until it is updated.

### D-I. CLI/MCP auto-migrate on sessions. **Resolved: option 1, unchanged (default).** Flagged as a follow-up.

### D-J. Breadth of the API. **Resolved: option 1, the five MCP operations only.** *(Not the original default.)*
- The operations are `save`, `saveHandoff`, `getContextPack`, `search` and `listProjects`, plus
  `openVault`, `createVault`, `lock()` and `close()`. There is nothing else: no edit, archive,
  `listItems`, export or `status`.
- **Trade-offs accepted:**
  - A product cannot correct or retire what it saved, except through `supersedes` on `save`, which
    MCP also has.
  - Curation is a human task in Valija's CLI and desktop.
  - A product cannot inspect lock or schema state other than through error codes.

### D-K. Pinning. **Resolved: option 2, no pinning.** *(Not the original default.)* This is consistent with D-J and with MCP.

### D-L. `allowSecrets`. **Resolved: option 1, no override (default).** `save` and `saveHandoff` refuse `POSSIBLE_SECRET` structurally, as on MCP.

### D-M. Project resolution. **Resolved: option 1, `project` is explicit and required (default).** The SDK does no detection and ignores `VALIJA_PROJECT`.

### D-N. Importers. **Resolved: option 1, out (default).**

### D-O. Error shape. **Resolved: option 1, `Promise<Result<T, ValijaError>>` (default).** The SDK never throws for expected conditions. Unexpected failures map to `STORAGE_ERROR`.

### D-P. Async everywhere. **Resolved: yes (default).** Mode P's Argon2 needs it anyway.

### D-Q. Public DTOs. **Resolved: option 1, SDK-owned plain DTOs (default).**

### D-R. Packaging. **Resolved: option 1, a `./sdk` subpath of the existing package (default).** ESM-only and Node only.

### D-S. A busy vault. **Resolved: option 1 (default).** `STORAGE_ERROR` with a "vault busy" message, and the 5 s wait documented.

### D-T. Stability promise. **Resolved: `0.x` experimental (default).** Codes and fields are additive within a minor version, and the supported schema version is stated in every release.

### D-U. Attribution. **Resolved: option 1 (default).** A `client` label is required, validated as a short slug, and stamped as `source` on every save. It is self-declared, so it is attribution, not authentication.

### D-V. Docs, examples, CLAUDE.md. **Resolved: default, plus the CLAUDE.md line.**
- `docs/sdk.md` has a runnable example, exercised by a test. There is no `examples/` folder.
- **Oscar approved one line** in CLAUDE.md's *Surface parity* section, stating that the SDK, like MCP,
  is a deliberately narrower surface outside the CLI↔desktop parity rule.
- **The implementer adds it** as a deliverable (§14). The refiner does not edit CLAUDE.md.

---

## 11. Security surfaces (must not be weakened)

1. **Mode P and `createVault` never touch the OS keychain.**
   - The SDK's composition for those paths does not construct `OsKeychain` at all.
   - **Test:** a recording fake stands in for the OS keychain adapter. After a Mode P open,
     `createVault`, saves, `lock()`, `close()` and auto-lock expiry, it records **zero** `setKey`,
     `getKey` and `deleteKey` calls.
   - **Integration test:** after a Mode P open or a `createVault`, a CLI-container `status` reports
     `locked`, and an MCP tool returns `VAULT_LOCKED`.
2. **Mode K never writes the key.** It only reads it per call, and `lock()` only deletes it, through
   `LockVault`. In neither mode does the SDK return, log, cache across calls, or persist the key.
3. **Handling secrets in process (Mode P, `createVault`):**
   - The passphrase is used for derivation only and not retained.
   - The key lives only in the handle's adapter, for the lifetime in §5.1.
   - Lock, close and expiry drop it, and byte buffers the SDK controls are zeroed.
   - **The docs say honestly** that JS strings cannot be reliably wiped, and that the product's memory,
     swap and crash dumps may contain the key while the vault is open.
4. **The recovery kit:**
   - It is returned only by `createVault`, once.
   - The SDK writes no file, logs nothing and keeps no copy.
   - The docs **require** the integrator to show it to the user and never store, log, sync or
     transmit it.
   - No other SDK DTO or error contains key hex.
5. **The unlocked window is never widened across surfaces.**
   - Mode P does not extend the OS session's idle clock (⚑ D-A.3).
   - A Mode P unlock never unlocks MCP.
   - The SDK has no option to change the TTL.
6. **The schema refusal is inert** (§6). A test checks that the bytes of `vault.db` and `vault.json`,
   and the state of both keychains, are identical before and after each refused path, in both modes.
7. **The secret check is intact.** `save` and `saveHandoff` run SECRET-WARN's detector with no
   override (D-L). Refusals never echo the matched text.
8. **No network and no telemetry.** A test asserts that the SDK's module graph does no network I/O.
   No new runtime dependency is added. The MCP surface is unchanged.
9. **The trust boundary is honest.** The docs state that:
   - The integrator's code runs with the user's privileges and receives plaintext. In Mode P it also
     receives the **passphrase or recovery key**, which is the vault's permanent master secret, since
     Valija has no re-key (§3 fact 15).
   - Users should type their Valija passphrase only into products they trust, and Mode K is the
     recommended default.
   - What the product does with the context is the integrator's responsibility.
   - `client` is self-declared.
10. **No plaintext outside the vault.** The SDK creates no cache, temp file, index or kit file.
11. **Device identity is shared** (D-C), so lineage and fork detection keep working in both modes.

---

## 12. Architecture notes

- **The SDK is a delivery adapter:** `src/delivery/sdk/`, in kind-named subfolders (facade, `dto/`,
  error mapping). It sits beside `cli/` and `mcp/`. It calls use cases only.
- **The two modes are two compositions of the same use cases.** That is the hexagonal payoff:
  - **Mode K** uses the standard container.
  - **Mode P / create** uses a container wired with:
    - an in-memory `KeychainPort` adapter, tech-named under `vault/infra/` (for example
      `InMemoryKeychain`)
    - a `DeviceIdentity` wiring that keeps activity in memory and delegates everything else to the
      file-backed adapter
    - no `OsKeychain`
  - **No use case changes for the modes.** The container needs a way to accept these adapters and the
    session mode. CLI, MCP and desktop wiring stays byte-identical in behaviour.
- **Domain and application change only for the guard:**
  - `VAULT_SCHEMA_TOO_NEW`
  - a single comparison helper
  - the refusals in `UnlockVault`, `CheckVaultUpgrade` and `VaultStatus`
- **Infra:**
  - the session-open refusal and the no-auto-migrate mode
  - the migrate backstop
  - the read-only probe (D-F)
- **The proactive Mode P timer** lives in the SDK adapter (delivery), not in the domain. The domain's
  rule stays the lazy `SessionGuard`.
- **Tests per layer:**
  - the guard in each use case and adapter
  - the in-memory keychain and activity adapters
  - the SDK facade, both modes, `createVault`, and the closed codes
  - the §11.1 keychain-isolation tests
  - the §8 concurrency suite
  - round-trips: SDK save, then CLI show and MCP `get_context`, and the reverse; and `createVault`,
    then `valija unlock` with the same passphrase, and with the recovery key
  - the packaging smoke test
  - the desktop copy and behaviour
- **Golden fixture and conformance tests are unchanged.** The schema stays v4.

---

## 13. Acceptance criteria

**Same vault (§2.2, §2.4)**
- [ ] Mode K: with the vault unlocked through the CLI, an SDK `save` / `saveHandoff` is returned by
      `valija show`, MCP `get_context` / `search_context` and the desktop, with `source` equal to the
      `client` label.
- [ ] Content saved through CLI or MCP is visible to SDK `search` and `getContextPack`. The pack is
      byte-identical to MCP `get_context`. `listProjects` matches `list_projects` without the
      workspace marker.
- [ ] The SDK resolves the vault through `vaultRoot`, then `VALIJA_HOME`, then `~/.valija`, and uses
      the shared `VALIJA_STATE_HOME`. No other file is created.
- [ ] Mode K: a locked vault gives `VAULT_LOCKED`. Auto-lock expiry drops the OS key. `lock()` locks
      the CLI as well.
- [ ] No pin, edit, archive, item-listing, export or status operation exists in the public types.

**Mode P (§2.3, §5.1)**
- [ ] `openVault({ passphrase })` and `openVault({ recoveryKey })` succeed on a valid credential, and
      give `WRONG_PASSPHRASE` otherwise. Passing both is a validation error.
- [ ] §11.1 holds: zero calls on the OS-keychain fake, CLI `status` reports locked, and MCP returns
      `VAULT_LOCKED`.
- [ ] Mode P activity never updates the shared `lastActivityAt`. An OS-keychain session still
      auto-locks on schedule while a Mode P handle is busy.
- [ ] Past the TTL, the in-process key is dropped (proactively, and on the next call), and calls give
      `VAULT_LOCKED`. `0`/`off` disables it. The timer does not keep the process alive.
- [ ] `lock()` and `close()` drop the in-process key, and later calls give `VAULT_LOCKED`. An unlocked
      OS-keychain session is unaffected.
- [ ] A detected fork is returned as a non-fatal `forkNotice` at open, and nothing is deleted or
      merged.

**`createVault` (§2.4)**
- [ ] It creates a vault that `valija unlock` opens with the same passphrase, and that
      `valija unlock --recovery-key` opens with the hex in the returned kit. The header and KDF
      parameters equal those of `valija init`.
- [ ] `recoveryKit` equals `renderRecoveryKit` output for that vault. No kit file is written anywhere.
- [ ] An existing vault at the target gives `VAULT_ALREADY_EXISTS`, and the existing files are
      untouched. A weak passphrase gives `WEAK_PASSPHRASE`, and nothing is written.
- [ ] The returned handle is in Mode P (§11.1 holds).

**Writes and safety**
- [ ] `save` / `saveHandoff` with a secret give `POSSIBLE_SECRET`. Nothing is written. No override
      exists in the public types.
- [ ] `save` rejects `type: "imported"`. `supersedes` behaves as it does on MCP.
- [ ] No public DTO or error, other than `createVault`'s `recoveryKit`, contains key hex, the
      passphrase or refused content (a serialization test).

**Newer-schema guard (§6)**
- [ ] For a vault with `schema_version = LATEST + 1`, each of the following gives
      `VAULT_SCHEMA_TOO_NEW`:
  - CLI `unlock` and every CLI content command, including `export`
  - every MCP tool
  - desktop unlock and every desktop content handler
  - `CheckVaultUpgrade`
  - SDK Mode P open
  - every SDK Mode K operation
- [ ] In each case, the bytes of `vault.db` and `vault.json` are unchanged, no `.pre-*.bak` file
      appears, and both keychains are unchanged. A present OS key is still present.
- [ ] `status` / `doctor` / desktop Diagnostics report it without being fatal. `lock` still drops the
      key.
- [ ] The migration runner refuses a newer schema (the backstop).
- [ ] The desktop shows the `en`/`es` copy, with no unlock loop and no upgrade-confirm screen.
      `catalogs.test.ts` passes.

**SDK newer than vault (D-H)**
- [ ] On a behind-schema vault, in both modes, SDK operations give `VAULT_UPGRADE_REQUIRED` and
      nothing is migrated.
- [ ] With `allowUpgrade: true`, the vault is migrated through the shared runner, with its backups.
- [ ] CLI and MCP auto-migrate behaviour is unchanged.

**Concurrency (§8)**
- [ ] All four tests in §8 pass. There is no false `VAULT_FORK_DETECTED` and no sidecar remains.

**Packaging, docs, stability (§9, D-V)**
- [ ] `import { openVault, createVault } from "valija/sdk"` resolves from a packed tarball in a clean
      consumer project. Types resolve under `moduleResolution: "nodenext"`.
- [ ] Importing the entry performs no I/O, prints nothing, starts no timer, and does not load the CLI
      or MCP modules. The `bin` still works.
- [ ] `docs/sdk.md` documents both modes, `createVault` and the kit obligations, every code, the honest
      limits (§11.3, §11.9), and the supported schema version. Its example is exercised by a test.
- [ ] README, SPEC (§1, §3, §10), `specs/delivery.md`, `specs/vault.md`, `specs/shared.md`,
      `docs/vault-format.md`, CHANGELOG, and the CLAUDE.md *Surface parity* line are updated in the
      same commit.
- [ ] No new runtime dependency, network call, MCP tool or argument, CLI command, IPC channel or
      migration.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at the root and in `desktop/`.

---

## 14. Deliverables summary (not a plan)

| Deliverable | Layer |
|---|---|
| `VAULT_SCHEMA_TOO_NEW`; a single newer-than comparison; refusals in `UnlockVault`, `CheckVaultUpgrade` and `VaultStatus` | vault domain + application |
| In-memory `KeychainPort` adapter; device-identity wiring that keeps activity in memory | vault infra |
| Session-open refusal; no-auto-migrate mode; migrate backstop; read-only probe | context/shared infra |
| `src/delivery/sdk/`: facade (two modes, `createVault`, the five operations, `lock`/`close`), DTOs, error mapping, Mode P timer; container options | delivery |
| CLI/MCP refusal text; doctor row | delivery |
| `en`/`es` copy; terminal-error handling on unlock and screens | desktop |
| `exports` map; second tsup entry plus `.d.ts`; packed-tarball smoke test | build |
| `docs/sdk.md`, README, SPEC, specs, vault-format, CHANGELOG | docs |
| **One line in `CLAUDE.md` → *Surface parity*:** "The SDK (`valija/sdk`) is, like MCP, a deliberately narrower surface outside the CLI↔desktop parity rule." Approved by Oscar at Gate R on 2026-10-21. Added by the implementer, in the same commit. | docs |

---

## 15. Biggest risk

**The vault's master secret now passes through third-party code.** Mode P and `createVault` hand the
passphrase, the derived key, or the recovery kit to a product Valija does not control. Valija has **no
passphrase change or re-key** (§3 fact 15). So a single capture by a malicious, compromised or merely
careless product compromises that vault permanently:
- a keylogged unlock dialog
- a logged kit
- a crash dump
- a "helpful" sync of the kit to the integrator's cloud

The compromise extends to every synced and backed-up copy. Worse, the SDK makes "type your Valija
passphrase into this app" look normal, which is the habit a phishing product needs.

**Mitigations (mandatory):**
- Mode P never writes the OS keychain, so a product unlock never exposes MCP (§11.1).
- The key's lifetime is bounded by lock, close and the TTL, with proactive expiry (⚑ D-A.2).
- The SDK persists nothing and logs nothing.
- The kit is returned once, with documented obligations.
- Mode K is documented as the recommended mode.
- The docs say plainly that only trusted products should receive the passphrase.
- **A passphrase-change / re-key advance is flagged as the follow-up.** Without one, the only remedy
  after a leak is a new vault.

**Runner-up: version skew becomes a visible lockout.** A global CLI, an unpublished desktop build, a
cached `npx valija mcp`, and products that pin their own SDK version will now refuse a newer schema
instead of opening it silently. Because CLI and MCP still auto-migrate (D-I), the newest surface
upgrades the vault and locks out the older ones until they are updated.
- *Mitigations:* the clear refusal (§6); D-H's opt-in; both schema numbers in `status`/`doctor`; the
  supported schema version stated in every release.

**Third:** the TypeScript 7 / tsup `.d.ts` toolchain. The planner verifies it before writing the plan.
