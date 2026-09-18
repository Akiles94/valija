import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { resolveVaultPaths } from "../../../../../src/shared/infra/vault-paths.js";
import {
  copyGoldenVaultTo,
  readGoldenVaultManifest,
} from "../../../../../src/testing/golden-vault.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../../../src/testing/test-vault.js";
import { VaultStatus } from "../../../../../src/vault/application/use-cases/vault-status.use-case.js";
import { parseAutoLockTtl } from "../../../../../src/vault/domain/values/auto-lock-ttl.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../../../../../src/vault/infra/file-vault-store.js";
import { createSyncHandlers } from "./sync-handlers.js";
import { createVaultHandlers } from "./vault-handlers.js";

/**
 * §9 item 58: the Sync panel reads two channels together (`vault:status` +
 * `sync:status`) against a real, unlocked golden vault — this proves that
 * scripted sequence, exactly as `sync.tsx` performs it, leaves the vault
 * folder untouched: no new file, no sidecar, the lineage generation doesn't
 * move, and the keychain entry is neither changed nor deleted (D-U(d):
 * displayed, never editable).
 */
describe("the Sync panel's two reads together perform no write at all", () => {
  it("no new file appears and the generation is unchanged across repeated reads", () => {
    const manifest = readGoldenVaultManifest();
    const root = mkdtempSync(join(tmpdir(), "valija-sync-panel-"));
    try {
      copyGoldenVaultTo(root);
      const paths = resolveVaultPaths(root);
      const idGen = new SeqIds();
      const clock = new FixedClock(new Date(manifest.generatedAt));
      const store = new FileVaultStore(paths, idGen, clock);
      const keychain = new FakeKeychain();
      keychain.setKey(manifest.vaultId, manifest.keyHex);
      const deviceIdentity = new FakeDeviceIdentity(idGen);
      const folder = new FileVaultFolder(paths);
      const vaultStatus = new VaultStatus(
        store,
        keychain,
        deviceIdentity,
        folder,
        clock,
        parseAutoLockTtl(undefined),
      );
      const container = { folder, vaultStatus } as unknown as Container;

      const vaultHandlers = createVaultHandlers(() => container);
      const syncHandlers = createSyncHandlers(() => container);

      const filesBefore = readdirSync(root).sort();
      const keychainEntryBefore = keychain.getKey(manifest.vaultId);

      const firstStatus = vaultHandlers["vault:status"]();
      const firstSync = syncHandlers["sync:status"]();
      expect(firstStatus.ok).toBe(true);
      const generationAfterFirstRead = firstStatus.ok ? firstStatus.value.generation : undefined;

      // A second, back-to-back read of the exact pair sync.tsx performs.
      const secondStatus = vaultHandlers["vault:status"]();
      const secondSync = syncHandlers["sync:status"]();
      expect(secondStatus.ok).toBe(true);
      const generationAfterSecondRead = secondStatus.ok ? secondStatus.value.generation : undefined;

      expect(generationAfterSecondRead).toBe(generationAfterFirstRead);
      expect(firstSync).toEqual(secondSync);

      const filesAfter = readdirSync(root).sort();
      expect(filesAfter).toEqual(filesBefore);
      expect(keychain.getKey(manifest.vaultId)).toBe(keychainEntryBefore);
      expect(keychain.getKey(manifest.vaultId)).toBe(manifest.keyHex);

      for (const suffix of ["-wal", "-shm", "-journal"]) {
        expect(filesAfter.includes(`vault.db${suffix}`)).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
