import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { SaveContext } from "../context/application/use-cases/save-context.use-case.js";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { makePassphraseVault } from "../testing/passphrase-vault.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock, SeqIds } from "../testing/test-vault.js";
import { SessionGuard } from "../vault/application/policies/session-guard.js";
import { ChangePassphrase } from "../vault/application/use-cases/change-passphrase.use-case.js";
import { LockVault } from "../vault/application/use-cases/lock-vault.use-case.js";
import { UnlockVault } from "../vault/application/use-cases/unlock-vault.use-case.js";
import { parseAutoLockTtl } from "../vault/domain/values/auto-lock-ttl.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { FileVaultFolder } from "../vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";
import { SqliteVaultRekeyer } from "../vault/infra/sqlite-vault-rekeyer.js";
import { promptHidden } from "./cli/prompt.js";
import { unlockCommand } from "./cli/vault-commands.js";
import type { Container } from "./container.js";

vi.mock("./cli/prompt.js", () => ({ promptHidden: vi.fn(), promptLine: vi.fn() }));

const NEW_PASSPHRASE = "a different test phrase";
const root = mkdtempSync(join(tmpdir(), "valija-rekey-multi-device-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());

/** One simulated device: its own copy of the vault folder, keychain and device identity. */
function makeDevice(localRoot: string, ids: SeqIds, clock: FixedClock) {
  const paths = resolveVaultPaths(localRoot);
  const store = new FileVaultStore(paths, ids, clock);
  const crypto = new Argon2VaultCrypto();
  const keychain = new FakeKeychain();
  const identity = new FakeDeviceIdentity(ids);
  const folder = new FileVaultFolder(paths);
  const guard = new SessionGuard(identity, keychain, clock, parseAutoLockTtl(undefined));
  const sessions = new SqliteVaultSessions(paths, keychain, identity, guard, ids, clock);
  return {
    paths,
    keychain,
    identity,
    unlockVault: new UnlockVault(store, crypto, keychain, identity, clock),
    lockVault: new LockVault(store, keychain, folder, identity),
    saveContext: new SaveContext(sessions, clock, ids),
    changePassphrase: new ChangePassphrase(
      store,
      crypto,
      keychain,
      folder,
      identity,
      new SqliteVaultRekeyer(paths, ids, clock),
      clock,
    ),
  };
}
type Device = ReturnType<typeof makeDevice>;

/** Two devices over one vault (A created it, B cloned it), both at the same generation, both locked. */
async function twoDevices(name: string) {
  const ids = new SeqIds();
  const clock = new FixedClock();
  const vault = await makePassphraseVault(join(root, `${name}-a`));
  const a = makeDevice(vault.paths.root, ids, clock);
  const b = makeDevice(join(root, `${name}-b`), ids, clock);
  mkdirSync(b.paths.root, { recursive: true });
  copyFileSync(a.paths.header, b.paths.header);

  await unlockOk(a, vault.passphrase);
  expect(a.saveContext.execute({ project: "acme", content: "shared start" }).ok).toBe(true);
  a.lockVault.execute();
  syncDb(a.paths, b.paths);
  await unlockOk(b, vault.passphrase); // B adopts the generation and records it as seen
  return { vault, a, b };
}

async function unlockOk(device: Device, passphrase: string) {
  const result = await device.unlockVault.execute({ passphrase, upgradeConfirmed: true });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The sync client replicating just the vault file. */
function syncDb(from: VaultPaths, to: VaultPaths): void {
  copyFileSync(from.db, to.db);
}

async function changeOn(device: Device, passphrase: string) {
  const result = await device.changePassphrase.execute({
    current: { passphrase },
    newPassphrase: NEW_PASSPHRASE,
    otherDevicesConfirmed: true,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** stderr of `valija unlock` on `device`, typing `passphrase` at the prompt. */
async function cliUnlockErrors(device: Device, passphrase: string): Promise<string> {
  vi.mocked(promptHidden).mockResolvedValue(passphrase);
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
  const container = {
    paths: device.paths,
    unlockVault: device.unlockVault,
  } as unknown as Container;
  await expect(unlockCommand(container, {})).rejects.toThrow("exit");
  return errors.join("\n");
}

describe("change-passphrase on two devices (REKEY §2.4, §6)", () => {
  it("1. B with the old key: VAULT_LOCKED, the old passphrase fails with the hint, the new one fast-forwards", async () => {
    const { vault, a, b } = await twoDevices("handoff");
    // §2.4 #7: B is still unlocked from before, with the OLD key in its keychain.
    const changed = await changeOn(a, vault.passphrase);
    syncDb(a.paths, b.paths);

    const stale = b.saveContext.execute({ project: "acme", content: "never lands" });
    expect(stale.ok ? "ok" : stale.error.code).toBe("VAULT_LOCKED");
    expect(b.keychain.getKey(vault.vaultId)).toBeNull();

    const stderr = await cliUnlockErrors(b, vault.passphrase);
    expect(stderr).toContain("error [WRONG_PASSPHRASE]");
    expect(stderr).toContain("If you changed your passphrase on another device, use the new one");

    const unlocked = await unlockOk(b, NEW_PASSPHRASE);
    expect(unlocked.fork).toBeUndefined();
    expect(b.identity.lastSeen(vault.vaultId)?.generation).toBe(changed.generation);
  });

  it("2. a reverted rekey: B's offline old-key write replaces A's file, and lineage explains it as a fork", async () => {
    const { vault, a, b } = await twoDevices("reverted");
    const start = b.identity.lastSeen(vault.vaultId)?.generation ?? -1;

    // B wrote offline, under the old key, from the shared generation.
    expect(b.saveContext.execute({ project: "acme", content: "B's offline write" }).ok).toBe(true);
    b.lockVault.execute();
    // Meanwhile A changed the passphrase from that same generation.
    const changed = await changeOn(a, vault.passphrase);
    expect(changed.generation).toBe(start + 1);
    a.lockVault.execute();

    // B's file "wins" the sync: the rekey is silently undone for the folder.
    syncDb(b.paths, a.paths);

    const withNew = await a.unlockVault.execute({ passphrase: NEW_PASSPHRASE });
    expect(withNew.ok ? "ok" : withNew.error.code).toBe("WRONG_PASSPHRASE");
    const withOld = await unlockOk(a, vault.passphrase);
    expect(withOld.fork?.notice.code).toBe("VAULT_FORK_DETECTED");
    expect(withOld.fork?.generation).toBe(start + 1);
  });
});
