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
  "content:show": z.object({
    project: z.string(),
    type: z.string().optional(),
    includeArchived: z.boolean().optional(),
  }),
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
  "content:setPinned": z.object({ id: z.string().max(64), pinned: z.boolean() }),
  "content:setArchived": z.object({ id: z.string().max(64), archived: z.boolean() }),
  // Abuse caps only, set well above the domain limits: EditItem's parsers own the real rules (32 KB,
  // 10 tags, tag syntax, types), so a too-long edit comes back as its real code (TOO_MANY_TAGS, …) —
  // never as a schema throw the renderer could only report as UNEXPECTED.
  "content:edit": z.object({
    id: z.string().max(64),
    content: z.string().max(1_000_000).optional(),
    tags: z.array(z.string().max(256)).max(100).optional(),
    type: z.string().max(64).optional(),
    allowSecrets: z.boolean().optional(),
  }),
  "sync:status": z.void(),
  "diagnostics:run": z.void(),
  "diagnostics:copyReport": z.object({
    checks: z.array(
      z.object({
        name: z.string(),
        ok: z.boolean(),
        detail: z.string(),
        fatal: z.boolean().optional(),
        errorCode: z.string().optional(),
      }),
    ),
  }),
  "relocation:preflight": z.object({ handle: z.string() }),
  "relocation:move": z.object({ handle: z.string() }),
  "relocation:retryClient": z.object({ client: z.string() }),
  "relocation:pointAtExisting": z.object({ handle: z.string() }),
  "import:list": z.object({
    handle: z.string(),
    from: z.enum(["chatgpt", "claude", "generic"]).optional(),
  }),
  "import:preview": z.object({
    handle: z.string(),
    projectName: z.string(),
    pick: z.string().optional(),
    query: z.string().optional(),
    since: z.string().optional(),
    all: z.boolean().optional(),
    from: z.enum(["chatgpt", "claude", "generic"]).optional(),
  }),
  "import:run": z.object({
    handle: z.string(),
    projectName: z.string(),
    pick: z.string().optional(),
    query: z.string().optional(),
    since: z.string().optional(),
    all: z.boolean().optional(),
    from: z.enum(["chatgpt", "claude", "generic"]).optional(),
    allowSecrets: z.boolean().optional(),
  }),
  "tools:status": z.void(),
  "tools:connect": z.object({ client: z.string() }),
  "tools:nodeStatus": z.void(),
  "preferences:read": z.void(),
  // Deliberately no vaultPath field (§8.6) — see PreferencesWriteRequest's own comment.
  "preferences:write": z.object({
    theme: z.enum(["system", "light", "dark"]),
    language: z.enum(["system", "en", "es"]),
    tourSeen: z.boolean(),
  }),
  "dialog:chooseImportFile": z.void(),
  "dialog:chooseVaultFolder": z.void(),
  "dialog:chooseProjectFolder": z.void(),
  // Folders arrive only as `pf-` handles; no bindings schema carries a path.
  "bindings:inspect": z.object({ handle: z.string().max(64) }),
  "bindings:link": z.object({
    handle: z.string().max(64),
    projectName: z.string().max(64),
    by: z.enum(["folder", "repository"]),
  }),
  "bindings:unlink": z.object({ bindingId: z.string().max(64) }),
  "bindings:list": z.object({ projectName: z.string().max(64).optional() }),
} as const satisfies Record<Channel, z.ZodType>;
