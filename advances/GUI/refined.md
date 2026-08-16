# GUI — desktop application to administer and curate valija context · Refined Spec

**Status:** Gate-R draft. **Nothing below is approved.** Every `D-n` in §7 is genuinely open and
carries a recommended default with its reason; the defaults are the refiner's opinion, not Oscar's
choice.
**Directory:** `GUI`. **No milestone number is proposed** (see D-O) — `docs/SPEC.md` §2 lists
"GUI, encrypted backup / restore → later" with no number, and that stays true until Gate R says
otherwise.
**Supersedes:** `advances/GUI/idea.md`. That file framed a *read-only* browser of the vault and
assumed the platform choice would be inherited from a mobile app. Both premises are gone (§2).
**Inherits from:** `docs/SPEC.md` (§2 scope, §9 security model, §10 module layout),
`docs/vault-format.md` (the format contract, read-only by its own §1), `docs/sync.md`,
`advances/M3/` (lineage, device identity, idle auto-lock), `advances/MOBILE/poc.md` (Kotlin
Multiplatform prior art, and the cost record of a second implementation).
**Legend:** each decision lists the options on the table and a **Default:** line with its reason.
No `Decided:` lines exist yet — that is what Gate R is for.

---

## 1. Goal

**Give a user a desktop application on macOS, Windows and Linux that lets them *administer* the
context valija stores — curate and refine what is already in the vault, and author reusable AI
artifacts ("skills", "agents", and similar) — so that one curated setup can be applied
consistently across every AI provider and surface valija reaches.**

The distinction from today's product is the load-bearing part. Today's CLI and MCP server are
**consumption** surfaces: they save an item, read a pack, search, export. They cannot edit an item,
cannot unpin one, cannot delete one, cannot rename a project, and have no concept of a skill or an
agent at all. This advance is about the **management** half of the product, and a GUI is the
vehicle Oscar has asked for, not the feature itself.

Two framing facts a planner must not skip past:

1. **The vault has almost no write surface today, and none of it is curation.** Verified against
   `src/`: the only write use cases are `SaveContext` (append one item) and `ImportItems` (append a
   batch). There is no update, no delete, no unarchive, no retag, no move-between-projects, no
   project rename. `ContextItemRepository.archive(itemId)` exists in the port
   (`src/context/application/ports/repositories.ts:28`) and in SQLite
   (`src/context/infra/item-repo.ts:121`) and is unit-tested — **and is called by no use case, no
   CLI command and no MCP tool.** `SaveContext` accepts `pinned` but **no shipped surface ever
   passes `true`**, so a pinned item cannot currently be created by any user action; `valija show`
   renders a 📌 for a state the product cannot reach. "Refine the context" therefore means building
   a curation write path that does not exist, before any pixel is drawn.
2. **"Skills" and "agents" are entirely new domain territory.** A search of `src/` for
   `skill|agent|Skill|Agent` returns **zero matches**. The domain model is `Project` +
   `ContextItem` over six storable types (`decision`, `progress`, `preference`, `fact`, `handoff`,
   `imported`) and nothing else. `docs/vault-format.md` documents that schema as a contract with
   change control (§14), and explicitly scopes itself to *reading*: "Writing is out of scope for
   this document." Anything stored for skills/agents is a schema change, a migration, a fixture
   regeneration, and a contract edit — not a UI feature.

---

## 2. What changed since `idea.md`, and what is therefore re-opened

`advances/GUI/idea.md` is a raw capture, not a spec, and two of its three load-bearing assumptions
no longer hold.

| `idea.md` said | Status now |
|---|---|
| "Read-only first… no new write path" | **Superseded by Oscar's framing.** The ask is explicitly to *refine/curate* and to *create* artifacts. This is a writing surface. Every consequence of that — lineage, device identity, concurrency, migration authority — is now in scope to decide. |
| "Rides on M4's platform/framework choice (KMP); comparatively cheap to inherit" | **Void.** `advances/MOBILE/` closed with Oscar deciding not to pursue a distributable mobile app (Apple Developer Program cost, unmonetized project). There is no mobile app to share a core with, so there is no free inheritance. Platform/framework is a **fully open decision** (D-F). |
| "Just another reader of the documented format — no separate spec needed for the vault side" | **False under the new framing.** `docs/vault-format.md` documents reads only; §11's read-only contract forbids exactly the things a writer must do (journal pragmas, migrations, lineage bumps). A writing second implementation would need a *new* contract section. This is the strongest argument for D-C's default. |
| "Non-technical-user equivalent of the CLI's read path" | **Still an open product question** (D-N). Curation and artifact authoring are power-user activities; a non-technical audience and an editing surface pull in different directions. |
| "Runs against the local vault directly via `VALIJA_HOME`; session mirrors the OS-keychain unlock/lock" | **Still the right starting assumption**, but the keychain detail is sharper than it looks (D-H) and no longer free. |

What the MOBILE advance leaves behind that is still real: a Kotlin/Compose Multiplatform
implementation of the vault-read + pack-render path, byte-identical to the TypeScript one on the
JVM, with the SQLite3MultipleCiphers amalgamation and Argon2id compiling and executing through both
JNI and Kotlin/Native cinterop (`advances/MOBILE/poc.md` §2). That is available prior art for D-F —
but note what it cost: five real defects found in `docs/vault-format.md`, a long CI fix chain, and
**no write path was ever built or verified.**

### What is *not* re-opened

These are inputs, not agenda. A planner may not trade them away for GUI convenience.

| Source | Constraint carried forward |
|---|---|
| `docs/SPEC.md` §1, §9 | Local-first, end-to-end encrypted, **no cloud, no accounts, no telemetry, no network calls at runtime.** A GUI with an update-checker, a crash reporter, or an analytics beacon is not this product. |
| D4, D5, D6 | SQLCipher via `better-sqlite3-multiple-ciphers`; Argon2id with the header's parameters; session key in the OS keychain between `unlock` and `lock`. No new KDF, no reduced parameters, no key cached anywhere else. |
| D11 | One vault per machine at `VALIJA_HOME` (default `~/.valija`). Multi-vault remains `docs/SPEC.md` §12 open question 4. |
| `docs/SPEC.md` §7 | The MCP surface is 5 tools + 2 prompts over stdio, and the standing instruction is "resist adding more." Any MCP change is a decision (D-K), never a side effect. |
| M3 / `docs/sync.md` | Single self-consistent `vault.db` at rest after every command; lineage stamp committed with every write; forks are **reported, never auto-merged**; device state lives in `VALIJA_STATE_HOME` and never syncs; the supported multi-device model is strictly **sequential**. |
| `docs/vault-format.md` §14 | The format doc and the golden-vault fixture change **together, in the same commit**. A schema change is a migration + a fixture regeneration + a contract edit. |
| `CLAUDE.md` Conventions | Module-first bounded contexts with `domain/application/infra`, ports in `application/`, `parseX`/`createX`/`xxxErr`, tech-named adapters, no bare files at a layer root. |

---

## 3. What this advance is actually answering

The raw idea fuses at least three separable products. Naming them separately is the single most
useful thing this spec does, because D-A asks whether they ship together.

