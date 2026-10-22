import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RecordingKeychain } from "../../testing/recording-keychain.js";

// Mode K in the example must never reach the real OS keychain.
vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = join(HERE, "..", "..", "..", "docs", "sdk.md");
const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-docs-"));
const originalEnv = { ...process.env };

/** The fenced block between the two markers in docs/sdk.md (D-V). */
function exampleSource(): string {
  const doc = readFileSync(DOC, "utf8");
  const block = doc.match(
    /<!-- sdk-example:start -->\s*```ts\n([\s\S]*?)```\s*<!-- sdk-example:end -->/,
  );
  if (block?.[1] === undefined) throw new Error("docs/sdk.md has no sdk-example block");
  return block[1];
}

beforeAll(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_HOME = join(tmp, "vault");
  process.env.VALIJA_STATE_HOME = join(tmp, "state");
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

describe("docs/sdk.md example", () => {
  it("imports only from valija/sdk and node:assert", () => {
    const specifiers = [...exampleSource().matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers).toEqual(["node:assert/strict", "valija/sdk"]);
  });

  it("runs, and its own assertions pass", async () => {
    const entry = join(HERE, "index.ts").replaceAll("\\", "/");
    const file = join(tmp, "example.ts");
    writeFileSync(file, exampleSource().replace('"valija/sdk"', JSON.stringify(entry)));
    await expect(import(file)).resolves.toBeDefined();
    // Mode K read the (empty) keychain; Mode P and createVault never touched it (§11.1).
    expect(RecordingKeychain.calls.map((c) => c.method)).toEqual(["getKey"]);
    expect(RecordingKeychain.constructions).toBe(1);
  });
});
