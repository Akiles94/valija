Approved: Oscar 2026-10-19 — all Decisions to confirm (P-1 … P-16) at their recommended defaults; class names stay suffix-free

# PROJECT-DETECT — Valija knows which project you are in · Implementation Plan

**Spec:** `advances/PROJECT-DETECT/refined.md`. Gate R was **approved** by Oscar on 2026-10-18, and all
19 decisions D-A … D-S were settled at their recommended defaults. This plan implements those
defaults and does not reopen them. Where the spec leaves a choice to the planner (D-K `--remote`,
D-L case rule, D-P file names, §7 backup flag, and the smaller ones), this plan uses a recommended
default and lists the choice under §6 *Decisions to confirm*.

**Branch:** `feat/project-detect-PROJECT-DETECT`, following `{feature}/{ADVANCE}`. The orchestrator
reports it already exists, cut from `feat/curation-CURATION`, so the working tree includes every
CURATION change (`SetItemPinned`, `item-curation-steps.ts`, 32 desktop channels, …). The planner has
not created or switched branches. If CURATION is merged to `main` first, rebase onto `main` before
shipping.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** `.claude/hooks/guard-implementation.sh` enforces this mechanically for
> `src/**`, `desktop/**`, `package.json` and build config. The planner never writes that line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Every claim in `refined.md` §3 was re-checked against the working tree. All of them hold: no
`cwd`/git/roots code exists in `src/`; `project` is required on three MCP tools; `SaveContext`
auto-creates via `findOrCreateProject`; `ProjectRepository` has no `findById`; schema is v3;
`CHANNELS` is closed and the no-path test exists. The facts below are **not in the spec**, and each
one changes how a slice is written.

- **F1. The desktop error-copy test reads `src/` directly.** `desktop/src/shared/i18n/error-copy.test.ts`
  regex-scans `src/context/domain/errors.ts`. The six new codes and their `en.ts`/`es.ts` copy must
  land in the **same slice** (Slice 1), or the `desktop/` loop goes red until Slice 8 (CURATION F1).
- **F2. Use-case class names carry no `UseCase` suffix.** The repo uses bare names (`SaveContext`,
  `SetItemPinned`) in `*.use-case.ts` files, although `CLAUDE.md` says `XUseCase`. This plan follows
  the repo, as CURATION did: `ResolveProject` in `resolve-project.use-case.ts`.
- **F3. Use-case tests run against a real temp vault** (`makeUnlockedVault()`), and lineage bumps are
  read through `vault.deviceIdentity.lastSeen(vault.vaultId)?.generation`. §11 of the spec asks for
  "use cases with a fake probe". The plan does both: a real SQLCipher vault, and a
  `FakeWorkspaceProbe` in `src/testing/` so no use-case test touches a real `.git`.
- **F4. Only `src/delivery/mcp/server.test.ts` builds a fully typed `Container` literal.** Desktop
  tests cast with `as any`. The four new container fields break exactly that one literal, and it is
  fixed in the slice that adds them (Slice 4).
- **F5. Seven tests hard-code schema version 3:** `migrations.test.ts:17` and its
  `pendingMigrations` expectations (`:57-62`), `002-imported-type.test.ts:77,111`,
  `003-lineage.test.ts:47,59,79`, `upgrade-wal.test.ts:89`, `vault-format-conformance.test.ts:146`.
  All move to `LATEST_SCHEMA_VERSION` (or 4) in Slice 2. `diagnostics-report.test.ts` passes `3` as
  an *input*, so it is unaffected.
- **F6. Two upgrade tests roll `meta.schema_version` back over a fully migrated database**
  (`unlock-vault.upgrade-gate.test.ts:57`, `vault-commands.test.ts:43`) and then migrate again. A
  plain `CREATE TABLE project_bindings` would fail there with "table already exists". Migration 004
  therefore uses `CREATE TABLE IF NOT EXISTS`, exactly as 003 uses `INSERT OR IGNORE`.
- **F7. Fixture regeneration spreads the old manifest** (`{ ...manifest, keyHex, fileSaltHex, cipher }`
  in `vault-format-conformance.test.ts:83`). `manifest.schemaVersion` is never recomputed, so it is
  hand-edited to `4` before regenerating. `fileSaltHex` and `cipher.cipher_salt` **will** change
  (SQLCipher mints a fresh file salt), and `keyHex` will not (same passphrase and salt).
- **F8. The case-insensitive path rule already exists** in `src/vault/domain/services/vault-relocation.ts`
  (`isCaseInsensitivePlatform`: `win32 | darwin`; `isSameOrInside` with `posix`/`win32` path modules
  chosen by a `platform` parameter). D-L asks that folder matching "normalize consistently". The plan
  reuses that rule instead of inventing a second one (P-6).
- **F9. `toIpcResult` strips `DomainError.message`.** On desktop, `BINDING_CONFLICT` therefore cannot
  name the other project through the error. The inspect panel already shows what the folder resolves
  to, which covers the need (P-12).
- **F10. `ElectronFilePicker` keeps one handle map for every dialog.** A project-folder handle would
  be redeemable by `relocation:*` and `import:*`. D-N rejected reusing `dialog:chooseVaultFolder` for
  exactly this "one handle, two meanings" reason, so the plan gives project folders their own map
  (P-10).
- **F11. Six desktop test files build a typed `FilePicker` literal:** `register-handlers.test.ts`,
  `import-handlers.test.ts`, `relocation-handlers.test.ts`, `content-handlers.session-safety.test.ts`,
  `content-handlers.golden-fixture.test.ts`, `content-handlers.curation.test.ts`. Each gains two
  one-line stubs in Slice 7.
- **F12. `no-network-surface.test.ts` scans `*.test.tsx`** (it excludes only `.test.ts`). No desktop DOM
  test may contain `https://`, `http://`, `fetch(` or `setInterval`. Remote URLs in desktop DOM tests
  use the normalized form only (`github.com/oscar/valija`). Root `src/` tests are not scanned.
- **F13. `project.dom.test.tsx`'s fake bridge has no `bindings` namespace.** Once the project screen
  mounts the bindings section, every existing project DOM test would throw. Its `fakeBridge` gains a
  `bindings` stub in Slice 8.
- **F14. The `/save-context` prompt already takes an optional `project`.** Only `/load-context` changes
  its argument schema (D-Q).
- **F15. MCP SDK 1.29.0** (`node_modules/@modelcontextprotocol/sdk`): `server.server.getClientCapabilities()`
  is populated after `initialize`; `server.server.listRoots(params, { timeout })` exists and **throws**
  when the client did not declare `roots` (`assertCapabilityForMethod`, `server/index.js:163`). A test
  `Client` declares roots with `{ capabilities: { roots: { listChanged: true } } }` and answers with
  `client.setRequestHandler(ListRootsRequestSchema, …)`.
- **F16. Desktop has 32 channels in nine areas** (`specs/desktop.md:12`). This advance adds 5 channels
  and one area: 37 channels, ten areas.
- **F17. `parseProjectName` trims and lower-cases.** `valija link Valija` therefore links `valija`,
  which matches PROJECT-NAME-SLUG D-8 (strict slugs, normalized).
- **F18. Detection paths never reach the item repository.** Nothing in this advance changes
  `item-repo.ts`, `context-pack.ts` or `context-pack-markdown.ts`, so `expected-*` stay byte-identical
  by construction; the regeneration in Slice 2 proves it.

**Spec wrinkles (none blocking):**

- **W1.** §2.1 shows `valija links` with `PROJECT KIND TARGET` columns, but `valija unlink <binding-id>`
  needs the id to be discoverable. The plan adds a leading `ID` column (P-7).
- **W2.** §5.2 says `which` "never fails on nothing found", and §12 says "a locked vault yields
  `VAULT_LOCKED` for every binding verb". With `VALIJA_PROJECT` set, `which` needs no binding at all.
  The plan makes `ResolveProject` open the session **first** in every case, so a locked vault always
  returns `VAULT_LOCKED`, `which` included (§3 item 2).
- **W3.** §5.2 `unlink --dir` removes "the binding that a dir resolves through". In a sub-folder that
  can be an **ancestor's** folder binding or the repository's binding. The plan follows the spec, and
  the confirmation line always names the removed target, so nothing is removed silently.
- **W4.** The desktop ignores `VALIJA_PROJECT` (D-D), so its inspect panel never shows an `env`
  outcome. This is consistent with `docs/gui.md` "Configure anything environment-resolved", not a
  parity gap.

---

## 1. Summary

Ten slices (0–9). The order runs from the spike, through the pure domain, persistence and the
filesystem adapter, to the use cases, the three delivery surfaces, and a final gate.

0. **Spike (docs only).** Record what the SDK proves and what the three clients are *believed* to do,
   plus a 30-line probe script Oscar can run locally. The design does not depend on the answer.
1. **Domain.** Binding target values (folder, repository, id), the `ProjectBinding` entity, the pure
   resolution service, six error codes, and their desktop copy (F1).
2. **Persistence.** Migration 004 (`project_bindings`), `SqliteProjectBindingRepository`,
   `VaultSession.bindings`, schema-v4 test updates, `vault-format.md` §6/§7/§11, and the regenerated
   golden fixture, all in one commit (vault-format §14 change control).
3. **Workspace probe.** `FileWorkspaceProbe` (canonical path, enclosing git repo, its remote) and a
   pure `git-config.ts` parser. Read-only, and it never spawns a process (a guard test proves it).
4. **Use cases.** `ResolveProject`, `LinkWorkspace`, `UnlinkWorkspace`, `ListProjectBindings`, two DTOs,
   and container wiring.
5. **CLI.** `which`, `link`, `unlink`, `links`; `show`/`export` take an optional project; the shared
   `delivery/project-detection.ts`.
6. **MCP.** Workspace discovery (roots → filtered cwd), optional `project` on three tools, the
   detection suffix, the `list_projects` marker, and `/load-context [project]`. Still five tools.
7. **Desktop IPC.** `dialog:chooseProjectFolder` plus `bindings:inspect|link|unlink|list`, a separate
   project-folder handle map, schemas, handlers, preload and bridge.
8. **Desktop UI.** A *Linked folders & repositories* section on the project screen, pure link-option
   logic in `state/`, catalogs, and `docs/gui.md`.
9. **Final gate.** No file changes. A whole-diff check.

**Production lines: about 1,600 in total** (≈ 1,160 in `src/`, ≈ 440 in `desktop/src/`). Tests add
about 1,450 lines and docs about 260. One migration (004), zero new dependencies, zero new MCP tools,
zero change to pack rendering.

---

## 2. Ordered slices

**Every slice ends green on both workspaces** (exact commands in §4.3):
`npm run typecheck && npm run lint && npm run test` at the repo root, **and**
`cd desktop && npm run typecheck && npm run lint && npm run test`. Slice 1 already touches `desktop/`
(F1), and `desktop/` imports root `src/` types, so both loops run every time.