| # | Capability | State today | Weight |
|---|---|---|---|
| **C1** | **A desktop shell** — browse projects, read items, search, view a rendered pack, copy/export, see vault status | Fully supported by existing read use cases (`ListProjects`, `ShowProject`, `SearchContext`, `GetContextPack`). A shell over them adds **no domain code**. | Small domain cost, all cost is platform/packaging |
| **C2** | **Curation** — edit an item's content/tags, pin/unpin, archive/unarchive, delete, move between projects, rename a project, edit its description | **Does not exist in any layer.** Needs new use cases, new port methods, new errors, new tests; mostly *not* a schema change (the `pinned`/`archived` columns already exist), but `delete` and `unarchive` are genuinely new behaviour with FTS-trigger and lineage consequences | Medium — real domain work, no UI required to build or test it |
| **C3** | **Artifacts (skills / agents / rules)** — author them in valija, store them, and materialize them into each provider's own convention so the setup is the same everywhere | **Zero domain territory exists.** New entity, new table, new migration, new fixture, new contract section, new provider-mapping layer, and a **new plaintext-egress path** writing files outside the vault | Largest — and the only part that touches the security model |

Secondary questions this advance must answer regardless of which of C1–C3 ships:

| # | Question | Why it is not obvious |
|---|---|---|
| Q1 | Is the GUI the **same device** as the CLI, for M3's lineage model? | If it mints its own id under `VALIJA_STATE_HOME`, GUI-write-then-CLI-write on one machine can classify as a **fork** — a false alarm in the one place the product promises never to auto-resolve |
| Q2 | What happens when the GUI, the MCP server and the CLI touch one `vault.db` at once? | Every current entry point opens → works → closes inside one command. A GUI naturally wants a long-lived connection. Rollback-journal SQLite serializes writers, so a held connection turns a normal MCP save into `SQLITE_BUSY` |
| Q3 | Does the GUI **defeat idle auto-lock**? | `SessionGuard` is lazy: it checks last-activity at session open, and every session records activity. A GUI that polls the vault to refresh a list resets the idle clock forever, silently disabling M3's D-I |
| Q4 | May the GUI run **migrations**? | `SqliteVaultSessions.open()` calls `migrate()` on every session. `docs/vault-format.md` §11 forbids migration for a *second implementation*, permanently. Whether the GUI is "desktop valija" or "a second implementation" decides this, and D-F decides that |
| Q5 | Can a non-Node GUI read the **keychain** entry? | Service `"valija"`, account = `vaultId` (`src/vault/infra/keyring.ts`). On macOS, keychain ACLs are bound to the *signed application*; a second, differently-signed (or unsigned) binary triggers an allow-access prompt and can lose the ACL on every rebuild |
| Q6 | How is the app **distributed**, and does it need code signing? | Unsigned macOS apps hit Gatekeeper; Windows SmartScreen flags unsigned installers. Apple's Developer Program is the **exact cost Oscar just declined for mobile**. This is a known, budgeted-at-zero constraint, not a detail |

---

## 4. User walkthrough

Written for the recommended defaults (D-A Option 3 — two advances, this one being the shell +
curation; D-C core-first; D-E Option 2 — materialize on explicit request). **If Gate R moves D-A,
D-D or D-E, this section is the first thing that changes.** Where a step depends on C3 (artifacts),
it is marked and shown separately, because C3 may not ship in this advance at all.

### 4.1 Getting in — the first two minutes

| # | Step | What the user does | What they see |
|---|---|---|---|
| 0 | Prerequisite | Has valija installed and a vault at `VALIJA_HOME` (`valija init` already run). The GUI **does not create vaults** (D-M) | If no vault exists: a single screen saying "No vault found at `~/.valija`. Run `valija init` in a terminal first", with the exact command to copy |
| 1 | Launch | Opens **valija** from the Dock / Start menu / app launcher | A window with the vault path in the title bar and a lock state: **Locked** |
| 2 | Unlock | Types the same passphrase used on desktop, or pastes the 64-hex recovery key | ~1 s Argon2id derivation (parameters read from `vault.json`, never assumed), then **Unlocked**. The key goes to the **same OS keychain entry** the CLI uses — `valija status` in a terminal now also reports unlocked |
| 3 | Orient | — | Left: the project list with item counts and last activity (same data as `valija projects`). Right: the selected project's items, newest first (same as `valija show`). A search box (same FTS as `valija search`) |
| 4 | Idle | Walks away past `VALIJA_AUTOLOCK_MINUTES` (default 15) | The window returns to **Locked** on the next action — the GUI honours M3's idle auto-lock rather than holding the vault open (D-H) |

### 4.2 Curating — the part that does not exist today (C2)

| # | Step | What the user does | What they see | Underlying write |
|---|---|---|---|---|
| 5 | Fix a stale decision | Selects an item, clicks **Edit**, rewrites the markdown, saves | The item updates in place; its `updatedAt` advances, `createdAt` does **not** — so pack ordering is unchanged | New `EditItem` use case |
| 6 | Promote what matters | Clicks the pin icon on two items | They move to the top under **Pinned**; the preview pane shows the pack recomposed with them first | New `SetItemPinned` use case — **the first shipped surface that can ever create a pinned item** |
| 7 | Retire noise | Selects three items, clicks **Archive** | They leave the list and the pack; a filter toggle "Show archived" brings them back, with an **Unarchive** action | Wires the existing unused `archive()`; adds `unarchive` |
| 8 | Delete for real | Clicks **Delete** on an item, confirms a typed confirmation | Gone. A one-line explanation that this is permanent and not covered by the recovery kit | New `DeleteItem` use case — the first destructive path in the product (D-B) |
| 9 | Tidy a project | Renames `vault-app` → `valija-core`, edits its description | Every item follows; the name is re-parsed as a `ProjectName`, so an invalid rename is refused with the same error the CLI would give | New `RenameProject` / `EditProject` |
| 10 | See the effect | Clicks **Preview pack** with the budget slider at 4000 | The exact markdown `valija export` produces — the same renderer, not a lookalike | Existing `GetContextPack` |
| 11 | Confirm from outside | Opens a terminal: `valija export valija-core` | Byte-identical to what the GUI previewed | — |

### 4.3 Authoring artifacts — **C3, conditional on D-D and D-E**

Shown so the shape is arguable at Gate R, not because it is settled. Under the recommended
defaults this is a **second advance**, not this one.

| # | Step | What the user does | What they see |
|---|---|---|---|
| 12 | Create | Clicks **New artifact**, picks kind **skill**, names it `release-checklist`, writes the body, optionally attaches it to a project | An editor with the body and a small metadata panel. Stored **inside the encrypted vault**, like every other content |
| 13 | Target | Ticks which surfaces it applies to: Claude Code, Cursor, Claude Desktop | A per-target preview showing exactly what file would be written, where, and in whose format |
| 14 | Materialize | Clicks **Apply to selected tools** | A diff-style confirmation, then: files written, with a **plaintext warning** stated once and plainly |
| 15 | Verify drift | Reopens the artifact later | A status per target: **in sync** / **modified outside valija** / **missing** — valija reports, it never silently overwrites a file a user edited by hand |

