import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { resolveVaultPaths } from "../../../../../src/shared/infra/vault-paths.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../../../src/testing/test-vault.js";
import { CreateVault } from "../../../../../src/vault/application/use-cases/create-vault.use-case.js";
import { Argon2VaultCrypto } from "../../../../../src/vault/infra/argon2.js";
import { FileVaultStore } from "../../../../../src/vault/infra/file-vault-store.js";
import { FileAppPreferencesStore } from "../../../main/infra/file-app-preferences-store.js";
import { createPreferencesHandlers } from "./preferences-handlers.js";
import { createVaultHandlers } from "./vault-handlers.js";

function makeContainer(root: string): Container {
  const paths = resolveVaultPaths(root);
  const store = new FileVaultStore(paths, new SeqIds(), new FixedClock());
  const keychain = new FakeKeychain();
  const deviceIdentity = new FakeDeviceIdentity(new SeqIds());
  const createVault = new CreateVault(
    store,
    new Argon2VaultCrypto(),
    keychain,
    deviceIdentity,
    new FixedClock(),
    new SeqIds(),
  );
  // biome-ignore lint/suspicious/noExplicitAny: only createVault is exercised in this file
  return { createVault } as any as Container;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** A 64-hex-char run is what a raw `keyHex` (§5.1) looks like on the wire. */
function containsHex64(buffer: Buffer): boolean {
  return /[0-9a-f]{64}/i.test(buffer.toString("latin1"));
}

describe("vault-handlers — §8.2: the recovery kit crosses the boundary exactly once", () => {
  it("a second read after the first finds the slot already consumed", async () => {
    const root = mkdtempSync(join(tmpdir(), "valija-kit-"));
    try {
      const handlers = createVaultHandlers(() => makeContainer(root));

      const initResult = await handlers["vault:init"]({
        passphrase: "correct horse battery staple",
      });
      expect(initResult.ok).toBe(true);
      if (!initResult.ok) return;

      const first = await handlers["vault:readRecoveryKit"]();
      expect(first).not.toBeNull();
      expect(first?.text).toContain(initResult.value.vaultId);
      expect(first?.text).toMatch(/[0-9a-f]{64}/);

      const second = await handlers["vault:readRecoveryKit"]();
      expect(second).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("vault-handlers — §8.4/§8.2: disk hygiene after a scripted init", () => {
  it("the preferences file has exactly the four keys, and no file the app wrote contains a raw key", async () => {
    const root = mkdtempSync(join(tmpdir(), "valija-hygiene-"));
    try {
      const prefsStore = new FileAppPreferencesStore(root);
      createPreferencesHandlers(prefsStore)["preferences:write"]({
        theme: "dark",
        language: "es",
        tourSeen: true,
      });

      const handlers = createVaultHandlers(() => makeContainer(root));
      const initResult = await handlers["vault:init"]({
        passphrase: "correct horse battery staple",
      });
      expect(initResult.ok).toBe(true);
      // Reading the kit once, as a real scripted run would, still must never
      // touch disk — the text only ever crosses main -> renderer over IPC.
      await handlers["vault:readRecoveryKit"]();

      const prefsOnDisk = JSON.parse(readFileSync(join(root, "preferences.json"), "utf8"));
      expect(Object.keys(prefsOnDisk).sort()).toEqual([
        "language",
        "theme",
        "tourSeen",
        "vaultPath",
      ]);

      const files = walk(root);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        expect(containsHex64(readFileSync(file))).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
