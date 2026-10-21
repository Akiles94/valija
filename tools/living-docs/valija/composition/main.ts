import { existsSync } from "node:fs";
import { join } from "node:path";
import { formatGuideReport, runGuide } from "living-docs";
import { createValijaExtractors, VALIJA_GUIDE_SETTINGS } from "./valija-guide.js";

/** `npm run docs` (write) and `npm run docs:check` (check): exit 0 clean, 1 findings, 2 misuse. */
async function main(): Promise<number> {
  const mode = process.argv[2];
  if (mode !== "write" && mode !== "check") {
    console.error("usage: living-docs <write|check>");
    return 2;
  }
  const repoRoot = process.cwd();
  if (!existsSync(join(repoRoot, "tools/living-docs"))) {
    console.error("living-docs: run from the repository root (npm run docs)");
    return 2;
  }
  const report = await runGuide({
    repoRoot,
    settings: VALIJA_GUIDE_SETTINGS,
    extractors: createValijaExtractors(repoRoot),
    mode,
  });
  for (const line of formatGuideReport(report)) console.log(line);
  return report.findings.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`living-docs: ${(error as Error).message}`);
    process.exit(2);
  },
);
