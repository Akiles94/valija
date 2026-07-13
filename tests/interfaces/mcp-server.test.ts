import { rmSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreateVault } from "../../src/application/usecases/create-vault.js";
import { ExportPack } from "../../src/application/usecases/export-pack.js";
import { GetContextPack } from "../../src/application/usecases/get-context-pack.js";
import { ListProjects } from "../../src/application/usecases/list-projects.js";
import { LockVault } from "../../src/application/usecases/lock-vault.js";
import { SaveContext } from "../../src/application/usecases/save-context.js";
import { SearchContext } from "../../src/application/usecases/search-context.js";
import { ShowProject } from "../../src/application/usecases/show-project.js";
import { UnlockVault } from "../../src/application/usecases/unlock-vault.js";
import { VaultStatus } from "../../src/application/usecases/vault-status.js";
import { Argon2VaultCrypto } from "../../src/infrastructure/crypto/argon2.js";
import type { Container } from "../../src/interfaces/container.js";
import { buildMcpServer } from "../../src/interfaces/mcp/server.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../helpers/test-vault.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const crypto = new Argon2VaultCrypto();
const getContextPack = new GetContextPack(vault.factory, clock);

const container: Container = {
  paths: vault.paths,
  createVault: new CreateVault(vault.store, crypto, vault.keychain, clock, ids),
  unlockVault: new UnlockVault(vault.store, crypto, vault.keychain),
  lockVault: new LockVault(vault.store, vault.keychain),
  vaultStatus: new VaultStatus(vault.store, vault.keychain),
  saveContext: new SaveContext(vault.factory, clock, ids),
  listProjects: new ListProjects(vault.factory),
  searchContext: new SearchContext(vault.factory),
  getContextPack,
  exportPack: new ExportPack(vault.factory, getContextPack),
  showProject: new ShowProject(vault.factory),
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

    const shown = container.showProject.execute("mcp-e2e");
    expect(shown.ok).toBe(true);
    // source flows from the client's declared name
    const items = vault.factory.open();
    if (items.ok) {
      const raw = items.value.items.findByProject(
        (items.value.projects.findByName("mcp-e2e" as never) as { id: string }).id,
      );
      expect(raw[0]?.source).toBe("vitest-client");
      items.value.close();
    }
  });

  it("save_handoff forces the handoff type", async () => {
    await client.callTool({
      name: "save_handoff",
      arguments: { project: "mcp-e2e", content: "goal: ship. next: publish to npm." },
    });
    const shown = container.showProject.execute("mcp-e2e", "handoff");
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
