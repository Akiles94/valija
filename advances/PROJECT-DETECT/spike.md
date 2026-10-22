# PROJECT-DETECT — Slice 0 spike: how each client tells a server where the work is (D-C)

**Status:** sections 1 and 4 are verified in this container; section 2 is **unverified** until Oscar
runs the probe in section 3 (P-1 (a): Slices 1–8 proceed on these assumptions; the review ran with the rows still
`ASSUMED`, and they are turned into `OBSERVED` in a follow-up commit, before merge, once Oscar runs
the probe).

This spike ran in a headless cloud container with no Claude Code, Claude Desktop or Cursor
installed, so it cannot observe the clients. It records what the SDK proves, labels everything else,
and hands Oscar a two-minute probe per client. The design works whichever way the answers fall
(section 4).

---

## 1. Verified from SDK source (this container)

SDK: `@modelcontextprotocol/sdk` **1.29.0** (`node_modules/@modelcontextprotocol/sdk/package.json`).
Paths below are under `node_modules/@modelcontextprotocol/sdk/dist/esm/`.

- **`Server.getClientCapabilities()` returns the client's declared capabilities after `initialize`.**
  `server/index.js:285-287` returns `this._clientCapabilities`, which the doc comment at `:283`
  describes as "populated with the client's reported capabilities" once initialization completes.
- **`Server.listRoots(params, options)` sends `roots/list`** (`server/index.js:405-407`:
  `this.request({ method: 'roots/list', params }, ListRootsResultSchema, options)`).
- **It throws when the client did not declare `roots`.** `assertCapabilityForMethod`,
  `server/index.js:163-166`: `case 'roots/list': if (!this._clientCapabilities?.roots) throw new
  Error("Client does not support listing roots (required for roots/list)")`. The server must
  therefore check the capability first, or catch.
- **`RequestOptions.timeout` bounds the wait.** `shared/protocol.js:712`:
  `const timeout = options?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC`, and `shared/protocol.js:8`
  sets that default to `60000` ms. The server can cap it (Slice 6 uses 2 s, A6).
- **`notifications/roots/list_changed` needs `roots.listChanged`.** `client/index.js:393-395`: a client
  refuses to send it unless it declared `roots.listChanged`; `client/index.js:620-621`
  (`sendRootsListChanged`) is the sender.
- **Over stdio the server inherits the `cwd` the client spawns it with.** `StdioServerTransport`
  reads `process.stdin`/`process.stdout` only; no MCP message sets or reports a working directory.
  `process.cwd()` is whatever the client chose when it spawned the process.

## 2. Unverified — from general knowledge, Oscar to confirm

Every cell is `ASSUMED` until the probe runs.

| Client | Server `process.cwd()` | Declares `roots`? | `roots/list` returns |
|---|---|---|---|
| Claude Code (CLI) | the directory `claude` was started in (the project) — ASSUMED | ASSUMED yes | ASSUMED one `file://` root, the project |
| Claude Desktop | `/` on macOS; an app dir on Windows — ASSUMED | ASSUMED no | n/a |
| Cursor | ASSUMED the user's home or the app dir, **not** the workspace | ASSUMED yes in recent versions | ASSUMED the open workspace folder(s) |

## 3. The probe Oscar runs locally

Save this as `/tmp/valija-roots-probe.mjs` in a folder where `@modelcontextprotocol/sdk` resolves
(for example, inside a checkout of this repo after `npm install`). It sends nothing anywhere; it only
appends one JSON line per call to `/tmp/valija-roots-probe.log`. **It is never committed under
`src/` and never published.**

```js
// valija-roots-probe.mjs — temporary MCP server: records cwd, capabilities, and roots/list.
import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const LOG = "/tmp/valija-roots-probe.log";
const server = new McpServer({ name: "valija-roots-probe", version: "0.0.0" });

async function rootsOrError() {
  try {
    return { roots: await server.server.listRoots({}, { timeout: 2000 }) };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e) };
  }
}

server.tool("probe", "Record where this server runs and what roots the client reports.", async () => {
  const line = {
    at: new Date().toISOString(),
    cwd: process.cwd(),
    client: server.server.getClientVersion(),
    capabilities: server.server.getClientCapabilities(),
    ...(await rootsOrError()),
  };
  appendFileSync(LOG, `${JSON.stringify(line)}\n`);
  return { content: [{ type: "text", text: "Recorded. See /tmp/valija-roots-probe.log." }] };
});

await server.connect(new StdioServerTransport());
```

Steps, per client (about two minutes each):

1. Add it as a **temporary** MCP server: command `node`, args `["/tmp/valija-roots-probe.mjs"]`.
   - Claude Code: `claude mcp add valija-probe -- node /tmp/valija-roots-probe.mjs`.
   - Claude Desktop: an entry under `mcpServers` in `claude_desktop_config.json`.
   - Cursor: an entry in `~/.cursor/mcp.json`.
2. Open a project folder in the client (for Claude Code, start `claude` inside it).
3. Ask the model to call the `probe` tool.
4. Copy the new log line into the table in section 2, replacing that row's `ASSUMED` cells.
5. Remove the temporary server from the client's config.

## 4. Robust to either outcome

What happens if each assumption is wrong:

- **A client declares roots** → roots are used and cwd is ignored.
- **A client declares roots but returns `[]`, errors, or times out** → fall back to the filtered cwd
  (P-2).
- **A client spawns the server in the workspace** → the filtered cwd works with no roots.
- **A client does neither** → detection yields `PROJECT_NOT_DETECTED`, and the model calls
  `list_projects` (today's behaviour plus a clearer message). `VALIJA_PROJECT` in a per-project client
  config (`.mcp.json`, `.cursor/mcp.json`) still works.
- **Walkthrough §2.2/§2.3 changes, the design does not** (D-C): only `README.md`, `docs/gui.md` and
  `specs/delivery.md` cite this table, and Slice 6 writes them from this file.

## 5. Recording the result

When Oscar runs the probe, the implementer replaces each `ASSUMED` with
`OBSERVED <date> <client version>` (the version comes from the log line's `client` field) and adjusts
`README.md`, `docs/gui.md` and `specs/delivery.md` in a follow-up commit on this branch, before
`change-reviewer` runs (P-1).
