import type { ContextItem } from "../context/domain/entities/context-item.js";
import type { ContextPack, PackSection } from "../context/domain/services/context-pack.js";
import type { ItemType } from "../context/domain/values/item-type.js";

/** Section headings. The domain orders sections; naming them is presentation. */
const TYPE_LABELS: Record<ItemType, string> = {
  decision: "Decisions",
  preference: "Preferences",
  progress: "Progress",
  fact: "Facts",
  handoff: "Handoffs",
};

const sectionTitle = (section: PackSection): string => {
  switch (section.kind) {
    case "pinned":
      return "Pinned";
    case "latest-handoff":
      return "Latest handoff";
    case "by-type":
      return TYPE_LABELS[section.type];
  }
};

const renderItem = (item: ContextItem): string => {
  const date = item.createdAt.toISOString().slice(0, 10);
  const tags = item.tags.length > 0 ? ` · ${item.tags.map((t) => `#${t}`).join(" ")}` : "";
  return `### ${item.type} · ${date}${tags}\n\n${item.content}\n`;
};

/** Render an assembled pack as the markdown handed to a human or an LLM. */
export function renderContextPackMarkdown(pack: ContextPack): string {
  const header =
    `# Context pack: ${pack.projectName}\n\n` +
    `> ${pack.totalCount} items in vault · generated ${pack.generatedAt.toISOString()}\n`;
  const parts = pack.sections.flatMap((section) => [
    `\n## ${sectionTitle(section)}\n`,
    ...section.items.map(renderItem),
  ]);
  return header + parts.join("\n");
}
