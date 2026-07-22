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
