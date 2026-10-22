# PROJECT-DETECT — Valija knows which project you are in · Refined Spec

**Status:** Gate R approved by Oscar, 2026-10-18. All 19 decisions in §9 (D-A … D-S) were
resolved to their recommended defaults; treat those defaults as settled.
**Directory:** `PROJECT-DETECT`, a feature advance with no milestone number (same posture as
`CURATION` / `CARDS`).
**Branch (suggested):** `feat/project-detect-PROJECT-DETECT`, cut from `feat/curation-CURATION`
(CURATION is PASS but not yet merged to `main`). This advance therefore depends on CURATION landing
first, or on being rebased onto `main` after it does.
**Source:** Oscar's raw idea, checked against the tree on 2026-10-18.
**Inherits from:** `docs/SPEC.md` §4 (D9 project auto-create, D11), §5, §7, §8, §9;
`docs/vault-format.md` §6, §11, §14; `advances/CURATION/refined.md` (shape, MCP posture);
`advances/PROJECT-NAME-SLUG/refined.md` D-8 (CLI project arguments stay strict slugs);
`specs/desktop.md` (closed IPC; paths originate only from a native dialog).
**Touches (expected):** `src/context/**`, `src/shared/infra/migrations/**` (under the D-A default),
`src/delivery/**` (CLI, MCP, container), `desktop/src/**` (IPC + project screen), golden fixture,
docs.

---

## 1. Goal

**When the user does not name a project, Valija resolves it from where the work is happening. The
CLI uses the current directory. The MCP server uses the AI client's workspace. Resolution goes
through bindings the user creates (folder → project, git repository → project), from either the
CLI or the desktop app. An explicit project name always wins. Detection never invents or creates a
project, never sends a path anywhere, and never weakens encryption or the five-tool MCP surface.**

Four phrases carry the scope:

- **"Bindings the user creates."** The trust anchor is a deliberate user act, stored encrypted. A
  heuristic such as "the repo is called `valija` and so is a project" may *suggest* a binding. It
  does not silently decide where a save lands (D-E).
- **"Explicit always wins."** A `project` argument or flag behaves exactly as it does today.
  Detection only fills a gap that is currently an error or a required argument.
- **"Never invents or creates."** Detection resolves only to projects that already exist. Auto-create
  (SPEC D9) still applies only to an explicitly named project (D-H).
- **"No path leaves the machine."** Paths and remotes stay inside the encrypted vault and the local
  process. They never appear in an MCP response, a log, or the desktop preferences file (§10).

---

## 2. User walkthrough

### 2.1 Linking a repository once (CLI)

Oscar works in `~/code/valija`, a git clone whose `origin` is `git@github.com:oscar/valija.git`. A
project `valija` already exists in his vault.

```
$ cd ~/code/valija
$ valija which
No project detected here.
Hint: a project named "valija" matches this repository's name. Link it with: valija link valija

$ valija link valija
Linked repository github.com/oscar/valija → project "valija".
(Any clone of this repository, on any device that syncs this vault, now resolves to "valija".)

$ valija which
valija  (linked repository github.com/oscar/valija)

$ valija show
— decision · 2026-07-23  id 01J3V2K9…  📌  [sync]
Rollback journal (DELETE), never WAL, …

$ valija export -o pack.md
Exported valija (md) to pack.md

$ valija links
PROJECT   KIND        TARGET
valija    repository  github.com/oscar/valija
```

A monorepo sub-folder that should map to a different project gets a more specific folder link:

```
$ cd ~/code/acme/services/billing
$ valija link acme-billing --by folder
Linked folder ~/code/acme/services/billing → project "acme-billing".
```

| # | Action | User sees | Effect on data |
|---|---|---|---|
| 1 | `valija which [--dir <path>]` | resolved project and *why*, or "No project detected here" plus an optional name-match hint | none (read) |
| 2 | `valija link <project> [--dir <path>] [--by repository\|folder]` | one confirmation line naming the target and project | one binding row, one lineage bump |
| 3 | `valija links [project]` | table of bindings | none (read) |
| 4 | `valija unlink [--dir <path>] [--by …]` or `valija unlink <binding-id>` | one confirmation line | binding row removed, one lineage bump |
| 5 | `valija show` / `valija export` with no project | the resolved project's items / pack, as if named | none (read) |
| 6 | `valija show other-project` | `other-project`, exactly as today (explicit wins) | none |

### 2.2 An AI tool in a linked workspace (MCP)

In Claude Code, opened in `~/code/valija`, Oscar says "load my context":

