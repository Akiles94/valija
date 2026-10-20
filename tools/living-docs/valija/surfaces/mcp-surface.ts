import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "../../../../src/delivery/mcp/server.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";
import { type CallableIndex, reachContainerKeys } from "../services/use-case-reach.js";
import { createInertContainer } from "./inert-container.js";
import { assertSameNames, segmentByMarker } from "./segments.js";

/** Where `buildMcpServer` lives; the static half of MCP discovery reads it. */
export const MCP_SERVER_FILE = "src/delivery/mcp/server.ts";

/** One MCP tool or prompt as an AI client sees it, plus the container keys it reaches. */
export interface McpEntry {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly arguments: readonly { name: string; required: boolean }[];
  readonly reaches: readonly string[];
}

/**
 * Lists tools and prompts at runtime through an in-memory MCP client (never calling them) and
 * links each to the use cases its handler reaches by scanning `buildMcpServer` statically.
 */
export async function readMcpSurface(
  files: readonly SourceFile[],
  index: CallableIndex,
): Promise<{ tools: McpEntry[]; prompts: McpEntry[] }> {
  const server = buildMcpServer(createInertContainer());
  const client = new Client({ name: "living-docs", version: "0" });
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  await server.connect(serverEnd);
  await client.connect(clientEnd);
  try {
    const { tools } = await client.listTools();
    const { prompts } = await client.listPrompts();
    const source = files.find((f) => f.path === MCP_SERVER_FILE);
    const build = source?.scanned.declarations.find((d) => d.name === "buildMcpServer");
    if (!build) throw new Error(`cannot find buildMcpServer in ${MCP_SERVER_FILE}`);
    const toolCode = segmentByMarker(build.span, /registerTool\(\s*"([\w-]+)"/g);
    const promptCode = segmentByMarker(build.span, /registerPrompt\(\s*"([\w-]+)"/g);
    assertSameNames(
      "MCP tools",
      MCP_SERVER_FILE,
      tools.map((t) => t.name),
      [...toolCode.keys()],
    );
    assertSameNames(
      "MCP prompts",
      MCP_SERVER_FILE,
      prompts.map((p) => p.name),
      [...promptCode.keys()],
    );

    const reach = (code: string | undefined) =>
      reachContainerKeys(code ?? "", MCP_SERVER_FILE, index);
    return {
      tools: tools.map((t) => ({
        name: t.name,
        title: t.title ?? t.name,
        description: t.description ?? "",
        arguments: Object.keys(t.inputSchema.properties ?? {}).map((name) => ({
          name,
          required: t.inputSchema.required?.includes(name) ?? false,
        })),
        reaches: reach(toolCode.get(t.name)),
      })),
      prompts: prompts.map((p) => ({
        name: p.name,
        title: p.title ?? p.name,
        description: p.description ?? "",
        arguments: (p.arguments ?? []).map((a) => ({
          name: a.name,
          required: a.required ?? false,
        })),
        reaches: reach(promptCode.get(p.name)),
      })),
    };
  } finally {
    await client.close();
    await server.close();
  }
}
