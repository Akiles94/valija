---
title: Detect the project from the working folder
theme: Working with context
---

## Who
The user running `valija show` or `valija export` without a project, and AI tools calling the MCP
tools without one.

## Why
So that the project a folder is linked to is used automatically, while a project named
explicitly always wins.

## Business rules
- An explicitly given project is always used as is; detection only runs when it is omitted.
- Detection order: the `VALIJA_PROJECT` environment variable, then the deepest linked folder that
  contains the working folder, then the linked repository the folder belongs to.
- The CLI detects from its current folder (or `--dir` for `valija which`); the MCP server from the
  folders the AI client declares as roots, else from where it was started.
- If several workspace folders resolve to different projects, nothing is guessed. If none
  resolves, the user (or the AI, by asking the user) must name the project. Detection never
  creates a project and never runs `git`.
- MCP responses say only how a project was detected (linked folder, linked repository or
  `VALIJA_PROJECT`), never a path or a remote.
- `valija which` and the desktop inspect panel show what a folder resolves to and why.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- No project is linked to the folder ({{err:PROJECT_NOT_DETECTED}}).
- The workspace folders are linked to different projects ({{err:PROJECT_AMBIGUOUS}}).
- `VALIJA_PROJECT` is not a valid project name ({{err:INVALID_PROJECT_NAME}}).
- The folder is not usable ({{err:INVALID_WORKSPACE_PATH}}).

## Entry points
- CLI: {{cli:which}} (and `show`/`export` without a project)
- Desktop: {{ipc:bindings:inspect}} (choose a folder on the project screen to see what it resolves to)
- MCP: the project argument of {{mcp:get_context}}, {{mcp:save_context}} and {{mcp:save_handoff}} is optional

## Steps
1. [User → CLI] Runs `valija which` (or `valija show` with no project) — {{whichCommand}}
2. [CLI → Project detection] Uses an explicit project as is, else asks to resolve the folder — {{chooseProject}}
3. [Project detection → ResolveProject] Asks which project the folder belongs to — {{ResolveProject}}
4. [ResolveProject → Workspace probe] Locates the folder and its repository remote — {{FileWorkspaceProbe}}
5. [ResolveProject → ResolveProject] Applies `VALIJA_PROJECT`, then the deepest folder link, then the repository link — {{resolveFromBindings}}
6. [CLI → User] Prints the project and why, or what is missing

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_DETECTED}} — pass a project name, or link this folder with `valija link`.
- {{err:PROJECT_AMBIGUOUS}} — name the project; the workspace's folders disagree.
- {{err:INVALID_PROJECT_NAME}} — `VALIJA_PROJECT` is not a valid project slug.
- {{err:INVALID_WORKSPACE_PATH}} — the folder does not exist or cannot be read.
