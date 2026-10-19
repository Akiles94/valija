import { type Flow, parseFlow } from "../../domain/entities/flow.js";
import { assembleGuide, type MergedFacts } from "../../domain/services/guide-assembly.js";
import { findStalePages } from "../../domain/services/stale-pages.js";
import { createFinding, type Finding } from "../../domain/values/finding.js";
import type { GuideSettings } from "../../domain/values/guide-settings.js";
import { createGuideReport, type GuideReport } from "../dto/guide-report.js";
import { createExtractedFacts, type ExtractedFacts, type Extractor } from "../ports/extractor.js";
import type { GuideRenderer } from "../ports/guide-renderer.js";
import type { GuideWorkspace } from "../ports/guide-workspace.js";

/**
 * Builds the guide from code facts and flow sources, then either writes it (`write`) or compares
 * it with the committed copy (`check`). One pipeline for both modes, so they cannot drift.
 */
export class GenerateGuide {
  constructor(
    private readonly extractors: readonly Extractor[],
    private readonly workspace: GuideWorkspace,
    private readonly renderer: GuideRenderer,
    private readonly settings: GuideSettings,
  ) {}

  async execute(input: { mode: "write" | "check" }): Promise<GuideReport> {
    const facts = await this.extractAll();
    const flows = this.parseFlows(await this.workspace.readFlowSources());
    const overview = await this.workspace.readOverview();
    const guide = assembleGuide(facts, flows.parsed, overview, this.settings);
    const pages = this.renderer.render(guide);

    const syncFindings =
      input.mode === "check"
        ? findStalePages(pages, await this.workspace.readGuidePages(), this.settings.guideDir)
        : [];
    if (input.mode === "write") await this.workspace.writeGuidePages(pages);

    return createGuideReport(
      input.mode,
      [...flows.findings, ...guide.findings, ...syncFindings],
      guide.stats,
      input.mode === "write" ? pages.length : 0,
    );
  }

  /** Runs extractors in order; one that throws becomes a finding and the rest still run. */
  private async extractAll(): Promise<MergedFacts> {
    const all: ExtractedFacts[] = [];
    for (const extractor of this.extractors) {
      try {
        all.push(await extractor.extract());
      } catch (error) {
        const failure = createFinding({
          rule: "extractor-failure",
          file: this.settings.flowsDir,
          subject: extractor.name,
          message: `extractor "${extractor.name}" failed: ${(error as Error).message}`,
        });
        all.push(createExtractedFacts({ findings: [failure] }));
      }
    }
    return {
      symbols: all.flatMap((f) => f.symbols),
      catalogues: all.flatMap((f) => f.catalogues),
      graphs: all.flatMap((f) => f.graphs),
      requirements: all.flatMap((f) => f.requirements),
      findings: all.flatMap((f) => f.findings),
    };
  }

  private parseFlows(sources: { path: string; text: string }[]): {
    parsed: Flow[];
    findings: Finding[];
  } {
    const parsed: Flow[] = [];
    const findings: Finding[] = [];
    for (const source of sources) {
      const flow = parseFlow(source.path, source.text, this.settings.referenceKinds);
      if (flow.ok) parsed.push(flow.value);
      else findings.push(...flow.error);
    }
    return { parsed, findings };
  }
}
