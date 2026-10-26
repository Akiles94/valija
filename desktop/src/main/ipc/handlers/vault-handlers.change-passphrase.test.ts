import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { makePassphraseVault } from "../../../../../src/testing/passphrase-vault.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../../../src/testing/test-vault.js";
import { ChangePassphrase } from "../../../../../src/vault/application/use-cases/change-passphrase.use-case.js";
import { Argon2VaultCrypto } from "../../../../../src/vault/infra/argon2.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../../../../../src/vault/infra/file-vault-store.js";
import { SqliteVaultRekeyer } from "../../../../../src/vault/infra/sqlite-vault-rekeyer.js";
import { createVaultHandlers } from "./vault-handlers.js";

const NEW_PASSPHRASE = "a different test phrase";
const HEX_RUN = /[0-9a-f]{64}/i;
const tmp = mkdtempSync(join(tmpdir(), "valija-ipc-change-passphrase-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;

async function setup() {
  const vault = await makePassphraseVault(join(tmp, `vault-${++n}`));
  const ids = new SeqIds();
  const clock = new FixedClock();
  const changePassphrase = new ChangePassphrase(
    new FileVaultStore(vault.paths, ids, clock),
    new Argon2VaultCrypto(),
    new FakeKeychain(),
    new FileVaultFolder(vault.paths),
    new FakeDeviceIdentity(ids),
    new SqliteVaultRekeyer(vault.paths, ids, clock),
    clock,
  );
  const container = { changePassphrase } as unknown as Container;
  return { vault, handlers: createVaultHandlers(() => container) };
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

describe("vault:changePassphrase — the new kit crosses once, the key never on the wire", () => {
  it("ok → exactly four response keys and no 64-hex run", async () => {
    const { vault, handlers } = await setup();

    const result = await handlers["vault:changePassphrase"]({
      current: { passphrase: vault.passphrase },
      newPassphrase: NEW_PASSPHRASE,
      otherDevicesConfirmed: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual([
      "generation",
      "issuedAt",
      "unlockedOnThisDevice",
      "vaultId",
    ]);
    expect(result.value.unlockedOnThisDevice).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(HEX_RUN);
  });

  it("the first readRecoveryKit holds the new key and Key issued; the second is null", async () => {
    const { vault, handlers } = await setup();
    await handlers["vault:changePassphrase"]({
      current: { recoveryKeyHex: vault.keyHex },
      newPassphrase: NEW_PASSPHRASE,
      otherDevicesConfirmed: false,
    });

    const first = await handlers["vault:readRecoveryKit"]();
    expect(first?.text).toContain("Key issued:");
    expect(first?.text).toContain(vault.vaultId);
    const keyInKit = first?.text.match(HEX_RUN)?.[0];
    expect(keyInKit).toBeDefined();
    expect(keyInKit).not.toBe(vault.keyHex);
    expect(await handlers["vault:readRecoveryKit"]()).toBeNull();
  });

  it("a failure → { ok: false, error: { code } } only, and the slot stays empty", async () => {
    const { handlers } = await setup();

    const result = await handlers["vault:changePassphrase"]({
      current: { passphrase: "not the passphrase" },
      newPassphrase: NEW_PASSPHRASE,
      otherDevicesConfirmed: false,
    });

    expect(result).toEqual({ ok: false, error: { code: "WRONG_PASSPHRASE" } });
    expect(await handlers["vault:readRecoveryKit"]()).toBeNull();
  });

  it("no file under the vault folder holds a 64-hex run after a change", async () => {
    const { vault, handlers } = await setup();
    await handlers["vault:changePassphrase"]({
      current: { passphrase: vault.passphrase },
      newPassphrase: NEW_PASSPHRASE,
      otherDevicesConfirmed: false,
    });

    for (const file of filesUnder(vault.paths.root)) {
      expect(HEX_RUN.test(readFileSync(file).toString("latin1")), file).toBe(false);
    }
  });
});
