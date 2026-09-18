# GUI — desktop companion for valija · Refined Spec

Approved: Oscar 2026-08-20

**Status:** **Gate R closed** (Oscar, 2026-08-20), on the **fifth revision**. Every `D-n` and every
sub-decision in §7 now carries a `Decided:` line. **Nothing is open.**

**What this revision did** (2026-08-20, same day as the third and fourth):
1. **Closed the sixteen `Open — Gate R` items** the fourth revision left behind — D-R(b), D-R(c),
   D-R(d), D-S, D-T, D-U(a)–(d), D-V(b)–(e), D-V(g), D-J(a) — plus **D-P's two parity gaps**
   (`export --json`, `unlock --recovery-key`). Oscar answered each one individually through an
   interactive prompt. Every answer landed on that item's own written `Default:`, so the analysis
   above each `Decided:` line stands unchanged and is the reasoning of record.
2. **Rewrote D-R(a)**, which was *not* a simple confirmation. Oscar caught a correctness gap the
   fourth revision missed entirely: the MCP server every connected AI tool talks to is a **separate
   OS process** (`npx -y valija mcp`) that does not read the desktop app's preferences file, so
   remembering the new vault location *in the app* would still have left every already-connected
   tool silently detached from the vault the moment it moved. D-R(a) keeps its original three-option
   analysis for "where does the app itself remember" and **adds a mandatory companion step**:
   relocation must also re-point every connected client's MCP config entry. See D-R(a).
3. **Added D-W**, a follow-up to that gap: a desktop-only user still needs Node/npm on their machine
   for `npx -y valija mcp` to run at all. This advance does not remove that dependency — it
   **detects it and says so plainly** in the connect flow. No Node bundling, no app-hosted MCP
   server; both are named as future work, not designed here.

**Revision history.** The 2026-08-17 revision narrowed the advance to a read-only shell plus vault
creation. **That framing is obsolete.** After reviewing `advances/GUI/mockups.md`, Oscar expanded
the scope three times: **full CLI parity** (`import` and `doctor` are in — D-P amended); **sync
surfacing and a vault-relocation wizard**, a genuinely new capability no surface of valija has today
(D-R); and **a skippable first-run tour, the Settings screen it replays from, and a bilingual
English/Spanish interface** (D-U, D-V) — the first surfaces answering to no CLI command at all.
D-V **reverses** D-N's English-only rider, so D-N is amended in place, dated, rather than
contradicted silently.

Read §1 and §3 before anything else: the phrase "read-only shell" is no longer accurate, and §3
states exactly what changed and what did not — including the sixth framing fact this revision adds,
that **relocating the vault is not only a file move**.

**Directory:** `GUI`, deliberately not a milestone number — same posture `MOBILE` held (D-O).
**Source idea:** `advances/GUI/idea.md` (idea capture only, written while refining `M4`).
**Companion:** `advances/GUI/mockups.md` — 15 mocked screens, validated direction, not a spec. Every
surface in this advance has a mocked screen. The mockups' copy is English only; that is a mockup
convention, **not** the shipped app's behaviour (D-V), and the onboarding slide copy in particular
is a sketch, not approved wording (D-U(c)).
**Inherits from:** `docs/SPEC.md` (§1–§10b), `docs/sync.md`, `advances/MOBILE/refined.md` (the `P-n`
idiom this file copies), `src/testing/__fixtures__/golden-vault/`.
**Legend:** each decision in §7 lists the options that were on the table, a **Default:** line with
its reason, and a **Decided:** line with the outcome in Oscar's terms. Decisions this advance's
shape made irrelevant carry **Decided: not applicable to this advance** and keep their analysis for
the advance that will need it.

---

## 1. Goal

**Ship a desktop application that lets someone who never opens a terminal do everything the
`valija` CLI does for a human user — create and unlock a vault, browse, search, preview and export
a context pack, import chat history, connect AI tools, run diagnostics, and see and change where
the vault lives — in English or Spanish, with a skippable first-run tour that explains what the app
is for, and without adding a single way to *curate* saved content.**

Three parts of that sentence carry the whole scope:

- **"Everything the CLI does"** is now literal (D-P, revised 2026-08-20). Every user-facing CLI
  command gets a GUI surface. The one exception is `valija mcp`, a server entry point invoked by AI
  tools, not a user action — the GUI neither runs nor embeds an MCP server (D-K, D-W, §8.11).
- **"Without curating"** is the boundary that survived every scope expansion. Nothing here edits,
  pins, unpins, archives, deletes, renames, retags or merges saved context. The only content this
  advance adds to the vault is a **bulk import of an existing export file** through the shipping
  `ImportItems` use case (D-A, D-C).
- **"In English or Spanish, with a first-run tour"** is not parity at all (D-U, D-V). Three surfaces
  answer to no CLI command: **Settings**, the **onboarding tour**, and the **language switch**. They
  are device-local UI preferences and explanatory copy, add no verb that touches the vault, and
  carry **no CLI parity obligation** — there is nothing in `valija` to be at parity with, and this
  advance deliberately does not invent one (D-U(d), §3 fact 5).

Only one capability here is not a window over an existing use case *and* touches files outside the
renderer's reach: **relocating the vault**. Nothing in `src/` today can move a vault folder, remember
a new location across process restarts, or tell a connected AI tool where the vault went — see §3
facts 3 and 6, and D-R. Everything else is a delivery surface over use cases that already exist
(`ListProjects`, `ShowProject`, `SearchContext`, `GetContextPack`, `VaultStatus`, `UnlockVault`,
`LockVault`, `CreateVault`, `ImportConversations`/`ImportItems`, `installer.ts`, `doctor.ts`, plus
`renderContextPackMarkdown`).

Nothing in this advance adds an MCP tool, an argument, a prompt, a schema column, a migration, a
dependency in the crypto path, a `locale` parameter anywhere in `src/`, or a network call.

---

## 2. What is already decided and is *not* re-opened here

Input, not agenda. A planner who wants to change any of these is in the wrong advance.

| Source | Constraint carried into this advance |
|---|---|
| `SPEC.md` D11 | **One vault per machine**, at `~/.valija/`, overridable with `VALIJA_HOME`. No vault switcher, no multi-vault UI. **Configuration is environment-resolved and nothing else** — no settings file, no `valija config`; see §3 fact 5 and D-U(d). |
| `SPEC.md` D6 | **Session model = OS keychain.** `unlock` derives + verifies + stores the key; `lock` removes it; every reader fetches it per call. No daemon. |
| `SPEC.md` D5, D7 | **Argon2id 64 MiB / t=3 / p=1 → 32-byte raw key**; recovery kit is the raw key + vault id + instructions. Unchanged, parameters and all. |
| `SPEC.md` §7 | **MCP surface is 5 tools + 2 prompts over stdio**, and "resist adding more". This advance adds none. |
| `SPEC.md` §9 | **No telemetry, no network calls at runtime.** Applies to the desktop app in full — including translation catalogs, which ship in the bundle and are never fetched (§8.5). |
| `SPEC.md` §10a | **`imported` items are searchable but excluded from context packs**, and are never creatable from an MCP tool. Verified in `context-pack.ts`. |
| M3 §10b D-A | **Single file at rest**: rollback journal, never WAL. Any surface that opens the vault leaves `vault.db` as one self-consistent file. |
| M3 §10b D-B, D-C | **Lineage stamp** bumped atomically with every write; **device identity** lives under `VALIJA_STATE_HOME` (default `~/.valija-state`), deliberately outside `VALIJA_HOME`. |
| M3 §10b D-I | **Idle auto-lock**, lazy, checked at session open, `VALIJA_AUTOLOCK_MINUTES` (default 15). |
| `docs/sync.md` | **BYO-cloud, no merge, ever.** valija never talks to a sync provider; syncing means the vault folder sits inside a folder some other client replicates. Fork detection warns and touches nothing. |
| MOBILE | **No distributable mobile app.** `docs/vault-format.md` remains the mobile-era artifact it is. |

**One clarification the relocation wizard forces (D-R).** D11 stays intact: there is still exactly
**one vault per machine**. Relocation *moves* that single vault; it never creates, clones or
switches between two. It also does **not** change how `src/` resolves `VALIJA_HOME` — no new
resolution rule is added, and the CLI's precedence is untouched. What relocation *does* newly do is
**write the new path into two places that are not `src/`**: the app's own preferences file, and the
`env` block of every already-connected AI client's `mcpServers.valija` entry (D-R(a)). Both are
records of *where the vault is*, consumed by processes at launch; neither is a new resolution rule.

**A second clarification the Settings screen forces (D-U).** D11's "configuration is the
environment" also stays intact. Settings holds four device-local **UI preferences** (vault-location
memory, theme, language, tour-seen). It is **not** a configuration editor: it never sets
`VALIJA_HOME`, `VALIJA_STATE_HOME` or `VALIJA_AUTOLOCK_MINUTES`, because a GUI that could would be
silently changing how the CLI and the MCP server behave (D-U(d), §6 Out).

---

## 3. Framing facts a planner must not skip past

**1. This is full CLI parity minus curation — a change from the 2026-08-17 revision.** That revision
described a read-only shell, excluding `import` and `doctor` on purpose (D-P, Option 2). On
2026-08-20 Oscar was asked directly whether the GUI should reflect *all* CLI operations, and
answered **yes, full parity**. So "the GUI is a read-only shell" is now false in two specific ways:
`import` performs a **real vault write** (a batch insert plus one lineage bump), and the relocation
wizard **moves the vault's files**. What did **not** change is D-A's core answer: **no curation** —
no edit, pin/unpin, archive, delete, rename, retag or merge, and no `save_context` equivalent.
Read "not a read-only shell, but still not a curation surface" as the one-line summary.

**2. There are now four write paths, and they are not equally dangerous.** Ranked by how much
attention the review budget should spend on each:

| Write path | What it writes | Risk class |
|---|---|---|
| **Vault relocation** (D-R) | Moves `vault.json` + `vault.db` to a new folder, **and rewrites every connected client's MCP config entry** (D-R(a)) | **Highest — new code, no precedent anywhere in `src/`**, touching the one artifact this product cannot afford to corrupt, plus third-party config files. §8.12 |
| **Vault initialization** (D-M) | New vault + keychain entry + recovery kit on screen | **High — unrecoverable if mishandled.** Accepted risk, §8.2 |
| **Import** (D-P, D-S) | Items in `vault.db`, one lineage bump | Medium — the use case already ships and is already exercised by the CLI. §8.10 |
| **Connect AI tools** (D-P) | Third-party client config JSON, **outside** `VALIJA_HOME` | Low — never opens `vault.db`, never touches the keychain. §8.9 |
| **UI preferences** (D-Q, D-R(a), D-U, D-V) | Four keys in a device-local preferences file | **Lowest — nothing secret, nothing vault-shaped.** Listed only so it is never confused with the others. §8.4 |

A fifth, smaller one: **running diagnostics writes to the OS keychain.** `doctor.ts`'s keychain
check sets and immediately deletes a probe entry (`doctor-probe`). Existing behaviour, not new — but
a GUI offering a "Check my setup" button must not describe it as a purely passive read, and on macOS
the probe may itself trigger the ACL prompt D-H's spike is about.

**3. The relocation wizard is genuinely new work, in `src/` as much as in the GUI.**

- **There is no `valija sync` command and nothing to "connect."** Sync (M3, `docs/sync.md`) works
  because the user points `VALIJA_HOME` at a folder their own sync client already replicates. valija
  never speaks to Dropbox, iCloud, OneDrive, Google Drive or Syncthing.
- **There is no relocation concept anywhere in `src/`.** A search finds only `migrations.ts`
  (`copyFileSync` + `rmSync` for the pre-upgrade `.pre-NNN.bak` backup), `installer.ts`
  (`copyFileSync` for a client-config backup), `file-device-identity.ts` (`renameSync` for an atomic
  state write), and test fixtures. Nothing moves a vault folder. There is no `RelocateVault` use
  case, no `VaultRelocation` port, no "vault location" value.
- **`VALIJA_HOME` is read once, from the environment, at process start.** `resolveVaultPaths` is
  `rootOverride ?? process.env.VALIJA_HOME ?? join(homedir(), ".valija")`, and `buildContainer()`
  calls it with no override. That is fine for a CLI launched from a shell and **does not work at
  all** for an app launched from a dock or start-menu icon, which inherits no shell environment.
- **The sync-status half is cheap and is not new work.** It presents fields `status` and `doctor`
  already compute: `VaultStatusOutput` (`dbPath`, `vaultId`, `initialized`, `unlocked`,
  `journalMode`, `sidecars`, `autoLock.{ttlMinutes,idleForMinutes,expired}`, `generation`,
  `lastWriter`, `lastWriterIsThisDevice`) and `VaultFolderInspection` (`sidecars`,
  `conflictedCopies`, `staleBackups`, `looksLikeCloud`). Pure read.

**4. Opening a vault touches bytes even when nothing is written.** A session open runs
`wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`, runs `migrate()`, and records a
device-local activity timestamp. See §5 and D-J(b).

**5. Two of this advance's surfaces answer to no CLI command at all — and one touches every string
in the app.** Four concrete facts follow:

- **There is no `valija config`, no settings file, and no locale concept anywhere in the product.**
  Configuration is resolved from the environment (`VALIJA_HOME`, `VALIJA_STATE_HOME`,
  `VALIJA_AUTOLOCK_MINUTES`) and nothing else. Settings has nothing to be at parity with, and this
  advance deliberately does **not** invent a CLI counterpart (D-U(d)).
- **There is no i18n machinery in `src/`.** No i18n library, no locale value, no catalog, no `Intl`
  usage anywhere; the CLI's user-facing text is hardcoded English across six delivery modules (55
  `console.log`/`console.error` calls). **The CLI stays English.** Localization is a `desktop/`-only
  concern (D-V(f)) and blocks on nothing in `src/`.
- **But errors are authored in `src/`, in English.** Every error constructor (`vaultErr`,
  `contextErr`, `importerErr`) returns a stable `code` plus an English `message` — e.g.
  `VAULT_ALREADY_EXISTS`, `VAULT_FORK_DETECTED`, `UNSUPPORTED_SOURCE`. **A GUI that renders
  `error.message` is an English GUI no matter how many catalogs it ships.** The GUI localizes from
  the *code*, never the message (D-V(d)) — the same discipline D-N's plain-language requirement
  already implied, now with a second reason.
- **Three strings the GUI displays are pinned byte-for-byte to `src/` output** by §9: the recovery
  kit (`renderRecoveryKit`), the manual install instructions (`manualInstructions()`), and the
  context pack markdown (`renderContextPackMarkdown`). Those stay English in a Spanish window, on
  purpose, and the app says why (D-V(d), §8.17).

**6. A sixth fact, new in this revision, and the one a planner is most likely to get wrong:
relocating the vault is not only a file move — it is also a re-pointing of every connected AI
tool.** The MCP server those tools talk to is a **separate OS process** the client spawns. Verified
in `src/delivery/cli/installer.ts`:

```
const MCP_ENTRY = { command: "npx", args: ["-y", "valija", "mcp"] };
```

There is **no environment block in that entry**. The spawned process resolves its vault through
`resolveVaultPaths()` — `process.env.VALIJA_HOME ?? ~/.valija` — from whatever environment the AI
client handed it, and an AI client launched from a dock icon carries no `VALIJA_HOME` either. So a
connected tool resolves `~/.valija` today and would keep resolving `~/.valija` after the vault moved
into Dropbox. **The desktop app's preferences file is not consulted by that process and never will
be.** The failure is silent on both sides: the app reports a successful move, and the user's AI
tools report an empty vault. D-R(a)'s companion step exists entirely to prevent this.

A second consequence of the same fact, D-W: `npx -y valija mcp` needs **Node and npm on the
machine**. Installing the desktop app does not provide them. Related precision for D-T: `doctor.ts`'s
`checkNode()` reads `process.versions.node`, which inside Electron is **Electron's bundled Node**,
not the system Node that `npx` would use — so that row, shown verbatim in the GUI, answers a
different question than the user thinks it does.

---

## 4. User walkthrough

Written for a person who does not use a terminal (D-N). Every acceptance criterion in §9 traces back
to a step here. Primed step numbers (`7'`, `34'`) are insertions into an existing flow; the unprimed
numbering is stable across revisions so earlier cross-references keep working.

### 4.1 Getting the app onto the machine (D-G: unsigned)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 0 | Download | Picks the build for their OS from the GitHub release page | `Valija-<version>-mac-arm64.dmg`, `Valija-<version>-win-x64.exe`, `Valija-<version>-linux-x86_64.AppImage`, each with a published SHA-256 |
| 1 | Open it | macOS: double-click → **blocked** | *"Valija can't be opened because Apple cannot check it for malicious software."* The docs tell them: right-click → **Open** → **Open**, or `xattr -d com.apple.quarantine /Applications/Valija.app` |
| 1' | Same, Windows | Runs the installer → **blocked** | SmartScreen: *"Windows protected your PC"* → **More info** → **Run anyway** |
| 1'' | Same, Linux | `chmod +x` the AppImage and run it | No OS-level block; a desktop-integration prompt at most |
| 2 | Alternative | Prefers not to bypass a warning | The docs' **run-from-source** path: clone, `npm install`, one documented command. Slower, no bypass, same app |

This friction is real, it is the first thing the target user meets, and §9 requires it to be
documented per OS with the literal words the OS shows. These instructions are **in English** even for
a Spanish-speaking user, because `docs/` is not translated in this advance — a documented gap,
D-V(c), and a security-copy surface, §8.17.

### 4.2 First run — creating a vault (D-M), and the welcome tour (D-U)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 3 | Launch, no vault present | — | *"No vault on this machine yet."* Two choices: **Create a vault** · **I already have one** (the second explains where valija looks, and offers the relocation wizard's "point me at it" path — §4.7). The window is already in the OS's language if that is English or Spanish (D-V) |
| 4 | Create | Types a passphrase twice | The same warning the CLI prints, in the window: minimum 8 characters; *"If you lose it AND the recovery kit, your data is gone. No reset exists."* Mismatch is caught before anything is written |
| 5 | Derive | Waits | *"Creating your encrypted vault (about a second)…"* — `CreateVault`, unchanged: header written, DB initialized, key placed in the OS keychain, idle clock started. The window stays responsive |
| 6 | **Recovery kit** | Reads a full-window panel | The exact text `renderRecoveryKit` produces — vault id, the raw key hex, what it is, what to do with it. Marked **shown once**. A **Copy key** button (warning that the clipboard is readable by other apps) and no automatic file write. In a Spanish UI the kit body is still English, with one localized sentence saying why (D-V(d)) |
| 7 | Acknowledge | Ticks *"I have stored this somewhere offline"* and confirms | Only then does the panel close. It cannot be reopened; the app never persists the kit |
| 7' | **The welcome tour** (D-U) | Reads, or skips, a four-slide carousel | Shown **once**, automatically, the first time this installation reaches the dashboard — **after** the acknowledgement of step 7, never before it (§8.17). Position dots, **Back** / **Next**, **Get started** on the last slide, **Skip** on every slide. The four slides: *what valija is* · *save once, use everywhere — and where saving actually happens: from inside an AI tool you connect, not from this window* · *browse, search, and take a context pack anywhere* · *local-first and encrypted, and what that means if you lose your passphrase*. **No vault session is opened, nothing is read from the vault, and the only thing written is one boolean in the app's preferences** (D-U(b)) |
| 8 | Land | — | The card dashboard, vault **unlocked** (matching `CreateVault`), empty state: *"No context saved yet."* with two next steps that are both reachable in-app: **Connect an AI tool** (§4.4) and **Import your chat history** (§4.5) — the same two the tour's second slide points at |