Each slice lists the docs that ship in the same commit (`CLAUDE.md`: "Docs ship in the same commit
as the code").

---

### Slice 0 — Spike: how each client tells a server where the work is (D-C)

**Rationale.** D-C makes the spike Slice 0. This plan runs in a **headless cloud container with no
Claude Code, Claude Desktop or Cursor installed**, so the spike cannot observe the clients. It
records what *can* be proven here, labels everything else as an unverified assumption, and hands
Oscar a probe he can run in two minutes per client. The design in Slices 1–8 works whichever way the
answers fall (see "Robust to either outcome" below).

**Files**

| File | Nature | Lines |
|---|---|---|
| `advances/PROJECT-DETECT/spike.md` | new | ~120 (doc) |

**Contents of `spike.md`:**

1. **Verified from SDK source (this container).** Each item quotes the file and line:
   - `Server.getClientCapabilities()` returns the client's declared capabilities after `initialize`.
   - `Server.listRoots(params, options)` sends `roots/list`. It throws `"Client does not support
     listing roots"` when `roots` was not declared (`server/index.js:163-166`).
   - `RequestOptions.timeout` bounds the wait (default 60 s), so the server can cap it.
   - A client can send `notifications/roots/list_changed` only if it declared `roots.listChanged`.
   - Over stdio the server inherits the `cwd` the client spawns it with. Nothing in the protocol
     sets or reports it.
2. **Unverified, from the planner's general knowledge — Oscar to confirm.** Each row is marked
   `ASSUMED`:

   | Client | Server `process.cwd()` | Declares `roots`? | `roots/list` returns |
   |---|---|---|---|
   | Claude Code (CLI) | the directory `claude` was started in (the project) — ASSUMED | ASSUMED yes | ASSUMED one `file://` root, the project |
   | Claude Desktop | `/` on macOS; an app dir on Windows — ASSUMED | ASSUMED no | n/a |
   | Cursor | ASSUMED the user's home or the app dir, **not** the workspace | ASSUMED yes in recent versions | ASSUMED the open workspace folder(s) |

3. **The probe Oscar runs locally.** An inline ~30-line ESM script (`/tmp/valija-roots-probe.mjs`) built
   on `@modelcontextprotocol/sdk`. It registers one tool, `probe`, that appends one JSON line to
   `/tmp/valija-roots-probe.log` with `process.cwd()`, `getClientCapabilities()`, `getClientVersion()`,
   and the result or error of `listRoots({}, { timeout: 2000 })`. It sends nothing anywhere. Steps:
   add it as a **temporary** MCP server in each client, open a project folder, ask the model to call
   `probe`, copy the log line into the table, then remove the server. The script lives only inside
   `spike.md` as a code block. It is never committed under `src/` and never published.
4. **Robust to either outcome.** What happens if each assumption is wrong:
   - **A client declares roots** → roots are used and cwd is ignored.
   - **A client declares roots but returns `[]`, errors, or times out** → fall back to the filtered
     cwd (P-2).
   - **A client spawns the server in the workspace** → the filtered cwd works with no roots.
   - **A client does neither** → detection yields `PROJECT_NOT_DETECTED`, and the model calls
     `list_projects` (today's behaviour plus a clearer message). `VALIJA_PROJECT` in a per-project
     client config (`.mcp.json`, `.cursor/mcp.json`) still works.
   - **Walkthrough §2.2/§2.3 changes, the design does not** (D-C): only `README.md`, `docs/gui.md` and
     `specs/delivery.md` cite the table, and Slice 6 writes them from `spike.md`.
5. **Recording the result.** When Oscar runs the probe, the implementer replaces each `ASSUMED`
   with `OBSERVED <date> <client version>` and adjusts the three docs in a follow-up commit on this
   branch, before `change-reviewer` runs (P-1).

**Done when:** `spike.md` exists with sections 1–5; no code changed.

---

### Slice 1 — Domain: binding values, entity, resolution service, error codes (+ desktop copy)

**Rationale.** Every rule in §5.1/§5.2 and D-E/D-K/D-L is a pure function of strings and bindings.
It is proved here with no database, no filesystem and no session, before any caller exists.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/shared/domain/services/path-containment.ts` | new: lifted from `vault-relocation.ts` (P-6) | ~35 |
| `src/vault/domain/services/vault-relocation.ts` | import the lifted helpers | −20 / +2 |
| `src/context/domain/values/binding-target.ts` | new: `BindingKind`, `FolderTarget`, `WorkspaceLocation` | ~55 |
| `src/context/domain/values/repository-target.ts` | new: `RepositoryTarget`, remote normalization | ~70 |
| `src/context/domain/values/binding-id.ts` | new | ~18 |
| `src/context/domain/entities/project-binding.ts` | new | ~28 |
| `src/context/domain/services/project-resolution.ts` | new | ~95 |
| `src/context/domain/errors.ts` | +6 codes | +7 |
| `src/shared/domain/services/path-containment.test.ts` | new | ~50 (test) |
| `src/context/domain/values/binding-target.test.ts` | new | ~60 (test) |
| `src/context/domain/values/repository-target.test.ts` | new | ~110 (test) |
| `src/context/domain/services/project-resolution.test.ts` | new | ~170 (test) |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | +6 `errors.*` keys each | +14 |

**1.1 `errors.ts`.** Append `PROJECT_NOT_DETECTED`, `PROJECT_AMBIGUOUS`, `BINDING_CONFLICT`,
`BINDING_NOT_FOUND`, `NO_GIT_REMOTE`, `INVALID_WORKSPACE_PATH` to `ContextErrorCode`.

**Invariant for every message built in this advance:** it may name project slugs, binding ids and a
binding *kind*, and **never a path, a remote, or the raw input** (a raw remote can carry a token).
Slice 6 asserts this end to end. CLI and desktop show targets from DTO fields, never from error text.

**1.2 `shared/domain/services/path-containment.ts` (P-6).** Move the private helpers out of
`vault-relocation.ts` and export them with unchanged behaviour:

```ts
export function isCaseInsensitivePlatform(platform: NodeJS.Platform): boolean
export function pathModuleFor(platform: NodeJS.Platform): typeof posix
/** True if `candidate` is `root` itself or nested inside it (case-folded on win32/darwin). */
export function isSameOrInside(root: string, candidate: string, platform: NodeJS.Platform): boolean
```

`vault-relocation.ts` imports them. Its existing tests (`relocate-vault.use-case.test.ts` and the
relocation handler tests) are the regression guard, and must pass unmodified.

**1.3 `values/binding-target.ts`**

```ts
export const BINDING_KINDS = ["folder", "repository"] as const;
export type BindingKind = (typeof BINDING_KINDS)[number];
/** A canonical absolute directory path (symlinks already resolved by the probe). */
export type FolderTarget = string & { readonly __brand: "FolderTarget" };

/** Where work is happening: a directory, and the git repository around it if there is one. */
export interface WorkspaceLocation {
  folder: FolderTarget;
  repositoryRoot: FolderTarget | null;
  repository: RepositoryTarget | null;
  /** The filesystem root or the user's home: too broad to link as a folder (P-4). */
  tooBroadToLink: boolean;
}

export function parseFolderTarget(raw: string, platform = process.platform): Result<FolderTarget, DomainError>
/** Number of path segments, used to rank folder bindings: the deepest match wins (D-E). */
export function folderDepth(folder: FolderTarget): number
```

- `BindingKind` is validated at each surface's own boundary (commander `.choices()` on the CLI,
  `z.enum` on desktop), so use cases take it already typed and there is no `parseBindingKind` and no
  seventh error code (P-13).
- `parseFolderTarget`: trims; requires an absolute path for `platform`
  (`pathModuleFor(platform).isAbsolute`); strips trailing separators except on a root; upper-cases a
  Windows drive letter. Stored paths keep the platform's own separators. An invalid value →
  `INVALID_WORKSPACE_PATH` with `That folder is not an absolute path.` (no echo of the input).
- `folderDepth` splits on `/` and `\` and counts non-empty segments.

**1.4 `values/repository-target.ts` (D-K).**

```ts
/** A normalized git remote: `host/owner/repo`. Never carries a scheme, port, userinfo, or `.git`. */
export type RepositoryTarget = string & { readonly __brand: "RepositoryTarget" };
export function parseRepositoryTarget(rawRemoteUrl: string): Result<RepositoryTarget, DomainError>
/** The last path segment (`valija`): the name-match hint candidate (D-E). */
export function repositoryName(target: RepositoryTarget): string
```

The function reads as five steps, one line each:

1. Reject an empty value or one over 2,048 characters.
2. Split into `host` + `path`:
   - **URL form** (`ssh://`, `git+ssh://`, `ssh+git://`, `git://`, `http://`, `https://`):
     `new URL(raw)`; take `hostname` and `pathname`. `username`/`password`/`port` are **never read**,
     so userinfo and port are dropped by construction.
   - **scp form** (`[user@]host:path`, no `//` after the colon, host longer than one character so
     `C:\repo` is not mistaken for one): split at the first `:`; drop everything up to `@` in the host.
   - Anything else (a local path, `file://`) → not usable (P-5).
3. Lower-case the host. Reject a host outside `[a-z0-9.-]`.
4. Normalize the path: drop a leading `/` or `~/`, collapse repeated `/`, strip a trailing `/`, then
   a trailing `.git`, then a trailing `/` again. Reject empty, `.` or `..` segments. **Path case is
   kept.**
5. Return `host/path`.

Every rejection → `NO_GIT_REMOTE` with `That remote is not a host/owner/repo address valija can
use.` The raw input is **never** echoed (it may hold a token).

**1.5 `values/binding-id.ts`.** Same shape as `item-id.ts`: `BindingId` branded, `parseBindingId(raw)`
with `^[A-Za-z0-9-]{1,64}$` after trim, and `BINDING_NOT_FOUND` (`No binding has that id.`) for a
malformed id. A malformed id cannot match a real row, so "not found" is the honest answer, and no new
code is needed.

**1.6 `entities/project-binding.ts`**

```ts
export interface ProjectBinding {
  readonly id: string;
  readonly projectId: string;
  readonly kind: BindingKind;
  readonly target: FolderTarget | RepositoryTarget;
  readonly createdAt: Date;
}
export function createProjectBinding(input: { id: string; projectId: string; kind: BindingKind; target: FolderTarget | RepositoryTarget; now: Date }): ProjectBinding
```

A total factory with no validation (inputs are already parsed), the same posture as
`createContextItem`.

**1.7 `services/project-resolution.ts`.** The pure policy. It never sees `VALIJA_PROJECT` or an
explicit name: those are ranked by the callers, in one line each (§3 item 3).

```ts
/** A binding and the slug of the project it maps to — what the repository's list returns. */
export interface BoundProject { binding: ProjectBinding; projectName: ProjectName }

export type BindingResolution =
  | { outcome: "bound"; match: BoundProject }
  | { outcome: "none" }
  | { outcome: "ambiguous"; projectNames: ProjectName[] };

/** D-E for one location: the deepest folder binding covering it, else its repository's binding. */
export function bindingFor(location: WorkspaceLocation, bindings: readonly BoundProject[], platform = process.platform): BoundProject | null

/** D-E across every workspace directory: one distinct project → bound; two or more → ambiguous. */
export function resolveFromBindings(locations: readonly WorkspaceLocation[], bindings: readonly BoundProject[], platform = process.platform): BindingResolution

/** The binding that already owns this exact target, if any (case-folded on win32/darwin for folders). */
export function bindingOnTarget(bindings: readonly BoundProject[], kind: BindingKind, target: string, platform = process.platform): BoundProject | null

/** D-K default kind: the repository when it has a usable remote, else the folder. */
export function chooseLinkTarget(location: WorkspaceLocation, by?: BindingKind): Result<{ kind: BindingKind; target: FolderTarget | RepositoryTarget }, DomainError>

/** Name-match hint candidates (D-E option 1): the repository's name and its root folder's name. */
export function hintCandidates(location: WorkspaceLocation): string[]
```

Rules, one `if` each:

- `bindingFor` filters folder bindings with `isSameOrInside(binding.target, location.folder, platform)`,
  keeps the one with the greatest `folderDepth`, and returns it. Only when there is none does it look
  for a repository binding whose target **equals** `location.repository`.
- `resolveFromBindings` maps each location through `bindingFor`, drops `null`s, and de-duplicates by
  project id. 0 → `none`; 1 → `bound` (the first match); 2 or more → `ambiguous`, slugs sorted.
  Locations that match nothing do not cause ambiguity (spec §5.1: "≥2 workspace dirs resolve to
  **different** projects").
- `bindingOnTarget`: repository targets compare exactly; folder targets compare with
  `isSameOrInside(a, b) && isSameOrInside(b, a)`, so case-folding agrees with matching.
- `chooseLinkTarget`:
  - `by === "repository"` and `location.repository === null` → `NO_GIT_REMOTE` (`This folder is not
    inside a git repository with a usable remote. Link the folder instead (--by folder).`).
  - `by === "folder"`, or no `by` and no repository → the folder, unless `location.tooBroadToLink` →
    `INVALID_WORKSPACE_PATH` (`Linking your home folder or the filesystem root would match everything.
    Pick a project folder.`) (P-4).
  - otherwise → the repository.
- `hintCandidates` returns `[repositoryName(repository), basename(repositoryRoot)]` when they exist,
  lower-cased and de-duplicated. A non-repository folder yields `[]` (the spec's hint is about
  repositories).

**1.8 Desktop error copy (F1)** — `errors.*` in both catalogs:

| code | en | es |
|---|---|---|
| `PROJECT_NOT_DETECTED` | No project is linked to this folder. | Ningún proyecto está vinculado a esta carpeta. |
| `PROJECT_AMBIGUOUS` | These folders are linked to different projects. | Estas carpetas están vinculadas a proyectos distintos. |
| `BINDING_CONFLICT` | That folder or repository is already linked to another project. Unlink it there first. | Esa carpeta o repositorio ya está vinculado a otro proyecto. Desvincúlalo allí primero. |
| `BINDING_NOT_FOUND` | That link no longer exists. | Ese vínculo ya no existe. |
| `NO_GIT_REMOTE` | That folder isn't in a git repository with a remote. Link only the folder instead. | Esa carpeta no está en un repositorio git con un remoto. Vincula solo la carpeta. |
| `INVALID_WORKSPACE_PATH` | That folder can't be linked — it's missing, unreadable, or too broad (your home folder or the disk root). | No se puede vincular esa carpeta: no existe, no se puede leer o es demasiado amplia (tu carpeta personal o la raíz del disco). |

**1.9 Tests**

- `path-containment.test.ts`: same folder; nested; sibling with a shared prefix (`/a/b` vs `/a/bc` is
  **not** inside); `darwin` and `win32` fold case, `linux` does not; `C:\A` vs `c:\a\b` on `win32`.
- `binding-target.test.ts`: absolute POSIX and Windows paths parse; relative paths and `""` are
  rejected; trailing separators stripped; `/` stays `/`; drive letter upper-cased; `folderDepth` of
  `/`, `/a/b`, `C:\a\b`; no rejection message contains its input.
- `repository-target.test.ts`, one table-driven `it.each`, every row `[input, expected | "reject"]`:
  - `git@github.com:oscar/valija.git` → `github.com/oscar/valija`
  - `https://github.com/oscar/valija.git` and `https://github.com/oscar/valija/` → same
  - `ssh://git@github.com:22/oscar/valija.git` → same (port dropped)
  - `https://oscar:ghp_SECRET@github.com/oscar/valija.git` → same, **and** a second assertion that
    `JSON.stringify(result)` contains neither `ghp_SECRET` nor `oscar:`
  - `git://GitHub.COM/Oscar/Valija` → `github.com/Oscar/Valija` (host folded, path kept)
  - `git@gitlab.com:group/sub/repo.git` → `gitlab.com/group/sub/repo`
  - `/srv/git/repo.git`, `file:///srv/repo`, `C:\repos\x`, `""`, `https://github.com/`,
    `https://github.com/../x` → reject
  - every rejection's message contains no substring of its input longer than 3 characters.
- `project-resolution.test.ts`, one `describe` per rule:
  - **precedence:** a folder binding on `/r/sub` beats the repository binding of `/r` for a location
    at `/r/sub/x`; at `/r/other` the repository binding wins; the deepest folder wins over a shallower
    one.
  - **case:** on `darwin` a binding `/Users/o/Code` covers `/users/o/code/x`; on `linux` it does not.
  - **ambiguity:** two locations → two projects → `ambiguous` with sorted slugs; two locations → the
    same project → `bound`; one bound + one unmatched → `bound`.
  - **chooseLinkTarget:** every branch, including `tooBroadToLink` and `by: "repository"` on a repo
    with no remote.
  - **hintCandidates:** repository name and root basename, lower-cased, de-duplicated; `[]` outside a
    repository.

**Docs in this commit:** `specs/context.md` §domain/errors (six codes), §domain/values
(`binding-target`, `repository-target`, `binding-id`), §domain/entities (`ProjectBinding`),
§domain/services (`project-resolution.ts`); `specs/shared.md` (new
`shared/domain/services/path-containment.ts`); `specs/vault.md` one line noting `vault-relocation.ts`
now imports it.

**Done when:** both loops are green and `error-copy.test.ts` passes with the six new codes.

---

### Slice 2 — Persistence: migration 004, binding repository, fixture regeneration

**Rationale.** vault-format §14 requires the schema change, the document and the fixture to land
**together**. This slice is the whole contract change in one reviewable diff.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/shared/infra/migrations/004-project-bindings.ts` | new | ~18 |
| `src/shared/infra/migrations.ts` | + version 4 | +2 |
| `src/context/application/ports/repositories.ts` | + `ProjectBindingRepository` | +12 |
| `src/context/application/ports/vault-session.ts` | + `bindings` | +2 |
| `src/context/infra/sqlite-project-binding-repository.ts` | new | ~60 |
| `src/context/infra/vault-sessions.ts` | wire `bindings` | +2 |
| `src/shared/infra/migrations/004-project-bindings.test.ts` | new | ~90 (test) |
| `src/context/infra/sqlite-project-binding-repository.test.ts` | new | ~90 (test) |
| `src/shared/infra/migrations.test.ts`, `002-…test.ts`, `003-…test.ts`, `upgrade-wal.test.ts` | 3 → `LATEST_SCHEMA_VERSION` (F5) | ~10 (test) |
| `src/delivery/vault-format-conformance.test.ts` | schema 4; empty-bindings assertion | +8 (test) |
| `src/testing/golden-vault.ts` | comment "currently 4" | 1 |
| `src/testing/__fixtures__/golden-vault/manifest.json`, `vault.db` (`vault.json` if it changes) | regenerated | data |
| `src/testing/__fixtures__/golden-vault/README.md` | "the bindings table is empty" | +2 |

**2.1 Migration 004** (`004-project-bindings.ts`):

```sql
CREATE TABLE IF NOT EXISTS project_bindings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('folder','repository')),
  target TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, target)
);
```

- `IF NOT EXISTS` is required by F6, not a style choice. A doc comment says so.
- `MIGRATIONS` gains `{ version: 4, sql: MIGRATION_004, backup: true }` (P-8: follow the 002/003
  pattern). `LATEST_SCHEMA_VERSION` becomes 4 by derivation; nothing else changes in the runner.
- No index beyond the `UNIQUE` one: a vault holds tens of bindings, and the list query reads them all.

**2.2 Port** (`ports/repositories.ts`):

```ts
export interface ProjectBindingRepository {
  /** Insert-only. `false` when the (kind, target) pair is already taken — the caller turns that into BINDING_CONFLICT. */
  add(binding: ProjectBinding): boolean;
  /** `false` when no row had that id. */
  remove(bindingId: string): boolean;
  /** Every binding with its project's slug, ordered by project, kind, target. */
  list(): BoundProject[];
}
```

`BoundProject` is the domain type from Slice 1, so the repository returns domain shapes, like
`ItemWithProject`. `VaultSession` gains `readonly bindings: ProjectBindingRepository`.

**2.3 Adapter** (`sqlite-project-binding-repository.ts`, class `SqliteProjectBindingRepository`):

- `add`: `INSERT INTO project_bindings (…) VALUES (…) ON CONFLICT(kind, target) DO NOTHING`, returning
  `info.changes === 1`. A concurrent insert from a second process can therefore never throw out of
  `session.write`; it surfaces as a clean `BINDING_CONFLICT` and a rollback (§3 item 5).
- `remove`: `DELETE … WHERE id = ?`, returning `changes === 1`.
- `list`: `SELECT b.*, p.name AS project_name FROM project_bindings b JOIN projects p ON p.id = b.project_id
  ORDER BY p.name, b.kind, b.target`, mapped through a `toBoundProject(row)` like `toProject`.
- All values are bound parameters.

`vault-sessions.ts` adds `bindings: new SqliteProjectBindingRepository(db)` next to `projects` and
`items`.

**2.4 Golden fixture regeneration** (exact order; the same commit as §2.5):

1. Edit `manifest.json` `"schemaVersion": 3` → `4` (F7) and the `golden-vault.ts` comment.
2. Run `VALIJA_WRITE_GOLDEN_VAULT=1 npx vitest run src/delivery/vault-format-conformance.test.ts`. It
   fails on purpose.
3. Run `git diff --exit-code -- src/testing/__fixtures__/golden-vault/expected-pack.md
   src/testing/__fixtures__/golden-vault/expected-export.md
   src/testing/__fixtures__/golden-vault/expected-search.json`. It **must exit 0**. If it does not,
   stop: something outside this advance changed rendering.
4. `git diff --stat` on the fixture shows only `vault.db`, `manifest.json` (`schemaVersion`,
   `fileSaltHex`, `cipher.cipher_salt`) and possibly `vault.json`. `keyHex` must be unchanged.
5. Update the conformance test: `expect(schemaVersion(db)).toBe(manifest.schemaVersion)`, and add
   `SELECT count(*) FROM project_bindings` → `0` ("no fake paths in published test data", §7).
6. Re-run the suite without the flag.

**2.5 `docs/vault-format.md`**

- §6 heading → **Schema v4**: "Four tables plus an FTS5 index, created by four migrations". Append the
  `project_bindings` DDL verbatim, with a comment that a reader never needs it and must ignore it.
- §6 `meta` table: `schema_version` → `"4"`.
- §7: one bullet — `project_bindings` maps folders and repositories to projects for detection. It is
  **user metadata, not content**: never part of a pack, never surfaced, and a reader must ignore it.
- §11: one note — a reader built against v3 (the MOBILE PoC, `advances/MOBILE/poc.md`) refuses a v4
  vault by this very rule. That is expected; the PoC is closed.
- §12: "the bindings table is empty in the fixture".

**2.6 Tests**

- `004-project-bindings.test.ts`, modelled on `003-lineage.test.ts`:
  - a fresh init reaches `LATEST_SCHEMA_VERSION` and the table exists, empty;
  - a populated **v3** vault (built with 001–003 and a real project and item) upgrades to v4 with
    every row and FTS hit intact;
  - the `.pre-004.bak` backup is removed on success;
  - re-running `migrate` is a no-op;
  - rolling the marker back to 3 over a v4 database and migrating again succeeds (F6);
  - `UNIQUE(kind, target)` and the `CHECK` on `kind` hold (a raw insert of `kind = 'marker'` throws).
- `sqlite-project-binding-repository.test.ts` (real SQLCipher, `makeUnlockedVault()` plus a project
  saved through `session.projects`):
  - `add` then `list` returns the binding with its project slug;
  - a second `add` on the same `(kind, target)` returns `false` and leaves one row;
  - the same target under the other kind is allowed;
  - `remove` returns `true` then `false`;
  - `list` order is project, kind, target.
- F5 updates: each hard-coded `3` becomes `LATEST_SCHEMA_VERSION`, and `pendingMigrations(0)` /
  `pendingMigrations(2)` gain `{ version: 4, backsUpCiphertext: true }`.
- `unlock-vault.upgrade-gate.test.ts` and `vault-commands.test.ts` already compare against
  `LATEST_SCHEMA_VERSION` / `> 2`, and pass unmodified (F6 is what makes that true).

**Docs in this commit:** `docs/vault-format.md` §6/§7/§11/§12 (above); fixture `README.md`;
`specs/shared.md` (migration 004, `LATEST_SCHEMA_VERSION = 4`); `specs/context.md` §application/ports
(`ProjectBindingRepository`, `VaultSession.bindings`) and §infra (`SqliteProjectBindingRepository`);
`docs/SPEC.md` §6 schema line (adds `project_bindings`).

**Done when:** both loops are green, step 2.4.3 exits 0, and the conformance test passes.

---

### Slice 3 — Workspace probe: canonical folder, enclosing repository, its remote (D-J)

**Rationale.** The probe is the only code that reads a workspace. It is read-only, bounded, and
never spawns a process. It lands alone so the reviewer can audit every filesystem call in one place.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/ports/workspace-probe.ts` | new | ~15 |
| `src/context/infra/git/git-config.ts` | new: pure parser | ~45 |
| `src/context/infra/file-workspace-probe.ts` | new: `FileWorkspaceProbe` | ~95 |
| `src/testing/fake-workspace-probe.ts` | new: `FakeWorkspaceProbe` for use-case tests | ~25 (test support) |
| `src/context/infra/git/git-config.test.ts` | new | ~60 (test) |
| `src/context/infra/file-workspace-probe.test.ts` | new | ~150 (test) |
| `src/delivery/detection-no-spawn.test.ts` | new: guard | ~35 (test) |

