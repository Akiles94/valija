import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../../shared/infra/vault-paths.js";
import { FileVaultMover } from "./file-vault-mover.js";

const tmpRoots: string[] = [];
afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots.length = 0;
});

function tempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `valija-mover-${prefix}-`));
  tmpRoots.push(root);
  return root;
}

function writeFakeVault(root: string): void {
  const paths = resolveVaultPaths(root);
  writeFileSync(paths.header, '{"vaultId":"01TEST"}');
  writeFileSync(paths.db, "not really sqlite, just needs bytes");
}

describe("FileVaultMover.inspect", () => {
  it("reports a missing folder as not existing and not writable", () => {
    const mover = new FileVaultMover();
    const missing = join(tempDir("missing"), "does-not-exist");
    const result = mover.inspect(missing);
    expect(result).toEqual({ exists: false, writable: false, hasHeader: false, hasDb: false });
  });

  it("reports an empty, writable folder correctly", () => {
    const mover = new FileVaultMover();
    const root = tempDir("empty");
    const result = mover.inspect(root);
    expect(result).toEqual({ exists: true, writable: true, hasHeader: false, hasDb: false });
  });

  it("reports hasHeader/hasDb for a folder that already has a vault", () => {
    const mover = new FileVaultMover();
    const root = tempDir("occupied");
    writeFakeVault(root);
    const result = mover.inspect(root);
    expect(result).toEqual({ exists: true, writable: true, hasHeader: true, hasDb: true });
  });
});

describe("FileVaultMover.copy / matches", () => {
  it("copies both files and they match byte-for-byte at the destination", () => {
    const mover = new FileVaultMover();
    const sourceRoot = tempDir("copy-source");
    writeFakeVault(sourceRoot);
    const destRoot = join(tempDir("copy-dest-parent"), "nested", "dest");

    const from = resolveVaultPaths(sourceRoot);
    const to = resolveVaultPaths(destRoot);
    mover.copy(from, to);

    expect(readFileSync(to.header, "utf8")).toBe(readFileSync(from.header, "utf8"));
    expect(readFileSync(to.db, "utf8")).toBe(readFileSync(from.db, "utf8"));
    expect(mover.matches(from, to)).toBe(true);
  });

  it("matches is false when the destination content differs", () => {
    const mover = new FileVaultMover();
    const sourceRoot = tempDir("mismatch-source");
    writeFakeVault(sourceRoot);
    const destRoot = tempDir("mismatch-dest");
    writeFakeVault(destRoot);
    writeFileSync(resolveVaultPaths(destRoot).db, "tampered content");

    const from = resolveVaultPaths(sourceRoot);
    const to = resolveVaultPaths(destRoot);
    expect(mover.matches(from, to)).toBe(false);
  });

  it("never calls fs.renameSync — copy must work across filesystems (D-R(b))", () => {
    const source = readFileSync(new URL("file-vault-mover.ts", import.meta.url), "utf8");
    expect(source).not.toContain("renameSync");
  });
});

describe("FileVaultMover.discard / remove", () => {
  it("discard removes partial files and never throws even if some are missing", () => {
    const mover = new FileVaultMover();
    const root = tempDir("discard");
    const paths = resolveVaultPaths(root);
    writeFileSync(paths.header, "partial header only");
    // paths.db deliberately not created — discard must tolerate a partial copy.

    expect(() => mover.discard(paths)).not.toThrow();
    expect(mover.inspect(root)).toEqual({
      exists: true,
      writable: true,
      hasHeader: false,
      hasDb: false,
    });
  });

  it("remove deletes both files of a complete vault", () => {
    const mover = new FileVaultMover();
    const root = tempDir("remove");
    writeFakeVault(root);
    const paths = resolveVaultPaths(root);

    mover.remove(paths);

    expect(mover.inspect(root)).toEqual({
      exists: true,
      writable: true,
      hasHeader: false,
      hasDb: false,
    });
  });
});