`valija status` in a terminal now reports the same vault, unlocked. There is exactly one vault, one
keychain entry, one device identity — the GUI is not a second device.

**On the other branch of step 3** — a user who already has a vault, created with `valija init` or
sitting in a folder they point the app at (§4.7's mirror flow) — the tour plays at the **same moment
in the same way**: the first time this installation reaches the dashboard, right after their first
successful unlock. They have never seen the app either, and tying the tour to vault *creation* would
leave them without one (D-U(a), Option 2, decided).

### 4.3 Daily use — browse, search, export

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 9 | Launch | Opens the app; the vault is locked (they locked it, or idle auto-lock did) | An unlock panel: passphrase field, plus a secondary **"I only have my recovery key"** path — parity with `valija unlock --recovery-key`, **decided** (D-P gap 2, option (b)): masked input, never persisted, never logged |
| 9' | Or not | Had already run `valija unlock` in a terminal | **No prompt.** The app shares the CLI's exact keychain entry (D-H) and is simply unlocked |
| 9'' | Or a fork | The vault was changed on another device from the same starting point | The `VAULT_FORK_DETECTED` notice `UnlockVault` already returns, in plain language, naming the vault folder — the vault still opens, **nothing is merged, nothing is deleted**, and the user is pointed at the Sync panel (§4.6) (D-I) |
| 10 | Browse | — | Project cards: name, item count, last activity — the same rows `valija projects` prints. Dates and counts are formatted for the active UI language (D-V(e)) |
| 11 | Open a project | Clicks a card | Its items: type, date, pinned marker, tags, content — the same content `valija show <project>` prints, in the same order. A type filter mirrors `--type`, including `imported` |
| 12 | Search | Types "sqlcipher" | Full-text hits across the vault, optionally narrowed to one project — the same rows `valija search` prints |
| 13 | Read the pack | Clicks **Context pack** | The rendered markdown for that project, unbudgeted — byte-for-byte what `valija export <project>` writes (§9 pins this). It is **vault content, not UI copy**, so it is never translated (D-V(d)) |
| 14 | Take it | Clicks **Copy** | The pack is on the clipboard, ready to paste into any chat window that is not MCP-connected |
| 14' | Or | Clicks **Export…** | A native save dialog offering **Markdown or JSON** — parity with `valija export -o <file>` and `--json`, **decided** (D-P gap 1, option (b)). The same plaintext egress that already exists, not a new one |
| 15 | Finish | Clicks **Lock**, or quits, or walks away | Locked: the key leaves the keychain. Walks away: idle auto-lock does it at the existing TTL — **the app does not extend the unlocked window by polling** |
| 15' | Settings | Clicks the gear, at any time | The Settings screen (§4.8) — appearance, language, vault & sync shortcuts, and **Show the welcome tour again**. Reachable **including while the vault is locked**, because the unlock screen is one of the screens that has to be readable in the user's language and theme (D-U(d), D-V(a)) |

### 4.4 Connect your AI tools (D-P, `install`; D-W; D-R(a))

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 16 | Open it | Clicks **Connect AI tools** | One card per supported client (`CLIENTS` in `installer.ts`), each showing connected / not connected — the same check `doctor` makes today: is `mcpServers.valija` present in that client's config? Each connected card also names **which vault folder that entry points at** (D-R(a)) |
| 16' | **Node check** (D-W) | — | Before offering to connect, the app probes whether **Node and npm are actually runnable on this machine**, because the entry it writes is `npx -y valija mcp` and the app does not provide a Node runtime. If they are not runnable it says so plainly — *"Your AI tools run valija through Node.js, which isn't installed on this machine. Connecting now will write the setting, but the tool won't be able to reach your vault until you install it."* — with a docs link. It **warns, and still lets the user connect**, because they may install Node minutes later |
| 17 | Connect | Clicks **Connect** on one | The existing `install` path runs: the client's config is backed up, then valija's MCP entry is merged in — now carrying **the vault folder this app is using** (D-R(a)). *"valija added to <config path>. A backup of your previous config is at <backup path>. Restart Claude Desktop to pick it up."* |
| 18 | It fails | The client isn't installed, or its config is not valid JSON | Plain language for each failure `installer.ts` already surfaces, plus the manual block `manualInstructions()` already produces, with a copy button. **That block stays English** in a Spanish UI — it is a JSON snippet and paths meant to be pasted (D-V(d)) |

### 4.5 Import chat history (D-P revised, D-S)

The existing `ImportConversations` → `ImportItems` path, in a window. No new parsing, no new write
logic, no new format. **Behavioural parity, not flag parity** (D-S, Option 2, decided).

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 19 | Start | Clicks **Import chat history** | An explainer: this reads an export file *you* downloaded from ChatGPT or Claude; valija never contacts either service (`SPEC.md` §9) |
| 20 | Pick a file | A native open dialog, filtered to `.json` and `.zip` | The file is read entirely in the trusted process; the format is auto-detected (chatgpt / claude / generic). A manual format override appears **only when detection fails**, mirroring the `UNSUPPORTED_SOURCE` error's own advice |
| 21 | Review | — | The conversation list: index, date, title, estimated chunks — the same rows `valija import <file> --list` prints, sortable by date (which is what `--since` exists to provide) |
| 22 | Select | Ticks conversations (a checkbox *is* `--pick`), types in a filter box (*is* `--query`); picks an existing project or types a new name | A target project is **required** before anything can be imported, exactly as `-p` is in the CLI |
| 23 | Preview | Clicks **Preview** | *"Would import 312 items from 18 conversations into 'valija' (skipped 2, failed 0)."* — the CLI's `--dry-run`. **Nothing is written**. The count sentence is plural-aware in both languages (D-V(e)) |
| 24 | Import | Clicks **Import** | One vault write for the whole batch, **one lineage bump**. *"Imported 312 items from 18 conversations into 'valija'."* Per-conversation failures are listed, never swallowed. Re-running the same import updates rather than duplicating (ids are deterministic). If an MCP `save_context` holds the write lock, the app waits out D-J(a)'s explicit busy timeout and bounded retry, and only then shows a plain-language message keyed to the error code |
| 25 | Find them | Opens the project | The new items appear with type `imported`, and in search. **They deliberately do not appear in that project's context pack** (`SPEC.md` §10a). The import result screen says so in one sentence — otherwise a user who imports 312 items, opens **Context pack**, and sees no change will conclude the import failed |

### 4.6 Check my setup — diagnostics and sync status (D-P revised, D-R, D-T)

**Split by audience** (D-T, Option 3, decided): a plain-language **Sync & safety** panel for daily
use, and a separate **Diagnostics** screen for support.

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 26 | Diagnostics | Clicks **Check my setup** (from the dashboard, or from Settings → Vault & sync) | The checks `valija doctor` runs today, close to verbatim, each with a one-line plain explanation: Node version, SQLCipher native module loads, OS keychain read/write, vault initialized/locked and where, journal + single-file-at-rest, sync folder, lineage, auto-lock, and one row per AI client. Fatal failures are distinguished from warnings, as the CLI's exit code does |
| 26' | Honesty note | — | Before running, the screen states that the keychain check **writes and immediately deletes a probe entry** in the OS keychain, and that on macOS this may raise a keychain prompt (D-H) |
| 26'' | Copy a report | Clicks **Copy report** | A support artifact for a GitHub issue. It stays **English** regardless of UI language, and it is the one place a raw `DomainError.message` may appear (D-T, D-V(d)) |
| 26''' | Two Node rows | — | The screen distinguishes **the Node this app runs on** (Electron's bundled runtime, which is what `doctor`'s `node` row actually reports) from **the Node your AI tools will use** (the system `node`/`npx` D-W probes). Conflating them is the specific confusion §3 fact 6 warns about |
| 27 | Sync & safety | Opens the **Sync** panel (from the dashboard, or from Settings → Vault & sync) | Vault folder path; whether valija recognizes it as a sync folder (`looksLikeCloud`); conflicted-copy files found; leftover `.pre-NNN.bak` upgrade backups; at-rest state (no `-wal`/`-shm`/`-journal`); current generation and whether **this** device wrote it last; auto-lock TTL and idle minutes — in plain words, jargon kept on the Diagnostics screen. Pure read — **displayed, never editable** (D-U(d)) |
| 27' | A conflict is found | — | The same guidance `docs/sync.md` gives, in plain words: valija has deleted nothing, both files open with the same passphrase, there is **no automatic merge**, pick one. The panel offers no "resolve" button — by design (D-I) |

### 4.7 Move my vault into a synced folder — the relocation wizard (D-R)

The one flow in this advance with no CLI counterpart *that touches the vault*. It exists because
"put your vault in a Dropbox folder" today means editing a shell profile, which is precisely what
D-N's audience cannot do. **It is one user action with three effects**: the files move, the app
remembers, and every connected AI tool is re-pointed (D-R(a)).

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 28 | Start | Clicks **Move my vault…** in the Sync panel (or Settings → Vault & sync) | Plain words: *valija does not talk to Dropbox, iCloud, OneDrive or anything else. Syncing works by your vault folder living inside a folder your own sync app already keeps up to date. This moves it there, remembers where it went, and updates the AI tools you've connected so they keep finding it.* |
| 29 | Choose | A native folder picker | The chosen folder, and whether valija recognizes it as a sync folder — **informational, never a gate**; an unrecognized folder is allowed with a note that valija cannot confirm it syncs |
| 30 | Pre-flight | — | Refusals, each stated plainly and **before anything is written**: a vault already exists at the destination (**refuse — never merge**, D-R(b)); destination missing or not writable; destination is inside the current vault folder, or is the current folder; an unresolved conflicted copy or leftover upgrade backup is sitting in the *current* folder (resolve it first — moving mid-fork is exactly when people lose data). The screen also lists **which connected AI tools will be re-pointed**, and warns up front if any of their config files cannot be read or is not valid JSON — that client will need the manual snippet afterwards (D-R(a)) |
| 31 | Lock first | Confirms | *"Valija will lock your vault before moving it. You'll enter your passphrase again afterwards."* The move only proceeds once the vault is verifiably at rest — no sidecar files present (D-R(d), Option 1, decided) |
| 32 | Move | Waits | `vault.json` and `vault.db` are **copied** to the destination and **verified there** — both present, byte-identical by digest, header parses — before anything is removed from the old folder (D-R(b), Option 2, decided) |
| 33 | If it fails | — | The old folder is still the vault, untouched and openable; partial files at the destination are cleaned up; the remembered location is unchanged; **no client config was touched**, because re-pointing happens only after the move has succeeded. One plain message, **never a half-moved vault** |
| 34 | Remember | — | The new location is recorded in the app's own preferences so the next launch finds it (D-R(a)). Device identity under `VALIJA_STATE_HOME` **does not move** — it stays device-local, deliberately outside the synced folder |
| 34' | **Re-point your AI tools** | — | Every client that currently has an `mcpServers.valija` entry has that entry rewritten to name the new vault folder, through the same backup-and-merge discipline `installIntoClient` already uses: back up the config, merge, write. *"Claude Desktop, Cursor and Claude Code now point at the new folder. Restart them to pick it up."* Any client that could not be rewritten is named individually, never summarized away, with the manual snippet and a **Try again** action (D-R(a), §8.12) |
| 35 | Tell the terminal | Clicks **Copy** | The exact line a terminal user needs, e.g. `export VALIJA_HOME="/Users/oscar/Dropbox/valija"`, because **the CLI does not read the app's preferences and is not re-pointed by this wizard** (D-R(a)). Without it, `valija status` in a terminal would report no vault on this machine |
| 36 | Confirm | Unlocks again | The Sync panel shows the new folder, recognized as a sync folder, generation unchanged, this device as last writer. The **Connect AI tools** screen shows each connected client pointing at the new folder (§4.4 step 16) |

The mirror-image flow, reachable from step 3: a user who already has a vault somewhere unusual picks
that folder instead, and the app records it — and re-points connected clients to it — without moving
anything.

### 4.8 Settings — appearance, language, and replaying the tour (D-U, D-V, D-Q)

The **first surface in the advance with no CLI command behind it, and deliberately without one**
(D-U(d), Option 1, decided). It exists because the tour has to be replayable from somewhere and
because D-Q's theme override and D-V's language override each need a home.

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 37 | Open | Clicks the gear from anywhere — dashboard, project view, **or the locked screen** | Four sections: **Appearance**, **Language**, **Vault & sync**, **Help**. Opening Settings opens **no vault session** and touches no vault file (D-U(d)) |
| 38 | Appearance | Picks *Follow system* / *Light* / *Dark* | The window re-themes immediately; the choice persists across relaunches (D-Q). The recovery-kit screen is exempt and stays permanently high-contrast dark |
| 39 | Language | Picks *Follow system* / *English* / *Español* | Every UI string switches **immediately — no restart, no re-unlock** (D-V(a)). The choice persists. Before any choice is made, the app already opened in the OS's language when its primary subtag is `es` (any region → the one neutral Spanish catalog), and in English otherwise (D-V(g)) |
| 40 | Vault & sync | Clicks through | Shortcuts to the **same** Diagnostics screen (§4.6 step 26) and the **same** relocation wizard (§4.7) — second entry points, not second implementations. Settings is deliberately **not** a config editor: `VALIJA_HOME`, `VALIJA_STATE_HOME` and `VALIJA_AUTOLOCK_MINUTES` are shown read-only in the Sync panel and cannot be edited here (D-U(d)) |
| 41 | Help | Clicks **Show the welcome tour again** | The same four slides from step 7', replayed on demand, as many times as the user likes. Replaying changes nothing except which slide is on screen — no state, no vault access, no re-showing on next launch |

**What Settings deliberately is not**: it cannot destroy, re-key, re-initialize or duplicate a
vault; it holds no passphrase, no key, no vault content; it exposes no advanced/developer mode; and
it is not a second place where any decision from §7 can be quietly re-litigated by the user.

**One honest corner the language switch creates.** Three pieces of text in this app are produced by
`src/` and pinned byte-for-byte by §9 — the recovery kit, the manual install instructions, and the
context pack markdown. In a Spanish UI those stay **English**, each with **one localized sentence**
explaining that it is written and stored in English on purpose, so it reads identically on any
machine, in any language, years later (D-V(d), option (a), decided; §8.17). Translating them would
fork the wording of the product's most consequential artifact between two surfaces, and in the
pack's case would mean translating the user's own saved content.

### 4.9 What the user deliberately cannot do here

| Not available | Why, and where it goes |
|---|---|
| Edit, pin/unpin, archive, delete, rename, retag, merge — any change to saved content | **Deferred (D-A).** A curation advance with its own Gate R; D-B (verb set) is its first question |
| Save new context by hand from the GUI | Same. Saving remains an MCP-tool action from inside an AI tool, by design (`SPEC.md` §3). *Importing* an export file is not this — it is a bulk ingest of content that already exists. **The onboarding tour must not imply otherwise** (D-U(c)) |
| Merge or resolve a fork | **Never, by design** (`docs/sync.md`, D-I). The GUI reports a fork and touches nothing |
| Delete or re-initialize a vault | **Never** (D-M Option 2). The GUI creates and moves; it does not destroy — and Settings is not a back door to it |
| Run or embed an MCP server, or use one bundled with the app | `valija mcp` is a server entry point for AI tools, not a user action (D-K, §8.11). The app also **does not bundle Node** and does not host MCP itself — it detects whether Node is runnable and says so (D-W) |
| Change where the vault lives by typing a path into Settings | Only the wizard's native folder picker does that (§8.6: filesystem paths never originate in the renderer). Settings links to the wizard; it is not a path field |
| Change auto-lock timing, or any other environment-driven behaviour | **Not in this advance** (D-U(d)). A GUI override would silently change how the CLI and the MCP server run |
| Use the app in a third language | **Out** (D-V). English and Spanish only; any other OS language falls back to English |
| Read `docs/` in Spanish | **Out this advance, recorded as a gap** (D-V(c), option (a), decided). The app is bilingual; the documentation — including D-G's first-launch bypass instructions — is not |
| Generate provider artifacts (skills, agents, rules files, `CLAUDE.md`) | **Future advance (D-D).** Its delivery shape is already decided (D-E): live over MCP, plus a copy button here — never a file the app writes |
| Anything mobile, cloud, or account-shaped | Out of scope permanently or by prior decision |

### 4.10 How the data is used afterward — which surfaces change, which do not

| Surface | Effect of this advance |
|---|---|
| The desktop app itself | **New.** The only new user-facing surface |
| MCP tools + prompts (5 + 2, stdio) | **Untouched, byte-for-byte.** The GUI is not an MCP client and does not proxy tools. What *does* change for a connected tool is **where its server process finds the vault**, and only when the user relocates it (D-R(a)) |
| The `valija` CLI | **Untouched in behaviour, and untouched in language.** Every command keeps working, keeps printing English (D-V(f)), and keeps resolving `VALIJA_HOME` exactly as before — the relocation wizard does not re-point the CLI, which is why §4.7 step 35 exists. A `valija relocate` command may follow from D-R(c)'s shared use case in a later advance; it is **not** shipped here |
| The vault file, schema, crypto, `vault.json`, KDF parameters | **Untouched in content and format.** No migration is authored here. Relocation changes only *where those files live*, never a byte inside them |
| The lineage stamp | **Bumped exactly once per import batch**, and by nothing else the GUI does. Browsing, searching, exporting, connecting tools, diagnostics, relocation, changing a theme, changing a language and watching the tour never bump it |
| Imported items | Visible in the project item list (type `imported`) and in **search**; **excluded from every context pack** and from every MCP tool response that returns a pack (`SPEC.md` §10a). This asymmetry is a product fact the GUI must state, not hide |
| The OS keychain | **Shared, not extended** (D-H): same service, same entry as the CLI. Relocation *deletes* it (that is what locking is) and the user re-unlocks. Diagnostics writes and deletes a probe entry |
| `VALIJA_STATE_HOME` device identity | **Reused, not duplicated, and never relocated.** The GUI is the same device as the CLI on that machine (D-I) |
| A new app-preferences file (D-R(a)) | **New, and GUI-only.** Exactly four things: where the vault is, the theme override (D-Q), the language override (D-V), and one boolean for "this installation has seen the welcome tour" (D-U(b)). **Never vault content, never key material**, readable with the vault locked — only safe because nothing in it is secret (§8.4) |
| Third-party AI client configs | Written by the existing `install` path — **and now also rewritten by relocation** (D-R(a)), through the same backup-and-merge discipline. This is the one place this advance widened the blast radius of an existing write path rather than adding a new one |
| The onboarding tour's seen-flag | **New, device-local, one boolean.** Not in the vault, not synced, not per-vault: relocating, re-creating or unlocking a different vault neither replays nor suppresses the tour (D-U(b)) |
| UI language | **New, and presentation-only.** No use case, port, repository, DTO or error constructor gains a `locale` parameter; translated strings live entirely in `desktop/`; the CLI is unaffected (D-V(f)) |
| The clipboard | **New affordance** — pack copy, plus the `export VALIJA_HOME=…` line, the manual install block, and the diagnostics report. User-initiated only, never automatic; named in the docs (§8.7) |
| A file the user names in a save dialog | Parity with `valija export -o` and `--json`; the only *content* file the app writes outside the vault |
| The published npm package | **Untouched in content.** `files` is `["dist","README.md","LICENSE"]`; desktop artifacts ship as GitHub release downloads |
| `docs/SPEC.md` §1's "one binary surface", §2's "GUI … → later", §10a's "import is CLI-only", D11 | **All four corrected** (D-O) |

---

## 5. Architecture expectations

Stated as boundary requirements, not a file layout.

### 5.1 Binding on this advance

- **The GUI is a delivery adapter — with exactly one exception.** It introduces no domain concept,
  entity, value object or use case, *except* vault relocation (D-R), which has no existing
  implementation to adapt. Settings, the tour and the language switch are **not** exceptions: they
  are presentation state (no `UserPreferences` entity, no `Locale` value object in `src/`). If the
  planner finds itself writing domain logic for anything other than relocation, something outside
  D-A's scope crept in.
- **Existing use cases are called, never reimplemented.** Import goes through
  `ImportConversations` → `ImportItems`; connect goes through `installer.ts`; diagnostics runs the
  checks `doctor.ts` already defines; status reads `VaultStatus` + `FileVaultFolder.inspect()`. No
  second parser, no second config writer, no second check list. Settings' "Vault & sync" shortcuts
  are the same rule applied to navigation: **a second entry point, never a second implementation.**
- **Rendering is not re-implemented.** The pack markdown comes from
  `delivery/context-pack-markdown.ts`, called in the trusted process. This is what makes
  "byte-identical to `valija export`" a structural property rather than a test that will rot — and
  it is why the pack is never translated (D-V(d)).
- **Relocation is a first-class operation with ports, not a pile of `fs` calls in an IPC handler.**
  Per D-R(c) it is a use case in `src/vault/`: a pre-flight returning typed refusals (`Result`, per
  repo convention), a copy step, a verification step, a source-removal step, and a rollback.
  Filesystem access sits behind an adapter so failure modes (cross-filesystem copy, permission
  denied, disk full, partial write) are simulated in tests. **The client re-pointing step of
  D-R(a) is part of the same orchestrated operation**, sequenced after the move succeeds, with the
  client-config writer behind its own port so a malformed or unwritable config is a testable branch
  rather than a thrown exception.
- **The client-config writer is shared, not duplicated.** Connecting a tool (§4.4) and re-pointing
  it during relocation (§4.7 step 34') write the same JSON shape into the same file through the
  same backup-and-merge discipline. There is exactly one function that knows how to touch a client
  config, and it lives where `installer.ts` already lives.
- **Device-local preferences are one store behind one port.** D-R(a)'s app-preferences file is the
  single home for four keys — vault location, theme (D-Q), language (D-V), tour-seen (D-U(b)) —
  behind one port with one tech-named adapter in the desktop tree. Three requirements: readable and
  writable **with the vault locked**; **never an argument to a use case**; and **no use case, port,
  repository, DTO or error constructor gains a `locale` parameter** (D-V(f)). Two stores for four
  preferences is the failure mode to avoid, and so is a preference that exists only in renderer
  memory.
- **User-facing copy is data, not markup.** Every string a user reads resolves through a lookup keyed
  by a stable id against a catalog bundled with the app (D-V(b)). No user-facing sentence is
  hardcoded in a component; none is assembled by concatenating fragments, because word order differs
  between the two languages; counts go through a plural-aware form (D-V(e)). A missing key falls back
  to English **and fails the test suite** — never a silent blank.
- **Errors are rendered from codes, never from `DomainError.message`.** The GUI maps the **code** to
  its own localized copy. This single rule makes D-N's plain language and D-V's Spanish the *same*
  mechanism, and is why i18n needs nothing from `src/`. The raw message may still appear in the
  diagnostics **Copy report** payload (D-T), which stays English.
- **The onboarding tour is presentation only.** It opens no session, reads no vault content, makes no
  network request, and writes nothing but its own boolean. Its slide sequence, skip semantics and
  "have I seen this" decision are plain TypeScript, unit-tested headlessly.
- **Process boundary is a security boundary.** The Electron main process (Node, trusted) owns the
  container and every vault interaction. The renderer runs with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, and reaches the main process only through a
  preload-exposed API with **one method per use case** — an enumerated, closed list, validated at the
  boundary with the same zod discipline the MCP server uses. No generic "run this query" channel.
- **Filesystem paths originate in the main process, never in the renderer.** Import, export and
  relocation each get their path from a native dialog the **main process** opens and keeps. Client
  config paths come from `clientConfigPath(client)` and a closed `CLIENTS` list, never from the
  renderer (§8.6).
- **Sessions are per action, never long-lived.** Use the existing `VaultSessions.withSession` shape.
  A GUI holding a `Database` handle open while the user reads keeps a lock against the MCP server and
  defeats M3's single-file-at-rest guarantee.
- **One lineage bump per user-visible action.** An import of 18 conversations is one `session.write`
  and one generation bump — what `ImportItems` already does. Do not chunk it for a nicer progress bar.
- **Concurrency with a live MCP server is real** (D-J(a)). `openVaultDb` constructs
  `new SqliteDatabase(dbPath)` with **no options**, so today's busy behaviour is a library default.
  D-J(a)'s explicit timeout and bounded retry must be **stated in code**, not inherited.
- **No background polling.** State refreshes on user action and on window focus, not on a timer.
  Browse/search/pack reads go through `SessionGuard`, which **records device activity** and therefore
  resets the idle auto-lock clock; `VaultStatus` does **not**. So polling browse data would silently
  disable auto-lock (M3 D-I), while polling status would merely show a liveness the product lacks.
- **Secrets do not cross the IPC boundary.** The passphrase travels renderer → main once and is not
  retained. The session key never travels main → renderer. Two exceptions, both by definition: the
  recovery kit at init (D-M) and a recovery key the user types in to unlock (D-P gap 2). Each crosses
  once, is never persisted, never logged, and cannot be re-requested.
- **Fork detection is surfaced, never resolved** (D-I). The relocation wizard must refuse to run
  while a fork is unresolved.
- **The GUI is the same device as the CLI** (D-I): it resolves `VALIJA_STATE_HOME` exactly as the CLI
  does and never mints a second device id, or an ordinary CLI-write-then-GUI-write sequence would
  classify as a **fork**.
- **The shell must be testable without a window.** View state, the language resolver (OS locale →
  catalog), the preference store, the tour's play/skip logic, the relocation orchestration and the
  Node probe are all plain TypeScript, unit-tested headlessly. Packaging is the part that cannot be
  unit-tested — keep it thin and keep logic out of it.
- **Repo conventions apply** to whatever tree this lands in (D-L): `domain/application/infra` where
  relevant, no bare files at a layer root, kind-named subfolders, tests per layer. Translation
  catalogs, the preference store and the tour are new *kinds* of thing and get their own kind-named
  folders rather than loose files.

### 5.2 Written now, dormant until curation ships (do not implement here)

- **Every content mutation goes through `session.write(...)`**, so the lineage bump is atomic with the
  mutation. A curation UI must never reach a repository directly.
- **The curation verb set** (D-B) — pin/archive first, edit later, delete last — is the curation
  advance's first question.
- **Undo, bulk selection, and multi-item gestures** raise the same "one bump per action" question at a
  larger scale; none of it is designed here.
- **Curation copy doubles the translation surface.** Every verb that advance adds needs copy in both
  languages and a confirmation dialog whose wording is a safety property — a cost it inherits from
  D-V, not a reason to defer D-V (§11).

---

## 6. Scope

### In

1. **An Electron desktop application** (D-F) whose main process composes the existing container and
   whose renderer is a UI, packaged for **macOS, Windows and Linux, unsigned** (D-G), with a
   documented run-from-source path.
2. **Vault initialization** (D-M): passphrase entry with confirmation, Argon2id derivation via the
   existing `CreateVault`, one-time recovery-kit display with explicit acknowledgement.
3. **Unlock / lock / status**, sharing the CLI's exact keychain entry (D-H), honouring idle auto-lock
   unchanged, surfacing the fork notice `UnlockVault` already returns, and a **recovery-key unlock
   path** (D-P gap 2, decided).
4. **Browse**: project dashboard (parity with `valija projects`), project item view with type filter
   (parity with `valija show [--type]`).
5. **Search**: full-text, optional project narrowing (parity with `valija search [-p]`).
6. **Context pack view**: rendered markdown, unbudgeted, identical to `valija export`.
7. **Copy to clipboard** and **Export…** to a user-chosen file, with a **markdown-or-JSON choice in
   the save dialog** (parity with `valija export -o` and `--json`; D-P gap 1, decided).
8. **Connect your AI tools** (D-P): a guided step wrapping the existing `install` use case, reusing
   `installer.ts`'s backup-and-merge discipline, **writing the vault folder into the entry** (D-R(a)),
   showing where each connected client currently points, and **warning plainly when Node/npm is not
   runnable on the machine** (D-W).
9. **Import chat history** (D-P revised, D-S Option 2): file picker, format auto-detection with a
   manual override only on detection failure, conversation listing with checkbox selection and a text
   filter, required target project, dry-run preview, import, per-conversation failure reporting, and
   an explicit statement that imported items do not enter context packs.
10. **Diagnostics** (D-P revised, D-T Option 3): the checks `doctor.ts` already runs, close to
    verbatim with a plain explanation per row, the keychain-probe side effect disclosed, the
    app-Node/tool-Node distinction made explicit (§3 fact 6), plus a **Copy report** support artifact
    that stays English.
11. **Sync & safety panel** (D-R, D-T): a read-only, plain-language panel over `VaultStatusOutput` +
    `VaultFolderInspection`.
12. **Vault relocation wizard** (D-R): pick a destination, pre-flight and refuse unsafe moves, lock
    and verify at rest (D-R(d)), **copy → verify → delete source** (D-R(b)), remember the new location
    (D-R(a)), **re-point every connected AI client's MCP config entry** (D-R(a)'s companion step), and
    show the `VALIJA_HOME` line the CLI still needs. Plus the "point me at an existing vault" variant,
    which records and re-points without moving anything.
13. **A confirmation screen for schema migration** (D-J(b)): shown only when a vault's schema is
    behind, naming the ciphertext backup migrations 002/003 take, before the shared `migrate()` path
    runs. A current-schema vault never sees it.
14. **Light/dark theme** (D-Q): follows the OS setting by default, manual override persisted in the
    single preferences store. The recovery-kit screen is exempt and stays high-contrast dark.
15. **A Settings screen** (D-U): **Appearance**, **Language**, **Vault & sync** (shortcuts to the
    *existing* Diagnostics screen and relocation wizard), **Help** ("Show the welcome tour again").
    Reachable while the vault is locked; opens no session. **No CLI counterpart, deliberately**
    (D-U(d)).
16. **A skippable first-run onboarding tour** (D-U): four slides, position dots, Back/Next, "Get
    started", **Skip** on every slide (Skip counts as seen); shown once automatically the first time an
    installation reaches the dashboard, on **either** branch of §4.2 step 3, never before the
    recovery-kit acknowledgement; replayable from Settings forever. Writes one boolean; its copy is
    bound by D-U(c)'s three guardrails.
17. **An English and Spanish user interface** (D-V, reversing D-N's English-only rider): follows the
    OS language (primary subtag only, D-V(g)) with a manual override in Settings — **D-Q's pattern,
    built once and used twice** — catalogs **bundled in the app** with no network fetch, structurally
    complete in both languages (D-V(c)), error copy keyed off `DomainError.code`, `Intl`-formatted
    dates/numbers/plurals against the **active UI language** (D-V(e)), and **no change of any kind in
    `src/`** for localization (D-V(f)).
18. **Docs**: a GUI page covering install per OS (with the literal Gatekeeper/SmartScreen text and the
    bypass), first run, the recovery-kit ritual, the welcome tour and how to replay it, Settings and
    what it deliberately does not configure, the language behaviour and the English-docs gap, import,
    connecting tools, **the Node/npm prerequisite (D-W)**, diagnostics, the relocation wizard **and
    both of its consequences** — the `VALIJA_HOME` line for terminal users and the automatic
    re-pointing of connected tools — and what the GUI deliberately does not do; plus the `docs/SPEC.md`
    corrections D-O requires.
19. **A recorded answer to the macOS keychain-ACL question** (D-H's mandatory spike) — whether a second
    binary reading the CLI's keychain entry prompts, succeeds silently, or fails, on a named macOS
    version, **for both** reading the CLI's entry and creating the diagnostics probe.
20. **A recorded answer to the client-`env` question** (D-R(a)'s mandatory spike) — whether each of the
    three clients in `CLIENTS` honours a per-server environment block in its `mcpServers.valija` entry,
    verified per client and written into the docs. This is what makes the companion step work; if a
    client does not honour it, that client's limitation is documented and the user gets the manual
    snippet instead.

### Out — explicit non-goals

- **All curation**: no edit, pin/unpin, archive, delete, rename, retag, merge, bulk mutation, or undo.
  No `save_context` equivalent. → future advance (D-A, D-B). **The onboarding tour may not imply any
  of it** (D-U(c)).
- **No fork resolution, no merge, no automatic deletion of a conflicted copy.** Detect and report only.
- **No vault destruction or re-initialization** (D-M Option 2), and no back door to it in Settings.
- **No `valija mcp` equivalent**: the GUI does not run, embed or supervise an MCP server (D-K).
- **No bundled Node.js runtime, and no app-hosted MCP server** (D-W). The app detects whether Node and
  npm are runnable and says so; removing the dependency — by embedding a runtime or by serving MCP
  from the app itself — is **future work, named and not designed here**.
- **No re-pointing of the CLI.** Relocation updates the app's preferences and connected clients' MCP
  entries; a terminal user still sets `VALIJA_HOME` themselves (§4.7 step 35). No shell profile is
  edited, no dotfile is written, no `valija relocate` command ships.
- **Provider artifacts** — skills, agents, rules files, generated `CLAUDE.md` → future advance (D-D),
  whose delivery shape D-E already fixes.
- **No MCP change of any kind**: no tool, argument, prompt, resource, or transport (D-K).
- **No schema change, no migration authored here, no format change, no crypto or KDF change, no
  `vault.json` field.** Swapping a crypto or keychain library for packaging convenience is explicitly
  forbidden (§8.1).
- **No sync-provider integration.** The relocation wizard moves a folder; it does not authenticate,
  upload, watch, or wait for anything (§8.5).
- **No new importer, parser or format** — the GUI imports exactly what `valija import` imports today.
- **No multi-vault, no vault switcher, no remote vault, no cloud, no accounts, no pairing.**
- **No auto-update, no telemetry, no crash reporting, no analytics, no remote content, no network call
  at all** — including fonts, icons, update feeds, **and translation catalogs**, which ship inside the
  bundle (§8.5).
- **No code signing, no notarization, no store distribution, no Apple Developer account** (D-G).
- **No third language, and no localization beyond the app's own UI** (D-V). English and Spanish only;
  any other OS language gets English. No downloaded or updatable language packs, no per-vault or
  per-project language, no translation of the strings `src/` produces — the recovery kit, the manual
  install instructions and the context pack markdown stay byte-exact English (§9, D-V(d)) — no
  translation of CLI output (D-V(f)), and **`docs/` stays English this advance**, a gap D-V(c) records
  rather than hides.
- **No regional Spanish variants** (D-V(g)): one neutral Latin American Spanish catalog, "tú" forms,
  no voseo.
- **No onboarding beyond the four-slide tour.** No coach-marks, tooltip overlays, interactive
  checklists, demo or sample vault, video, or progress tracker. No re-prompting a user who skipped.
- **Settings is not a configuration editor** (D-U(d)). It holds four device-local UI preferences and
  links to screens that already exist.
- **No telemetry of any kind about the tour or the language**, including a local counter of how far
  someone got through the slides. The seen-flag is one boolean (§8.4).
- **No mobile anything.**

---

## 7. Decisions

Each entry: the options that were on the table, the **Default:** with its reason, and the
**Decided:** line. Entries marked *not applicable to this advance* keep their analysis for the
advance that will need it. **Nothing in this section is open.**

### D-A. What the GUI actually is

- **Option 1 — a viewer only**: projects, items, search, pack preview, copy.
- **Option 2 — the operations that already exist, as a first-class shell**: Option 1 plus the existing
  vault operations (unlock/lock/status), with no new verbs invented.
- **Option 3 — shell + curation together**: Option 2 plus edit, pin/unpin, archive, delete, rename.
  *Trade-off:* the only option that fulfils "administer and refine your context", but it introduces
  the product's first non-MCP content-write path and drags D-B, D-C, D-I and D-J into scope with it.
- **Default: Option 3.** Reason: a window that can only look at things does not answer the need that
  produced the idea, and the domain already has the repositories a curation layer would need.
- **Decided: Option 2**, overriding the recommended Option 3. Oscar, relayed: *"GUI but with the
  operations that [already] exist"*, confirmed after "curar" was spelled out as
  edit/pin/archive/delete/rename. **Curation is not bundled here**; it becomes its own advance with its
  own Gate R. The Default text is retained deliberately: the narrow scope was chosen, not overlooked.
  **Note, 2026-08-20:** D-P's revision to full CLI parity expanded *which existing operations* ship and
  brought `import` with it. It did **not** reopen this decision. **Second note:** D-U's Settings screen
  and tour are not operations on content either — but the tour is the single easiest place to *promise*
  curation by accident, which is why D-U(c) puts a guardrail on its copy.

### D-B. The curation verb set

- **Option 1 — pin/unpin + archive only.** The two verbs the schema already models, no new state.
- **Option 2 — Option 1 + edit content and tags.** Editing raises "is this the same item?":
  `updatedAt` moves, FTS reindexes, and an item an AI wrote is now partly human.
- **Option 3 — Option 2 + hard delete and project rename.** Rename is a slug change with referential
  consequences; hard delete is the only irreversible verb in the product.
- **Default: Option 1 for the first curation pass**, then Option 2 behind an explicit confirmation.
- **Decided: not applicable to this advance.** This analysis is the curation advance's first question.

### D-C. Where the write paths live *(reactivated 2026-08-20)*

- **Option 1 — new use cases in `context/application/use-cases/`**, reused by CLI and GUI alike.
- **Option 2 — GUI-only application services** in the desktop tree. Faster, and immediately creates a
  second-class path the CLI cannot reach and the MCP server cannot audit.
- **Option 3 — one generic `UpdateItem` use case** taking a patch. Fewer classes, weaker invariants.
- **Default: Option 1.** Reason: the repo's whole shape (`SPEC.md` §10) is "entry points are thin
  adapters over shared use cases", and a write path only one adapter can reach is the first crack.
- **Decided: partially applicable.** Two halves bind:
  1. **For import: Option 1, already satisfied.** `ImportConversations` and `ImportItems` are shared
     with the CLI and are the *only* way the GUI may write imported items. No parallel importer,
     chunker, or direct repository write. Acceptance criterion (§9), not a preference.
  2. **For relocation:** answered by **D-R(c)** — Option 1, a use case in `src/vault/`.
  Curation verbs remain out of scope; Options 2 and 3 are retained for that advance.
  **Note:** the preferences store is explicitly **not** a case for this decision — it writes no vault
  data and belongs to no bounded context in `src/`.

### D-D. Skills / agents / provider artifacts in scope?

- **Option 1 — in this advance.** **Option 2 — a separate advance with its own Gate R.**
- **Default: Option 2.** Reason: artifact generation is a new *product concept*, not a new window.
- **Decided: Option 2**, matching the recommended default.

### D-E. How provider artifacts reach a provider (decided now, for that future advance)

- **Option 1 — the GUI shows the artifact and offers copy-to-clipboard.** *Trade-off:* manual, nothing
  stays in sync.
- **Option 2 — an explicit per-target write.** *Trade-off:* a brand-new plaintext egress path, which
  would require amending `docs/SPEC.md` §9's security model.
- **Option 3 — continuous sync.** Same egress plus a daemon, which M3 deliberately refused.
- **Option 4 — expose artifacts live over MCP**, read at call time, nothing written to disk.
- **Default: Option 2**, as the shape most users expect from a "rules file" feature.
- **Decided: Option 4 + the copy affordance from Option 1**, rejecting file writing entirely. Oscar:
  *"Por MCP principalmente pero pudiendo a través de la GUI copiar y pegar el contenido de forma
  fácil."* Consequences: (1) **no new plaintext-file egress path** under this decision, so the §9
  amendment is moot; (2) **this reopens D-K in that future advance**, since "live over MCP" means new
  MCP surface against `SPEC.md` §7's standing "resist adding more"; (3) the copy affordance is the same
  mechanism this advance already ships for packs.

### D-F. Framework

- **Option 1 — Electron.** Runs Node, so the app reuses the **actual** `src/` use cases,
  `better-sqlite3-multiple-ciphers`, `argon2`, `@napi-rs/keyring` unchanged — zero reimplementation,
  byte-identical rendering by construction. *Trade-off:* a large bundle, and three native modules
  rebuilt against Electron's ABI per OS/arch (§11).
- **Option 2 — Tauri.** Smaller binaries, Rust host. *Trade-off:* the vault logic is TypeScript, so
  this means a bundled Node sidecar or a Rust reimplementation — the drift risk MOBILE measured.
- **Option 3 — Compose Multiplatform / KMP.** `idea.md` assumed a shipping mobile app; that was
  cancelled, so this is a Kotlin toolchain plus a second domain implementation for a desktop-only
  deliverable.
- **Option 4 — a native app per OS.** Best integration, three times the work, three chances to diverge.
- **Default: Option 1 (Electron).** Reason: the property worth more than binary size is that the GUI
  cannot drift from the CLI, because it *is* the CLI's code with a window on it.
- **Decided: Option 1 (Electron)**, matching the recommended default. The planner must verify
  Electron-ABI availability (prebuilds or `electron-rebuild`) for all three native modules on every
  target, and must **not** substitute a pure-JS or alternative crypto/keychain library to make
  packaging easier (§8.1). *Consequence recorded in this revision:* Electron bundles its own Node,
  which is **not** the Node `npx -y valija mcp` runs under — see D-W and §3 fact 6.

### D-G. Signing and distribution

- **Option 1 — signed and notarized.** Clean first launch; recurring cost Oscar already declined.
- **Option 2 — unsigned artifacts + a documented run-from-source path**, with published checksums and
  per-OS first-launch instructions.
- **Option 3 — source only.** Honest, and excludes the exact audience the GUI exists for.
- **Default: Option 2.** Reason: the only option that costs nothing and still produces something a
  non-technical user can double-click, provided the friction is documented rather than discovered.
- **Decided: Option 2**, matching the recommended default. The security cost of teaching a bypass is
  acknowledged in §8.13, not hidden. **Note:** those bypass instructions live in `docs/`, which D-V(c)
  keeps English, so a Spanish-speaking user meets the app's scariest instruction in a second language —
  a real gap, recorded, not fixable from inside the app because it happens before the app runs.

### D-H. Session model

- **Option 1 — share the CLI's exact keychain entry** (service `valija`, account = vault id). One
  session, one mental model. *Trade-off:* **macOS keychain items carry an ACL tied to the creating
  application**, so a second binary reading the CLI's entry may prompt or fail.
- **Option 2 — a separate GUI keychain entry.** Two independent session states, two places a key can
  be left behind.
- **Option 3 — no keychain in the GUI**: key in memory only. The GUI could no longer unlock *for* the
  MCP server, which is most of the point.
- **Default: Option 1, with a mandatory macOS ACL spike before the plan is finalized.**
- **Decided: Option 1**, matching the recommended default. **The spike stays mandatory** and must cover
  both reading the CLI's entry and creating `doctor.ts`'s `doctor-probe` entry, on a named macOS
  version, with the answer reaching the docs (§6 In, item 19). If it prompts every time, that is a
  product fact the docs state, not a bug to paper over with a second entry.

### D-I. Device identity and lineage *(reactivated 2026-08-20)*

- **Option 1 — the GUI is the same device as the CLI**: same `VALIJA_STATE_HOME`, same device id.
- **Option 2 — the GUI mints its own device id.** A CLI write plus a GUI write between syncs would then
  classify as a **fork** — a false alarm on the product's loudest error.
- **Default: Option 1**, unambiguously.
- **Decided: Option 1, and now fully binding.** `import` writes to `vault.db` and bumps the lineage
  stamp, and relocation moves the file the lineage lives in. All of it binds:
  1. The GUI resolves `VALIJA_STATE_HOME` exactly as the CLI does and **never mints a second device id**.
  2. **Fork detection is surfaced, never resolved.**
  3. **Relocation must refuse to run on an unresolved fork.**
  4. `VALIJA_STATE_HOME` is **never moved, copied or relocated** by the wizard, and never placed inside
     the destination folder (M3 D-C).
  5. The app-preferences store is device-local for the same reason and must never be placed inside the
     vault folder or the destination folder.

### D-J. Concurrency

**(a) Write-lock contention.** With an MCP server and a GUI both live, two processes may write the
same SQLite file. The GUI can now do this: an import is a real write.
- **Option 1 — an explicit busy timeout with a bounded retry.** SQLCipher/SQLite already serializes
  writers; a benign race resolves itself. *Trade-off:* a long import holding a write transaction can
  make an MCP `save_context` wait, and the AI tool sees latency with no explanation.
- **Option 2 — refuse and tell the user.** Explicit, never surprising, and a scary-looking error for
  what is usually a one-second overlap.
- **Option 3 — a single-writer advisory lock** (a lock file in the vault folder). Strongest guarantee,
  but it puts a **new file in the vault folder** — exactly what M3 D-A's single-file-at-rest rule and
  every sync-client interaction were designed to avoid — and a stale lock after a crash is its own
  support problem.
- **Default: Option 1 for import** (explicit timeout, bounded retry, plain-language message if it still
  fails), **and a stricter posture for relocation**: relocation is not a database write, so it does not
  contend on SQLite locks at all — it is guarded by D-R(d)'s lock-and-verify-at-rest discipline.
- **Decided: Option 1 for import**, matching the recommended default: an explicit busy timeout and a
  bounded retry, with a plain-language failure message **keyed to the error code** (D-V(d)), never a
  raw SQLite string. **Relocation is explicitly not governed by this option** — it is a file move, not
  a database write, and D-R(d)'s discipline governs it instead. *Rider:* `openVaultDb` passes **no
  options** to `new SqliteDatabase(...)` today, so the value must be stated in code, not inherited from
  a library default. Closes the D-J(a) Gate R item (Oscar, 2026-08-20).

**(b) What a read session does to the file.** `SqliteVaultSessions.open()` runs
`wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`, and calls `migrate(db, path)`. So a GUI
opening a behind-schema vault will **run migrations** — including the transactional table rebuilds of
002/003, which take a ciphertext backup on a populated vault.
- **Option 1 — reuse the existing session path unchanged.** One code path, zero divergence.
  *Trade-off:* the most invasive operation in the product triggered by double-clicking an icon.
- **Option 2 — pre-flight and refuse to migrate**, telling the user to run a CLI command first.
  *Trade-off:* dead-ends a non-technical user at a terminal instruction.
- **Option 3 — migrate, but only after an explicit "upgrade this vault" confirmation**, with the backup
  behaviour explained.
- **Default: Option 1**, with Option 3 named as the honest compromise if Gate R wants consent.
- **Decided: Option 3**, overriding the recommended Option 1. The GUI pre-flights the schema version and
  shows an explicit "this will update your vault" screen — naming the ciphertext backup — before
  calling the same `migrate()` path every CLI command calls. One code path, consent-gated rather than
  silent. A first-run vault (schema current) never sees it. **Its copy is one of §8.17's
  security-relevant surfaces, in both languages.**

### D-K. Does anything reach the MCP surface?

- **Option 1 — nothing changes.** **Option 2 — the GUI exposes something over MCP** (e.g. artifacts).
- **Default: Option 1.**
- **Decided: Option 1**, matching the recommended default. No tool, argument, prompt, resource or
  transport. `import` is a CLI/GUI operation with no MCP counterpart by design. Settings, the tour and
  the language are presentation state; no MCP tool learns what a locale is, and no tool response is
  translated. **Clarification added in this revision:** D-R(a)'s companion step **does not touch the
  MCP surface either** — it edits a client's own configuration file so the *existing, unchanged*
  `valija mcp` process is launched pointing at the right folder. No tool, argument or transport
  changes; only the environment the client hands the server. **Scoped to this advance only:** D-E(2)
  records that the artifacts advance reopens this question.

### D-L. Where the desktop code lives

- **Option 1 — a top-level `desktop/` workspace in this repo.** Imports the existing use cases
  directly, so D-F's rationale holds with no publishing step. *Trade-off:* an Electron build lands in a
  Node CLI repo; CI grows; and `desktop/` is **not** covered by `.claude/hooks/guard-implementation.sh`,
  which gates `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json` — extending it is a governance
  change the plan must call out rather than slip in.
- **Option 2 — inside `src/delivery/desktop/`**, a third entry point beside `cli/` and `mcp/`. Already
  gated. *Trade-off:* a renderer app living inside a tree `tsup` builds for npm risks front-end files
  leaking into the published `dist`.
- **Option 3 — a separate `valija-desktop` repo.** *Trade-off:* this package exports no library entry
  point (`bin` only, no `exports`), so a second repo would vendor or re-export internals —
  reintroducing the drift risk D-F chose Electron to avoid — and would need the whole gate apparatus
  copied.
- **Default: Option 1**, with two riders: `desktop/` stays out of the npm `files` allow-list, and the
  plan explicitly proposes gating `desktop/` in `guard-implementation.sh` (recommended: yes).
- **Decided: Option 1**, matching the recommended default. **Note on the `src/` split, now settled:**
  D-R(c) puts a `RelocateVault` use case in `src/vault/`, and D-R(a)'s companion step extends the
  client-config writer that lives in `src/delivery/cli/installer.ts`. So this advance **does** edit
  gated `src/` code in two named places, and the plan must be explicit about the split at Gate P.
  **Second note:** translation catalogs, the preferences store and the tour live **entirely** in
  `desktop/` — D-V(f) makes that a rule, not a coincidence.

### D-M. Vault lifecycle in the GUI

- **Option 1 — init, unlock, lock, and (some day) destroy.**
- **Option 2 — init, unlock and lock**, but never destroy.
- **Option 3 — terminal-only init; the GUI unlocks and locks.** *Trade-off:* a non-technical user
  cannot get started at all without a terminal.
- **Default: Option 3.** Reason, **retained verbatim because it is now an accepted risk rather than a
  rejected argument**: showing the recovery kit in a window is *a materially worse ritual than a
  terminal that prints it once*, and putting init in the GUI *duplicates the most security-sensitive
  flow in a new surface*.
- **Decided: Option 2**, overriding the recommended Option 3. **The GUI can initialize a vault**; it
  never destroys one. A deliberate security-posture acceptance by Oscar — the trade-off is accepted,
  not disputed, and §8.2 carries it as a named surface with required mitigations. Do not re-litigate it
  in the plan; do not soften it in the docs.
  **Sub-question, defaulted here:** `SPEC.md` D7 says init "write[s] a one-page recovery file", while
  the shipped CLI *prints* the kit and states it is "never stored". The GUI **mirrors the shipped
  behaviour** — display once, copy-to-clipboard, no automatic file write — and does not silently
  resolve that drift toward writing a file.
  **Added 2026-08-20:** "never destroys" also constrains relocation. The wizard's delete-the-source step
  is the only place the GUI removes a vault file from disk, and it may do so **only after** the
  destination is verified (D-R(b)).
  **Added (fourth revision):** the tour **never appears before the recovery-kit acknowledgement**
  (§8.17), and **the kit body is not translated** even in a Spanish UI (D-V(d)).

### D-N. Audience

- **Option 1 — non-technical-first.** **Option 2 — power-user-first.** **Option 3 — both, layered.**
- **Default: Option 3**, on the grounds that the same person may want both.
- **Decided: Option 1**, overriding the recommended Option 3. Plain-language errors, no lineage/journal
  jargon in the main flow, and D-G's install friction becomes the single most important thing the docs
  get right. ~~Locale stays English-only this advance.~~ — **reversed, see below.**
  **Note, 2026-08-20:** full CLI parity brings back part of the simple-vs-power-user tension — `doctor`
  is written for technical users. That is what **D-T** answers: the main flow stays plain, the technical
  vocabulary lives in a screen a curious user opens deliberately.
  **Amended (fourth revision) — the English-only rider is reversed.** **Gate R said otherwise:** Oscar
  chose **English and Spanish**, following the OS language with a manual override. The audience argument
  for plain language is the same argument that now requires Spanish — "plain language" is not a property
  English has independently of the reader. **D-N's answer itself (non-technical-first) is unchanged.**
  One consequence worth noting here: "plain-language errors" and "Spanish errors" are the *same*
  requirement mechanically — both satisfied by rendering copy from `DomainError.code` (§3 fact 5, §5.1).

### D-O. Roadmap and `docs/SPEC.md`

- **(a) Does the Out line change?** §2 reads *"GUI, encrypted backup / restore → later"*. The advance
  that ships a GUI must correct it. **Also §1**, *"One npm package. One binary surface: `valija`."*
- **(b) Does the GUI get a milestone number?** Assign one, or stay `GUI` like `MOBILE` stayed `MOBILE`.
- **Default: correct §2 (and §1), assign no milestone number.**
- **Decided: the default applies.** Plus two further corrections, both now certain:
  - **§10a** says *"No new MCP tool or argument — import is CLI-only."* The MCP half stays true; the
    "CLI-only" half stops being true. It must be corrected to: **import has no MCP surface**, and is
    available from the CLI and the desktop app.
  - **D11** gains a sentence, now unconditional because D-R(a) landed on Option 1: the desktop app keeps
    an **additional, lower-precedence memory of the vault's location, holding UI preferences and a
    location hint only — not configuration** (D-U(d)); `VALIJA_HOME` still wins wherever it is set. The
    same sentence should note that **relocation also records the vault's path in the MCP configuration
    of connected clients**, so a reader of the contract is not surprised that moving a vault edits a
    third-party file. The plan proposes the exact wording rather than leaving the contract incomplete.
  - **A deliberate non-correction:** `SPEC.md` needs no statement about language. The contract documents
    describe the *product*; the desktop app's UI language is not a property of the vault, the CLI, the
    MCP surface or the format. The GUI docs carry it (§6 In, item 18).

### D-P. Which existing operations the shell actually surfaces

- **Option 1 — the read set plus session control**: `init`, `unlock`, `lock`, `status`, `projects`,
  `show`, `search`, `export`.
- **Option 2 — Option 1 plus `install`.** *Strongest argument for:* arguably the single most valuable
  non-terminal operation — a vault they cannot connect to any AI tool is a vault that stays empty.
- **Option 3 — Option 2 plus `doctor`**, as a read-only panel.
- **Option 4 — Option 1 plus `import`.** Rejected on its face *at the time*: bulk write.
- **Option 5 — full parity: every user-facing command.** Only `mcp` excluded. *Trade-off:* reintroduces
  a genuine vault-write path and a technical-vocabulary surface into an advance shaped for a
  non-technical audience.
- **Default: Option 1**, with Option 2 named as the strongest alternative.
- **Decided (2026-08-17): Option 2.** **Decided (revised 2026-08-20): Option 5 — full CLI parity.**
  Oscar was asked directly and answered **yes, full parity**, reversing the `import`/`doctor` exclusion.
  `install` remains in and must reuse `installer.ts`'s backup-and-merge discipline, surface its existing
  failure modes in plain language, and never touch `vault.db` or the keychain.

  **Reversal note.** The prior exclusion rested on D-A's "no writes" framing. D-A declined **curation**,
  not every write. `import` is not new domain work, so surfacing it adds a *screen*, not a *capability* —
  but it is the GUI's first path that mutates `vault.db` and bumps the lineage stamp, which is why D-C,
  D-I and D-J(a) are reactivated. `doctor` adds no vault write, only a technical-vocabulary surface.

  **The parity map the planner must satisfy:**

  | CLI | GUI surface | Notes |
  |---|---|---|
  | `init` | Create-vault flow (§4.2) | D-M |
  | `unlock` | Unlock panel (§4.3 step 9) | **`--recovery-key` shipped** — gap 1 below, decided |
  | `lock` | Lock action (§4.3 step 15) | Also invoked by the relocation wizard (D-R(d)) |
  | `status` | Sync & safety panel (§4.6 step 27) | D-R, D-T |
  | `projects` | Card dashboard (§4.3 step 10) | |
  | `show <project> [--type]` | Project view + type filter (§4.3 step 11) | filter includes `imported` |
  | `search <query> [-p]` | Search screen (§4.3 step 12) | |
  | `export <project> [-o] [--json]` | Pack preview + Copy + Export… (§4.3 steps 13–14') | **`--json` shipped** as a format choice — gap 2 below, decided |
  | `import <file> [flags]` | Import flow (§4.5) | behavioural parity, D-S |
  | `install <client>` | Connect AI tools (§4.4) | now also writes the vault path (D-R(a)) and warns about Node (D-W) |
  | `doctor` | Diagnostics (§4.6 step 26) | split by audience, D-T |
  | `mcp` | **Deliberately not surfaced** | server entry point, not a user action (D-K, §8.11) |
  | *(none)* | **Settings** (§4.8) | No CLI counterpart exists and none is invented — D-U(d) |
  | *(none)* | **Welcome tour** (§4.2 step 7') | Explanatory chrome, not an operation — D-U |
  | *(none)* | **Relocation wizard** (§4.7) | The one capability no surface of valija has today — D-R |

  **The two parity gaps, both now decided:**
  1. **`export --json`.** *Options:* (a) markdown only, as the mockups show; (b) a format choice in the
     save dialog. **Default: (b)**, since "full parity" was the answer and the JSON payload already
     exists in `exportCommand`. *Trade-off:* one more control on a screen whose value is its simplicity.
     **Decided: (b), matching the written default.** The save dialog offers markdown or JSON. Closes
     the first D-P parity gap (Oscar, 2026-08-20).
  2. **`unlock --recovery-key`.** *Options:* (a) passphrase only, and a user who lost their passphrase
     is told to use the CLI; (b) a secondary "I only have my recovery key" path accepting the raw key
     hex. **Default: (b)**, because (a) dead-ends exactly the non-technical user this advance exists
     for, at the worst possible moment. *Trade-off:* a raw 32-byte key in a text field.
     **Decided: (b), matching the written default.** A secondary path on the unlock screen, **masked
     input, never persisted, never logged**, covered by §8.2's mitigations **in full**. Closes the
     second D-P parity gap (Oscar, 2026-08-20).

  **Note on the direction of parity.** The map is a *superset* relation, not a bijection: every CLI
  command has a GUI surface except `mcp`, and the GUI additionally has three surfaces the CLI does not
  (Settings, the tour, relocation). That asymmetry is deliberate and bounded, and §9's "the UI exposes
  nothing beyond that map" criterion is amended accordingly rather than quietly broken.

### D-Q. Light/dark theme

- **Option 1 — follow the OS setting only.** Simplest; zero new state.
- **Option 2 — follow the OS setting by default, with a manual override.** *Trade-off:* one more piece
  of state to design, store and keep in sync across relaunches.
- **Option 3 — light only.** Out of step with every other desktop app the audience uses.
- **Default: Option 1.** Reason: the behaviour every modern desktop app gets free from the OS.
- **Decided: Option 2**, overriding the recommended Option 1. The OS-preference read is the *initial
  value* of the override state, not a separate mechanism, and a manual choice persists.
  **Exception, by design:** the recovery-kit screen stays permanently high-contrast dark — that is a
  security-emphasis choice from D-M/§8.2, not a theme.
  **This decision is a precedent, not just a feature.** D-V adopts its shape verbatim for the UI
  language: **build one "system-or-override" preference mechanism and use it twice.** Both overrides
  live in Settings' Appearance/Language sections rather than floating on every screen as the mockups
  show; both take effect **live, without a restart**; both must work **while the vault is locked**. The
  store has four tenants (D-R(a)).

### D-R. Sync: status display and the vault-relocation wizard

Oscar asked how the GUI would let a user "connect" a sync provider. The accurate answer is that
**valija has no such command and never has** — sync works by the vault folder simply *being* inside a
folder the user's own sync client replicates, configured today by pointing `VALIJA_HOME` at it.

- **Option 1 — a guided relocation wizard.** *Flagged explicitly as new work — not even the CLI can do
  this.*
- **Option 2 — a read-only sync-status display** over what `status` and `doctor` already detect. Cheap;
  pure read; no new domain concept.
- **Option 3 — both.**
- **Default: Option 2**, on cost: most of the user-visible value for a fraction of the risk.
- **Decided: Option 3 — both.** The status half is a straightforward read (§3 fact 3 lists the fields).
  The wizard half is new work, with four sub-decisions, **all now decided**.

**D-R(a). Where the vault's new location is recorded — and who else needs to know.**
`resolveVaultPaths` reads `VALIJA_HOME` from the environment once at process start. An app launched
from a dock or start-menu icon inherits no shell environment, so after a relocation the app would
forget where the vault went. A new mechanism is required.

*Part one — where the app itself remembers.*
- **Option 1 — an OS-appropriate app-preferences file owned by the desktop app** (Electron's `userData`
  location: `~/Library/Application Support/Valija`, `%APPDATA%\Valija`, `~/.config/Valija`).
  *Trade-off:* the CLI does not read it, so the GUI and a terminal can disagree about where the vault
  is — mitigated by §4.7 step 35 showing the `export VALIJA_HOME=…` line.
- **Option 2 — reuse `VALIJA_STATE_HOME`** (`~/.valija-state/state.json`), already device-local and
  already outside the synced vault folder. *Trade-off:* that file is owned by the vault module and holds
  device *identity* and lineage bookkeeping; adding a pointer to the vault mixes two concerns, and if
  the CLI ever read it, a GUI-written file would start influencing CLI behaviour — a D11 change.
- **Option 3 — a new small file at a fixed path** (e.g. `~/.valija-app.json`) that **both** the GUI and
  the CLI read as a fallback under `VALIJA_HOME`. *Trade-off:* the cleanest end state — one answer to
  "where is my vault" for both surfaces — but it changes how the CLI resolves the vault for users who
  never open the GUI, which is a contract change (D11) and belongs in its own advance.
- **Default: Option 1**, with a mandatory precedence rule: **`VALIJA_HOME`, when set in the app's
  environment, always wins**; the remembered location is consulted only when it is not. Reason: the only
  option that adds the capability without changing any `src/` resolution rule or any CLI behaviour, and
  the env-var-wins rule preserves the escape hatch for anyone already scripting around `VALIJA_HOME`.
  Option 3 is the right *eventual* answer and should be named in the docs as the direction, not built
  here.
- **The store now has four tenants** — vault location, theme (D-Q), language (D-V), tour-seen (D-U(b)).
  This **strengthens Option 1**: three of the four are pure UI preferences with no meaning to a terminal,
  which makes Options 2 and 3 *worse*, not better — neither the device-identity file nor a shared
  vault-location file should have to learn what a theme is. Two requirements: the store is **readable and
  writable with the vault locked**, and it **never lives inside the vault folder or a relocation
  destination** (D-I(5)).

*Part two — the gap Oscar caught at Gate R, and the companion step it makes mandatory.*
The three options above all answer the same narrow question — *where does the desktop app remember the
vault's location* — and any of them answers it. **None of them answers the question that actually
determines whether a relocated vault keeps working.** Verified in `src/delivery/cli/installer.ts`: the
entry written into every client's config is `{ command: "npx", args: ["-y", "valija", "mcp"] }`, with
**no environment block**. That is a **separate OS process**, spawned by the AI client, which resolves
its vault through `resolveVaultPaths()` — `process.env.VALIJA_HOME ?? ~/.valija` — from whatever
environment the client hands it; an AI client launched from a dock icon carries no `VALIJA_HOME` either.
**The desktop app's preferences file is not consulted by that process and never will be.** So under
Option 1 alone, every already-connected AI tool keeps pointing at `~/.valija` and silently loses access
to the vault the moment it is relocated — the app reporting success while the user's tools report an
empty vault. The fourth revision missed this entirely.

- **Required companion step:** relocation must also **rewrite the vault's new path into every
  already-connected client's MCP config entry** — alongside the existing `mcpServers.valija` entry in
  `clientConfigPath(client)`, through the same read-abort-on-malformed → back up → merge → write
  discipline `installIntoClient` already has. The mechanism is the **per-server environment block** MCP
  client configs support (`"env": { "VALIJA_HOME": "<new path>" }`). §6 In item 20 makes confirming that
  each of the three clients honours it a **mandatory spike**; the named fallback — a vault-path argument
  on `valija mcp` — is **rejected here** because it is new CLI surface, and a client that does not honour
  `env` gets its limitation documented and the user gets the manual snippet instead.
- **The trade-off, stated plainly:** relocation now touches files this advance had not previously
  considered touching — **every connected client's own configuration file**, outside `VALIJA_HOME`, owned
  by a third-party application — as part of an operation whose headline is "move my vault". That is a
  wider blast radius than the fourth revision priced in. It is accepted because the alternative is not
  "slightly stale config" but "every AI tool silently detached from the vault", which is the failure this
  product can least afford and the one its audience is least able to diagnose.
- **Consequences that bind the plan:**
  1. **Relocation is one user action with three effects** — the files move (D-R(b), D-R(d)), the app's own
     memory updates, and connected clients are re-pointed. The wizard presents it as one action (§4.7).
  2. **Ordering is fixed:** move and verify first, then update the app's memory, then re-point clients.
     A client config is never touched before the vault is known to be at its destination, so a failed
     move leaves every client exactly as it was (§4.7 step 33).
  3. **Pre-flight covers clients too.** Step 30 lists which clients will be re-pointed and warns if any
     of their configs is unreadable or not valid JSON, **before** anything is written.
  4. **Failure is per client, reported, and never silent** — but it **never rolls the vault back**.
     Rolling a moved vault backwards to fix a config file is more dangerous than a stale entry. Any
     client that could not be rewritten is named individually with the manual snippet and a retry action
     (§8.12).
  5. **The connect flow writes the path too** (§4.4 step 17), always, not only when the vault is
     somewhere unusual — so there is no class of client entry that relocation has to *add* the key to
     rather than update.
  6. **`valija install` keeps its current behaviour byte-for-byte.** The shared writer takes the vault
     path as an explicit argument; the GUI always supplies it; the CLI does not, so §9's "every CLI
     command behaves exactly as before" criterion holds. Teaching the CLI to do the same is a sensible
     follow-up, **not this advance**.
  7. **Diagnostics and the connect screen show where each connected client points** (§4.4 step 16, §4.6),
     read from the same config file — without changing any row `valija doctor` prints. Without this
     there is no way for a user to notice a partial re-point.
  8. **The CLI is not re-pointed** and no shell profile is edited. §4.7 step 35's copyable
     `export VALIJA_HOME=…` line remains the terminal user's path, and the docs say so.
- **Decided: 2026-08-20.** Option 1 for where the app itself remembers — an app-owned preferences file
  with `VALIJA_HOME` always winning — **plus the companion step above as a hard requirement**, with its
  wider blast radius accepted knowingly. Closes the D-R(a) Gate R item, and corrects the gap the fourth
  revision left in its own reasoning.

**D-R(b). How the move actually happens.** Both files (`vault.json` + `vault.db`) must end up at the
destination, or nothing must change.
- **Option 1 — rename/move first** (`fs.rename`). Atomic *within one filesystem*. *Trade-off:* it **fails
  across filesystems** (`EXDEV`) — and "into a Dropbox folder on another volume" is a normal case — and
  it offers no window in which to verify the destination before the source stops existing.
- **Option 2 — copy, verify, then delete the source.** Copy both files; verify (at minimum: both present,
  byte-for-byte identical by digest, and `vault.json` parses as a valid header); only then remove the
  originals. On any failure: delete partial destination files, leave the source untouched, change nothing
  about the remembered location. *Trade-off:* the vault exists in two places for a few seconds, and needs
  free space for a second copy.
- **Option 3 — copy, verify by opening the destination with the session key, then delete.** Strongest
  verification, but it requires the vault to be *unlocked* during the move, which fights D-R(d).
- **Default: Option 2.** Reason: the only option that survives a cross-filesystem destination *and* never
  deletes the source before the destination is proven good. The two-copies window is bounded and strictly
  safer than the alternative failure mode, a vault that exists nowhere openable. **Non-negotiable
  regardless:** a destination that already contains a vault is **refused, never merged** (§8.12).
- **Decided: Option 2, matching the recommended default.** Copy, verify, then delete the source. Closes
  the D-R(b) Gate R item (Oscar, 2026-08-20).

**D-R(c). Where the relocation logic lives.** D-C's question, asked about a write path with no existing
use case.
- **Option 1 — a new use case in the vault module** (`RelocateVault` in `vault/application/use-cases/`,
  with a filesystem port and a tech-named adapter), called by the GUI now and available to a future
  `valija relocate`. Testable without a window. *Trade-off:* this advance then edits `src/` — gated code —
  for a capability only the GUI uses today, and it must be designed as a general operation rather than a
  wizard step.
- **Option 2 — a GUI-only application service** in `desktop/`. Faster, keeps `src/` untouched.
  *Trade-off:* the product's most dangerous file operation would live in its least-tested tree, reachable
  by exactly one adapter, invisible to the CLI and to `doctor` — the precise shape D-C Option 2 warns
  against, applied to the vault itself.
- **Option 3 — Option 1 plus a `valija relocate` CLI command in this advance.** *Trade-off:* real extra
  scope in an advance already carrying packaging risk.
- **Default: Option 1.** Reason: relocation manipulates the vault's own files and deserves the same
  architectural treatment as every other vault operation — a `Result`-returning use case behind a port,
  unit-testable with a fake filesystem, reviewable in isolation. Option 3's CLI command is a small
  follow-up once the use case exists.
- **Decided: Option 1, matching the recommended default.** A use case in `src/vault/`. Closes the D-R(c)
  Gate R item (Oscar, 2026-08-20). **Two riders the plan must carry at Gate P:** this advance therefore
  edits gated `src/` code and falls under `guard-implementation.sh` (D-L) — in `src/vault/` for the move
  and in `src/delivery/cli/installer.ts` for D-R(a)'s companion step — and **every refusal is a typed
  error code the GUI localizes**, never an English sentence the GUI prints (D-V(d)).

**D-R(d). What discipline the move runs under.** There is **no** advisory lock, lock file, busy timeout
or "relocate" concept in `src/` today, so this must be chosen, not inherited.
- **Option 1 — lock first, verify at rest, then move.** Run the existing `LockVault` (which already
  reports `sidecars`), refuse to proceed if any `-wal`/`-shm`/`-journal` sidecar exists, then move.
  *Trade-off:* locking drops the key from the keychain, so the user re-enters their passphrase afterwards
  — and if an MCP server is mid-call, it gets a `VAULT_LOCKED` it did not expect.
- **Option 2 — verify at rest without locking.** Less disruptive. *Trade-off:* the vault is unlocked, so
  any MCP tool call or CLI command can open the database *during* the move — precisely the corruption
  scenario this advance must avoid.
- **Option 3 — an advisory lock file in the vault folder for the duration.** *Trade-off:* a new file in
  the vault folder (M3 D-A), and a crash mid-move leaves a stale lock.
- **Default: Option 1.** Reason: relocation is rare, deliberate and irreversible-looking; paying one
  passphrase re-entry to guarantee nothing else has the database open is an obviously good trade. The
  wizard states the re-unlock up front (§4.7 step 31) so it reads as part of the ritual.
- **Decided: Option 1, matching the recommended default.** Lock first, verify at rest, then move. Closes
  the D-R(d) Gate R item (Oscar, 2026-08-20). *Note:* this, and not D-J(a), is what governs concurrency
  for relocation — a file move does not contend on SQLite locks.

### D-S. How much of `import`'s selection surface the GUI exposes

`valija import` takes `-p/--project`, `--from`, `--list`, `--pick`, `--query`, `--since`, `--all` and
`--dry-run`, with a deliberate list-first safety design (no selection flag ⇒ it only lists). A window has
different ergonomics: a checkbox *is* `--pick`, a filter box *is* `--query`.

- **Option 1 — literal flag parity**: a control for every flag. *Trade-off:* reproduces terminal
  ergonomics that exist because a terminal cannot show a selectable list.
- **Option 2 — behavioural parity**: file picker → auto-detected format → conversation list with
  checkboxes and a text filter → required target project → **Preview** (dry-run) → **Import**. The format
  override appears **only** when auto-detection fails, mirroring the `UNSUPPORTED_SOURCE` error's own
  advice. `--since` is covered by the list being sortable by date.
- **Option 3 — minimal**: "import everything into project X". *Trade-off:* discards the list-first safety
  property M2 deliberately built, for the audience least able to undo a bad import (there is no undo).
- **Default: Option 2.** Reason: it preserves every *behaviour* the flags exist to provide — see it
  first, choose precisely, preview before writing — while dropping only the flag *syntax*, which is not a
  feature. Option 3 is rejected outright: with no curation verbs, a user who imports the wrong 400
  conversations cannot remove them from the GUI at all.
- **Decided: Option 2, matching the recommended default.** Behavioural parity. Closes the D-S Gate R item
  (Oscar, 2026-08-20). Three things remain non-negotiable: a target project is required before any write,
  a dry-run preview is reachable before the real import, and per-conversation failures are shown rather
  than summarized away.

### D-T. How diagnostics and sync status are presented to D-N's audience

- **Option 1 — verbatim**: reproduce the CLI's rows as-is. Zero divergence risk, and reads like a terminal
  to someone who installed a GUI to avoid one.
- **Option 2 — plain-language only**: one health verdict, no raw detail. *Trade-off:* when something is
  actually wrong, the person helping the user needs the specifics that were just hidden.
- **Option 3 — split by audience**: a **Sync & safety** panel in plain words for D-N (is my vault where I
  think it is, is it safe to open elsewhere, has something forked, when will it auto-lock), and a separate
  **Diagnostics** screen showing the check rows close to verbatim with a **Copy report** button. Each check
  keeps a one-line plain explanation.
- **Default: Option 3.** Reason: the two answer different questions for different moments — "is my setup
  healthy?" is a support interaction; "is my vault safe to sync right now?" is part of daily use.
  Splitting them lets the main flow stay jargon-free without deleting the detail that makes a bug report
  actionable. **Riders:** the *checks themselves* come from the existing `doctor.ts` logic — the GUI must
  not re-derive "is the vault healthy" — and the keychain-probe side effect is disclosed before the check
  runs. The **Copy report** payload stays **English** in both UI languages and is the one place a raw
  `DomainError.message` may appear (D-V(d)); the plain-language explanation *around* each check is
  translated like everything else.
- **Decided: Option 3, matching the recommended default.** Split by audience. Closes the D-T Gate R item
  (Oscar, 2026-08-20). **One rider added by this revision:** the Diagnostics screen must not let
  `doctor`'s `node` row masquerade as an answer about the AI tools' runtime — `checkNode()` reads
  `process.versions.node`, which inside Electron is Electron's bundled Node. The screen distinguishes the
  app's runtime from the system Node that `npx -y valija mcp` will use (D-W, §4.6 step 26''').