1. The model calls `get_context {}` (no `project`). The server learns the workspace from the
   client (D-C), finds the repository binding, and returns the `valija` pack. The pack header
   already reads `# Context pack: valija`, and the pack bytes are unchanged.
2. Later the model calls `save_context { content: "…", type: "decision" }` and gets back:
   `Saved decision to project "valija" (detected: linked repository). Item id: 01J…`
3. If the model *does* pass `project: "other"`, the save goes to `other`, exactly as today.

### 2.3 Nothing detected

Claude Desktop has no workspace. Its server cwd is not a project folder (to be confirmed by the
spike, D-C). The model calls `get_context {}` and gets:

```
No project was given and none is linked to this workspace. Call list_projects, ask the user which
project they mean, then pass it as `project`. [PROJECT_NOT_DETECTED]
```

If the workspace has two roots that resolve to two different projects, the call fails with
`PROJECT_AMBIGUOUS` instead, naming both project slugs (never the paths).

### 2.4 Desktop app

On a project's screen, a new **Linked folders & repositories** section lists the project's
bindings, each with **Unlink**. **Link a folder…** opens the native folder picker. After a folder is
chosen, the app shows:

- what that folder resolves to *now* (parity with `valija which`)
- whether it is a git repository, and its normalized remote if any
- a choice: **Link this repository** (default when a remote exists) or **Link only this folder**

**Link** then creates the binding. The desktop app itself never auto-detects anything, because it
has no working directory. Its job is to *manage* bindings, the same way the CLI does.

### 2.5 Where detection applies afterwards, and where it deliberately does not

| Surface | Uses detection when the project is omitted? | Why |
|---|---|---|
| MCP `save_context`, `save_handoff`, `get_context` | **yes**; `project` becomes optional | these are the calls the idea targets |
| MCP `search_context` | **no**; omitted still means vault-wide | changing an existing meaning is a silent behaviour change (D-F) |
| MCP `list_projects` | marks the detected project, if any (D-I) | helps the model disambiguate |
| MCP prompts `/load-context`, `/save-context` | `project` optional (D-Q) | parity with their tools |
| CLI `show`, `export` | **yes**; `<project>` becomes `[project]` | the read commands that require a project |
| CLI `search -p` | **no**; unchanged | same reason as MCP search |
| CLI `import -p` | **no**; still required for a real import | a bulk write, with list-first safety (M2) |
| Desktop app | **no auto-detection** (no cwd); manages bindings only | it has no working directory |
| Context pack bytes, `valija export` output, golden `expected-*` | **unchanged** | vault-format contract |
| MCP response text | names the project and the *kind* of detection, **never a path or remote URL** | privacy (§10) |

---

## 3. Context snapshot (verified facts the planner builds on)

1. **The CLI has no `save` command.** Projects are named by `show <project>`, `export <project>`,
   `search -p`, and `import -p` (`program.ts`). The raw idea's "every save" applies to MCP only. A
   CLI `save` is out of scope (§4).
2. `project` is **required** on MCP `save_context`, `save_handoff`, `get_context`. It is
   **optional** on `search_context`, where omitted means vault-wide (`server.ts`).
3. `SaveContext` **auto-creates** the project (`findOrCreateProject`; SPEC D9). If detection could
   produce a not-yet-existing name, a model save would create projects nobody asked for. Hence D-H.
4. There is **no existing notion** of cwd, git, roots, or workspace anywhere in `src/` (grep:
   none).