**3.1 Port** (`ports/workspace-probe.ts`):

```ts
/** Reads where work is happening. Read-only: never writes, never spawns a process, never touches the network. */
export interface WorkspaceProbe {
  locate(directory: string): Result<WorkspaceLocation, DomainError>;
}
```

**3.2 `infra/git/git-config.ts`** (pure, no I/O):

```ts
/** `[remote "name"] url = …` pairs from a git config file's text. `include`/`includeIf` are ignored (D-J). */
export function remoteUrls(configText: string): Map<string, string>
/** D-K: `origin`, else the only remote, else none. */
export function chooseRemote(remotes: Map<string, string>): string | null
```

- Line by line: skip blanks and `#`/`;` comments; a `[remote "x"]` header opens a remote section
  (section name case-insensitive, subsection case-sensitive, as git defines); any other header closes
  it; inside a remote section, `url = value` records the first `url` (trim; strip surrounding quotes).
- No `insteadOf`, no `include.path` (documented limitation, D-J).

**3.3 `FileWorkspaceProbe`** (constructor: `home = homedir()`, `platform = process.platform`; both
injectable for tests). `locate(directory)` reads as:

```ts
locate(directory: string): Result<WorkspaceLocation, DomainError> {
  const folder = this.canonicalDirectory(directory);       // realpathSync.native + statSync().isDirectory()
  if (!folder.ok) return folder;
  const git = this.findGitDir(folder.value);               // walk up to the root, ≤ 64 levels
  return ok({
    folder: folder.value,
    repositoryRoot: git?.workTree ?? null,
    repository: git === null ? null : this.readRemote(git.gitDir),
    tooBroadToLink: this.isTooBroad(folder.value),
  });
}
```

- `canonicalDirectory`: `realpathSync.native`, then `statSync().isDirectory()`, then
  `parseFolderTarget`. Any throw or a non-directory → `INVALID_WORKSPACE_PATH` with `That folder does
  not exist, is not a folder, or cannot be read.` (no path in the message).
- `findGitDir`: at each level, `lstatSync(join(dir, ".git"))`:
  - a **directory** → `{ workTree: dir, gitDir: dir/.git }`;
  - a **file** (worktrees, submodules) → read at most 4 KB, expect `gitdir: <path>`, resolve it
    against `dir`;
  - stop at the filesystem root or after 64 levels.
- `readRemote`: if `<gitDir>/commondir` exists (worktrees), resolve it against `gitDir`; read
  `<commonDir>/config`, capped at 256 KB (a larger file → no remote); then
  `chooseRemote(remoteUrls(text))` → `parseRepositoryTarget`. Any read or parse failure → `null`
  (repository present, remote unusable). **The raw URL is never stored, returned, or logged.**
- `isTooBroad`: the folder is a filesystem root, or `isSameOrInside(folder, home) &&
  isSameOrInside(home, folder)` (the home directory itself).
- Imports: `node:fs` (`realpathSync`, `statSync`, `lstatSync`, `readFileSync`, `existsSync`),
  `node:path`, `node:os`. Nothing else.

**3.4 `FakeWorkspaceProbe`** (`src/testing/fake-workspace-probe.ts`): a `Map<string, WorkspaceLocation>`
filled by the test, plus `failFor(directory)` to simulate `INVALID_WORKSPACE_PATH`. It records the
directories it was asked about, so tests can prove "the probe was never called" (lock-first proofs).

**3.5 Tests**

- `git-config.test.ts`: origin chosen over others; the only remote chosen; two non-origin remotes →
  `null`; comments, quoted values, `[Remote "origin"]` header case; an `[include] path = …` section is
  ignored; `[remote "a.b"]` subsections.
- `file-workspace-probe.test.ts` (temp dirs; every `.git` artefact is **written as plain files by the
  test**, so no `git` binary is needed):
  - a plain directory → `repositoryRoot: null`, `repository: null`;
  - a plain repo (`.git/config` with an origin) from its root and from a nested sub-folder → same
    `repositoryRoot`, normalized remote;
  - a remote with `https://user:TOKEN@…` → the location, serialized, contains no `TOKEN`;
  - a worktree (`.git` file → `gitdir: …/.git/worktrees/wt`, plus `commondir: ../..`) → the main
    repository's remote;
  - a submodule (`.git` file → `gitdir: ../.git/modules/sub`, config inside the modules dir) → the
    submodule's own remote;
  - a repo with no remote → `repositoryRoot` set, `repository: null`;
  - a symlinked directory → `folder` is the real path (skipped on `win32`);
  - a missing path and a regular file → `INVALID_WORKSPACE_PATH`, message contains no path;
  - `home` injected as a temp dir → `locate(home).tooBroadToLink === true`, a child → `false`;
  - a 300 KB config → `repository: null`, no throw.
- `detection-no-spawn.test.ts`: reads the source of every detection file (`binding-target.ts`,
  `repository-target.ts`, `project-resolution.ts`, `file-workspace-probe.ts`, `git/git-config.ts`, and,
  as later slices add them, the four new use cases, `delivery/project-detection.ts`,
  `delivery/mcp/workspace-directories.ts`, `desktop` excluded) and asserts none matches
  `/child_process|\bspawn\(|\bexec(File)?(Sync)?\(|\bfork\(|node:net|node:http/`. The list is a literal
  array (§10.3, AC "no process spawn").

**Docs in this commit:** `specs/context.md` §application/ports (`WorkspaceProbe`) and §infra
(`FileWorkspaceProbe`, `git/git-config.ts`, the D-J limitation: `include`/`insteadOf` not honoured).

**Done when:** both loops are green and the guard test lists every detection file that exists so far.

---

### Slice 4 — Use cases: resolve, link, unlink, list (+ container)

**Rationale.** Four small use cases, each "parse → session → probe → domain rule → write only if
changed". No use case calls another; the delivery layer composes them (D-O option 1).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/dto/project-binding-view.ts` | new: `ProjectBindingView`, `toProjectBindingView` | ~22 |
| `src/context/application/dto/project-resolution-output.ts` | new: `ProjectResolutionOutput` | ~28 |
| `src/context/application/use-cases/resolve-project.use-case.ts` | new: `ResolveProject` | ~70 |
| `src/context/application/use-cases/link-workspace.use-case.ts` | new: `LinkWorkspace` | ~75 |
| `src/context/application/use-cases/unlink-workspace.use-case.ts` | new: `UnlinkWorkspace` | ~65 |
| `src/context/application/use-cases/list-project-bindings.use-case.ts` | new: `ListProjectBindings` | ~35 |
| `src/delivery/container.ts` | + 4 use cases, `envProject`, one probe | +12 |
| `src/delivery/mcp/server.test.ts` | container literal + 4 fields (F4) | +4 (test) |
| `…/use-cases/resolve-project.use-case.test.ts` | new | ~130 (test) |
| `…/use-cases/link-workspace.use-case.test.ts` | new | ~150 (test) |
| `…/use-cases/unlink-workspace.use-case.test.ts` | new | ~100 (test) |
| `…/use-cases/list-project-bindings.use-case.test.ts` | new | ~45 (test) |
| `src/delivery/detection-no-spawn.test.ts` | + 4 files | +4 (test) |

**4.1 DTOs**

```ts
// dto/project-binding-view.ts — primitives only, like ContextItemView.
export interface ProjectBindingView { id: string; project: string; kind: BindingKind; target: string; createdAt: string }
export const toProjectBindingView = (bound: BoundProject): ProjectBindingView

// dto/project-resolution-output.ts
export type DetectionKind = BindingKind | "env";
export interface WorkspaceLocationView { folder: string; repositoryRoot: string | null; repository: string | null; tooBroadToLink: boolean }
export type ProjectResolutionOutput =
  | { outcome: "detected"; project: string; detectedBy: DetectionKind; binding?: ProjectBindingView; locations: WorkspaceLocationView[] }
  | { outcome: "none"; hint?: string; locations: WorkspaceLocationView[] }
  | { outcome: "ambiguous"; projects: string[]; locations: WorkspaceLocationView[] };
```

`locations` exist for `which` and the desktop inspect panel. **The MCP adapter never reads them**, and
a Slice 6 test asserts no MCP response contains a location string.

**4.2 `ResolveProject`** — input `{ directories: string[]; envProject?: string }`; constructor
`(sessions, probe)`:

```ts
execute(input: ResolveProjectInput): Result<ProjectResolutionOutput, DomainError> {
  const env = this.parseEnvProject(input.envProject);              // INVALID_PROJECT_NAME before any session
  if (!env.ok) return env;
  return this.sessions.withSession((session) => {                  // VAULT_LOCKED first, always (W2)
    const locations = this.locateAll(input.directories);           // INVALID_WORKSPACE_PATH
    if (!locations.ok) return locations;
    const views = locations.value.map(toLocationView);
    if (env.value !== null) return ok({ outcome: "detected", project: env.value, detectedBy: "env", locations: views });
    const resolution = resolveFromBindings(locations.value, session.bindings.list());
    return ok(this.toOutput(session, resolution, locations.value, views));
  });
}
```

- `parseEnvProject`: `undefined` or blank → `ok(null)`; otherwise `parseProjectName`, with the message
  re-worded to name the variable: `VALIJA_PROJECT is not a valid project name.`
- `env` wins over bindings (D-E), and it does **not** check that the project exists (D-D: treated as
  explicit, auto-create included).
- `toOutput` for `none` looks up each `hintCandidates(location)` with `session.projects.findByName`
  (after `parseProjectName`) and keeps the first that exists. Reads only, so no lineage bump.