### D-U. The first-run onboarding tour and the Settings screen it lives in

Oscar: *"¿podemos agregar un flujo de onboarding como carrousel skipeable para que el usuario sepa cómo
usar la aplicación? Y que desde la configuración pueda volver a verlo."* One feature and one dependency:
a skippable carousel, **and a Settings screen to replay it from**. Both are **in** (§6 In, items 15–16).

**D-U(a). When the tour plays, and on which paths.**
- **Option 1 — immediately after the recovery-kit acknowledgement, on the fresh-creation path only** (what
  the mockup shows). *Trade-off:* it misses the other branch of §4.2 step 3 entirely. A user who created
  their vault with `valija init`, or who points the app at an existing vault folder, never sees the tour
  despite never having seen the app. It ties "has seen this app" to "created a vault here", which is false
  in both directions.
- **Option 2 — the first time this installation reaches the dashboard, whichever path got it there**:
  after the recovery-kit acknowledgement on the create path, after the first successful unlock on the
  existing-vault path. One rule, one bit of state, both branches covered — and on the create path it is
  the *same moment* the mockup drew, so the mockup stays accurate.
- **Option 3 — never automatically; only from Settings.** *Trade-off:* a tour nobody is shown is a tour
  nobody watches, and D-N's audience is the least likely to go looking in Settings.
