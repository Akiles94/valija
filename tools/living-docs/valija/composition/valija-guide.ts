import type { Extractor } from "../../core/application/ports/extractor.js";
import type { GuideSettings } from "../../core/domain/values/guide-settings.js";
import { TypeScriptExportsExtractor } from "../../core/infra/typescript-exports-extractor.js";
import { ArchitectureExtractor } from "../extractors/architecture.extractor.js";
import { EntryPointsExtractor } from "../extractors/entry-points.extractor.js";
import { ErrorCodesExtractor } from "../extractors/error-codes.extractor.js";
import { UseCasesExtractor } from "../extractors/use-cases.extractor.js";
import type { ParityDeclaration } from "../services/surface-parity.js";

/** The single configuration point for Valija's guide: folders, title, theme order, kinds. */
export const VALIJA_GUIDE_SETTINGS: GuideSettings = {
  title: "Valija developer guide",
  flowsDir: "docs/flows",
  guideDir: "docs/guide",
  themeOrder: [
    "Vault lifecycle",
    "Working with context",
    "Bringing history in",
    "Connecting AI tools",
    "Health and devices",
    "Desktop app",
  ],
  referenceKinds: ["cli", "mcp", "prompt", "ipc", "err"],
};

/**
 * CLI ↔ desktop parity that automatic pairing (same use case) cannot see. Every entry says why;
 * anything neither paired nor declared fails `docs:check` (D-12).
 */
export const VALIJA_PARITY: readonly ParityDeclaration[] = [
  {
    knownGap: [
      "relocation:preflight",
      "relocation:move",
      "relocation:retryClient",
      "relocation:pointAtExisting",
      "dialog:chooseVaultFolder",
    ],
    reason: "`valija relocate` is owed to a future advance (CLAUDE.md)",
  },
  { surfaceSpecific: ["mcp"], reason: "AI tools spawn it; humans never run it" },
  { surfaceSpecific: ["preferences:read", "preferences:write"], reason: "desktop-only UI state" },
  {
    surfaceSpecific: ["dialog:chooseImportFile"],
    reason: "the CLI takes the export file as a path argument",
  },
  {
    surfaceSpecific: ["dialog:chooseProjectFolder"],
    reason: "the CLI links and inspects the current folder, or the one passed with --dir",
  },
  {
    pair: { cli: "install", ipc: ["tools:status", "tools:connect", "tools:nodeStatus"] },
    reason: "both wire the MCP server into AI tool configs (no use case: installer adapters)",
  },
  {
    pair: { cli: "doctor", ipc: ["diagnostics:run", "diagnostics:copyReport"] },
    reason: "both run and report the same diagnostics",
  },
  {
    pair: { cli: "init", ipc: ["vault:init", "vault:readRecoveryKit"] },
    reason: "the CLI prints the recovery kit; the desktop app reads it once over IPC",
  },
  {
    pair: { cli: "change-passphrase", ipc: ["vault:changePassphrase", "vault:readRecoveryKit"] },
    reason: "the CLI prints the new recovery kit; the desktop app reads it once over IPC",
  },
  {
    pair: { cli: "unlock", ipc: ["vault:unlock", "vault:upgradeCheck"] },
    reason: "the CLI upgrades the schema silently on unlock; the desktop app asks first",
  },
  {
    pair: { cli: "status", ipc: ["vault:status", "sync:status"] },
    reason: "the CLI status also shows the vault folder; the desktop app reads it separately",
  },
  {
    pair: { cli: "export", ipc: ["content:pack", "content:export", "content:copy"] },
    reason: "the CLI prints or writes the pack; the desktop app shows, saves or copies it",
  },
];

/** Every extractor, explicitly and in order; they share one scan of the sources. */
export function createValijaExtractors(repoRoot: string): Extractor[] {
  const exports = new TypeScriptExportsExtractor({
    repoRoot,
    roots: ["src", "desktop/src"],
    docRequired: () => true,
  });
  const sources = () => exports.sources().files;
  return [
    exports,
    new UseCasesExtractor(sources),
    new EntryPointsExtractor(sources, VALIJA_PARITY),
    new ArchitectureExtractor(repoRoot, sources),
    new ErrorCodesExtractor(sources),
  ];
}
