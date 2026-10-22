# valija/sdk — embed Valija in your product

`valija/sdk` lets a Node 22 product store its user's context in **the user's own Valija vault**:
the same `vault.json` + `vault.db`, in the same format, that the `valija` CLI, Valija Desktop and
the MCP server use. Anything your product saves shows up in those tools, and the other way round.

It is deliberately small. It does exactly what an AI tool can do over MCP — **save**, **save a
handoff**, **get a context pack**, **search**, **list projects** — plus opening, creating, locking
and closing a vault. Editing, pinning, archiving, export, import and diagnostics stay in Valija's
own CLI and desktop app, where the user curates their context.

> **Stability: `0.x`, experimental.** A breaking change bumps the minor version and is listed in
> the CHANGELOG. Within a minor version, error codes and DTO fields are only ever added.
> **This release reads and writes vault schema 4.** Every release note states the schema it
> supports.

---

## Contents

- [Install](#install)
- [Quick example](#quick-example)
- [Two ways to open a vault](#two-ways-to-open-a-vault)
- [Creating a vault, and the recovery kit](#creating-a-vault-and-the-recovery-kit)
- [Operations](#operations)
- [Errors](#errors)
- [Versions: when the vault and the SDK disagree](#versions-when-the-vault-and-the-sdk-disagree)
- [Concurrency](#concurrency)
- [What Valija guarantees, and what it cannot](#what-valija-guarantees-and-what-it-cannot)
- [Electron and native modules](#electron-and-native-modules)

---

## Install

```sh
npm install valija
```

- **Node 22 or newer, ESM only, Node only** (no browser, Deno, Bun or React Native build).
- Import from the `valija/sdk` subpath; the package has no root entry. The `valija` command is
  installed alongside but your product does not need it.
- TypeScript declarations ship with it. Use `"module": "nodenext"` and
  `"moduleResolution": "nodenext"` (or `"bundler"`) so the `exports` map resolves.
- You install the whole package, including the CLI's dependencies; importing `valija/sdk` never
  loads the CLI or the MCP server.
- It depends on three native modules: `better-sqlite3-multiple-ciphers` (SQLCipher), `argon2` and
  `@napi-rs/keyring` (see [Electron](#electron-and-native-modules)).

---

## Quick example

This exact block runs in Valija's test suite (`src/delivery/sdk/docs-example.test.ts`).

<!-- sdk-example:start -->
```ts
import assert from "node:assert/strict";
import { createVault, openVault } from "valija/sdk";

const client = "acme-notes"; // who is saving: stamped as `source` on every item

// 1. A new user without a vault: create one. It is the same format as `valija init`,
//    and it opens in process (Mode P) — nothing is written to the OS keychain.
const created = await createVault({ client, passphrase: "correct horse battery staple" });
assert.ok(created.ok, "createVault failed");
const { vault, recoveryKit } = created.value;
// Show `recoveryKit` to the user ONCE, then drop it. Never store, log, sync or send it.
assert.match(recoveryKit, /VALIJA RECOVERY KIT/);

// 2. Save context, then load it back as a context pack.
const saved = await vault.save({
  project: "acme-roadmap",
  type: "decision",
  content: "We ship offline mode first.",
  tags: ["offline"],
});
assert.ok(saved.ok);
const pack = await vault.getContextPack({ project: "acme-roadmap" });
assert.ok(pack.ok);
assert.match(pack.value.markdown, /We ship offline mode first\./);

// 3. Close the handle: Mode P forgets the key.
await vault.close();

// 4. Later, Mode K (recommended): reuse the session the user unlocked with Valija itself.
const k = await openVault({ client });
assert.ok(k.ok);
const projects = await k.value.listProjects();
if (!projects.ok && projects.error.code === "VAULT_LOCKED") {
  // Ask the user to unlock Valija (`valija unlock`, or the desktop app), then try again.
}

// 5. Or Mode P again, with the passphrase the user typed into your product.
const p = await openVault({ client, passphrase: "correct horse battery staple" });
assert.ok(p.ok);
const hits = await p.value.search({ query: "offline" });
assert.ok(hits.ok);
assert.equal(hits.value.length, 1);
await p.value.close();
```
<!-- sdk-example:end -->

Every call returns a `Result`: `{ ok: true, value }` or `{ ok: false, error: { code, message } }`.
**No call throws for an expected condition** — a locked vault, a wrong passphrase, a refused
secret are all ordinary results. Branch on `error.code`, never on `error.message`.

---

## Two ways to open a vault

`openVault` finds the vault exactly like the CLI does: `vaultRoot` if you pass one, then the
`VALIJA_HOME` environment variable, then `~/.valija`. Device-local state (this device's id, what it
last saw of the vault, idle activity) is the user's shared `VALIJA_STATE_HOME`, so your writes count
as writes **from this device** and never look like a sync conflict. A vault the user moved from the
desktop app is found only through `VALIJA_HOME` or `vaultRoot`.

`client` is required: a short slug of `[a-z0-9-]` (1–64 characters, e.g. `acme-notes`). It is
stamped as `source` on everything you save. It is self-declared — attribution, not authentication.

### Mode K — reuse the user's Valija session (recommended)

```ts
const k = await openVault({ client: "acme-notes" });
```

- Your product never sees a secret. The user unlocks with `valija unlock` or in Valija Desktop, and
  your product reads the key from the OS keychain **on each call**. It never caches or writes it.
- `openVault` only reads the vault header (`VAULT_NOT_FOUND` if there is none). It does not need
  the vault to be unlocked: being locked, auto-locked or too new shows up **per call** as
  `VAULT_LOCKED`, `VAULT_SCHEMA_TOO_NEW` and so on.
- Auto-lock is the user's: the same idle timer (`VALIJA_AUTOLOCK_MINUTES`, default 15) that guards
  the CLI and MCP. Your calls count as activity, exactly like theirs.
- `lock()` is `valija lock`: it locks the vault **on every surface** (CLI, desktop, MCP).
- `close()` just ends your handle. The vault and the user's session are unaffected.

### Mode P — the user types their passphrase into your product

```ts
const p = await openVault({ client: "acme-notes", passphrase });        // or { recoveryKey }
```

- Argon2id runs **inside your process** (64 MiB, 3 passes — about a second, off the main thread).
  The key is verified at open: `WRONG_PASSPHRASE` otherwise. A recovery key (the 64 hex characters
  from the recovery kit) is used as-is.
- The derived key lives **only in this handle, in memory**. It is never written to the OS keychain,
  so unlocking your product **never** unlocks the user's AI tools, and `valija status` still says
  `locked`.
- Auto-lock uses the same TTL (`VALIJA_AUTOLOCK_MINUTES`), but the idle clock is **this handle's
  own**: your activity never keeps the user's Valija session alive. Past the TTL the key is dropped —
  at the next call, and also by an unref'd timer even if you never call again (the timer never keeps
  your process alive). `0`/`off` disables both.
- `lock()` and `close()` drop this handle's key; `close()` also ends the handle. **Neither touches
  the user's Valija session**: if they unlocked Valija themselves, it stays unlocked.
- After the key is gone every call returns `VAULT_LOCKED`. Open a new handle with the passphrase.
- Several handles are independent, each with its own key and idle timer. A Mode P handle never
  reads the OS keychain, even when the user's own session is unlocked.
- If the open finds that the vault was changed independently on two devices, it still opens and
  sets `vault.forkNotice` (`{ generation, message }`, the wording `valija unlock` prints). Nothing
  was deleted or merged; point the user at `valija doctor`.
- Passing both `passphrase` and `recoveryKey` is `INVALID_INPUT`.

**Prefer Mode K.** Mode P hands your product the vault's master secret (see
[the limits](#what-valija-guarantees-and-what-it-cannot)).

---

## Creating a vault, and the recovery kit

```ts
const created = await createVault({ client: "acme-notes", passphrase });
// created.value → { vault, vaultId, recoveryKit }
```

- Same format, header, KDF parameters and passphrase rule (at least 8 characters,
  `WEAK_PASSPHRASE` otherwise) as `valija init`. The user can later install Valija and run
  `valija unlock` with the same passphrase.
- `VAULT_ALREADY_EXISTS` if a vault is already there; nothing is overwritten. Offer "open
  existing" instead. Two products creating a vault at the same folder at the same instant is not
  guarded against, just as two `valija init` runs are not.
- `vault` is a **Mode P** handle. Nothing is written to the OS keychain.
- `recoveryKit` is the exact text `valija init` prints. **You must show it to the user once and
  then discard it. Never store, log, sync, upload or transmit it.** It decrypts the vault without
  the passphrase, forever: Valija has no passphrase change or re-key. The SDK writes no kit file and
  keeps no copy. (The kit text names `~/.valija/vault.db` and `valija unlock --recovery-key`
  literally, even when the vault lives elsewhere.)

---

## Operations

Each content operation opens and closes its own short session, exactly like an MCP tool call.
Nothing is cached between calls, so a write from the CLI, the desktop app or MCP is visible to your
next call, and yours to theirs.

| Call | MCP equivalent | Notes |
|---|---|---|
| `save({ project, content, type?, tags?, supersedes? })` | `save_context` | `project` is required (no workspace detection; `VALIJA_PROJECT` is ignored) and created if missing. `type` is one of `decision`, `progress`, `preference`, `fact` (default), `handoff` — never `imported`. At most 10 tags. `supersedes` is the full id of one live item in the same project, which is archived; the whole call fails if it is unknown, in another project, pinned, imported or already archived. → `{ itemId, project, type, projectCreated, supersededItemId? }` |
| `saveHandoff({ project, content })` | `save_handoff` | A `handoff` item: goal, what was done, blockers, exact next step. |
| `getContextPack({ project, budgetTokens? })` | `get_context` | → `{ project, markdown }`. `markdown` is byte-identical to `get_context` for the same input. `budgetTokens` is a positive integer, default 4000. |
| `search({ query, project?, limit? })` | `search_context` | Full-text. → `[{ id, project, type, createdAt, content }]`, including imported items, excluding archived ones. `limit` is a positive integer, clamped to 100, default 20. |
| `listProjects()` | `list_projects` | → `[{ name, itemCount, lastActivityAt, description? }]`, without the "(this workspace)" marker. |
| `lock()` / `close()` | — | See the two modes above. |

**Secrets are refused.** `save` and `saveHandoff` run Valija's secret check: content that looks like
a credential (API keys, tokens, private keys, passwords, long random strings) fails with
`POSSIBLE_SECRET` — the message names the kinds and line numbers, never the matched text — and
nothing is saved. There is no override, as on MCP.

**Not in the SDK:** edit, pin and unpin, archive and unarchive, listing a project's items, export,
status, doctor, import, workspace linking and detection, relocation. Those are the user's job, in
Valija's CLI and desktop app.

**"Async" is not "non-blocking".** Every call returns a `Promise`, but SQLite runs synchronously on
your thread. A call normally takes milliseconds; on a vault another process is writing to, it can
block for up to 5 seconds (see [Concurrency](#concurrency)). Only Argon2 (Mode P open and
`createVault`) runs off the main thread. In an Electron app, call the SDK from the main process or a
worker, not from a renderer.

---

## Errors

`error` is `{ code, message }`. `code` is one of the closed list below. `message` is English for
humans, may change in any release, and never contains a key, a passphrase or refused content.

| Code | When |
|---|---|
| `VAULT_NOT_FOUND` | No vault at the resolved folder. |
| `VAULT_ALREADY_EXISTS` | `createVault` found a vault there. |
| `VAULT_LOCKED` | Mode K: the user's Valija session is locked or auto-locked. Mode P: this handle's key was dropped (lock, close, idle). |
| `WRONG_PASSPHRASE` | Mode P open: wrong passphrase, or a wrong or malformed recovery key. |
| `WEAK_PASSPHRASE` | `createVault`: shorter than 8 characters. |
| `KEYCHAIN_ERROR` | Reserved for OS-keychain failures (not produced today). |
| `STORAGE_ERROR` | The vault could not be read or written, a malformed header, or an unexpected failure. A vault held by another writer past 5 s gives this code with a "vault is busy" message; nothing was saved — retry. |
| `VAULT_UPGRADE_REQUIRED` | The vault's schema is older than this SDK's and you did not pass `allowUpgrade`. |
| `VAULT_SCHEMA_TOO_NEW` | The vault was upgraded by a newer Valija. Update the SDK. |
| `POSSIBLE_SECRET` | `save`/`saveHandoff` content looks like a credential. Nothing saved. |
| `INVALID_PROJECT_NAME`, `INVALID_ITEM_TYPE`, `INVALID_TAG`, `TOO_MANY_TAGS`, `CONTENT_EMPTY`, `CONTENT_TOO_LARGE` | Content rules (project slugs, lowercase tags, content up to 32 KB). |
| `INVALID_ITEM_ID`, `ITEM_NOT_FOUND`, `ITEM_ARCHIVED`, `ITEM_PINNED`, `ITEM_NOT_CURATABLE` | `supersedes` points at something it cannot replace. |
| `PROJECT_NOT_FOUND` | `getContextPack` / `search` named a project that does not exist. |
| `INVALID_INPUT` | The SDK's own input checks: a bad `client`, both credentials, a wrong type, a non-integer budget or limit. The message names the field, never its value. |

---

## Versions: when the vault and the SDK disagree

Every Valija surface — CLI, desktop, MCP and this SDK — refuses a vault **newer** than it
understands, and never touches it:

- **The vault is newer** (the user updated Valija, and it upgraded the vault): Mode K calls and the
  Mode P open return `VAULT_SCHEMA_TOO_NEW`. Nothing is written, migrated or locked — the user's
  newer tools keep working. Update the SDK.
- **The vault is older** than this SDK: every call returns `VAULT_UPGRADE_REQUIRED` and nothing is
  migrated — unless you opened with `allowUpgrade: true`, which upgrades the vault through Valija's
  own migration runner (with its backups). **Upgrading locks out every older Valija the user has
  installed** (CLI, desktop, MCP, other products) until they update it too, so ask the user first.
  (The CLI and MCP still upgrade silently, as they always have.)

This release supports **schema 4**.

---

## Concurrency

- The CLI, the desktop app, MCP and any number of SDK handles — in either mode, in any number of
  processes — may use one vault on one device at the same time. Each call is its own short session;
  SQLite's file locks serialize writers.
- A write that finds the vault busy **waits up to 5 seconds**. Past that it fails with
  `STORAGE_ERROR` ("The vault is busy…"). The write is rolled back completely; retry it.
- Interleaved writes from several surfaces on one device never look like a sync fork.
- No file is left behind: after a call the vault folder holds only `vault.json` and `vault.db`.
- **Several devices: strictly one at a time**, as with the rest of Valija (see
  [sync.md](sync.md)). Lock before switching devices — for a Mode P product, that means closing it.

---

## What Valija guarantees, and what it cannot

**What the SDK does:**

- It makes no network calls and sends no telemetry. It writes nothing but the vault itself: no
  cache, no temp file, no index, no kit file, no log. It never prints to stdout or stderr.
- Importing `valija/sdk` does nothing: no file access, no environment read, no timer, no output.
- Mode P and `createVault` never touch the OS keychain, so they never unlock the user's AI tools.
- Lock, close and the idle timer drop the in-process key, and the byte buffers the SDK owns are
  zeroed.

**What it cannot do — read this before choosing Mode P:**

- **Your code runs with the user's privileges and receives plaintext context.** What your product
  does with it — LLM calls, your UI, your own storage, your logs — is your responsibility, not
  Valija's.
- **In Mode P your product receives the passphrase or the recovery key: the vault's permanent master
  secret.** Valija has no passphrase change or re-key, so a passphrase that leaks from your product
  (a keylogged dialog, a logged kit, a crash dump, a "helpful" sync) compromises that vault and every
  synced or backed-up copy of it, for good. Only trusted products should ever ask for it, and users
  should type it only into products they trust. **Prefer Mode K.**
- **JavaScript cannot reliably erase a string from memory.** While a Mode P vault is open, the key
  is in your process's memory, and may end up in swap or a crash dump. Dropping it is best effort.
- `client` is self-declared: it says who claims to have saved an item, not who did.

---

## Electron and native modules

The SDK runs in Node, which in an Electron app means the **main process** (or a utility process /
worker) — never a renderer.

- `better-sqlite3-multiple-ciphers` is a classic native addon built against one Node ABI. Electron
  has its own, so rebuild it for your Electron version after installing, e.g. with
  `@electron/rebuild`:

  ```sh
  npx @electron/rebuild -f -w better-sqlite3-multiple-ciphers
  ```

  and unpack it from `asar` (`asarUnpack: ["**/node_modules/better-sqlite3-multiple-ciphers/**"]`
  with electron-builder).
- `argon2` and `@napi-rs/keyring` are N-API modules: they load in Electron without a rebuild, but
  must also stay outside `asar` (unpack them the same way).
- Mode P and `createVault` need `argon2` and never **call** the keychain. Mode K needs
  `@napi-rs/keyring` and a working OS keychain (Keychain on macOS, Credential Manager on Windows, the
  Secret Service on Linux). The keychain module is still loaded by the SDK in both modes, so it must
  be present and loadable.
- Keep these three external if you bundle your main process (they are loaded from `node_modules` at
  runtime).