```
# what step 14 would write (illustrative — exact paths are D-E's to decide, and
# these are third-party conventions valija does not own)
~/.claude/skills/release-checklist/SKILL.md        # plaintext, outside the vault
~/.cursor/rules/release-checklist.mdc              # plaintext, outside the vault
```

**The security fact this step introduces, stated plainly:** valija's claim is that everything *at
rest in the vault* is ciphertext. Materialization writes vault-derived content to **plaintext files
outside the vault**, on purpose, because that is the only way a provider that has no MCP surface
can use it. Today the only comparable egress paths are `valija export` (a file the user explicitly
names) and an MCP tool response (in memory, to a client). A recurring, valija-managed set of
plaintext files on disk is **new**, and `docs/SPEC.md` §9 does not currently describe it. If D-E
lands anywhere except "no file writing", §9 gains a line.

### 4.4 How the data is used afterward — which surfaces expose it, and which deliberately do not

| Surface | What it sees after this advance |
|---|---|
| `valija` CLI (`projects`, `show`, `search`, `export`) | **Everything C2 does.** Edits, pins, archives and deletes are ordinary rows in the same vault — the CLI sees the curated result with no code change. Pinned items finally appear because something can now create them |
| MCP `get_context` / `get_context` packs in Claude, Cursor, Claude Desktop | **The curated pack, immediately.** This is the whole point: curation improves what every AI tool loads, without changing a single tool description |
| MCP `search_context` | Curated items; deleted items are gone; archived items stay excluded (`docs/vault-format.md` §10) |
| MCP tool list | **Unchanged by default** (D-K): 5 tools, 2 prompts, stdio. A model cannot edit, delete, pin or archive anything — curation is a human act, deliberately |
| Artifacts (C3), if it ships | **Not in context packs, not in `search_context`, not in `get_context`** by default (D-D) — an artifact is a *configuration* for a tool, not context to load into a conversation. Materialized files are read by the provider directly, on its own terms |
| `valija status` / `lock` / `doctor` | Same output; the GUI shares the keychain entry and the device state, so terminal and window agree on lock state and lineage |
| A second machine syncing the vault (M3) | Sees the curated vault after a normal `lock` → sync → `unlock`. **Deletes propagate as deletes** — there is no tombstone, no undo, and no cross-device merge; the sequential model is unchanged |
| `vault.json`, the recovery kit, the KDF parameters | **Untouched.** The GUI never rewrites the header and never mints a recovery kit (D-M) |
| The published npm package | **Unchanged in shape.** The GUI is not shipped inside `npm i -g valija` (D-G) |

---

## 5. Architecture expectations

Stated as boundary requirements, not a file layout. The planner owns the layout; these are the
constraints that decide whether the result is testable.

1. **The GUI is a delivery adapter, not a place where logic lives.** `docs/SPEC.md` §10 already
   says both entry points are "thin adapters over the same use cases", and §3 of `specs/delivery.md`
   says rendering belongs to delivery. A third entry point changes nothing about that: every
   curation action is a `UseCase<In, Out>` in `src/context/application/use-cases/`, and the window
   calls it. **No SQL, no pack assembly, no markdown rendering, and no `Result` unwrapping logic in
   view code.**
2. **Curation is buildable and testable with no GUI at all.** This is the pyramid that makes the
   advance reviewable: `EditItem`, `DeleteItem`, `SetItemPinned`, `ArchiveItem`, `RenameProject`
   are plain use cases with per-layer tests, exercised headlessly in `vitest` exactly like
   `SaveContext` is today. If they can only be verified by clicking, the boundary is wrong.
3. **Every mutation goes through `session.write(...)`.** That is the seam
   (`src/context/infra/vault-sessions.ts`) that bumps the M3 lineage stamp atomically with the
   change. A curation path that writes outside it silently breaks fork detection for every user
   with a synced vault. Multi-item operations ("archive these three") should be **one** `write`,
   like `ImportItems` already is, so one user action is one generation bump.
4. **Sessions stay short-lived.** `withSession` opens, works, and always closes. A GUI must not
   hold a `Database` handle open across user think-time (Q2, Q3): it makes the MCP server contend
   for the write lock, and it defeats idle auto-lock. The GUI's read model is a snapshot it
   re-requests, not a live cursor.
5. **Artifacts, if they ship, are their own bounded context.** A new top-level `src/artifacts/`
   with `domain/application/infra`, depending on `shared` (and on `context` only if an artifact can
   reference a project), following the dependency rule in `docs/SPEC.md` §10. **Provider mapping
   is not domain logic** — "what a Claude Code skill file looks like" is a rendering/adapter
   concern and belongs in `infra/` behind a port, one adapter per provider, so a provider changing
   its convention touches one file. The precedent is `src/delivery/cli/installer.ts`, which already
   knows three clients' config paths and merges rather than overwrites.
6. **If D-F picks a non-Node runtime, the pyramid inverts and the cost multiplies.** A second
   implementation must re-derive Argon2id, re-open SQLCipher, re-implement pack assembly *and*
   re-implement writes — and `docs/vault-format.md` documents none of the write side. MOBILE is the
   evidence: a read-only second implementation found five contract defects and took a long fix
   chain to get green. Treat "one implementation of the domain" as the property to preserve unless
   Gate R deliberately trades it away.
7. **Error surfaces stay the domain's.** `INVALID_PROJECT_NAME`, `CONTENT_TOO_LARGE`,
   `PROJECT_NOT_FOUND`, `ITEM_NOT_FOUND`, `VAULT_LOCKED`, `VAULT_FORK_DETECTED` already exist. The
   GUI renders them; it does not invent parallel validation, and it does not weaken any of them
   into a warning.

---

## 6. Scope

Stated for the recommended defaults (D-A Option 3). **This section is downstream of §7 — if Gate R
picks different options, re-read it as illustrative, not binding.**

### In (under the defaults)

1. **Curation use cases in the TypeScript core** (C2), with per-layer tests, plus the port and
   repository methods they need, plus whatever `specs/context.md` and `specs/delivery.md` must say.
2. **A desktop application shell** for macOS, Windows and Linux over the existing read use cases
   plus the new curation ones: unlock/lock, project list, item list, item editor, search, pack
   preview, vault status.
3. **CLI parity for every destructive verb** the GUI gains, so nothing is GUI-only and everything
   is scriptable and testable (D-B) — or an explicit Gate-R decision that it is not.
4. **Documentation in the same commit**: `specs/`, `docs/SPEC.md` §2's GUI line (D-O), a
   user-facing doc for the app, and `docs/vault-format.md` **only if** the schema changes.
5. **A packaging/distribution story that is honest about signing** (D-G), including what a user
   sees on first launch of an unsigned build on each OS.

### Out — explicit non-goals under the defaults

- **No vault creation, no passphrase change, no recovery-kit generation, no vault destruction from
  the GUI** (D-M). `valija init` stays a terminal ritual.
- **No new MCP tool, argument or prompt** (D-K). Models cannot curate.
- **No change to the vault format, the crypto, the KDF parameters, `vault.json`, the keychain entry
  naming, or the SQLCipher configuration.**
- **No network call of any kind** — no auto-update check, no crash reporting, no analytics, no
  remote config, no telemetry. `docs/SPEC.md` §9's "no network calls at runtime" is absolute and
  covers this binary.
