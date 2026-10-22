import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makePassphraseVault,
  type PassphraseVault,
  TEST_PASSPHRASE,
} from "../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../testing/recording-keychain.js";
import { showCommand } from "../cli/content-commands.js";
import { buildContainer, type Container } from "../container.js";
import { buildMcpServer } from "../mcp/server.js";
import { createVault, openVault, type ValijaVault } from "./index.js";

vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-round-trip-"));
const originalEnv = { ...process.env };
let n = 0;
const CLIENT = "acme-notes";

let vault: PassphraseVault;
let cli: Container;
let mcp: Client;

beforeEach(async () => {
  RecordingKeychain.reset();
  n += 1;
  process.env.HOME = join(tmp, `home-${n}`);
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${n}`);
  delete process.env.VALIJA_HOME;
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
  vault = await makePassphraseVault(join(tmp, `vault-${n}`));
  // The user ran `valija unlock`: the key is in the (fake) OS keychain.
  RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
  cli = buildContainer({ vaultRoot: vault.paths.root });
  mcp = new Client({ name: "claude-code", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([buildMcpServer(cli).connect(serverTransport), mcp.connect(clientTransport)]);
});

afterEach(async () => {
  await mcp.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

async function modeK(): Promise<ValijaVault> {
  const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

async function tool(name: string, args: Record<string, unknown>): Promise<string> {
  const result = (await mcp.callTool({ name, arguments: args })) as {
    content: Array<{ text?: string }>;
  };
  return result.content.map((c) => c.text ?? "").join("\n");
}

/** What `valija show <project>` prints. */
function cliShow(c: Container, project: string): string {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
  showCommand(c, project, {});
  vi.restoreAllMocks();
  return lines.join("\n");
}

describe("SDK writes reach every surface", () => {
  it("a Mode K save and handoff show in valija show, MCP get_context and search_context, with source = client", async () => {
    const sdk = await modeK();
    const saved = await sdk.save({
      project: "acme",
      content: "We ship offline mode first.",
      type: "decision",
    });
    const handoff = await sdk.saveHandoff({
      project: "acme",
      content: "Next: write the sync spec.",
    });
    if (!saved.ok || !handoff.ok) throw new Error("save failed");

    const shown = cliShow(cli, "acme");
    expect(shown).toContain("We ship offline mode first.");
    expect(shown).toContain(`id ${saved.value.itemId}`);
    const items = cli.showProject.execute({ project: "acme" });
    expect(items.ok && items.value.map((i) => i.source)).toEqual([CLIENT, CLIENT]);

    const pack = await tool("get_context", { project: "acme" });
    expect(pack).toContain("We ship offline mode first.");
    expect(pack).toContain("Next: write the sync spec.");
    expect(await tool("search_context", { query: "offline" })).toContain(
      `id ${saved.value.itemId}`,
    );
  });

  it("a Mode P save is visible the same way", async () => {
    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!r.ok) throw new Error(r.error.message);
    await r.value.save({ project: "acme", content: "Mode P wrote this." });
    expect(cliShow(cli, "acme")).toContain("Mode P wrote this.");
    expect(await tool("get_context", { project: "acme" })).toContain("Mode P wrote this.");
  });
});

describe("CLI and MCP writes reach the SDK", () => {
  it("search and the pack see them; the pack is byte-equal to get_context; listProjects matches list_projects", async () => {
    cli.saveContext.execute({
      project: "acme",
      content: "CLI decided on SQLite.",
      type: "decision",
    });
    await tool("save_context", {
      project: "acme",
      content: "MCP noted the offline plan.",
      type: "fact",
    });
    await tool("save_handoff", { project: "beta", content: "Handoff from Claude." });
    const sdk = await modeK();

    const hits = await sdk.search({ query: "SQLite" });
    expect(hits.ok && hits.value.map((h) => h.content)).toEqual(["CLI decided on SQLite."]);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date()); // frozen at the real now, so the idle clock stays honest
    const pack = await sdk.getContextPack({ project: "acme" });
    const fromMcp = await tool("get_context", { project: "acme" });
    expect(pack.ok && pack.value.markdown).toBe(fromMcp);
    const budgeted = await sdk.getContextPack({ project: "acme", budgetTokens: 50 });
    expect(budgeted.ok && budgeted.value.markdown).toBe(
      await tool("get_context", { project: "acme", budget: 50 }),
    );
    vi.useRealTimers();

    const projects = await sdk.listProjects();
    if (!projects.ok) throw new Error(projects.error.message);
    const asMcpLines = projects.value
      .map(
        (p) =>
          `- ${p.name}: ${p.itemCount} item(s), last activity ${p.lastActivityAt?.slice(0, 10) ?? "never"}`,
      )
      .join("\n");
    expect(asMcpLines).toBe(await tool("list_projects", {}));
  });
});

describe("createVault → the CLI opens it", () => {
  it("valija unlock works with the same passphrase and with the kit's recovery key", async () => {
    const root = join(tmp, `created-${n}`);
    const created = await createVault({
      client: CLIENT,
      vaultRoot: root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!created.ok) throw new Error(created.error.message);
    await created.value.vault.save({ project: "acme", content: "Saved at creation." });
    await created.value.vault.close();
    const recoveryKeyHex = created.value.recoveryKit.match(/\b[0-9a-f]{64}\b/)?.[0] ?? "";

    const c = buildContainer({ vaultRoot: root });
    const byPassphrase = await c.unlockVault.execute({
      passphrase: TEST_PASSPHRASE,
      upgradeConfirmed: true,
    });
    expect(byPassphrase.ok && byPassphrase.value.vaultId).toBe(created.value.vaultId);
    expect(cliShow(c, "acme")).toContain("Saved at creation.");
    c.lockVault.execute();

    const byKit = await c.unlockVault.execute({ recoveryKeyHex, upgradeConfirmed: true });
    expect(byKit.ok).toBe(true);
    const status = c.vaultStatus.execute();
    expect(status.ok && status.value.unlocked).toBe(true);
  });
});

describe("where the SDK looks, and what it leaves on disk", () => {
  /** Every file under `dir`, relative. */
  function filesUnder(dir: string, prefix = ""): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory()
        ? filesUnder(path, `${prefix}${entry}/`)
        : [`${prefix}${entry}`];
    });
  }

  it("resolution order: vaultRoot, then VALIJA_HOME, then ~/.valija (D-C)", async () => {
    const home = process.env.HOME as string;
    mkdirSync(home, { recursive: true });
    const inHome = await makePassphraseVault(join(home, ".valija"));
    const inEnv = await makePassphraseVault(join(tmp, `env-${n}`));
    const vaultIdOf = async (options: { vaultRoot?: string }) => {
      const r = await openVault({ client: CLIENT, ...options });
      return r.ok ? r.value.vaultId : r.error.code;
    };
    expect(await vaultIdOf({})).toBe(inHome.vaultId);
    process.env.VALIJA_HOME = inEnv.paths.root;
    expect(await vaultIdOf({})).toBe(inEnv.vaultId);
    expect(await vaultIdOf({ vaultRoot: vault.paths.root })).toBe(vault.vaultId);
  });

  it("creates only vault.json, vault.db and state.json — no kit file, no sidecar, nothing else", async () => {
    const root = join(tmp, `only-${n}`);
    const created = await createVault({
      client: CLIENT,
      vaultRoot: root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!created.ok) throw new Error(created.error.message);
    await created.value.vault.save({ project: "acme", content: "c" });
    await created.value.vault.getContextPack({ project: "acme" });
    await created.value.vault.close();
    const reopened = await openVault({
      client: CLIENT,
      vaultRoot: root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!reopened.ok) throw new Error(reopened.error.message);
    await reopened.value.saveHandoff({ project: "acme", content: "h" });
    await reopened.value.close();

    expect(filesUnder(root).sort()).toEqual(["vault.db", "vault.json"]);
    const state = process.env.VALIJA_STATE_HOME as string;
    expect(filesUnder(state)).toEqual(["state.json"]);
    const kitText = created.value.recoveryKit.match(/\b[0-9a-f]{64}\b/)?.[0] ?? "";
    for (const file of filesUnder(tmp)) {
      if (file.endsWith(".json"))
        expect(readFileSync(join(tmp, file), "utf8")).not.toContain(kitText);
    }
  });
});
