import type { ContextItem } from "../../domain/entities/context-item.js";
import { type DomainError, domainErr, ok, type Result } from "../../domain/errors.js";
import type { Clock } from "../../domain/ports/clock.js";
import type { VaultSessionFactory } from "../../domain/ports/vault-session.js";
import { parseProjectName } from "../../domain/values/project-name.js";

export const DEFAULT_BUDGET_TOKENS = 4000;

/** Cheap token estimate: ~4 chars per token. Good enough for a budget, no tokenizer dep. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const SECTION_ORDER = ["decision", "preference", "progress", "fact"] as const;

export interface GetContextPackInput {
  project: string;
  budgetTokens?: number;
}

export interface ContextPack {
  markdown: string;
  includedCount: number;
  totalCount: number;
  estimatedTokens: number;
}

const renderItem = (item: ContextItem): string => {
  const date = item.createdAt.toISOString().slice(0, 10);
  const tags = item.tags.length > 0 ? ` · ${item.tags.map((t) => `#${t}`).join(" ")}` : "";
  return `### ${item.type} · ${date}${tags}\n\n${item.content}\n`;
};

export class GetContextPack {
  constructor(
    private readonly sessions: VaultSessionFactory,
    private readonly clock: Clock,
  ) {}

  execute(input: GetContextPackInput): Result<ContextPack, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;
    const budget = input.budgetTokens ?? DEFAULT_BUDGET_TOKENS;

    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      const project = session.value.projects.findByName(name.value);
      if (project === null) {
        return domainErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
      }
      // Newest first, archived excluded — repository contract.
      const all = session.value.items.findByProject(project.id);
      const included = new Set<string>();
      const parts: string[] = [];
      let used = 0;

      const header =
        `# Context pack: ${name.value}\n\n` +
        `> ${all.length} items in vault · generated ${this.clock.now().toISOString()}\n`;
      used += estimateTokens(header);

      // 1. Pinned: all included, newest first; if they alone bust the budget,
      //    the oldest pinned are cut first — but never the newest one.
      const pinned = all.filter((i) => i.pinned);
      const pinnedKept: ContextItem[] = [];
      for (const item of pinned) {
        const cost = estimateTokens(renderItem(item));
        if (pinnedKept.length > 0 && used + cost > budget) break;
        pinnedKept.push(item);
        used += cost;
      }
      if (pinnedKept.length > 0) {
        parts.push("\n## Pinned\n");
        for (const item of pinnedKept) {
          parts.push(renderItem(item));
          included.add(item.id);
        }
      }

      // 2. Latest handoff, if it fits.
      const handoff = all.find((i) => i.type === "handoff" && !included.has(i.id));
      if (handoff) {
        const rendered = renderItem(handoff);
        const cost = estimateTokens(rendered);
        if (used + cost <= budget) {
          parts.push("\n## Latest handoff\n", rendered);
          included.add(handoff.id);
          used += cost;
        }
      }

      // 3. Recent items by type, in section order, newest first, until the budget is reached.
      for (const type of SECTION_ORDER) {
        const items = all.filter((i) => i.type === type && !included.has(i.id));
        let sectionOpened = false;
        for (const item of items) {
          const rendered = renderItem(item);
          const sectionHeader = sectionOpened
            ? ""
            : `\n## ${type[0]?.toUpperCase()}${type.slice(1)}s\n`;
          const cost = estimateTokens(sectionHeader + rendered);
          if (used + cost > budget) break;
          if (!sectionOpened) {
            parts.push(sectionHeader);
            sectionOpened = true;
          }
          parts.push(rendered);
          included.add(item.id);
          used += cost;
        }
      }

      const markdown = header + parts.join("\n");
      return ok({
        markdown,
        includedCount: included.size,
        totalCount: all.length,
        estimatedTokens: estimateTokens(markdown),
      });
    } finally {
      session.value.close();
    }
  }
}
