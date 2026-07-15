import type { ContextItem } from "../entities/context-item.js";
import type { ItemType } from "../values/item-type.js";
import type { ProjectName } from "../values/project-name.js";

export const DEFAULT_BUDGET_TOKENS = 4000;

/** Cheap token estimate: ~4 chars per token. Good enough for a budget, no tokenizer dep. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/** What one item costs against the budget: its body plus the metadata that travels with it. */
export const estimateItemTokens = (item: ContextItem): number =>
  estimateTokens(
    `${item.type} ${item.createdAt.toISOString().slice(0, 10)} ${item.tags.join(" ")}\n\n${item.content}`,
  );

/** Types that get their own section, in the order they appear in the pack. */
const SECTION_TYPE_ORDER = ["decision", "preference", "progress", "fact"] as const;

export type PackSection =
  | { readonly kind: "pinned"; readonly items: readonly ContextItem[] }
  | { readonly kind: "latest-handoff"; readonly items: readonly ContextItem[] }
  | { readonly kind: "by-type"; readonly type: ItemType; readonly items: readonly ContextItem[] };

export interface ContextPack {
  readonly projectName: ProjectName;
  readonly generatedAt: Date;
  readonly sections: readonly PackSection[];
  readonly includedCount: number;
  readonly totalCount: number;
  readonly estimatedTokens: number;
}

export interface AssembleContextPackInput {
  readonly projectName: ProjectName;
  /** Newest first, archived excluded — the repository contract. */
  readonly items: readonly ContextItem[];
  readonly generatedAt: Date;
  /** Omit for an unbudgeted pack (export); Infinity means the same thing. */
  readonly budgetTokens?: number;
}

/** Mutable working state while the pack is being assembled. */
interface Draft {
  readonly sections: PackSection[];
  readonly included: Set<string>;
  readonly budget: number;
  usedTokens: number;
}

const estimatePreambleTokens = (input: AssembleContextPackInput): number =>
  estimateTokens(
    `Context pack: ${input.projectName} — ${input.items.length} items, generated ${input.generatedAt.toISOString()}`,
  );

/**
 * Choose what fits in the budget, newest first, and in what order it reads:
 * pinned, then the latest handoff, then a section per type. No item repeats.
 * Formatting is not this layer's business — sections carry entities.
 */
export function assembleContextPack(input: AssembleContextPackInput): ContextPack {
  const draft: Draft = {
    sections: [],
    included: new Set(),
    budget: input.budgetTokens ?? Number.POSITIVE_INFINITY,
    usedTokens: estimatePreambleTokens(input),
  };

  addPinned(draft, input.items);
  addLatestHandoff(draft, input.items);
  addTypeSections(draft, input.items);

  return {
    projectName: input.projectName,
    generatedAt: input.generatedAt,
    sections: draft.sections,
    includedCount: draft.included.size,
    totalCount: input.items.length,
    estimatedTokens: draft.usedTokens,
  };
}

/**
 * Pinned items, newest first. The newest pinned item is always included,
 * even over budget; when the budget runs out, the oldest pinned are cut first.
 */
function addPinned(draft: Draft, items: readonly ContextItem[]): void {
  const pinned = items.filter((item) => item.pinned);
  if (pinned.length === 0) return;

  draft.usedTokens += estimateTokens("Pinned");
  const kept: ContextItem[] = [];
  for (const item of pinned) {
    const cost = estimateItemTokens(item);
    if (kept.length > 0 && draft.usedTokens + cost > draft.budget) break;
    kept.push(item);
    draft.usedTokens += cost;
    draft.included.add(item.id);
  }
  draft.sections.push({ kind: "pinned", items: kept });
}

/** The latest handoff, if any and if it fits the remaining budget. */
function addLatestHandoff(draft: Draft, items: readonly ContextItem[]): void {
  const handoff = items.find((item) => item.type === "handoff" && !draft.included.has(item.id));
  if (handoff === undefined) return;

  const cost = estimateItemTokens(handoff) + estimateTokens("Latest handoff");
  if (draft.usedTokens + cost > draft.budget) return;
  draft.usedTokens += cost;
  draft.sections.push({ kind: "latest-handoff", items: [handoff] });
  draft.included.add(handoff.id);
}

/** Recent items by type in section order, newest first, until the budget is reached. */
function addTypeSections(draft: Draft, items: readonly ContextItem[]): void {
  for (const type of SECTION_TYPE_ORDER) {
    const candidates = items.filter((item) => item.type === type && !draft.included.has(item.id));
    const kept: ContextItem[] = [];
    for (const item of candidates) {
      const cost = estimateItemTokens(item) + (kept.length === 0 ? estimateTokens(type) : 0);
      if (draft.usedTokens + cost > draft.budget) break;
      kept.push(item);
      draft.usedTokens += cost;
      draft.included.add(item.id);
    }
    if (kept.length > 0) draft.sections.push({ kind: "by-type", type, items: kept });
  }
}
