import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ITEM_TYPES } from "../../context/domain/values/item-type.js";
import { type DomainError, ok as okResult, type Result } from "../../shared/domain/result.js";
import type { Container } from "../container.js";
import { renderContextPackMarkdown } from "../context-pack-markdown.js";
import { chooseProject, detectionLabel, type ProjectChoice } from "../project-detection.js";
import { VERSION } from "../version.js";
import {
  processWorkspaceEnvironment,
  type WorkspaceEnvironment,
  workspaceDirectories,
} from "./workspace-directories.js";

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (error: DomainError) => ({
  content: [{ type: "text" as const, text: `${error.message} [${error.code}]` }],
  isError: true,
});

const DESCRIPTIONS = {
  save_context:
    "Save durable context about a project for future sessions in any AI tool. " +
    "Use when the user asks to save or remember something, or at the end of a working session. " +
    "Write `content` so it is self-contained and specific for a reader with no other context: " +
    "decisions made and why, current state, conventions and preferences established, next steps, " +
    "unresolved questions. Never include secrets, API keys, or passwords. " +
    "If this save replaces an outdated item (a reversed decision, stale progress), pass its id as " +
    "`supersedes`.",
  save_handoff:
    "Package the state of THIS conversation so another AI tool or session can continue seamlessly. " +
    "Structure `content` as: goal, what was done, current blockers, exact next step, " +
    "relevant files or links.",
  get_context:
    "Load the saved context pack for a project before starting work on it. Returns pinned and " +
    "recent context (decisions, preferences, progress, latest handoff) as markdown within a " +
    "token budget. Call this when the user asks to load, resume, or continue a project. " +
    "Omit `project` to load the project linked to the user's workspace.",
  search_context:
    "Full-text search across saved context. Use for specific recall questions such as " +
    "'what did we decide about auth?'. Returns matching items with project, type, date, and id.",
  list_projects:
    "List existing projects with item counts and last activity. Use to disambiguate which " +
    "project the user means before saving or loading. The project linked to the user's " +
    "workspace, if any, is marked (this workspace).",
} as const;

/** How every detection failure ends: the model asks the user instead of guessing (D-G). */
const MCP_REMEDY =
  "Call list_projects, ask the user which project they mean, then pass it as `project`.";

const DETECTED_PROJECT =
  "Omit it to use the project the user linked to this workspace; if none is linked the call " +
  "fails with PROJECT_NOT_DETECTED — then call list_projects and ask.";

/** ` (detected: linked repository)` — the kind only, never a path or a remote (D-I). */
const detectionNote = (choice: ProjectChoice): string =>
  choice.detectedBy === undefined ? "" : ` (detected: ${detectionLabel(choice.detectedBy)})`;

/**
 * Builds the MCP server AI tools talk to: five tools (save, hand off, load, search, list) and two
 * prompts, each a thin call into one use case. An omitted project is detected from the client's
 * workspace (its roots, else this process's folder).
 */
