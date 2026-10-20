import type { GuidePage } from "../../domain/values/guide-page.js";

/** A hand-written flow source: repo-relative posix path plus its text. */
export interface FlowSource {
  readonly path: string;
  readonly text: string;
}

/** Where flow sources come from and where generated pages go. */
export interface GuideWorkspace {
  /** Flow sources, sorted by path; `README.md` and `_*.md` files are not flows. */
  readFlowSources(): Promise<FlowSource[]>;
  /** The product summary shown on the guide index (`_overview.md`), or "" when absent. */
  readOverview(): Promise<string>;
  /** Pages currently committed in the guide directory, sorted by path. */
  readGuidePages(): Promise<GuidePage[]>;
  /** Replaces the generated guide with `pages`, removing generated pages no longer produced. */
  writeGuidePages(pages: readonly GuidePage[]): Promise<void>;
}
