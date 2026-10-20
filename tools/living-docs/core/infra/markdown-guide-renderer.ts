import type { GuideRenderer } from "../application/ports/guide-renderer.js";
import { FLOW_SECTIONS } from "../domain/entities/flow.js";
import type { Guide, ResolvedFlow } from "../domain/entities/guide.js";
import { byCodeUnit } from "../domain/result.js";
import type { Resolution } from "../domain/services/reference-index.js";
import { type Catalogue, type Cell, itemAnchor } from "../domain/values/catalogue.js";
import type { Graph } from "../domain/values/graph.js";
import type { GuidePage } from "../domain/values/guide-page.js";
import { GENERATED_BANNER } from "./file-guide-workspace.js";
import { renderFlowchart, renderSequenceDiagram } from "./mermaid-diagrams.js";

/**
 * Renders the guide as Markdown + Mermaid. Every link is a posix path relative to the page it
 * sits on; there are no timestamps or absolute paths, so the same inputs give the same bytes.
 */
export class MarkdownGuideRenderer implements GuideRenderer {
  render(guide: Guide): GuidePage[] {
    const sections = groupByPage(guide);
    const pages: GuidePage[] = [
      page("README.md", this.index(guide, [...sections.keys()])),
      ...guide.flows.map((f) => page(`flows/${f.flow.slug}.md`, this.flowPage(guide, f))),
      ...[...sections].map(([path, items]) => page(path, this.sectionPage(guide, path, items))),
    ];
    return pages.sort((a, b) => byCodeUnit(a.path, b.path));
  }

  private index(guide: Guide, sectionPages: string[]): string {
    const out = [`# ${guide.settings.title}`, ""];
    if (guide.overview) out.push(linkify(guide, "README.md", guide.overview), "");

    out.push("## Understand the product", "");
    out.push(
      "Each flow page opens with the business view: who, why, the rules, what can go wrong.",
    );
    for (const [theme, flows] of byTheme(guide)) {
      out.push("", `### ${theme}`, "");
      for (const { flow } of flows) {
        const why = firstSentence(flow.sections.get("Why")?.text ?? "");
        out.push(`- [${flow.title}](flows/${flow.slug}.md)${why ? ` — ${plain(why)}` : ""}`);
      }
    }

    out.push("", "## I'm going to touch code", "");
    out.push(
      "Start with the architecture, then the reference tables; every flow page ends with",
      "a sequence diagram and steps linked to the code.",
      "",
    );
    for (const path of sectionPages) out.push(`- [${pageTitle(guide, path)}](${path})`);
    return out.join("\n");
  }

  private flowPage(guide: Guide, resolved: ResolvedFlow): string {
    const { flow } = resolved;
    const here = `flows/${flow.slug}.md`;
    const text = (heading: string) =>
      linkify(guide, here, flow.sections.get(heading)?.text ?? "", resolved.resolutions);
    const out = ["[← Guide](../README.md)", "", `# ${flow.title}`, "", `*Theme: ${flow.theme}*`];
    for (const heading of FLOW_SECTIONS.business) out.push("", `## ${heading}`, "", text(heading));

    out.push("", "## How it works", "", "### Entry points", "", text("Entry points"));
    out.push("", "### Sequence", "", renderSequenceDiagram(flow.steps));
    out.push("", "### Steps", "");
    for (const step of flow.steps) {
      const body = linkify(guide, here, step.text, resolved.resolutions);
      out.push(`${step.number}. **${step.from} → ${step.to}:** ${body}`);
    }
    out.push("", "## Errors", "", text("Errors"));
    return out.join("\n");
  }

  private sectionPage(guide: Guide, path: string, items: (Catalogue | Graph)[]): string {
    const depth = path.split("/").length - 1;
    const out = [`[← Guide](${"../".repeat(depth)}README.md)`, "", `# ${pageTitle(guide, path)}`];
    for (const item of items) {
      if (items.length > 1) out.push("", `## ${item.title}`);
      if (item.intro) out.push("", linkify(guide, path, item.intro));
      out.push("", "rows" in item ? table(guide, path, item) : renderFlowchart(item));
    }
    return out.join("\n");
  }
}

