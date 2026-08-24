import { z } from "zod";
import type { Channel } from "../../shared/ipc/channels.js";

/**
 * One zod schema per channel, in the same idiom `src/delivery/mcp/server.ts`
 * uses — every request is validated at the boundary before it reaches a use
 * case. No schema here contains a free-form string field named like a path
 * (§8.6) — every filesystem access instead takes an opaque `handle` minted by
 * a dialog channel.
 */
export const SCHEMAS = {
  "vault:init": z.object({ passphrase: z.string() }),
  "vault:readRecoveryKit": z.void(),
  "vault:unlock": z.object({
    passphrase: z.string().optional(),
    recoveryKeyHex: z.string().optional(),
    upgradeConfirmed: z.boolean().optional(),
  }),
  "vault:lock": z.void(),
  "vault:status": z.void(),
  "vault:upgradeCheck": z.object({
    passphrase: z.string().optional(),
    recoveryKeyHex: z.string().optional(),
  }),
  "content:projects": z.void(),
  "content:show": z.object({ project: z.string(), type: z.string().optional() }),
  "content:search": z.object({
    query: z.string(),
    project: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  "content:pack": z.object({ project: z.string() }),
  "content:export": z.object({
    project: z.string(),
    format: z.enum(["markdown", "json"]),
  }),
  "content:copy": z.object({ text: z.string() }),
  "sync:status": z.void(),
  "relocation:preflight": z.object({ handle: z.string() }),
  "relocation:move": z.object({ handle: z.string() }),
  "relocation:retryClient": z.object({ client: z.string() }),
  "relocation:pointAtExisting": z.object({ handle: z.string() }),
  "import:list": z.object({ handle: z.string() }),
  "import:preview": z.object({
    handle: z.string(),
    projectName: z.string(),
    pick: z.string().optional(),
    query: z.string().optional(),
    since: z.string().optional(),
    all: z.boolean().optional(),
  }),
  "import:run": z.object({
    handle: z.string(),
    projectName: z.string(),
    pick: z.string().optional(),
    query: z.string().optional(),
    since: z.string().optional(),
    all: z.boolean().optional(),
  }),
  "tools:status": z.void(),
  "tools:connect": z.object({ client: z.string() }),
  "preferences:read": z.void(),
  // Deliberately no vaultPath field (§8.6) — see PreferencesWriteRequest's own comment.
  "preferences:write": z.object({
    theme: z.enum(["system", "light", "dark"]),
    language: z.enum(["system", "en", "es"]),
    tourSeen: z.boolean(),
  }),
  "dialog:chooseImportFile": z.void(),
  "dialog:chooseVaultFolder": z.void(),
} as const satisfies Record<Channel, z.ZodType>;