- **No cross-device merge, no conflict resolution UI, no simultaneous multi-device editing.** M3's
  fork model is *report, never merge*, and this advance does not soften it.
- **No multi-vault support** (`docs/SPEC.md` §12 open question 4 stays open).
- **No mobile, no web-hosted, no remote-access variant.**
- **No embeddings, no semantic search, no AI inside the app** — `docs/SPEC.md` §2 rejects it, and a
  GUI is exactly where it would sneak in as "smart suggestions".
- **No auto-capture.** Explicit saves only, still.
- **Artifacts (C3) are out under the D-A default** and are a separate advance with their own Gate R.

---

## 7. Decisions to confirm

### D-A. The shape of the advance — what actually ships together

The raw idea contains three products (§3, C1/C2/C3). They have very different weights and very
different risk profiles.

- **Option 1 — one advance, all three.** Shell + curation + artifacts + provider materialization.
  *Trade-off:* this is the largest advance the project has ever attempted, and it fuses a
  packaging/toolchain problem, a domain-model extension with a migration, and a new plaintext
  egress path. Every one of those can fail independently, and none is reviewable until all are
  done. The MOBILE advance's secondary risk (toolchain scope creep producing an unreviewable
  branch) applies here with more surface.
- **Option 2 — shell only (C1), read-only, exactly `idea.md`'s original scope.** Smallest, ships
  fastest, zero domain risk. *Trade-off:* it does not do what Oscar asked. "Administer and refine"
  is precisely what a read-only shell cannot do, and shipping a viewer would leave the actual ask
  untouched while spending the entire platform/packaging budget.
- **Option 3 — two advances: (a) shell + curation (C1+C2), (b) artifacts (C3).** (a) delivers a
  usable management app over the existing domain plus one new, well-bounded slice of write use
  cases; (b) is then a focused advance on new domain territory, provider mapping, and the egress
  security question, with its own Gate R and its own security review. *Trade-off:* the
  headline feature Oscar named — skills and agents — lands second, not first.
- **Option 4 — three advances: (a) curation in the core, CLI-only; (b) the desktop shell over it;
  (c) artifacts.** Maximum reviewability: (a) is pure TypeScript with no toolchain at all and can
  ship in days; (b) becomes a comparatively pure platform/packaging advance. *Trade-off:* the user
  sees no GUI until the second advance, and (a) alone might feel like it missed the point.
- **Option 5 — artifacts first (C3), no GUI yet**, authored via the CLI and materialized into
  provider directories. *Trade-off:* it delivers the "same setup everywhere" promise soonest and
  cheapest, and defers the entire platform decision — but it is not the desktop UI Oscar asked for.
- **Default: Option 3.** Reason: it is the smallest split that still delivers a *management* app
  rather than a viewer, and it puts the one genuinely security-model-touching capability (C3's
  plaintext egress) behind its own gate rather than smuggling it in beside a packaging problem.
  Option 4 is the more disciplined choice if Gate R prefers to de-risk the platform decision
  entirely, and is strictly better than Option 3 if D-F turns out contentious. Option 1 is not
  recommended at any point.

### D-B. What "administer / refine" means concretely — the verb set

"Curate" has to become a finite list before anyone can plan it. Each verb has a different cost and
a different blast radius.

- **Option 1 — non-destructive only:** edit content/tags, pin/unpin, archive/unarchive. Nothing is
  ever irrecoverably lost; archive is already a reversible soft-delete and the columns exist.
  *Trade-off:* the vault only grows. Users who imported a 4 000-item ChatGPT history (M2) cannot
  prune it, and pruning is a real reason to want a management UI.
- **Option 2 — Option 1 plus hard delete** of items, with a typed confirmation. *Trade-off:* the
  first irreversible path in the product. The recovery kit recovers a *key*, not data; there is no
  backup feature (`docs/SPEC.md` §2 lists "encrypted backup/restore → later"). A delete that syncs
  to another device is gone everywhere.
- **Option 3 — Option 2 plus project-level operations:** rename, edit description, delete a project
  (cascade or refuse-if-non-empty), move items between projects. *Trade-off:* `projects.name` is
  `UNIQUE` and `context_items.project_id` is a real FK with `foreign_keys = ON`, so cascade
  semantics need deciding, not assuming; and deleting a project is a many-item destructive act.
