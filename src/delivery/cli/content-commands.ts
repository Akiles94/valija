import { writeFileSync } from "node:fs";
import type { Container } from "../container.js";
import { exportProjectJson, exportProjectMarkdown } from "../context-pack-export.js";
import { fail, formatDate, itemHeaderLine, truncate } from "./render.js";

/** `valija projects`: prints each project with its item count and last activity. */
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

/** `valija show <project>`: prints a project's items with their ids, optionally of one type; `--archived` includes archived items. */
export function showCommand(
  c: Container,
  project: string,
  options: { type?: string; archived?: boolean },
): void {
  const result = c.showProject.execute({
    project,
    ...(options.type === undefined ? {} : { type: options.type }),
    ...(options.archived ? { includeArchived: true } : {}),
  });
  if (!result.ok) fail(result.error);
  if (result.value.length === 0) {
    console.log("No items.");
    return;
  }
  for (const item of result.value) {
    console.log(`\n${itemHeaderLine(item)}`);
    console.log(item.content);
  }
}

/** `valija search <query>`: prints full-text hits, optionally within one project. */
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

/**
 * `valija export <project>`: prints or writes the whole project as Markdown (or JSON with
 * `--json`).
 */
export function exportCommand(
  c: Container,
  project: string,
  options: { json?: boolean; output?: string },
): void {
  const format = options.json ? "json" : "md";
  const result = options.json ? exportProjectJson(c, project) : exportProjectMarkdown(c, project);
  if (!result.ok) fail(result.error);
  if (options.output !== undefined) {
    writeFileSync(options.output, result.value, "utf8");
    console.error(`Exported ${project} (${format}) to ${options.output}`);
  } else {
    console.log(result.value);
  }
}