5. The MCP server is launched by the client through `npx -y valija mcp`. The installer writes it
   into **user-global** configs (`~/.claude.json` top-level `mcpServers`, `~/.cursor/mcp.json`,
   Claude Desktop's config), so one server definition serves every workspace. The server's
   `process.cwd()` is whatever the client chose. Whether a given client sets it to the workspace,
   and whether it supports the MCP `roots` capability, is **not verified in this repo** (D-C
   spike). SDK `^1.29.0` exposes `roots/list` to a server.
6. **Device-local state** (`~/.valija-state/state.json`, `FileDeviceIdentity`) is plaintext JSON,
   mode 0600, outside `VALIJA_HOME`. Today it holds only a device id and lineage bookkeeping:
   **no project names, no content**.
7. `docs/gui.md` states that the desktop app launched from its icon may use a **different
   `VALIJA_STATE_HOME`, and therefore a different device id**, than terminal sessions. Anything
   scoped by device id would not match between desktop and terminal (D-L).
8. Schema is **v3**. Migrations follow the 002/003 pattern: transaction, `pendingMigrations`
   feeds the desktop upgrade-confirm screen, and the CLI migrates silently on unlock. There is
   **no "schema too new" refusal** in the desktop/CLI code. An older valija on a second synced
   device opening a v4 vault would simply ignore an additive table. vault-format §11 *does* require
   a second reader (MOBILE PoC) to refuse a newer `schema_version`. The MOBILE advance is closed
   (`poc.md` §10).
9. Desktop IPC is a closed, enumerated set (`channels.ts`, asserted by `register-handlers.test.ts`).
   **Filesystem paths originate only from a native dialog** in the main process. The renderer
   receives `{ handle, displayName }`, and a test asserts no zod schema carries a free-form path
   (`specs/desktop.md` §160).
10. `ContextErrorCode` has `PROJECT_NOT_FOUND` already. Error copy on desktop is keyed by code
    (`errorCopy`), in both `en.ts` and `es.ts`, with key-set parity enforced.
11. `ProjectRepository` has `findByName` and `list` but no lookup by id.
12. Project names stay strict slugs on the CLI (PROJECT-NAME-SLUG D-8). `valija link <project>`
    inherits that.

---

## 4. Scope

### In
- **Domain:** binding concept (a target, either a canonical folder path or a normalized git
  remote, mapped to one project); target normalization/parsing values; a pure **resolution
  policy** (precedence D-E, ambiguity rules); new error codes (§6).
- **Application:** use cases to resolve, link, unlink, and list bindings; a port for probing a
  directory (canonical path, enclosing git repo, its remote) that is **read-only** and never
  spawns a process (D-J); a port for the binding repository.
- **Infra:** a filesystem/git-config probe adapter; a SQLite binding repository; migration 004
  (under the D-A default).
- **CLI:** `link`, `unlink`, `links`, `which`; `show` and `export` take an optional project.
- **MCP:** `project` optional on `save_context`, `save_handoff`, `get_context`; workspace
  discovery (D-C); detection note in save responses; detected-project marker in `list_projects`;
  updated descriptions. **Still five tools, two prompts.**
- **Desktop:** bindings section on the project screen; a folder-picker dialog channel; inspect,
  link, unlink, and list channels; copy in both catalogs.
- **Contracts and docs in the same commit:** `docs/vault-format.md` §6 (new table) + regenerated
  golden fixture (D-A); `docs/SPEC.md` §5/§6/§7/§8/§9; `specs/context.md`, `specs/delivery.md`,
  `specs/desktop.md`; `README.md`; `docs/gui.md`; `CHANGELOG.md`.

### Out (deferred on purpose)
- A CLI `save` command (fact 1). Detection for it would come for free later.
- **Marker files** (`.valija`, `.valija.json` in a repo) (D-B: hostile-repo risk).
- Auto-scoping `search` to the detected project (D-F).
- Detection for `import` (CLI and desktop).
- Auto-linking, or auto-using a name-match without a binding (D-E).
- Desktop auto-detection of an "active project" (it has no cwd).
- Project rename, merge, or delete; moving items between projects.
- A `valija doctor` / desktop Diagnostics "detection" check.
- A general "schema too new" refusal for older valija binaries (fact 8). Worth its own advance.
- Per-tool scoping / profiles (SPEC M4 line).

---

## 5. Behaviour

### 5.1 Resolution (every surface that uses it)

Input: an optional explicit project and zero or more **workspace directories** (CLI: cwd or
`--dir`; MCP: D-C). Output: one of:

| Outcome | When | Surface behaviour |
|---|---|---|
| `explicit(name)` | a name was given | unchanged from today, auto-create on save included |
| `env(name)` | `VALIJA_PROJECT` set (D-D) | treated as explicit, auto-create included |
| `bound(project, kind)` | a binding matches (folder longest-prefix first, then repository; D-E) | proceed; project must still exist |
| `none(hint?)` | nothing matches | `PROJECT_NOT_DETECTED`; the message may carry a name-match hint (D-E) |
| `ambiguous(projects)` | ≥2 workspace dirs resolve to different projects | `PROJECT_AMBIGUOUS`, listing project slugs only |

Resolution needs an unlocked vault (bindings are encrypted, D-A). A locked vault yields
`VAULT_LOCKED`, exactly as today, before any detection runs.

### 5.2 Binding operations

| Op | Rules | Rejected when |
|---|---|---|
| **link** | target from `--dir` (default cwd) or the chosen desktop folder. Kind defaults to *repository* when the dir is inside a git repo with a usable remote (D-K), else *folder*. Project must exist (D-H) | project missing → `PROJECT_NOT_FOUND`; `--by repository` with no repo/remote → `NO_GIT_REMOTE`; target already bound to **another** project → `BINDING_CONFLICT` (D-R); same project → no-op, no write |
| **unlink** | by binding id, or by the binding that a dir resolves through | none matching → `BINDING_NOT_FOUND` |
| **links** | all bindings, or one project's | — |
| **which** | runs resolution for the dir (no explicit name) and prints outcome + kind + target | never fails on "nothing found"; prints it |

Every mutation goes through one `withSession` → `session.write`, so exactly one lineage bump per
real change and zero per rejection or no-op (CURATION D-L posture).

---

## 6. Error codes

| Code | New? | When |
|---|---|---|
| `PROJECT_NOT_DETECTED` | new | no project given and nothing resolves. The MCP message tells the model to call `list_projects` and ask |
| `PROJECT_AMBIGUOUS` | new | workspace roots resolve to different projects. Lists slugs only |
| `BINDING_CONFLICT` | new | linking a target already bound to another project. Names that project; the user must unlink first |
| `BINDING_NOT_FOUND` | new | unlink with no matching binding |
| `NO_GIT_REMOTE` | new | `--by repository` (or the desktop repo option) where there is no repo or no usable remote |
| `INVALID_WORKSPACE_PATH` | new | `--dir` does not exist / is not a directory / is unreadable |
| `PROJECT_NOT_FOUND` | existing | link to a missing project; a binding pointing at a project that no longer exists (defensive) |
| `VAULT_LOCKED` | existing | unchanged |

All new codes need desktop copy in `en.ts` and `es.ts`. Messages that reach MCP never contain a
path or a remote URL.

---

## 7. Schema / migration impact

**Default (D-A option 1): migration 004 adds one table for bindings.** This is additive: one row per
binding, with an id, the project it maps to, its kind (`folder` | `repository`), its canonical
target value (unique per kind), and a creation timestamp. No existing table changes.

Why a migration is justified here, unlike CURATION:
- Bindings contain **paths and remote names**, which are sensitive. The only at-rest place Valija
  promises to protect is the SQLCipher vault. Every non-migration alternative either stores them in
  plaintext (D-A option 2) or drops stored bindings entirely (option 3).
- **Repository** bindings are naturally portable. A vault synced to a second device makes the same
  repo resolve there too, which only an in-vault store gives.

Costs to accept:
- `LATEST_SCHEMA_VERSION` becomes 4. Desktop users see the existing upgrade-confirm screen once.
  The CLI migrates silently on unlock. Follow the 002/003 transaction pattern; whether to take a
  ciphertext backup for a purely additive table is the planner's call (default: follow the
  pattern, take it).