- An empty `directories` with no env → `none` (the MCP "nothing to go on" case).

**4.3 `LinkWorkspace`** — input `{ project: string; directory: string; by?: BindingKind }`;
output `{ binding: ProjectBindingView; changed: boolean }`; constructor
`(sessions, probe, clock, idGen)`.

```ts
execute(input: LinkWorkspaceInput): Result<LinkWorkspaceOutput, DomainError> {
  const name = parseProjectName(input.project);
  if (!name.ok) return name;
  return this.sessions.withSession((session) => {
    const project = session.projects.findByName(name.value);
    if (project === null) return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}". Link only to an existing project.`);
    const location = this.probe.locate(input.directory);
    if (!location.ok) return location;
    const chosen = chooseLinkTarget(location.value, input.by);
    if (!chosen.ok) return chosen;
    const existing = bindingOnTarget(session.bindings.list(), chosen.value.kind, chosen.value.target);
    if (existing !== null) return this.alreadyBound(existing, project);     // no-op or BINDING_CONFLICT
    return this.addBinding(session, project, chosen.value);                // the one session.write
  });
}
```

- Rejection order matches spec §5.2: project, then path, then remote, then conflict.
- `alreadyBound`: same project → `ok({ binding, changed: false })` with **no write**; another project →
  `BINDING_CONFLICT` with ``That ${kind} is already linked to project "${other}". Unlink it first
  (valija unlink ${bindingId}).`` Slug and id only.
- `addBinding`: `session.write(() => session.bindings.add(binding) ? ok({ binding: view, changed: true }) :
  contextErr("BINDING_CONFLICT", …))`. A lost race returns an `err`, so `commitWrite` rolls back and
  does not bump.

**4.4 `UnlinkWorkspace`** — input `{ bindingId: string } | { directory: string; by?: BindingKind }`;
output `ProjectBindingView` (what was removed); constructor `(sessions, probe)`.

- By id: `parseBindingId` before the session; in the session, find it in `session.bindings.list()` →
  `BINDING_NOT_FOUND`.
- By directory: in the session, `probe.locate` → `INVALID_WORKSPACE_PATH`; then the binding it
  resolves through: `bindingFor(location, bindings)` over the bindings of kind `by` when given →
  `BINDING_NOT_FOUND` (``Nothing linked here${by ? ` by ${by}` : ""}.``).
- Then `session.write(() => session.bindings.remove(id) ? ok(view) : contextErr("BINDING_NOT_FOUND", …))`.
- Input that carries both an id and a directory is impossible at the type level (a union). The CLI
  rejects the combination before calling (§5.2).

**4.5 `ListProjectBindings`** — input `{ project?: string }`; output `ProjectBindingView[]`. A given
project is parsed before the session; a missing one → `PROJECT_NOT_FOUND`. It reads only.

**4.6 Container.** One shared `const workspaceProbe = new FileWorkspaceProbe();` and:
`resolveProject: new ResolveProject(sessions, workspaceProbe)`,
`linkWorkspace: new LinkWorkspace(sessions, workspaceProbe, systemClock, ulidIds)`,
`unlinkWorkspace: new UnlinkWorkspace(sessions, workspaceProbe)`,
`listProjectBindings: new ListProjectBindings(sessions)`, and
`envProject?: string` read once from `process.env.VALIJA_PROJECT` (the same posture as
`VALIJA_AUTOLOCK_MINUTES`). Add the four use-case fields to the `server.test.ts` literal with a
`FakeWorkspaceProbe`.

**4.7 Tests** (real temp vault, F3; a `generation()` helper per file, as in CURATION).

- `resolve-project`:
  - folder binding → `detected/folder` with its binding view; repository binding → `detected/repository`;
    a sub-folder binding beats the repository (D-E end to end);
  - `envProject: "valija"` beats both, even when `valija` does not exist yet;
  - `envProject: "Bad Name!"` → `INVALID_PROJECT_NAME` before the session (lock first: still that
    code, and the fake probe was never called);
  - nothing bound → `none`; a repo named `valija` with project `valija` existing → `hint: "valija"`;
    with no such project → no hint; **the hint path never creates a project** (`ListProjects` count
    unchanged);
  - two directories bound to two projects → `ambiguous` with both slugs;
  - locked vault → `VAULT_LOCKED`, with and without `envProject`, and the probe was never called;
  - zero lineage bumps in every case.
- `link-workspace`:
  - repository by default when a remote exists; folder by default otherwise; `by: "folder"` inside a
    repo links the folder;
  - **one** bump per real link; re-linking the same target to the same project → `changed: false`,
    **zero** bumps;
  - `PROJECT_NOT_FOUND` (and the project is still absent afterwards), `NO_GIT_REMOTE`,
    `INVALID_WORKSPACE_PATH` (probe failure and `tooBroadToLink`), `BINDING_CONFLICT` naming the
    other project's slug — each with zero bumps;
  - locked vault → `VAULT_LOCKED`, probe never called;
  - **state file stays clean:** one case builds the sessions over a real `FileDeviceIdentity` in a temp
    state root, links a folder, and asserts `state.json` contains neither the folder path nor the
    project slug (§12 Security).
- `unlink-workspace`: by id (one bump); by directory through a folder binding and through a repository
  binding; the `by` filter; unknown id and nothing-linked-here → `BINDING_NOT_FOUND`, zero bumps;
  locked → `VAULT_LOCKED`.
- `list-project-bindings`: all; one project's; unknown project → `PROJECT_NOT_FOUND`; zero bumps.

**Docs in this commit:** `specs/context.md` §application/dto and §use cases (four use cases, two
sentences each; the env-before-bindings line; "no use case calls another"); `docs/SPEC.md` §5
(`ProjectBinding` model line, `ProjectBindingRepository`/`WorkspaceProbe` ports, four use cases);
`specs/delivery.md` §container (four fields, `envProject`).

**Done when:** both loops are green and `server.test.ts` still reports exactly five tools.

---

### Slice 5 — CLI: `which`, `link`, `unlink`, `links`; optional project on `show`/`export`

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/project-detection.ts` | new: `chooseProject`, `detectionLabel`, `displayTarget` | ~65 |
| `src/delivery/cli/binding-commands.ts` | new: 4 thin commands | ~115 |
| `src/delivery/cli/program.ts` | + 4 commands; `[project]` on `show`/`export` | +45 |
| `src/delivery/cli/content-commands.ts` | `show`/`export` choose the project first | +14 / −4 |
| `src/delivery/project-detection.test.ts` | new | ~90 (test) |
| `src/delivery/cli/binding-commands.test.ts` | new | ~170 (test) |
| `src/delivery/detection-no-spawn.test.ts` | + 1 file | +1 (test) |

**5.1 `delivery/project-detection.ts`** — shared by the CLI and MCP, like `context-pack-export.ts`
(which the desktop also imports):

```ts
export interface ProjectChoice { project: string; detectedBy?: DetectionKind }

/** Explicit wins untouched; otherwise VALIJA_PROJECT, then bindings — or a PROJECT_NOT_DETECTED / PROJECT_AMBIGUOUS error carrying `remedy`. */
export function chooseProject(c: Container, explicit: string | undefined, directories: string[], remedy: string): Result<ProjectChoice, DomainError>

/** "linked folder" | "linked repository" | "VALIJA_PROJECT" — the only detection words a response ever shows. */
export function detectionLabel(kind: DetectionKind): string

/** A folder with `~` for the home directory; a repository as-is. For CLI and desktop display only. */
export function displayTarget(view: { kind: BindingKind; target: string }, home = homedir()): string
```

`chooseProject`:

1. `explicit !== undefined` → `ok({ project: explicit })`. **No session, no probe, no env read.** The
   explicit path is therefore byte-identical to today, including today's `INVALID_PROJECT_NAME` for a
   bad slug and auto-create on save.
2. `c.resolveProject.execute({ directories, envProject: c.envProject })`.
3. `detected` → `ok({ project, detectedBy })`.
4. `none` → `PROJECT_NOT_DETECTED`: `No project was given and none is linked to this workspace.` +
   (hint ? ` A project named "${hint}" matches this repository's name; link it with: valija link ${hint}.` : "")
   + ` ${remedy}`.
5. `ambiguous` → `PROJECT_AMBIGUOUS`: `This workspace's folders are linked to different projects:
   ${projects.join(", ")}. ${remedy}`.

**5.2 `cli/binding-commands.ts`** — thin adapters: call, `fail()` on error, print. They never print
item content.

```ts
export function whichCommand(c: Container, options: { dir?: string }): void
export function linkCommand(c: Container, project: string, options: { dir?: string; by?: BindingKind }): void
export function unlinkCommand(c: Container, bindingId: string | undefined, options: { dir?: string; by?: BindingKind }): void
export function linksCommand(c: Container, project: string | undefined): void
```

- The working directory is `resolve(options.dir ?? process.cwd())`, in one helper `workingDirectory()`.
- `which` prints the spec §2.1 lines exactly:
  - `valija  (linked repository github.com/oscar/valija)`
  - `valija  (linked folder ~/code/acme/services/billing)`
  - `valija  (VALIJA_PROJECT)`
  - `No project detected here.` plus, when there is a hint,
    `Hint: a project named "valija" matches this repository's name. Link it with: valija link valija`
  - Every outcome exits 0, except a real error (`VAULT_LOCKED`, `INVALID_WORKSPACE_PATH`, a bad env
    name), which goes through `fail()`.
- `link` prints `Linked repository github.com/oscar/valija → project "valija".`; a repository link adds
  `(Any clone of this repository, on any device that syncs this vault, now resolves to "valija".)`; a
  no-op prints `Already linked: repository github.com/oscar/valija → project "valija". Nothing changed.`
- `unlink` with both an id and `--dir`/`--by` → `error: give a binding id or --dir/--by, not both.`,
  exit 1, before any use case runs. Otherwise it prints `Unlinked folder ~/x from project "acme".`
- `links` prints `ID  PROJECT  KIND  TARGET` (P-7), padded like `projectsCommand`, or
  `No folders or repositories are linked yet. Link one with: valija link <project>`.
- `--by` is declared with commander `.choices(["repository", "folder"])` (P-13), so a typo fails in
  commander with its standard message.

**5.3 `program.ts`**

- `show`: `.argument("[project]", "project slug (detected from this folder when omitted)")`.
- `export`: the same. The success line `Exported ${project} (…)` uses the **resolved** name.
- New blocks in the existing style: `which` (`--dir <path>`), `link <project>` (`--dir`, `--by`),
  `unlink [binding-id]` (`--dir`, `--by`), `links [project]`. Descriptions:
  - `which`: "Show which project this folder resolves to, and why."
  - `link`: "Link this folder's git repository (or only the folder, --by folder) to an existing project."
  - `unlink`: "Remove a link, by id (see valija links) or by the folder it applies to."
  - `links`: "List folder and repository links."
- `search -p` and `import -p` are **untouched** (D-F).

**5.4 `content-commands.ts`.** `showCommand(c, project | undefined, options)` and
`exportCommand(c, project | undefined, options)` start with:

```ts
const choice = chooseProject(c, project, [process.cwd()], CLI_REMEDY);
if (!choice.ok) fail(choice.error);
```

then pass `choice.value.project` to the unchanged code. `CLI_REMEDY = "Pass a project name, or link
this folder: valija link <project>."` The CLI prints no detection note for `show`/`export`, because
their output is the vault-format contract (§8).

**5.5 Tests**

- `project-detection.test.ts` (a `Container` cast over a real vault and `FakeWorkspaceProbe`):
  - explicit `"Other"` → returned verbatim, and the probe was never called;
  - env set → `detectedBy: "env"`; bound → its kind;
  - the `none` message contains the remedy and the hint; `ambiguous` lists both slugs;
  - neither message contains the probe's folder string or the repository string (§10);
  - `displayTarget` replaces the home prefix with `~` and leaves a repository untouched.
- `binding-commands.test.ts` (built like `curation-commands.test.ts`: real vault, `console` spies,
  `process.exit` stubbed to throw; temp dirs with hand-written `.git/config`, via a real
  `FileWorkspaceProbe`):
  - `link` → `which` → `links` → `unlink` round trip, with the exact §2.1 lines;
  - re-link prints the no-op line, and the lineage generation is unchanged;
  - `--by repository` outside a repo → `error [NO_GIT_REMOTE]`; a missing `--dir` →
    `[INVALID_WORKSPACE_PATH]`; linking to an unknown project → `[PROJECT_NOT_FOUND]`; a conflict →
    `[BINDING_CONFLICT]` naming the other slug; an unknown id → `[BINDING_NOT_FOUND]`;
  - `unlink <id> --dir x` → the "not both" error, and no use case was called;
  - `showCommand(c, undefined, {})` inside a linked temp dir prints the same lines as
    `showCommand(c, "valija", {})` (A10 covers how the cwd is set);
  - `exportCommand(c, undefined, {})` stdout equals the explicit export byte for byte;
  - unlinked folder → `[PROJECT_NOT_DETECTED]`;
  - `searchCommand` with no `-p` stays vault-wide inside a linked folder (D-F regression).

**Docs in this commit:** `docs/SPEC.md` §8 (`which`, `link`, `unlink`, `links`; `show [project]`,
`export [project]`); `specs/delivery.md` §cli (four rows, optional project, `project-detection.ts`);
`README.md` §"Everyday use" — a new **"Working inside a project folder"** subsection (link once,
`which`, folder vs repository, monorepo sub-folders, `VALIJA_PROJECT`) and §"Configuration
reference" (`VALIJA_PROJECT`); `CHANGELOG.md` `Added`.

**Done when:** both loops are green, and `npm run build && node dist/program.js --help` lists the
four commands with `show [project]` and `export [project]`.

---

### Slice 6 — MCP: workspace discovery, optional `project`, detection note (still five tools)

**Rationale.** The AI-reachable surface changes in exactly one slice, so the reviewer sees all of it
in one diff, together with the privacy assertions.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/mcp/workspace-directories.ts` | new | ~60 |
| `src/delivery/mcp/server.ts` | optional `project` ×3, suffix, marker, prompts, descriptions | +50 |
| `src/delivery/mcp/workspace-directories.test.ts` | new | ~90 (test) |
| `src/delivery/mcp/server.detection.test.ts` | new: clients with/without roots | ~200 (test) |
| `src/delivery/mcp/server.test.ts` | schema `required` assertions | +20 (test) |
| `src/delivery/detection-no-spawn.test.ts` | + 1 file | +1 (test) |

**6.1 `workspace-directories.ts`**

```ts
const ROOTS_TIMEOUT_MS = 2_000;

export interface WorkspaceEnvironment { cwd(): string; home: string; platform: NodeJS.Platform; execDir: string }
export const processWorkspaceEnvironment = (): WorkspaceEnvironment => ({ cwd: () => process.cwd(), home: homedir(), platform: process.platform, execDir: dirname(process.execPath) });

/** D-C: the client's declared roots; otherwise the server's cwd, unless it is clearly not a workspace. */
export async function workspaceDirectories(server: Server, env: WorkspaceEnvironment): Promise<string[]>

