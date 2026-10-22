import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makePassphraseVault, TEST_PASSPHRASE } from "../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../testing/recording-keychain.js";
import { buildContainer, type Container } from "../container.js";
import { buildMcpServer } from "../mcp/server.js";
import { createVault, openVault } from "./index.js";

vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-isolation-"));
const originalEnv = { ...process.env };
let n = 0;
const CLIENT = "acme-notes";

beforeEach(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${++n}`);
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
});

afterAll(() => {
  process.env = originalEnv;
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
});

/** What an MCP client sees of this vault right now. */
async function mcpGetContext(c: Container, project: string): Promise<string> {
  const client = new Client({ name: "vitest-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([buildMcpServer(c).connect(serverTransport), client.connect(clientTransport)]);
  const result = (await client.callTool({ name: "get_context", arguments: { project } })) as {
    content: Array<{ text?: string }>;
  };
  await client.close();
  return result.content.map((c) => c.text ?? "").join("\n");
}

/** §11.1: the OS keychain was neither constructed nor called. */
const expectOsKeychainUntouched = () => {
  expect(RecordingKeychain.constructions).toBe(0);
  expect(RecordingKeychain.calls).toEqual([]);
};

/** After an in-process unlock, every other surface still sees a locked vault. */
async function expectOtherSurfacesLocked(root: string) {
  const cli = buildContainer({ vaultRoot: root });
  const status = cli.vaultStatus.execute();
  expect(status.ok && status.value.unlocked).toBe(false);
  expect(await mcpGetContext(cli, "acme")).toContain("[VAULT_LOCKED]");
}

describe("Mode P never touches the OS keychain (§11.1)", () => {
  it("open, saves, lock, a second open, close and proactive expiry: zero constructions, zero calls", async () => {
    process.env.VALIJA_AUTOLOCK_MINUTES = "1";
    const vault = await makePassphraseVault(join(tmp, `vault-${n}`));
    const options = { client: CLIENT, vaultRoot: vault.paths.root, passphrase: TEST_PASSPHRASE };
    const one = await openVault(options);
    if (!one.ok) throw new Error(one.error.message);
    await one.value.save({ project: "acme", content: "c" });
    await one.value.saveHandoff({ project: "acme", content: "h" });
    await one.value.getContextPack({ project: "acme" });
    await one.value.search({ query: "c" });
    await one.value.listProjects();
    await one.value.lock();
    await one.value.close();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const two = await openVault({
      ...options,
      recoveryKey: vault.keyHex,
      passphrase: undefined,
    } as never);
    if (!two.ok) throw new Error(two.error.message);
    vi.advanceTimersByTime(60_000);
    vi.useRealTimers();
    expect((await two.value.listProjects()).ok).toBe(false);

    expectOsKeychainUntouched();
    await expectOtherSurfacesLocked(vault.paths.root);
  });

  it("createVault and its handle: zero constructions, zero calls; the CLI and MCP stay locked", async () => {
    const root = join(tmp, `vault-${n}`);
    const created = await createVault({
      client: CLIENT,
      vaultRoot: root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.vault.mode).toBe("in-process");
    await created.value.vault.save({ project: "acme", content: "c" });
    await created.value.vault.close();
    expectOsKeychainUntouched();
    await expectOtherSurfacesLocked(root);
  });

  it("an OS-keychain session still auto-locks on schedule while a Mode P handle is busy (⚑ D-A.3)", async () => {
    const vault = await makePassphraseVault(join(tmp, `vault-${n}`));
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const cli = buildContainer({ vaultRoot: vault.paths.root });
    cli.deviceIdentity.recordActivity(vault.vaultId, new Date(Date.now() - 16 * 60_000));
    const p = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!p.ok) throw new Error(p.error.message);
    for (let i = 0; i < 3; i++)
      expect((await p.value.save({ project: "acme", content: `${i}` })).ok).toBe(true);

    const locked = cli.listProjects.execute();
    expect(!locked.ok && locked.error.code).toBe("VAULT_LOCKED");
    expect(RecordingKeychain.store.has(vault.vaultId)).toBe(false);
    expect((await p.value.listProjects()).ok).toBe(true);
  });
});

describe("Mode K reads the key and never writes it (§11.2)", () => {
  it("setKey is never called; deleteKey only by lock()", async () => {
    const vault = await makePassphraseVault(join(tmp, `vault-${n}`));
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const k = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!k.ok) throw new Error(k.error.message);
    await k.value.save({ project: "acme", content: "c" });
    await k.value.saveHandoff({ project: "acme", content: "h" });
    await k.value.getContextPack({ project: "acme" });
    await k.value.search({ query: "c" });
    await k.value.listProjects();
    await k.value.close();
    const methods = () => RecordingKeychain.calls.map((call) => call.method);
    expect(methods()).not.toContain("setKey");
    expect(methods()).not.toContain("deleteKey");
    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(vault.keyHex);

    const again = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!again.ok) throw new Error(again.error.message);
    await again.value.lock();
    expect(methods().filter((m) => m === "deleteKey")).toHaveLength(1);
    expect(methods()).not.toContain("setKey");
  });
});
