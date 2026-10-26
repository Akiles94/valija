import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveContext } from "../context/application/use-cases/save-context.use-case.js";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import type { DomainError, Result } from "../shared/domain/result.js";
import { makePassphraseVault, type PassphraseVault } from "../testing/passphrase-vault.js";
import { RecordingKeychain } from "../testing/recording-keychain.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock, SeqIds } from "../testing/test-vault.js";
import { contentChecksum } from "../testing/vault-content.js";
import { SessionGuard } from "../vault/application/policies/session-guard.js";
import { ChangePassphrase } from "../vault/application/use-cases/change-passphrase.use-case.js";
import { parseAutoLockTtl } from "../vault/domain/values/auto-lock-ttl.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { FileVaultFolder } from "../vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";
import { InMemoryKeychain } from "../vault/infra/in-memory-keychain.js";
import { type RekeyStage, SqliteVaultRekeyer } from "../vault/infra/sqlite-vault-rekeyer.js";
import { buildContainer, type Container } from "./container.js";
import { buildMcpServer } from "./mcp/server.js";
import { openVault } from "./sdk/index.js";

vi.mock("../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../testing/recording-keychain.js")).RecordingKeychain,
}));

const NEW_PASSPHRASE = "a different test phrase";
const tmp = mkdtempSync(join(tmpdir(), "valija-rekey-surfaces-"));
const originalEnv = { ...process.env };
let n = 0;

beforeEach(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${++n}`);
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

async function freshVault(): Promise<PassphraseVault> {
  return makePassphraseVault(join(tmp, `vault-${n}`));
}

async function changeThroughCli(c: Container, vault: PassphraseVault) {
  const result = await c.changePassphrase.execute({
    current: { passphrase: vault.passphrase },
    newPassphrase: NEW_PASSPHRASE,
    otherDevicesConfirmed: false,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** What an MCP client sees of this vault right now (the server.test.ts client pattern). */
async function mcpGetContext(c: Container, project: string): Promise<string> {
  const client = new Client({ name: "vitest-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([buildMcpServer(c).connect(serverTransport), client.connect(clientTransport)]);
  const result = (await client.callTool({ name: "get_context", arguments: { project } })) as {
    content: Array<{ text?: string }>;
  };
  await client.close();
  return result.content.map((part) => part.text ?? "").join("\n");
}

describe("change-passphrase across surfaces (REKEY §2.2, §2.5, §8.5)", () => {
  it("1. MCP keeps working right after the change, with no re-unlock: the keychain holds the new key", async () => {
    const vault = await freshVault();
    const c = buildContainer({ vaultRoot: vault.paths.root });
    expect((await c.unlockVault.execute({ passphrase: vault.passphrase })).ok).toBe(true);
    expect(c.saveContext.execute({ project: "acme", content: "the zebrafish decision" }).ok).toBe(
      true,
    );

    const changed = await changeThroughCli(c, vault);

    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(changed.keyHex);
    const text = await mcpGetContext(c, "acme");
    expect(text).not.toContain("[VAULT_LOCKED]");
    expect(text).toContain("zebrafish");
  });

  it("2. a Mode P SDK handle gets VAULT_LOCKED; the change wrote only the OS keychain, never the SDK's", async () => {
    const vault = await freshVault();
    const handle = await openVault({
      client: "acme-notes",
      vaultRoot: vault.paths.root,
      passphrase: vault.passphrase,
    });
    if (!handle.ok) throw new Error(handle.error.message);
    expect((await handle.value.save({ project: "acme", content: "before" })).ok).toBe(true);
    RecordingKeychain.clearRecord();
    const inMemorySet = vi.spyOn(InMemoryKeychain.prototype, "setKey");

    await changeThroughCli(buildContainer({ vaultRoot: vault.paths.root }), vault);
    const search = await handle.value.search({ query: "before" });

    expect(search.ok ? "ok" : search.error.code).toBe("VAULT_LOCKED");
    expect(RecordingKeychain.calls).toEqual([{ method: "setKey", vaultId: vault.vaultId }]);
    expect(inMemorySet).not.toHaveBeenCalled();
    await handle.value.close();
  });

  it("3. no SDK export can change a passphrase (D-N)", async () => {
    const exports = Object.keys(await import("./sdk/index.js"));
    expect(exports.filter((name) => /passphrase|rekey/i.test(name))).toEqual([]);
  });

  it("4. a session holding the old key during the change waits, fails, never writes — then fails closed", async () => {
    const vault = await freshVault();
    const ids = new SeqIds();
    const clock = new FixedClock();
    const oldKeychain = new FakeKeychain();
    oldKeychain.setKey(vault.vaultId, vault.keyHex);
    const identity = new FakeDeviceIdentity(ids);
    const guard = new SessionGuard(identity, oldKeychain, clock, parseAutoLockTtl(undefined));
    const sessions = new SqliteVaultSessions(vault.paths, oldKeychain, identity, guard, ids, clock);
    const oldKeySave = new SaveContext(sessions, clock, ids);
    expect(oldKeySave.execute({ project: "acme", content: "seed" }).ok).toBe(true);
    const before = contentChecksum(vault.paths.db, vault.keyHex);

    let during: Result<unknown, DomainError> | undefined;
    const onStage = (stage: RekeyStage) => {
      if (stage === "rekeying") during = oldKeySave.execute({ project: "acme", content: "racing" });
    };
    const changePassphrase = new ChangePassphrase(
      new FileVaultStore(vault.paths, ids, clock),
      new Argon2VaultCrypto(),
      new FakeKeychain(), // this surface's own keychain, not the racing session's
      new FileVaultFolder(vault.paths),
      new FakeDeviceIdentity(ids),
      new SqliteVaultRekeyer(vault.paths, ids, clock, onStage),
      clock,
    );
    const changed = await changePassphrase.execute({
      current: { passphrase: vault.passphrase },
      newPassphrase: NEW_PASSPHRASE,
      otherDevicesConfirmed: false,
    });

    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(during?.ok).toBe(false);
    expect(["STORAGE_ERROR", "VAULT_LOCKED"]).toContain(
      during !== undefined && !during.ok ? during.error.code : "",
    );
    expect(contentChecksum(vault.paths.db, changed.value.keyHex)).toBe(before);

    const after = oldKeySave.execute({ project: "acme", content: "still racing" });
    expect(after.ok ? "ok" : after.error.code).toBe("VAULT_LOCKED");
    expect(oldKeychain.getKey(vault.vaultId)).toBeNull();
    expect(contentChecksum(vault.paths.db, changed.value.keyHex)).toBe(before);
  }, 20_000);
});