- **Default: Option 2.** Reason: the flag answers "has this person seen the app", not "did this person
  create a vault", and Option 2 is the only reading under which those are the same question.
- **Hard requirement regardless:** the tour **never precedes or interrupts the recovery-kit
  acknowledgement** (§8.17). The one screen a user cannot get back must not acquire a carousel in front
  of it.
- **Decided: Option 2, matching the recommended default.** First time this installation reaches the
  dashboard, on either branch. Closes the D-U(a) Gate R item (Oscar, 2026-08-20).

**D-U(b). Where the "already seen it" bit lives.**
- **Option 1 — the app-preferences store D-R(a) establishes**, as a fourth key. Device-local, readable
  with the vault locked, one boolean.
- **Option 2 — its own separate file.** *Trade-off:* two stores for the same class of state, and the
  second must independently solve the same path, format, atomic-write and corrupt-file-recovery questions.
- **Option 3 — in the vault.** *Rejected on the facts:* it would require an unlocked vault to decide
  whether to show a tour that explains how to unlock a vault; it would be a vault write, bumping the
  lineage stamp for a UI preference; and it would put that preference into a synced folder, suppressing
  the tour on a device that never saw it — precisely backwards.
- **Default: Option 1**, for the same reason D-Q reached for the same store. Two riders: the bit is **per
  installation, not per vault** — relocating, re-creating or unlocking a different vault neither replays
  nor suppresses the tour — and **Skip sets it**, so a skipped tour does not reappear and nag.
