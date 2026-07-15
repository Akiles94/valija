import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import {
  assembleContextPack,
  type ContextPack,
  DEFAULT_BUDGET_TOKENS,
} from "../../domain/services/context-pack.js";
import { parseProjectName } from "../../domain/values/project-name.js";
import type { VaultSessions } from "../ports/vault-session.js";

export interface GetContextPackInput {
  project: string;
  /** Defaults to DEFAULT_BUDGET_TOKENS. Pass Infinity for the whole project (export). */
  budgetTokens?: number;
}

export class GetContextPack implements UseCase<GetContextPackInput, ContextPack> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
  ) {}

  execute(input: GetContextPackInput): Result<ContextPack, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;

    return this.sessions.withSession((session) => {
      const project = session.projects.findByName(name.value);
      if (project === null) {
        return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
      }
      return ok(
        assembleContextPack({
          projectName: name.value,
          items: session.items.findByProject(project.id),
          generatedAt: this.clock.now(),
          budgetTokens: input.budgetTokens ?? DEFAULT_BUDGET_TOKENS,
        }),
      );
    });
  }
}
