/** setTimeout's ceiling; a longer TTL just re-checks (a larger delay would fire at once, with a warning). */
const MAX_DELAY_MS = 2_147_483_647;

export interface IdleLockTimer {
  stop(): void;
}

/**
 * Proactive Mode P expiry (⚑ D-A.2): drops the key at the TTL even if the product never calls again.
 * Reads the same in-memory activity the lazy SessionGuard check uses, so a call made meanwhile moves
 * the deadline. The timer is unref'd — it never keeps the product's process alive. `null` = auto-lock
 * off: nothing starts.
 */
export function startIdleLockTimer(
  ttlMinutes: number | null,
  lastActivityAt: () => Date | null,
  onExpire: () => void,
  now: () => number = Date.now,
): IdleLockTimer {
  if (ttlMinutes === null) return { stop: () => {} };
  const ttlMs = ttlMinutes * 60_000;
  const startedAt = now();
  let timer: NodeJS.Timeout | undefined;

  const check = (): void => {
    const last = lastActivityAt()?.getTime() ?? startedAt;
    const remaining = ttlMs - (now() - last);
    if (remaining <= 0) {
      timer = undefined;
      onExpire();
      return;
    }
    timer = setTimeout(check, Math.min(remaining, MAX_DELAY_MS));
    timer.unref();
  };

  check();
  return {
    stop: () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
