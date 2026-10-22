import type { ProjectListEntry } from "../../../context/application/use-cases/list-projects.use-case.js";
import type { SaveContextOutput } from "../../../context/application/use-cases/save-context.use-case.js";
import type { DomainError, Result } from "../../../shared/domain/result.js";
import { err, ok } from "../../../shared/domain/result.js";
import type { InMemoryKeychain } from "../../../vault/infra/in-memory-keychain.js";
import type { Container } from "../../container.js";
import { renderContextPackMarkdown } from "../../context-pack-markdown.js";
import type {
  ForkNotice,
  ProjectSummary,
  SavedItem,
  ValijaVault,
  VaultMode,
} from "../dto/results.js";
import type { ValijaError } from "../dto/valija-error.js";
import { toValijaError, unexpectedError } from "../mapping/to-valija-error.js";
import {
  contextPackSchema,
  handoffSchema,
  parseInput,
  saveSchema,
  searchSchema,
} from "../validation/sdk-schemas.js";
import { type IdleLockTimer, startIdleLockTimer } from "./idle-lock-timer.js";

export interface HandleWiring {
  mode: VaultMode;
  container: Container;
  client: string;
  vaultId: string;
  /** Mode P only: the handle's own key store. */
  keychain?: InMemoryKeychain;
  forkNotice?: ForkNotice;
}

const CLOSED: ValijaError = {
  code: "VAULT_LOCKED",
  message: "This vault handle is closed. Open the vault again to keep using it.",
};

/** Mode P has no Valija session to point at: the key is simply gone from this handle. */
const IN_PROCESS_LOCKED: ValijaError = {
  code: "VAULT_LOCKED",
  message:
    "This vault handle no longer holds its key (locked, closed, or idle past the auto-lock " +
    "time). Open the vault again with the passphrase or recovery key.",
};

/**
 * One open vault. Every content call validates its input, runs one use case in its own session and
 * maps the outcome — nothing is cached across calls (§8). Fields are passed to the use cases one by
 * one: no `pinned` (D-K), no secret override (D-L), `source` is always the client label (D-U).
 */
export function createVaultHandle(wiring: HandleWiring): ValijaVault {
  const { container: c, client, vaultId, keychain } = wiring;
  let closed = false;

  let timer: IdleLockTimer = { stop: () => {} };
  const forgetKey = (): void => {
    timer.stop();
    keychain?.deleteKey(vaultId);
  };
  if (keychain !== undefined) {
    timer = startIdleLockTimer(
      c.autoLockMinutes,
      () => c.deviceIdentity.lastActivityAt(vaultId),
      forgetKey,
    );
  }

  const mapError = (error: DomainError): ValijaError =>
    keychain !== undefined && error.code === "VAULT_LOCKED"
      ? IN_PROCESS_LOCKED
      : toValijaError(error);

  async function run<T>(call: () => Result<T, DomainError>): Promise<Result<T, ValijaError>> {
    if (closed) return err(CLOSED);
    try {
      const result = call();
      return result.ok ? result : err(mapError(result.error));
    } catch (thrown) {
      return err(unexpectedError(thrown));
    }
  }

  const handle: ValijaVault = {
    vaultId,
    mode: wiring.mode,
    ...(wiring.forkNotice === undefined ? {} : { forkNotice: wiring.forkNotice }),

    async save(request) {
      const input = parseInput(saveSchema, request);
      if (!input.ok) return input;
      const { project, content, type, tags, supersedes } = input.value;
      return run(() => {
        const saved = c.saveContext.execute({
          project,
          content,
          source: client,
          ...(type === undefined ? {} : { type }),
          ...(tags === undefined ? {} : { tags }),
          ...(supersedes === undefined ? {} : { supersedes }),
        });
        return saved.ok ? ok(toSavedItem(saved.value)) : saved;
      });
    },

    async saveHandoff(request) {
      const input = parseInput(handoffSchema, request);
      if (!input.ok) return input;
      const { project, content } = input.value;
      return run(() => {
        const saved = c.saveContext.execute({ project, content, type: "handoff", source: client });
        return saved.ok ? ok(toSavedItem(saved.value)) : saved;
      });
    },

    async getContextPack(request) {
      const input = parseInput(contextPackSchema, request);
      if (!input.ok) return input;
      const { project, budgetTokens } = input.value;
      return run(() => {
        const pack = c.getContextPack.execute({
          project,
          ...(budgetTokens === undefined ? {} : { budgetTokens }),
        });
        if (!pack.ok) return pack;
        return ok({
          project: pack.value.projectName as string,
          markdown: renderContextPackMarkdown(pack.value),
        });
      });
    },

    async search(request) {
      const input = parseInput(searchSchema, request);
      if (!input.ok) return input;
      const { query, project, limit } = input.value;
      return run(() => {
        const hits = c.searchContext.execute({
          query,
          ...(project === undefined ? {} : { project }),
          ...(limit === undefined ? {} : { limit }),
        });
        if (!hits.ok) return hits;
        return ok(
          hits.value.map(({ id, project, type, createdAt, content }) => ({
            id,
            project,
            type,
            createdAt,
            content,
          })),
        );
      });
    },

    // No workspace marker, no detection, and VALIJA_PROJECT is never read (D-M).
    async listProjects() {
      return run(() => {
        const projects = c.listProjects.execute();
        if (!projects.ok) return projects;
        return ok(projects.value.map(toProjectSummary));
      });
    },

    async lock() {
      if (keychain !== undefined) {
        forgetKey(); // ⚑ D-A.1: this handle's key only — the OS keychain is never touched.
        return ok(undefined);
      }
      return run(() => {
        const locked = c.lockVault.execute(); // D-B: the same as `valija lock`, on every surface.
        return locked.ok ? ok(undefined) : locked;
      });
    },

    async close() {
      if (!closed) forgetKey();
      closed = true;
      return ok(undefined);
    },
  };
  return handle;
}

const toSavedItem = (output: SaveContextOutput): SavedItem => ({
  itemId: output.itemId,
  project: output.project,
  type: output.type,
  projectCreated: output.projectCreated,
  ...(output.supersededItemId === undefined ? {} : { supersededItemId: output.supersededItemId }),
});

const toProjectSummary = (entry: ProjectListEntry): ProjectSummary => ({
  name: entry.name,
  itemCount: entry.itemCount,
  lastActivityAt: entry.lastActivityAt,
  ...(entry.description === undefined ? {} : { description: entry.description }),
});
