import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { FileExportReader } from "./file-export-reader.js";

const reader = new FileExportReader();
const dirs: string[] = [];

const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "valija-import-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

describe("FileExportReader", () => {
  it("reads a plain .json export as one document", () => {
    const file = join(makeDir(), "export.json");
    writeFileSync(file, JSON.stringify([{ hello: "world" }]));
    const r = reader.read(file);
    expect(r.ok && r.value).toEqual([[{ hello: "world" }]]);
  });

  it("reads .json entries from a .zip in memory, writing nothing to disk", () => {
    const dir = makeDir();
    const file = join(dir, "export.zip");
    writeFileSync(
      file,
      zipSync({
        "conversations.json": strToU8(JSON.stringify([{ a: 1 }])),
        "readme.txt": strToU8("ignore me"),
      }),
    );
    const before = readdirSync(dir).sort();
    const r = reader.read(file);
    const after = readdirSync(dir).sort();
    expect(after).toEqual(before); // no extraction files created
    expect(r.ok && r.value).toEqual([[{ a: 1 }]]); // only the .json entry
  });

  it("returns UNREADABLE_FILE for a missing path", () => {
    const r = reader.read(join(makeDir(), "nope.json"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNREADABLE_FILE");
  });

  it("returns MALFORMED_EXPORT for invalid JSON", () => {
    const file = join(makeDir(), "bad.json");
    writeFileSync(file, "{ not json");
    const r = reader.read(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MALFORMED_EXPORT");
  });

  it("returns EMPTY_EXPORT for a zip with no .json entries", () => {
    const file = join(makeDir(), "empty.zip");
    writeFileSync(file, zipSync({ "notes.txt": strToU8("nothing here") }));
    const r = reader.read(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("EMPTY_EXPORT");
  });

  it("rejects an archive that exceeds the decompression cap", () => {
    const file = join(makeDir(), "big.zip");
    writeFileSync(file, zipSync({ "conversations.json": strToU8("x".repeat(500)) }));
    const tinyReader = new FileExportReader(100, 100); // 100-byte entry cap
    const r = tinyReader.read(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CORRUPT_ARCHIVE");
  });
});
