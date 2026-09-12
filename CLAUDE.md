# Valija — working agreement

Valija is a local-first, end-to-end encrypted context vault that exposes a user's AI
context to tools like Claude, ChatGPT, and Cursor through a local MCP server.
Stack: TypeScript, Node 22, SQLCipher (`better-sqlite3-multiple-ciphers`), Argon2id,
OS keychain. Work ships as reviewable **advances** under `advances/<ADV>/`.

## The advance ritual

Every advance moves through five phases. **The refiner, planner, and reviewer are
subagents — they run autonomously and cannot talk to you mid-run. The main
(orchestrating) agent owns every human gate below.**

1. **Refine** — `task-refiner` writes `advances/<ADV>/refined.md`.
   - **Gate R:** the main agent presents the spec and its open decisions and **stops**.
     Do **not** move to planning until Oscar explicitly approves the spec.

2. **Plan** — `task-planner` writes `advances/<ADV>/plan.md`.
   - **Gate P:** the main agent **stops** and presents, for Oscar to check:
     (a) the plan summary, (b) the plan's *Decisions to confirm*, and
     (c) the **resulting changes structure** — the repo-tree-after-execution with the
     new/changed files and modules (`plan.md` §"Repo structure after execution").
     Then it waits for Oscar's explicit approval.
   - **No edits to implementation code (`src/**`, `package.json`, build config) until
     `plan.md` carries an `Approved:` line.** This is enforced by
     `.claude/hooks/guard-implementation.sh`.

3. **Implement** — the main agent creates the branch named in the plan
   (`{feature}/{ADVANCE}`, e.g. `feat/importers-M2`), then implements it slice by slice,
   running `npm run typecheck && npm run lint && npm run test` as it goes.

4. **Review** — `change-reviewer` writes `advances/<ADV>/review.md`, whose first line is
   `Verdict: PASS` or `Verdict: FAIL`. It may only write `review.md`
   (`.claude/hooks/guard-review-writes.sh`).

5. **Ship** — `git-ops` commits, pushes, and merges (`--no-ff`). Push/merge are blocked
   unless `review.md` is `Verdict: PASS` (`.claude/hooks/guard-git-ops.sh`).

## Fast-track (skip the ceremony)

The five-phase ritual is the **default** for every advance. Oscar can skip it for a
specific advance by saying so in chat — e.g. *"fast-track esto"* / *"sin ceremonia"* /
*"saltá la ceremonia"*. It is a per-advance, explicit call each time, not a standing
mode; say nothing and the full ritual applies.

What fast-track changes:
- **No `task-refiner`, `task-planner`, `change-reviewer`, or `git-ops` subagent runs.**
  The main agent does refine, plan, review, and ship itself, in conversation, sized to
  the change — a one-paragraph plan for a one-file fix, more if the change warrants it.
- **No `review.md` and no `Verdict: PASS` required before shipping.** The main agent
  reviews its own diff and may commit, push, and merge (`--no-ff`) directly, without
  `git-ops`. It still shows the exact push/merge commands before running them, the same
  discipline `git-ops` itself follows — merging to main is irreversible-enough to always
  eyeball first.

What fast-track does **not** change:
- **The `Approved:` gate stays exactly as-is.** `advances/<ADV>/plan.md` must still
  exist and still carry an `Approved: <name> <date>` line before any edit to `src/**`,
  `desktop/**`, `package.json`, or build config — `guard-implementation.sh` isn't aware
  of fast-track and still enforces this mechanically. The main agent writes that plan.md
  itself (skipping `task-planner`), but the **Approval marker** rule below is untouched:
  Oscar writes the line, or the agent does so solely on his explicit say-so — never on
  its own initiative, ceremony or not.
- Anything already in flight under the full ritual (an advance with a `refined.md`
  already approved at Gate R, say) stays on that path unless Oscar explicitly fast-tracks
  it too.

## Approval marker

At **Gate P**, approval is recorded as a single line at the top of `plan.md`:

```
Approved: Oscar 2026-07-17
```

**The agent never writes this line on its own.** It is added only after Oscar's explicit
approval — by Oscar, or by the agent solely on Oscar's explicit say-so. It is the one
signal that lifts the implementation gate, so treat it as Oscar's, not yours.

## Conventions

- Module-first layout: one bounded context per top-level `src/` folder, each with
  `domain / application / infra`. Clean architecture + DDD + hexagonal ports/adapters.
- `parseX` (parse-don't-validate → `Result`), total `createX` factories,
  `xxxErr(code, message)` per-context error constructors, tech-named adapters
  (`SqliteXRepository`, `FileX`, `OsX`), `XUseCase` classes implementing `UseCase`.
- Small, readable units — each line reads as an action; avoid class/method sprawl and
  oversized files. Tests per layer. Docs ship in the same commit as the code.
- No bare files at a layer's root. Every file inside a module's `domain/application/infra`
  lives in a subfolder that names its kind (`values/`, `services/`, `entities/`, `ports/`,
  `use-cases/`, `dto/`, `policies/`, …), so opening a folder tells you what's in it without
  reading the file. The only standing exceptions are the single, well-known per-module files
  already named above (`errors.ts`) and per-repo contracts (`shared/domain/result.ts`,
  `shared/application/use-case.ts`), plus tech-named `infra/` adapters (self-describing by
  name, e.g. `SqliteXRepository`, `FileX`). A new *kind* of thing — e.g. an application-layer
  policy that is neither a port nor a `UseCase` — gets its own new subfolder, never a loose
  file dropped next to the existing ones.
