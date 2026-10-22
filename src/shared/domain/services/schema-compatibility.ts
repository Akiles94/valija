/** How a vault's schema relates to the one this build understands — the one comparison every guard reads (D-E). */
export type SchemaCompatibility = "behind" | "current" | "newer";

export function compareSchema(vaultVersion: number, supportedVersion: number): SchemaCompatibility {
  if (vaultVersion > supportedVersion) return "newer";
  return vaultVersion < supportedVersion ? "behind" : "current";
}
