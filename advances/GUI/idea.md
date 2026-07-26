# Desktop GUI companion for valija · Raw idea

**Status:** Idea capture only — not refined, not planned, not for Gate R yet.
**No milestone assigned, deliberately.** `docs/SPEC.md` §2 already lists "GUI, encrypted
backup / restore → later" with no number attached — this predates the idea below and stays
true. Do not assume this is the next open slot, or any particular slot, until it goes
through `task-refiner` and Gate R on its own.

---

## Why

Raised in passing while refining `advances/M4/` (the mobile companion): today's desktop
surface is CLI + MCP server only — deliberate, "One binary surface: `valija`" (§1). Not
everyone wants a terminal. A desktop GUI is the non-technical-user equivalent of the mobile
companion's Tier 1: browse projects, search, read a context pack, copy it — without needing
`valija show`/`search`/`export`.

## Depends on / rides on

- **Whatever M4 (mobile) decides for D-E (platform/framework).** Oscar's direction there is
  Kotlin Multiplatform (shared core in Kotlin, native UI, iOS first). Compose Multiplatform
  targets JVM desktop the same way it targets Android/iOS, so *if* M4 lands on KMP, a desktop
  GUI reusing that same shared core is comparatively cheap — no separate decision needed on
  how to share domain logic, it inherits M4's D-F answer (reimplement the pure algorithms,
  verified against golden fixtures, no embedded JS/WASM runtime).
- **M4's format contract** (`docs/vault-format.md`, if D-B Option 2 lands as expected): a
  desktop GUI is just another reader of the same documented format — no separate spec needed
  for the vault side, only for the GUI shell itself.
- Explicitly **not** urgent groundwork: no scaffolding, no stub module, no repo restructuring
  is needed ahead of time. The KMP choice and the format contract already keep this path open
  at zero cost; building anything further now would be speculative work for an unscheduled
  milestone.

## Shape (very rough — genuinely undecided)

- Read-only first, mirroring M4's Tier 1 logic: same vault, same passphrase, same rendered
  context pack as `valija export`, no new write path.
- Runs against the **local** vault directly (`VALIJA_HOME`) — unlike mobile, a desktop GUI
  has normal filesystem access, so it doesn't inherit M4's D-H document-picker/snapshot-copy
  problem. Session model likely mirrors the existing OS-keychain unlock/lock, not mobile's
  biometric model.
- Whether it *writes* (a `save_context` equivalent from a GUI) is exactly as open as M4's
  Tier 2 question, and for the same reason: it would need to reason about the M3 lineage/fork
  model the same way a second "device" does.
- Packaging/distribution, and whether it lives in this repo, the future `valija-mobile` repo,
  or a third `valija-desktop` repo, are all undecided — likely tracks M4's D-L answer once
  that's proven out, but not necessarily identical.

## Not decided / not scoped yet

Everything except "it rides on M4's platform choice." Framework beyond "probably Compose
Multiplatform if M4 lands on KMP," whether it ships at all, which milestone (if any), read-only
vs. read-write, distribution shape, packaging (installer vs. store), and how/whether it relates
to a future `valija-mobile` repo. This file exists so the idea isn't lost — it is not a spec and
should go through `task-refiner` (Gate R) before any of this is treated as planned work.
