import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../../context/application/use-cases/get-context-pack.use-case.js";
import { LinkWorkspace } from "../../context/application/use-cases/link-workspace.use-case.js";
import { ListProjects } from "../../context/application/use-cases/list-projects.use-case.js";
import { ResolveProject } from "../../context/application/use-cases/resolve-project.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { FileWorkspaceProbe } from "../../context/infra/file-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { buildMcpServer } from "./server.js";
import type { WorkspaceEnvironment } from "./workspace-directories.js";

/**
 * Detection end to end: a real vault, a real FileWorkspaceProbe over
 * hand-written `.git` folders (no `git` binary), and one real Client per
 * scenario over the in-memory transport — with and without declared roots.
 */
const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "valija-mcp-detect-")));
const probe = new FileWorkspaceProbe(join(tmp, "no-such-home"));
afterAll(() => {
  rmSync(vault.paths.root, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
});

const folder = (...segments: string[]) => {
  const dir = join(tmp, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
};
const repo = (name: string, url: string) => {
  const root = folder(name);
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git", "config"), `[remote "origin"]\n\turl = ${url}\n`);
  writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  return root;
};
const valijaRepo = repo("valija", "https://oscar:ghp_SECRETTOKEN@github.com/oscar/valija.git");
const acmeRepo = repo("acme", "git@github.com:acme/mono.git");
const valijaSrc = folder("valija", "src");
const home = folder("home");

const build = (envProject?: string) =>
  ({
    saveContext: new SaveContext(vault.sessions, clock, ids),
    listProjects: new ListProjects(vault.sessions),
    searchContext: new SearchContext(vault.sessions),
    getContextPack: new GetContextPack(vault.sessions, clock),
    showProject: new ShowProject(vault.sessions),
    resolveProject: new ResolveProject(vault.sessions, probe),
    linkWorkspace: new LinkWorkspace(vault.sessions, probe, clock, ids),
    ...(envProject === undefined ? {} : { envProject }),
  }) as unknown as Container;
const container = build();

for (const project of ["valija", "acme"]) {
  const seeded = container.saveContext.execute({ project, content: `seed for ${project}` });
  if (!seeded.ok) throw new Error(seeded.error.message);
}
for (const [project, directory] of [
  ["valija", valijaRepo],
  ["acme", acmeRepo],
] as const) {
  const linked = container.linkWorkspace.execute({ project, directory });
  if (!linked.ok) throw new Error(linked.error.message);
}

interface Scenario {
  /** Declared roots as folders; `undefined` = the client does not declare `roots` at all. */
  roots?: string[];
  cwd?: string;
  envProject?: string;
}

/** Every response text any scenario produced, for the privacy sweep (case 9). */
const seen: string[] = [];

async function connect({ roots, cwd = home, envProject }: Scenario) {
  const workspace: WorkspaceEnvironment = {
    cwd: () => cwd,
    home,
    platform: process.platform,
    execDir: join(tmp, "node-bin"),
    variables: {},
  };
  const client = new Client(
    { name: "detect-client", version: "1.0.0" },
    roots === undefined ? {} : { capabilities: { roots: {} } },
  );
  const rootCalls = { count: 0 };
  if (roots !== undefined) {
    client.setRequestHandler(ListRootsRequestSchema, async () => {
      rootCalls.count += 1;
      return { roots: roots.map((dir) => ({ uri: pathToFileURL(dir).href, name: "workspace" })) };
    });
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    buildMcpServer(build(envProject), workspace).connect(serverTransport),
    client.connect(clientTransport),
  ]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: Array<{ text?: string }>;
    };
    const text = result.content.map((c) => c.text ?? "").join("\n");
    seen.push(text);
    return { text, isError: result.isError === true };
  };
  return { client, call, rootCalls };
}

const itemCount = (project: string) => {
  const shown = container.showProject.execute({ project });
  return shown.ok ? shown.value.length : -1;
};