function page(path: string, body: string): GuidePage {
  return { path, content: `${GENERATED_BANNER}\n\n${body.trimEnd()}\n` };
}

function groupByPage(guide: Guide): Map<string, (Catalogue | Graph)[]> {
  const pages = new Map<string, (Catalogue | Graph)[]>();
  const items = [...guide.graphs, ...guide.catalogues].sort(
    (a, b) =>
      byCodeUnit(a.page, b.page) || (a.position ?? 0) - (b.position ?? 0) || byCodeUnit(a.id, b.id),
  );
  for (const item of items) pages.set(item.page, [...(pages.get(item.page) ?? []), item]);
  return new Map([...pages].sort(([a], [b]) => byCodeUnit(a, b)));
}

function pageTitle(guide: Guide, path: string): string {
  const items = groupByPage(guide).get(path) ?? [];
  if (items.length === 1) return (items[0] as Catalogue | Graph).title;
  const base = (path.split("/").at(-1) ?? path).replace(/\.md$/, "").replace(/-/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function byTheme(guide: Guide): [string, ResolvedFlow[]][] {
  const themes = new Map<string, ResolvedFlow[]>();
  for (const f of guide.flows) themes.set(f.flow.theme, [...(themes.get(f.flow.theme) ?? []), f]);
  const rank = (theme: string) => {
    const at = guide.settings.themeOrder.indexOf(theme);
    return at < 0 ? guide.settings.themeOrder.length : at;
  };
  return [...themes].sort(([a], [b]) => rank(a) - rank(b) || byCodeUnit(a, b));
}

function table(guide: Guide, here: string, catalogue: Catalogue): string {
  const header = `| ${catalogue.columns.join(" | ")} |`;
  const rule = `|${catalogue.columns.map(() => "---").join("|")}|`;
  const rows = catalogue.rows.map((row) => {
    const cells = row.cells.map((cell, i) => {
      const text = renderCell(guide, here, cell);
      return i === 0 && row.key ? `<a id="${itemAnchor(row.key)}"></a>${text}` : text;
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [header, rule, ...rows].join("\n");
}

function renderCell(guide: Guide, here: string, cell: Cell): string {
  if (cell.links) {
    return cell.links
      .map((l) => {
        const target = l.repo ? repoLink(guide, here, l.href) : relative(here, l.href);
        return `[${escapeCell(l.text)}](${target})`;
      })
      .join(", ");
  }
  const text = escapeCell(cell.text);
  if (cell.href) return `[${text}](${repoLink(guide, here, cell.href)})`;
  return text;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

/** Replaces each `{{…}}` with a link to what it resolved to; unresolved ones stay as code. */
function linkify(
  guide: Guide,
  here: string,
  text: string,
  resolutions: ReadonlyMap<string, Resolution> = new Map(),
): string {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_whole, inner: string) => {
    const resolution = resolutions.get(inner.trim());
    if (!resolution) return `\`${inner.trim()}\``;
    if (resolution.target === "symbol") {
      return `[\`${resolution.symbol.name}\`](${repoLink(guide, here, resolution.symbol.file)})`;
    }
    const key = resolution.row.key;
    const label = key?.label ?? resolution.reference.name;
    const anchor = key ? `#${itemAnchor(key)}` : "";
    return `[\`${label}\`](${relative(here, resolution.catalogue.page)}${anchor})`;
  });
}

/** Link from a guide page to a repo file (no line anchor, so unrelated edits stay quiet — P-D5). */
function repoLink(guide: Guide, here: string, repoPath: string): string {
  const up = guide.settings.guideDir.split("/").length + here.split("/").length - 1;
  return `${"../".repeat(up)}${repoPath}`;
}

/** Posix relative path between two guide-relative files. */
function relative(from: string, to: string): string {
  const fromDirs = from.split("/").slice(0, -1);
  const target = to.split("/");
  let common = 0;
  while (common < fromDirs.length && fromDirs[common] === target[common]) common++;
  return [...fromDirs.slice(common).map(() => ".."), ...target.slice(common)].join("/");
}

function firstSentence(text: string): string {
  return (text.split(/(?<=[.!?])\s/)[0] ?? "").trim();
}

function plain(text: string): string {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_, raw: string) => raw.split("/").at(-1) ?? raw);
}
