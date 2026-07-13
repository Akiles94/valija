import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { DomainError } from "../../domain/errors.js";
import { ITEM_TYPES } from "../../domain/values/item-type.js";
import { VERSION } from "../../version.js";
import type { Container } from "../container.js";

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
    "unresolved questions. Never include secrets, API keys, or passwords.",
  save_handoff:
    "Package the state of THIS conversation so another AI tool or session can continue seamlessly. " +
    "Structure `content` as: goal, what was done, current blockers, exact next step, " +
    "relevant files or links.",
  get_context:
    "Load the saved context pack for a project before starting work on it. Returns pinned and " +
    "recent context (decisions, preferences, progress, latest handoff) as markdown within a " +
    "token budget. Call this when the user asks to load, resume, or continue a project.",
  search_context:
    "Full-text search across saved context. Use for specific recall questions such as " +
    "'what did we decide about auth?'. Returns matching items with project, type, and date.",
  list_projects:
    "List existing projects with item counts and last activity. Use to disambiguate which " +
    "project the user means before saving or loading.",
} as const;

export function buildMcpServer(c: Container): McpServer {
  const server = new McpServer({ name: "valija", version: VERSION });
  const clientName = (): string | undefined => server.server.getClientVersion()?.name;

  server.registerTool(
    "save_context",
    {
      title: "Save context",
      description: DESCRIPTIONS.save_context,
      inputSchema: {
        project: z
          .string()
          .describe("Project slug, e.g. 'vault-app'. Created if it does not exist."),
        content: z.string().describe("Self-contained markdown. Max 32 KB."),
        type: z.enum(ITEM_TYPES).optional().describe("Kind of context. Defaults to 'fact'."),
        tags: z.array(z.string()).max(10).optional().describe("Lowercase tags for recall."),
      },
    },
    async ({ project, content, type, tags }) => {
      const source = clientName();
      const r = c.saveContext.execute({
        project,
        content,
        ...(type === undefined ? {} : { type }),
        ...(tags === undefined ? {} : { tags }),
        ...(source === undefined ? {} : { source }),
      });
      if (!r.ok) return err(r.error);
      return ok(
        `Saved ${r.value.type} to project "${r.value.project}"` +
          `${r.value.projectCreated ? " (project created)" : ""}. Item id: ${r.value.itemId}.`,
      );
    },
  );

  server.registerTool(
    "save_handoff",
    {
      title: "Save handoff",
      description: DESCRIPTIONS.save_handoff,
      inputSchema: {
        project: z.string().describe("Project slug. Created if it does not exist."),
        content: z
          .string()
          .describe("Goal, what was done, blockers, exact next step, relevant files or links."),
      },
    },
    async ({ project, content }) => {
      const source = clientName();
      const r = c.saveContext.execute({
        project,
        content,
        type: "handoff",
        ...(source === undefined ? {} : { source }),
      });
      if (!r.ok) return err(r.error);
      return ok(`Handoff saved to project "${r.value.project}". Item id: ${r.value.itemId}.`);
    },
  );

  server.registerTool(
    "get_context",
    {
      title: "Get context pack",
      description: DESCRIPTIONS.get_context,
      inputSchema: {
        project: z.string().describe("Project slug to load."),
        budget: z.number().int().positive().optional().describe("Token budget. Default 4000."),
      },
    },
    async ({ project, budget }) => {
      const r = c.getContextPack.execute({
        project,
        ...(budget === undefined ? {} : { budgetTokens: budget }),
      });
      if (!r.ok) return err(r.error);
      return ok(r.value.markdown);
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
        (hit) => `- [${hit.project}] (${hit.type}, ${hit.createdAt.slice(0, 10)}) ${hit.content}`,
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
      const lines = r.value.map(
        (p) =>
          `- ${p.name}: ${p.itemCount} item(s), last activity ${p.lastActivityAt?.slice(0, 10) ?? "never"}`,
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
              "1. If the project is ambiguous, call list_projects first and confirm with me.\n" +
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
      argsSchema: { project: z.string() },
    },
    ({ project }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Call get_context for the project "${project}". Then:\n` +
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

export async function runMcpServer(c: Container): Promise<void> {
  const server = buildMcpServer(c);
  await server.connect(new StdioServerTransport());
}