/** The filesystem root, the home folder or one of its ancestors, or where node / the client is installed (P-3). */
export function isNonWorkspaceDirectory(dir: string, env: WorkspaceEnvironment): boolean
```

`workspaceDirectories` reads as:

1. `const roots = await declaredRoots(server)`. It returns `[]` when the client did not declare
   `roots` (checked via `getClientCapabilities()` first, so `listRoots` never throws), when the call
   fails or times out, or when no root is a `file:` URI. File URIs go through `fileURLToPath`, and
   only existing directories are kept (`statSync().isDirectory()` in a `try`).
2. `if (roots.length > 0) return roots;`
3. `const cwd = env.cwd(); return isNonWorkspaceDirectory(cwd, env) ? [] : [cwd];` (P-2).

`isNonWorkspaceDirectory`, one line per rule, using `isSameOrInside` from Slice 1:

- a filesystem root;
- `home` itself, or any ancestor of `home` (`/Users`, `C:\Users`);
- inside `execDir` (the node install the client launched us with), or inside `~/.npm` (the `npx` cache);
- `darwin`: inside `/Applications`, `/System`, or `/Library`; `win32`: inside `%ProgramFiles%`,
  `%ProgramFiles(x86)%`, or `%LOCALAPPDATA%\Programs`.

Roots and cwd are client-controlled, never model-controlled (§10.5). Nothing is cached (D-S).

**6.2 `server.ts`**

- `buildMcpServer(c: Container, workspace = processWorkspaceEnvironment())`. Inside it, one helper
  reads as a phrase:

```ts
const projectFor = async (explicit: string | undefined): Promise<Result<ProjectChoice, DomainError>> =>
  explicit !== undefined
    ? ok({ project: explicit })
    : chooseProject(c, undefined, await workspaceDirectories(server.server, workspace), MCP_REMEDY);
```

  `MCP_REMEDY = "Call list_projects, ask the user which project they mean, then pass it as \`project\`."`
  An explicit call never asks the client for roots.
- **`save_context` / `save_handoff`**: `project: z.string().optional().describe(…)`. The handler calls
  `projectFor(project)` and, on error, returns `err(…)`. On success it passes `choice.project` to the
  unchanged `SaveContext`. The response gains the note only when `detectedBy` is set:
  `Saved ${type} to project "${p}"${note}${created}. Item id: ${id}.…` where
  `note = ` (detected: ${detectionLabel(kind)})``. The explicit text is byte-identical to today.
- **`get_context`**: `project` optional; on success the output is exactly
  `renderContextPackMarkdown(r.value)`, with **no detection line** (D-I).
- **`search_context`**: unchanged. Omitted still means vault-wide (D-F).
- **`list_projects`**: after `ListProjects` succeeds, run `projectFor(undefined)` and ignore any error.
  The line of the detected project (env or binding) gains ` (this workspace)` (D-I, P-14). A locked
  vault still fails at `ListProjects` first, as today.
- **`/load-context`**: `argsSchema: { project: z.string().optional() }`. Without a project, the first
  line is `Call get_context without a project; valija uses the project linked to this workspace. If it
  reports PROJECT_NOT_DETECTED, call list_projects and ask me which project I mean. Then:` followed by
  the existing numbered lines. With a project, the text is unchanged.
- **`/save-context`**: with no project, step 1 becomes `If no project was given, call save_context
  without \`project\` — valija uses the project linked to this workspace and says which in its reply.
  If that fails, call list_projects and confirm with me.` With a project, the text is unchanged.
