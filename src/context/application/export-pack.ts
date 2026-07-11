import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { contextErr } from "../domain/errors.js";
import { parseProjectName } from "../domain/values/project-name.js";
import type { GetContextPack } from "./get-context-pack.js";
import type { VaultSessionFactory } from "./ports/vault-session.js";

export type ExportFormat = "md" | "json";

export class ExportPack {
  constructor(
    private readonly sessions: VaultSessionFactory,
    private readonly getContextPack: GetContextPack,
  ) {}

  execute(project: string, format: ExportFormat): Result<string, DomainError> {
    if (format === "md") {
      // Export is the everything-escape-hatch: no budget.
      const pack = this.getContextPack.execute({ project, budgetTokens: Number.MAX_SAFE_INTEGER });
      return pack.ok ? ok(pack.value.markdown) : pack;
    }

    const name = parseProjectName(project);
    if (!name.ok) return name;
    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      const found = session.value.projects.findByName(name.value);
      if (found === null) {
        return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
      }
      const items = session.value.items.findByProject(found.id).map((item) => ({
        id: item.id,
        type: item.type,
        content: item.content,
        tags: item.tags,
        pinned: item.pinned,
        source: item.source ?? null,
        createdAt: item.createdAt.toISOString(),
      }));
      return ok(JSON.stringify({ project: name.value, items }, null, 2));
    } finally {
      session.value.close();
    }
  }
}
