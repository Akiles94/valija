import { z } from "zod";
import { ITEM_TYPES } from "../../../context/domain/values/item-type.js";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { ValijaError } from "../dto/valija-error.js";
import { invalidInput } from "../mapping/to-valija-error.js";

/** D-U: a short slug, stamped as `source` on every save. */
const clientLabel = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "client must be a short slug of [a-z0-9-]");
const vaultRoot = z.string().min(1).optional();

/** Validates `openVault` options: a client slug, an optional vault folder, and a passphrase or a recovery key (not both). */
export const openVaultSchema = z
  .object({
    client: clientLabel,
    vaultRoot,
    allowUpgrade: z.boolean().optional(),
    passphrase: z.string().optional(),
    recoveryKey: z.string().optional(),
  })
  .refine(
    (o) => o.passphrase === undefined || o.recoveryKey === undefined,
    "pass a passphrase or a recovery key, not both",
  );

/** Validates `createVault` options: a client slug, an optional vault folder and the new passphrase. */
export const createVaultSchema = z.object({
  client: clientLabel,
  vaultRoot,
  passphrase: z.string(),
});

/** Mirrors MCP `save_context` (P-10); `ITEM_TYPES` excludes `imported`. */
export const saveSchema = z.object({
  project: z.string(),
  content: z.string(),
  type: z.enum(ITEM_TYPES).optional(),
  tags: z.array(z.string()).max(10).optional(),
  supersedes: z.string().max(64).optional(),
});

/** Validates `saveHandoff` input, mirroring MCP `save_handoff`. */
export const handoffSchema = z.object({ project: z.string(), content: z.string() });

/** Validates `getContextPack` input, mirroring MCP `get_context`. */
export const contextPackSchema = z.object({
  project: z.string(),
  budgetTokens: z.number().int().positive().optional(),
});

/** No upper bound on `limit`: SearchContext clamps it to 1–100 (§5 "same clamps"). */
export const searchSchema = z.object({
  query: z.string(),
  project: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

/** Unknown keys are stripped (so a stray `pinned` never reaches SaveContext, F14). Messages name fields, never values. */
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): Result<T, ValijaError> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.length === 0 ? "options" : issue.path.join(".")}: ${issue.message}`,
  );
  return err(invalidInput(`Invalid input — ${issues.join("; ")}.`));
}
