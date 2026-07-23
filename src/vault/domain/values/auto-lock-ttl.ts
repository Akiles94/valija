const DEFAULT_TTL_MINUTES = 15;

/**
 * Idle auto-lock TTL, in minutes. `null` means disabled (never auto-locks).
 * Unset/empty defaults to 15; "0"/"off" (case-insensitive) disables it; a
 * positive integer is used as-is; anything else falls back to the default —
 * auto-lock is a safety net, not something that should block the CLI from
 * starting over a malformed env var.
 */
export function parseAutoLockTtl(raw?: string): number | null {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TTL_MINUTES;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "off") return null;

  const value = Number(normalized);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_TTL_MINUTES;
}

export function isIdleExpired(lastActivity: Date, now: Date, ttlMinutes: number): boolean {
  const elapsedMinutes = (now.getTime() - lastActivity.getTime()) / 60_000;
  return elapsedMinutes >= ttlMinutes;
}
