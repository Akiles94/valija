import { rmSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../../context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../../context/application/use-cases/list-projects.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { ONE_PER_TIER, PLANTED } from "../../testing/fake-secrets.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { buildMcpServer } from "./server.js";

/**
 * SECRET-WARN over MCP (D-B, D-N): a save with a possible secret is refused
 * with advice for the model, never an override, and nothing is written.
 */
const vault = makeUnlockedVault();
const clock = new FixedClock();
const container = {
  saveContext: new SaveContext(vault.sessions, clock, new SeqIds()),
  listProjects: new ListProjects(vault.sessions),
  searchContext: new SearchContext(vault.sessions),
  getContextPack: new GetContextPack(vault.sessions, clock),
  showProject: new ShowProject(vault.sessions),
} as unknown as Container;
const client = new Client({ name: "secrets-client", version: "1.0.0" });

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

const call = async (name: string, args: Record<string, unknown>) => {
  const result = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ text?: string }>;
  };
  return { text: result.content.map((c) => c.text ?? "").join("\n"), isError: result.isError };
};

const seed = (content: string) => {
  const r = container.saveContext.execute({ project: "seeded", content });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const itemCount = (project: string) => {
  const shown = container.showProject.execute({ project });
  return shown.ok ? shown.value.length : -1;
};

/** One planted value per tier, each on line 2 of its content. */
const PER_TIER = [
  { content: `deploy notes\nkey ${PLANTED.awsAccessKey}`, label: "AWS access key (line 2)" },
  {
    content: `db notes\n${PLANTED.credentialAssignment.line}`,
    label: "credential assignment (line 2)",
  },
  { content: `cache notes\nvalue ${PLANTED.highEntropy}`, label: "high-entropy string (line 2)" },
];

describe("MCP save tools refuse possible secrets (SECRET-WARN)", () => {
  it("names the kind and line and suggests a placeholder, for every tier", async () => {
    for (const { content, label } of PER_TIER) {
      const r = await call("save_context", { project: "refused", content });
      expect(r.isError).toBe(true);
      expect(r.text).toBe(
        `The content looks like it contains a secret — ${label}. Nothing was saved. ` +
          "Remove it or replace it with a placeholder such as <API_KEY>, then call the tool again. " +
          "If it is not a secret, describe it instead of quoting it. [POSSIBLE_SECRET]",
      );
      expect(r.text).toContain("placeholder");
      expect(r.text).toContain("describe it");
    }
  });

  it("never offers an override and never echoes the secret", async () => {
    for (const { content } of PER_TIER) {
      const r = await call("save_context", { project: "refused", content });
      expect(r.text).not.toMatch(/allow|override|anyway|--allow-secrets|force/i);
      for (const secret of ONE_PER_TIER) expect(r.text).not.toContain(secret);
    }
  });

  it("writes nothing: no new project, no new item", async () => {
    const before = itemCount("seeded");
    await call("save_context", { project: "never-created", content: PER_TIER[0]?.content });
    await call("save_context", { project: "seeded", content: PER_TIER[1]?.content });
    const projects = await call("list_projects", {});
    expect(projects.text).not.toContain("never-created");
    expect(itemCount("seeded")).toBe(before);
  });

  it("a refused supersedes save leaves the target live", async () => {
    const target = seed("the okapi decision");
    const r = await call("save_context", {
      project: "seeded",
      content: PER_TIER[0]?.content,
      supersedes: target,
    });
    expect(r.isError).toBe(true);
    const found = await call("search_context", { query: "okapi", project: "seeded" });
    expect(found.text).toContain(target);
  });

  it("save_handoff refuses the same way", async () => {
    const r = await call("save_handoff", { project: "refused", content: PER_TIER[0]?.content });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("AWS access key (line 2)");
    expect(r.text).toMatch(/<API_KEY>.*\[POSSIBLE_SECRET\]$/);
    expect(r.text).not.toMatch(/allow|override|anyway|force/i);
  });

  it("a clean save replies exactly as before", async () => {
    const r = await call("save_context", { project: "clean", content: "a plain note" });
    expect(r.isError).toBeUndefined();
    expect(r.text).toMatch(/^Saved fact to project "clean" \(project created\)\. Item id: \S+\.$/);
  });

  it("the surface did not grow: 5 tools, 2 prompts, a warning sentence on both save tools", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(5);
    const { prompts } = await client.listPrompts();
    expect(prompts).toHaveLength(2);
    for (const name of ["save_context", "save_handoff"]) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.description).toContain("refused with POSSIBLE_SECRET and nothing is saved.");
      expect(Object.keys(tool?.inputSchema.properties ?? {})).not.toContain("allowSecrets");
    }
  });
});
