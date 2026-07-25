import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../shared/infra/vault-paths.js";
import { FileVaultFolder } from "./file-vault-folder.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-vault-folder-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A vault root at `tmp/<name>` with each of `files` touched inside it. */
function folderWith(name: string, files: string[]): FileVaultFolder {
  const root = join(tmp, name);
  mkdirSync(root, { recursive: true });
  for (const file of files) writeFileSync(join(root, file), "x");
  return new FileVaultFolder(resolveVaultPaths(root));
}

describe("FileVaultFolder.inspect", () => {
  describe("sidecars", () => {
    it("lists the journal sidecars that exist, as absolute paths", () => {
      const { sidecars } = folderWith("sidecars", [
        "vault.db",
        "vault.db-wal",
        "vault.db-shm",
      ]).inspect();
      expect(sidecars).toHaveLength(2);
      expect(sidecars.every((p) => p.startsWith(tmp))).toBe(true);
      expect(sidecars.some((p) => p.endsWith("vault.db-wal"))).toBe(true);
      expect(sidecars.some((p) => p.endsWith("vault.db-shm"))).toBe(true);
    });

    it("is empty for a single file at rest", () => {
      expect(folderWith("at-rest", ["vault.db"]).inspect().sidecars).toEqual([]);
    });
  });

  describe("conflictedCopies", () => {
    // The regression that motivated this file: a real Dropbox conflicted copy is
    // "<name> (<user>'s conflicted copy <date>).<ext>", so the "(" is followed by
    // the username — the previous /\(conflicted copy.*\)/ pattern missed it entirely.
    it("matches a real Dropbox conflicted copy", () => {
      const { conflictedCopies } = folderWith("dropbox", [
        "vault.db",
        "vault (Oscar's conflicted copy 2026-07-23).db",
      ]).inspect();
      expect(conflictedCopies).toHaveLength(1);
      expect(conflictedCopies[0]?.endsWith("vault (Oscar's conflicted copy 2026-07-23).db")).toBe(
        true,
      );
      expect(conflictedCopies[0]?.startsWith(tmp)).toBe(true); // absolute, like sidecars
    });

    it("matches a Syncthing .sync-conflict file", () => {
      const { conflictedCopies } = folderWith("syncthing", [
        "vault.db",
        "vault.db.sync-conflict-20260723-101500-ABCDEF.db",
      ]).inspect();
      expect(conflictedCopies).toHaveLength(1);
    });

    it("matches the generic '(conflicted copy)' shape", () => {
      const { conflictedCopies } = folderWith("generic", [
        "vault.db",
        "vault.db (conflicted copy).db",
      ]).inspect();
      expect(conflictedCopies).toHaveLength(1);
    });

    it("does not flag an ordinary folder or an unmarkable OneDrive rename", () => {
      // OneDrive renames to "<name>-<hostname>.<ext>", which carries no reliable
      // marker — intentionally not matched (documented in docs/sync.md).
      const { conflictedCopies } = folderWith("clean", [
        "vault.db",
        "vault.json",
        "vault-LAPTOP-X1.db",
      ]).inspect();
      expect(conflictedCopies).toEqual([]);
    });
  });

  describe("staleBackups", () => {
    it("reports a leftover pre-upgrade .bak as an absolute path", () => {
      const { staleBackups } = folderWith("bak", ["vault.db", "vault.db.pre-003.bak"]).inspect();
      expect(staleBackups).toHaveLength(1);
      expect(staleBackups[0]?.endsWith("vault.db.pre-003.bak")).toBe(true);
      expect(staleBackups[0]?.startsWith(tmp)).toBe(true);
    });

    it("ignores the live db and unrelated .bak names", () => {
      const { staleBackups } = folderWith("nobak", [
        "vault.db",
        "vault.json",
        "notes.bak",
      ]).inspect();
      expect(staleBackups).toEqual([]);
    });
  });

  describe("looksLikeCloud", () => {
    it("recognizes a cloud path case-insensitively (path need not exist)", () => {
      const lower = new FileVaultFolder(resolveVaultPaths(join(tmp, "home", "dropbox", "valija")));
      expect(lower.inspect().looksLikeCloud).toBe(true);
      const iCloud = new FileVaultFolder(
        resolveVaultPaths(join(tmp, "Library", "Mobile Documents", "valija")),
      );
      expect(iCloud.inspect().looksLikeCloud).toBe(true);
    });

    it("recognizes a vendor marker file in the vault root", () => {
      expect(folderWith("markered", ["vault.db", ".stfolder"]).inspect().looksLikeCloud).toBe(true);
    });

    it("returns false for a plain local folder", () => {
      expect(folderWith("local", ["vault.db"]).inspect().looksLikeCloud).toBe(false);
    });
  });
});