- **Decided: Option 1, matching the recommended default**, with both riders binding: a fourth key in the
  same preferences store, per installation, and **Skip sets it**. Closes the D-U(b) Gate R item (Oscar,
  2026-08-20).

**D-U(c). What the four slides may and may not claim.** The mockup's slides are (1) what valija is,
(2) save once, use everywhere, (3) browsing/search/pack, (4) local-first and encryption. Three of the four
need a guardrail — a content decision with consequences, not copywriting.
- **Slide 2 is the dangerous one.** "Save once, use everywhere" is true, but **saving does not happen in
  this app**. It happens from inside an AI tool through an MCP tool call (`SPEC.md` §3), and D-A ships no
  save affordance in the GUI at all. A slide implying a save button in this window sends the user hunting
  for something that does not exist. The honest version points at **Connect an AI tool** (§4.4) — one of
  the two next steps the empty dashboard already offers — with **Import your chat history** (§4.5) as the
  second half of the same slide.
- **Slide 3 must describe browse, search and taking a pack, and must not imply pinning, editing,
  organizing, tagging, deleting or "cleaning up" anything.** D-A excluded every one of those verbs.
  "Organiza tu contexto" / "Organize your context" is exactly the phrase to refuse, in both languages.
- **Slide 4 must not overclaim.** It states what is true — encrypted at rest, nothing leaves this machine,
  and the one consequence that matters: **there is no password reset, and the recovery kit is the only
  other way in**. No "military-grade", no "unhackable", no absence-of-servers phrased as a marketing claim
  rather than a fact.
