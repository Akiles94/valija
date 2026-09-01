import { writeFileSync } from "node:fs";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import type { Container } from "../container.js";
import { renderContextPackMarkdown } from "../context-pack-markdown.js";
import { fail, formatDate, truncate } from "./render.js";

export function projectsCommand(c: Container): void {
  const result = c.listProjects.execute();
  if (!result.ok) fail(result.error);
  if (result.value.length === 0) {
    console.log(
      "No projects yet. Save context from an AI tool, or check back after your first session.",
    );
    return;
  }
  console.log("PROJECT                          ITEMS  LAST ACTIVITY");
  for (const p of result.value) {
    console.log(
      `${p.name.padEnd(32)} ${String(p.itemCount).padStart(5)}  ${formatDate(p.lastActivityAt)}`,
    );
  }
}

export function showCommand(c: Container, project: string, options: { type?: string }): void {
  const result = c.showProject.execute({
    project,
    ...(options.type === undefined ? {} : { type: options.type }),
  });
  if (!result.ok) fail(result.error);
  if (result.value.length === 0) {
    console.log("No items.");
    return;
  }
  for (const item of result.value) {
    const pin = item.pinned ? " 📌" : "";
    const tags = item.tags.length > 0 ? `  [${item.tags.join(", ")}]` : "";
    console.log(`\n— ${item.type} · ${formatDate(item.createdAt)}${pin}${tags}`);
    console.log(item.content);
  }
}

export function searchCommand(c: Container, query: string, options: { project?: string }): void {
  const result = c.searchContext.execute({
    query,
    ...(options.project === undefined ? {} : { project: options.project }),
  });
  if (!result.ok) fail(result.error);
  if (result.value.length === 0) {
    console.log("No matches.");
    return;
  }
  for (const hit of result.value) {
    console.log(
      `${hit.project}  ${hit.type.padEnd(10)}  ${formatDate(hit.createdAt)}  ${truncate(hit.content)}`,
    );
  }
}

/** Export is the everything-escape-hatch: the whole project, no budget. */
const exportMarkdown = (c: Container, project: string): Result<string, DomainError> => {
  const pack = c.getContextPack.execute({ project, budgetTokens: Number.POSITIVE_INFINITY });
  return pack.ok ? ok(renderContextPackMarkdown(pack.value)) : pack;
};

const exportJson = (c: Container, project: string): Result<string, DomainError> => {
  const items = c.showProject.execute({ project });
  return items.ok ? ok(JSON.stringify({ project, items: items.value }, null, 2)) : items;
};

export function exportCommand(
  c: Container,
  project: string,
  options: { json?: boolean; output?: string },
): void {
  const format = options.json ? "json" : "md";
  const result = options.json ? exportJson(c, project) : exportMarkdown(c, project);
  if (!result.ok) fail(result.error);
  if (options.output !== undefined) {
    writeFileSync(options.output, result.value, "utf8");
    console.error(`Exported ${project} (${format}) to ${options.output}`);
  } else {
    console.log(result.value);
  }
}
