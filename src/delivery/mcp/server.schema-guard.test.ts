import { rmSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../../context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../../context/application/use-cases/list-projects.use-case.js";
import { ResolveProject } from "../../context/application/use-cases/resolve-project.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { LATEST_SCHEMA_VERSION } from "../../shared/infra/migrations.js";
import { FakeWorkspaceProbe } from "../../testing/fake-workspace-probe.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { buildMcpServer } from "./server.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const container = {
  paths: vault.paths,
  saveContext: new SaveContext(vault.sessions, clock, ids),
  listProjects: new ListProjects(vault.sessions),
  searchContext: new SearchContext(vault.sessions),
  getContextPack: new GetContextPack(vault.sessions, clock),
  resolveProject: new ResolveProject(vault.sessions, new FakeWorkspaceProbe()),
} as unknown as Container;
const client = new Client({ name: "vitest-client", version: "1.0.0" });

beforeAll(async () => {
  const seeded = container.saveContext.execute({ project: "mcp", content: "a decision" });
  if (!seeded.ok) throw new Error(seeded.error.message);
  setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION + 1);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    buildMcpServer(container).connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterAll(async () => {
  await client.close();
  rmSync(vault.paths.root, { recursive: true, force: true });
});

const CALLS: [string, Record<string, unknown>][] = [
  ["save_context", { project: "mcp", content: "another decision", type: "decision" }],
  ["save_handoff", { project: "mcp", content: "goal, done, next step" }],
  ["get_context", { project: "mcp" }],
  ["search_context", { query: "decision" }],
  ["list_projects", {}],
];

describe("every MCP tool refuses a vault upgraded by a newer valija (D-E)", () => {
  it.each(
    CALLS,
  )("%s → isError, [VAULT_SCHEMA_TOO_NEW], 'update valija', vault untouched", async (name, args) => {
    const before = snapshotVaultFiles(vault.paths);
    const result = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: { text?: string }[];
    };
    const text = result.content.map((c) => c.text ?? "").join("\n");

    expect(result.isError).toBe(true);
    expect(text).toContain("[VAULT_SCHEMA_TOO_NEW]");
    expect(text).toMatch(/update valija/i);
    expect(text).toMatch(/ask the user to update valija/);
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
    expect(vault.keychain.getKey(vault.vaultId)).toBe(vault.keyHex);
  });
});