- **Slide 1 is free copy**, and should do the job the empty dashboard cannot: say in one sentence what the
  vault is for and name the tools it is meant to work with.
- **Default: the mockup's four slides, with those guardrails binding on the copy**, and slide 2 rewritten
  to point at connecting a tool rather than at a save action that does not exist. Reason: the tour is the
  first and possibly only explanation this audience reads, and a tour describing a different product than
  the one that shipped is worse than no tour. *Alternative named and rejected:* a fifth slide covering
  import and connect separately — four slides is already at the edge of what a skippable carousel earns.
- **Decided: the written default — the mockup's four slides, with all three guardrails binding.** Slide 2
  is rewritten to point at connecting a tool / importing history and **never at "saving"**; slide 3 names
  **no curation verb**; slide 4 states the **no-password-reset fact without marketing language**. Closes
  the D-U(c) Gate R item (Oscar, 2026-08-20). The slide copy is reviewed against these three guardrails in
  **both** languages before it ships (§8.17).

**D-U(d). Does Settings need a CLI counterpart?**
- **Option 1 — Settings is GUI-only chrome with no parity obligation.** It controls four device-local UI
  preferences that do not exist as a concept in `src/` and are meaningless to a terminal: a theme, a
  language, a tour flag, and D-R(a)'s location memory — which already has its own escape hatch for
  terminal users (§4.7 step 35). Nothing here is a *capability* the CLI lacks.
- **Option 2 — introduce a `valija config` command.** *Trade-off:* invents a configuration concept the
  product has deliberately never had, makes the CLI own a theme, and turns D-R(a)'s Option 3 into a fait
  accompli through the back door.
- **Option 3 — Settings additionally exposes the environment-driven settings as editable fields.**
  *Rejected:* D-R(a)'s precedence problem repeated for *behaviour* instead of *location*, letting a GUI
  silently change how the CLI and the MCP server run. The GUI may **display** those values — the Sync &
  safety panel already does — and must not edit them.
- **Default: Option 1**, with the boundary stated in the docs rather than left implicit: **Settings is not
  configuration.** Reason: parity is a promise about *capability*, and none of these four preferences is a
  capability a terminal user is missing.
- **Decided: Option 1, matching the recommended default.** Settings is GUI-only chrome; **no CLI
  counterpart is invented**, and the docs say so and why. Closes the D-U(d) Gate R item (Oscar,
  2026-08-20).

### D-V. Two languages: English and Spanish

Oscar was asked whether the language switch should **follow the OS with a manual override** (D-Q's
dark-mode pattern exactly) or be **manual-only**, and chose **follow-the-OS-with-a-manual-override**,
explicitly mirroring D-Q. That settles the *behaviour* (D-V(a)) and **reverses D-N's English-only rider**.

**D-V(a). The switching model — recorded from the start, never open.** The app resolves the OS language
at launch and uses it as the initial value of a single override preference; Settings offers *Follow
system* / *English* / *Español* (§4.8 step 39); a manual choice persists in the same store as the theme.
**Build one "system-or-override" mechanism and use it twice.** The switch applies **live, without a
restart**, and Settings — hence the language switch — is reachable **while the vault is locked**.

**D-V(b). How translated strings are stored and loaded.**
- **Option 1 — static catalogs bundled in the app**, one per language, keyed by stable string ids, loaded
  from the application bundle at runtime. English is the source-of-truth catalog and the runtime fallback.
- **Option 2 — source strings as keys**: English text inline in components, extracted by tooling.
  *Trade-off:* every copy edit to an English sentence silently orphans its Spanish translation; "is this
  string translated?" stops being answerable by looking at a catalog.
- **Option 3 — catalogs fetched or updated over the network.** **Rejected outright, not weighed:** §8.5
  forbids every network call, and a translation string is *content*. "It's only a language pack" is
  precisely the shape a first exception takes.
- **Option 4 — one build per language.** *Trade-off:* triples D-G's already-heavy artifact matrix and makes
  D-V(a)'s in-app override impossible.
- **Default: Option 1.** Reason: the only option in which a missing translation is a **mechanically
  detectable fact** — a key present in one catalog and absent in the other — rather than a discovery in
  production, and in which the no-network rule holds *by construction*. Riders: keys namespaced by screen
  so coverage is reviewable per screen; a missing key falls back to English **and fails the test suite**;
  no user-facing sentence assembled by concatenating fragments.
- **Decided: Option 1, matching the recommended default.** Static catalogs bundled in the app, stable
  string ids, English as source of truth and runtime fallback, with all three riders binding. Closes the
  D-V(b) Gate R item (Oscar, 2026-08-20).

**D-V(c). How complete Spanish must be to ship.**
- **Option 1 — both catalogs structurally complete**, enforced by a test asserting identical key sets, with
  translation *quality* reviewed by Oscar (a native speaker) rather than asserted by a machine. Ship
  criterion: a Spanish walkthrough of §4's steps shows no English UI string, save D-V(d)'s three documented
  exceptions.
- **Option 2 — English complete, Spanish partial, gaps documented.** *Trade-off:* cheaper, and it produces
  the worst version of a bilingual app — a Spanish UI that turns English precisely on the screens nobody
  got to, which are always the error and edge-case screens.
- **Option 3 — Spanish first, English second.** No reason to: the repo, the docs, `src/`'s messages and
  every collaborator-facing artifact are English.
- **Default: Option 1**, with the split stated plainly: **structural completeness is an acceptance
  criterion; literary quality is not.** One content constraint that *is* checkable: the Spanish copy is
  **neutral Latin American Spanish, "tú" forms, no voseo**.
- **One documented gap:** **`docs/` stays English.** *Options:* (a) English docs only — default;
  (b) translate the GUI page, including D-G's per-OS bypass instructions. (a) is chosen because two copies
  of a doc set drift, and a *drifted* translation of security instructions is worse than an untranslated
  one; the cost is named honestly in §4.1 and §8.17.
- **Decided: Option 1, matching the recommended default**, and **the documented gap's option (a) confirmed
  — `docs/` stays English.** Both catalogs structurally complete with a test-enforced identical key set;
  translation quality reviewed by Oscar, not machine-asserted; neutral Latin American Spanish, "tú" forms,
  no voseo. Closes the D-V(c) Gate R item (Oscar, 2026-08-20).

**D-V(d). What is deliberately never translated.** Three strings this app displays are produced by `src/`
and pinned **byte-for-byte** by §9's existing criteria, which D-V does not get to weaken:

| String | Produced by | Why it stays English |
|---|---|---|
| The recovery kit body | `renderRecoveryKit` (`src/vault/infra/recovery-kit.ts`) | §9 requires "the exact output of `renderRecoveryKit`". Translating it would fork the kit's wording between two surfaces, for the one artifact a user may have to read years later on another machine (D-M) |
| The manual install instructions | `manualInstructions()` (`src/delivery/cli/installer.ts`) | §4.4 step 18 requires the block that function produces; it is a JSON snippet plus file paths, meant to be pasted, not read |
| The context pack markdown | `renderContextPackMarkdown` | §9 requires byte-identity with `valija export`. It is **vault content**, not UI copy — translating a user's own saved context is not a coherent operation |

Plus a fourth, by rule rather than by pinning: **`DomainError.message`**. The GUI localizes from the
**code** and never renders the message in the main flow. The raw message may appear in Diagnostics'
**Copy report** payload, a support artifact that stays English on purpose.
- **The consequence the UI must handle honestly: a Spanish UI will show an English recovery kit.**
  *Options:* (a) show it as-is with **one localized sentence** explaining that the kit is written and
  stored in English so it reads identically everywhere — **default**; (b) a longer localized explanation
  wrapping a byte-exact English body — same thing, more words, more to translate; (c) translate the kit —
  **refused**: it breaks §9 and D-M.
- **Rider on error coverage:** every error code reachable from the enumerated IPC surface has copy in both
  catalogs, or maps to a stated generic fallback that names the code. The fallback must never be the raw
  English domain message.
- **Decided: option (a), matching the written default.** The English recovery kit is shown as-is, with
  **one additional localized sentence** explaining that it is written and stored in English on purpose so
  it reads identically on any machine, in any language, years later. The same one-sentence treatment
  applies to the manual install block and the pack markdown. §8.17 makes this a **security-copy
  requirement, not a nicety**. Closes the D-V(d) Gate R item (Oscar, 2026-08-20).

**D-V(e). Dates, numbers and plurals.**
- **Option 1 — format with `Intl` against the active UI language**, so a Spanish UI never shows
  `Aug 20, 2026` mid-sentence, and every count goes through a plural-aware form in both languages.
- **Option 2 — format against the OS locale regardless of the UI language.** *Trade-off:* coherent with
  the rest of the OS, incoherent inside the window — a Spanish sentence with an English month.
- **Option 3 — ISO dates and bare numbers everywhere.** *Trade-off:* unambiguous, and reads like a log
  file to exactly the audience D-N chose.
- **Default: Option 1.** Reason: the override exists because the user told the app which language they
  read, and a date in the middle of a sentence is part of that sentence. *Note:* there is **no `Intl`
  usage anywhere in `src/` today**, the CLI's formatting does not change, and a naive `${n} items`
  template is the specific thing that breaks — plurals are a mechanism, not a copy detail.
- **Decided: Option 1, matching the recommended default.** Format with `Intl` against the **active UI
  language**, not the OS locale. Closes the D-V(e) Gate R item (Oscar, 2026-08-20).

**D-V(f). Does any of this touch `src/`? No — and that is a decision, not an accident.** Verified: no i18n
library, locale value, catalog or `Intl` usage anywhere in `src/`. **The CLI stays English and is not a
translation surface in this advance.** Binding consequences:
1. **No use case, port, repository, DTO, policy or error constructor gains a `locale` parameter.**
2. **No `src/` string is moved into a catalog** "while we're in there".
3. The GUI's catalogs, the preference store and the tour live **entirely in `desktop/`** (D-L).
4. `RelocateVault`'s refusals follow the same rule as every other error: a stable code the GUI localizes,
   an English message the domain owns. **The same applies to any error the client re-pointing step
   returns** (D-R(a)).
Localization therefore **blocks on nothing** in `src/` and can be sliced independently of every other
decision here — a scheduling property worth knowing at Gate P (§11). *Note:* points 1–3 remain true even
though this advance does edit `src/` for D-R(c) and D-R(a) — those edits are about vault files and client
configs, and carry no locale.

**D-V(g). How the OS language is detected.**
- **Option 1 — match on the primary subtag only**: `es`, `es-EC`, `es-419`, `es-ES` → Spanish; everything
  else → English. One `es` catalog, deliberately region-neutral.
- **Option 2 — ship regional variants** (`es-EC`, `es-MX`, `es-ES`). *Trade-off:* multiplies the
  translation surface for distinctions this app's fifteen screens will never express.
- **Option 3 — ask the user on first launch.** *Trade-off:* a language question is a poor first
  impression, and D-Q established that following the OS is the expected default for this class of
  preference.
- **Default: Option 1.** Reason: it matches D-V(c)'s neutral-Spanish decision exactly — one catalog, no
  regionalisms — and the manual override covers anyone the detection guesses wrong for. *Rider:* the
  detected language is the *initial value* of the override, never a separate code path.
- **Decided: Option 1, matching the recommended default.** Primary-subtag match: `es*` → the one neutral
  Spanish catalog, everything else → English, with the manual override in Settings covering the rest.
  Closes the D-V(g) Gate R item (Oscar, 2026-08-20).

### D-W. Node and npm remain a prerequisite this advance does not remove *(new in this revision, 2026-08-20)*

Raised by Oscar as a follow-up to D-R(a)'s gap. A user who only ever installs the desktop app still needs
**Node and npm on their machine** for `npx -y valija mcp` to run at all — that is the command
`installer.ts` writes into every AI client's config, and it is executed by the client, not by this app.
Installing Valija.app does not provide it. Nothing in the product tells the user this today.

- **Option 1 — detect and say so plainly, fix nothing.** The connect flow probes whether Node/npm are
  actually runnable and, if not, states it in plain language before the user connects a tool to a command
  that would fail later. No runtime is bundled and no server is hosted. *Trade-off:* the prerequisite
  remains, so a user without Node still has a manual step outside the app — but they learn about it at the
  moment it matters instead of discovering a silently broken tool days later.
- **Option 2 — bundle a Node runtime with the app** and point the client's config at it. Removes the
  prerequisite entirely. *Trade-off:* real scope — a second runtime in the bundle, per-OS/arch, plus a
  packaged copy of `valija` for it to run, plus the question of which one wins when a system `valija` also
  exists. It also changes what the MCP entry looks like in third-party config files.
