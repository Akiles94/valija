---
title: Link a folder or repository to a project
theme: Working with context
---

## Who
The user, telling valija once which project a code folder or git repository belongs to.

## Why
So that commands run in that folder, and AI tools working in it, find the right project without
the user naming it every time.

## Business rules
- A link always points at an **existing** project; linking never creates one.
- By default a folder inside a git repository with a usable remote is linked by its repository
  (normalized `host/owner/repo`, credentials stripped), so every clone on every synced device
  resolves to the same project. Otherwise, or on request (`--by folder`), only the folder (and
  everything under it) is linked.
- The home folder and the filesystem root are too broad to link as a folder.
- A folder or repository can be linked to one project only; linking it again to the same project
  changes nothing.
- Links can be listed (with their ids) and removed by id, or by the folder they apply to.
- Links are user acts: AI tools cannot create or remove them through MCP.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The project does not exist ({{err:PROJECT_NOT_FOUND}}).
- The folder is not usable, or too broad to link ({{err:INVALID_WORKSPACE_PATH}}).
- A repository link was asked for but there is no usable remote ({{err:NO_GIT_REMOTE}}).
- The folder or repository is already linked to another project ({{err:BINDING_CONFLICT}}).
- The link to remove does not exist ({{err:BINDING_NOT_FOUND}}).

## Entry points
- CLI: {{cli:link}}, {{cli:unlink}}, {{cli:links}}
- Desktop: {{ipc:dialog:chooseProjectFolder}}, {{ipc:bindings:link}}, {{ipc:bindings:unlink}},
  {{ipc:bindings:list}} (linked folders & repositories on the project screen)

## Steps
1. [User → CLI] Runs `valija link demo-project` inside a code folder — {{linkCommand}}
2. [CLI → LinkWorkspace] Asks to link the current folder to the project — {{LinkWorkspace}}
3. [LinkWorkspace → Workspace probe] Resolves the folder and reads its git remote, without running git — {{FileWorkspaceProbe}}
4. [LinkWorkspace → LinkWorkspace] Picks the repository or the folder as the link target — {{chooseLinkTarget}}
5. [LinkWorkspace → Link store] Refuses a target linked elsewhere, else adds the link in one write — {{SqliteProjectBindingRepository}}
6. [CLI → User] Prints what was linked to which project
7. [User → CLI] Lists links with their ids, or removes one — {{ListProjectBindings}}
8. [CLI → UnlinkWorkspace] Removes the link by id or by folder — {{UnlinkWorkspace}}

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_FOUND}} — create the project first (save context to it, or import into it).
- {{err:INVALID_WORKSPACE_PATH}} — the folder does not exist, or is the home folder or disk root.
- {{err:NO_GIT_REMOTE}} — there is no usable remote; link the folder instead.
- {{err:BINDING_CONFLICT}} — unlink the existing link first.
- {{err:BINDING_NOT_FOUND}} — no link has that id, or none applies to this folder.
