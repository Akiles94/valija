import type { Guide } from "../../domain/entities/guide.js";
import type { GuidePage } from "../../domain/values/guide-page.js";

/** Turns the assembled guide into pages; must be deterministic byte for byte. */
export interface GuideRenderer {
  render(guide: Guide): GuidePage[];
}