- **Option 4 — Option 3 plus bulk operations** (multi-select archive/delete/retag, "archive all
  imported older than X"). *Trade-off:* the highest-value feature for an imported-history user and
  the easiest way to destroy a vault with one click.
- **Default: Option 3, with hard delete gated behind a typed confirmation, and bulk operations
  deferred to a follow-up.** Reason: Option 1 does not solve the problem that motivates a
  management surface (an unprunable vault), and Option 4's blast radius deserves its own design
  pass once single-item delete has proven its confirmation UX. **Sub-decision the planner must not
  guess:** deleting a project with items → *refuse and tell the user to empty it first* (default,
  safest, matches the product's never-auto-destroy posture) vs. *cascade with confirmation*.
  **Second sub-decision:** does every new verb also get a CLI command? Default **yes** — it keeps
  the GUI a true adapter, makes destructive paths scriptable and testable without a UI harness, and
  prevents a two-tier product where the terminal cannot undo what the window did.

### D-C. Where the curation write paths live

- **Option 1 — in the TypeScript core (`src/context/application/use-cases/`), consumed by both the
  CLI and the GUI.** One implementation, one set of invariants, one lineage seam, per-layer tests
  with no UI. *Trade-off:* only viable if the GUI can call TypeScript in-process or over a
  process boundary — i.e. it constrains D-F.
- **Option 2 — in the GUI's own runtime**, reimplementing validation and SQL there. *Trade-off:*
  two implementations of `parseContent`, `parseTags`, the lineage bump and the FTS trigger
  contract, diverging silently. `docs/vault-format.md` documents **none** of the write side, so
  there is not even a contract to implement against — it would have to be written first.
- **Option 3 — the GUI shells out to the `valija` CLI** for every mutation. One implementation,
  process-isolated. *Trade-off:* needs machine-readable CLI output (a `--json` mode on more than
  `export`), pays process-spawn latency per action, and makes error handling stringly-typed.
- **Default: Option 1.** Reason: it is the only option that keeps a single guardian of the
  `ContextItem` invariants, and it is what `docs/SPEC.md` §3 and §10 already promise ("both entry
  points are thin adapters over the same use cases"). Option 3 is the honest fallback if D-F picks
  a runtime that cannot host Node in-process. **Option 2 should be treated as effectively
  foreclosed** unless Gate R also commissions a written write-side format contract, because it
  re-opens byte-level compatibility on the one path where getting it wrong corrupts user data
  rather than mis-rendering it.

### D-D. Do skills and agents ship, and what are they in the domain model?

Only reachable if D-A puts C3 in scope. Recorded here regardless, because it shapes what a schema
migration would look like.

- **Option 1 — a new `ContextItem` type** (`skill`, `agent`) added to the `CHECK` constraint via
  migration 004, reusing everything. Cheapest by far. *Trade-off:* an artifact is not context — it
  has a name, a target set, and a materialization state that `ContextItem` has no columns for; the
  pack algorithm and FTS would need explicit exclusions everywhere (`imported` already shows how
  many places that touches: pack assembly, `totalCount`, search, the MCP enum, `show --type`).
  Conceptually it overloads a well-defined ubiquitous language.
- **Option 2 — a new `artifacts` bounded context** with its own table(s), its own entity, its own
  value objects (`ArtifactKind`, `ArtifactName`), and its own module under `src/artifacts/`.
  *Trade-off:* migration 004 is a new table (lower risk than 002's table rebuild), plus a new
  `docs/vault-format.md` section, plus a fixture regeneration.
- **Option 3 — artifacts live outside the vault entirely**, as plaintext files valija manages in a
  known directory. *Trade-off:* cheapest to build, and it abandons the product's core claim for
  this data class — a "skill" containing a company's internal review checklist would sit in
  plaintext, which is exactly what a user chose valija to avoid.
- **Option 4 — not in this advance at all.** Ship curation, defer artifacts to their own Gate R.
- **Sub-decision (naming/ubiquitous language):** one `Artifact` entity with a `kind`
  (`skill | agent | rule | instruction`) vs. separate `Skill` and `Agent` entities. **Default: one
  entity with a kind**, because the difference between a "skill" and an "agent" is mostly *which
  file a provider expects*, which is a rendering concern (§5.5), and provider vocabularies drift.
- **Default: Option 4 for this advance (per D-A Option 3), and Option 2 when it ships.** Reason:
  artifacts are the part with genuinely new invariants, a genuinely new security surface, and a
  dependency on third-party formats nobody controls; they deserve a spec of their own rather than
  a section in a GUI spec. If Gate R wants artifacts in *this* advance, Option 2 is the right
  shape and Option 1 should be resisted — the `imported` type is already a cautionary tale about
  how far a special-case type propagates.

### D-E. Provider materialization — does valija write files outside the vault?

The decision that turns "one curated setup, used consistently everywhere" from a slogan into a
mechanism. It is also the only decision in this spec that changes the security model.

- **Option 1 — no file writing. Copy to clipboard / "reveal the text" only.** The user pastes it
  wherever they want. Zero new egress, zero coupling to third-party conventions.
  *Trade-off:* it does not deliver "consistently across every provider" — it delivers "here is the
  text, good luck", which the existing `valija export` already roughly does.
- **Option 2 — explicit, per-target, user-initiated materialization**, mirroring
  `valija install`'s existing discipline: back up first, merge rather than overwrite, refuse to
  touch anything it cannot parse, print exactly what changed, and detect drift (file changed
  outside valija → report, never clobber). *Trade-off:* valija now owns a set of plaintext files on
  the user's disk and takes on the maintenance of three-plus third-party formats that change
  without notice.
- **Option 3 — continuous sync / watcher.** valija keeps provider files in step automatically.
  *Trade-off:* a background process (which M3 deliberately refused for auto-lock — "lazy instead of
  a daemon"), silent overwrites of user edits, and the largest possible plaintext footprint.
  Contradicts the project's standing posture.
- **Option 4 — expose artifacts through MCP instead of files**, so MCP-capable clients read them
  live and nothing is written to disk. *Trade-off:* it only reaches MCP clients — Cursor rules,
  Claude Code skill files, and any web chat are exactly the surfaces that need a file, so
  "everywhere" is not achieved; and it needs a new MCP tool or resource (D-K).
- **Default: Option 2, with Option 4 as a complement later.** Reason: files are the only mechanism
  that actually reaches the provider surfaces Oscar named, and `valija install` already establishes
  a safe, reviewable pattern for writing into someone else's config (backup, merge, refuse,
  report). Option 3 is rejected on the same grounds M3 rejected a daemon. **Non-negotiable riders
  if Option 2 or 3 is chosen:** a plaintext warning at the point of the first write; a `docs/SPEC.md`
  §9 amendment naming the new egress; drift detection that reports and never overwrites; and an
  explicit list of every path valija may write to, reviewable in one place.

### D-F. Platform and framework

Fully re-opened (§2). The decisive property is **whether the app can run valija's existing
TypeScript core, including three native modules** (`better-sqlite3-multiple-ciphers`, `argon2`,
`@napi-rs/keyring`), or must reimplement it.

- **Option 1 — Electron** (+ any web UI framework). The existing core runs in-process in the main
  process; one implementation, one language, all three platforms from one codebase, and the three
  native modules are ordinary Node addons rebuilt against Electron's ABI. *Trade-off:* ~100–150 MB
  per install, Chromium's own security surface and update cadence, and a native-module rebuild step
  that must be pinned in CI. It is the least architecturally interesting and the least risky.
- **Option 2 — Tauri v2 (Rust shell, web frontend) with the Node core as a bundled sidecar
  process.** Much smaller installer, native webview, and still **one** implementation of the domain
  (the Rust side never touches SQLCipher). *Trade-off:* the sidecar must ship a Node runtime or a
  packaged binary anyway, IPC becomes a real interface to design and version, and the project gains
  a Rust toolchain it has no other use for.
- **Option 3 — Compose Multiplatform / KMP desktop**, reusing `valija-mobile`'s Kotlin core.
  *Trade-off:* this is a **second implementation**, and unlike MOBILE it must implement **writes**,
  for which `docs/vault-format.md` provides no contract at all (§1: "Writing is out of scope"). It
  also inherits the JVM packaging story and needs the SQLite3MultipleCiphers amalgamation and
  Argon2id vendored again for three desktop OSes. The prior art is real but read-only. Chooseable
  only if Gate R also commissions a write-side format contract and accepts byte-level dual
  maintenance.
- **Option 4 — a local web UI served by the existing Node process** (`valija ui` → opens
  `http://127.0.0.1:<port>` in the user's browser). By far the cheapest: no new runtime, no
  packaging, no signing, no second implementation, works on all three OSes today.
  *Trade-off:* it is not an "app" in the sense Oscar asked for (no icon, no window, lives in a
  browser tab), and it introduces an HTTP surface to an unlocked vault on the loopback interface —
  which is philosophically adjacent to `docs/SPEC.md` §2's "Remote/HTTP MCP transport — local stdio
  only" rejection, and would need origin/CSRF/token discipline that stdio never needed.
- **Option 5 — native per OS** (SwiftUI / WinUI / GTK). Best fit and feel per platform; three
  codebases and three second implementations. Not recommended at this project's scale.
- **Default: Option 1 (Electron).** Reason: this advance's value is the *management model* — the
  curation verbs, the artifact concept, the consistency ritual — and every non-Node option spends
  its entire budget re-earning capabilities the project already has, on the one path (writes) where
  a divergence corrupts data instead of mis-rendering it. Electron's cost is disk space and a
  rebuild step; every other option's cost is a second implementation or a new network surface.
  **Option 4 is the strongest alternative if Gate R's priority is shipping something usable fastest**,
  and it is a legitimate stepping stone — but it should be chosen deliberately, with the loopback
  HTTP surface named as a decision, not adopted as a shortcut. Option 2 is the right answer if
  installer size is a hard requirement.

### D-G. Where the code lives, and how it is distributed

- **(a) Repository.** Options: a `valija-desktop` repo (mirrors the `valija-mobile` precedent from
  MOBILE P-3, keeps a Chromium/Rust/JVM toolchain out of a Node package repo, but splits the
  advance ritual across repos again and duplicates the guard hooks); a workspace/monorepo folder in
  this repo (`desktop/`, one ritual, one CI, one place to review — but `.claude/hooks/guard-implementation.sh`
  currently gates `src/`, `package.json` and build config, so a new top-level tree's governance
  needs stating); or inside `src/delivery/` (only coherent for D-F Option 4).
  **Default: a workspace folder in this repo** if D-F picks Option 1, 2 or 4, because the GUI calls
  the same use cases and should move with them in one commit and one review; a separate repo only
  if D-F picks Option 3 or 5, where the toolchain genuinely does not belong here.
- **(b) Packaging and signing.** macOS notarization needs an Apple Developer Program membership —
  **the exact 99 USD/year cost Oscar declined for mobile** (`advances/MOBILE/refined.md` P-6
  amendment). Windows Authenticode certificates are a comparable annual cost. Options: unsigned
  artifacts with documented first-launch instructions per OS (right-click-Open on macOS, "More
  info → Run anyway" on Windows); signed artifacts (requires a budget decision Gate R must make
  explicitly); or **no binary distribution at all** — the GUI runs from the repo / from npm, which
  sidesteps signing entirely and matches the developer audience.
  **Default: unsigned artifacts plus a run-from-source path, with the first-launch friction
  documented per OS.** Reason: the audience is developers, the project is unmonetized, and the
  mobile decision already set the precedent that store/signing costs are not justified. Gate R
  should confirm rather than inherit this.
- **(c) Does the GUI ship inside the npm package?** **Default: no.** `package.json`'s `files` is
  `["dist","README.md","LICENSE"]`; adding an Electron bundle would multiply `npm i -g valija` for
  every CLI-only user. Separate artifact, separate release channel.

### D-H. The GUI's session model

- **Option 1 — share the CLI's keychain session exactly.** Same entry (service `"valija"`, account
  `vaultId`), same `unlock`/`lock` semantics, same `SessionGuard` idle TTL. Terminal and window
  agree at all times. *Trade-off:* on macOS the keychain ACL is per-application; an unsigned or
  differently-signed GUI binary reading the entry the Node CLI wrote triggers an allow-access
  prompt and may re-prompt after every rebuild. This must be tested on macOS, not assumed (D-F
  Option 4 avoids it entirely by running inside the same Node process).
- **Option 2 — the GUI holds its own in-memory key** for its window lifetime and does not use the
  keychain. *Trade-off:* two independent lock states, a confusing `valija status`, and a second
  place a key lives — a strict regression against D6.
- **Option 3 — the GUI never unlocks; it refuses to work unless `valija unlock` was run in a
  terminal.** Safest and most consistent; unusable for the non-technical audience `idea.md` named.
- **Default: Option 1**, with a mandatory early spike on the macOS keychain-ACL behaviour, since a
  failure there is a UX blocker discovered late. **Riders regardless of option:** the GUI honours
  `VALIJA_AUTOLOCK_MINUTES` and must not defeat it by polling (Q3) — background refresh must not
  count as user activity; the passphrase is never persisted, never logged, never written to
  preferences; the key never leaves the keychain and process memory.

### D-I. Device identity and the M3 lineage model

- **Option 1 — the GUI is the *same device* as the CLI** on that machine: it reads the same
  `VALIJA_STATE_HOME` device id and last-seen record. GUI writes and CLI writes on one machine are
  one writer, so they can never classify as a fork. *Trade-off:* requires the GUI to resolve
  `VALIJA_STATE_HOME` exactly as `resolveStatePaths()` does, including the env override.
- **Option 2 — the GUI mints its own device id.** *Trade-off:* GUI-write then CLI-write on the same
  machine produces two writers at comparable generations, which is exactly `classifyLineage`'s
  fork signature. Users would see `VAULT_FORK_DETECTED` on their own single machine — a false
  positive in the one place the product promises never to auto-resolve, which would either erode
  trust in the warning or push someone to weaken the check.
- **Default: Option 1, unconditionally.** Reason: a false fork is worse than no fork detection,
  because it teaches users to ignore the alarm. This is also the answer that requires the least new
  code. **Acceptance must include a test that GUI-then-CLI writes on one machine produce a clean
  fast-forward, not a fork** — the existing `src/delivery/multi-device-sync.test.ts` is the model.

### D-J. Concurrency — GUI, MCP server and CLI on one vault

- **Option 1 — short-lived sessions everywhere** (§5.4): the GUI opens, reads or writes, closes,
  per action, exactly as the CLI does. SQLite's rollback-journal locking then behaves as it does
  today. *Trade-off:* the GUI re-reads more often, and a stale view is possible between refreshes
  (acceptable — nothing else is writing except the user's own tools).
- **Option 2 — a long-lived connection** held by the GUI. *Trade-off:* the MCP server's `save_context`
  can hit `SQLITE_BUSY` while the window is open; there is no retry/backoff policy anywhere in the
  codebase today, so this would surface to a model as a tool error.
- **Option 3 — a coordinating daemon** that owns the vault and serves all three surfaces.
  *Trade-off:* M3 explicitly rejected a background daemon; this would be a much larger
  architectural change than the feature warrants.
- **Default: Option 1**, plus an explicit decision on what the GUI does when a write fails because
  another process holds the lock (**default: surface a plain "the vault is busy, try again" and
  retry once**, not a silent swallow). Reason: it preserves the exact concurrency behaviour every
  existing entry point already has, and it is the only option that does not need a new policy.

### D-K. Does anything reach the MCP surface?

- **Option 1 — nothing changes.** 5 tools, 2 prompts, stdio. Curation is a human act; artifacts are
  materialized as files. *Trade-off:* an AI cannot help the user tidy their own vault, which is
  arguably a natural use of the product.
- **Option 2 — add read-only exposure of artifacts** (a 6th tool, or MCP *resources*, which this
  server does not use today). *Trade-off:* crosses "resist adding more" (`docs/SPEC.md` §7); MCP
  resources are a new protocol surface with their own semantics.
- **Option 3 — add curation tools** (`edit_context`, `delete_context`, `pin_context`).
  *Trade-off:* gives a model destructive authority over the user's vault. `docs/SPEC.md` §9 already
  notes any connected MCP client receives plaintext; letting it *delete* is a different category of
  trust, and the server never sees the conversation that motivated the call.
- **Default: Option 1.** Reason: every prior advance (M2, M3) deliberately shipped with **no MCP
  change**, and the one asymmetry worth preserving in this product is that models read and append,
  while humans curate and destroy. Option 3 should be rejected outright rather than deferred.

### D-L. May the GUI run migrations?

`SqliteVaultSessions.open()` calls `migrate()` on every session, and `docs/vault-format.md` §11
forbids migration for a second implementation, permanently.

- **Option 1 — yes, if the GUI runs the same TypeScript core** (D-F Options 1/2/4). It *is* desktop
  valija, not a second implementation, and refusing would break the ordinary upgrade path.
- **Option 2 — no; the GUI refuses to open a vault needing migration** and tells the user to run a
  CLI command first. Safest, and mandatory if D-F picks a second implementation.
- **Default: Option 1 if D-F lands on 1/2/4; Option 2 if it lands on 3/5.** Reason: the rule's
  purpose is that only one, well-tested implementation of the migration ritual exists — not that
  only one *binary* runs it. **Rider either way:** migration 002 and 003 both take a ciphertext
  backup on a populated vault; a GUI that triggers a migration must surface that backup's location
  to the user rather than migrating silently behind a spinner.

### D-M. Vault lifecycle operations in the GUI

- **Option 1 — none.** No init, no passphrase change, no recovery-kit regeneration, no vault
  deletion. The GUI opens an existing vault or explains how to create one.
- **Option 2 — init in the GUI too**, including passphrase entry and recovery-kit display.
  *Trade-off:* the recovery kit is the single most consequential artifact in the product ("losing
  passphrase + kit = data loss, by design"); displaying it in a window the user can dismiss
  without reading is a materially worse ritual than a terminal that prints it once. It also
  duplicates the most security-sensitive flow in a new surface.
- **Option 3 — Option 1 plus a guided "no vault found" screen** that shows the exact command to run
  and re-checks when the user returns.
- **Default: Option 3.** Reason: it keeps the irreversible ritual in one place while removing the
  dead-end for the non-technical user. Passphrase change does not exist anywhere in the product
  today and is not this advance's job to invent.

### D-N. Who is this for?

`idea.md` framed the GUI as the *non-technical user's* mirror of the CLI. Oscar's new framing
(curate context, author agents and skills, apply them across providers) describes a **power user**.

- **Option 1 — non-technical first.** Simple, guided, few affordances, hides projects/types/tags
  behind friendly language. *Trade-off:* curation and artifact authoring are inherently technical;
  a simplified UI would hide the concepts the feature is about.
- **Option 2 — power user first.** Dense, keyboard-driven, exposes types/tags/pins/budget directly,
  assumes the user knows what a context pack is. *Trade-off:* abandons `idea.md`'s original
  rationale for the GUI existing at all.
- **Option 3 — power user first, with the read path usable by anyone.** Browsing, searching and
  copying a pack need no vocabulary; the curation and artifact surfaces are unapologetically
  technical.
- **Default: Option 3.** Reason: it matches what the feature actually is without discarding the
  original motivation, and it gives the planner a clear tie-breaker for every UI trade-off.
  It also implies **no i18n in this advance** (English only) unless Gate R says otherwise.

### D-O. The roadmap: `docs/SPEC.md`

`docs/SPEC.md` §2 currently lists "GUI, encrypted backup / restore → later (bumped from M3 by M3's
redefinition, see §10b)". The specs-are-contracts rule (M4 D-A, MOBILE P-4) says the advance that
builds toward a thing corrects the line that denies it.

- **(a) Does the Out line change?** **Default: yes** — split the fused clause so "encrypted backup /
  restore" stays *later* and the GUI line reflects reality, and add a §10 subsection describing what
  shipped, in the idiom of §10a/§10b. Also: if C2 ships, §5's use-case list and §8's CLI surface are
  both out of date the moment it merges and must be updated in the same commit.
- **(b) Does the GUI get a milestone number?** Options: no number (stay `GUI`, matching MOBILE's
  posture); or assign one, which forces a collision with §2's existing assignments (M4 = scoped
  profiles, M5 = browser extension) and with §9's standing promise that per-tool scoping "arrives
  in M4". **Default: no number**, decided again at the next Gate R once the artifact half is scoped.

---

## 8. Security surfaces that must not weaken

A GUI is the most likely place in this project's history for a claim to erode quietly, because
"just for the UI" is a persuasive reason to cache, to hold open, and to write out.

1. **No new place a key or passphrase can live.** The key lives in the OS keychain and in process
   memory. Not in `localStorage`, not in an Electron `safeStorage` blob, not in a preferences file,
   not in a renderer process, not in a log, not in a crash dump, not in a window title.
2. **No plaintext cache of vault content.** No "for speed" SQLite mirror, no JSON index on disk, no
   search cache, no thumbnail/preview cache. Everything at rest stays inside `vault.db`.
3. **The vault format, crypto, KDF parameters, `vault.json`, and the SQLCipher configuration are
   untouched** unless a schema migration is explicitly in scope (D-D) — and then only through a
   numbered migration, a fixture regeneration, and a `docs/vault-format.md` edit in the same commit
   (§14).
4. **Every write goes through `session.write(...)`** so the M3 lineage stamp advances atomically.
   No path may write to `vault.db` outside that seam. Fork classification is **never** softened,
   auto-resolved, or hidden from the user because a warning looks bad in a window.
5. **No journal-mode drift.** The single-file-at-rest guarantee (M3 D-A) must hold after every GUI
   action, not only after `lock`. No `-wal`, `-shm` or `-journal` sidecar may survive an action.
6. **Idle auto-lock is not defeated.** A GUI must not keep the vault unlocked by polling, and must
   not count its own background refresh as user activity (Q3). If it does, M3's D-I is silently
   removed from every user who installs the app.
7. **No network traffic, at all.** No auto-update, no crash reporting, no analytics, no remote
   config, no font/CDN fetch, no telemetry. This must be verifiable by inspecting the shipped
   bundle's declared capabilities, not by reading a promise.
8. **If D-E allows file materialization:** every writable path is enumerated in one reviewable
   place; every write backs up first and merges rather than overwrites (the `installer.ts`
   discipline); a file modified outside valija is **reported, never clobbered**; the plaintext
   nature of those files is stated to the user at the first write; and `docs/SPEC.md` §9 gains a
   line naming this egress. valija must never write outside the enumerated paths.
9. **Destructive operations are irreversible and must say so.** Delete has no undo, no tombstone
   and no backup behind it (`docs/SPEC.md` §2: encrypted backup/restore is "later"). The
   confirmation must be explicit, and the deletion must propagate honestly to synced devices rather
   than being hidden locally.
10. **If D-F picks a web-technology shell:** no remote content is ever loaded into a renderer; any
    user-authored markdown rendered as HTML is sanitized (vault content is attacker-influenced the
    moment a user imports someone else's export — M2's importers ingest arbitrary third-party
    files); Node integration is disabled in renderers; context isolation is on; and the IPC surface
    between renderer and main is an explicit allowlist, not a generic "run this use case" bridge.
11. **If D-F picks a loopback HTTP variant (Option 4):** bind to `127.0.0.1` only, require a
    per-launch token, enforce origin checks, and treat the port as an unlock-equivalent surface —
    or do not choose that option.
12. **The MCP surface stays as it is** unless D-K says otherwise, and never gains a destructive
    tool.
13. **The desktop threat model in `docs/SPEC.md` §9 is unchanged** except where D-E forces an
    addition. A GUI does not get to imply stronger protection than the vault provides.

---

## 9. Acceptance criteria

A reviewer should be able to check each line without running the GUI, except where noted. Lines
marked *(conditional)* apply only if Gate R selects the corresponding option.

**Domain and architecture**

- [ ] Every curation verb selected in D-B exists as a `UseCase` in `src/context/application/use-cases/`
      with its own test, and passes with **no GUI in the loop**.
- [ ] No SQL, no pack assembly, no markdown rendering and no validation logic exists in GUI view
      code; the GUI calls use cases and renders `Result`s.
- [ ] Every mutation runs inside `session.write(...)`; a multi-item action produces **one**
      lineage generation bump, not one per item.
- [ ] New errors follow the `xxxErr(code, message)` convention and are listed in
      `src/context/domain/errors.ts` and `specs/context.md`.
- [ ] No file sits bare at a layer's root; new kinds of thing get their own named subfolder
      (`CLAUDE.md` Conventions).
- [ ] *(conditional, D-B)* Each destructive verb also exists as a CLI command, documented in
      `docs/SPEC.md` §8 and `specs/delivery.md`.

**Vault, sync and session integrity**

- [ ] A test proves that a GUI write followed by a CLI write on the same machine classifies as a
      clean **fast-forward**, not `VAULT_FORK_DETECTED` (D-I).
- [ ] After every GUI action, `vault.db` is the only file at rest — no `-wal`, `-shm` or `-journal`
      sidecar, and `journal_mode` is still `DELETE`.
- [ ] The GUI holds no database connection across user think-time; sessions open and close per
      action (D-J).
- [ ] Idle auto-lock still fires at `VALIJA_AUTOLOCK_MINUTES` with the GUI open and idle; a test or
      a documented manual check proves background refresh does not reset the idle clock.
- [ ] The GUI and the CLI report the same lock state at all times; unlocking in one is visible in
      the other.
- [ ] The passphrase and the derived key appear in no file, no preference store, no log and no
      renderer process; verified by inspection and named in the review.
- [ ] *(conditional, D-L)* If the GUI may migrate, a migration triggered from the GUI surfaces the
      ciphertext backup path to the user; if it may not, it refuses with an actionable message.

**Security posture**

- [ ] The shipped bundle makes **zero** network requests: no update check, no crash reporter, no
      analytics, no remote asset. Verified against the built artifact, not the source intent.
- [ ] No plaintext copy of vault content is written anywhere outside the vault — except paths
      explicitly authorised by D-E.
- [ ] `vault.json`, the KDF parameters, the keychain entry naming, and the SQLCipher pragma set are
      byte-for-byte unchanged.
- [ ] The MCP surface is unchanged: 5 tools, same arguments, 2 prompts, stdio *(unless D-K says
      otherwise, in which case the change is exactly what D-K authorised and nothing more)*.
- [ ] *(conditional, D-F web shell)* Context isolation on, Node integration off in renderers, IPC
      restricted to an explicit allowlist, and user markdown sanitized before rendering.
- [ ] *(conditional, D-E)* Every writable external path is enumerated in one place; writes back up
      first, merge rather than overwrite, and report drift instead of clobbering; the plaintext
      warning is shown at the first write; `docs/SPEC.md` §9 names the egress.

**Format and documentation**

- [ ] *(conditional, D-D)* Any schema change ships as a numbered migration, with the golden-vault
      fixture regenerated and `docs/vault-format.md` updated **in the same commit** (§14), and the
      conformance test green.
- [ ] `specs/context.md` and `specs/delivery.md` describe every new use case and command.
- [ ] `docs/SPEC.md` §2's GUI line, §5's use-case list and §8's CLI surface are corrected, and a
      §10-series subsection records what shipped (D-O).
- [ ] A user-facing document explains: installing the app, first launch on an unsigned build per
      OS, what the GUI can and cannot do, and that delete is permanent.

**Product behaviour a reviewer can check by hand**

- [ ] Pinning an item in the GUI changes what `valija export <project>` and MCP `get_context`
      return — the pack is recomposed with it under **Pinned**.
- [ ] The GUI's pack preview is **byte-identical** to `valija export <project>` for the same budget.
- [ ] Archiving removes an item from packs and from `search_context`; unarchiving restores it.
- [ ] A locked vault produces the same actionable message in the GUI that the MCP tools produce,
      not a stack trace or a blank screen.
- [ ] A vault reporting `VAULT_FORK_DETECTED` is surfaced in the GUI, not swallowed, and the GUI
      offers no "resolve" button.
- [ ] Every step in §4's walkthrough that is in scope can be performed end to end, and every step
      out of scope is either absent or explains where to go instead.

---

## 10. Deliverables summary (for the planner, not a plan)

Under the recommended defaults (D-A Option 3, D-C Option 1, D-F Option 1, D-B Option 3): a slice of
**curation use cases** in `src/context/` — edit, pin/unpin, archive/unarchive, delete, rename and
edit a project, move items — each with per-layer tests and a matching CLI command, all writing
through the existing `session.write` lineage seam; plus a **cross-platform desktop application**
that unlocks against the same keychain entry, browses projects and items, searches, previews the
rendered pack, and performs those curation actions, distributed as unsigned artifacts with a
documented first-launch path per OS. Documentation updates land in the same commit:
`specs/context.md`, `specs/delivery.md`, `docs/SPEC.md` §2/§5/§8 plus a new §10-series subsection,
and a user-facing app document. **No MCP change, no vault-format change, no schema migration, no
network call, and no milestone number.**

**Artifacts (skills and agents) and provider materialization are a separate advance** with their
own Gate R, their own domain (`src/artifacts/`), their own migration, and their own security review
of the plaintext-egress path. If Gate R disagrees and wants them here, D-D Option 2 and D-E Option 2
are the shapes to plan against, and the acceptance criteria marked *(conditional)* become mandatory.

---

## 11. Biggest risk

**The advance most likely fails by delivering a beautiful shell over a domain that still cannot
curate anything.** The GUI is the visible, motivating, fun part; the unglamorous truth is that
valija today has *two* write operations, both append-only, and that no shipped surface can even
create a pinned item. If planning starts from the window, the platform and packaging problem —
Electron vs. Tauri, native-module rebuilds, three OSes, unsigned-binary friction, macOS keychain
ACLs — will absorb the entire advance, and what lands is `idea.md`'s read-only viewer wearing the
new spec's title. The mitigation is D-A/D-C: build and merge the curation use cases as headless,
CLI-testable TypeScript **before** any UI exists, so the advance has a reviewable, useful core even
if the shell slips.

The second risk is **the artifacts feature quietly rewriting the security model**. C3 is the part
Oscar named most enthusiastically, and it is the only part that requires valija to write vault-derived
plaintext to durable files outside the vault, in formats owned by third parties that change without
notice. Done inside a large GUI advance, that decision gets made by an implementer choosing a path
constant rather than by Gate R choosing a posture — and "everything at rest is ciphertext" becomes
"everything at rest is ciphertext, except the files we also write." Splitting it out (D-A Option 3)
is what keeps that a decision instead of a side effect.

The third risk is **a false fork**. If the GUI mints its own device id (D-I Option 2), a user who
edits in the window and then runs a CLI command on the *same laptop* gets `VAULT_FORK_DETECTED` —
the product's loudest, most trust-dependent warning, fired at a machine that never forked anything.
The likely response is not a bug report; it is a user learning to ignore the alarm, which quietly
disables M3 for the one scenario it exists to protect.