- **Option 3 — the app hosts the MCP server itself.** No external Node needed, and the app becomes the
  server. *Trade-off:* directly contradicts D-K/§8.11 ("the GUI does not run, embed or supervise an MCP
  server"), makes the vault's availability to AI tools depend on the app being open, and is a product
  redesign, not a packaging fix.
- **Option 4 — do nothing; assume Node is present.** *Trade-off:* the exact failure this advance's audience
  is least able to diagnose — an AI tool that reports no vault, with no error anywhere the user can see.
- **Default: Option 1.**
- **Decided: Option 1** (Oscar, 2026-08-20, through the interactive prompt). **Explicit non-goals, stated
  so a planner does not helpfully solve them:** **no Node.js bundling and no app-hosted MCP server in this
  advance.** Removing the dependency is real scope and is **named as future work, not designed here**.
  What ships is the detection and the plain-language statement:
  1. The probe is a **real check** — resolve and execute the `node`/`npx` the client would use and read a
     version — not an assumption from `process.versions`, which inside Electron reports Electron's own
     bundled Node (§3 fact 6).
  2. It runs **in the connect flow** (§4.4 step 16'), before the user connects, and its result also appears
     on the Diagnostics screen as a row distinct from the app's own runtime (§4.6 step 26''').
  3. It **warns, and does not block.** A user may install Node minutes later, and refusing to write a
     config entry would strand them. The copy states plainly that the tool will not reach the vault until
     Node is installed.
  4. The message is **localized copy keyed to a code** like every other failure (D-V(d)), and the
    prerequisite is documented in the GUI docs (§6 In, item 18).

---

## 8. Security surfaces that must not weaken

1. **Key material stays where it is.** The 32-byte key exists in the OS keychain and in main-process
   memory, and nowhere else — no renderer copy, no `localStorage`/`IndexedDB`/`sessionStorage`, no file,
   no log line, no crash dump, and **never in the app-preferences file D-R(a) introduces**. **No
   substitution of the crypto or keychain libraries** (`argon2`, `@napi-rs/keyring`,
   `better-sqlite3-multiple-ciphers`) to simplify packaging: a pure-JS Argon2id or an alternative keyring
   is a crypto/session change wearing a build-tooling disguise.
2. **Raw key material on screen — the risk Oscar accepted (D-M).** A GUI window is screenshot-able,
   screen-recordable, readable by accessibility and automation APIs, capturable by screen-sharing software
   the user forgot was running, and structurally invites a "save it for me" button. **Required
   mitigations, none optional:** shown exactly once; never written to disk by the app; not re-openable
   after acknowledgement; not retained in any renderer state after dismissal; an explicit acknowledgement
   before continuing; the copy action warned as putting the raw key on a clipboard other applications can
   read; **and nothing — including the welcome tour — placed between the user and that acknowledgement**
   (§8.17). **The same mitigations apply in full to the recovery-key *input* path** now that D-P gap 2 has
   landed on option (b): masked field, never persisted, never logged, never echoed back, discarded as soon
   as `UnlockVault` returns.
3. **No plaintext at rest, anywhere new.** No cache of items or packs, no search history, no
   recently-viewed list containing content, no window-state file holding item text, no import staging file
   (the existing reader inflates archives **in memory** — keep it that way), no Electron `crashReporter`,
   no devtools in production builds. After the app quits, the only valija files on disk are the ones that
   existed before it started, plus the preferences file of §8.4.
4. **The app-preferences store (D-R(a)) holds pointers and preferences only.** Exactly four things and no
   fifth: a vault path, a theme choice, a language choice, and one boolean recording that this installation
   has seen the welcome tour. **Never** key material, never a passphrase, never vault content, never a
   recovery kit, never a cached item — and never anything *content-adjacent*: no "last project you viewed",
   no "resume where you left off", no count of items seen, no tour-progress analytics. It is not encrypted;
   it must never hold anything that would need to be; and it must be **readable with the vault locked**,
   which is only safe *because* nothing in it is secret.
5. **No network, at all.** No auto-update feed, no analytics, no crash upload, no remote fonts or icons, no
   remote origin loadable by any window — and, explicitly, **no sync-provider client, API call, OAuth flow
   or upload of any kind**: the relocation wizard moves a folder on the local filesystem and edits local
   config files, and nothing more. **A bundled translation catalog is not an exception** (D-V(b)): no
   language-pack download, no translation service, no locale-detection endpoint, no CDN-hosted i18n
   runtime. A Content-Security-Policy forbidding remote origins, plus denial of `will-navigate` and
   `window.open` to non-local URLs, is the enforcement — not a promise in a README. **The Node probe of
   D-W is not an exception either:** it executes a local binary and reads its version; it downloads
   nothing, and it must not "helpfully" run an install command.
6. **The IPC surface is a trust boundary and is enumerated.** One channel per use case, arguments validated
   at the boundary with zod exactly as the MCP server does; no channel that accepts SQL, a module name, a
   shell command, or an arbitrary filesystem path. **Filesystem paths never originate in the renderer**:
   the main process opens the native dialog for import, export and relocation and keeps the result.
   **Client config paths likewise come from `clientConfigPath(client)` over the closed `CLIENTS` list**,
   never from the renderer — the re-pointing step of D-R(a) must not become an arbitrary-file-write channel
   by accepting a config path or a client name the renderer invented.
7. **Clipboard is an egress mechanism and is documented as one.** Plaintext egress by explicit user action
   already exists (`valija export -o`), so this changes the mechanism, not the threat model — but a
   one-click copy of an entire context pack deserves a sentence in the GUI docs, and it must never happen
   automatically. The other copy affordances (the recovery key, the `export VALIJA_HOME=…` line, the manual
   install block, the diagnostics report) are named individually in the docs.
8. **Vault integrity and identity.** The GUI resolves `VALIJA_HOME` and `VALIJA_STATE_HOME` exactly as the
   CLI does, is the **same device**, never mints a second device id, never writes a lineage stamp except
   through `ImportItems`' single per-batch bump, and leaves `vault.db` as a single file at rest with no
   sidecar (M3 D-A). The preferences store is device state and never lands inside the vault folder or a
   relocation destination.
9. **Writes to third-party AI client configs stay outside the vault — and are now made by two flows, not
   one.** Both the `install` path (§4.4) and relocation's re-pointing step (§4.7 step 34') edit third-party
   client config JSON, through `installer.ts`'s existing read-abort-on-malformed → back up → merge → write
   discipline, and through the **same single writer** (§5.1). Neither may ever open `vault.db`, read or
   write the keychain entry, or change lock state or lineage. **What they write is a filesystem path, not a
   secret** — never a key, never a passphrase, never a vault id used as a credential. A malformed existing
   config is **never overwritten**, in either flow.
10. **Import is a real vault write and gets write-path treatment.** It goes through `ImportItems`' single
    `session.write` (one transaction, one lineage bump), re-validates content and tags at the vault
    boundary, respects the existing decompression-bomb caps in `FileExportReader` (128 MiB per entry /
    256 MiB total) rather than reimplementing archive handling, and reports per-conversation failures
    instead of swallowing them. **It must not become a curation back door.**
11. **The MCP surface is untouched** — 5 tools, 2 prompts, stdio. The GUI neither embeds, hosts, bundles a
    runtime for, nor proxies an MCP server (D-K, D-W). Imported items remain excluded from every pack an
    MCP tool returns. No MCP response is translated, and no tool learns what a locale is. D-R(a)'s
    companion step changes **only the environment a client hands the existing server**, never the server,
    its tools, its arguments or its transport.
12. **Relocating an encrypted vault must not weaken a single guarantee (D-R).** The newest and
    least-precedented surface in the advance; each of these is a hard requirement:
    - **No stale copy at the old location after a successful move.** `vault.db` is ciphertext, so this is
      not a plaintext leak — it is worse in a different way: a leftover copy is a complete, openable vault
      whose key the user still holds, and two openable vaults with the same vault id is the exact fork
      scenario M3 spent an advance on. `vault.json`, meanwhile, **is** plaintext (vault id, salt, KDF
      parameters), and leaving it behind is a real, if smaller, residue.
    - **Verify before deleting anything** (D-R(b)). Never the other order, and never "delete then copy".
    - **No partial state on failure.** A failed move leaves the vault whole and openable at exactly one
      location, removes partial destination files, and does not update the remembered location. There is
      no outcome in which the vault is split across two folders such that neither opens.
    - **Never overwrite or merge a vault at the destination.** No "replace", no "merge", no
      backup-and-clobber.
    - **Never move while a fork is unresolved**, and never move a conflicted copy or a stale
      `.pre-NNN.bak` along with the vault (D-I).
    - **Never relocate device state.** `VALIJA_STATE_HOME` stays where it is and never lands inside the
      destination folder (M3 D-C). The same applies to the preferences store.
    - **The keychain entry is keyed by vault id, which relocation does not change.** The move must not
      create, duplicate or orphan a keychain entry; the only keychain effect is the deliberate lock of
      D-R(d).
    - **No connected client is left pointing at a vault that is no longer there** *(new in this revision,
      D-R(a))*. Partial re-pointing needs the same all-or-nothing care the file move itself requires, and
      it gets it in three ways rather than by pretending N file writes can be atomic: **(i)** every
      connected client's config is checked for readability and valid JSON in pre-flight, **before** the
      move starts, and an unreadable one is surfaced there (§4.7 step 30); **(ii)** no client config is
      touched until the vault is verified at its destination, so a failed move leaves every client exactly
      as it was; **(iii)** a client that still cannot be rewritten afterwards is **named individually, with
      the manual snippet and a retry action** — never summarized, never silently skipped, and never a
      reason to roll the vault back, because reversing a completed move to fix a config file is more
      dangerous than a stale entry. A relocation that ends with any client un-repointed is a **reported,
      user-visible state**, not a success.
13. **Diagnostics is not a passive read.** `doctor`'s keychain check writes and deletes a probe entry, its
    SQLCipher check loads the native module, and its vault check opens the database. None of that is new,
    but the GUI must disclose the keychain probe (§4.6 step 26') and must not run diagnostics
    automatically, silently, or on a timer. **D-W's Node probe executes a local binary** and is disclosed
    the same way.
14. **Idle auto-lock may only get tighter, never looser.** No background polling, no keep-alive, no "stay
    unlocked while the window is open". The GUI honours `VALIJA_AUTOLOCK_MINUTES` identically to the CLI —
    and Settings cannot change it (D-U(d)). Watching the tour or opening Settings does not touch the idle
    clock, because neither opens a session.
15. **Unsigned distribution has a security cost (D-G).** Documenting "right-click → Open" or "Run anyway"
    trains precisely the behaviour malware relies on, for an audience least equipped to judge when it is
    safe. Accepted, with published SHA-256 checksums and a run-from-source path as the mitigations, stated
    openly in the docs. Those docs are English-only this advance (D-V(c)) — a gap, not a mitigation.
16. **Only fixture data in screenshots and docs.** Any screenshot uses
    `src/testing/__fixtures__/golden-vault/`, whose passphrase and key are public by design and labelled as
    such — never a real vault, never a real key, never a real recovery kit. Applies in **both** languages.
17. **Security-relevant copy is itself a security surface.** This is the first advance to put explanatory
    text, and a second language, in front of the product's most consequential rituals. Three requirements:
    - **The onboarding tour must not overclaim.** Slide 4 states what is true — encrypted at rest, nothing
      leaves this machine, **no password reset exists, and the recovery kit is the only other way in** —
      and promises no safety the product cannot deliver. A tour that leaves a user *more* relaxed about
      losing their passphrase has actively damaged §8.2's ritual.
    - **The tour never precedes or interrupts the recovery-kit acknowledgement** (D-U(a), §8.2). Ordering
      here is a security property, not a UX preference.
    - **Translated warnings must preserve the meaning of the English ones, not their length.** Five places
      carry real consequence if softened, shortened or made ambiguous in Spanish: the passphrase warning
      (*"if you lose it AND the recovery kit, your data is gone"*), the clipboard warning on the copy-key
      action, **the relocation wizard's refusals and its per-client re-pointing failures** (§4.7 steps 30
      and 34'), the schema-migration confirmation (D-J(b)), and D-W's Node-missing warning. Their Spanish
      copy is reviewed as a **security artifact**, not as UI polish. The recovery-kit body, the manual
      install block and the pack markdown stay byte-exact English (D-V(d)), each explained by **one
      localized sentence** rather than silently mixed — and **nobody "fixes" the mixed-language screen by
      translating `renderRecoveryKit`** (§11, fourth risk).

---

## 9. Acceptance criteria

A reviewer should be able to check each line without guessing what was intended.

**Product invariants**

- [ ] The MCP surface is byte-for-byte unchanged: 5 tools with the same arguments, 2 prompts, stdio only.
      The GUI neither runs, embeds, hosts nor bundles a runtime for an MCP server.
- [ ] No change to the schema, to any migration, to the vault format, to `vault.json`, to the Argon2id
      parameters, to the key format, or to the SQLCipher configuration.
- [ ] No change to `argon2`, `@napi-rs/keyring`, or `better-sqlite3-multiple-ciphers` as the libraries in
      the crypto/session/storage path.
- [ ] **Every CLI command behaves exactly as before** — including `valija install`, whose written config
      entry is unchanged (D-R(a)(6)) — and `npm run typecheck && npm run lint && npm run test` pass, with
      the existing CI matrix neither slowed nor gated by desktop packaging jobs.
- [ ] The published npm package's contents are unchanged (`files` remains an allow-list excluding the
      desktop tree).
- [ ] `docs/SPEC.md` §2's "GUI … → later" Out line, §1's "one binary surface" sentence, §10a's "import is
      CLI-only" sentence, **and D11** are corrected; D11's new sentence names the preferences file as UI
      preferences and a location hint — not configuration — and notes that relocation also records the
      vault path in connected clients' MCP configuration (D-O). No milestone number is assigned.

**Parity (D-P, revised)**

- [ ] Every CLI command in D-P's parity map has the GUI surface that map names, and `mcp` is the only one
      deliberately absent — with that absence stated in the GUI docs.
- [ ] Both parity gaps are **implemented**: the save dialog offers markdown **and JSON**, and the unlock
      screen offers a recovery-key path.
- [ ] The UI exposes nothing beyond that map — no verb added "while we were in there" — **with exactly
      three stated exceptions: Settings, the welcome tour, and the relocation wizard**, of which only the
      wizard touches the vault, and it does so within D-R's rules.
- [ ] No code path in the desktop app calls `SaveContext`, or any repository mutation outside
      `ImportItems`. The UI contains no edit, pin, archive, delete, rename or retag affordance, disabled or
      otherwise — **and no onboarding slide implies one** (D-U(c)).

**The shell**

- [ ] With a fixed clock, the pack the GUI displays for a project is **byte-identical** to the stdout of
      `valija export <project>` for the same vault, asserted by a test comparing the two strings — not by
      eye. Under a real clock the only permitted difference is the `generated` timestamp. **This holds in
      both UI languages.**
- [ ] The project list, item list (including the `--type` filter, `imported` included), and search results
      are produced by the **same use cases** the CLI calls; a test exercises each against the golden-vault
      fixture.
- [ ] Sessions are opened per action and closed; no `Database` handle outlives a user action.
- [ ] No timer or interval refreshes vault state; refreshes are user- or focus-driven, so idle auto-lock is
      not extended by leaving the window open.
- [ ] After any GUI session, the vault folder contains `vault.json` and `vault.db` only — no `-wal`,
      `-shm`, or `-journal` sidecar, **and no preferences file**.
- [ ] A behind-schema vault shows the explicit "this will update your vault" confirmation, naming the
      ciphertext backup, before `migrate()` runs; a current-schema vault never sees it (D-J(b)), and the
      behaviour is stated in the GUI docs.

**Vault initialization (D-M)**

- [ ] Init runs through the existing `CreateVault` use case, with `parsePassphrase`'s rules enforced (not
      re-implemented in the renderer) and a mismatch caught before anything is written.
- [ ] The recovery kit displayed is the exact output of `renderRecoveryKit`, shown once, never written to
      disk by the app, not re-openable after acknowledgement, and gated behind an explicit "I stored this
      offline" acknowledgement.
- [ ] **Nothing appears between the user and that acknowledgement** — in particular the welcome tour never
      plays before it (D-U(a), §8.17).
- [ ] The raw key hex does not appear in any log, any persisted renderer state, the app-preferences file,
      or any file written by the app — **including the recovery key typed into the unlock path** (D-P
      gap 2), which is masked, never persisted and never logged.
- [ ] After GUI init, `valija status` in a terminal reports the same vault as initialized and unlocked;
      there is exactly one vault, one keychain entry, one device identity.
- [ ] The copy-key action warns that the clipboard is readable by other applications, **in the active UI
      language**.
- [ ] Nothing in the app can destroy or re-initialize an existing vault (`VAULT_ALREADY_EXISTS` is
      surfaced in plain language from the code, not the domain message).

**Session and identity (D-H, D-I)**

- [ ] `valija unlock` in a terminal leaves the GUI unlocked with no second prompt; `valija lock` leaves the
      GUI locked; unlocking in the GUI unlocks MCP tools. One keychain entry, shared.
- [ ] The macOS keychain-ACL behaviour is recorded — silent, prompts once, prompts every time, or fails —
      with the exact macOS version, **for both reading the CLI's entry and creating the diagnostics probe
      entry**, and the answer appears in the GUI docs.
- [ ] Idle auto-lock applies to the GUI identically to the CLI, and is not extended by opening Settings or
      watching the tour.
- [ ] The GUI resolves `VALIJA_STATE_HOME` exactly as the CLI does and **mints no new device id**; a test
      proves a CLI write followed by a GUI import on the same machine is a fast-forward, not a fork.
- [ ] A forked vault shows the `VAULT_FORK_DETECTED` notice on unlock, in plain language, naming the vault
      folder — and the UI offers **no** merge, no "keep this one", and no deletion of a conflicted copy.

**Import (D-P revised, D-S Option 2)**

- [ ] The import flow calls the existing `ImportConversations` → `ImportItems` path unchanged. No parser,
      chunker, selection rule, archive reader or repository write is re-implemented in the desktop tree.
- [ ] The selection surface is behavioural parity: checkbox selection, a text filter, a date-sortable list,
      a format override **only** on detection failure, a required target project, and a reachable dry-run
      preview before the real import.
- [ ] Importing N conversations produces **exactly one** lineage generation bump, verified by reading the
      generation before and after.
- [ ] Re-importing the same file into the same project does not duplicate items, and per-conversation
      failures are displayed, not summarized away.
- [ ] The result screen states in plain language that imported items are searchable and visible in the
      project but **do not appear in context packs**; a test asserts the pack for that project is unchanged
      by the import.
- [ ] The archive caps in `FileExportReader` still apply, and no import temp file is written to disk.
- [ ] A large import does not leave the window looking frozen or unresponsive.

**Connect your AI tools (D-P, D-R(a), D-W)**

- [ ] The guided connect step calls the existing `install` path through `installer.ts`'s existing
      backup-and-merge discipline — no new parsing or writing logic for any client's config format is
      authored in the GUI, and there is exactly **one** function in the codebase that writes a client
      config.
- [ ] The entry the GUI writes names the vault folder the app is using, and a test proves that an entry
      written by the GUI launches an MCP server that resolves **that** folder.
- [ ] This path never opens `vault.db` and never touches the OS keychain entry; a test proves a connect
      action leaves the vault's lock state and lineage untouched.
- [ ] Every failure mode `installer.ts` already surfaces (missing client, malformed existing config,
      already-configured) is shown in plain language — not a raw error — and the manual instructions are
      offered as a fallback.
- [ ] **When Node/npm is not runnable on the machine, the connect screen says so plainly before connecting**
      (D-W), in the active UI language, from a real probe of the executable rather than `process.versions`;
      it **warns without blocking**, and the GUI docs state the prerequisite.

**Diagnostics and sync status (D-R status half, D-T Option 3)**

- [ ] Diagnostics and the Sync & safety panel are **two screens split by audience**: the panel is
      plain-language for daily use, the Diagnostics screen shows the check rows close to verbatim with a
      one-line plain explanation each.
- [ ] The diagnostics screen runs the checks `doctor.ts` already defines, using that logic rather than
      re-deriving any of them, and distinguishes fatal failures from warnings the way the CLI's exit code
      does.
- [ ] The screen **distinguishes the app's own Node runtime from the system Node the AI tools use**, so
      `checkNode()`'s row is not read as an answer about `npx -y valija mcp` (§3 fact 6, D-W).
- [ ] For each connected client, the screen shows **which vault folder that client's entry points at**, so
      a partial re-point after a relocation is visible — without changing any row `valija doctor` prints.
- [ ] The screen discloses the keychain probe before running, and diagnostics never runs automatically,
      silently, or on a timer.
- [ ] The sync panel displays, from `VaultStatusOutput` and `VaultFolderInspection` only: vault folder,
      recognized-sync-folder hint, conflicted copies, stale `.pre-NNN.bak` backups, at-rest state,
      generation, last writer and whether it is this device, auto-lock TTL and idle time — **all read-only,
      with no editable field**.
- [ ] The sync panel performs **no write of any kind** — no lineage bump, no session, no keychain change,
      no file created in the vault folder.
- [ ] The **Copy report** payload is English in both UI languages and is the only place a raw
      `DomainError.message` may appear.

**Vault relocation (D-R)**

- [ ] Relocation is a use case in `src/vault/` (D-R(c)), unit-testable without a window, with every refusal
      returned as a typed code the GUI localizes.
- [ ] The wizard refuses, **before writing anything**, when: a vault already exists at the destination; the
      destination is missing, unwritable, the same folder, or inside the current vault folder; or the
      current folder has an unresolved conflicted copy or a stale upgrade backup. Each refusal is a
      plain-language message in the active UI language, rendered from a typed code.
