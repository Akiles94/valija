import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLIENTS } from "../../../../../src/delivery/cli/installer.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { createToolsHandlers } from "./tools-handlers.js";

const tmpHome = mkdtempSync(join(tmpdir(), "valija-tools-home-"));
const originalHome = process.env.HOME;
beforeAll(() => {
  process.env.HOME = tmpHome;
});
afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
});

function fakeContainer(vaultRoot: string): Container {
  // biome-ignore lint/suspicious/noExplicitAny: only paths.root is read by tools-handlers.ts
  return { paths: { root: vaultRoot, header: "", db: "" } } as any as Container;
}

describe("tools-handlers", () => {
  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("tools:status reports every client as not connected before anything is installed", () => {
    const handlers = createToolsHandlers(() => fakeContainer("/tmp/vault"));
    const status = handlers["tools:status"]();
    expect(status).toHaveLength(CLIENTS.length);
    for (const entry of status) {
      expect(entry.connected).toBe(false);
      expect(entry.vaultPath).toBeUndefined();
    }
  });

  it("tools:connect writes the current vault root, and tools:status then reports it", () => {
    const handlers = createToolsHandlers(() => fakeContainer("/tmp/my-vault"));
    const connected = handlers["tools:connect"]({ client: "cursor" });
    expect(connected.ok).toBe(true);

    const status = handlers["tools:status"]();
    const cursor = status.find((s) => s.client === "cursor");
    expect(cursor?.connected).toBe(true);
    expect(cursor?.vaultPath).toBe("/tmp/my-vault");
  });

  it("tools:connect refuses an unknown client with a typed error code, not a thrown exception", () => {
    const handlers = createToolsHandlers(() => fakeContainer("/tmp/vault"));
    const result = handlers["tools:connect"]({ client: "not-a-real-client" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBeDefined();
  });
});
