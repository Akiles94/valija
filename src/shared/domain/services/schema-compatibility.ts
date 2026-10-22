/** How a vault's schema relates to the one this build understands — the one comparison every guard reads (D-E). */
export type SchemaCompatibility = "behind" | "current" | "newer";

/** Whether a vault's schema is behind, equal to, or newer than the one this build supports. */
export function compareSchema(vaultVersion: number, supportedVersion: number): SchemaCompatibility {
  if (vaultVersion > supportedVersion) return "newer";
  return vaultVersion < supportedVersion ? "behind" : "current";
}