export function buildMcpServer(
  c: Container,
  workspace: WorkspaceEnvironment = processWorkspaceEnvironment(),
): McpServer {
  const server = new McpServer({ name: "valija", version: VERSION });
  const clientName = (): string | undefined => server.server.getClientVersion()?.name;
  // An explicit project never asks the client for roots (refined.md §2.5: byte-identical to before).
  const projectFor = async (
    explicit: string | undefined,
  ): Promise<Result<ProjectChoice, DomainError>> =>
    explicit !== undefined
      ? okResult({ project: explicit })
      : chooseProject(
          c,
          undefined,
          await workspaceDirectories(server.server, workspace),
          MCP_REMEDY,
        );

  server.registerTool(
    "save_context",
    {
      title: "Save context",
      description: DESCRIPTIONS.save_context,
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            `Project slug, e.g. 'vault-app'. Created if it does not exist. ${DETECTED_PROJECT}`,
          ),
        content: z.string().describe("Self-contained markdown. Max 32 KB."),
        type: z.enum(ITEM_TYPES).optional().describe("Kind of context. Defaults to 'fact'."),
        tags: z.array(z.string()).max(10).optional().describe("Lowercase tags for recall."),
        supersedes: z
          .string()
          .max(64)
          .optional()
          .describe(
            "Optional. The full id of ONE item in this same project that this save replaces — " +
              "find it with search_context first. That item is archived (hidden from packs and " +
              "search, not deleted). The whole call fails, and nothing is saved, if the id is " +
              "unknown, in another project, pinned, imported, or already archived.",
          ),
      },
    },
    async ({ project, content, type, tags, supersedes }) => {
      const choice = await projectFor(project);
      if (!choice.ok) return err(choice.error);
      const source = clientName();
      const r = c.saveContext.execute({
        project: choice.value.project,
        content,
        ...(type === undefined ? {} : { type }),
        ...(tags === undefined ? {} : { tags }),
        ...(source === undefined ? {} : { source }),
        ...(supersedes === undefined ? {} : { supersedes }),
      });
      if (!r.ok) return err(r.error);
      const superseded = r.value.supersededItemId;
      return ok(
        `Saved ${r.value.type} to project "${r.value.project}"${detectionNote(choice.value)}` +
          `${r.value.projectCreated ? " (project created)" : ""}. Item id: ${r.value.itemId}.` +
          `${superseded === undefined ? "" : ` Archived superseded item ${superseded}.`}`,
      );
    },
  );

  server.registerTool(
    "save_handoff",
    {
      title: "Save handoff",
      description: DESCRIPTIONS.save_handoff,
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(`Project slug. Created if it does not exist. ${DETECTED_PROJECT}`),
        content: z
          .string()
          .describe("Goal, what was done, blockers, exact next step, relevant files or links."),
      },
    },
    async ({ project, content }) => {
      const choice = await projectFor(project);
      if (!choice.ok) return err(choice.error);
      const source = clientName();
      const r = c.saveContext.execute({
        project: choice.value.project,
        content,
        type: "handoff",
        ...(source === undefined ? {} : { source }),
      });
      if (!r.ok) return err(r.error);
      return ok(
        `Handoff saved to project "${r.value.project}"${detectionNote(choice.value)}. ` +
          `Item id: ${r.value.itemId}.`,
      );
    },
  );

  server.registerTool(
    "get_context",
    {
      title: "Get context pack",
      description: DESCRIPTIONS.get_context,
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Project slug to load. Omit it to use the project the user linked to this " +
              "workspace; if none is linked the call fails with PROJECT_NOT_DETECTED — then " +
              "call list_projects and ask.",
          ),
        budget: z.number().int().positive().optional().describe("Token budget. Default 4000."),
      },
    },
    async ({ project, budget }) => {
      const choice = await projectFor(project);
      if (!choice.ok) return err(choice.error);
      // No detection line: the pack header already names the project (D-I).
      const r = c.getContextPack.execute({
        project: choice.value.project,
        ...(budget === undefined ? {} : { budgetTokens: budget }),
      });
      if (!r.ok) return err(r.error);
      return ok(renderContextPackMarkdown(r.value));
    },
  );

  server.registerTool(
    "search_context",
    {
      title: "Search context",
      description: DESCRIPTIONS.search_context,
      inputSchema: {
        query: z.string().describe("Full-text query, e.g. 'auth decision'."),
        project: z.string().optional().describe("Limit to one project."),
        limit: z.number().int().positive().max(100).optional().describe("Max results. Default 20."),
      },
    },
    async ({ query, project, limit }) => {
      const r = c.searchContext.execute({
        query,
        ...(project === undefined ? {} : { project }),
        ...(limit === undefined ? {} : { limit }),
      });
      if (!r.ok) return err(r.error);
      if (r.value.length === 0) return ok("No matches.");
      const lines = r.value.map(
        (hit) =>
          `- [${hit.project}] (${hit.type}, ${hit.createdAt.slice(0, 10)}, id ${hit.id}) ${hit.content}`,
      );
      return ok(`${r.value.length} match(es):\n\n${lines.join("\n")}`);
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: DESCRIPTIONS.list_projects,
      inputSchema: {},
    },
    async () => {
      const r = c.listProjects.execute();
      if (!r.ok) return err(r.error);
      if (r.value.length === 0) return ok("No projects in the vault yet.");
      // The marker is a courtesy: a failed detection just leaves every line unmarked (D-I, P-14).
      const detected = await projectFor(undefined);
      const here = detected.ok ? detected.value.project : undefined;
      const lines = r.value.map(
        (p) =>
          `- ${p.name}: ${p.itemCount} item(s), last activity ${p.lastActivityAt?.slice(0, 10) ?? "never"}` +
          `${p.name === here ? " (this workspace)" : ""}`,
      );
      return ok(lines.join("\n"));
    },
  );

  server.registerPrompt(
    "save-context",
    {
      title: "Save session context to valija",
      description: "Distill this session into a self-contained context save.",
      argsSchema: { project: z.string().optional() },
    },
    ({ project }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Review this conversation and save its durable context to valija${project ? ` under the project "${project}"` : ""}.\n\n` +
              (project
                ? "1. If the project is ambiguous, call list_projects first and confirm with me.\n"
                : "1. If no project was given, call save_context without `project` — valija uses " +
                  "the project linked to this workspace and says which in its reply. If that " +
                  "fails, call list_projects and confirm with me.\n") +
              "2. Compose content that is self-contained for a reader with no other context: " +
              "decisions made and why, current state, conventions/preferences established, " +
              "next steps, unresolved questions. No secrets, API keys, or passwords.\n" +
              "3. Pick the right type (decision/progress/preference/fact) and 1-5 tags.\n" +
              "4. Call save_context, then tell me what you saved in one line.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "load-context",
    {
      title: "Load project context from valija",
      description: "Load a project's context pack and resume work.",
      argsSchema: { project: z.string().optional() },
    },
    ({ project }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              (project
                ? `Call get_context for the project "${project}". Then:\n`
                : "Call get_context without a project; valija uses the project linked to this " +
                  "workspace. If it reports PROJECT_NOT_DETECTED, call list_projects and ask me " +
                  "which project I mean. Then:\n") +
              "1. Summarize the current state in 3 lines max.\n" +
              "2. Propose the next step based on the latest handoff or progress.\n" +
              "Do not repeat the whole pack back to me.",
          },
        },
      ],
    }),
  );

  return server;
}

/** Serves the MCP server over stdio; this is what `valija mcp` runs when an AI tool spawns it. */
export async function runMcpServer(c: Container): Promise<void> {
  const server = buildMcpServer(c);
  await server.connect(new StdioServerTransport());
}