- [ ] Pre-flight **also lists the connected clients that will be re-pointed** and warns when any client's
      config is unreadable or not valid JSON, before the move starts.
- [ ] The vault is verifiably at rest before the move begins — no `-wal`/`-shm`/`-journal` sidecar — the
      vault is **locked first** (D-R(d)), and the wizard states the re-unlock consequence before starting.
- [ ] The move **copies, verifies, then deletes** (D-R(b)): nothing at the source is removed until the
      destination is verified complete and correct.
- [ ] A simulated failure at each stage (copy fails, verify fails, source deletion fails) leaves exactly one
      openable vault, cleans up partial destination files, does not change the remembered location, and
      **leaves every client config untouched** — asserted by tests against a fake or temporary filesystem.
- [ ] After a successful move, the old folder contains **neither** `vault.db` **nor** `vault.json`, and the
      vault opens at the new location with the same passphrase, the **same vault id** and the **same
      lineage generation**.
- [ ] A cross-filesystem destination works (the move is not rename-only).
- [ ] Nothing under `VALIJA_STATE_HOME`, and no preferences file, is moved, copied, or created inside the
      destination.
- [ ] The new location survives an app relaunch (D-R(a)), and `VALIJA_HOME`, when set in the app's
      environment, takes precedence over it.
- [ ] **Every connected client's `mcpServers.valija` entry names the new vault folder after a successful
      relocation** — asserted by a test that reads each client config before and after — written through
      the same backup-and-merge discipline, with a backup produced for each config touched.
- [ ] **A client that could not be re-pointed is named individually**, with the manual snippet and a retry
      action, and the relocation result is reported as incomplete rather than successful. The vault is
      **not** rolled back to fix a config file (§8.12).
- [ ] The three clients in `CLIENTS` are each verified to honour a per-server environment block, and the
      answer is recorded in the docs (§6 In, item 20); any client that does not is documented with its
      manual fallback.
- [ ] The wizard shows the exact `VALIJA_HOME` line a terminal user needs, with a copy action, and the GUI
      docs explain that the CLI is **not** re-pointed and does not read the app's preferences.
- [ ] The app-preferences file contains **exactly four keys** — vault path, theme, language, tour-seen —
      and nothing else (§8.4).

**Onboarding tour and Settings (D-U)**

- [ ] The welcome tour is shown automatically **exactly once per installation**, the **first time this
      installation reaches the dashboard** (D-U(a)), on **both** branches of §4.2 step 3, and never again —
      driven in tests by the persisted flag rather than by manual observation.
- [ ] **Skip** is present on every slide, **sets the seen-flag**, and returns the user to where the tour
      interrupted them; position dots, **Back**, **Next** and **Get started** behave as the mockup shows.
- [ ] The seen-flag is **per installation, not per vault**: relocating, re-creating or unlocking a
      different vault neither replays nor suppresses the tour.
- [ ] The tour opens **no vault session**, reads no vault content, makes no network request, does not touch
      the idle-lock clock, and writes nothing except its own boolean.
- [ ] The tour never appears before the recovery-kit acknowledgement, and the four slides satisfy D-U(c)'s
      three guardrails **in both languages**: slide 2 points at connecting a tool / importing history and
      never at "saving"; slide 3 names no curation verb; slide 4 states the no-password-reset fact without
      marketing language.
- [ ] **Show the welcome tour again** in Settings replays the same slides, any number of times, and changes
      no other state.
- [ ] Settings is reachable **while the vault is locked**; opening it opens no session and touches no vault
      file.
- [ ] Settings contains exactly the four sections D-U names; its Vault & sync entries navigate to the
      *existing* Diagnostics screen and relocation wizard rather than reimplementing either; and it exposes
      **no editable field** for `VALIJA_HOME`, `VALIJA_STATE_HOME`, `VALIJA_AUTOLOCK_MINUTES` or any other
      environment-resolved setting.
- [ ] Settings offers no path to destroying, re-keying or re-initializing a vault.
- [ ] The GUI docs state that Settings has no CLI counterpart, and why (D-U(d)).

**Language (D-V)**

- [ ] The app opens in the OS language when its **primary subtag** is `es` (any region → the one neutral
      Spanish catalog) or `en`, and in English otherwise (D-V(g)); a manual choice in Settings overrides it
      and survives a relaunch, stored in the same preferences store as the theme.
- [ ] Switching language applies **live** — no restart of the app, no re-unlock of the vault.
- [ ] Both catalogs have **identical key sets**, asserted by a test; no user-facing string is hardcoded in a
      component; no user-facing sentence is built by concatenating fragments; counts use a plural-aware form
      in both languages (D-V(b), D-V(e)).
- [ ] A walkthrough of every §4 step in Spanish shows **no English UI string**, with exactly three
      documented exceptions — the recovery-kit body, the manual install instructions, and the context-pack
      markdown — **each accompanied by one localized sentence** explaining that it is written and stored in
      English on purpose so it reads identically on any machine, in any language, years later (D-V(d)).
- [ ] The GUI renders errors from `DomainError.code`, never from `DomainError.message`, in the main flow;
      every code reachable from the enumerated IPC surface has copy in both languages, or maps to a stated
      generic fallback that names the code rather than showing an English domain message.
- [ ] **No file under `src/` is modified for localization**; no use case, port, repository, DTO, policy or
      error constructor gains a `locale` parameter; the CLI's output is unchanged and English in every UI
      language (D-V(f)). The `src/` edits this advance *does* make — `RelocateVault` and the client-config
      writer — carry no locale.
- [ ] Translation catalogs load from the application bundle; the zero-network criterion below holds in both
      languages, verified against the **built artifact** (§8.5).
- [ ] Dates, numbers and durations are formatted with `Intl` against the **active UI language**, not the OS
      locale (D-V(e)).
- [ ] The five security-relevant copy surfaces of §8.17 — passphrase warning, clipboard warning, relocation
      refusals and re-pointing failures, migration confirmation, and D-W's Node-missing warning — are
      reviewed in Spanish as security copy, in neutral Latin American Spanish with "tú" forms and no voseo
      (D-V(c)); and the docs record that `docs/` itself stays English.

**Renderer and network hardening (§8.3–§8.6)**

- [ ] The renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; the
      preload exposes a fixed, enumerated API with one method per use case, each validating its arguments at
      the boundary.
- [ ] No IPC channel accepts SQL, a module name, a shell command, or a filesystem path supplied by the
      renderer. The import file, the export target and the relocation destination all originate from native
      dialogs opened by the main process, and **client config paths come from `clientConfigPath` over the
      closed `CLIENTS` list**, never from the renderer.
- [ ] The app makes zero network requests: no auto-update, no analytics, no crash reporting, no remote
      fonts or icons, **no translation-catalog fetch**, **no sync-provider call of any kind**, and **no
      install command run by the Node probe**; a CSP forbids remote origins and navigation to them is
      denied. Verified against the built artifact, not only the source.
- [ ] After quitting, no new plaintext file, cache, index, or crash dump containing vault content exists on
      disk — the preferences file of §8.4 being the only new file, with only its four permitted keys.
- [ ] Screenshots and docs use only the golden-vault fixture, labelled as published test data, in both
      languages.

**Concurrency (D-J(a))**

- [ ] The **explicit busy timeout and bounded retry** are stated in code, not inherited from a library
      default, and a contended write (GUI import vs an MCP `save_context`) produces the documented outcome
      rather than an unhandled exception — surfaced as localized copy keyed to the error code, not a raw
      SQLite string.
- [ ] Relocation is **not** governed by that timeout: it locks and verifies at rest instead (D-R(d)), and a
      test proves it refuses to proceed when a sidecar file is present.

**Packaging and docs (D-G)**

- [ ] Unsigned artifacts build for macOS, Windows and Linux, each with a published SHA-256; the native
      modules load correctly in the packaged app on every target (not only in dev).
- [ ] First-launch friction is documented per OS using the literal text the OS displays, with the exact
      bypass steps, plus the run-from-source alternative — and the run-from-source path is verified, not
      assumed.
- [ ] The GUI docs state the **Node/npm prerequisite** for connected AI tools (D-W) and that this advance
      does not remove it.
- [ ] The GUI docs state what the GUI deliberately does not do (curation, fork resolution, vault
      destruction, running or bundling an MCP server, provider artifacts, configuring environment-resolved
      behaviour from Settings, re-pointing the CLI, a third language) and where those live.

**Not applicable this advance** *(listed so a reviewer does not look for them)*

- [ ] ~~Curation verbs behave correctly~~ *(not applicable — D-A, D-B)*
- [ ] ~~Skills / agents / provider artifacts~~ *(not applicable — D-D, D-E)*
- [ ] ~~New MCP tool or resource~~ *(not applicable — D-K)*
- [ ] ~~A `valija relocate` CLI command~~ *(not applicable — D-R(c) landed on Option 1, not Option 3)*
- [ ] ~~A `valija config` command, or any CLI counterpart to Settings~~ *(not applicable — D-U(d))*
- [ ] ~~Translated CLI output, or translated `docs/`~~ *(not applicable — D-V(c), D-V(f))*
- [ ] ~~A bundled Node runtime, or an MCP server hosted by the app~~ *(not applicable — D-W, future work)*
- [ ] ~~`valija install` writing a vault path~~ *(not applicable — D-R(a)(6) keeps CLI behaviour unchanged)*

---

## 10. Deliverables summary (for the planner, not a plan)

An **Electron** desktop application (D-F) — main process composing the existing container, sandboxed
renderer over an enumerated IPC surface — that reaches **full parity with the `valija` CLI for a human
user, minus curation** (D-P revised), **plus three surfaces the CLI has no counterpart for**:

- **creates a vault** (passphrase, Argon2id, one-time recovery-kit display with explicit acknowledgement) —
  never destroys one (D-M);
- **unlocks, locks and reports status** through the CLI's own keychain entry (D-H), with a **recovery-key
  unlock path**, honouring idle auto-lock unchanged and surfacing the fork notice without ever resolving it;
- **browses** projects and items, **searches** full-text, and **previews** a rendered context pack
  byte-identical to `valija export`;
- **copies** that pack to the clipboard or **exports** it to a user-chosen file, **as markdown or JSON**;
- **imports** an existing ChatGPT/Claude/generic export through the shipping
  `ImportConversations` → `ImportItems` path — list, select, filter, preview, import, one lineage bump —
  and says plainly that imported items stay out of context packs (D-S Option 2);
- **connects AI tools** via a guided wrapper over the existing `install` use case, writing the vault folder
  into the entry, showing where each connected client points, and **warning plainly when Node/npm is not
  runnable** (D-P, D-R(a), D-W);
- **reports diagnostics** using `doctor`'s existing checks on a screen split from a plain-language **Sync &
  safety** panel (D-T Option 3), disclosing the keychain probe and distinguishing the app's Node runtime
  from the one AI tools use;
- **moves the vault into a folder the user's own sync client replicates** — pre-flight refusals, lock and
  verify at rest, copy → verify → delete, a remembered location that survives relaunch, **and every
  connected AI tool re-pointed at the new folder** — **the one genuinely new capability in this advance,
  with no existing implementation in `src/` or the CLI** (D-R);
- asks before **migrating** a behind-schema vault, naming the backup migrations 002/003 take (D-J(b));
- follows the OS light/dark setting with a persisted manual override, the recovery-kit screen excepted (D-Q);
- **explains itself once** in a four-slide skippable tour, the first time an installation reaches the
  dashboard on either path, replayable forever from a new **Settings** screen — deliberately without a CLI
  counterpart (D-U);
- **speaks English and Spanish**, following the OS language (primary subtag) with a manual override in
  Settings (D-Q's pattern, built once and used twice), catalogs bundled and never fetched, errors localized
  from `DomainError.code`, `Intl` dates and plurals against the active UI language, and **no localization
  change of any kind in `src/`** (D-V);

packaged **unsigned** for macOS, Windows and Linux with published checksums, a documented run-from-source
path, and per-OS first-launch instructions (D-G); living in a `desktop/` workspace in this repo (D-L) —
**plus two named edits to gated `src/` code: a `RelocateVault` use case in `src/vault/` (D-R(c)) and a
vault-path-aware client-config writer in `src/delivery/cli/installer.ts` (D-R(a))**; documented for a
non-technical reader (D-N); with `docs/SPEC.md` §1, §2, §10a and D11 corrected and **no milestone number**
assigned (D-O).

**Not in it:** no curation of any kind, no fork resolution, no vault destruction, no MCP change and no
embedded, hosted or bundled MCP server, **no bundled Node runtime**, no provider artifacts, no new importer
or format, no schema/format/crypto change, no sync-provider integration, no signing, no auto-update, no
network call, **no third language, no downloaded language packs, no translated CLI output and no translated
`docs/`**, no configuration editor in Settings, no re-pointing of the CLI, no onboarding beyond the four
slides, no mobile.

**Open at Gate R: nothing.** All sixteen sub-decisions the fourth revision left open, plus D-P's two parity
gaps, were answered individually by Oscar on 2026-08-20 and carry `Decided:` lines above. D-R(a) was
rewritten in the same round to close a correctness gap the fourth revision missed, and D-W was added.

---

## 11. Biggest risk

**The vault-relocation wizard is new filesystem-moving code, written for this advance, operating on the one
artifact this product cannot afford to corrupt — and this revision made it *wider*, not narrower: it now
also rewrites configuration files owned by third-party applications.**

Everything else in this advance is a window over code that already ships and is already tested: the pack
renderer, the importer, the installer, the doctor checks, the status reader. If those screens are wrong,
they are wrong *visibly* and recoverably. Relocation is different in every dimension that matters:

- **No precedent anywhere.** There is no `RelocateVault`, no filesystem port for it, no advisory lock, no
  "vault location" concept beyond an environment variable read once at process start. Every safety property
  — verify before delete, refuse a destination that already has a vault, clean up a partial copy, never
  split the vault across two folders — has to be invented and tested here, not inherited.
- **The failure is silent and delayed.** A bad export screen is obvious immediately. A relocation that
  leaves a stale, openable `vault.db` behind looks like a complete success on the day it happens, and
  surfaces weeks later as a fork, or as a user who "lost everything they saved since Tuesday".
- **This revision found one such silent failure before implementation, which is evidence there may be
  more.** The fourth revision's D-R(a) would have shipped a wizard that moved the vault correctly and
  detached every connected AI tool from it, with both the app and the tools reporting plausible-looking
  states. It took Oscar reading the spec against `installer.ts` to catch it. The lesson for the plan is
  that relocation's blast radius is defined by *everything that remembers where the vault is*, and that
  list has now been enumerated (the app's preferences, connected clients' MCP configs, the user's shell
  environment) — the planner should treat any newly discovered fourth member of that list as a blocker,
  not a polish item.
- **It runs at the worst moment in the user's mental model.** The person clicking "move my vault into
  Dropbox" is by definition doing multi-device setup, which is when M3's fork machinery is most likely to be
  exercised — and D-N says that person does not use a terminal, so if the move half-fails they have no
  `valija doctor`, no `ls`, and no way to tell which folder is real.
- **It cannot be de-risked by shipping it badly.** Cutting scope on a browse screen means fewer filters.
  Cutting scope on relocation means a half-implemented move, which is worse than no wizard at all — the
  honest fallback if D-R looks shaky at planning time is to **ship the sync-status half alone** (cheap, pure
  read, real user value) and defer the wizard to its own advance with its own Gate R. That is the early
  re-scope signal to watch for, and it is now cheaper to take, because the companion step means deferring
  the wizard also defers the client-config rewriting.

**Second risk: packaging and macOS keychain behaviour.** D-G ships binaries that Gatekeeper and SmartScreen
actively block, so the first instruction the docs give a nervous user is how to override their operating
system's protection. D-H shares a keychain entry across two binaries, which on macOS may prompt on every
read or fail outright depending on the item's ACL — and the parity revision added a second keychain
interaction (the diagnostics probe). Three native modules rebuilt against Electron's ABI across three
operating systems and two macOS architectures remains the largest unknown-cost item in the plan. What has
changed is that this risk no longer has "nothing else to show for it": with import, connect, diagnostics,
sync and relocation in scope, the advance delivers real capability even if distribution stays rough. The
bypass instructions live in `docs/`, which stays English (D-V(c)), so the audience the app is now bilingual
for still meets its scariest instruction in a second language.

**Third risk: scope keeps growing while the advance keeps one gate.** The 2026-08-17 revision described a
read-only shell over eight commands; the third covered eleven and added a vault write, a persistence
mechanism and a file-moving capability; the fourth added two screens, two preference tenants and a second
copy of every string; **this one added a third write target — third-party client configs — and a second
mandatory spike.** Four consequences the planner should price in:
- the implementation must be sliced so the shell can ship even if relocation slips;
- the review budget covers first run **and** relocation **and** the import write path **and** a bilingual
  copy pass **and** the client-config rewriting;
- **i18n must be sliced first, not last.** D-V touches *every user-facing string*. Done from the first
  slice it costs one lookup call per string; retrofitted after fifteen screens it is a mechanical rewrite of
  every screen, arriving exactly when packaging risk is also cashing in. It is a **scheduling** risk, and
  D-V(f) makes it unusually easy to schedule early because localization blocks on nothing;
- **the two spikes (D-H's macOS keychain ACL, D-R(a)'s per-client `env` support) both gate design, not
  polish**, and both should land before the slices that depend on them.

**Fourth risk: the accepted risks getting quietly relaxed.** The recovery kit in a window (D-M, §8.2) is the
only unrecoverable failure in the product, and its mitigations are cheap, specific, and exactly the kind of
thing softened for usability's sake mid-implementation ("let them reopen it", "let them save it to a file").
The same pattern threatens relocation: "verify before delete" is one line of design and the first thing
someone drops to make a progress bar feel faster — and it now has a sibling, "re-point every client or say
you didn't", which is the first thing someone will downgrade to a silent best-effort loop. A third instance:
a Spanish UI showing an English recovery kit *looks like a bug*, and the obvious "fix" — translating
`renderRecoveryKit` — breaks §9's byte-exactness criterion and forks the wording of the product's most
consequential artifact. A fourth: the onboarding tour is the easiest place in the app to promise curation or
overclaim about encryption, because nobody reviews marketing-shaped copy as carefully as they review code.
An accepted risk becoming a bigger one than the person who accepted it agreed to is a failure mode of the
process, not of the code, and it is what §8 exists to prevent.

**Explicitly examined and deliberately *not* promoted: onboarding, Settings, the bilingual UI, and D-W's
Node prerequisite.** D-U and D-V add no write path to the vault, no key material, no network surface, no
new domain concept, and no change to `src/`; their worst failure mode is embarrassment or confusion, fixed
in a patch release. D-W adds only a probe and a sentence — its worst failure mode is a warning that is
wrong, which is strictly better than today's silence. None of that outranks a bespoke file move performed
on an encrypted vault, for an audience with no terminal, that must also keep every connected AI tool
pointing at the right folder.
