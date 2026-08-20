# GUI — desktop companion for valija · Refined Spec

**Status:** Gate R draft, **revised 2026-08-20** (third revision). The 2026-08-17 revision
recorded Oscar's answers to §7 and narrowed the advance to a read-only shell plus vault
creation. **That framing is now obsolete.** After reviewing the visual mockups
(`advances/GUI/mockups.md`), Oscar expanded the scope twice more:
1. **Full CLI parity** — `import` and `doctor`, which D-P deliberately excluded, are now **in**
   (D-P's `Decided:` line is amended below, dated).
2. **Sync surfacing and a vault-relocation wizard** — a genuinely **new capability** that no
   surface of valija has today, not even the CLI (new **D-R**).

Read §1 and §3 before anything else: the phrase "read-only shell" from the previous revision is
no longer accurate, and §3 states exactly what changed and what did not.
**Directory:** `GUI`, deliberately not a milestone number — same posture `MOBILE` held (see D-O).
**Source idea:** `advances/GUI/idea.md` (idea capture only, written while refining `M4`).
**Companion:** `advances/GUI/mockups.md` — 10 mocked screens, validated direction, not a spec.
No screen exists yet for import, diagnostics, sync status or relocation; they are being designed
separately and **planning must not block on them**.
**Inherits from:** `docs/SPEC.md` (§1–§10b), `docs/sync.md`, `advances/MOBILE/refined.md`
(the `P-n` idiom this file copies), `src/testing/__fixtures__/golden-vault/`.
**Legend:** each decision in §7 lists the options that were on the table, a **Default:** line
with its reason, and a **Decided:** line with the outcome in Oscar's terms. Decisions that this
advance's shape made irrelevant carry **Decided: not applicable to this advance** and keep their
analysis for the advance that will need it.

**What is still open at Gate R** *(everything else in §7 is recorded)*:
**D-R(a)** where the GUI remembers the vault's location across relaunches · **D-R(b)** how the
relocation actually moves the files · **D-R(c)** whether relocation is a shared `src/` use case
or GUI-only · **D-R(d)** the lock discipline the move runs under · **D-S** how much of `import`'s
selection surface the GUI exposes · **D-T** how diagnostics and sync status are presented ·
plus the two small parity gaps named in D-P's revision note (`export --json`,
`unlock --recovery-key`). Each carries a default; none is left dangling.

---

## 1. Goal

**Ship a desktop application that lets someone who never opens a terminal do everything the
`valija` CLI does for a human user — create and unlock a vault, browse, search, preview and
export a context pack, import chat history, connect AI tools, run diagnostics, and see and
change where the vault lives — without adding a single way to *curate* saved content.**

Two halves of that sentence carry the whole scope:

- **"Everything the CLI does"** is now literal (D-P, revised 2026-08-20). Every user-facing CLI
  command gets a GUI surface. The one exception is `valija mcp`, which is a server entry point
  invoked by AI tools, not a user action — the GUI neither runs nor embeds an MCP server (D-K,
  §8.11).
- **"Without curating"** is the boundary that survived every scope expansion. Nothing in this
  advance edits, pins, unpins, archives, deletes, renames, retags or merges saved context. The
  only content this advance can add to the vault is a **bulk import of an existing export file**
  through the `ImportItems` use case that already ships (D-A, D-C).

One capability here is not a window over an existing use case: **relocating the vault**. Nothing
in `src/` today can move a vault folder or remember a new location across process restarts — see
§3 fact 3 and D-R. Everything else in this advance is a delivery surface over use cases that
already exist (`ListProjects`, `ShowProject`, `SearchContext`, `GetContextPack`, `VaultStatus`,
`UnlockVault`, `LockVault`, `CreateVault`, `ImportConversations`/`ImportItems`, `installer.ts`,
`doctor.ts`, plus `renderContextPackMarkdown`).

Nothing in this advance adds an MCP tool, an argument, a prompt, a schema column, a migration, a
dependency in the crypto path, or a network call.

---

## 2. What is already decided and is *not* re-opened here

Input, not agenda. A planner who wants to change any of these is in the wrong advance.

| Source | Constraint carried into this advance |
|---|---|
| `SPEC.md` D11 | **One vault per machine**, at `~/.valija/`, overridable with `VALIJA_HOME`. No vault switcher, no multi-vault UI. |
| `SPEC.md` D6 | **Session model = OS keychain.** `unlock` derives + verifies + stores the key; `lock` removes it; every reader fetches it per call. No daemon. |
| `SPEC.md` D5, D7 | **Argon2id 64 MiB / t=3 / p=1 → 32-byte raw key**; recovery kit is the raw key + vault id + instructions. Unchanged, parameters and all. |
| `SPEC.md` §7 | **MCP surface is 5 tools + 2 prompts over stdio**, and "resist adding more". This advance adds none. |
| `SPEC.md` §9 | **No telemetry, no network calls at runtime.** Applies to the desktop app in full. |
| `SPEC.md` §10a | **`imported` items are searchable but excluded from context packs**, and are never creatable from an MCP tool. Verified in `context-pack.ts`: only `pinned`, the latest `handoff`, and the four section types reach a pack. |
| M3 §10b D-A | **Single file at rest**: rollback journal, never WAL. Any surface that opens the vault must leave `vault.db` alone as one self-consistent file. |
| M3 §10b D-B, D-C | **Lineage stamp** bumped atomically with every write; **device identity** lives under `VALIJA_STATE_HOME` (default `~/.valija-state`), deliberately outside `VALIJA_HOME`. |
| M3 §10b D-I | **Idle auto-lock**, lazy, checked at session open, `VALIJA_AUTOLOCK_MINUTES` (default 15). |
| `docs/sync.md` | **BYO-cloud, no merge, ever.** valija never talks to a sync provider; syncing means the vault folder sits inside a folder some other client replicates. Fork detection warns and touches nothing. |
| MOBILE | **No distributable mobile app.** The desktop GUI does not inherit or revive that decision; `docs/vault-format.md` remains the mobile-era artifact it is. |

**One clarification the relocation wizard forces (D-R).** D11 stays intact: there is still exactly
**one vault per machine**. Relocation *moves* that single vault; it never creates, clones or
switches between two. The wizard also does **not** change how the CLI resolves `VALIJA_HOME` —
D-R(a) adds a GUI-only memory of the location, layered *under* the env-var override, not a new
resolution rule for `src/`.

---

## 3. Three framing facts a planner must not skip past

**1. This is full CLI parity minus curation — and that is a change from the previous revision.**
The 2026-08-17 revision described the advance as "`idea.md`'s original read-only shell",
excluding `import` and `doctor` on purpose (D-P, Option 2). On **2026-08-20** Oscar was asked
directly whether the GUI should reflect *all* CLI operations, including those two, and answered
**yes, full parity**. So the sentence "the GUI is a read-only shell" is now false in two specific
ways: `import` performs a **real vault write** (a batch insert plus one lineage bump), and the
relocation wizard **moves the vault's files**. What did **not** change is D-A's core answer:
**no curation.** There is still no edit, pin/unpin, archive, delete, rename, retag or merge, and
no `save_context` equivalent. Curation remains a separate advance with its own Gate R; §7's D-B
holds its verb-set analysis. Read "not a read-only shell, but still not a curation surface" as
the one-line summary.

**2. There are now four write paths, and they are not equally dangerous.** Ranked by how much
attention the review budget should spend on each:

| Write path | What it writes | Risk class |
|---|---|---|
| **Vault relocation** (D-R) | Moves `vault.json` + `vault.db` to a new folder | **Highest — new code, no precedent anywhere in `src/`**, and it touches the one artifact this product cannot afford to corrupt. §8.12 |
| **Vault initialization** (D-M) | New vault + keychain entry + recovery kit on screen | **High — unrecoverable if mishandled.** Accepted risk, §8.2 |
| **Import** (D-P, D-S) | Items in `vault.db`, one lineage bump | Medium — but the use case already ships and is already exercised by the CLI. §8.10 |
| **Connect AI tools** (D-P) | Third-party client config JSON, **outside** `VALIJA_HOME` | Low — never opens `vault.db`, never touches the keychain. §8.9 |

A fifth, smaller one: **running diagnostics writes to the OS keychain.** `doctor.ts`'s keychain
check sets and immediately deletes a probe entry (`doctor-probe`). That is existing behaviour, not
new, but a GUI that offers a "Check my setup" button should not describe it as a purely passive
read — and on macOS the probe may itself trigger the ACL prompt D-H's spike is about.

**3. The relocation wizard is genuinely new work, and it is new work in `src/` as much as in the
GUI.** Stated plainly because the rest of this advance is a window over existing code and a
planner will assume this is too:

- **There is no `valija sync` command and nothing to "connect."** Sync (M3, `docs/sync.md`) works
  because the user points `VALIJA_HOME` at a folder their own sync client already replicates.
  valija never speaks to Dropbox, iCloud, OneDrive, Google Drive or Syncthing.
- **There is no relocation concept anywhere in `src/`.** A search for a move/relocate path finds
  only: `migrations.ts` (`copyFileSync` + `rmSync` for the pre-upgrade `.pre-NNN.bak` backup),
  `installer.ts` (`copyFileSync` for a client-config backup), `file-device-identity.ts`
  (`renameSync` for an atomic state write), and test fixtures. Nothing moves a vault folder.
  There is no `RelocateVault` use case, no `VaultRelocation` port, no "vault location" value.
- **`VALIJA_HOME` is read once, from the environment, at process start** (`resolveVaultPaths` in
  `src/shared/infra/vault-paths.ts`). That convention is fine for a CLI launched from a shell and
  **does not work at all** for an app launched from a dock or start-menu icon, which inherits no
  shell environment. So a GUI that relocates a vault needs a *new* mechanism for remembering
  where the vault went — see D-R(a), which is open with a default.
- **The sync-status half is cheap and is not new work.** It presents fields `status` and `doctor`
  already compute: `VaultStatusOutput` (`dbPath`, `vaultId`, `initialized`, `unlocked`,
  `journalMode`, `sidecars`, `autoLock.{ttlMinutes,idleForMinutes,expired}`, `generation`,
  `lastWriter`, `lastWriterIsThisDevice`) and `VaultFolderInspection` (`sidecars`,
  `conflictedCopies`, `staleBackups`, `looksLikeCloud`). Pure read, no new write path, no new
  domain concept.

A fourth fact, less about scope and more about honesty, carried from the previous revision:
**opening a vault touches bytes even when nothing is written.** A session open runs
`wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`, runs `migrate()`, and records a
device-local activity timestamp. See §5 and D-J(b).

---

## 4. User walkthrough

Written for a person who does not use a terminal (D-N). Every acceptance criterion in §9 traces
back to a step here.

### 4.1 Getting the app onto the machine (D-G: unsigned)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 0 | Download | Picks the build for their OS from the GitHub release page | `Valija-<version>-mac-arm64.dmg`, `Valija-<version>-win-x64.exe`, `Valija-<version>-linux-x86_64.AppImage`, each with a published SHA-256 |
| 1 | Open it | macOS: double-click → **blocked** | *"Valija can't be opened because Apple cannot check it for malicious software."* The docs tell them: right-click → **Open** → **Open**, or `xattr -d com.apple.quarantine /Applications/Valija.app` |
| 1' | Same, Windows | Runs the installer → **blocked** | SmartScreen: *"Windows protected your PC"* → **More info** → **Run anyway** |
| 1'' | Same, Linux | `chmod +x` the AppImage and run it | No OS-level block; a desktop-integration prompt at most |
| 2 | Alternative | Prefers not to bypass a warning | The docs' **run-from-source** path: clone, `npm install`, one documented command. Slower, no bypass, same app |

This friction is real, it is the first thing the target user meets, and §9 requires it to be
documented per OS with the literal words the OS shows.

