import { type DomainError, ok, type Result } from "../shared/domain/result.js";
import type { Container } from "./container.js";
import { renderContextPackMarkdown } from "./context-pack-markdown.js";

/**
 * The unbudgeted, everything-escape-hatch composition — one function shared
 * by `valija export` and the desktop app's pack view/export, so "byte-identical
 * to the CLI" is structural rather than a test that can drift.
 */
export function exportProjectMarkdown(c: Container, project: string): Result<string, DomainError> {
  const pack = c.getContextPack.execute({ project, budgetTokens: Number.POSITIVE_INFINITY });
  return pack.ok ? ok(renderContextPackMarkdown(pack.value)) : pack;
}

export function exportProjectJson(c: Container, project: string): Result<string, DomainError> {
  const items = c.showProject.execute({ project });
  return items.ok ? ok(JSON.stringify({ project, items: items.value }, null, 2)) : items;
}