- **Descriptions.** `project` on the save tools: `"Project slug, e.g. 'vault-app'. Created if it does
  not exist. Omit it to use the project the user linked to this workspace; if none is linked the call
  fails with PROJECT_NOT_DETECTED — then call list_projects and ask."` (`get_context` drops "Created
  if…"). `DESCRIPTIONS.get_context` appends "Omit `project` to load the project linked to the user's
  workspace." `DESCRIPTIONS.list_projects` appends "The project linked to the user's workspace, if
  any, is marked (this workspace)."

**6.3 Tests**

- `workspace-directories.test.ts`: every `isNonWorkspaceDirectory` rule on `linux`, `darwin` and
  `win32` (env injected; no real home); a temp project dir → `false`. `workspaceDirectories` against a
  stub `server` object: roots declared and returned; declared but `[]` → cwd; `listRoots` rejects →
  cwd; not declared → `listRoots` never called; a non-`file:` root is dropped; a missing directory is
  dropped; cwd = home → `[]`.
- `server.detection.test.ts` — a real vault and a real `FileWorkspaceProbe` over temp dirs with
  hand-written `.git/config`; one `Client` per scenario over `InMemoryTransport`:
  1. **Roots declared** (`capabilities: { roots: {} }`, the handler returns a `pathToFileURL` root that
     is linked by repository): `save_context {content}` → text equals
     `Saved fact to project "valija" (detected: linked repository). Item id: 01SEQ…`; the item lands in
     `valija`.
  2. **Explicit wins:** the same client with `project: "other"` → today's exact text, and the item lands
     in `other` (auto-created); the roots handler was **not** called (a counter).
  3. **No roots, cwd linked** (injected `workspace.cwd`): `get_context {}` equals the explicit
     `get_context {project:"valija"}` text **byte for byte**.
  4. **No roots, cwd = injected home** → `isError`, text ends with `[PROJECT_NOT_DETECTED]` and
     contains "Call list_projects".
  5. **Two roots → two projects** → `[PROJECT_AMBIGUOUS]` naming both slugs.
  6. **`envProject` in the container** with no roots and a non-workspace cwd → `save_handoff {content}`
     says `(detected: VALIJA_PROJECT)` and auto-creates the project (D-D).
  7. **`list_projects`** marks `(this workspace)` on exactly one line.
  8. **Locked vault** (`vault.keychain.deleteKey`) → `[VAULT_LOCKED]` for a detected `get_context`.
  9. **Privacy sweep:** every response text from cases 1–8 is checked against the temp root path, the
     repository string, `"github.com"`, and `"file:"`. None may appear (AC "contains no path and no
     remote URL").
  10. `/load-context` with and without `project` renders the two texts.
- `server.test.ts`: still exactly five tools and two prompts. A new assertion records, as literal
  arrays, each tool's `inputSchema.properties` keys (unchanged sets) and `inputSchema.required`:
  `save_context: ["content"]`, `save_handoff: ["content"]`, `get_context: []`,
  `search_context: ["query"]`, `list_projects: []`.

**Docs in this commit:** `docs/SPEC.md` §7 (`project?` on three tools, a "Project detection" paragraph:
roots → filtered cwd → `VALIJA_PROJECT` → bindings, never creates, never names a path; prompts
`/load-context [project]`) and §9 (paths and remotes live only in the vault; detection never spawns
a process or touches the network); `specs/delivery.md` §mcp (detection, suffix, marker, "five tools,
unchanged count", the spike table summary); `README.md` §"The MCP surface" (detection bullet, the
`.mcp.json` / `.cursor/mcp.json` `VALIJA_PROJECT` example, and the per-client expectations from
`spike.md`); `CHANGELOG.md` `Added`.

**Done when:** both loops are green; `server.test.ts` reports five tools and two prompts; the privacy
sweep passes; `vault-format-conformance.test.ts` passes unmodified since Slice 2.

---

### Slice 7 — Desktop IPC: one dialog channel, four bindings channels

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/shared/ipc/messages.ts` | + 8 types | +40 |
| `desktop/src/shared/ipc/channels.ts` | + 5 channels + `ChannelMap` (32 → 37) | +18 |
| `desktop/src/main/ipc/schemas.ts` | + 5 schemas | +8 |
| `desktop/src/main/application/ports/file-picker.ts` | + `chooseProjectFolder`, `resolveProjectFolder` | +4 |
| `desktop/src/main/infra/electron-file-picker.ts` | + a second handle map (P-10) | +16 |
| `desktop/src/main/ipc/handlers/dialog-handlers.ts` | + 1 handler | +5 |
| `desktop/src/main/ipc/handlers/bindings-handlers.ts` | new: 4 handlers | ~75 |
| `desktop/src/main/ipc/register-handlers.ts` | spread `createBindingsHandlers` | +1 |
| `desktop/src/preload/index.ts` | + `bindings.*`, `dialog.chooseProjectFolder` | +14 |
| `desktop/src/renderer/state/bridge.ts` | + the same members | +8 |
| 6 test files with a `FilePicker` literal (F11) | + 2 stubs each | +12 (test) |
| `desktop/src/main/ipc/schemas.test.ts` | + accept/reject cases | +35 (test) |
| `desktop/src/main/ipc/handlers/bindings-handlers.test.ts` | new (real vault) | ~140 (test) |
| `desktop/src/main/ipc/handlers/content-handlers.session-safety.test.ts` | + bindings calls in the sequence | +8 (test) |

**7.1 Wire types** (`messages.ts`):

```ts
export type BindingKindMessage = "folder" | "repository";
export interface BindingsInspectRequest { handle: string }
export interface BindingsInspectResponse {
  displayName: string;
  /** What this folder resolves to now — parity with `valija which` (no VALIJA_PROJECT on desktop). */
  resolvesTo: { project: string; kind: BindingKindMessage } | null;
  isRepository: boolean;
  /** Normalized `host/owner/repo`, credentials already stripped; null when there is none. */
  remote: string | null;
  /** False for the home folder or a disk root (P-4). */
  canLinkFolder: boolean;
  hint?: string;
}
export interface BindingsLinkRequest { handle: string; projectName: string; by: BindingKindMessage }
export interface BindingsLinkResponse { changed: boolean }
export interface BindingsUnlinkRequest { bindingId: string }
export interface BindingsListRequest { projectName?: string }
export interface BindingMessage { id: string; project: string; kind: BindingKindMessage; target: string; createdAt: string }
```

`BindingMessage.target` is the `displayTarget` string (home as `~`), sent main → renderer, which has
precedent in `ContentExportResponse.path`. **No request type carries a path.**

**7.2 Channels and schemas**

| Channel | Schema | Response |
|---|---|---|
| `dialog:chooseProjectFolder` | `z.void()` | `DialogFileChoiceResponse \| null` |
| `bindings:inspect` | `{ handle: z.string().max(64) }` | `IpcResult<BindingsInspectResponse>` |
| `bindings:link` | `{ handle: z.string().max(64), projectName: z.string().max(64), by: z.enum(["folder","repository"]) }` | `IpcResult<BindingsLinkResponse>` |
| `bindings:unlink` | `{ bindingId: z.string().max(64) }` | `IpcResult<BindingMessage>` |
| `bindings:list` | `{ projectName: z.string().max(64).optional() }` | `IpcResult<BindingMessage[]>` |

Field names (`handle`, `projectName`, `by`, `bindingId`) are not in the path-like list, so the
no-path-in-schemas test passes **unmodified** (AC Desktop).

**7.3 `FilePicker` (P-10).** The port gains
`chooseProjectFolder(): { handle: string; displayName: string; path: string } | null` and
`resolveProjectFolder(handle: string): string | undefined`. `ElectronFilePicker` keeps a **second**
`Map` for project folders and mints `pf-<n>` handles into it. `resolveHandle` (relocation, import)
never sees them, and `resolveProjectFolder` never sees `fh-` handles. The dialog is
`showOpenDialogSync({ properties: ["openDirectory"] })`.

**7.4 `bindings-handlers.ts`** — `createBindingsHandlers(getContainer, filePicker)`. Each handler reads
as four lines:

```ts
"bindings:inspect": ({ handle }: BindingsInspectRequest) => {
  const directory = filePicker.resolveProjectFolder(handle);
  if (directory === undefined) return unknownFolder();      // { ok:false, error:{ code:"INVALID_WORKSPACE_PATH" } }
  return toIpcResult(getContainer().resolveProject.execute({ directories: [directory] }), toInspectResponse);
},
```

- `inspect` never passes `envProject` (D-D). `toInspectResponse` maps `detected` → `resolvesTo`,
  `locations[0]` → `isRepository` (`repositoryRoot !== null`), `remote`, `canLinkFolder`
  (`!tooBroadToLink`), and `displayName` = the folder's basename. `ambiguous` cannot happen with one
  directory and maps to `resolvesTo: null`.
- `link` → `linkWorkspace.execute({ project: projectName, directory, by })` → `{ changed }`.
- `unlink` → `unlinkWorkspace.execute({ bindingId })` → `toBindingMessage`.
- `list` → `listProjectBindings.execute({ project: projectName })` → `toBindingMessage[]`, where
  `toBindingMessage` applies `displayTarget`.
- The handlers receive no `AppPreferencesStore`, so they **cannot** write preferences (§10.1,
  structural).

**7.5 Tests**

- `schemas.test.ts`: `bindings:link` rejects a missing `by`, `by: "marker"`, and a 65-char handle; a
  `path` field is stripped from the parsed data; `bindings:unlink` rejects `{}`; `bindings:list`
  accepts `{}`; `dialog:chooseProjectFolder` accepts `undefined` only.
- `bindings-handlers.test.ts` (real vault; a fake `FilePicker` whose `resolveProjectFolder` maps
  `pf-1` → a temp repo with a hand-written `.git/config`, `pf-2` → a plain temp folder):
  - `inspect pf-1` → `isRepository: true`, `remote: "github.com/oscar/valija"`, `resolvesTo: null`;
  - `link pf-1 by repository` → `changed: true`; `inspect pf-1` → `resolvesTo: { project, kind:
    "repository" }`; `list` shows it with that target;
  - `link` again → `changed: false`;
  - `link pf-2 by repository` → `{ ok:false, error:{ code:"NO_GIT_REMOTE" } }`, with **no `message`
    key**;
  - an unknown handle and an `fh-` handle → `INVALID_WORKSPACE_PATH`;
  - `unlink` → the removed binding; `unlink` again → `BINDING_NOT_FOUND`;
  - the `.git/config` fixture uses a `user:TOKEN@` remote (allowed: this is a `.test.ts`), and no
    response contains `TOKEN`;
  - a grep assertion, as in `import-no-reimplementation.test.ts`: the handler file imports no
    repository, no `SqliteVaultSessions`, and no `node:fs`.
- `content-handlers.session-safety.test.ts`: `bindings:list` and `bindings:link` join the scripted
  sequence; no sidecar remains.
- `register-handlers.test.ts`: it compares against `CHANNELS` dynamically, so only its `FilePicker`
  stub changes, and it passes with 37.

**Docs in this commit:** `specs/desktop.md` §IPC: "32 channels across nine areas" → "37 channels across
ten areas"; a new `bindings:*` row (`inspect · link · unlink · list` — same use cases as the CLI; one
lineage bump per real link/unlink; no request carries a path); the `dialog:*` row gains
`chooseProjectFolder` with its own handle map; §"structurally guaranteed": "the **three** `dialog:*`
channels".

**Done when:** the desktop loop is green and `register-handlers.test.ts` passes with 37 channels.

---

### Slice 8 — Desktop UI: "Linked folders & repositories" on the project screen

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/renderer/state/binding-link.ts` | new: pure link-option logic | ~30 |
| `desktop/src/renderer/components/bindings-section.tsx` | new | ~135 |
| `desktop/src/renderer/screens/project.tsx` | render the section | +3 |
| `desktop/src/renderer/styles/screens.css` | + `.bindings-*` rules | +30 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + 18 `bindings.*` keys each | +40 |
| `desktop/src/renderer/state/binding-link.test.ts` | new | ~50 (test) |
| `desktop/src/renderer/screens/__dom-tests__/project-bindings.dom.test.tsx` | new | ~170 (test) |
| `desktop/src/renderer/screens/__dom-tests__/project.dom.test.tsx` | `fakeBridge.bindings` stub (F13) | +5 (test) |

**8.1 `state/binding-link.ts`** (pure view logic, in the same style as `item-actions.ts`):

```ts
export type LinkChoice = "repository" | "folder";
/** The options the inspect panel offers, default first: repository when there is a remote (D-K). */
export function linkChoicesFor(inspection: BindingsInspectResponse): LinkChoice[]
```

- `remote !== null && canLinkFolder` → `["repository", "folder"]`
- `remote !== null && !canLinkFolder` → `["repository"]`
- `remote === null && canLinkFolder` → `["folder"]`
- neither → `[]` (the panel shows the `INVALID_WORKSPACE_PATH` copy and no Link button)

**8.2 `components/bindings-section.tsx`** — props `{ bridge, project }`. All state is in React memory;
**nothing reaches `bridge.preferences`**.

- On mount and after every link/unlink: `bridge.bindings.list({ projectName: project })`.
- **List:** one row per binding: a kind label (`t("bindings.kindRepository")` /
  `t("bindings.kindFolder")`), the target, and an **Unlink** button (no confirmation, D-N).
- **Link a folder…** → `bridge.dialog.chooseProjectFolder()` → (`null` = cancelled, nothing happens) →
  `bridge.bindings.inspect({ handle })` → an inspect panel:
  - `resolvesTo` ? `t("bindings.resolvesNow", { project, kind })` : `t("bindings.resolvesNothing")`;
  - `remote` ? `t("bindings.isRepository", { remote })` : `isRepository` ?
    `t("bindings.repositoryNoRemote")` : `t("bindings.notRepository")`;
  - `hint` (when present and different from this project) → `t("bindings.hint", { project: hint })`;
  - one radio per `linkChoicesFor(inspection)`, the first checked;
  - **Link** → `bridge.bindings.link({ handle, projectName: project, by })`; on `changed: false`,
    `t("bindings.alreadyLinked")`; **Cancel** closes the panel.
- Errors render `errorCopy(code)` in a `<p className="error">`, like the item actions.
- `project.tsx` renders `<BindingsSection bridge={bridge} project={project} />` after the toolbar.
  That is the only change to the screen, so it stays at about 270 lines.

**8.3 Catalog keys** (`bindings.*`, both languages):

| key | en | es |
|---|---|---|
| `sectionTitle` | Linked folders & repositories | Carpetas y repositorios vinculados |
| `sectionHint` | When you work in a linked folder, the CLI and your AI tools use this project without being told. | Cuando trabajas en una carpeta vinculada, la CLI y tus herramientas de IA usan este proyecto sin que se lo indiques. |
| `empty` | Nothing is linked to this project yet. | Todavía no hay nada vinculado a este proyecto. |
| `linkFolder` | Link a folder… | Vincular una carpeta… |
| `unlink` | Unlink | Desvincular |
| `kindFolder` | Folder | Carpeta |
| `kindRepository` | Repository | Repositorio |
| `resolvesNow` | Right now this folder belongs to {project} (linked {kind}). | Ahora mismo esta carpeta pertenece a {project} (vínculo por {kind}). |
| `resolvesNothing` | Right now this folder isn't linked to any project. | Ahora mismo esta carpeta no está vinculada a ningún proyecto. |
| `isRepository` | Git repository: {remote} | Repositorio git: {remote} |
| `repositoryNoRemote` | Git repository without a remote — only the folder can be linked. | Repositorio git sin remoto: solo se puede vincular la carpeta. |
| `notRepository` | Not a git repository. | No es un repositorio git. |
| `linkRepository` | Link this repository (any clone, on any device) | Vincular este repositorio (cualquier clon, en cualquier dispositivo) |
| `linkFolderOnly` | Link only this folder | Vincular solo esta carpeta |
| `link` | Link | Vincular |
| `cancel` | Cancel | Cancelar |
| `alreadyLinked` | Already linked to this project. Nothing changed. | Ya está vinculado a este proyecto. No se cambió nada. |
| `hint` | A project named {project} matches this repository's name. | Un proyecto llamado {project} coincide con el nombre de este repositorio. |

**8.4 CSS** (`screens.css`, a new `/* bindings-section.tsx */` block, existing tokens only, no `url(`):
`.bindings-section` (top margin, border-top), `.bindings-list` (no bullets), `.bindings-row` (flex,
gap 12px), `.bindings-kind` (muted, `0.78rem`), `.bindings-target` (monospace, ellipsis on overflow),
`.bindings-inspect` (bordered panel).

**8.5 Tests**

- `binding-link.test.ts`: the four rows of 8.1.
- `project-bindings.dom.test.tsx` (`fakeBridge` with `vi.fn` bindings and dialog; **no `https://`
  anywhere**, F12):
  1. the list renders one row per binding with kind label, target and Unlink;
  2. Unlink calls `bindings.unlink({ bindingId })` and then `bindings.list` again;
  3. **Link a folder…** → `chooseProjectFolder` → `inspect({ handle: "pf-1" })` → the panel shows the
     remote, "isn't linked to any project", and "Link this repository" checked by default;
  4. choosing "Link only this folder" and clicking Link sends `{ handle:"pf-1", projectName, by:"folder" }`;
  5. a `resolvesTo` inspection renders `resolvesNow`;
  6. a dialog returning `null` calls neither `inspect` nor `link`;
  7. an error `{ code: "BINDING_CONFLICT" }` renders the English catalog copy;
  8. **not persisted:** `preferences.write` was never called;
  9. Spanish: `language: "es"` shows `Vincular una carpeta…`.
- `project.dom.test.tsx`: its `fakeBridge` gains
  `bindings: { list: vi.fn().mockResolvedValue({ ok: true, value: [] }), … }`; every existing case
  passes otherwise unchanged.

**Docs in this commit:** `docs/gui.md` — a new **"Linking folders and repositories"** section after
"Browsing, searching, and taking a pack" (what a link does, repository vs folder, the inspect panel,
Unlink, and **"the desktop app never detects a project itself: it has no working directory; it
manages the links your terminal and AI tools use"**); "What this app deliberately does not do" gains
that same bullet, and its "Configure anything environment-resolved" bullet names `VALIJA_PROJECT`;
`specs/desktop.md` §Renderer view state (`binding-link.ts`) and §Screens (the bindings section);
`CHANGELOG.md` `Added` (desktop).

**Done when:** both loops are green; `no-network-surface.test.ts`, `catalogs.test.ts` and
`error-copy.test.ts` pass; a manual run (`cd desktop && npm run dev`) links a real git clone and a
plain folder, shows the inspect panel, and unlinks, in light **and** dark themes.

---

### Slice 9 — Final gate (no file changes)

1. Run both full loops (§4.3).
2. `git diff --exit-code feat/curation-CURATION...HEAD -- src/testing/__fixtures__/golden-vault/expected-pack.md
   src/testing/__fixtures__/golden-vault/expected-export.md
   src/testing/__fixtures__/golden-vault/expected-search.json src/delivery/context-pack-markdown.ts
   src/context/domain/services/context-pack.ts src/context/infra/item-repo.ts` must be **empty** (§8).
3. `grep -n "version: 4" src/shared/infra/migrations.ts` shows the one new entry, with `backup: true`.
4. `npx vitest run src/delivery/detection-no-spawn.test.ts` passes, and its file list matches every
   detection file in §9.
5. `grep -rnE "console\.(log|error)" src/context` returns nothing (§10.1: no logs in the module).
6. `grep -rn "VALIJA_PROJECT" desktop/src --include=*.ts --include=*.tsx` returns only catalog copy
   (D-D: the desktop never reads it).
7. `grep -rn "valija-state\|state\.json" src/context src/delivery/project-detection.ts
   src/delivery/cli/binding-commands.ts` returns nothing (§10.1).
8. The tool list is five and the prompt list two (`server.test.ts`).
9. `spike.md` rows are either `OBSERVED` or explicitly `ASSUMED` with Oscar's go-ahead (P-1).
10. Walk spec §12 line by line against §4.2 below, then hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

1. **Explicit short-circuits everything.** `chooseProject` returns an explicit name before touching
   the container, the client's roots, the filesystem or the environment. An explicit call is
   byte-identical to today (§2.5, AC "explicit … byte-identically").
2. **Parse, then unlock, then probe.** Every new use case parses its raw input (project slug,
   `VALIJA_PROJECT`, binding id) **before** `withSession`, and probes the filesystem only **inside** the
   session. A locked vault returns `VAULT_LOCKED` before any directory is read, for every binding
   verb and every detected call, `which` included (W2). Tests prove this with "lock first; the fake
   probe was never called".
3. **Precedence is fixed in code order:** explicit (delivery, step 1) → `VALIJA_PROJECT` (use case,
   before reading bindings) → deepest folder binding → repository binding → none (pure domain). No
   heuristic routes a call: the name-match only produces a hint string (D-E), and computing it is a
   read.
4. **Detection never creates.** `ResolveProject` and `LinkWorkspace` only *read* projects. Only
   `SaveContext`, called with an explicit name or `VALIJA_PROJECT`, can create one (D-H). A test
   counts projects after every detection path.
5. **One write per real change, zero otherwise.** `LinkWorkspace` checks project → path → remote →
   existing binding **before** `session.write`. Inside the write, `add` uses `ON CONFLICT DO NOTHING`
   and a `false` return becomes an `err`, so `commitWrite`'s sentinel rolls back the insert *and* the
   lineage bump. `UnlinkWorkspace` does the same with `remove`. A no-op never opens a write.
6. **Credentials die at the parser.** The probe hands the raw remote URL straight to
   `parseRepositoryTarget`, which never reads `username`/`password` and never echoes its input. The
   raw string is not stored, returned, logged, or put in an error. Tests assert a token never appears
   in a location, a DTO, a database row, a CLI line, an IPC response, or an MCP response.
7. **No path or remote leaves the machine.** MCP handlers read only `project` and `detectedBy` from the
   resolution, never `locations` or `binding`. Error messages built in this advance carry slugs, ids
   and kinds only. Slice 6's privacy sweep asserts it against every scenario's response text.
8. **No process, no network, no repo-controlled behaviour.** The probe uses `node:fs`/`node:path`/`node:os`
   only; it never runs `git`, never follows `include.path`, caps file reads (4 KB `.git` file, 256 KB
   config), and stops its upward walk at 64 levels. The guard test fails the build if a detection file
   ever imports `child_process` or a network module.
9. **The trust anchor stays a user act.** Bindings are created only by `valija link` or the desktop
   Link button. Roots and cwd are supplied by the client process, never by the model. Marker files are
   not read at all (D-B).
10. **Migration first, then the code that needs it.** Slice 2 ships migration 004 and the repository
    together. Migration 004 is transactional with a ciphertext backup taken first and removed only
    after commit, and the desktop upgrade-confirm screen names it through `pendingMigrations`.
11. **The IPC stays closed.** The five channels are added to `CHANNELS`, `ChannelMap`, `SCHEMAS`, the
    handler map, the hand-written preload and `ValijaBridge` together, in Slice 7. No request schema
    accepts a path; folders arrive only as `pf-` handles from the main-process dialog, redeemable only
    by `resolveProjectFolder`. `toIpcResult` strips messages.
12. **Nothing binding-related outside the vault.** No binding, path, remote or detected project is
    written to `~/.valija-state` (test in Slice 4), the desktop preferences file (structural in Slice
    7, DOM assertion in Slice 8), or any log.

---

## 4. Test plan

### 4.1 By layer

| Layer | Files | Proves |
|---|---|---|
| Shared domain | `path-containment.test.ts` | one case rule for relocation and detection (darwin/win32 fold, linux exact) |
| Domain values | `binding-target.test.ts`, `repository-target.test.ts` | path grammar; remote normalization table; credentials stripped; no input echoed |
| Domain service | `project-resolution.test.ts` | every D-E precedence row, deepest prefix, ambiguity, link-target choice, hint candidates |
| Migration (real SQLCipher) | `004-project-bindings.test.ts` + F5 updates | v3 → v4 transactional, data and FTS intact, backup removed, idempotent, F6 re-run |
| Repository (real SQLCipher) | `sqlite-project-binding-repository.test.ts` | insert-only with conflict = `false`, remove, ordered list with slugs |
| Infra probe (temp dirs) | `git-config.test.ts`, `file-workspace-probe.test.ts` | plain repo, worktree, submodule, no remote, symlink, missing path, too-broad, size caps, token never surfaced |
| Guard | `detection-no-spawn.test.ts` | no process spawn or network import in any detection file |
| Use cases (real vault + fake probe) | `resolve-project`, `link-workspace`, `unlink-workspace`, `list-project-bindings` `.use-case.test.ts` | one bump per change, zero per rejection/no-op, lock-first, never creates, state file clean |
| Delivery shared | `project-detection.test.ts` | explicit untouched, env, error messages carry remedy/hint and no path |
| CLI | `binding-commands.test.ts` | exact §2.1 lines, exit codes, `show`/`export` detected = explicit, `search` unchanged |
| MCP (real client, in-memory) | `workspace-directories.test.ts`, `server.detection.test.ts`, `server.test.ts` | roots/cwd rules, detected save note, byte-identical pack, ambiguity, env, marker, privacy sweep, 5 tools / exact schemas |
| Desktop IPC | `schemas.test.ts`, `bindings-handlers.test.ts`, `session-safety`, `register-handlers.test.ts` | 37 channels, validation, code-only errors, handle separation, no sidecars |
| Desktop view logic | `binding-link.test.ts` | default option and availability |
| Desktop DOM | `project-bindings.dom.test.tsx`, `project.dom.test.tsx` | list, unlink, link flow, inspect copy, errors, not persisted, bilingual |
| Contracts | `vault-format-conformance.test.ts`, `error-copy.test.ts`, `catalogs.test.ts`, `no-network-surface.test.ts` | v4 fixture, byte-identical expectations, copy completeness |

### 4.2 Acceptance criteria (spec §12) → where each is checked

| §12 criterion | Checked by |
|---|---|
| Explicit project behaves byte-identically, auto-create included | `project-detection.test.ts` (probe never called) + `server.detection.test.ts` case 2 + existing `server.test.ts` texts unchanged |
| Precedence exactly D-E; sub-folder folder binding beats repo | `project-resolution.test.ts` + `resolve-project` test + `server.detection` case 6 (env) |
| No match → `PROJECT_NOT_DETECTED`; two roots → `PROJECT_AMBIGUOUS`, slugs only | `server.detection` cases 4–5 + privacy sweep |
| Detection never creates; name-match only hints | `resolve-project` test (project count) + `binding-commands.test.ts` hint line |
| Locked vault → `VAULT_LOCKED` for detected calls and every binding verb | four use-case tests + `server.detection` case 8 |
| `which`/`link`/`unlink`/`links` per §5.2 with all codes | `binding-commands.test.ts` + use-case tests |
| `link` one bump; same re-link none | `link-workspace` test (generation) + CLI test |
| `show`/`export` resolve; `search`/`import` unchanged | `binding-commands.test.ts` (byte-equal output; vault-wide search); `program.ts` diff review for `import` |
| 5 tools, 2 prompts; `project` optional on 3; no other schema change; search semantics unchanged | `server.test.ts` literal key/`required` arrays + `binding-commands`/`server.detection` search checks |
| Detected save names project + kind, no path/remote; explicit text unchanged | `server.detection` cases 1, 2, 6, 9 |
| Detected `get_context` = explicit byte for byte | `server.detection` case 3 |
| Discovery follows D-C, with and without roots | `workspace-directories.test.ts` + `server.detection` cases 1, 3, 4 |
| `spike.md` records cwd/roots for 3 clients; docs reflect it | Slice 0 + Slice 9 step 9 (P-1) |
| Desktop lists, links via dialog (repo/folder, current resolution), unlinks | `project-bindings.dom.test.tsx` 1–6 + `bindings-handlers.test.ts` |
| Channels in CHANNELS/SCHEMAS/ChannelMap/bridge; closed-set and no-path tests pass unmodified | `register-handlers.test.ts`, `schemas.test.ts` (no-path block untouched), typecheck `satisfies Record<Channel, …>` |
| New strings/codes in `en.ts` + `es.ts` | `error-copy.test.ts`, `catalogs.test.ts`, `Catalog` typecheck |
| CLI ↔ desktop parity for which/link/unlink/list | the parity table below + the two test suites |
| Credentials stripped in storage and display | `repository-target`, `file-workspace-probe`, `bindings-handlers` tests |
| No detection path spawns a process | `detection-no-spawn.test.ts` |
| Nothing written to `~/.valija-state` or desktop prefs | `link-workspace` state-file case + DOM case 8 + handlers take no prefs store |
| Migration 004 upgrades a real v3 vault transactionally; `LATEST_SCHEMA_VERSION` = 4 | `004-project-bindings.test.ts` + `migrations.test.ts` |
| Fixture regenerated with vault-format §6/§7; expected-* byte-identical; conformance passes | Slice 2 §2.4 step 3 + Slice 9 step 2 + conformance test |
| SPEC §5–§9, specs, README, gui.md, CHANGELOG updated | per-slice "Docs in this commit" + review |
| Loops green root + desktop | §4.3, every slice |

**CLI ↔ desktop parity** (`CLAUDE.md` "Surface parity"):

| Capability | CLI | Desktop |
|---|---|---|
| What does this folder resolve to? | `valija which [--dir]` | Link a folder… → inspect panel ("Right now this folder belongs to …") |
| Link by repository / by folder | `valija link <p> [--by repository\|folder]` | inspect panel radios + Link |
| List links | `valija links [project]` | the project screen's section (per project) |
| Unlink | `valija unlink <id>` or `--dir [--by]` | Unlink on a row (by id) |
| Detection when a project is omitted | `show`, `export` | none by design (no cwd, D-N) — documented in `gui.md` |

### 4.3 Verification loop

```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
# Slice 2 only, regeneration (fails on purpose), then the byte-identity check:
cd /home/user/valija && VALIJA_WRITE_GOLDEN_VAULT=1 npx vitest run src/delivery/vault-format-conformance.test.ts
cd /home/user/valija && git diff --exit-code -- src/testing/__fixtures__/golden-vault/expected-pack.md src/testing/__fixtures__/golden-vault/expected-export.md src/testing/__fixtures__/golden-vault/expected-search.json
# end of Slices 7–8:
cd /home/user/valija/desktop && npx vitest run src/main/infra/no-network-surface.test.ts src/shared/i18n src/main/ipc
```

The root `typecheck`/`test` do not cover `desktop/`, so both loops run every time.

---

## 5. Assumptions (each one a place the plan could be wrong)

- **A1. Client behaviour (spike).** The Slice 0 table is unverified in this container. The design
  tolerates every combination (Slice 0 §4), but README/gui.md wording depends on it (P-1).
- **A2. Roots are requested before the vault is checked.** For a detected MCP call the server asks the
  client for roots (≤ 2 s) before `ResolveProject` opens the session. That exchange reads no file and
  reveals nothing, so a locked vault still returns `VAULT_LOCKED` "before any detection runs" in the
  spec's sense (filesystem detection). If Oscar reads it more strictly, the fix is a cheap
  `vaultStatus` pre-check in `projectFor`.
- **A3. `realpathSync.native` canonicalizes symlinks on every platform**, and on macOS returns a
  consistent case for the same folder. If it does not, the darwin/win32 case-fold in matching still
  makes `~/Code/x` and `~/code/x` agree; only the UNIQUE index could hold two case variants of one
  folder, and `bindingOnTarget` (case-folded) prevents creating the second.
- **A4. Default macOS volumes are case-insensitive.** On a case-sensitive APFS volume, two folders
  differing only in case would match each other's bindings. This is rare, and it is the same rule
  `vault-relocation.ts` already accepts.
- **A5. A cloned repository cannot ship its own `.git/config`.** `git clone` writes it. A downloaded
  archive that *contains* a `.git` folder could claim any `origin`, including one the user has bound,
  and so load that project's context. That requires the user to have bound that exact remote; it is
  noted as a residual risk (§8 R2), not engineered away.
- **A6. Two seconds is enough for `roots/list`** on stdio. If a client is slower, the call falls back to
  the filtered cwd rather than failing.
- **A7. `foreign_keys = ON`** is set by `openVaultDb` (the WAL upgrade test sets it the same way), so a
  binding can never reference a missing project. `list()` uses an inner join, so even a hand-edited
  orphan is invisible rather than an error. The spec's "defensive `PROJECT_NOT_FOUND`" therefore has
  no reachable path, and the plan does not add one.
- **A8. Docs per slice satisfy "same commit"** (CURATION A6). The `--no-ff` merge groups them.
- **A9. No other `VaultSession` implementation exists** besides `SqliteVaultSessions` and one cast in
  `vault-sessions.test.ts`, so adding `bindings` breaks nothing else (searched).
- **A10. CLI tests can run with a temp working directory.** vitest's default `forks` pool allows
  `process.chdir` inside a `try/finally`. If the project's pool turns out to be `threads` (where
  `chdir` throws), `showCommand`/`exportCommand` gain an optional `cwd = process.cwd()` parameter and
  the tests pass it instead. The implementer checks this on the first Slice 5 test run.

---

## 6. Decisions to confirm

All D-A … D-S stand as settled. These are the planning-level calls the spec left open. Each lists the
recommended option first.

**P-1. How the spike closes.**
- **(a) Recommended:** proceed with Slices 1–8 on the documented assumptions; Oscar runs the 2-minute
  probe in each client before `change-reviewer`, and the implementer turns `ASSUMED` into `OBSERVED`
  and adjusts the three docs.
- (b) Block Slice 6 until Oscar has run the probe.
- (c) Ship with `ASSUMED` rows and confirm later.
*Trade-off:* (a) keeps momentum, and the design does not depend on the answer; (b) is strictest but
idles the branch; (c) risks README text that is wrong for one client.

**P-2. Roots declared but empty, failing, or timing out.**
- **(a) Recommended:** fall back to the filtered cwd.
- (b) Treat as "no workspace" (no fallback).
*Trade-off:* (a) is robust to clients that declare roots before a folder is open; (b) is purer to the
roots model but makes detection fail in exactly those clients.

**P-3. The cwd "non-workspace" filter (D-C).**
- **(a) Recommended:** filesystem root; home and its ancestors; node's install dir and `~/.npm`;
  `/Applications`, `/System`, `/Library` on macOS; Program Files and `%LOCALAPPDATA%\Programs` on Windows.
- (b) Minimal: filesystem root and home only.
*Trade-off:* (a) covers where clients are believed to launch servers; (b) is shorter, and since a match
still needs a user binding, the filter is only defence in depth either way.

**P-4. Refuse folder links on the home folder and the filesystem root.**
- **(a) Recommended:** refuse with `INVALID_WORKSPACE_PATH` (CLI and desktop).
- (b) Allow; the confirmation line names the folder.
*Trade-off:* (a) prevents a link that would capture every folder under home; (b) honours the user act
literally but recreates the "binding on `~`" problem D-C warns about.

**P-5. Local-path and `file://` remotes.**
- **(a) Recommended:** not usable → no repository binding (`NO_GIT_REMOTE`; a folder link still works).
- (b) Normalize them to `local/<path>`.
*Trade-off:* (a) keeps repository targets portable and path-free; (b) supports mirror setups but stores
a machine path under a "repository" label.

**P-6. One case-insensitive path rule for the whole repo.**
- **(a) Recommended:** lift `isSameOrInside`/`isCaseInsensitivePlatform`/`pathModuleFor` from
  `vault-relocation.ts` into `src/shared/domain/services/path-containment.ts` and import it from both
  modules.
- (b) Duplicate a small copy in `context/domain`.
*Trade-off:* (a) guarantees relocation and detection agree (D-L "consistently") at the cost of touching
the vault module (its tests guard it); (b) leaves the vault untouched, but two rules can drift.

**P-7. `valija links` prints an `ID` column.**
- **(a) Recommended:** `ID  PROJECT  KIND  TARGET`.
- (b) The spec's three columns, with ids only via `--ids`.
*Trade-off:* (a) makes `unlink <binding-id>` usable without another flag; (b) matches the walkthrough
exactly but leaves the id undiscoverable by default.

**P-8. Migration 004 backup.**
- **(a) Recommended:** `backup: true`, like 002/003.
- (b) No backup: the migration is purely additive.
*Trade-off:* (a) costs one file copy on upgrade and keeps the pattern uniform; (b) is faster, but the
desktop confirm screen would then say "no backup" for one migration and not the others.

**P-9. Names.**
- **(a) Recommended:** entity `ProjectBinding`, table `project_bindings`; use cases `ResolveProject`,
  `LinkWorkspace`, `UnlinkWorkspace`, `ListProjectBindings`; port `WorkspaceProbe` /
  `FileWorkspaceProbe`; `BindingKind`, `FolderTarget`, `RepositoryTarget`, `WorkspaceLocation`.
- (b) `LinkProject` / `UnlinkProject` / `ListLinks`, entity `ProjectLink`.
*Trade-off:* (a) uses the spec's ubiquitous term "binding" in the model and the user's verb "link" in
the commands; (b) uses "link" everywhere, which is friendlier but diverges from the spec's vocabulary.

**P-10. A separate handle map for project folders.**
- **(a) Recommended:** `chooseProjectFolder` mints `pf-` handles into their own map, redeemable only by
  `resolveProjectFolder`.
- (b) Share `resolveHandle` with import and relocation.
*Trade-off:* (a) closes the "one handle, two meanings" gap D-N named, at the cost of two stubs in six
test fakes; (b) is fewer lines but lets a project-folder handle reach the relocation wizard.

**P-11. `--remote <name>` on `valija link`.**
- **(a) Recommended:** not added (origin, else the only remote, else none).
- (b) Add it.
*Trade-off:* (a) keeps the surface small, and the desktop would need a matching picker for parity;
(b) helps forks with an `upstream` remote, but doubles the parity work.

**P-12. Desktop `BINDING_CONFLICT` copy.**
- **(a) Recommended:** generic copy ("already linked to another project"); the inspect panel already
  says which project the folder resolves to.
- (b) Extend the link response with the conflicting project's slug.
*Trade-off:* (a) keeps `toIpcResult` code-only (D-V(d)); (b) is more precise but adds an exception to
the "errors carry only a code" rule.

**P-13. Where `--by` is validated.**
- **(a) Recommended:** at each surface's boundary — commander `.choices()` on the CLI, `z.enum` on
  desktop. Use cases take a typed `BindingKind`; no domain parser, no new code.
- (b) Accept any string down to the domain and add `parseBindingKind` with a seventh code
  (`INVALID_BINDING_KIND`).
*Trade-off:* (a) reuses each surface's standard validation and stays within the spec's six codes; (b)
gives one error format everywhere but adds a code the spec did not list.

**P-14. `list_projects` marks an env-selected project too.**
- **(a) Recommended:** yes, `(this workspace)` for both a binding and `VALIJA_PROJECT`.
- (b) Only for bindings.
*Trade-off:* (a) tells the model what an omitted `project` would do; (b) is narrower, but then the
marker and the save behaviour can disagree.

**P-15. Resolution service placement.**
- **(a) Recommended:** `context/domain/services/project-resolution.ts`, next to `item-curation.ts` and
  `context-pack.ts` (pure functions over domain types).
- (b) A new `context/domain/policies/` subfolder.
*Trade-off:* (a) follows the module's existing kind for stateless rules; (b) matches the spec's word
"policy", but `policies/` in this repo holds a stateful class (`SessionGuard`).

**P-16. Value tests in their own files.**
- **(a) Recommended:** `binding-target.test.ts` and `repository-target.test.ts` beside their subjects.
- (b) Append to the shared `values.test.ts`.
*Trade-off:* (a) keeps the normalization table readable; (b) follows the CURATION precedent of one
values test file.

---

## 7. Naming, placement, and ubiquitous language

**Placement** (`CLAUDE.md` "no bare files at a layer's root"):

| New file | Folder kind | Precedent |
|---|---|---|
| `shared/domain/services/path-containment.ts` | **new `services/` subfolder** in `shared/domain` (pure rules shared by two modules) | `context/domain/services/`, `vault/domain/services/` |
| `context/domain/values/{binding-target,repository-target,binding-id}.ts` | `values/` | `project-name.ts`, `item-id.ts` |
| `context/domain/entities/project-binding.ts` | `entities/` | `project.ts` |
| `context/domain/services/project-resolution.ts` | `services/` | `item-curation.ts` |
| `context/application/ports/workspace-probe.ts` | `ports/` | `vault-session.ts` |
| `context/application/dto/{project-binding-view,project-resolution-output}.ts` | `dto/` | `context-item-view.ts` |
| `context/application/use-cases/{resolve-project,link-workspace,unlink-workspace,list-project-bindings}.use-case.ts` | `use-cases/` | every use case |
| `context/infra/sqlite-project-binding-repository.ts` | tech-named adapter at `infra/` root | `vault/infra/sqlite-lineage-store.ts` |
| `context/infra/file-workspace-probe.ts` | tech-named adapter at `infra/` root | `vault/infra/file-device-identity.ts` |
| `context/infra/git/git-config.ts` | **new `git/` subfolder** (a format parser, not an adapter) | `importers/infra/parsers/` |
| `shared/infra/migrations/004-project-bindings.ts` | `migrations/` | `003-lineage.ts` |
| `delivery/project-detection.ts` | delivery root (delivery is not a DDD module) | `context-pack-export.ts` |
| `delivery/mcp/workspace-directories.ts` | `mcp/` | `server.ts` |
| `delivery/cli/binding-commands.ts` | `cli/` | `curation-commands.ts` |
| `testing/fake-workspace-probe.ts` | test support | `test-vault.ts` |
| `desktop/src/main/ipc/handlers/bindings-handlers.ts` | `handlers/` | `content-handlers.ts` |
| `desktop/src/renderer/state/binding-link.ts` | renderer `state/` (pure view logic) | `item-actions.ts` |
| `desktop/src/renderer/components/bindings-section.tsx` | `components/` (a screen-specific part) | `item-edit-dialog.tsx` |

Existing deviations, left alone: `context/infra/item-repo.ts` and `project-repo.ts` sit at the
`infra/` root under non-tech file names (CURATION F9). The new repository uses the tech-named form
(`sqlite-project-binding-repository.ts`), matching `vault/infra/sqlite-lineage-store.ts`. Renaming the
two old files belongs in a cleanup advance.

**Names**

| Name | Verdict |
|---|---|
| `ResolveProject` / `LinkWorkspace` / `UnlinkWorkspace` / `ListProjectBindings` | Bare class names per the repo (F2). Each reads as the actor's intent (P-9) |
| `ProjectBinding`, `BoundProject`, `project_bindings` | "Binding" is the spec's model term; `BoundProject` mirrors `ItemWithProject` |
| `BindingKind` = `folder \| repository`; `FolderTarget`; `RepositoryTarget` | The spec's two kinds and "target", verbatim |
| `WorkspaceLocation`, `WorkspaceProbe.locate` | "Workspace" is the spec's word for where work happens; `locate` reads as a phrase (`probe.locate(dir)`) |
| `parseFolderTarget` / `parseRepositoryTarget` / `parseBindingId` | `parseX → Result` |
| `createProjectBinding` | total `createX` factory |
| `bindingFor` / `resolveFromBindings` / `bindingOnTarget` / `chooseLinkTarget` / `hintCandidates` | each says what it returns; call sites read `bindingFor(location, bindings)` |
| `chooseProject` / `ProjectChoice` / `detectionLabel` / `displayTarget` | delivery vocabulary: a surface *chooses* a project; distinct from the domain's *resolve* |
| `DetectionKind` = `folder \| repository \| env` | the "kind" D-I says a response may show |
| `whichCommand` / `linkCommand` / `unlinkCommand` / `linksCommand` | match `pinCommand`, `showCommand` |
| `bindings:inspect|link|unlink|list`, `dialog:chooseProjectFolder` | `area:verb`; `Bindings…Request/Response` like their neighbours |
| `linkChoicesFor`, `BindingsSection` | renderer vocabulary mirroring the domain |
| catalog `bindings.*` | namespaced by feature, like `project.*`, `import.*` |

**Ubiquitous language.** The model says *binding*, *target*, *folder*, *repository*, *workspace*,
*resolve*, *detect*. The user-facing verbs are *link*, *unlink*, *which*, and the copy never says
"bind". Copy never says "auto", "guess" or "remember": detection only follows links the user made.
"Workspace" never appears in desktop copy (the desktop has none); it says "folder".

---

## 8. Estimated line count and risks

### Production lines

| Area | Lines |
|---|---|
| `src/shared/domain` (path-containment; relocation import) | ~35 net |
| `src/context/domain` (3 values, entity, resolution, errors) | ~275 |
| `src/context/application` (2 ports, 2 dto, 4 use cases) | ~330 |
| `src/context/infra` + `src/shared/infra` (repo, probe, git-config, migration 004, wiring) | ~225 |
| `src/delivery` (project-detection, workspace-directories, binding-commands, program, content-commands, server, container) | ~360 |
| `desktop/src/main` + `shared/ipc` + `preload` + `bridge` | ~190 |
| `desktop/src/renderer` (binding-link, bindings-section, project, css) | ~200 |
| `desktop/src/shared/i18n/catalogs` (en + es: 12 error lines + 36 bindings lines) | ~54 |
| **Total production** | **~1,600 (range 1,550–1,700)** |

Tests come to about 1,450 lines (plus ~25 lines of test support). Docs come to about 260 lines across
`spike.md`, `vault-format.md`, SPEC, `specs/` ×5 (context, shared, vault, delivery, desktop), README,
`gui.md`, the fixture README, and CHANGELOG.

### Risks

1. **R1. Context routed to the wrong project, silently** (spec §14). Mitigated by the defaults and
   asserted by tests: user-made bindings only, explicit wins, ambiguity fails, detection never creates,
   every detected save names the project and how.
2. **R2. A planted `.git` folder** (A5) claiming a bound remote. It needs a hostile archive *and* a
   prior binding of that exact remote by the user. Documented in README's security note; not
   engineered away (doing so would mean ignoring repository bindings entirely).
3. **R3. The spike contradicts the assumptions** (A1). Only docs move; if neither roots nor cwd work in
   a client, MCP detection there reduces to `VALIJA_PROJECT`, which is the spec's own runner-up risk.
4. **R4. Fixture drift.** If step 2.4.3 shows a diff in `expected-*`, something outside this advance
   changed rendering. Stop and investigate; never commit a changed expectation here.
5. **R5. Test fallout from shared types.** The `Container` literal (F4), six `FilePicker` fakes (F11),
   the project DOM fake bridge (F13), and seven schema-3 assertions (F5) all break predictably. Each is
   named in the slice that causes it.
6. **R6. Cross-platform path edge cases** (Windows UNC paths, macOS `/private/var` vs `/var`). The
   probe canonicalizes both sides with `realpath`, and `path-containment` is tested per platform, but
   only Linux runs in CI here. A manual check on macOS is part of Slice 8's done-when.
7. **R7. Size.** About 1,600 production lines across ten slices, roughly twice CURATION. The slices are
   independently green, so review can proceed slice by slice.
8. **R8. Second-device behaviour.** An older valija on another device ignores the new table (spec fact
   8), so detection simply does not exist there; the closed MOBILE PoC reader refuses a v4 vault by
   design (Slice 2 §2.5).

---

## 9. Repo structure after execution

Legend: `+` new · `~` changed · unmarked = unchanged context.

```
valija/
├── advances/PROJECT-DETECT/
│   ├── refined.md                                        (unchanged — Gate R approved)
│   ├── plan.md                                           + THIS FILE
│   └── spike.md                                          + Slice 0: SDK facts, client table, probe script
├── CHANGELOG.md                                          ~ Added: CLI linking, MCP detection, desktop section; Changed: schema v4
├── README.md                                             ~ "Working inside a project folder"; MCP surface; VALIJA_PROJECT
├── docs/
│   ├── SPEC.md                                           ~ §5 model/ports/use cases · §6 schema v4 · §7 optional project, detection · §8 CLI · §9 paths stay local
│   ├── gui.md                                            ~ "Linking folders and repositories"; "does not do" bullets
│   └── vault-format.md                                   ~ §6 Schema v4 + project_bindings · §7 ignore it · §11 MOBILE note · §12
├── specs/
│   ├── context.md                                        ~ errors, values, entity, services, ports, dto, use cases, infra
│   ├── shared.md                                         ~ path-containment; migration 004, LATEST_SCHEMA_VERSION = 4
│   ├── vault.md                                          ~ vault-relocation imports path-containment
│   ├── delivery.md                                       ~ container, project-detection, cli rows, mcp detection
│   └── desktop.md                                        ~ 37 channels / ten areas, bindings:*, dialog, binding-link, section
├── src/
│   ├── shared/
│   │   ├── domain/
│   │   │   ├── result.ts                                 (unchanged)
│   │   │   └── services/                                 + NEW SUBFOLDER
│   │   │       ├── path-containment.ts                   + isSameOrInside, isCaseInsensitivePlatform, pathModuleFor
│   │   │       └── path-containment.test.ts              +
│   │   └── infra/
│   │       ├── migrations.ts                             ~ + version 4 (backup)
│   │       ├── migrations.test.ts                        ~ LATEST_SCHEMA_VERSION; pendingMigrations + v4
│   │       ├── upgrade-wal.test.ts                       ~ schema assertion → latest
│   │       └── migrations/
│   │           ├── 002-imported-type.test.ts             ~ schema assertion → latest
│   │           ├── 003-lineage.test.ts                   ~ schema assertion → latest
│   │           ├── 004-project-bindings.ts               + CREATE TABLE IF NOT EXISTS project_bindings
│   │           └── 004-project-bindings.test.ts          +
│   ├── vault/domain/services/vault-relocation.ts         ~ imports shared path-containment (behaviour unchanged)
│   ├── context/
│   │   ├── domain/
│   │   │   ├── errors.ts                                 ~ +6 codes
│   │   │   ├── values/
│   │   │   │   ├── binding-target.ts                     + BindingKind, FolderTarget, WorkspaceLocation, parseFolderTarget, folderDepth
│   │   │   │   ├── binding-target.test.ts                +
│   │   │   │   ├── repository-target.ts                  + RepositoryTarget, parseRepositoryTarget, repositoryName
│   │   │   │   ├── repository-target.test.ts             +
│   │   │   │   └── binding-id.ts                         + BindingId, parseBindingId
│   │   │   ├── entities/
│   │   │   │   └── project-binding.ts                    + ProjectBinding, createProjectBinding
│   │   │   └── services/
│   │   │       ├── context-pack.ts                       (unchanged — pack algorithm untouched)
│   │   │       ├── project-resolution.ts                 + bindingFor, resolveFromBindings, bindingOnTarget, chooseLinkTarget, hintCandidates
│   │   │       └── project-resolution.test.ts            +
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── repositories.ts                       ~ + ProjectBindingRepository
│   │   │   │   ├── vault-session.ts                      ~ + bindings
│   │   │   │   └── workspace-probe.ts                    + WorkspaceProbe
│   │   │   ├── dto/
│   │   │   │   ├── project-binding-view.ts               + ProjectBindingView, toProjectBindingView
│   │   │   │   └── project-resolution-output.ts          + ProjectResolutionOutput, DetectionKind, WorkspaceLocationView
│   │   │   └── use-cases/
│   │   │       ├── resolve-project.use-case.ts           + ResolveProject
│   │   │       ├── resolve-project.use-case.test.ts      +
│   │   │       ├── link-workspace.use-case.ts            + LinkWorkspace
│   │   │       ├── link-workspace.use-case.test.ts       +
│   │   │       ├── unlink-workspace.use-case.ts          + UnlinkWorkspace
│   │   │       ├── unlink-workspace.use-case.test.ts     +
│   │   │       ├── list-project-bindings.use-case.ts     + ListProjectBindings
│   │   │       ├── list-project-bindings.use-case.test.ts +
│   │   │       └── save-context.use-case.ts              (unchanged — auto-create still explicit-only)
│   │   └── infra/
│   │       ├── item-repo.ts                              (unchanged)
│   │       ├── vault-sessions.ts                         ~ + bindings repository
│   │       ├── sqlite-project-binding-repository.ts      + SqliteProjectBindingRepository
│   │       ├── sqlite-project-binding-repository.test.ts +
│   │       ├── file-workspace-probe.ts                   + FileWorkspaceProbe (read-only, no spawn)
│   │       ├── file-workspace-probe.test.ts              +
│   │       └── git/                                      + NEW SUBFOLDER
│   │           ├── git-config.ts                         + remoteUrls, chooseRemote
│   │           └── git-config.test.ts                    +
│   ├── delivery/
│   │   ├── container.ts                                  ~ + resolveProject, linkWorkspace, unlinkWorkspace, listProjectBindings, envProject
│   │   ├── project-detection.ts                          + chooseProject, detectionLabel, displayTarget
│   │   ├── project-detection.test.ts                     +
│   │   ├── detection-no-spawn.test.ts                    + guard over every detection file
│   │   ├── vault-format-conformance.test.ts              ~ schema 4; bindings table empty
│   │   ├── context-pack-markdown.ts                      (unchanged)
│   │   ├── cli/
│   │   │   ├── program.ts                                ~ + which/link/unlink/links; show [project], export [project]
│   │   │   ├── content-commands.ts                       ~ show/export choose the project first
│   │   │   ├── binding-commands.ts                       + whichCommand, linkCommand, unlinkCommand, linksCommand
│   │   │   └── binding-commands.test.ts                  +
│   │   └── mcp/
│   │       ├── server.ts                                 ~ project optional ×3, detection note, marker, /load-context [project]
│   │       ├── server.test.ts                            ~ container fields; exact properties + required arrays
│   │       ├── server.detection.test.ts                  + roots / no roots / two roots / env / locked / privacy sweep
│   │       ├── workspace-directories.ts                  + workspaceDirectories, isNonWorkspaceDirectory
│   │       └── workspace-directories.test.ts             +
│   └── testing/
│       ├── fake-workspace-probe.ts                       + FakeWorkspaceProbe
│       ├── golden-vault.ts                               ~ comment: schema 4
│       └── __fixtures__/golden-vault/
│           ├── manifest.json                             ~ schemaVersion 4; fileSaltHex, cipher_salt regenerated
│           ├── vault.db                                  ~ regenerated (empty project_bindings)
│           ├── README.md                                 ~ bindings table empty
│           └── expected-pack.md / expected-export.md / expected-search.json   (byte-identical)
└── desktop/src/
    ├── shared/
    │   ├── ipc/
    │   │   ├── messages.ts                               ~ + Bindings{Inspect,Link,Unlink,List}…, BindingMessage, BindingKindMessage
    │   │   └── channels.ts                               ~ + dialog:chooseProjectFolder, bindings:inspect|link|unlink|list (32 → 37)
    │   └── i18n/catalogs/
    │       ├── en.ts                                     ~ + 6 errors.*, + 18 bindings.*
    │       └── es.ts                                     ~ + 6 errors.*, + 18 bindings.*
    ├── main/
    │   ├── application/ports/file-picker.ts              ~ + chooseProjectFolder, resolveProjectFolder
    │   ├── infra/electron-file-picker.ts                 ~ + project-folder handle map (pf-)
    │   └── ipc/
    │       ├── schemas.ts                                ~ + 5 schemas (no path fields)
    │       ├── schemas.test.ts                           ~ + bindings cases (no-path block unmodified)
    │       ├── register-handlers.ts                      ~ + createBindingsHandlers
    │       ├── register-handlers.test.ts                 ~ FilePicker stub +2 lines
    │       └── handlers/
    │           ├── dialog-handlers.ts                    ~ + dialog:chooseProjectFolder
    │           ├── bindings-handlers.ts                  + 4 handlers over the container use cases
    │           ├── bindings-handlers.test.ts             +
    │           ├── content-handlers.session-safety.test.ts ~ + bindings calls; FilePicker stubs
    │           ├── content-handlers.golden-fixture.test.ts ~ FilePicker stubs
    │           ├── content-handlers.curation.test.ts     ~ FilePicker stubs
    │           ├── import-handlers.test.ts               ~ FilePicker stubs
    │           └── relocation-handlers.test.ts           ~ FilePicker stubs
    ├── preload/index.ts                                  ~ + bindings.*, dialog.chooseProjectFolder
    └── renderer/
        ├── state/
        │   ├── bridge.ts                                 ~ + bindings namespace, dialog.chooseProjectFolder
        │   ├── binding-link.ts                           + linkChoicesFor
        │   └── binding-link.test.ts                      +
        ├── components/
        │   └── bindings-section.tsx                      + list, Unlink, Link a folder…, inspect panel
        ├── screens/
        │   ├── project.tsx                               ~ renders <BindingsSection />
        │   └── __dom-tests__/
        │       ├── project.dom.test.tsx                  ~ fakeBridge.bindings stub
        │       └── project-bindings.dom.test.tsx         +
        └── styles/screens.css                            ~ + .bindings-* rules
```

**Net: 49 new files (25 production code files, `spike.md`, 22 test files, 1 test-support file), about
45 changed files (including 13 doc files and the regenerated fixture), 2 new subfolders
(`src/shared/domain/services/`, `src/context/infra/git/`), 1 migration (004, schema v4),
0 new dependencies, 0 new MCP tools (still five tools and two prompts).**
