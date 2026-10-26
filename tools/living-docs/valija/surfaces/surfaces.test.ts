import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TypeScriptExportsExtractor } from "../../core/infra/typescript-exports-extractor.js";
import { indexCallables } from "../services/use-case-reach.js";
import { readCliCommands } from "./cli-surface.js";
import { readIpcChannels } from "./ipc-surface.js";
import { readMcpSurface } from "./mcp-surface.js";

const repoRoot = join(import.meta.dirname, "../../../..");
const files = new TypeScriptExportsExtractor({
  repoRoot,
  roots: ["src", "desktop/src"],
  docRequired: () => true,
}).sources().files;
const index = indexCallables(files);

describe("surfaces read from the real code", () => {
  it("CLI: the 22 commands, each linked to what its action reaches", () => {
    const commands = readCliCommands(files, index);
    expect(commands.map((c) => c.name)).toEqual([
      "init",
      "unlock",
      "lock",
      "status",
      "change-passphrase",
      "projects",
      "show",
      "pin",
      "unpin",
      "archive",
      "unarchive",
      "edit",
      "search",
      "export",
      "which",
      "link",
      "unlink",
      "links",
      "import",
      "install",
      "mcp",
      "doctor",
    ]);
    const reach = Object.fromEntries(commands.map((c) => [c.name, c.reaches]));
    expect(reach.unlock).toEqual(["unlockVault"]);
    expect(reach.export).toContain("getContextPack");
    expect(reach.doctor).toContain("vaultStatus");
    expect(reach["change-passphrase"]).toEqual(["changePassphrase"]);
  });

  it("MCP: exactly the SPEC §7 surface — adding a tool is a conscious test change", async () => {
    const { tools, prompts } = await readMcpSurface(files, index);
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_context",
      "list_projects",
      "save_context",
      "save_handoff",
      "search_context",
    ]);
    expect(prompts.map((p) => p.name).sort()).toEqual(["load-context", "save-context"]);
    expect(tools.find((t) => t.name === "save_context")?.reaches).toEqual(["saveContext"]);
  });

  it("IPC: all 38 channels, each with exactly one handler", () => {
    const channels = readIpcChannels(files, index);
    expect(channels).toHaveLength(38);
    const unlock = channels.find((c) => c.name === "vault:unlock");
    expect(unlock).toMatchObject({
      handlerFile: "desktop/src/main/ipc/handlers/vault-handlers.ts",
      request: "VaultUnlockRequest",
      reaches: ["unlockVault"],
    });
    expect(channels.find((c) => c.name === "relocation:move")?.reaches).toEqual([
      "lockVault",
      "relocateVault",
    ]);
  });
});
