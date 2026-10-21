import type { SourceFile } from "living-docs";
import {
  type Cell,
  createCatalogue,
  createExtractedFacts,
  type ExtractedFacts,
  type Extractor,
  itemAnchor,
  SYMBOL_ROW_KIND,
} from "living-docs";
import { type ParityDeclaration, pairSurfaces } from "../services/surface-parity.js";
import { indexCallables, readContainerUseCases } from "../services/use-case-reach.js";
import { BUILD_PROGRAM_FILE, readCliCommands } from "../surfaces/cli-surface.js";
import {
  CHANNELS_FILE,
  findUndocumentedChannels,
  readIpcChannels,
} from "../surfaces/ipc-surface.js";
import { MCP_SERVER_FILE, readMcpSurface } from "../surfaces/mcp-surface.js";
import { firstSentence } from "./use-cases.extractor.js";

const CONTAINER_FILE = "src/delivery/container.ts";

/**
 * The three surfaces a user or an AI reaches Valija through — CLI commands, MCP tools and
 * prompts, desktop IPC channels — with the use cases each reaches and CLI ↔ desktop parity.
 */
export class EntryPointsExtractor implements Extractor {
  readonly name = "valija-entry-points";

  constructor(
    private readonly sources: () => readonly SourceFile[],
    private readonly parity: readonly ParityDeclaration[],
  ) {}

  async extract(): Promise<ExtractedFacts> {
    const files = this.sources();
    const index = indexCallables(files);
    const container = files.find((f) => f.path === CONTAINER_FILE);
    if (!container) throw new Error(`cannot find ${CONTAINER_FILE}`);
    const useCaseOf = readContainerUseCases(container);
    const reaches = (keys: readonly string[]): Cell => {
      const names = [...new Set(keys.map((k) => useCaseOf.get(k) ?? k))].sort();
      if (names.length === 0) return { text: "—" };
      return {
        text: "",
        links: names.map((n) => ({
          text: n,
          href: `reference/use-cases.md#${itemAnchor({ kind: SYMBOL_ROW_KIND, name: n })}`,
        })),
      };
    };

    const cli = readCliCommands(files, index);
    const mcp = await readMcpSurface(files, index);
    const ipc = readIpcChannels(files, index);
    const parity = pairSurfaces(cli, ipc, this.parity, {
      file: "tools/living-docs/valija/composition/valija-guide.ts",
    });

    const undocumentedChannels = findUndocumentedChannels(ipc);

    return createExtractedFacts({
      catalogues: [
        createCatalogue({
          id: "cli",
          page: "reference/cli.md",
          title: "CLI commands",
          intro: "Read at runtime from the commander program `buildProgram` builds.",
          columns: ["Command", "What it does", "Options", "Reaches"],
          rows: cli.map((c) => ({
            key: { kind: "cli", name: c.name, label: `valija ${c.name}` },
            cells: [
              { text: `valija ${c.usage}`, href: BUILD_PROGRAM_FILE },
              { text: c.description },
              { text: c.options.map((o) => `\`${o.flags}\` ${o.description}`).join("; ") || "—" },
              reaches(c.reaches),
            ],
          })),
        }),
        createCatalogue({
          id: "mcp-tools",
          page: "reference/mcp.md",
          title: "MCP tools",
          intro:
            "What an AI client sees, listed at runtime through an in-memory MCP client. The surface is deliberately narrow (SPEC §7): no pinning, no hard removal by a model.",
          columns: ["Tool", "Title", "What it tells the AI", "Arguments", "Reaches"],
          rows: mcp.tools.map((t) => ({
            key: { kind: "mcp", name: t.name, label: t.name },
            cells: [
              { text: t.name, href: MCP_SERVER_FILE },
              { text: t.title },
              { text: firstSentence(t.description) },
              { text: args(t.arguments) },
              reaches(t.reaches),
            ],
          })),
        }),
        createCatalogue({
          id: "mcp-prompts",
          page: "reference/mcp.md",
          position: 1,
          title: "MCP prompts",
          columns: ["Prompt", "Title", "What it does", "Arguments", "Reaches"],
          rows: mcp.prompts.map((p) => ({
            key: { kind: "prompt", name: p.name, label: p.name },
            cells: [
              { text: p.name, href: MCP_SERVER_FILE },
              { text: p.title },
              { text: firstSentence(p.description) },
              { text: args(p.arguments) },
              reaches(p.reaches),
            ],
          })),
        }),
        createCatalogue({
          id: "ipc",
          page: "reference/ipc.md",
          title: "Desktop IPC channels",
          intro:
            "The closed IPC surface between the desktop renderer and its main process, read from `CHANNELS` and `ChannelMap`.",
          columns: ["Channel", "What it does", "Request → response", "Handler", "Reaches"],
          rows: ipc.map((c) => ({
            key: { kind: "ipc", name: c.name, label: c.name },
            cells: [
              { text: c.name, href: CHANNELS_FILE },
              { text: c.doc ? firstSentence(c.doc) : "—" },
              { text: `\`${c.request}\` → \`${c.response}\`` },
              { text: c.handlerFile.split("/").at(-1) ?? c.handlerFile, href: c.handlerFile },
              reaches(c.reaches),
            ],
          })),
        }),
        parity.catalogue,
      ],
      requirements: [
        requirement(
          "cli",
          cli.map((c) => c.name),
          "every CLI command",
          BUILD_PROGRAM_FILE,
        ),
        requirement(
          "mcp",
          mcp.tools.map((t) => t.name),
          "every MCP tool",
          MCP_SERVER_FILE,
        ),
        requirement(
          "prompt",
          mcp.prompts.map((p) => p.name),
          "every MCP prompt",
          MCP_SERVER_FILE,
        ),
        requirement(
          "ipc",
          ipc.map((c) => c.name),
          "every desktop IPC channel",
          CHANNELS_FILE,
        ),
      ],
      findings: [...parity.findings, ...undocumentedChannels],
    });
  }
}

function args(list: readonly { name: string; required: boolean }[]): string {
  return list.map((a) => (a.required ? `\`${a.name}\`` : `\`${a.name}\`?`)).join(", ") || "—";
}

function requirement(kind: string, names: string[], reason: string, file: string) {
  return { kind, names, reason, locate: () => ({ file }) };
}