- vault-format §6 gains the table; §7 notes that readers ignore it. The **fixture is regenerated**
  (`vault.db`, `manifest.json` schema version). `expected-pack.md`, `expected-export.md`,
  `expected-search.json` **must stay byte-identical**. The fixture's bindings table stays **empty**
  (no fake paths in published test data).
- The MOBILE PoC reader would refuse a v4 vault (vault-format §11). That advance is closed, so this
  is a documentation note, not a blocker.
- Older valija binaries on a second device keep working, since they ignore the table (fact 8).

---

## 8. Impact on outputs and the golden fixture

- `assembleContextPack` and `renderContextPackMarkdown` are **unchanged**. `get_context` output is
  byte-identical to today for the same project; the pack header already names the project.
- MCP `save_context` / `save_handoff` responses gain ` (detected: <kind>)` **only when detection
  was used**. Explicit calls produce today's exact text.
- `list_projects` text may gain a marker on the detected project (D-I). This is MCP presentation,
  not vault-format §10.
- `valija show` / `valija export` output is unchanged; only argument resolution changes.

---

## 9. Open decisions (options, trade-offs, recommended defaults)

### D-A. Where bindings live
1. **In the vault: a new table, migration 004 (schema v4).** Encrypted at rest, synced with the
   vault, read in the same session the tool already opens. Costs: §7.
2. Device-local `~/.valija-state` file (plaintext, 0600). No migration and no fixture change. But it
   writes **project names and paths in plaintext** next to device bookkeeping that today holds
   neither (fact 6). That weakens SPEC §9's "everything at rest is ciphertext" in spirit, and repo
   bindings stop following the user to other devices.
3. No stored bindings: detection only from `VALIJA_PROJECT` and a name-match. Smallest diff, no
   migration. But the desktop app has nothing to manage, so the parity rule is satisfied only
   vacuously, and repos whose name differs from the slug can never be detected.
4. Store bindings as `meta` rows. Avoids a numbered migration, but abuses a table that
   vault-format §6 defines as sync bookkeeping that readers must ignore. It is a contract change in
   disguise.

**Default: 1.** It is the only option that keeps sensitive targets encrypted *and* gives both
surfaces something real to manage. *Trade-off:* a schema bump and fixture regeneration for a
convenience feature.