### 4.2 First run — creating a vault (D-M)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 3 | Launch, no vault present | — | *"No vault on this machine yet."* Two choices: **Create a vault** · **I already have one** (the second explains where valija looks, and offers the relocation wizard's "point me at it" path — §4.7) |
| 4 | Create | Types a passphrase twice | The same warning the CLI prints, in the window: minimum 8 characters; *"If you lose it AND the recovery kit, your data is gone. No reset exists."* Mismatch is caught before anything is written |
| 5 | Derive | Waits | *"Creating your encrypted vault (about a second)…"* — `CreateVault`, unchanged: header written, DB initialized, key placed in the OS keychain, idle clock started. The window stays responsive; it does not appear frozen |
| 6 | **Recovery kit** | Reads a full-window panel | The exact text `renderRecoveryKit` produces — vault id, the raw key hex, what it is, what to do with it. Marked **shown once**. A **Copy key** button (with a warning that the clipboard is readable by other apps) and no automatic file write |
| 7 | Acknowledge | Ticks *"I have stored this somewhere offline"* and confirms | Only then does the panel close. It cannot be reopened; the app never persists the kit |
| 8 | Land | — | The card dashboard, vault **unlocked** (matching `CreateVault`'s behaviour), empty state: *"No context saved yet."* with two next steps that are now both reachable in-app: **Connect an AI tool** (§4.4) and **Import your chat history** (§4.5) |

`valija status` in a terminal now reports the same vault, unlocked. There is exactly one vault,
one keychain entry, one device identity — the GUI is not a second device.

### 4.3 Daily use — browse, search, export

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 9 | Launch | Opens the app; the vault is locked (they locked it, or idle auto-lock did) | An unlock panel: passphrase field, plus a secondary **"I only have my recovery key"** path (parity with `valija unlock --recovery-key` — see D-P's revision note) |
| 9' | Or not | Had already run `valija unlock` in a terminal | **No prompt.** The app shares the CLI's exact keychain entry (D-H) and is simply unlocked |
| 9'' | Or a fork | The vault was changed on another device from the same starting point | The `VAULT_FORK_DETECTED` notice `UnlockVault` already returns, in plain language, naming the vault folder — the vault still opens, **nothing is merged, nothing is deleted**, and the user is pointed at the Sync panel (§4.6) (D-I) |
| 10 | Browse | — | Project cards: name, item count, last activity — the same rows `valija projects` prints (the card-dashboard direction from `mockups.md`) |
| 11 | Open a project | Clicks a card | Its items: type, date, pinned marker, tags, content — the same content `valija show <project>` prints, in the same order (same use case). A type filter mirrors `--type`, including `imported` |
| 12 | Search | Types "sqlcipher" | Full-text hits across the vault, optionally narrowed to one project — the same rows `valija search` prints |
| 13 | Read the pack | Clicks **Context pack** | The rendered markdown for that project, unbudgeted — byte-for-byte what `valija export <project>` writes (§9 pins this) |
| 14 | Take it | Clicks **Copy** | The pack is on the clipboard, ready to paste into any chat window that is not MCP-connected |
| 14' | Or | Clicks **Export…** | A native save dialog; one file, at a path the user chose. Parity with `valija export -o <file>` — the same plaintext egress that already exists, not a new one. Whether a JSON option appears alongside markdown (`export --json`) is an open parity gap, D-P's revision note |
| 15 | Finish | Clicks **Lock**, or quits, or walks away | Locked: the key leaves the keychain. Walks away: idle auto-lock does it at the existing TTL — **the app does not extend the unlocked window by polling** |

### 4.4 Connect your AI tools (D-P, `install`)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 16 | Open it | Clicks **Connect AI tools** | One card per supported client (`CLIENTS` in `installer.ts`), each showing connected / not connected — the same check `doctor` makes today: is `mcpServers.valija` present in that client's config? |
| 17 | Connect | Clicks **Connect** on one | The existing `install` path runs: the client's config is backed up, then valija's MCP entry is merged in. *"valija added to <config path>. A backup of your previous config is at <backup path>. Restart Claude Desktop to pick it up."* |
| 18 | It fails | The client isn't installed, or its config is not valid JSON | Plain language for each failure `installer.ts` already surfaces, plus the manual block `manualInstructions()` already produces, with a copy button |

### 4.5 Import chat history (D-P revised, D-S)

The existing `ImportConversations` → `ImportItems` path, in a window. No new parsing, no new
write logic, no new format.

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 19 | Start | Clicks **Import chat history** | An explainer: this reads an export file *you* downloaded from ChatGPT or Claude; valija never contacts either service (`SPEC.md` §9) |
| 20 | Pick a file | A native open dialog, filtered to `.json` and `.zip` | The file is read entirely in the trusted process; the format is auto-detected (chatgpt / claude / generic). If detection fails, the same advice the CLI gives — choose the format yourself |
| 21 | Review | — | The conversation list: index, date, title, estimated chunks — the same rows `valija import <file> --list` prints |
| 22 | Select | Ticks conversations; picks an existing project or types a new name | A target project is **required** before anything can be imported, exactly as `-p` is in the CLI. How much of `--pick/--query/--since/--all` the UI exposes is D-S |
| 23 | Preview | Clicks **Preview** | *"Would import 312 items from 18 conversations into 'valija' (skipped 2, failed 0)."* — the CLI's `--dry-run`. **Nothing is written** |
| 24 | Import | Clicks **Import** | One vault write for the whole batch, **one lineage bump**. *"Imported 312 items from 18 conversations into 'valija'."* Per-conversation failures are listed, never swallowed. Re-running the same import updates rather than duplicating (ids are deterministic) |
| 25 | Find them | Opens the project | The new items appear with type `imported`, and in search. **They deliberately do not appear in that project's context pack** (`SPEC.md` §10a). The import result screen says so in one sentence — otherwise a user who imports 312 items, opens **Context pack**, and sees no change will conclude the import failed |

### 4.6 Check my setup — diagnostics and sync status (D-P revised, D-R, D-T)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 26 | Diagnostics | Clicks **Check my setup** | The checks `valija doctor` runs today: Node version, SQLCipher native module loads, OS keychain read/write, vault initialized/locked and where, journal + single-file-at-rest, sync folder, lineage, auto-lock, and one row per AI client. Fatal failures are distinguished from warnings, as the CLI's exit code does |
| 26' | Honesty note | — | Before running, the screen states that the keychain check **writes and immediately deletes a probe entry** in the OS keychain, and that on macOS this may raise a keychain prompt (D-H) |
| 27 | Sync & safety | Opens the **Sync** panel | Vault folder path; whether valija recognizes it as a sync folder (`looksLikeCloud`); conflicted-copy files found; leftover `.pre-NNN.bak` upgrade backups; at-rest state (no `-wal`/`-shm`/`-journal`); current generation and whether **this** device wrote it last; auto-lock TTL and idle minutes. Pure read |
| 27' | A conflict is found | — | The same guidance `docs/sync.md` gives, in plain words: valija has deleted nothing, both files open with the same passphrase, there is **no automatic merge**, pick one. The panel offers no "resolve" button — by design (D-I) |

### 4.7 Move my vault into a synced folder — the relocation wizard (D-R)

The one flow in this advance with no CLI counterpart. It exists because "put your vault in a
Dropbox folder" today means editing a shell profile, which is precisely what D-N's audience
cannot do.

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 28 | Start | Clicks **Move my vault…** in the Sync panel | Plain words: *valija does not talk to Dropbox, iCloud, OneDrive or anything else. Syncing works by your vault folder living inside a folder your own sync app already keeps up to date. This moves it there and remembers where it went.* |
| 29 | Choose | A native folder picker | The chosen folder, and whether valija recognizes it as a sync folder — **informational, never a gate**; an unrecognized folder is allowed with a note that valija cannot confirm it syncs |
| 30 | Pre-flight | — | Refusals, each stated plainly and **before anything is written**: a vault already exists at the destination (**refuse — never merge**, D-R(b)); destination missing or not writable; destination is inside the current vault folder, or is the current folder; an unresolved conflicted copy or leftover upgrade backup is sitting in the *current* folder (resolve it first — moving mid-fork is exactly when people lose data) |
| 31 | Lock first | Confirms | *"Valija will lock your vault before moving it. You'll enter your passphrase again afterwards."* The move only proceeds once the vault is verifiably at rest — no sidecar files present (D-R(d)) |
| 32 | Move | Waits | `vault.json` and `vault.db` are placed at the destination **and verified there** before anything is removed from the old folder |
| 33 | If it fails | — | The old folder is still the vault, untouched and openable; partial files at the destination are cleaned up; the remembered location is unchanged. One plain message, **never a half-moved vault** |
| 34 | Remember | — | The new location is recorded in the app's own preferences so the next launch finds it (D-R(a)). Device identity under `VALIJA_STATE_HOME` **does not move** — it stays device-local, deliberately outside the synced folder |
| 35 | Tell the terminal | Clicks **Copy** | The exact line a terminal user needs, e.g. `export VALIJA_HOME="/Users/oscar/Dropbox/valija"`, because **the CLI does not read the app's preferences** (D-R(a)). Without it, `valija status` in a terminal would report no vault on this machine |
| 36 | Confirm | Unlocks again | The Sync panel now shows the new folder, recognized as a sync folder, generation unchanged, this device as last writer |

The mirror-image flow, reachable from step 3: a user who already has a vault somewhere unusual
picks that folder instead, and the app records it without moving anything.

### 4.8 What the user deliberately cannot do here

| Not available | Why, and where it goes |
|---|---|
| Edit, pin/unpin, archive, delete, rename, retag, merge — any change to saved content | **Deferred (D-A).** A curation advance with its own Gate R; D-B (verb set) is its first question. D-C is now partially answered — see §7 |
| Save new context by hand from the GUI | Same. Saving remains an MCP-tool action from inside an AI tool, by design (`SPEC.md` §3). *Importing* an export file is not this — it is a bulk ingest of content that already exists |
| Merge or resolve a fork | **Never, by design** (`docs/sync.md`, D-I). The GUI reports a fork and touches nothing |
| Delete or re-initialize a vault | **Never** (D-M Option 2). The GUI creates and moves; it does not destroy |
| Run or embed an MCP server | `valija mcp` is a server entry point for AI tools, not a user action (D-K, §8.11) |
| Generate provider artifacts (skills, agents, rules files, `CLAUDE.md`) | **Future advance (D-D).** Its delivery shape is already decided (D-E): live over MCP, plus a copy button here — never a file the app writes |
| Anything mobile, cloud, or account-shaped | Out of scope permanently or by prior decision |

### 4.9 How the data is used afterward — which surfaces change, which do not

| Surface | Effect of this advance |
|---|---|
| The desktop app itself | **New.** The only new user-facing surface |
| MCP tools + prompts (5 + 2, stdio) | **Untouched, byte-for-byte.** The GUI is not an MCP client and does not proxy tools |
| The `valija` CLI | **Untouched in behaviour.** Every command keeps working. If D-R(c) lands on a shared use case, a `relocate` CLI command may follow in a later advance — it is **not** shipped here |
| The vault file, schema, crypto, `vault.json`, KDF parameters | **Untouched in content and format.** No migration is authored here. The relocation wizard changes only *where those files live*, never a byte inside them |
| The lineage stamp | **Bumped exactly once per import batch**, and by nothing else the GUI does. Browsing, searching, exporting, connecting tools, diagnostics and relocation never bump it |
| Imported items | Visible in the project item list (type `imported`) and in **search**; **excluded from every context pack** and from every MCP tool response that returns a pack (`SPEC.md` §10a). This asymmetry is a product fact the GUI must state, not hide |
| The OS keychain | **Shared, not extended** (D-H): same service, same entry as the CLI. GUI init and GUI unlock write the same entry the CLI writes. Relocation *deletes* it (that is what locking is) and the user re-unlocks. Diagnostics writes and deletes a probe entry |
| `VALIJA_STATE_HOME` device identity | **Reused, not duplicated, and never relocated.** The GUI is the same device as the CLI on that machine (D-I) |
| A new app-preferences file (D-R(a)) | **New, and GUI-only.** Holds where the vault is and the theme override (D-Q) — **never vault content, never key material** |
| The clipboard | **New affordance** — pack copy, plus the `export VALIJA_HOME=…` line and the manual install block. User-initiated only, never automatic; named in the docs (§8.7) |
| Third-party AI client configs | Written by the existing `install` path only, with its existing backup discipline (D-P) |
| A file the user names in a save dialog | Parity with `valija export -o`; the only *content* file the app writes outside the vault |
| The published npm package | **Untouched in content.** `files` is `["dist","README.md","LICENSE"]`; desktop artifacts ship as GitHub release downloads, not inside the tarball |
| `docs/SPEC.md` §1's "one binary surface", §2's "GUI … → later", §10a's "import is CLI-only" | **All three corrected** (D-O). Each becomes false the day this ships |

---

## 5. Architecture expectations

Stated as boundary requirements, not a file layout. Two groups: what binds **this** advance, and
what is written down now but stays dormant until curation ships.

### 5.1 Binding on this advance

- **The GUI is a delivery adapter — with exactly one exception.** It introduces no domain concept,
  entity, value object or use case, *except* for vault relocation (D-R), which has no existing
  implementation to adapt. If the planner finds itself writing domain logic for anything other
  than relocation, that is the signal that something outside D-A's scope crept in.
- **Existing use cases are called, never reimplemented.** Import goes through
  `ImportConversations` → `ImportItems`; connect goes through `installer.ts`; diagnostics runs the
  checks `doctor.ts` already defines; status reads `VaultStatus` + `FileVaultFolder.inspect()`.
  No second parser, no second config writer, no second check list. (This is D-C's binding half:
  a write path only one adapter can reach is the first crack in the architecture.)
- **Rendering is not re-implemented.** The pack markdown comes from
  `delivery/context-pack-markdown.ts`, called in the trusted process. The renderer displays a
  string it was given. This is what makes "byte-identical to `valija export`" a structural
  property rather than a test that will rot.
- **Relocation is a first-class operation with ports, not a pile of `fs` calls in an IPC
  handler.** Whatever D-R(c) decides, the move must be expressible and testable without a window:
  a pre-flight that returns a typed refusal (`Result`, per repo convention), a move step, a
  verification step, and a rollback. Filesystem access sits behind an adapter so failure modes
  (cross-filesystem copy, permission denied, disk full, partial write) can be simulated in tests.
- **Process boundary is a security boundary.** The Electron main process (Node, trusted) owns the
  container and every vault interaction. The renderer runs with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, and reaches the main process only through a
  preload-exposed API with **one method per use case** — an enumerated, closed list, validated at
  the boundary with the same zod discipline the MCP server uses. No generic "run this query"
  channel, no module name.
- **Filesystem paths originate in the main process, never in the renderer.** Import needs a file
  path, export needs a save path, relocation needs a folder path. In all three the **main process
  opens the native dialog and keeps the result**; the renderer asks for "the import the user just
  chose", it does not hand over a string. A renderer-supplied path is an arbitrary-path IPC
  channel by another name (§8.6).
- **Sessions are per action, never long-lived.** Use the existing `VaultSessions.withSession`
  shape: open, read, close. A GUI that holds a `Database` handle open while the user reads keeps a
  lock against the MCP server and defeats M3's single-file-at-rest guarantee.
- **One lineage bump per user-visible action.** An import of 18 conversations is one
  `session.write` and one generation bump — which is what `ImportItems` already does. Do not
  chunk it into per-conversation writes for a nicer progress bar; a sync-folder user's generation
  counter becomes noise and fork classification gets harder to reason about.
- **Concurrency with a live MCP server is now real** (D-J(a)). Import can contend with an MCP
  `save_context` on the same SQLite file, and relocation can move files out from under a process
  that has the database open. Note for the planner: `openVaultDb` constructs
  `new SqliteDatabase(dbPath)` with **no options**, so whatever busy timeout the library defaults
  to applies implicitly; there is no explicit timeout, retry or advisory lock anywhere in `src/`.
  D-J(a)'s answer must be explicit rather than inherited from a library default.
- **No background polling.** State refreshes on user action and on window focus, not on a timer.
  A precision worth recording, because it changes *why*: browse/search/pack reads go through
  `SessionGuard`, which **records device activity** and therefore resets the idle auto-lock clock;
  `VaultStatus` does **not** go through the guard and does not extend the window. So the rule
  stands for both, but polling browse data would silently disable auto-lock (M3 D-I), while
  polling status would merely show a liveness the product does not have.
- **Secrets do not cross the IPC boundary.** The passphrase travels renderer → main once, and is
  not retained. The session key never travels main → renderer. Two exceptions, both by definition:
  the recovery kit at init (D-M) and a recovery key the user *types in* to unlock. Each crosses
  once, is never persisted, never logged, and cannot be re-requested.
- **Fork detection is surfaced, never resolved** (D-I). `UnlockVault` already returns a fork
  notice; the GUI displays it and offers no merge, no "keep this one", no automatic deletion of a
  conflicted copy. The relocation wizard must refuse to run while a fork is unresolved.
- **The GUI is the same device as the CLI** (D-I): it resolves `VALIJA_STATE_HOME` exactly as the
  CLI does and never mints a second device id. With import now writing to the vault, a second
  device id would make an ordinary CLI-write-then-GUI-write sequence classify as a **fork** — a
  false alarm on the product's loudest error.
- **The shell must be testable without a window.** Whatever holds view state and calls use cases
  is plain TypeScript, unit-tested headlessly. Packaging is the part that cannot be unit-tested,
  so keep it thin and keep logic out of it.
- **Repo conventions apply** to whatever tree this lands in (D-L): `domain/application/infra`
  where relevant, no bare files at a layer root, kind-named subfolders, tests per layer.

### 5.2 Written now, dormant until curation ships (do not implement here)

- **Every content mutation goes through `session.write(...)`**, so the lineage bump is atomic with
  the mutation. A curation UI must never reach a repository directly. (Import already obeys this
  through `ImportItems`; the note stands for the verbs that do not exist yet.)
- **The curation verb set** (D-B) — pin/archive first, edit later, delete last — is unanswered and
  is the curation advance's first question.
- **Undo, bulk selection, and multi-item gestures** raise the same "one bump per action" question
  at a larger scale; none of it is designed here.

---

## 6. Scope

### In

1. **An Electron desktop application** (D-F) whose main process composes the existing container
   and whose renderer is a UI, packaged for **macOS, Windows and Linux, unsigned** (D-G), with a
   documented run-from-source path.
2. **Vault initialization** (D-M): passphrase entry with confirmation, Argon2id derivation via the
   existing `CreateVault`, one-time recovery-kit display with explicit acknowledgement.
3. **Unlock / lock / status**, sharing the CLI's exact keychain entry (D-H), honouring idle
   auto-lock unchanged, surfacing the fork notice `UnlockVault` already returns, and offering a
   recovery-key unlock path (parity gap named in D-P's revision note).
4. **Browse**: project dashboard (parity with `valija projects`), project item view with type
   filter (parity with `valija show [--type]`).
5. **Search**: full-text, optional project narrowing (parity with `valija search [-p]`).
6. **Context pack view**: rendered markdown, unbudgeted, identical to `valija export`.
7. **Copy to clipboard** and **Export…** to a user-chosen file (parity with `valija export -o`;
   `--json` parity is an open sub-question).
8. **Connect your AI tools** (D-P): a guided step wrapping the existing `install` use case,
   reusing `installer.ts`'s backup-and-merge discipline unchanged.
9. **Import chat history** (D-P revised, D-S): a guided wrapper over the existing
   `ImportConversations` → `ImportItems` path — file picker, format auto-detection, conversation
   listing, target project, dry-run preview, import, per-conversation failure reporting, and an
   explicit statement that imported items do not enter context packs.
10. **Diagnostics** (D-P revised, D-T): the checks `doctor.ts` already runs, presented for D-N's
    audience, with the keychain-probe side effect disclosed.
11. **Sync status** (D-R): a read-only panel over `VaultStatusOutput` + `VaultFolderInspection` —
    recognized sync folder, conflicted copies, stale upgrade backups, at-rest state, generation
    and last writer, auto-lock TTL and idle.
12. **Vault relocation wizard** (D-R): pick a destination, pre-flight and refuse unsafe moves,
    lock, move `vault.json` + `vault.db` with verify-before-delete, remember the new location
    across relaunches, and show the `VALIJA_HOME` line the CLI still needs. Plus the
    "point me at an existing vault" variant, which records a location without moving anything.
13. **A confirmation screen for schema migration** (D-J-b): shown only when a vault's schema is
    behind, naming the ciphertext backup migrations 002/003 take, before the shared `migrate()`
    path runs. A current-schema vault never sees it.
14. **Light/dark theme** (D-Q): follows the OS setting by default, with a manual override
    persisted once set — sharing whatever preferences mechanism D-R(a) establishes. The
    recovery-kit screen is exempt and stays permanently high-contrast dark.
15. **Docs**: a GUI page covering install per OS (including the literal Gatekeeper/SmartScreen text
    and the bypass), first run, the recovery-kit ritual, import, connecting tools, diagnostics,
    the relocation wizard and its `VALIJA_HOME` consequence for terminal users, and what the GUI
    deliberately does not do; plus the `docs/SPEC.md` corrections D-O requires.
16. **A recorded answer to the macOS keychain-ACL question** (D-H's mandatory spike) — whether a
    second binary reading the CLI's keychain entry prompts, succeeds silently, or fails, on a
    named macOS version.

### Out — explicit non-goals

- **All curation**: no edit, pin/unpin, archive, delete, rename, retag, merge, bulk mutation, or
  undo. No `save_context` equivalent. → future advance (D-A, D-B).
- **No fork resolution, no merge, no automatic deletion of a conflicted copy.** Detect and report
  only (D-I, `docs/sync.md`).
- **No vault destruction or re-initialization** (D-M Option 2).
- **No `valija mcp` equivalent**: the GUI does not run, embed or supervise an MCP server (D-K).
- **Provider artifacts** — skills, agents, rules files, generated `CLAUDE.md` — and any
  materialization of them. → future advance (D-D), whose delivery shape D-E already fixes.
- **No MCP change of any kind**: no tool, argument, prompt, resource, or transport (D-K).
- **No schema change, no migration authored here, no format change, no crypto or KDF change, no
  `vault.json` field.** Swapping a crypto or keychain library for packaging convenience is
  explicitly forbidden (§8.1).
- **No sync-provider integration.** valija still makes no network call and still speaks to no
  sync service. The relocation wizard moves a folder; it does not authenticate, upload, watch, or
  wait for anything (§8.5).
- **No new importer, parser or format** — the GUI imports exactly what `valija import` imports
  today (chatgpt / claude / generic).
- **No multi-vault, no vault switcher, no remote vault, no cloud, no accounts, no pairing.** The
  relocation wizard moves the single vault; it never yields two.
- **No auto-update, no telemetry, no crash reporting, no analytics, no remote content, no network
  call at all** — including fonts, icons, and update feeds.
- **No code signing, no notarization, no store distribution, no Apple Developer account** (D-G).
- **No localization.** English only this advance; the non-technical-first audience (D-N) makes a
  Spanish UI a reasonable follow-up, not a requirement here.
- **No mobile anything.**

---

## 7. Decisions

Each entry: the options that were on the table, the **Default:** with its reason, and the
**Decided:** line. Entries marked *not applicable to this advance* keep their analysis for the
advance that will need it. Entries marked **Open — Gate R** are awaiting Oscar's answer and carry
a default that applies if he does not object.

### D-A. What the GUI actually is

- **Option 1 — a viewer only**: projects, items, search, pack preview, copy. Smallest possible
  surface; ships nothing the CLI cannot do, only in a window.
- **Option 2 — the operations that already exist, as a first-class shell**: Option 1 plus the
  existing vault operations (unlock/lock/status), i.e. everything `valija` does read-side, with
  no new verbs invented.
- **Option 3 — shell + curation together**: Option 2 plus edit, pin/unpin, archive, delete,
  rename. *Trade-off:* this is the only option that fulfils "administer and refine your context",
  but it introduces the product's first non-MCP content-write path and drags D-B, D-C, D-I and
  D-J into scope with it.
- **Default: Option 3.** Reason: a window that can only look at things does not answer the need
  that produced the idea, and the domain already has the repositories a curation layer would need.
- **Decided: Option 2**, overriding the recommended Option 3. Oscar, relayed: *"GUI but with the
  operations that [already] exist"*, and confirmed in a follow-up after "curar" was spelled out
  concretely as edit/pin/archive/delete/rename — he wants to start with **only what exists
  today**. **Curation is not bundled here**; it becomes its own advance with its own Gate R. The
  Default text above is retained deliberately: it is the argument that was considered and
  declined, and a future reader should see that the narrow scope was chosen, not overlooked.
  **Note, 2026-08-20:** D-P's later revision to full CLI parity expanded *which existing
  operations* ship, and brought `import` — a genuine vault write — with it. It did **not** reopen
  this decision: "only what exists today" still holds, and no curation verb ships.

### D-B. The curation verb set

- **Option 1 — pin/unpin + archive only.** The two verbs the schema already models (`pinned`,
  `archived`) with no new state and no destruction.
- **Option 2 — Option 1 + edit content and tags.** Editing raises the "is this the same item?"
  question: `updatedAt` moves, FTS reindexes, and an item an AI wrote is now partly human.
- **Option 3 — Option 2 + hard delete and project rename.** Rename is a slug change with
  referential consequences; hard delete is the only irreversible verb in the product.
- **Default: Option 1 for the first curation pass**, because it is the only set with no new domain
  semantics, then Option 2 behind an explicit confirmation.
- **Decided: not applicable to this advance.** D-A declined curation, and D-P's parity revision
  did not change that. This analysis is the starting point for the curation advance, where it is
  the first question to answer — not a settled decision.

### D-C. Where the write paths live *(reactivated 2026-08-20)*

- **Option 1 — new use cases in `context/application/use-cases/`** (`PinItem`, `ArchiveItem`, …),
  reused by CLI and GUI alike. Consistent with the existing architecture; forces the CLI to grow
  matching commands or to knowingly lag.
- **Option 2 — GUI-only application services** in the desktop tree. Faster, and immediately
  creates a second-class path the CLI cannot reach and the MCP server cannot audit.
- **Option 3 — one generic `UpdateItem` use case** taking a patch. Fewer classes, weaker
  invariants, harder to review.
- **Default: Option 1.** Reason: the repo's whole shape (`SPEC.md` §10) is "entry points are thin
  adapters over shared use cases", and a write path that only one adapter can reach is the first
  crack in that.
- **Decided: partially applicable, as of 2026-08-20.** The previous revision recorded this as *not
  applicable* on the grounds that no write path was in scope beyond `CreateVault`. D-P's parity
  revision made that false: **`import` is a real vault write**, and the relocation wizard writes
  files. Two halves now bind:
  1. **For import: Option 1, already satisfied.** `ImportConversations` and `ImportItems` exist,
    are shared with the CLI, and are the *only* way the GUI may write imported items. The GUI must
    not build a parallel importer, a parallel chunker, or a direct repository write. This is an
    acceptance criterion (§9), not a preference.
  2. **For relocation: genuinely open**, because there is no existing use case to reuse — the
    Option 1 vs Option 2 question has to be answered from scratch. That is **D-R(c)**.
  The curation verbs remain out of scope, and Options 2 and 3 above are retained for that advance.

### D-D. Skills / agents / provider artifacts in scope?

- **Option 1 — in this advance**, alongside the shell.
- **Option 2 — a separate advance with its own Gate R.**
- **Default: Option 2.** Reason: artifact generation is a new *product concept*, not a new window.
  It needs its own domain thinking (what an artifact is, where it comes from, how it stays in sync
  with the vault) and bundling it here would make one advance carry two unrelated risks.
- **Decided: Option 2**, matching the recommended default. Not in this advance; a separate advance
  with its own Gate R.

### D-E. How provider artifacts reach a provider (decided now, for that future advance)

- **Option 1 — the GUI shows the artifact and offers copy-to-clipboard.** No file written by
  valija; the user pastes wherever they want. *Trade-off:* manual, and nothing stays in sync.
- **Option 2 — an explicit per-target write** ("write this to `.cursor/rules/…`"). *Trade-off:* a
  brand-new plaintext egress path — valija writing decrypted vault content into a location it does
  not own — which would require amending `docs/SPEC.md` §9's security model.
- **Option 3 — continuous sync** (watch the vault, keep target files current). Same egress as
  Option 2 plus a daemon, which M3 deliberately refused.
- **Option 4 — expose artifacts live over MCP**, so an MCP-capable client reads them at call time
  and nothing is ever written to disk.
- **Default: Option 2**, as the shape most users expect from a "rules file" feature.
- **Decided: Option 4 + the copy affordance from Option 1**, rejecting file writing entirely.
  Oscar: *"Por MCP principalmente pero pudiendo a través de la GUI copiar y pegar el contenido de
  forma fácil."* Consequences a planner must carry forward:
  1. **No new plaintext-file egress path, ever, under this decision.** The `docs/SPEC.md` §9
     amendment Options 2 and 3 would have required is **moot**.
  2. **This reopens D-K — in that future advance, not this one.** Exposing artifacts "live over
     MCP" means new MCP surface (a tool, or a resource) against `SPEC.md` §7's standing "5 tools —
     resist adding more". D-K's *"nothing changes"* below is true for **this** advance only, and
     the artifacts advance must answer the MCP-surface question from scratch.
  3. The copy affordance is the same mechanism this advance already ships for packs (§4.3 step
     14), so nothing new is needed here to keep that door open.

### D-F. Framework

- **Option 1 — Electron.** Runs Node, so the app reuses the **actual** `src/` use cases,
  `better-sqlite3-multiple-ciphers`, `argon2`, and `@napi-rs/keyring` unchanged — zero
  reimplementation, and byte-identical rendering by construction. *Trade-off:* a large bundle, and
  three native modules that must be rebuilt against Electron's ABI and packaged per OS/arch (the
  real cost — see §11).
- **Option 2 — Tauri.** Much smaller binaries, Rust host. *Trade-off:* the vault logic is
  TypeScript; Tauri means either a bundled Node sidecar (most of Electron's cost without its
  integration) or a Rust reimplementation of crypto/session/render logic — exactly the
  second-implementation drift risk the mobile work spent an advance measuring.
- **Option 3 — Compose Multiplatform / KMP**, per `idea.md`'s original guess. *Trade-off:*
  `idea.md` assumed the desktop GUI would ride on a shipping mobile app; that app was cancelled,
  so this option now means standing up a whole Kotlin toolchain plus a second implementation of
  the domain, for a desktop-only deliverable.
- **Option 4 — a native app per OS.** Best integration, three times the work, three chances to
  diverge.
- **Default: Option 1 (Electron).** Reason: the one property worth more than binary size here is
  that the GUI cannot drift from the CLI, because it *is* the CLI's code with a window on it.
- **Decided: Option 1 (Electron)**, matching the recommended default. The planner must verify
  Electron-ABI availability (prebuilds or `electron-rebuild`) for all three native modules on
  every target before committing to a matrix, and must **not** substitute a pure-JS or alternative
  crypto/keychain library to make packaging easier (§8.1).

### D-G. Signing and distribution

- **Option 1 — signed and notarized** (Apple Developer Program ~99 USD/yr, a Windows OV/EV
  certificate). Clean first launch. *Trade-off:* recurring cost Oscar already declined for mobile,
  for an unmonetized project.
- **Option 2 — unsigned artifacts + a documented run-from-source path**, with published checksums
  and per-OS first-launch instructions.
- **Option 3 — source only.** No artifacts at all; honest, and excludes the exact audience the GUI
  exists for.
- **Default: Option 2.** Reason: it is the only option that both costs nothing and produces
  something a non-technical user can actually double-click, provided the friction is documented
  rather than discovered.
- **Decided: Option 2**, matching the recommended default. Unsigned artifacts, run-from-source
  documented, first-launch friction written down per OS in the words the OS actually uses. The
  security cost of teaching a bypass is acknowledged in §8.13, not hidden.

### D-H. Session model

- **Option 1 — share the CLI's exact keychain entry** (service `valija`, account = vault id).
  Unlock in the terminal, the GUI is unlocked; lock in the GUI, MCP tools lock. One session, one
  mental model. *Trade-off:* **macOS keychain items carry an ACL tied to the creating
  application**, so a second binary reading an entry the CLI created may prompt the user ("Valija
  wants to use your confidential information"), or fail outright, depending on how
  `@napi-rs/keyring` creates the item.
- **Option 2 — a separate GUI keychain entry.** Avoids the ACL question and creates two
  independent session states, which is a worse product and a worse security story (two places a
  key can be left behind).
- **Option 3 — no keychain in the GUI**: hold the key in memory only, per app run. Tightest
  window, but the GUI could no longer unlock *for* the MCP server, which is most of the point.
- **Default: Option 1, with a mandatory macOS ACL spike before the plan is finalized.**
- **Decided: Option 1**, matching the recommended default. **The macOS ACL spike stays
  mandatory**: the plan must establish, on a named macOS version, whether the GUI reading the
  CLI's entry is silent, prompts once, prompts every time, or fails — and the answer must reach
  the docs (§6 In, item 16). If it prompts every time, that is a product fact the first-run docs
  must state, not a bug to paper over with a second entry.
  **Added 2026-08-20:** the spike should also cover the **diagnostics probe** — `doctor.ts`'s
  keychain check writes and deletes an entry (`doctor-probe`) that the *GUI* would now be creating,
  which is a different ACL situation from reading the CLI's entry and may prompt independently.

### D-I. Device identity and lineage *(reactivated 2026-08-20)*

- **Option 1 — the GUI is the same device as the CLI**: same `VALIJA_STATE_HOME`, same device id,
  so its writes are ordinary fast-forwards.
- **Option 2 — the GUI mints its own device id.** Every GUI write on the same machine would then
  look like a second device to `classifyLineage`, and a CLI write plus a GUI write between syncs
  would be classified as a **fork** — a false alarm on the product's loudest error.
- **Default: Option 1**, unambiguously.
- **Decided: Option 1, and now fully binding on this advance.** The previous revision recorded
  this as *not applicable to this advance's acceptance criteria*, on the grounds that a shell
  performing no domain write can never contribute a write to classify. **That premise no longer
  holds:** `import` writes to `vault.db` and bumps the lineage stamp (D-P revised), and the
  relocation wizard moves the very file the lineage lives in. So all of it binds:
  1. The GUI resolves `VALIJA_STATE_HOME` exactly as the CLI does and **never mints a second
     device id** — otherwise `valija import` in a terminal followed by an import in the window is
     a self-inflicted fork on one machine.
  2. **Fork detection is surfaced, never resolved.** The GUI displays the `VAULT_FORK_DETECTED`
     notice `UnlockVault` already returns, in plain language for D-N's audience, and offers no
     merge, no "pick a winner", and no deletion of a conflicted copy.
  3. **Relocation must refuse to run on an unresolved fork.** Moving a vault folder that contains a
     conflicted copy is the single easiest way for a user to lose the copy they wanted.
  4. `VALIJA_STATE_HOME` is **never moved, copied or relocated** by the wizard, and never placed
     inside the destination folder — that is the whole point of it being device-local (M3 D-C).

### D-J. Concurrency

**(a) Write-lock contention.** *(reactivated 2026-08-20.)* With an MCP server and a GUI both live,
two processes may write the same SQLite file. The GUI can now do this: an import is a real write,
and a relocation moves the file itself.
- **Option 1 — an explicit busy timeout with a bounded retry.** SQLCipher/SQLite already
  serializes writers; a benign race resolves itself. *Trade-off:* a long import holding a write
  transaction can make an MCP `save_context` wait, and the AI tool on the other side sees latency
  with no explanation.
- **Option 2 — refuse and tell the user.** Explicit, never surprising, and a scary-looking error
  for what is usually a one-second overlap.
- **Option 3 — a single-writer advisory lock** (a lock file in the vault folder). Strongest
  guarantee, but it puts a **new file in the vault folder** — which is exactly what M3 D-A's
  single-file-at-rest rule and every sync-client interaction were designed to avoid, and a stale
  lock file after a crash becomes its own support problem.
- **Default: Option 1 for import** (explicit timeout, bounded retry, plain-language message if it
  still fails), **and a stricter posture for relocation**: relocation is not a database write, it
  is a file move, so it does not contend on SQLite locks at all — it is guarded instead by D-R(d)'s
  lock-and-verify-at-rest discipline. Reason: making the implicit library default explicit costs
  almost nothing and removes the "what timeout are we actually running with?" question; Option 3's
  lock file is a bigger change to the at-rest contract than the problem justifies.
- **Open — Gate R.** *Note for the planner:* `openVaultDb` currently passes **no options** to
  `new SqliteDatabase(...)`, so today's behaviour is whatever the library defaults to. Whichever
  option is chosen, the value must be stated in code, not inherited.

**(b) What a read session does to the file.** Today `SqliteVaultSessions.open()` runs
`wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`, and calls `migrate(db, path)`. So a GUI
opening a vault whose schema is behind will **run migrations** — including the transactional table
rebuilds of migrations 002/003, which take a ciphertext backup on a populated vault.
- **Option 1 — reuse the existing session path unchanged**: the GUI behaves exactly like any CLI
  command, migrations included. One code path, zero divergence. *Trade-off:* the most invasive
  operation in the product can be triggered by double-clicking an app icon.
- **Option 2 — pre-flight the schema version and refuse to migrate**, telling the user to run a
  CLI command first (the posture mobile took, permanently). Strongest guarantee. *Trade-off:* it
  dead-ends a non-technical user (D-N) at a terminal instruction, in an app that exists precisely
  so they never need one.
- **Option 3 — migrate, but only after an explicit "upgrade this vault" confirmation** in the GUI,
  with the backup behaviour explained.
- **Default: Option 1**, on the grounds that D-N's audience has no terminal and divergence between
  surfaces is the failure mode this architecture is built to avoid. Option 3 is the honest
  compromise if Gate R wants the user to consent to the upgrade.
- **Decided: Option 3**, overriding the recommended Option 1. The GUI pre-flights the schema
  version and shows an explicit "this will update your vault" screen — naming the ciphertext backup
  migrations 002/003 take on a populated vault — before calling the same `migrate()` path every
  CLI command already calls. One code path, but consent-gated rather than silent, since D-N's
  non-technical audience should not have a table rebuild triggered by opening a window without
  being told. The planner must design this screen so it is unmissable but not alarming: a
  first-run vault (schema already current) never sees it at all.

### D-K. Does anything reach the MCP surface?

- **Option 1 — nothing changes.** No tool, argument, prompt, resource, or transport.
- **Option 2 — the GUI exposes something over MCP** (e.g. artifacts, per D-E).
- **Default: Option 1.**
- **Decided: Option 1**, matching the recommended default. Nothing new is exposed: no curation
  (D-A), and artifacts — including their MCP exposure — are deferred to their own advance (D-D,
  D-E). **Unchanged by the 2026-08-20 parity revision:** `import` is a CLI/GUI operation with no
  MCP counterpart by design (`SPEC.md` §10a), and the GUI still does not run, embed or supervise
  an MCP server — `valija mcp` is the only CLI command with no GUI surface. **Scoped to this
  advance only:** D-E(2) records that the artifacts advance reopens this question.

### D-L. Where the desktop code lives

- **Option 1 — a top-level `desktop/` workspace in this repo.** Imports the existing use cases
  directly, so D-F's whole rationale (no second implementation) holds with no publishing step.
  *Trade-off:* an Electron build lands in a Node CLI repo; CI grows; and `desktop/` is **not**
  covered by `.claude/hooks/guard-implementation.sh`, which gates `src/`, `package.json`,
  `tsup.config.ts`, `tsconfig*.json` — so the hook would need extending, which is a governance
  change the plan must call out rather than slip in.
- **Option 2 — inside `src/delivery/desktop/`**, treating the GUI as a third entry point beside
  `cli/` and `mcp/`, which is literally what `SPEC.md` §10 says delivery is for. Already gated by
  the hook. *Trade-off:* a renderer app (HTML/CSS/assets, its own bundler, its own tsconfig) living
  inside a tree that `tsup` builds for npm is awkward, and risks the GUI's front-end files leaking
  into the published `dist`.
- **Option 3 — a separate `valija-desktop` repo** (the `MOBILE` P-3 precedent). Clean separation.
  *Trade-off:* this package exports no library entry point (`bin` only, no `exports`), so a second
  repo would have to vendor or re-export internals — reintroducing exactly the drift risk D-F chose
  Electron to avoid — and it would need this repo's whole gate apparatus copied again.
- **Default: Option 1**, with two riders: `desktop/` is excluded from the npm `files` list (it
  already is, since `files` is an allow-list), and the plan explicitly proposes whether
  `guard-implementation.sh` should gate `desktop/` too (recommended: yes).
- **Decided: Option 1**, matching the recommended default. A top-level `desktop/` workspace in this
  repo, importing the existing `src/` use cases directly — one ritual, one CI, no publishing step
  to keep in sync. The plan must extend `.claude/hooks/guard-implementation.sh` to gate `desktop/`
  the same way it gates `src/`, `package.json`, and build config, and confirm `desktop/` stays out
  of the npm `files` allow-list. **Note, 2026-08-20:** if D-R(c) lands on a shared `RelocateVault`
  use case, part of this advance lands in `src/` as well — which is already gated, and which is a
  reason for the plan to be explicit about the split.

### D-M. Vault lifecycle in the GUI

- **Option 1 — the GUI can init, unlock, lock, and (some day) destroy a vault.**
- **Option 2 — the GUI can init, unlock and lock**, but never destroys.
- **Option 3 — terminal-only init; the GUI unlocks and locks, and shows a guided empty state
  pointing at `valija init`.** *Trade-off in the other direction:* a non-technical user cannot get
  started at all without a terminal.
- **Default: Option 3.** Reason, stated at the time and **retained verbatim because it is now an
  accepted risk rather than a rejected argument**: showing the recovery kit in a window is *a
  materially worse ritual than a terminal that prints it once*, and putting init in the GUI
  *duplicates the most security-sensitive flow in a new surface*.
- **Decided: Option 2**, overriding the recommended Option 3. **The GUI can initialize a vault**,
  including passphrase entry and recovery-kit display; it never destroys one. This is a deliberate
  security-posture acceptance by Oscar, not a default that fell through — the trade-off above is
  accepted, not disputed, and §8.2 carries it as a named surface with required mitigations. Do not
  re-litigate it in the plan; do not soften it in the docs.
  **One sub-question this raises, defaulted here:** `SPEC.md` D7 says init "write[s] a one-page
  recovery file", while the shipped CLI *prints* the kit and states it is "never stored". The GUI
  must **mirror the shipped behaviour** — display once, copy-to-clipboard, no automatic file write
  — and must not silently resolve that spec/code drift in the direction of writing a file. If Gate
  R wants a "Save kit to file…" button (a plausible ask for this audience), that is an explicit
  decision with its own security note, not an implementation detail.
  **Added 2026-08-20:** "never destroys" now also constrains the relocation wizard. Moving a vault
  is the closest this app gets to destruction, and the wizard's delete-the-source step is the only
  place the GUI removes a vault file from disk. It may do so **only after** the destination is
  verified (D-R(b)) — that ordering is what keeps this consistent with Option 2.

### D-N. Audience

- **Option 1 — non-technical-first.** `idea.md`'s framing: someone who does not open terminals.
  Vocabulary, error messages, and the empty state are written for them; lineage generations,
  journal modes, and device ids stay out of the main flow.
- **Option 2 — power-user-first.** Density, keyboard-driven, jargon allowed.
- **Option 3 — both, layered**: a simple default surface with an advanced panel.
- **Default: Option 3**, on the grounds that the same person may want both and the curation surface
  skews technical.
- **Decided: Option 1**, overriding the recommended Option 3. Non-technical-first: plain-language
  errors, no lineage/journal jargon in the main flow, and the install friction of D-G becomes the
  single most important thing the docs get right. Locale stays English-only this advance (§6 Out).
  **Note, 2026-08-20:** the first revision said the "simple vs power-user" tension *dissolved*
  under D-A. Full CLI parity brings part of it back — `doctor` is written for technical users, and
  sync status speaks in generations, device ids, journal modes and conflicted copies. That is not a
  reason to reopen D-N; it is what **D-T** exists to answer: the main flow stays plain, and the
  technical vocabulary lives in a panel a curious user opens deliberately (which Option 1's own
  text already allowed for).

### D-O. Roadmap and `docs/SPEC.md`

- **(a) Does the Out line change?** `docs/SPEC.md` §2 currently reads *"GUI, encrypted backup /
  restore → later (bumped from M3 by M3's redefinition, see §10b)"*. Under the
  specs-are-contracts rule, the advance that ships a GUI must correct it: split the two clauses,
  mark the GUI as shipped in `advances/GUI/`, leave encrypted backup/restore as "later". **Also
  §1**, which reads *"One npm package. One binary surface: `valija`."* — that becomes false the day
  a desktop app ships and needs a sentence acknowledging the companion app.
- **(b) Does the GUI get a milestone number?** Options: assign one, or stay `GUI` like `MOBILE`
  stayed `MOBILE`.
- **Default: correct §2 (and §1), assign no milestone number.** Reason: the correction is a factual
  fix a contract document requires; numbering implies a place in a roadmap sequence that nothing
  else depends on.
- **Decided: the default applies** — `docs/SPEC.md` §2's Out line and §1's "one binary surface"
  sentence are corrected as part of this advance's own deliverables, and **no milestone number is
  assigned**.
  **Added 2026-08-20 — a third correction the parity revision forces.** `docs/SPEC.md` §10a's
  deferred list says *"No new MCP tool or argument — import is CLI-only."* The MCP half stays
  true; the "CLI-only" half stops being true the day the GUI can import. The sentence must be
  corrected to say what it actually means: **import has no MCP surface**, and is available from
  the CLI and the desktop app. A fourth may be needed depending on D-R(a): if the GUI remembers a
  vault location outside `VALIJA_HOME`, D11's "one vault per machine at `~/.valija`, overridable
  with `VALIJA_HOME`" deserves a sentence naming the GUI's additional, lower-precedence memory —
  the plan should propose the wording rather than leave the contract silently incomplete.

### D-P. Which existing operations the shell actually surfaces

D-A's answer — "the operations that already exist" — is not self-evident, because the CLI has
twelve commands and they are not all the same kind of thing.

- **Option 1 — the read set plus session control**: `init` (per D-M), `unlock`, `lock`, `status`,
  `projects`, `show`, `search`, `export`. Excludes `import` (a write path that ingests files),
  `install` (mutates third-party config files), `doctor` (diagnostics written for technical
  users), and `mcp` (a server process, not a user action).
- **Option 2 — Option 1 plus `install`**, as a guided "Connect Claude Desktop / Cursor" step.
  *Strongest argument for:* it is arguably the single most valuable non-terminal operation for
  D-N's audience — a vault they cannot connect to any AI tool is a vault that stays empty.
  *Trade-off:* it writes files outside `VALIJA_HOME` (client config JSON), which is a genuine write
  path with its own failure modes (existing config, malformed JSON, missing client).
- **Option 3 — Option 2 plus `doctor`**, as a read-only "check my setup" panel. Cheap, and mostly
  reformats output the CLI already produces.
- **Option 4 — Option 1 plus `import`.** Rejected on its face *at the time*: file ingest is a bulk
  *write*, which D-A put out of scope.
- **Option 5 — full parity: every user-facing command.** Options 3 and 4 combined: `init`,
  `unlock`, `lock`, `status`, `projects`, `show`, `search`, `export`, `import`, `install`,
  `doctor`. Only `mcp` is excluded, because it is a server entry point AI tools invoke, not
  something a human does. *Trade-off:* it reintroduces a genuine vault-write path (`import`) and
  a technical-vocabulary surface (`doctor`) into an advance shaped for a non-technical audience.
- **Default: Option 1**, on the strict reading of D-A's answer, with Option 2 named as the
  strongest alternative.
- **Decided (2026-08-17): Option 2**, overriding the recommended Option 1 — the shell also
  surfaces `install`. `import` and `doctor` remain out of scope.
- **Decided (revised 2026-08-20): Option 5 — full CLI parity.** Oscar was asked directly whether
  the GUI should reflect **all** CLI operations, including the `import` and `doctor` that this
  decision had deliberately excluded, and answered **yes, full parity**. This **reverses** the
  `import`/`doctor` exclusion recorded on 2026-08-17. Everything else in the 2026-08-17 answer
  stands unchanged: `install` is in, and it must reuse `installer.ts`'s backup-and-merge discipline
  unchanged, surface its existing failure modes in plain language, and never touch `vault.db` or
  the keychain.

  **Reversal note, 2026-08-20.** The prior exclusion of `import` rested on D-A's "no writes"
  framing. That framing is now narrower and more accurate: D-A declined **curation**, not every
  write. `import` is not new domain work — `ImportConversations` and `ImportItems` ship today and
  the CLI has used them since M2 — so surfacing it adds a *screen*, not a *capability*. What it
  genuinely does add is the GUI's first path that mutates `vault.db` and bumps the lineage stamp,
  which is why D-C, D-I and D-J(a) are reactivated above rather than left dormant. `doctor` adds
  no write to the vault at all (it does write a keychain probe — §3 fact 2), only a
  technical-vocabulary surface, which is D-T's problem.

  **The parity map the planner must satisfy** — every CLI command, and where it lands:

  | CLI | GUI surface | Notes |
  |---|---|---|
  | `init` | Create-vault flow (§4.2) | D-M |
  | `unlock` | Unlock panel (§4.3 step 9) | **Parity gap:** `--recovery-key` has no screen yet. See below |
  | `lock` | Lock action (§4.3 step 15) | Also invoked by the relocation wizard (D-R(d)) |
  | `status` | Sync & safety panel (§4.6 step 27) | D-R, D-T |
  | `projects` | Card dashboard (§4.3 step 10) | |
  | `show <project> [--type]` | Project view + type filter (§4.3 step 11) | filter must include `imported` |
  | `search <query> [-p]` | Search screen (§4.3 step 12) | |
  | `export <project> [-o]` | Pack preview + Copy + Export… (§4.3 steps 13–14) | **Parity gap:** `--json`. See below |
  | `import <file> [flags]` | Import flow (§4.5) | selection surface is **D-S** |
  | `install <client>` | Connect AI tools (§4.4) | |
  | `doctor` | Diagnostics (§4.6 step 26) | presentation is **D-T** |
  | `mcp` | **Deliberately not surfaced** | server entry point, not a user action (D-K, §8.11) |

  **Two parity gaps, each with a default, open at Gate R:**
  1. **`export --json`.** *Options:* (a) markdown only, as the mockups show; (b) a format choice in
     the save dialog. **Default: (b)**, since "full parity" was the answer and the JSON payload
     already exists in `exportCommand` — omitting it would be a knowing gap, not an oversight.
     *Trade-off:* one more control on a screen whose value is its simplicity.
  2. **`unlock --recovery-key`.** *Options:* (a) passphrase only, and a user who lost their
     passphrase is told to use the CLI; (b) a secondary "I only have my recovery key" path that
     accepts the raw key hex. **Default: (b)**, because option (a) dead-ends exactly the
     non-technical user this advance exists for, at the worst possible moment. *Trade-off:* it puts
     a raw 32-byte key into a text field in a window — masked input, never persisted, never logged,
     and covered by §8.2's mitigations, which apply to it in full.

### D-Q. Light/dark theme

Raised after Oscar reviewed the visual mockups (`advances/GUI/mockups.md`) and asked whether they
covered dark mode. They didn't — no prior draft of this spec mentioned theming at all.

- **Option 1 — follow the OS setting only.** The app reads the system's light/dark preference at
  launch and has no in-app override. Simplest; zero new UI, zero new state to persist.
- **Option 2 — follow the OS setting by default, with a manual override.** Same as Option 1, plus a
  control inside the app to force light or dark regardless of the OS setting. *Trade-off:* one more
  piece of state to design, store, and keep in sync with the OS across relaunches.
- **Option 3 — light only.** No dark theme at all. *Trade-off:* out of step with every other
  desktop app the audience already uses.
- **Default: Option 1.** Reason: it is the behavior every modern desktop app already has for free
  from the OS, with no extra surface to build or maintain.
- **Decided: Option 2**, overriding the recommended Option 1. Manual override, defaulting to the OS
  setting. The mockups demonstrate this per screen with a `dark` toggle; the planner should treat
  the OS-preference read as the initial value of that same override state, not a separate
  mechanism, and persist the user's manual choice across relaunches once they've set one
  explicitly. **Exception, by design:** the recovery-kit screen (§4.2 step 6) stays permanently in
  its own high-contrast dark treatment regardless of the app's theme — that screen's darkness is a
  security-emphasis choice made in D-M/§8.2, not a theme, and this decision does not reopen it.
  **Note, 2026-08-20:** "persist the user's manual choice across relaunches" needs somewhere to
  persist it — the same problem **D-R(a)** must solve for the vault location. One preferences
  mechanism should serve both; the planner should not invent two.

### D-R. Sync: status display and the vault-relocation wizard *(new in this revision, 2026-08-20)*

Oscar asked how the GUI would let a user "connect" a sync provider. The accurate answer is that
**valija has no such command and never has** — sync (M3, `docs/sync.md`) works by the vault folder
simply *being* inside a folder the user's own sync client already replicates, configured today by
pointing `VALIJA_HOME` at it. There is nothing to connect and no provider to authenticate with.
He was offered three options and **chose both halves**.

- **Option 1 — a guided relocation wizard**: pick a folder, move the vault there, remember the new
  location for future launches. *Flagged to him explicitly as new work — not even the CLI can do
  this.*
- **Option 2 — a read-only sync-status display**: surface what `status` and `doctor` already
  detect — recognized sync folder, conflicted-copy warnings, last-writer info, current lineage
  generation. Cheap; pure read; no new domain concept.
- **Option 3 — both.**
- **Default: Option 2**, on cost: it delivers most of the user-visible value of "sync is working"
  for a fraction of the risk, and the relocation wizard is the only part of this advance that
  writes vault files with no existing code path behind it.
- **Decided: Option 3 — both.** Oscar chose the wizard *and* the status display. The status half is
  a straightforward read over `VaultStatusOutput` and `VaultFolderInspection` (§3 fact 3 lists the
  exact fields). The wizard half is new work and carries four open sub-decisions:

**D-R(a). Where the GUI remembers the vault's location across relaunches.** `resolveVaultPaths`
reads `VALIJA_HOME` from the environment once at process start. An app launched from a dock or
start-menu icon inherits no shell environment, so after a relocation the app would forget where
the vault went on the next launch. A new mechanism is required, **for the GUI**.
- **Option 1 — an OS-appropriate app-preferences file owned by the desktop app** (Electron's
  `userData` location: `~/Library/Application Support/Valija`, `%APPDATA%\Valija`,
  `~/.config/Valija`). Holds the vault location and D-Q's theme override. *Trade-off:* the CLI does
  not read it, so the GUI and a terminal can disagree about where the vault is — mitigated by §4.7
  step 35 showing the `export VALIJA_HOME=…` line.
- **Option 2 — reuse `VALIJA_STATE_HOME`** (`~/.valija-state/state.json`), which already exists,
  is already device-local, and is already deliberately outside the synced vault folder. *Trade-off:*
  that file is owned by the vault module and holds device *identity* and lineage bookkeeping;
  adding a *pointer to the vault* mixes two concerns. And if the CLI ever read it, a GUI-written
  file would start influencing CLI behaviour — a `SPEC.md` D11 change, not a GUI feature.
- **Option 3 — a new small file at a fixed path** (e.g. `~/.valija-app.json`) that **both** the GUI
  and the CLI read as a fallback under `VALIJA_HOME`. *Trade-off:* the cleanest end state — one
  answer to "where is my vault" for both surfaces — but it changes how the CLI resolves the vault
  for users who never open the GUI, which is a contract change (D11) and belongs in its own
  advance.
- **Default: Option 1**, with a mandatory precedence rule: **`VALIJA_HOME`, when set in the app's
  environment, always wins**; the remembered location is consulted only when it is not. Reason:
  Option 1 is the only one that adds the capability without changing any `src/` resolution rule or
  any CLI behaviour, and the env-var-wins rule preserves the existing escape hatch for anyone who
  already scripts around `VALIJA_HOME`. Option 3 is the right *eventual* answer and should be named
  in the docs as the direction, not built here.
- **Open — Gate R.**

**D-R(b). How the move actually happens.** Both files (`vault.json` + `vault.db`) must end up at
the destination, or nothing must change.
- **Option 1 — rename/move first** (`fs.rename`). Atomic *within one filesystem*, and the natural
  first instinct. *Trade-off:* it **fails across filesystems** (`EXDEV`) — and "into a Dropbox
  folder on another volume" is a normal case — and it offers no window in which to verify the
  destination before the source stops existing.
- **Option 2 — copy, verify, then delete the source.** Copy both files; verify the destination
  (at minimum: both files present, byte-for-byte identical by digest, and `vault.json` parses as a
  valid header); only then remove the originals. On any failure: delete whatever partial files were
  written at the destination, leave the source completely untouched, and change nothing about the
  remembered location. *Trade-off:* the vault exists in two places for a few seconds, and needs
  free space for a second copy.
- **Option 3 — copy, verify by opening the destination with the session key, then delete.**
  Strongest verification — it proves the moved vault actually decrypts — but it requires the vault
  to be *unlocked* during the move, which fights D-R(d)'s lock-first discipline.
- **Default: Option 2.** Reason: it is the only option that survives a cross-filesystem
  destination *and* never deletes the source before the destination is proven good. The
  "two copies for a few seconds" window is bounded and is strictly safer than the alternative
  failure mode, which is a vault that exists nowhere openable. **Non-negotiable regardless of the
  option chosen:** a destination that already contains a vault is **refused, never merged**
  (§8.12).
- **Open — Gate R.**

**D-R(c). Where the relocation logic lives.** This is D-C's question, asked about a write path that
has no existing use case.
- **Option 1 — a new use case in the vault module** (e.g. `RelocateVault` in
  `vault/application/use-cases/`, with a filesystem port and a tech-named adapter), called by the
  GUI now and available to a future `valija relocate` command. Consistent with `SPEC.md` §10's
  "entry points are thin adapters over shared use cases", testable without a window.
  *Trade-off:* this advance then edits `src/` — gated code — for a capability only the GUI uses
  today, and it must be designed as a general operation rather than a wizard step.
- **Option 2 — a GUI-only application service** in the `desktop/` tree. Faster, keeps `src/`
  untouched. *Trade-off:* the product's most dangerous file operation would live in its
  least-tested tree, reachable by exactly one adapter, invisible to the CLI and to `doctor` — the
  precise shape D-C Option 2 warns against, applied to the vault itself.
- **Option 3 — Option 1 plus a `valija relocate` CLI command in this advance**, so both surfaces
  ship together. *Trade-off:* real extra scope (command, flags, prompts, docs, tests) in an advance
  that is already carrying packaging risk.
- **Default: Option 1.** Reason: relocation manipulates the vault's own files and deserves the same
  architectural treatment as every other vault operation — a `Result`-returning use case behind a
  port, unit-testable with a fake filesystem, reviewable in isolation. Option 3's CLI command is a
  small follow-up once the use case exists; it is not what makes this advance's audience whole.
- **Open — Gate R.** *If Option 1 or 3 is chosen, the plan must say so at Gate P, because it means
  this advance edits `src/` and therefore falls under `guard-implementation.sh` (D-L).*

**D-R(d). What discipline the move runs under.** There is **no** advisory lock, lock file, busy
timeout or "relocate" concept anywhere in `src/` today, so this must be chosen, not inherited.
- **Option 1 — lock first, verify at rest, then move.** Run the existing `LockVault` (which already
  reports `sidecars`, i.e. whether the vault is a single self-consistent file), refuse to proceed
  if any `-wal`/`-shm`/`-journal` sidecar exists, then move. *Trade-off:* locking drops the key
  from the keychain, so the user re-enters their passphrase afterwards — and if an MCP server is
  mid-call, it gets a `VAULT_LOCKED` it did not expect.
- **Option 2 — verify at rest without locking.** Less disruptive, no re-unlock. *Trade-off:* the
  vault is unlocked, so any MCP tool call or CLI command can open the database *during* the move —
  and a database opened at a path whose files are being copied and deleted is precisely the
  corruption scenario this whole advance must avoid.
- **Option 3 — an advisory lock file in the vault folder for the duration.** *Trade-off:* puts a
  new file in the vault folder (M3 D-A), and a crash mid-move leaves a stale lock.
- **Default: Option 1.** Reason: relocation is rare, deliberate, and irreversible-looking to the
  user; paying one passphrase re-entry to guarantee nothing else has the database open is an
  obviously good trade. The wizard should state the re-unlock up front (§4.7 step 31) so it reads
  as part of the ritual rather than a surprise.
- **Open — Gate R.**

### D-S. How much of `import`'s selection surface the GUI exposes *(new in this revision, 2026-08-20)*

`valija import` takes `-p/--project`, `--from`, `--list`, `--pick`, `--query`, `--since`, `--all`
and `--dry-run`, with a deliberate list-first safety design (no selection flag ⇒ it only lists).
A window has different ergonomics: a checkbox *is* `--pick`, a filter box *is* `--query`.

- **Option 1 — literal flag parity**: a control for every flag, including `--from` and `--since`.
  Truest to "full parity". *Trade-off:* it reproduces terminal ergonomics that exist because a
  terminal cannot show a selectable list.
- **Option 2 — behavioural parity**: file picker → auto-detected format → conversation list with
  checkboxes and a text filter → required target project → **Preview** (dry-run) → **Import**. The
  format override appears **only** when auto-detection fails, mirroring the `UNSUPPORTED_SOURCE`
  error's own advice. `--since` is covered by the list being sortable by date.
- **Option 3 — minimal**: "import everything into project X", no listing, no preview. *Trade-off:*
  discards the list-first safety property M2 deliberately built, for the audience least able to
  undo a bad import (there is no undo — D-A).
- **Default: Option 2.** Reason: it preserves every *behaviour* the CLI's flags exist to provide —
  see it first, choose precisely, preview before writing — while dropping only the flag *syntax*,
  which is not a feature. Option 3 is rejected outright: with no curation verbs in this advance, a
  user who imports the wrong 400 conversations cannot remove them from the GUI at all.
- **Open — Gate R.** Whichever option is chosen, three things are non-negotiable: a target project
  is required before any write (as `-p` is today), a dry-run preview is reachable before the real
  import, and per-conversation failures are shown rather than summarized away.

### D-T. How diagnostics and sync status are presented to D-N's audience *(new in this revision, 2026-08-20)*

`doctor` and `status` are written for technical users: Node versions, native-module loading,
journal modes, lineage generations, device ids, conflicted-copy filenames. D-N chose
non-technical-first. Both are now in scope, so the tension needs an answer rather than a shrug.

- **Option 1 — verbatim**: reproduce the CLI's rows, names and details as-is. Zero divergence risk,
  trivially correct, and reads like a terminal to someone who installed a GUI to avoid one.
- **Option 2 — plain-language only**: one health verdict, human sentences, no raw detail.
  *Trade-off:* when something is actually wrong, the person helping the user (or a GitHub issue)
  needs the specifics that were just hidden.
- **Option 3 — split by audience**: a **Sync & safety** panel written in plain words for D-N (is
  my vault where I think it is, is it safe to open elsewhere, has something forked, when will it
  auto-lock), and a separate **Diagnostics** screen that shows the check rows close to verbatim,
  with a **Copy report** button for support. Each check keeps a one-line plain explanation.
- **Default: Option 3.** Reason: the two answer different questions for different moments — "is my
  setup healthy?" is a support interaction; "is my vault safe to sync right now?" is part of daily
  use. Splitting them lets the main flow stay jargon-free (D-N) without deleting the detail that
  makes a bug report actionable. **Riders:** whatever the presentation, the *checks themselves*
  come from the existing `doctor.ts` logic — the GUI must not re-derive "is the vault healthy" —
  and the keychain-probe side effect (§3 fact 2) is disclosed before the check runs.
- **Open — Gate R.**

---

## 8. Security surfaces that must not weaken

1. **Key material stays where it is.** The 32-byte key exists in the OS keychain and in
   main-process memory, and nowhere else — no renderer copy, no `localStorage`/`IndexedDB`/
   `sessionStorage`, no file, no log line, no crash dump, and **never in the app-preferences file
   D-R(a) introduces**. **No substitution of the crypto or keychain libraries** (`argon2`,
   `@napi-rs/keyring`, `better-sqlite3-multiple-ciphers`) to simplify packaging: a pure-JS Argon2id
   or an alternative keyring is a crypto/session change wearing a build-tooling disguise.
2. **Raw key material on screen — the risk Oscar accepted (D-M).** A terminal prints the recovery
   kit into a scrollback the user already controls; a GUI window is screenshot-able,
   screen-recordable, readable by accessibility and automation APIs, capturable by screen-sharing
   software the user forgot was running, and structurally invites a "save it for me" button.
   **Required mitigations, none optional:** shown exactly once; never written to disk by the app;
   not re-openable after acknowledgement; not retained in any renderer state after dismissal; an
   explicit acknowledgement before continuing; the copy action warned as putting the raw key on a
   clipboard other applications can read. **The same mitigations apply in full to the recovery-key
   *input* path** if D-P's parity gap 2 lands on option (b): masked field, never persisted, never
   logged, never echoed back, discarded as soon as `UnlockVault` returns.
3. **No plaintext at rest, anywhere new.** No cache of items or packs, no search history, no
   recently-viewed list containing content, no window-state file holding item text, no import
   staging file (the existing reader inflates archives **in memory** and writes nothing — keep it
   that way), no Electron `crashReporter` (explicitly disabled), no devtools in production builds.
   After the app quits, the only valija files on disk are the ones that existed before it started,
   plus the preferences file of §8.4.
4. **The app-preferences file (D-R(a)) holds pointers and preferences only.** A vault path and a
   theme choice. **Never** key material, never a passphrase, never vault content, never a recovery
   kit, never a cached item. It is not encrypted and must never hold anything that would need to
   be.
5. **No network, at all.** No auto-update feed, no analytics, no crash upload, no remote fonts or
   icons, no remote origin loadable by any window — and, explicitly, **no sync-provider client,
   API call, OAuth flow or upload of any kind**: the relocation wizard moves a folder on the local
   filesystem and nothing more. A Content-Security-Policy that forbids remote origins, plus denial
   of `will-navigate` and `window.open` to non-local URLs, is the enforcement — not a promise in a
   README. This is `SPEC.md` §9's "no network calls at runtime" applied to a browser engine.
6. **The IPC surface is a trust boundary and is enumerated.** One channel per use case, arguments
   validated at the boundary with zod exactly as the MCP server does; no channel that accepts SQL,
   a module name, a shell command, or an arbitrary filesystem path. **Filesystem paths never
   originate in the renderer** (§5.1): the main process opens the native dialog for import, export
   and relocation, and keeps the result. This is now load-bearing in three places rather than one.
7. **Clipboard is an egress mechanism and is documented as one.** Plaintext egress by explicit user
   action already exists (`valija export -o`), so this changes the mechanism, not the threat model
   — but a one-click copy of an entire context pack deserves a sentence in the GUI docs, and it
   must never happen automatically. The other copy affordances (the recovery key, the
   `export VALIJA_HOME=…` line, the manual install block) are named individually in the docs.
8. **Vault integrity and identity.** The GUI resolves `VALIJA_HOME` and `VALIJA_STATE_HOME` exactly
   as the CLI does, is the **same device**, never mints a second device id, never writes a lineage
   stamp except through `ImportItems`' single per-batch bump, and leaves `vault.db` as a single
   file at rest with no `-wal`/`-shm`/`-journal` sidecar (M3 D-A).
9. **Connecting AI tools writes outside the vault and must stay outside it.** The `install` path
   edits third-party client config JSON only, through `installer.ts`'s existing backup-and-merge
   discipline. It must never open `vault.db`, never read or write the keychain entry, and never
   change lock state or lineage.
10. **Import is a real vault write and gets write-path treatment.** It goes through
    `ImportItems`' single `session.write` (one transaction, one lineage bump), re-validates content
    and tags at the vault boundary as it already does, respects the existing decompression-bomb
    caps in `FileExportReader` (128 MiB per entry / 256 MiB total) rather than reimplementing
    archive handling, and reports per-conversation failures instead of swallowing them. **It must
    not become a curation back door:** no "import this one item I typed", no editing an item on
    the way in.
11. **The MCP surface is untouched** — 5 tools, 2 prompts, stdio. The GUI neither embeds nor proxies
    an MCP server, and `SPEC.md` §9's statement that any connected MCP client receives plaintext is
    unaffected by this advance. Imported items remain excluded from every pack an MCP tool returns.
12. **Relocating an encrypted vault must not weaken a single guarantee (D-R).** This is the newest
    and least-precedented surface in the advance; each of these is a hard requirement, not a
    quality bar:
    - **No stale copy at the old location after a successful move.** `vault.db` is ciphertext, so
      this is not a plaintext leak — it is worse in a different way: a leftover copy is a complete,
      openable vault whose key the user still holds, and two openable vaults with the same vault id
      is the exact fork scenario M3 spent an advance on. `vault.json`, meanwhile, **is** plaintext
      (vault id, salt, KDF parameters) and leaving it behind is a real, if smaller, residue.
    - **Verify before deleting anything.** The source is removed only after the destination is
      confirmed complete and correct (D-R(b)). Never the other order, and never "delete then copy".
    - **No partial state on failure.** A failed move leaves the vault whole and openable at exactly
      one location, removes partial destination files, and does not update the remembered location.
      There is no outcome in which the vault is split across two folders such that neither opens.
    - **Never overwrite or merge a vault at the destination.** A destination containing
      `vault.json` or `vault.db` is refused with a plain message. No "replace", no "merge", no
      backup-and-clobber.
    - **Never move while a fork is unresolved**, and never move a conflicted copy or a stale
      `.pre-NNN.bak` along with the vault (D-I).
    - **Never relocate device state.** `VALIJA_STATE_HOME` stays where it is and never lands inside
      the destination folder — device identity, last-seen lineage and activity timestamps must not
      enter a synced folder (M3 D-C).
    - **The keychain entry is keyed by vault id, which relocation does not change.** The move must
      not create, duplicate or orphan a keychain entry; the only keychain effect is the deliberate
      lock in D-R(d).
13. **Diagnostics is not a passive read.** `doctor`'s keychain check writes and deletes a probe
    entry, its SQLCipher check loads the native module, and its vault check opens the database.
    None of that is new, but the GUI must disclose the keychain probe (§4.6 step 26') and must not
    run diagnostics automatically, silently, or on a timer.
14. **Idle auto-lock may only get tighter, never looser.** No background polling, no keep-alive, no
    "stay unlocked while the window is open". The GUI honours `VALIJA_AUTOLOCK_MINUTES` identically
    to the CLI.
15. **Unsigned distribution has a security cost (D-G).** Documenting "right-click → Open" or "Run
    anyway" trains precisely the behaviour malware relies on, for an audience least equipped to
    judge when it is safe. Accepted, with published SHA-256 checksums and a run-from-source path as
    the mitigations, and stated openly in the docs rather than glossed as a quirk.
16. **Only fixture data in screenshots and docs.** Any screenshot shipped with this advance uses
    `src/testing/__fixtures__/golden-vault/`, whose passphrase and key are public by design and
    labelled as such — never a real vault, never a real key, never a real recovery kit.

---

## 9. Acceptance criteria

A reviewer should be able to check each line without guessing what was intended.

**Product invariants**

- [ ] The MCP surface is byte-for-byte unchanged: 5 tools with the same arguments, 2 prompts,
      stdio only. The GUI neither runs nor embeds an MCP server.
- [ ] No change to the schema, to any migration, to the vault format, to `vault.json`, to the
      Argon2id parameters, to the key format, or to the SQLCipher configuration.
- [ ] No change to `argon2`, `@napi-rs/keyring`, or `better-sqlite3-multiple-ciphers` as the
      libraries in the crypto/session/storage path.
- [ ] Every CLI command behaves exactly as before; `npm run typecheck && npm run lint &&
      npm run test` pass, and the existing CI matrix is neither slowed nor gated by desktop
      packaging jobs.
- [ ] The published npm package's contents are unchanged (`files` remains an allow-list that
      excludes the desktop tree).
- [ ] `docs/SPEC.md` §2's "GUI … → later" Out line, §1's "one binary surface" sentence, **and
      §10a's "import is CLI-only" sentence** are corrected; if D-R(a) lands outside `VALIJA_HOME`,
      D11 gains the sentence D-O requires. No milestone number is assigned (D-O).

**Parity (D-P, revised)**

- [ ] Every CLI command in D-P's parity map has the GUI surface that map names, and `mcp` is the
      only one deliberately absent — with that absence stated in the GUI docs.
- [ ] The two parity gaps (`export --json`, `unlock --recovery-key`) are each either implemented or
      explicitly declined in the docs. Neither is silently missing.
- [ ] The UI exposes nothing beyond that map — no verb added "while we were in there".
- [ ] No code path in the desktop app calls `SaveContext`, or any repository mutation outside
      `ImportItems`. The UI contains no edit, pin, archive, delete, rename or retag affordance,
      disabled or otherwise.

**The shell**

- [ ] With a fixed clock, the pack the GUI displays for a project is **byte-identical** to the
      stdout of `valija export <project>` for the same vault, asserted by a test that compares the
      two strings — not by eye. Under a real clock the only permitted difference is the `generated`
      timestamp in the preamble.
- [ ] The project list, item list (including the `--type` filter, `imported` included), and search
      results are produced by the **same use cases** the CLI calls, so ordering and content match by
      construction; a test exercises each against the golden-vault fixture.
- [ ] Sessions are opened per action and closed; no `Database` handle outlives a user action.
- [ ] No timer or interval refreshes vault state; refreshes are user- or focus-driven, so idle
      auto-lock is not extended by leaving the window open.
- [ ] After any GUI session, the vault folder contains `vault.json` and `vault.db` only — no
      `-wal`, `-shm`, or `-journal` sidecar.
- [ ] The GUI's behaviour when the vault's schema version is behind matches D-J(b)'s answer, and
      that behaviour is stated in the GUI docs.

**Vault initialization (D-M)**

- [ ] Init runs through the existing `CreateVault` use case, with `parsePassphrase`'s rules enforced
      (not re-implemented in the renderer) and a mismatch caught before anything is written.
- [ ] The recovery kit displayed is the exact output of `renderRecoveryKit`, shown once, never
      written to disk by the app, not re-openable after acknowledgement, and gated behind an
      explicit "I stored this offline" acknowledgement.
- [ ] The raw key hex does not appear in any log, any persisted renderer state, the app-preferences
      file, or any file written by the app.
- [ ] After GUI init, `valija status` in a terminal reports the same vault as initialized and
      unlocked; there is exactly one vault, one keychain entry, one device identity.
- [ ] The copy-key action warns that the clipboard is readable by other applications.
- [ ] Nothing in the app can destroy or re-initialize an existing vault (`VAULT_ALREADY_EXISTS` is
      surfaced in plain language, per D-N).

**Session and identity (D-H, D-I)**

- [ ] `valija unlock` in a terminal leaves the GUI unlocked with no second prompt; `valija lock`
      leaves the GUI locked; unlocking in the GUI unlocks MCP tools. One keychain entry, shared.
- [ ] The macOS keychain-ACL behaviour is recorded — silent, prompts once, prompts every time, or
      fails — with the exact macOS version, **for both reading the CLI's entry and creating the
      diagnostics probe entry**, and the answer appears in the GUI docs.
- [ ] Idle auto-lock (`VALIJA_AUTOLOCK_MINUTES`) applies to the GUI identically to the CLI.
- [ ] The GUI resolves `VALIJA_STATE_HOME` exactly as the CLI does and **mints no new device id**;
      a test proves that a CLI write followed by a GUI import on the same machine is a
      fast-forward, not a fork (D-I).
- [ ] A forked vault shows the `VAULT_FORK_DETECTED` notice on unlock, in plain language, naming
      the vault folder — and the UI offers **no** merge, no "keep this one", and no deletion of a
      conflicted copy (D-I).

**Import (D-P revised, D-S)**

- [ ] The import flow calls the existing `ImportConversations` → `ImportItems` path unchanged. No
      parser, chunker, selection rule, archive reader or repository write is re-implemented in the
      desktop tree (D-C).
- [ ] A target project is required before any import can run, and a dry-run preview is reachable
      before the real import.
- [ ] Importing N conversations produces **exactly one** lineage generation bump, verified by
      reading the generation before and after.
- [ ] Re-importing the same file into the same project does not duplicate items (deterministic
      ids), and per-conversation failures are displayed, not summarized away.
- [ ] The result screen states in plain language that imported items are searchable and visible in
      the project but **do not appear in context packs**; a test asserts the pack for that project
      is unchanged by the import.
- [ ] The archive caps in `FileExportReader` still apply, and no import temp file is written to
      disk (the reader inflates in memory).
- [ ] A large import does not leave the window looking frozen or unresponsive.

**Connect your AI tools (D-P)**

- [ ] The guided connect step calls the existing `install` use case unchanged, through
      `installer.ts`'s existing backup-and-merge discipline — no new parsing or writing logic for
      any client's config format is authored in the GUI.
- [ ] This path never opens `vault.db` and never touches the OS keychain entry; a test proves a
      connect action leaves the vault's lock state and lineage untouched.
- [ ] Every failure mode `installer.ts` already surfaces (missing client, malformed existing config,
      already-configured) is shown in plain language, per D-N — not a raw error — and the manual
      instructions are offered as a fallback.

**Diagnostics and sync status (D-R status half, D-T)**

- [ ] The diagnostics screen runs the checks `doctor.ts` already defines, using that logic rather
      than re-deriving any of them, and distinguishes fatal failures from warnings the way the
      CLI's exit code does.
- [ ] The screen discloses the keychain probe before running, and diagnostics never runs
      automatically, silently, or on a timer.
- [ ] The sync panel displays, from `VaultStatusOutput` and `VaultFolderInspection` only: vault
      folder, recognized-sync-folder hint, conflicted copies, stale `.pre-NNN.bak` backups, at-rest
      state, generation, last writer and whether it is this device, auto-lock TTL and idle time.
- [ ] The sync panel performs **no write of any kind** — no lineage bump, no session, no keychain
      change, no file created in the vault folder.

**Vault relocation (D-R)**

- [ ] The wizard refuses, **before writing anything**, when: a vault already exists at the
      destination; the destination is missing, unwritable, the same folder, or inside the current
      vault folder; or the current folder has an unresolved conflicted copy or a stale upgrade
      backup. Each refusal is a plain-language message, not a raw error.
- [ ] The move never deletes anything at the source until the destination has been verified
      complete and correct (D-R(b)).
- [ ] A simulated failure at each stage (copy fails, verify fails, source deletion fails) leaves
      exactly one openable vault, cleans up partial destination files, and does not change the
      remembered location — asserted by tests against a fake or temporary filesystem, not by
      inspection.
- [ ] After a successful move, the old folder contains **neither** `vault.db` **nor** `vault.json`,
      and the vault opens at the new location with the same passphrase and the **same vault id**
      and **same lineage generation** as before the move.
- [ ] A cross-filesystem destination works (the move is not rename-only).
- [ ] The vault is verifiably at rest before the move begins — no `-wal`/`-shm`/`-journal` sidecar —
      per D-R(d)'s answer, and the wizard states the re-unlock consequence before starting.
- [ ] Nothing under `VALIJA_STATE_HOME` is moved, copied, or created inside the destination.
- [ ] The new location survives an app relaunch (D-R(a)), and `VALIJA_HOME`, when set in the app's
      environment, takes precedence over it.
- [ ] The wizard shows the exact `VALIJA_HOME` line a terminal user needs, with a copy action, and
      the GUI docs explain that the CLI does not read the app's preferences.
- [ ] The app-preferences file contains only a vault path and UI preferences — no key material, no
      passphrase, no vault content (§8.4).

**Renderer and network hardening (§8.3–§8.6)**

- [ ] The renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`;
      the preload exposes a fixed, enumerated API with one method per use case, each validating its
      arguments at the boundary.
- [ ] No IPC channel accepts SQL, a module name, a shell command, or a filesystem path supplied by
      the renderer. The import file, the export target and the relocation destination all originate
      from native dialogs opened by the main process.
- [ ] The app makes zero network requests: no auto-update, no analytics, no crash reporting, no
      remote fonts or icons, **no sync-provider call of any kind**; a CSP forbids remote origins and
      navigation to them is denied. Verified against the built artifact, not only the source.
- [ ] After quitting, no new plaintext file, cache, index, or crash dump containing vault content
      exists on disk.
- [ ] Screenshots and docs use only the golden-vault fixture, labelled as published test data.

**Concurrency (D-J(a))**

- [ ] The busy/retry behaviour D-J(a) settles on is **explicit in code**, not inherited from a
      library default, and a contended write (GUI import vs an MCP `save_context`) produces the
      documented outcome rather than an unhandled exception.

**Packaging and docs (D-G)**

- [ ] Unsigned artifacts build for macOS, Windows and Linux, each with a published SHA-256; the
      native modules load correctly in the packaged app on every target (not only in dev).
- [ ] First-launch friction is documented per OS using the literal text the OS displays, with the
      exact bypass steps, plus the run-from-source alternative — and the run-from-source path is
      verified, not assumed.
- [ ] The GUI docs state what the GUI deliberately does not do (curation, fork resolution, vault
      destruction, running an MCP server, provider artifacts) and where those live.

**Not applicable this advance** *(listed so a reviewer does not look for them)*

- [ ] ~~Curation verbs behave correctly~~ *(not applicable — D-A, D-B)*
- [ ] ~~Skills / agents / provider artifacts~~ *(not applicable — D-D, D-E)*
- [ ] ~~New MCP tool or resource~~ *(not applicable — D-K)*
- [ ] ~~A `valija relocate` CLI command~~ *(not applicable unless D-R(c) lands on Option 3)*

---

## 10. Deliverables summary (for the planner, not a plan)

An **Electron** desktop application (D-F) — main process composing the existing container,
sandboxed renderer over an enumerated IPC surface — that reaches **full parity with the `valija`
CLI for a human user, minus curation** (D-P revised 2026-08-20):

- **creates a vault** (passphrase, Argon2id, one-time recovery-kit display with explicit
  acknowledgement) — never destroys one (D-M);
- **unlocks, locks and reports status** through the CLI's own keychain entry (D-H), honouring idle
  auto-lock unchanged and surfacing the fork notice without ever resolving it (D-I);
- **browses** projects and items, **searches** full-text, and **previews** a rendered context pack
  byte-identical to `valija export`;
- **copies** that pack to the clipboard or **exports** it to a user-chosen file;
- **imports** an existing ChatGPT/Claude/generic export through the shipping
  `ImportConversations` → `ImportItems` path — list, select, preview, import, one lineage bump —
  and says plainly that imported items stay out of context packs (D-P revised, D-S);
- **connects AI tools** via a guided wrapper over the existing `install` use case, with no new
  config-writing logic of its own (D-P);
- **reports diagnostics** using `doctor`'s existing checks, disclosing the keychain probe, and
  **shows sync status** as a pure read over `VaultStatusOutput` + `VaultFolderInspection` (D-R,
  D-T);
- **moves the vault into a folder the user's own sync client replicates**, with pre-flight
  refusals, lock-and-verify-at-rest, verify-before-delete, and a remembered location that survives
  relaunch — **the one genuinely new capability in this advance, with no existing implementation
  in `src/` or the CLI** (D-R);
- asks before **migrating** a behind-schema vault, naming the backup migrations 002/003 take,
  rather than migrating silently (D-J-b);
- follows the OS light/dark setting with a persisted manual override, the recovery-kit screen
  excepted (D-Q);

packaged **unsigned** for macOS, Windows and Linux with published checksums, a documented
run-from-source path, and per-OS first-launch instructions (D-G); living in a `desktop/` workspace
in this repo (D-L) — **plus, if D-R(c) lands on a shared use case, a relocation use case in
`src/vault/`**; documented for a non-technical reader (D-N); with `docs/SPEC.md` §1, §2 and §10a
corrected and **no milestone number** assigned (D-O).

**Not in it:** no curation of any kind, no fork resolution, no vault destruction, no MCP change and
no embedded MCP server, no provider artifacts, no new importer or format, no schema/format/crypto
change, no sync-provider integration, no signing, no auto-update, no network call, no localization,
no mobile.

**Open at Gate R:** D-R(a)–(d), D-S, D-T, D-J(a), and D-P's two parity gaps. Each has a default;
the rest of §7 is recorded.

---

## 11. Biggest risk

**The vault-relocation wizard is new filesystem-moving code, written for this advance, operating on
the one artifact this product cannot afford to corrupt — and it is the only feature here with no
existing implementation to inherit correctness from.**

This displaces the packaging/keychain risk that led the previous revision, and it is worth saying
why. Everything else in this advance is a window over code that already ships and is already
tested: the pack renderer, the importer, the installer, the doctor checks, the status reader. If
those screens are wrong, they are wrong *visibly* and recoverably. Relocation is different in every
dimension that matters:

- **No precedent anywhere.** There is no `RelocateVault`, no filesystem port for it, no advisory
  lock, no "vault location" concept beyond an environment variable read once at process start
  (§3 fact 3). Every safety property — verify before delete, refuse a destination that already has
  a vault, clean up a partial copy, never split the vault across two folders — has to be invented
  and tested here, not inherited.
- **The failure is silent and delayed.** A bad export screen is obvious immediately. A relocation
  that leaves a stale, openable `vault.db` behind looks like a complete success on the day it
  happens, and surfaces weeks later as a fork, or as a user who "lost everything they saved since
  Tuesday" because the wrong copy was the one their sync client kept.
- **It runs at the worst moment in the user's mental model.** The person clicking "move my vault
  into Dropbox" is by definition doing multi-device setup, which is when M3's fork machinery is
  most likely to be exercised — and D-N says that person does not use a terminal, so if the move
  half-fails they have no `valija doctor`, no `ls`, and no way to tell which folder is real.
- **It cannot be de-risked by shipping it badly.** Cutting scope on a browse screen means fewer
  filters. Cutting scope on relocation means a half-implemented move, which is worse than no
  wizard at all — the honest fallback if D-R's sub-decisions look shaky at planning time is to
  **ship the sync-status half alone** (cheap, pure read, real user value) and defer the wizard to
  its own advance with its own Gate R. That is the early re-scope signal to watch for.

**Second risk: packaging and macOS keychain behaviour — the previous revision's top risk, still
live and now carrying more weight.** D-G ships binaries that Gatekeeper and SmartScreen actively
block, so the first instruction the docs give a nervous user is how to override their operating
system's protection. D-H shares a keychain entry across two binaries, which on macOS may prompt on
every read or fail outright depending on the item's ACL — and the parity revision *added* a second
keychain interaction (the diagnostics probe, which the GUI would now be creating itself). Three
native modules rebuilt against Electron's ABI across three operating systems and two macOS
architectures remains the largest unknown-cost item in the plan. What has changed since the
previous revision is that this risk no longer has "nothing else to show for it": with import,
connect, diagnostics and sync in scope, the advance now delivers real capability even if
distribution stays rough. That makes it a serious risk rather than an existential one.

**Third risk: scope has roughly doubled while the advance kept one gate.** The 2026-08-17 revision
described a read-only shell over eight commands; this one covers eleven, adds a genuine vault
write, a new persistence mechanism, and a new file-moving capability — and eight decisions are
open at Gate R rather than zero. Two concrete consequences the planner should price in: the
implementation must be sliced so that the shell can ship even if relocation slips, and the review
budget can no longer concentrate on first run alone — it now has to cover first run **and**
relocation **and** the import write path.

**Fourth risk: the accepted risks getting quietly relaxed.** The recovery kit in a window (D-M,
§8.2) is the only unrecoverable failure in the product — a kit the user never stored cannot be
re-issued — and its mitigations are cheap, specific, and exactly the kind of thing that gets softened
for usability's sake mid-implementation ("let them reopen it", "let them save it to a file"). The
same pattern threatens relocation: "verify before delete" is one line of design and the first thing
someone will drop to make a progress bar feel faster. An accepted risk becoming a bigger one than
the person who accepted it agreed to is a failure mode of the process, not of the code, and it is
what §8 exists to prevent.