describe("MCP project detection (D-C, D-I)", () => {
  it("1. declared roots → a save lands in the linked project and says how it was detected", async () => {
    const { call, client } = await connect({ roots: [valijaRepo] });
    const before = itemCount("valija");
    const saved = await call("save_context", { content: "roots decide the project" });
    expect(saved.isError).toBe(false);
    expect(saved.text).toMatch(
      /^Saved fact to project "valija" \(detected: linked repository\)\. Item id: \S+\.$/,
    );
    expect(itemCount("valija")).toBe(before + 1);
    await client.close();
  });

  it("2. an explicit project wins, with today's exact text, and never asks for roots", async () => {
    const { call, client, rootCalls } = await connect({ roots: [valijaRepo] });
    const saved = await call("save_context", { project: "other", content: "explicit wins" });
    expect(saved.text).toMatch(
      /^Saved fact to project "other" \(project created\)\. Item id: \S+\.$/,
    );
    expect(itemCount("other")).toBe(1);
    const handoff = await call("save_handoff", { project: "other", content: "next: ship" });
    expect(handoff.text).toMatch(/^Handoff saved to project "other"\. Item id: \S+\.$/);
    expect(rootCalls.count).toBe(0);
    await client.close();
  });

  it("3. no roots, cwd inside a linked repository → get_context equals the explicit call byte for byte", async () => {
    const { call, client } = await connect({ cwd: valijaSrc });
    const detected = await call("get_context");
    const explicit = await call("get_context", { project: "valija" });
    expect(detected.isError).toBe(false);
    expect(detected.text).toContain("# Context pack: valija");
    expect(detected.text).toBe(explicit.text);
    await client.close();
  });

  it("4. no roots, cwd = home → PROJECT_NOT_DETECTED, telling the model to call list_projects", async () => {
    const { call, client } = await connect({ cwd: home });
    const r = await call("get_context");
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/\[PROJECT_NOT_DETECTED\]$/);
    expect(r.text).toContain("Call list_projects, ask the user which project they mean");
    const save = await call("save_handoff", { content: "nowhere to go" });
    expect(save.text).toMatch(/\[PROJECT_NOT_DETECTED\]$/);
    await client.close();
  });

  it("4b. roots declared but empty → falls back to the filtered cwd (P-2)", async () => {
    const { call, client, rootCalls } = await connect({ roots: [], cwd: valijaRepo });
    const saved = await call("save_handoff", { content: "empty roots, linked cwd" });
    expect(saved.text).toMatch(
      /^Handoff saved to project "valija" \(detected: linked repository\)\. Item id: \S+\.$/,
    );
    expect(rootCalls.count).toBe(1);
    await client.close();
  });

  it("5. two roots linked to two projects → PROJECT_AMBIGUOUS naming both slugs", async () => {
    const { call, client } = await connect({ roots: [valijaRepo, acmeRepo] });
    const r = await call("save_context", { content: "which one?" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/\[PROJECT_AMBIGUOUS\]$/);
    expect(r.text).toContain("acme, valija");
    await client.close();
  });

  it("6. VALIJA_PROJECT with no roots and a non-workspace cwd → used, and auto-creates (D-D)", async () => {
    const { call, client } = await connect({ cwd: home, envProject: "env-made" });
    const saved = await call("save_handoff", { content: "configured per client" });
    expect(saved.text).toMatch(
      /^Handoff saved to project "env-made" \(detected: VALIJA_PROJECT\)\. Item id: \S+\.$/,
    );
    expect(itemCount("env-made")).toBe(1);
    await client.close();
  });

  it("6b. VALIJA_PROJECT wins over the bindings of the roots, and over an unreadable cwd", async () => {
    const overRoots = await connect({ roots: [valijaRepo], envProject: "acme" });
    expect((await overRoots.call("save_context", { content: "env over roots" })).text).toMatch(
      /^Saved fact to project "acme" \(detected: VALIJA_PROJECT\)\./,
    );
    await overRoots.client.close();
    const stale = await connect({ cwd: join(tmp, "deleted-folder"), envProject: "acme" });
    const r = await stale.call("get_context");
    expect(r.isError).toBe(false);
    expect(r.text).toContain("# Context pack: acme");
    await stale.client.close();
  });

  it("7. list_projects marks the detected project (this workspace) on exactly one line", async () => {
    const bound = await connect({ roots: [acmeRepo] });
    const lines = (await bound.call("list_projects")).text.split("\n");
    const marked = lines.filter((line) => line.endsWith(" (this workspace)"));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatch(/^- acme: /);
    await bound.client.close();

    const env = await connect({ envProject: "valija" });
    const envMarked = (await env.call("list_projects")).text
      .split("\n")
      .filter((line) => line.endsWith(" (this workspace)"));
    expect(envMarked).toEqual([expect.stringMatching(/^- valija: /)]);
    await env.client.close();

    const nowhere = await connect({ cwd: home });
    const plain = await nowhere.call("list_projects");
    expect(plain.isError).toBe(false);
    expect(plain.text).not.toContain("(this workspace)");
    await nowhere.client.close();
  });

  it("8. a locked vault → VAULT_LOCKED for a detected call, with and without VALIJA_PROJECT", async () => {
    const bound = await connect({ roots: [valijaRepo] });
    const env = await connect({ cwd: home, envProject: "valija" });
    vault.keychain.deleteKey(vault.vaultId);
    try {
      expect((await bound.call("get_context")).text).toMatch(/\[VAULT_LOCKED\]$/);
      expect((await bound.call("save_context", { content: "x" })).text).toMatch(
        /\[VAULT_LOCKED\]$/,
      );
      expect((await env.call("save_handoff", { content: "x" })).text).toMatch(/\[VAULT_LOCKED\]$/);
    } finally {
      vault.keychain.setKey(vault.vaultId, vault.keyHex);
    }
    await bound.client.close();
    await env.client.close();
  });

  it("9. no response text contains a path, a remote, or a credential", () => {
    expect(seen.length).toBeGreaterThan(15);
    const all = seen.join("\n");
    for (const leak of [
      tmp,
      "github.com",
      "oscar/valija",
      "acme/mono",
      "SECRETTOKEN",
      "file:",
      "/src",
    ]) {
      expect(all).not.toContain(leak);
    }
  });

  it("10. /load-context renders with and without a project", async () => {
    const { client } = await connect({});
    const textOf = async (args: Record<string, string>) => {
      const prompt = await client.getPrompt({ name: "load-context", arguments: args });
      const first = prompt.messages[0]?.content;
      return first && "text" in first ? first.text : "";
    };
    expect(await textOf({ project: "valija" })).toMatch(
      /^Call get_context for the project "valija"\. Then:\n1\. /,
    );
    const detected = await textOf({});
    expect(detected).toMatch(/^Call get_context without a project; valija uses the project linked/);
    expect(detected).toContain("If it reports PROJECT_NOT_DETECTED, call list_projects");
    expect(detected).toContain("\n1. Summarize the current state");
    await client.close();
  });
});