### D-B. Binding kinds, and marker files
- Kinds: **folder + repository (default)** / folder only / repository only. Repository bindings
  survive re-clones and other devices. Folder bindings handle monorepo sub-folders and non-git
  directories.
- Marker file in the repo (`.valija` naming a project): **defer (default)** / honour it / honour it
  only after the user confirms once. *Reason:* a cloned **hostile repository** could ship a marker
  naming a likely project slug (`work`, `acme`). An AI session working in that repo would then
  silently load the user's real context into a conversation driven by attacker-controlled files.
  User-created bindings cannot be planted by a repo.

### D-C. How the MCP server learns the workspace
1. **MCP `roots` first. If the client does not declare roots, fall back to `process.cwd()`, but
   only when the cwd is not a "non-workspace" directory (filesystem root, the user's home, the
   client's own install dir). Otherwise none.**
2. `process.cwd()` only. Simplest, but in clients that launch servers from `/` or `$HOME` it would
   bind to nonsense, or match a binding on `~`.
3. `roots` only. The most principled (roots exist for exactly this), but it fails in any client
   without roots support.
4. Configuration only (`VALIJA_PROJECT` per client entry, D-D). No guessing, but it needs
   per-project client config, and the installer writes global config (fact 5).

**Default: 1, gated by a spike (Slice 0 for the planner).** For Claude Code, Claude Desktop, and
Cursor, record: the server's cwd, whether `roots` is declared, and what `roots/list` returns. Commit
the result as `advances/PROJECT-DETECT/spike.md`. The spec's walkthrough §2.2/§2.3 assumes
Claude Code provides a usable workspace and Claude Desktop does not. **If the spike contradicts
that, the walkthrough and docs change, not the design.** Roots and cwd are client-controlled, not
model-controlled, so the model cannot steer detection through them.

### D-D. `VALIJA_PROJECT` environment variable
- **Include (default).** Read by the CLI and the MCP server, ranked just below an explicit argument,
  and treated as explicit (auto-create allowed). It serves per-project client configs
  (`.mcp.json`, `.cursor/mcp.json`) and shells (`direnv`).
- Defer. Fewer moving parts, but clients with no workspace get no non-explicit option at all.

The desktop app ignores it: environment-resolved config is already a documented desktop
non-feature (`docs/gui.md` "Configure anything environment-resolved"), so this is not a parity
gap.

### D-E. Precedence, and the name-match heuristic
Precedence (default): **explicit arg > `VALIJA_PROJECT` > folder binding (longest matching
ancestor) > repository binding > none.** A folder binding is more specific than a repo binding,
which is what lets a monorepo sub-folder override its repository.

Name-match (repo folder name or remote repo name equals an existing project slug, no binding):
1. **Suggest only (default).** It appears as a hint in `which` and in the `PROJECT_NOT_DETECTED`
   message ("a project named X matches; link it").
2. Auto-use it for reads and writes, flagged in the response. This is real zero-config, but two
   unrelated repos named `api` or a hostile repo named after a project would silently route saves.
   Items cannot be moved between projects (§4 Out), so a wrong save is costly to undo.
3. Off entirely.

### D-F. Which operations resolve
- **Only operations where a project is currently required (default):** MCP `save_context`,
  `save_handoff`, `get_context`; CLI `show`, `export`. Search keeps "omitted = vault-wide". Import
  keeps explicit `-p`.
- Also auto-scope search to the detected project. This is handier inside a repo, but it silently
  changes the meaning of an existing call for every model that relies on vault-wide recall.

### D-G. Nothing detected
1. **Fail with `PROJECT_NOT_DETECTED`, with guidance (default).**
2. Fall back to a default "inbox" project. The model never fails, but context piles up in a
   project nobody chose.
3. Return the project list inline. This duplicates `list_projects`.

### D-H. Detection and project creation
- **Detection resolves only to existing projects and never creates one (default).** Auto-create
  stays tied to an explicit name or `VALIJA_PROJECT`.
- `link <project>` requires the project to exist **(default)**, versus creating it. There is no
  project-creation verb on either surface today, and desktop links from an existing project's
  screen. Creating projects on link would give the CLI a capability the desktop lacks (parity).

### D-I. Transparency in responses
- Save responses append ` (detected: linked folder | linked repository | VALIJA_PROJECT)`.
  **Kind only; no path, no remote URL (default).** Alternative: include the remote (more
  debuggable, but it sends a private repo name to the AI provider).
- `get_context`: **unchanged (default)**, since the pack header names the project. Alternative:
  prepend a detection line, which makes MCP output diverge from `valija export`.
- `list_projects`: **mark the detected project (default)**, e.g. `- valija: 12 item(s), … (this
  workspace)`. Alternative: unchanged.

### D-J. Reading git
- **Read `.git` metadata files directly, read-only, and never spawn `git` (default).** Handles
  `.git` as a dir, as a file (worktrees, submodules), and the common dir's `config`.
- Spawn `git config --get remote.origin.url`. Fully correct (includes, `insteadOf`), but running
  `git` inside an arbitrary repo can execute repo-configured programs (e.g. `core.fsmonitor`). It
  also adds a process spawn to every MCP call and a hard dependency on git being installed.
  *Trade-off of the default:* `include`/`insteadOf` rewrites are not honoured. Document it.

### D-K. Which remote, and normalization
- Remote: **`origin`; else the only remote; else none (default)**, versus prompting / `--remote
  <name>` (the planner may add the flag).
- Normalization (default): reduce SSH, `https`, and `git://` forms to `host/owner/repo`. Lowercase
  the host, drop scheme, port, trailing `.git`, and trailing slash, and **always strip userinfo**
  (`https://user:TOKEN@host/…`). A credential embedded in a remote URL must never reach the vault,
  the screen, or a response. Path case is kept, because hosts differ.

### D-L. Folder semantics
- **Canonical real path (symlinks resolved), matches the folder and every descendant, longest match
  wins. Not scoped to a device (default).**
- Device-scoped folder bindings avoid a binding from machine A matching an unrelated same-path
  folder on machine B. But fact 7 means the desktop app and the terminal can have **different device
  ids on the same machine**, so a desktop-created folder link would not work in the terminal.
- Case-insensitive filesystems (macOS default, Windows) and Windows drive letters must normalize
  consistently. The planner owns the rule; the tests must cover it.

### D-M. CLI surface
- **Default:** `valija which [--dir]`, `valija link <project> [--dir] [--by repository|folder]`,
  `valija unlink [<binding-id> | --dir … [--by …]]`, `valija links [project]`; `show [project]`,
  `export [project]`.
- Alternative: one `valija bind` command with sub-verbs (`bind add|rm|ls|which`). Fewer top-level
  names, more typing.
- Output prints paths with `~` for the home directory. It prints project names and targets only,
  never content.

### D-N. Desktop surface and IPC
- **Default:** a bindings section on the project screen (list, Unlink, Link a folder…). The link
  flow shows the folder's current resolution, which gives parity with `which`.
- Channels (default): `dialog:chooseProjectFolder` (returns `{handle, displayName}`, path kept in
  main), `bindings:inspect {handle}`, `bindings:link {handle, projectName, by}`,
  `bindings:unlink {bindingId}`, `bindings:list {projectName?}`. The renderer never sends a path.
  `bindings:list` may return display paths main → renderer, which has precedent in the per-client
  vault path display.
- Alternative: reuse `dialog:chooseVaultFolder`. Fewer channels, but one handle type would serve
  two meanings, and the relocation flow's checks would apply to the wrong thing.
- No confirmation for unlink (reversible by re-linking).

### D-O. Application shape (hexagonal)
1. **A pure resolution policy in the domain, plus a `ResolveProject` use case. Delivery calls it,
   then passes the resolved name to the unchanged existing use cases (default).** Existing use
   cases and their tests are untouched, and "no use case calls another" holds. *Cost:* two session
   opens per detected call (keychain read + raw-key open, no Argon2), and resolve-then-act is not
   one transaction.
2. Thread a `ProjectRef = explicit | workspace` into `SaveContext`, `GetContextPack`, and
   `ShowProject`, resolved inside their single session. Atomic, one open, but it changes every
   affected use-case signature and test.

The race in option 1 (a binding removed between resolve and act) is harmless: the act still uses
an existing project by name.

### D-P. Module placement
- **Inside `context` (default):** bindings reference projects and live in the same vault session.
  Adds `application/ports/` (binding repository, workspace probe), `domain/values/` (target
  values), `domain/policies/` or `services/` (resolution), `infra/` (`SqliteProjectBindingRepository`,
  a `File…`/`Fs…` git probe).
- New `workspace` module (`workspace → shared, context`): cleaner separation of the filesystem/git
  concern, but it needs a cross-module path into the vault session that only `context` owns
  today.

### D-Q. Prompts
- **`/load-context` and `/save-context` take an optional `project` (default).** Without one, the
  prompt tells the model to call the tool without `project`. Prompt count stays two.

### D-R. Binding conflicts
- **One target maps to exactly one project. Linking a target bound elsewhere fails with
  `BINDING_CONFLICT`, naming the current project (default).**
- Alternative: `--replace` to move it in one step. Convenient, but a typo can silently re-route a
  repo's saves.

### D-S. Caching
- **No cache: resolve on every call (default).** Roots can change mid-session
  (`roots/list_changed`), and the walk is a handful of `stat`s. Alternative: per-process cache
  invalidated on `list_changed`, which adds complexity for no measured need.

---

## 10. Security surfaces (must not be weakened)

1. **Paths and remotes are sensitive data.** They are stored only inside the SQLCipher vault
   (D-A). They are never written to `~/.valija-state`, the desktop preferences file, logs, error
   messages that reach MCP, or the recovery kit.
2. **Nothing leaves the machine.** Detection reads the local filesystem only. There is no network
   call and no `git fetch`, and MCP responses carry project slugs and detection *kind*, never
   targets (D-I).
3. **No process spawn in detection** (D-J). Valija never executes `git` or anything
   repo-configured inside a workspace it is probing.
4. **Credential stripping** of remote URLs is mandatory before storage or display (D-K), with tests
   for `https://user:token@…` forms.
5. **The trust anchor is a user act.** Only user-created bindings (CLI or desktop) or user-set
   `VALIJA_PROJECT` route a call. Repo content (marker files, D-B) and name coincidences (D-E)
   cannot route a call silently. The model cannot influence roots or cwd. Its only lever, the
   explicit `project` argument, is unchanged from today.
6. **Detection never creates projects** (D-H), so a mis-detection cannot spawn vault content
   under a name nobody chose.
7. **All binding writes go through `withSession` → `session.write`.** A locked vault returns
   `VAULT_LOCKED` for every new verb and every detected call.
8. **Desktop IPC stays closed.** Every new channel is added to `CHANNELS`, `SCHEMAS`, `ChannelMap`,
   and the bridge, and the closed-set test is updated. **No request schema accepts a path.**
   Folders come only from the main-process dialog, as an opaque handle.
9. **Migration safety** (D-A): transactional, follows the existing backup pattern, and passes the
   desktop upgrade-confirm gate.
10. **No new dependency.** Git URL parsing and `.git` reading are hand-written and tested.

---

## 11. Architecture notes

- **Domain** (`context/domain`): target values (`parseFolderTarget`, `parseRepositoryTarget` →
  `Result`, normalization total and pure), a binding entity with a `createX` factory, a pure
  resolution policy (inputs: explicit?, env?, candidate targets per workspace dir, bindings,
  projects; output: the §5.1 outcome). New codes go in `errors.ts`. No I/O.
- **Application:** `ResolveProject`, `LinkWorkspace`, `UnlinkWorkspace`, `ListBindings` (names are
  the planner's), each an `XUseCase` under `use-cases/`. Ports go under `ports/`: binding
  repository and `WorkspaceProbe` (dir → canonical path + optional normalized remote). The probe is
  a port, so use cases are tested with fakes and no real filesystem.
- **Infra:** `SqliteProjectBindingRepository`; a `Fs…`/`File…` git-config probe; migration 004.
- **Delivery:** the CLI reads cwd and `--dir`. The MCP server collects workspace dirs (roots → cwd
  filter, D-C) through a small, testable delivery adapter and calls `ResolveProject` only when
  `project` is omitted. `container.ts` wires it all.
- **Desktop:** main-process handlers call container use cases only. The probe runs in main on the
  dialog-chosen path. Pure view logic (e.g. which link option is the default for an inspected
  folder) lives in a `state/` module with a sibling test.
- **Tests per layer:** normalization tables (SSH, https with credentials, `.git` suffix, ports,
  case); the resolution policy (every precedence row, longest-prefix, ambiguity); use cases with a
  fake probe (one bump per change, zero per no-op/rejection); the probe against temp dirs (plain
  repo, worktree `.git` file, submodule, no remote, symlinked dir); migration 004 up from a real v3
  vault; MCP server via in-memory client with mocked roots (roots present / absent / two roots /
  explicit wins); CLI; desktop IPC handlers + one DOM test.

---

## 12. Acceptance criteria

**Resolution (§5.1, §2.2, §2.3)**
- [ ] An explicit project (CLI arg, MCP `project`) behaves byte-identically to today, auto-create
      included, whether or not a binding exists.
- [ ] With no explicit name, precedence is exactly D-E. A folder binding on a sub-folder beats the
      repo binding of its repository.
- [ ] No match → `PROJECT_NOT_DETECTED`. Two roots resolving to different projects →
      `PROJECT_AMBIGUOUS` listing slugs only.
- [ ] Detection never creates a project (D-H). A name-match without a binding only produces a hint
      (D-E).
- [ ] A locked vault yields `VAULT_LOCKED` for detected calls and for every binding verb.

**CLI (§2.1)**
- [ ] `which`, `link`, `unlink`, and `links` behave per §5.2, including `BINDING_CONFLICT`,
      `BINDING_NOT_FOUND`, `NO_GIT_REMOTE`, `INVALID_WORKSPACE_PATH`, `PROJECT_NOT_FOUND`.
- [ ] `link` makes exactly one lineage bump. Re-linking the same target to the same project makes
      none.
- [ ] `show` and `export` with no project resolve via detection. `search` and `import` are
      unchanged.

**MCP (§2.2, §2.5)**
- [ ] The tool count is still 5 and the prompt count is still 2. `project` is optional on
      `save_context`, `save_handoff`, `get_context`. No other schema change, and `search_context`
      semantics are unchanged.
- [ ] A detected save's response names the project and the detection kind, and **contains no path
      and no remote URL** (asserted by test). An explicit save's response text is unchanged.
- [ ] `get_context` output for a detected project equals the explicit-call output byte for byte.
- [ ] Workspace discovery follows D-C: roots used when declared, filtered cwd otherwise. Proven
      with an in-memory client that does and does not declare roots.
- [ ] `advances/PROJECT-DETECT/spike.md` records observed cwd/roots behaviour for Claude Code,
      Claude Desktop, and Cursor, and the docs reflect it.

**Desktop (§2.4)**
- [ ] A project screen lists its bindings, links a folder via the native dialog (repository or
      folder option, showing the folder's current resolution), and unlinks.
- [ ] New channels are in `CHANNELS`/`SCHEMAS`/`ChannelMap`/bridge, the closed-set test passes, and
      the no-path-in-schemas test passes unmodified.
- [ ] Every new string and error code is in `en.ts` and `es.ts`, and `catalogs.test.ts` passes.
- [ ] Everything the CLI can do with bindings (which/link/unlink/list) is possible from the desktop,
      and vice versa.

**Security (§10)**
- [ ] Remote URLs with embedded credentials are stored and displayed without them (test).
- [ ] No code path in detection spawns a process (test or lint guard).
- [ ] Nothing binding-related is written to `~/.valija-state` or the desktop preferences file.

**Contracts and docs (§7, §8)**
- [ ] Migration 004 (if D-A = 1) upgrades a real v3 vault transactionally, and
      `LATEST_SCHEMA_VERSION` is 4.
- [ ] The golden fixture is regenerated in the same commit as the vault-format §6/§7 update.
      `expected-pack.md`, `expected-export.md`, and `expected-search.json` are byte-identical, and
      the conformance test passes.
- [ ] SPEC §5–§9, `specs/context.md`, `specs/delivery.md`, `specs/desktop.md`, README, `docs/gui.md`
      (bindings section; the desktop app has no cwd), and CHANGELOG are updated in the same commit.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at the root and in `desktop/`.

---

## 13. Deliverables summary (not a plan)

| Deliverable | Nature |
|---|---|
| Target values + normalization, binding entity, resolution policy, 6 error codes | domain |
| `ResolveProject`, link/unlink/list use cases; binding repo + workspace probe ports | application |
| SQLite binding repo, fs/git-config probe, migration 004 | infra |
| `which`/`link`/`unlink`/`links`; optional project on `show`/`export` | delivery/cli |
| optional `project` on 3 tools, roots/cwd discovery, detection note, `list_projects` marker, prompt args | delivery/mcp |
| bindings section, 1 dialog + 4 bindings channels, catalogs | desktop |
| spike.md, vault-format + fixture, SPEC, specs, README, gui.md, CHANGELOG | docs, same commit |

---

## 14. Biggest risk

**Context routed to the wrong project, silently.** Today a model must name the project, so a
mistake is visible in the tool call. With detection, a call with no project lands wherever
resolution says, and an item saved to the wrong project **cannot be moved** (§4 Out). The worst
case is a wrong `get_context`: it streams one project's private context into a conversation about
another, possibly driven by a hostile repository's files. Mitigations, all in the defaults: only
user-created bindings route (no marker files, no auto name-match); detection never creates
projects; explicit names always win; every detected save says which project and how; ambiguity
fails instead of picking. *Runner-up:* **the spike invalidates the MCP assumption.** If the major
clients launch the server from a non-workspace cwd and do not offer `roots`, MCP detection works
nowhere except via `VALIJA_PROJECT`. The feature would then shrink to CLI + bindings management,
which is why D-C puts the spike first.
