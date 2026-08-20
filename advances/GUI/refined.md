# GUI — desktop companion for valija · Refined Spec

**Status:** Gate R draft, **revised 2026-08-17** to record Oscar's answers to §7's `D-n`
decisions. Several answers changed the *shape* of this advance relative to the first draft —
most of all **D-A**, which declined curation for now, and **D-M**, which added vault
initialization back in. Read §1 and §3 before anything else; the earlier framing ("this is
fundamentally a management/write surface") is no longer the framing.
**Directory:** `GUI`, deliberately not a milestone number — same posture `MOBILE` held
(see D-O).
**Source idea:** `advances/GUI/idea.md` (idea capture only, written while refining `M4`).
**Inherits from:** `docs/SPEC.md` (§1–§10b), `docs/sync.md`, `advances/MOBILE/refined.md`
(the `P-n` idiom this file copies), `src/testing/__fixtures__/golden-vault/`.
**Legend:** each decision in §7 lists the options that were on the table, a **Default:** line
with its reason, and a **Decided:** line with the outcome in Oscar's terms. Decisions that
this advance's shape made irrelevant carry **Decided: not applicable to this advance** and
keep their analysis for the advance that will need it.
**All `D-n` decisions in §7 are now recorded**, including the three left open in the first
revision: **D-L** → this repo, a `desktop/` workspace; **D-P** → the read/session set plus
`install`, as a guided "connect your AI tools" step (a second write path, outside the vault —
see D-P's own entry for the required acceptance criterion); **D-J(b)** → migrates like the CLI,
but only after an explicit "this will update your vault" confirmation screen.

---

## 1. Goal

**Ship a desktop application that lets someone who never opens a terminal do what `valija`
already does on the read side — unlock, browse projects, read items, search, preview and copy
or export a rendered context pack — and, as the one write capability in scope, create the
vault itself.**

That is the whole goal. Nothing in this advance edits, pins, archives, deletes, renames, or
otherwise *changes* saved context. Nothing in this advance adds an MCP tool, an argument, a
prompt, a schema column, a migration, a dependency in the crypto path, or a network call.

The advance is deliberately a **delivery-surface** advance: the domain already does everything
the app needs (`ListProjects`, `ShowProject`, `SearchContext`, `GetContextPack`, `VaultStatus`,
`UnlockVault`, `LockVault`, `CreateVault`, plus `renderContextPackMarkdown`). The new code is a
window over use cases that already exist, plus the packaging that gets that window onto three
operating systems.

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
| M3 §10b D-A | **Single file at rest**: rollback journal, never WAL. Any surface that opens the vault must leave `vault.db` alone as one self-consistent file. |
| M3 §10b D-B, D-C | **Lineage stamp** bumped atomically with every write; **device identity** lives under `VALIJA_STATE_HOME` (default `~/.valija-state`), deliberately outside `VALIJA_HOME`. |
| M3 §10b D-I | **Idle auto-lock**, lazy, checked at session open, `VALIJA_AUTOLOCK_MINUTES` (default 15). |
| MOBILE | **No distributable mobile app.** The desktop GUI does not inherit or revive that decision; `docs/vault-format.md` remains the mobile-era artifact it is. |

---

## 3. Two framing facts a planner must not skip past

**1. This is `idea.md`'s original read-only shell — reaffirmed on purpose, after the
alternative was considered and declined.** The first draft of this spec argued that "administer
and refine your context" implies write verbs, and recommended shipping the shell *and* curation
together. Oscar was shown what curation concretely means (edit, pin/unpin, archive, delete,
rename) and chose to start with **only the operations that already exist today** (D-A). That is
a reversal of this document's own earlier recommendation, and it is stated here plainly so a
future reader does not mistake the narrower scope for an oversight. Curation is a **separate,
later advance** with its own Gate R; §7's D-B and D-C hold the analysis it will need.

**2. Exactly one write path is in scope, and it is the most security-sensitive flow in the
product.** Oscar decided the GUI may also **initialize a vault** (D-M): passphrase entry,
Argon2id derivation, and **recovery-kit display in a window**. This document's own trade-off
text called that "a materially worse ritual than a terminal that prints it once" and noted it
"duplicates the most security-sensitive flow in a new surface". That text stands unchanged and
unsoftened — it is now an **accepted risk**, not an open objection (see §7 D-M and §8.2). The
practical consequence for the planner: the review budget for this advance concentrates on the
first-run flow, not on the browser.

A third fact, less about scope and more about honesty: **"read-only" here means "performs no
domain write and never bumps the lineage stamp"** — it does not mean "touches zero bytes".
Opening a session today runs `wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`, runs
`migrate()`, and records a device-local activity timestamp. See §5 and D-J(b).

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

### 4.2 First run — creating a vault (D-M, the one write path)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 3 | Launch, no vault present | — | *"No vault on this machine yet."* Two choices: **Create a vault** · **I already have one** (the second explains `VALIJA_HOME` in plain words) |
| 4 | Create | Types a passphrase twice | The same warning the CLI prints, in the window: minimum 8 characters; *"If you lose it AND the recovery kit, your data is gone. No reset exists."* Mismatch is caught before anything is written |
| 5 | Derive | Waits | *"Creating your encrypted vault (about a second)…"* — `CreateVault`, unchanged: header written, DB initialized, key placed in the OS keychain, idle clock started |
| 6 | **Recovery kit** | Reads a full-window panel | The exact text `renderRecoveryKit` produces — vault id, the raw key hex, what it is, what to do with it. Marked **shown once**. A **Copy key** button (with a warning that the clipboard is readable by other apps) and no automatic file write |
| 7 | Acknowledge | Ticks *"I have stored this somewhere offline"* and confirms | Only then does the panel close. It cannot be reopened; the app never persists the kit |
| 8 | Land | — | The main window, vault **unlocked** (matching `CreateVault`'s behaviour), empty state: *"No context saved yet. Connect an AI tool and it will start filling up."* |

`valija status` in a terminal now reports the same vault, unlocked. There is exactly one vault,
one keychain entry, one device identity — the GUI is not a second device.

### 4.3 Daily use — the shell (D-A: what already exists)

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 9 | Launch | Opens the app; the vault is locked (they locked it, or idle auto-lock did) | An unlock panel: passphrase field only |
| 9' | Or not | Had already run `valija unlock` in a terminal | **No prompt.** The app shares the CLI's exact keychain entry (D-H) and is simply unlocked |
| 10 | Browse | — | Project list: name, item count, last activity — the same rows `valija projects` prints |
| 11 | Open a project | Clicks one | Its items: type, date, pinned marker, tags, content — the same content `valija show <project>` prints, in the same order (same use case). A type filter mirrors `--type` |
| 12 | Search | Types "sqlcipher" | Full-text hits across the vault, optionally narrowed to one project — the same rows `valija search` prints |
| 13 | Read the pack | Clicks **Context pack** | The rendered markdown for that project, unbudgeted — byte-for-byte what `valija export <project>` writes (§9 pins this) |
| 14 | Take it | Clicks **Copy** | The pack is on the clipboard, ready to paste into any chat window that is not MCP-connected |
| 14' | Or | Clicks **Export…** | A native save dialog; one file, at a path the user chose. Parity with `valija export -o <file>` — the same plaintext egress that already exists, not a new one |
| 15 | Finish | Clicks **Lock**, or quits, or walks away | Locked: the key leaves the keychain. Walks away: idle auto-lock does it at the existing TTL — **the app does not extend the unlocked window by polling** |

### 4.4 What the user deliberately cannot do here

| Not available | Why, and where it goes |
|---|---|
| Edit, pin/unpin, archive, delete, rename, retag, merge — any change to saved content | **Deferred (D-A).** A curation advance with its own Gate R; D-B (verb set) and D-C (where the write paths live) are its first two questions |
| Save new context from the GUI | Same. Saving remains an MCP-tool action from inside an AI tool, by design (`SPEC.md` §3) |
| Import chatbot exports | CLI-only (`SPEC.md` §10a), and it is a write path — see D-P |
| Wire up Claude Desktop / Cursor from the GUI | `valija install` — **open, D-P.** It is the single most useful thing a non-technical user would want and it writes third-party config files |
| Generate provider artifacts (skills, agents, rules files, `CLAUDE.md`) | **Future advance (D-D).** Its delivery shape is already decided (D-E): live over MCP, plus a copy button here — never a file the app writes |
| Anything mobile, cloud, or account-shaped | Out of scope permanently or by prior decision |

### 4.5 How the data is used afterward — which surfaces change, which do not

| Surface | Effect of this advance |
|---|---|
| The desktop app itself | **New.** The only new surface |
| MCP tools + prompts (5 + 2, stdio) | **Untouched, byte-for-byte.** The GUI is not an MCP client and does not proxy tools |
| The `valija` CLI | **Untouched.** Every command keeps working, and keeps being the surface a technical user prefers |
| The vault file, schema, crypto, `vault.json`, KDF parameters, lineage | **Untouched.** No migration is authored here; no lineage stamp is bumped by the GUI |
| The OS keychain | **Shared, not extended** (D-H): same service, same entry as the CLI. GUI init and GUI unlock write the same entry the CLI writes |
| `VALIJA_STATE_HOME` device identity | **Reused, not duplicated.** The GUI is the same device as the CLI on that machine |
| The clipboard | **New affordance** — one click instead of `valija export \| pbcopy`. User-initiated only, never automatic; named in the docs (§8.6) |
| A file the user names in a save dialog | Parity with `valija export -o`; the only file the app writes outside the vault |
| The published npm package | **Untouched in content.** `files` is `["dist","README.md","LICENSE"]`; desktop artifacts ship as GitHub release downloads, not inside the tarball |
| `docs/SPEC.md` §1's "one binary surface" and §2's "GUI … → later" | **Corrected** (D-O). Both become false the day this ships |

---

## 5. Architecture expectations

Stated as boundary requirements, not a file layout. Two groups: what binds **this** advance,
and what is written down now but stays dormant until curation ships.

### 5.1 Binding on this advance

- **The GUI is a delivery adapter and nothing else.** It introduces no domain concept, no
  entity, no value object, and no new use case. If the planner finds itself writing domain
  logic to make a screen work, that is the signal that something outside D-A's scope crept in.
- **Rendering is not re-implemented.** The pack markdown comes from
  `delivery/context-pack-markdown.ts`, called in the trusted process. The renderer displays a
  string it was given. This is what makes "byte-identical to `valija export`" a structural
  property rather than a test that will rot.
- **Process boundary is a security boundary.** The Electron main process (Node, trusted) owns
  the container and every vault interaction. The renderer runs with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, and reaches the main process only through a
  preload-exposed API with **one method per use case** — an enumerated, closed list, validated
  at the boundary with the same zod discipline the MCP server uses. No generic "run this query"
  channel, no module name, no file path except the one the user picks in a save dialog.
- **Sessions are per action, never long-lived.** Use the existing `VaultSessions.withSession`
  shape: open, read, close. A GUI that holds a `Database` handle open while the user reads
  keeps a lock against the MCP server and defeats M3's single-file-at-rest guarantee.
- **No background polling.** Every session open records device activity, which resets the idle
  auto-lock clock. A status poller would silently disable auto-lock (M3 D-I) for anyone who
  leaves the window open. State refreshes on user action and on window focus, not on a timer.
- **Secrets do not cross the IPC boundary.** The passphrase travels renderer → main once, and
  is not retained. The session key never travels main → renderer. The single exception is the
  recovery kit at init, which *is* the raw key on screen by definition (D-M) — it crosses once,
  is never persisted, never logged, and cannot be re-requested.
- **The shell must be testable without a window.** Whatever holds view state and calls use
  cases is plain TypeScript, unit-tested headlessly. Packaging is the part that cannot be
  unit-tested, so keep it thin and keep logic out of it.
- **Repo conventions apply** to whatever tree this lands in (D-L): `domain/application/infra`
  where relevant, no bare files at a layer root, kind-named subfolders, tests per layer.

### 5.2 Written now, dormant until curation ships (do not implement here)

- **Every write goes through `session.write(...)`**, so the lineage bump is atomic with the
  mutation. A curation UI must never reach a repository directly.
- **One lineage bump per user-visible action.** A "archive these 12 items" gesture is one
  transaction and one generation bump, not twelve — otherwise a sync-folder user's generation
  counter becomes noise and fork classification gets harder to reason about.
- **Fork/lineage UX** (M3 D-B): a GUI that writes must decide how it surfaces
  `VAULT_FORK_DETECTED` to a non-technical user, and must never auto-merge (D-I holds this).
- **Concurrency with a live MCP server**: two writers on one SQLite file needs a stated
  behaviour (retry, busy timeout, or refuse) before curation ships (D-J(a)).

---

## 6. Scope

### In

1. **An Electron desktop application** (D-F) whose main process composes the existing container
   and whose renderer is a UI, packaged for **macOS, Windows and Linux, unsigned** (D-G), with a
   documented run-from-source path.
2. **Vault initialization** (D-M): passphrase entry with confirmation, Argon2id derivation via
   the existing `CreateVault`, one-time recovery-kit display with explicit acknowledgement.
3. **Unlock / lock / status**, sharing the CLI's exact keychain entry (D-H), honouring idle
   auto-lock unchanged.
4. **Browse**: project list (parity with `valija projects`), project item view with type filter
   (parity with `valija show [--type]`).
5. **Search**: full-text, optional project narrowing (parity with `valija search [-p]`).
6. **Context pack view**: rendered markdown, unbudgeted, identical to `valija export`.
7. **Copy to clipboard** and **Export…** to a user-chosen file (parity with `valija export -o`).
8. **Docs**: a GUI page covering install per OS (including the literal Gatekeeper/SmartScreen
   text and the bypass), first run, the recovery-kit ritual, and what the GUI deliberately does
   not do; plus the `docs/SPEC.md` corrections D-O requires.
9. **A recorded answer to the macOS keychain-ACL question** (D-H's mandatory spike) — whether a
   second binary reading the CLI's keychain entry prompts, succeeds silently, or fails, on a
   named macOS version.
10. **Connect your AI tools** (D-P): a guided step wrapping the existing `install` use case,
    reusing `installer.ts`'s backup-and-merge discipline unchanged, to wire up Claude Desktop,
    Cursor, or Claude Code without a terminal.
11. **A confirmation screen for schema migration** (D-J-b): shown only when a vault's schema is
    behind, naming the ciphertext backup migrations 002/003 take, before the shared `migrate()`
    path runs. A current-schema vault never sees it.

### Out — explicit non-goals

- **All curation**: no edit, pin/unpin, archive, delete, rename, retag, merge, bulk action, or
  undo. No `save_context` equivalent. → future advance (D-A, D-B, D-C).
- **Provider artifacts** — skills, agents, rules files, generated `CLAUDE.md` — and any
  materialization of them. → future advance (D-D), whose delivery shape D-E already fixes.
- **No MCP change of any kind**: no tool, argument, prompt, resource, or transport (D-K). The
  GUI does not run or embed an MCP server.
- **No schema change, no migration authored here, no format change, no crypto or KDF change, no
  `vault.json` field.** Swapping a crypto or keychain library for packaging convenience is
  explicitly forbidden (§8.1).
- **No import, no `doctor`, no `mcp`** in the GUI (`install` is now in scope — item 10 above,
  per D-P).
- **No multi-vault, no vault switcher, no remote vault, no cloud, no accounts, no pairing.**
- **No auto-update, no telemetry, no crash reporting, no analytics, no remote content, no
  network call at all** — including fonts, icons, and update feeds.
- **No code signing, no notarization, no store distribution, no Apple Developer account**
  (D-G).
- **No localization.** English only this advance; the non-technical-first audience (D-N) makes
  a Spanish UI a reasonable follow-up, not a requirement here.
- **No mobile anything.**

---

## 7. Decisions

Each entry: the options that were on the table, the **Default:** with its reason, and the
**Decided:** line. Entries marked *not applicable to this advance* keep their analysis for the
advance that will need it.

### D-A. What the GUI actually is

- **Option 1 — a viewer only**: projects, items, search, pack preview, copy. Smallest possible
  surface; ships nothing the CLI cannot do, only in a window.
- **Option 2 — the operations that already exist, as a first-class shell**: Option 1 plus the
  existing vault operations (unlock/lock/status), i.e. everything `valija` does read-side, with
  no new verbs invented.
- **Option 3 — shell + curation together**: Option 2 plus edit, pin/unpin, archive, delete,
  rename. *Trade-off:* this is the only option that fulfils "administer and refine your
  context", but it introduces the product's first non-MCP content-write path and drags D-B,
  D-C, D-I and D-J into scope with it.
- **Default: Option 3.** Reason: a window that can only look at things does not answer the
  need that produced the idea, and the domain already has the repositories a curation layer
  would need.
- **Decided: Option 2**, overriding the recommended Option 3. Oscar, relayed: *"GUI but with the
  operations that [already] exist"*, and confirmed in a follow-up after "curar" was spelled out
  concretely as edit/pin/archive/delete/rename — he wants to start with **only what exists
  today**: browse, search, export/copy a rendered pack (plus, per D-M, vault creation).
  **Curation is not bundled here**; it becomes its own advance with its own Gate R. The Default
  text above is retained deliberately: it is the argument that was considered and declined, and
  a future reader should see that the narrow scope was chosen, not overlooked.

### D-B. The curation verb set

- **Option 1 — pin/unpin + archive only.** The two verbs the schema already models
  (`pinned`, `archived`) with no new state and no destruction.
- **Option 2 — Option 1 + edit content and tags.** Editing raises the "is this the same item?"
  question: `updatedAt` moves, FTS reindexes, and an item an AI wrote is now partly human.
- **Option 3 — Option 2 + hard delete and project rename.** Rename is a slug change with
  referential consequences; hard delete is the only irreversible verb in the product.
- **Default: Option 1 for the first curation pass**, because it is the only set with no new
  domain semantics, then Option 2 behind an explicit confirmation.
- **Decided: not applicable to this advance.** D-A landed on the read-only shell, so no
  curation verb ships. This analysis is the starting point for the curation advance, where it
  is the first question to answer — not a settled decision.

### D-C. Where the write paths live

- **Option 1 — new use cases in `context/application/use-cases/`** (`PinItem`, `ArchiveItem`,
  …), reused by CLI and GUI alike. Consistent with the existing architecture; forces the CLI to
  grow matching commands or to knowingly lag.
- **Option 2 — GUI-only application services** in the desktop tree. Faster, and immediately
  creates a second-class path the CLI cannot reach and the MCP server cannot audit.
- **Option 3 — one generic `UpdateItem` use case** taking a patch. Fewer classes, weaker
  invariants, harder to review.
- **Default: Option 1.** Reason: the repo's whole shape (`SPEC.md` §10) is "entry points are
  thin adapters over shared use cases", and a write path that only one adapter can reach is the
  first crack in that.
- **Decided: not applicable to this advance.** There are no write paths in scope beyond
  `CreateVault`, which already exists and is already shared with the CLI. Retained for the
  curation advance.

### D-D. Skills / agents / provider artifacts in scope?

- **Option 1 — in this advance**, alongside the shell.
- **Option 2 — a separate advance with its own Gate R.**
- **Default: Option 2.** Reason: artifact generation is a new *product concept*, not a new
  window. It needs its own domain thinking (what an artifact is, where it comes from, how it
  stays in sync with the vault) and bundling it here would make one advance carry two unrelated
  risks.
- **Decided: Option 2**, matching the recommended default. Not in this advance; a separate
  advance with its own Gate R.

### D-E. How provider artifacts reach a provider (decided now, for that future advance)

- **Option 1 — the GUI shows the artifact and offers copy-to-clipboard.** No file written by
  valija; the user pastes wherever they want. *Trade-off:* manual, and nothing stays in sync.
- **Option 2 — an explicit per-target write** ("write this to `.cursor/rules/…`"). *Trade-off:*
  a brand-new plaintext egress path — valija writing decrypted vault content into a location it
  does not own — which would require amending `docs/SPEC.md` §9's security model.
- **Option 3 — continuous sync** (watch the vault, keep target files current). Same egress as
  Option 2 plus a daemon, which M3 deliberately refused.
- **Option 4 — expose artifacts live over MCP**, so an MCP-capable client reads them at call
  time and nothing is ever written to disk.
- **Default: Option 2**, as the shape most users expect from a "rules file" feature.
- **Decided: Option 4 + the copy affordance from Option 1**, rejecting file writing entirely.
  Oscar: *"Por MCP principalmente pero pudiendo a través de la GUI copiar y pegar el contenido
  de forma fácil."* Consequences a planner must carry forward:
  1. **No new plaintext-file egress path, ever, under this decision.** The `docs/SPEC.md` §9
     amendment Options 2 and 3 would have required is **moot**.
  2. **This reopens D-K — in that future advance, not this one.** Exposing artifacts "live over
     MCP" means new MCP surface (a tool, or a resource) against `SPEC.md` §7's standing "5 tools
     — resist adding more". D-K's *"nothing changes"* below is true for **this** advance only,
     and the artifacts advance must answer the MCP-surface question from scratch.
  3. The copy affordance is the same mechanism this advance already ships for packs (§4.3 step
     14), so nothing new is needed here to keep that door open.

### D-F. Framework

- **Option 1 — Electron.** Runs Node, so the app reuses the **actual** `src/` use cases,
  `better-sqlite3-multiple-ciphers`, `argon2`, and `@napi-rs/keyring` unchanged — zero
  reimplementation, and byte-identical rendering by construction. *Trade-off:* a large bundle,
  and three native modules that must be rebuilt against Electron's ABI and packaged per
  OS/arch (the real cost — see §11).
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
- **Default: Option 1 (Electron).** Reason: the one property worth more than binary size here
  is that the GUI cannot drift from the CLI, because it *is* the CLI's code with a window on it.
- **Decided: Option 1 (Electron)**, matching the recommended default. The planner must verify
  Electron-ABI availability (prebuilds or `electron-rebuild`) for all three native modules on
  every target before committing to a matrix, and must **not** substitute a pure-JS or
  alternative crypto/keychain library to make packaging easier (§8.1).

### D-G. Signing and distribution

- **Option 1 — signed and notarized** (Apple Developer Program ~99 USD/yr, a Windows OV/EV
  certificate). Clean first launch. *Trade-off:* recurring cost Oscar already declined for
  mobile, for an unmonetized project.
- **Option 2 — unsigned artifacts + a documented run-from-source path**, with published
  checksums and per-OS first-launch instructions.
- **Option 3 — source only.** No artifacts at all; honest, and excludes the exact audience the
  GUI exists for.
- **Default: Option 2.** Reason: it is the only option that both costs nothing and produces
  something a non-technical user can actually double-click, provided the friction is documented
  rather than discovered.
- **Decided: Option 2**, matching the recommended default. Unsigned artifacts, run-from-source
  documented, first-launch friction written down per OS in the words the OS actually uses. The
  security cost of teaching a bypass is acknowledged in §8.8, not hidden.

### D-H. Session model

- **Option 1 — share the CLI's exact keychain entry** (service `valija`, account = vault id).
  Unlock in the terminal, the GUI is unlocked; lock in the GUI, MCP tools lock. One session, one
  mental model. *Trade-off:* **macOS keychain items carry an ACL tied to the creating
  application**, so a second binary reading an entry the CLI created may prompt the user
  ("Valija wants to use your confidential information"), or fail outright, depending on how
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
  the docs (§6 In, item 9). If it prompts every time, that is a product fact the first-run docs
  must state, not a bug to paper over with a second entry.

### D-I. Device identity and lineage

- **Option 1 — the GUI is the same device as the CLI**: same `VALIJA_STATE_HOME`, same device
  id, so its writes are ordinary fast-forwards.
- **Option 2 — the GUI mints its own device id.** Every GUI write on the same machine would then
  look like a second device to `classifyLineage`, and a CLI write plus a GUI write between syncs
  would be classified as a **fork** — a false alarm on the product's loudest error.
- **Default: Option 1**, unambiguously.
- **Decided: not applicable to this advance's acceptance criteria** — a shell that performs no
  domain write can never contribute a write to classify. **One half still binds, though:** the
  GUI must resolve `VALIJA_STATE_HOME` exactly as the CLI does, so it is the same device for
  activity/auto-lock purposes and so curation, when it ships, inherits Option 1 by default
  rather than by accident (§9 keeps a criterion for this).

### D-J. Concurrency

**(a) Write-lock contention.** With an MCP server and a GUI both live, two processes may write
the same SQLite file. Options were: a busy timeout with retry; refuse and tell the user; or a
single-writer advisory lock.
- **Default: busy timeout with a bounded retry**, since SQLCipher/SQLite already serializes and
  the alternative is a scary error for a benign race.
- **Decided: not applicable to this advance.** No writes, no contention. Retained for the
  curation advance, which must answer it before shipping a single write verb.

**(b) What a read session does to the file — the part that is *not* moot, and is still open.**
Today `SqliteVaultSessions.open()` runs `wal_checkpoint(TRUNCATE)`, sets `journal_mode = DELETE`,
and calls `migrate(db, path)`. So a "read-only" GUI opening a vault whose schema is behind will
**run migrations** — including the transactional table rebuilds of migrations 002/003, which
take a ciphertext backup on a populated vault.
- **Option 1 — reuse the existing session path unchanged**: the GUI behaves exactly like any
  CLI read command, migrations included. One code path, zero divergence.
  *Trade-off:* "read-only" is then true of *content*, not of *bytes*, and the most invasive
  operation in the product can be triggered by double-clicking an app icon.
- **Option 2 — pre-flight the schema version and refuse to migrate**, telling the user to run a
  CLI command first (the posture mobile took, permanently). Strongest read-only guarantee.
  *Trade-off:* it dead-ends a non-technical user (D-N) at a terminal instruction, in an app that
  exists precisely so they never need one — and it needs a new check outside the shared path.
- **Option 3 — migrate, but only after an explicit "upgrade this vault" confirmation** in the
  GUI, with the backup behaviour explained.
- **Default: Option 1**, on the grounds that D-N's audience has no terminal and divergence
  between surfaces is the failure mode this architecture is built to avoid; §3's third framing
  fact and §8 then have to state plainly that "read-only" means no domain write, not zero bytes.
  Option 3 is the honest compromise if Gate R wants the user to consent to the upgrade.
- **Decided: Option 3**, overriding the recommended Option 1. The GUI pre-flights the schema
  version and shows an explicit "this will update your vault" screen — naming the ciphertext
  backup migrations 002/003 take on a populated vault — before calling the same `migrate()` path
  every CLI command already calls. One code path, but consent-gated rather than silent, since
  D-N's non-technical audience should not have a table rebuild triggered by opening a window
  without being told. The planner must design this screen so it is unmissable but not alarming:
  a first-run vault (schema already current) never sees it at all.

### D-K. Does anything reach the MCP surface?

- **Option 1 — nothing changes.** No tool, argument, prompt, resource, or transport.
- **Option 2 — the GUI exposes something over MCP** (e.g. artifacts, per D-E).
- **Default: Option 1.**
- **Decided: Option 1**, trivially, matching the recommended default: there is nothing new to
  expose. No curation (D-A), and artifacts — including their MCP exposure — are deferred to
  their own advance (D-D, D-E). **Scoped to this advance only:** D-E(2) records that the
  artifacts advance reopens this question and must answer it against `SPEC.md` §7's five-tool
  discipline.

### D-L. Where the desktop code lives

- **Option 1 — a top-level `desktop/` workspace in this repo.** Imports the existing use cases
  directly, so D-F's whole rationale (no second implementation) holds with no publishing step.
  *Trade-off:* an Electron build lands in a Node CLI repo; CI grows; and `desktop/` is **not**
  covered by `.claude/hooks/guard-implementation.sh`, which gates `src/`, `package.json`,
  `tsup.config.ts`, `tsconfig*.json` — so the hook would need extending, which is a governance
  change the plan must call out rather than slip in.
- **Option 2 — inside `src/delivery/desktop/`**, treating the GUI as a third entry point beside
  `cli/` and `mcp/`, which is literally what `SPEC.md` §10 says delivery is for. Already gated by
  the hook. *Trade-off:* a renderer app (HTML/CSS/assets, its own bundler, its own tsconfig)
  living inside a tree that `tsup` builds for npm is awkward, and risks the GUI's front-end
  files leaking into the published `dist`.
- **Option 3 — a separate `valija-desktop` repo** (the `MOBILE` P-3 precedent). Clean
  separation. *Trade-off:* this package exports no library entry point (`bin` only, no
  `exports`), so a second repo would have to vendor or re-export internals — reintroducing
  exactly the drift risk D-F chose Electron to avoid — and it would need this repo's whole gate
  apparatus copied again.
- **Default: Option 1**, with two riders: `desktop/` is excluded from the npm `files` list (it
  already is, since `files` is an allow-list), and the plan explicitly proposes whether
  `guard-implementation.sh` should gate `desktop/` too (recommended: yes).
- **Decided: Option 1**, matching the recommended default. A top-level `desktop/` workspace in
  this repo, importing the existing `src/` use cases directly — one ritual, one CI, no publishing
  step to keep in sync. The plan must extend `.claude/hooks/guard-implementation.sh` to gate
  `desktop/` the same way it gates `src/`, `package.json`, and build config, and confirm
  `desktop/` stays out of the npm `files` allow-list.

### D-M. Vault lifecycle in the GUI

- **Option 1 — the GUI can init, unlock, lock, and (some day) destroy a vault.**
- **Option 2 — the GUI can init, unlock and lock**, but never destroys.
- **Option 3 — terminal-only init; the GUI unlocks and locks, and shows a guided empty state
  pointing at `valija init`.** *Trade-off in the other direction:* a non-technical user cannot
  get started at all without a terminal.
- **Default: Option 3.** Reason, stated at the time and **retained verbatim because it is now
  an accepted risk rather than a rejected argument**: showing the recovery kit in a window is *a
  materially worse ritual than a terminal that prints it once*, and putting init in the GUI
  *duplicates the most security-sensitive flow in a new surface*.
- **Decided: Option 2**, overriding the recommended Option 3. **The GUI can initialize a
  vault**, including passphrase entry and recovery-kit display; it never destroys one. This is a
  deliberate security-posture acceptance by Oscar, not a default that fell through — the
  trade-off above is accepted, not disputed, and §8.2 carries it as a named surface with
  required mitigations. Do not re-litigate it in the plan; do not soften it in the docs.
  **One sub-question this raises, defaulted here:** `SPEC.md` D7 says init "write[s] a one-page
  recovery file", while the shipped CLI *prints* the kit and states it is "never stored". The
  GUI must **mirror the shipped behaviour** — display once, copy-to-clipboard, no automatic file
  write — and must not silently resolve that spec/code drift in the direction of writing a file.
  If Gate R wants a "Save kit to file…" button (a plausible ask for this audience), that is an
  explicit decision with its own security note, not an implementation detail.

### D-N. Audience

- **Option 1 — non-technical-first.** `idea.md`'s framing: someone who does not open terminals.
  Vocabulary, error messages, and the empty state are written for them; lineage generations,
  journal modes, and device ids stay out of the main flow.
- **Option 2 — power-user-first.** Density, keyboard-driven, jargon allowed.
- **Option 3 — both, layered**: a simple default surface with an advanced panel.
- **Default: Option 3**, on the grounds that the same person may want both and the curation
  surface skews technical.
- **Decided: Option 1**, overriding the recommended Option 3. Non-technical-first. Note that the
  tension the first draft flagged — `idea.md`'s non-technical framing versus a power-user
  curation surface — **dissolves** under D-A: with no curation in scope, there is no
  power-user-shaped feature left to design for. Consequences: plain-language errors, no
  lineage/journal jargon in the main flow (a status panel may still show it), and the install
  friction of D-G becomes the single most important thing the docs get right. Locale stays
  English-only this advance (§6 Out).

### D-O. Roadmap and `docs/SPEC.md`

- **(a) Does the Out line change?** `docs/SPEC.md` §2 currently reads *"GUI, encrypted backup /
  restore → later (bumped from M3 by M3's redefinition, see §10b)"*. Under the
  specs-are-contracts rule, the advance that ships a GUI must correct it: split the two clauses,
  mark the GUI as shipped in `advances/GUI/`, leave encrypted backup/restore as "later".
  **Also §1**, which reads *"One npm package. One binary surface: `valija`."* — that becomes
  false the day a desktop app ships and needs a sentence acknowledging the companion app.
- **(b) Does the GUI get a milestone number?** Options: assign one, or stay `GUI` like `MOBILE`
  stayed `MOBILE`.
- **Default: correct §2 (and §1), assign no milestone number.** Reason: the correction is a
  factual fix a contract document requires; numbering implies a place in a roadmap sequence that
  nothing else depends on.
- **Decided: the default applies** — no strong opinion was expressed, so: `docs/SPEC.md` §2's
  Out line and §1's "one binary surface" sentence are corrected as part of this advance's own
  deliverables, and **no milestone number is assigned**.

### D-P. Which existing operations the shell actually surfaces *(new in this revision)*

D-A's answer — "the operations that already exist" — is not self-evident, because the CLI has
eleven commands and they are not all the same kind of thing. This must be settled before
planning.

- **Option 1 — the read set plus session control**: `init` (per D-M), `unlock`, `lock`,
  `status`, `projects`, `show`, `search`, `export`. Excludes `import` (a write path that ingests
  files), `install` (mutates third-party config files), `doctor` (diagnostics written for
  technical users), and `mcp` (a server process, not a user action).
- **Option 2 — Option 1 plus `install`**, as a guided "Connect Claude Desktop / Cursor" step.
  *Strongest argument for:* it is arguably the single most valuable non-terminal operation for
  D-N's audience — a vault they cannot connect to any AI tool is a vault that stays empty, and
  §4.2 step 8's empty state currently ends by telling a non-technical user to run a CLI command.
  *Trade-off:* it writes files outside `VALIJA_HOME` (client config JSON), which is a genuine
  write path with its own failure modes (existing config, malformed JSON, missing client).
- **Option 3 — Option 2 plus `doctor`**, as a read-only "check my setup" panel. Cheap, and
  mostly reformats output the CLI already produces.
- **Option 4 — Option 1 plus `import`.** Rejected on its face: file ingest is a bulk *write*,
  which D-A put out of scope.
- **Default: Option 1**, on the strict reading of D-A's answer, with **Option 2 named as the
  strongest alternative** because of the D-N argument above.
- **Decided: Option 2**, overriding the recommended Option 1. The shell also surfaces `install`
  as a guided "Connect Claude Desktop / Cursor" step. This introduces a genuine second write
  path beyond `CreateVault` — one that edits **third-party config files outside `VALIJA_HOME`**,
  not the vault — so the planner must treat it with the same care as any write path: reuse
  `installer.ts`'s existing backup-and-merge discipline unchanged, surface its existing error
  modes (missing client, malformed JSON, already-configured) in plain language for D-N's
  audience, and add an acceptance criterion that this path never touches `vault.db` or the
  keychain. `import` and `doctor` remain out of scope (§6 Out).

### D-Q. Light/dark theme *(new in this revision)*

Raised after Oscar reviewed the visual mockups (`advances/GUI/mockups.md`) and asked whether
they covered dark mode. They didn't — no prior draft of this spec mentioned theming at all.

- **Option 1 — follow the OS setting only.** The app reads the system's light/dark preference at
  launch and has no in-app override. Simplest; zero new UI, zero new state to persist.
- **Option 2 — follow the OS setting by default, with a manual override.** Same as Option 1, plus
  a control inside the app (e.g. in a settings/status area) to force light or dark regardless of
  the OS setting. *Trade-off:* one more piece of state to design, store, and keep in sync with
  the OS across relaunches.
- **Option 3 — light only.** No dark theme at all. *Trade-off:* out of step with every other
  desktop app the audience already uses.
- **Default: Option 1.** Reason: it is the behavior every modern desktop app already has for
  free from the OS, with no extra surface to build or maintain.
- **Decided: Option 2**, overriding the recommended Option 1. Manual override, defaulting to the
  OS setting. The mockups (`advances/GUI/mockups.md`) demonstrate this per screen with a `dark`
  toggle; the planner should treat the OS-preference read as the initial value of that same
  override state, not a separate mechanism, and persist the user's manual choice across
  relaunches once they've set one explicitly. **Exception, by design:** the recovery-kit screen
  (§4.2 step 6) stays permanently in its own high-contrast dark treatment regardless of the
  app's theme — that screen's darkness is a security-emphasis choice made in D-M/§8.2, not a
  theme, and this decision does not reopen it.

---

## 8. Security surfaces that must not weaken

1. **Key material stays where it is.** The 32-byte key exists in the OS keychain and in
   main-process memory, and nowhere else — no renderer copy, no `localStorage`/`IndexedDB`/
   `sessionStorage`, no file, no log line, no crash dump. **No substitution of the crypto or
   keychain libraries** (`argon2`, `@napi-rs/keyring`, `better-sqlite3-multiple-ciphers`) to
   simplify packaging: a pure-JS Argon2id or an alternative keyring is a crypto/session change
   wearing a build-tooling disguise.
2. **The recovery kit in a window — the risk Oscar accepted (D-M).** Stated plainly, because it
   is the one place this "simple shell" advance touches the product's most sensitive flow: a
   terminal prints the kit into a scrollback the user already controls, whereas a GUI window is
   screenshot-able, screen-recordable, readable by accessibility and automation APIs, capturable
   by screen-sharing software the user forgot was running, and structurally invites a "save it
   for me" button. **Required mitigations, none optional:** shown exactly once; never written to
   disk by the app; not re-openable after acknowledgement; not retained in any renderer state
   after dismissal; an explicit acknowledgement before continuing; the copy action warned as
   putting the raw key on a clipboard other applications can read. This is a decided risk, not
   an open question — but it is the reason §9 and any review of this advance should spend most
   of their attention on first run.
3. **No plaintext at rest, anywhere new.** No cache of items or packs, no search history, no
   recently-viewed list containing content, no window-state file holding item text, no
   Electron `crashReporter` (explicitly disabled), no devtools in production builds. After the
   app quits, the only valija files on disk are the ones that existed before it started.
4. **No network, at all.** No auto-update feed, no analytics, no crash upload, no remote fonts
   or icons, no remote origin loadable by any window. A Content-Security-Policy that forbids
   remote origins, plus denial of `will-navigate` and `window.open` to non-local URLs, is the
   enforcement — not a promise in a README. This is `SPEC.md` §9's "no network calls at runtime"
   applied to a browser engine.
5. **The IPC surface is a trust boundary and is enumerated.** One channel per use case,
   arguments validated at the boundary with zod exactly as the MCP server does; no channel that
   accepts SQL, a module name, a shell command, or an arbitrary filesystem path. The only path
   the app writes to is the one the user selects in a native save dialog.
6. **Clipboard is a new egress mechanism and is documented as one.** Plaintext egress by
   explicit user action already exists (`valija export -o`), so this changes the mechanism, not
   the threat model — but a one-click copy of an entire context pack deserves a sentence in the
   GUI docs, and it must never happen automatically.
7. **Vault integrity and identity.** The GUI resolves `VALIJA_HOME` and `VALIJA_STATE_HOME`
   exactly as the CLI does, is the **same device**, never mints a second device id, never writes
   a lineage stamp, and leaves `vault.db` as a single file at rest with no `-wal`/`-shm`/
   `-journal` sidecar (M3 D-A).
8. **Unsigned distribution has a security cost (D-G).** Documenting "right-click → Open" or
   "Run anyway" trains precisely the behaviour malware relies on, for an audience least equipped
   to judge when it is safe. Accepted, with published SHA-256 checksums and a run-from-source
   path as the mitigations, and stated openly in the docs rather than glossed as a quirk.
9. **Idle auto-lock may only get tighter, never looser.** No background polling, no keep-alive,
   no "stay unlocked while the window is open". The GUI honours `VALIJA_AUTOLOCK_MINUTES`
   identically to the CLI.
10. **The MCP surface is untouched** — 5 tools, 2 prompts, stdio. The GUI neither embeds nor
    proxies an MCP server, and `SPEC.md` §9's statement that any connected MCP client receives
    plaintext is unaffected by this advance.
11. **Only fixture data in screenshots and docs.** Any screenshot shipped with this advance uses
    `src/testing/__fixtures__/golden-vault/`, whose passphrase and key are public by design and
    labelled as such — never a real vault, never a real key, never a real recovery kit.

---

## 9. Acceptance criteria

A reviewer should be able to check each line without guessing what was intended.

**Product invariants**

- [ ] The MCP surface is byte-for-byte unchanged: 5 tools with the same arguments, 2 prompts,
      stdio only.
- [ ] No change to the schema, to any migration, to the vault format, to `vault.json`, to the
      Argon2id parameters, to the key format, or to the SQLCipher configuration.
- [ ] No change to `argon2`, `@napi-rs/keyring`, or `better-sqlite3-multiple-ciphers` as the
      libraries in the crypto/session/storage path.
- [ ] Every CLI command behaves exactly as before; `npm run typecheck && npm run lint &&
      npm run test` pass, and the existing CI matrix is neither slowed nor gated by desktop
      packaging jobs.
- [ ] The published npm package's contents are unchanged (`files` remains an allow-list that
      excludes the desktop tree).
- [ ] `docs/SPEC.md` §2's "GUI … → later" Out line and §1's "one binary surface" sentence are
      corrected; no milestone number is assigned (D-O).

**The shell (D-A, D-P)**

- [ ] With a fixed clock, the pack the GUI displays for a project is **byte-identical** to the
      stdout of `valija export <project>` for the same vault, asserted by a test that compares
      the two strings — not by eye. Under a real clock the only permitted difference is the
      `generated` timestamp in the preamble.
- [ ] The project list, item list (including the `--type` filter), and search results are
      produced by the **same use cases** the CLI calls, so ordering and content match by
      construction; a test exercises each against the golden-vault fixture.
- [ ] No code path in the desktop app calls `session.write(...)`, `SaveContext`, `ImportItems`,
      or any repository mutation. The UI contains no edit, pin, archive, delete, or rename
      affordance, disabled or otherwise.
- [ ] The set of operations the UI exposes matches D-P's answer exactly — nothing extra "while
      we were in there".
- [ ] Sessions are opened per action and closed; no `Database` handle outlives a user action.
- [ ] No timer or interval refreshes vault state; refreshes are user- or focus-driven, so idle
      auto-lock is not extended by leaving the window open.
- [ ] After any GUI session, the vault folder contains `vault.json` and `vault.db` only — no
      `-wal`, `-shm`, or `-journal` sidecar.
- [ ] The GUI resolves `VALIJA_HOME` and `VALIJA_STATE_HOME` exactly as the CLI does and mints
      no new device id (the still-binding half of D-I).
- [ ] The GUI's behaviour when the vault's schema version is behind matches D-J(b)'s answer, and
      whatever that answer is, it is stated in the GUI docs.

**Vault initialization (D-M)**

- [ ] Init runs through the existing `CreateVault` use case, with `parsePassphrase`'s rules
      enforced (not re-implemented in the renderer) and a mismatch caught before anything is
      written.
- [ ] The recovery kit displayed is the exact output of `renderRecoveryKit`, shown once, never
      written to disk by the app, not re-openable after acknowledgement, and gated behind an
      explicit "I stored this offline" acknowledgement.
- [ ] The raw key hex does not appear in any log, any persisted renderer state, or any file
      written by the app.
- [ ] After GUI init, `valija status` in a terminal reports the same vault as initialized and
      unlocked; there is exactly one vault, one keychain entry, one device identity.
- [ ] The copy-key action warns that the clipboard is readable by other applications.
- [ ] Nothing in the app can destroy or re-initialize an existing vault (`VAULT_ALREADY_EXISTS`
      is surfaced in plain language, per D-N).

**Session (D-H)**

- [ ] `valija unlock` in a terminal leaves the GUI unlocked with no second prompt; `valija lock`
      leaves the GUI locked; unlocking in the GUI unlocks MCP tools. One keychain entry, shared.
- [ ] The macOS keychain-ACL behaviour is recorded — silent, prompts once, prompts every time,
      or fails — with the exact macOS version, and the answer appears in the GUI docs.
- [ ] Idle auto-lock (`VALIJA_AUTOLOCK_MINUTES`) applies to the GUI identically to the CLI.

**Renderer and network hardening (§8.3–§8.5)**

- [ ] The renderer runs with `contextIsolation: true`, `nodeIntegration: false`,
      `sandbox: true`; the preload exposes a fixed, enumerated API with one method per use case,
      each validating its arguments at the boundary.
- [ ] No IPC channel accepts SQL, a module name, a shell command, or an arbitrary filesystem
      path; the only file the app writes outside the vault is the user's chosen export target.
- [ ] The app makes zero network requests: no auto-update, no analytics, no crash reporting, no
      remote fonts or icons; a CSP forbids remote origins and navigation to them is denied.
      Verified against the built artifact, not only the source.
- [ ] After quitting, no new plaintext file, cache, index, or crash dump containing vault
      content exists on disk.
- [ ] Screenshots and docs use only the golden-vault fixture, labelled as published test data.

**Packaging and docs (D-G)**

- [ ] Unsigned artifacts build for macOS, Windows and Linux, each with a published SHA-256; the
      native modules load correctly in the packaged app on every target (not only in dev).
- [ ] First-launch friction is documented per OS using the literal text the OS displays, with
      the exact bypass steps, plus the run-from-source alternative — and the run-from-source
      path is verified, not assumed.
- [ ] The GUI docs state what the GUI deliberately does not do (curation, import, artifacts) and
      where those live.

**Connect your AI tools (D-P)**

- [ ] The guided connect step calls the existing `install` use case unchanged, through
      `installer.ts`'s existing backup-and-merge discipline — no new parsing or writing logic
      for any client's config format is authored in the GUI.
- [ ] This path never opens `vault.db` and never touches the OS keychain entry; a test proves a
      connect action leaves the vault's lock state and lineage untouched.
- [ ] Every failure mode `installer.ts` already surfaces (missing client, malformed existing
      config, already-configured) is shown in plain language, per D-N — not a raw error.

**Schema migration confirmation (D-J-b)**

- [ ] A vault whose schema is already current never sees the confirmation screen.
- [ ] A vault whose schema is behind shows the confirmation screen, naming the ciphertext backup
      migrations 002/003 take, before `migrate()` runs — not after, and not silently.
- [ ] Declining the confirmation leaves the vault exactly as it was (still locked or still on the
      unlock screen), with no partial migration.

**Not applicable this advance** *(listed so a reviewer does not look for them)*

- [ ] ~~Curation verbs behave correctly~~ *(not applicable — D-A, D-B)*
- [ ] ~~Writes go through `session.write` with one lineage bump per action~~ *(not applicable —
      D-C, D-I; binding on the curation advance)*
- [ ] ~~Fork detection is surfaced without auto-merge~~ *(not applicable — D-I)*
- [ ] ~~Concurrent GUI/MCP write behaviour~~ *(not applicable — D-J(a))*
- [ ] ~~Skills / agents / provider artifacts~~ *(not applicable — D-D, D-E)*
- [ ] ~~New MCP tool or resource~~ *(not applicable — D-K)*

---

## 10. Deliverables summary (for the planner, not a plan)

An **Electron** desktop application (D-F) — main process composing the existing container,
sandboxed renderer over an enumerated IPC surface — that:

- **creates a vault** (passphrase, Argon2id, one-time recovery-kit display with explicit
  acknowledgement) — the single write capability in scope (D-M);
- **unlocks, locks and reports status** through the CLI's own keychain entry (D-H), honouring
  idle auto-lock unchanged;
- **browses** projects and items, **searches** full-text, and **previews** a rendered context
  pack byte-identical to `valija export`;
- **copies** that pack to the clipboard or **exports** it to a user-chosen file;
- **connects AI tools** via a guided wrapper over the existing `install` use case, with no new
  config-writing logic of its own (D-P);
- asks before **migrating** a behind-schema vault, naming the backup migrations 002/003 take,
  rather than migrating silently (D-J-b);

packaged **unsigned** for macOS, Windows and Linux with published checksums, a documented
run-from-source path, and per-OS first-launch instructions (D-G); living in a `desktop/`
workspace in this repo (D-L); documented for a non-technical reader (D-N); with `docs/SPEC.md`
§1 and §2 corrected and **no milestone number** assigned (D-O).

**Not in it:** no curation of any kind, no provider artifacts, no MCP change, no schema or format
or crypto change, no import, no `doctor`, no signing, no auto-update, no network call, no
localization, no mobile.

All decisions are recorded (§7). Nothing remains open for Gate R.

---

## 11. Biggest risk

**The advance's entire value is reaching a non-technical user, and the two things most likely to
go wrong — unsigned-binary friction and macOS keychain behaviour — both fail exactly at that
person, on the first two screens, before any of the shell's value is visible.**

D-N says non-technical-first. D-G ships binaries that macOS Gatekeeper and Windows SmartScreen
actively block with security warnings, so the first instruction the app's own documentation
gives a nervous user is how to override their operating system's protection. D-H then shares a
keychain entry across two binaries, which on macOS may prompt for a password on every read or
fail outright depending on how the item's ACL was created — and if it prompts every time, the
"no terminal needed" promise degrades into a different kind of friction on every launch. Neither
risk is speculative; both are properties of decisions already taken, and neither is discovered
until packaging is real.

What makes this the top risk rather than an annoyance is that **there is no curation payload to
absorb the cost**. With D-A's answer, everything this advance adds over the existing CLI is
*reachability*: the same data, the same rendering, the same operations, in a window. If
packaging turns out to be the hard part — three native modules (`better-sqlite3-multiple-
ciphers`, `argon2`, `@napi-rs/keyring`) rebuilt against Electron's ABI, across three operating
systems and two macOS architectures, all unsigned — then the advance spends its whole budget on
distribution and delivers a window the target user is warned against opening. The honest early
signal to watch for at planning time: if the native-module matrix or the ACL spike looks
uncertain, that is the moment to re-scope (fewer targets, or run-from-source first), not after
the UI is built.

**Second risk: the recovery kit in a window (D-M, §8.2).** It is the one place this otherwise
modest advance touches the product's most sensitive flow, and it is the only failure here that
is unrecoverable — a kit the user never stored, or one captured by screen-sharing software,
cannot be re-issued. The mitigations in §8.2 are cheap and specific; the risk is that they get
quietly relaxed during implementation for usability's sake ("let them re-open it later", "let
them save it to a file"), which is exactly how an accepted risk becomes a bigger one than the
person who accepted it agreed to.

**Third risk: "read-only" being read more strongly than it is true.** The shell performs no
domain write, but a session open still rewrites journal state and, today, will run migrations
(D-J(b)). If that goes undocumented, someone will eventually open a stale vault with a
double-click and be surprised by a table rebuild — and the phrase "read-only viewer" will have
been the reason they were not warned.
