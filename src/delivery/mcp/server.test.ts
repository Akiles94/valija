import { rmSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../../context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../../context/application/use-cases/list-projects.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { ok } from "../../shared/domain/result.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import { CreateVault } from "../../vault/application/use-cases/create-vault.use-case.js";
import { LockVault } from "../../vault/application/use-cases/lock-vault.use-case.js";
import { UnlockVault } from "../../vault/application/use-cases/unlock-vault.use-case.js";
import { VaultStatus } from "../../vault/application/use-cases/vault-status.use-case.js";
import { Argon2VaultCrypto } from "../../vault/infra/argon2.js";
import type { Container } from "../container.js";
import { buildMcpServer } from "./server.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const crypto = new Argon2VaultCrypto();

const container: Container = {
  paths: vault.paths,
  createVault: new CreateVault(vault.store, crypto, vault.keychain, clock, ids),
  unlockVault: new UnlockVault(vault.store, crypto, vault.keychain),
  lockVault: new LockVault(vault.store, vault.keychain),
  vaultStatus: new VaultStatus(vault.store, vault.keychain),
  saveContext: new SaveContext(vault.sessions, clock, ids),
  listProjects: new ListProjects(vault.sessions),
  searchContext: new SearchContext(vault.sessions),
  getContextPack: new GetContextPack(vault.sessions, clock),
  showProject: new ShowProject(vault.sessions),
};

const client = new Client({ name: "vitest-client", version: "1.0.0" });

beforeAll(async () => {
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

const textOf = (result: unknown): string => {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  return content.map((c) => c.text ?? "").join("\n");
};

describe("valija MCP server (real client over in-memory transport)", () => {
  it("exposes exactly the 5 tools and 2 prompts", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual([
      "get_context",
      "list_projects",
      "save_context",
      "save_handoff",
      "search_context",
    ]);
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((p) => p.name).sort()).toEqual(["load-context", "save-context"]);
  });

  it("save_context captures the MCP client name as source", async () => {
    const result = await client.callTool({
      name: "save_context",
      arguments: {
        project: "mcp-e2e",
        content: "we validated the mcp server end to end",
        type: "progress",
        tags: ["mcp", "testing"],
      },
    });
    expect(textOf(result)).toContain('Saved progress to project "mcp-e2e"');

    const shown = container.showProject.execute({ project: "mcp-e2e" });
    expect(shown.ok).toBe(true);
    // source flows from the client's declared name
    const raw = vault.sessions.withSession((session) => {
      const project = session.projects.findByName("mcp-e2e" as never) as { id: string };
      return ok(session.items.findByProject(project.id));
    });
    expect(raw.ok && raw.value[0]?.source).toBe("vitest-client");
  });

  it("save_handoff forces the handoff type", async () => {
    await client.callTool({
      name: "save_handoff",
      arguments: { project: "mcp-e2e", content: "goal: ship. next: publish to npm." },
    });
    const shown = container.showProject.execute({ project: "mcp-e2e", type: "handoff" });
    expect(shown.ok && shown.value).toHaveLength(1);
  });

  it("get_context returns the assembled pack", async () => {
    const result = await client.callTool({
      name: "get_context",
      arguments: { project: "mcp-e2e" },
    });
    const text = textOf(result);
    expect(text).toContain("# Context pack: mcp-e2e");
    expect(text).toContain("Latest handoff");
    expect(text).toContain("we validated the mcp server");
  });

  it("search_context finds items; list_projects lists them", async () => {
    const search = await client.callTool({
      name: "search_context",
      arguments: { query: "validated" },
    });
    expect(textOf(search)).toContain("mcp-e2e");
    const list = await client.callTool({ name: "list_projects", arguments: {} });
    expect(textOf(list)).toContain("mcp-e2e");
  });

  it("rejects invalid input via zod (unknown type)", async () => {
    const result = await client.callTool({
      name: "save_context",
      arguments: { project: "mcp-e2e", content: "x", type: "not-a-type" },
    });
    expect(result.isError).toBe(true);
  });

  it("returns the uniform locked-vault error when locked", async () => {
    vault.keychain.deleteKey(vault.vaultId);
    const result = await client.callTool({
      name: "get_context",
      arguments: { project: "mcp-e2e" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Vault is locked. Ask the user to run "valija unlock"');
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("prompts render with the project argument", async () => {
    const prompt = await client.getPrompt({
      name: "load-context",
      arguments: { project: "mcp-e2e" },
    });
    const first = prompt.messages[0]?.content;
    expect(first && "text" in first && first.text).toContain('"mcp-e2e"');
  });
});
