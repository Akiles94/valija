import type { ValijaBridge } from "./bridge.js";

function isVaultLockedResult(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== false) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "VAULT_LOCKED"
  );
}

function wrap(target: object, onLocked: () => void): object {
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === "function") {
      wrapped[key] = async (...args: unknown[]) => {
        const result = await value(...args);
        if (isVaultLockedResult(result)) onLocked();
        return result;
      };
    } else if (typeof value === "object" && value !== null) {
      wrapped[key] = wrap(value, onLocked);
    } else {
      wrapped[key] = value;
    }
  }
  return wrapped;
}

/**
 * Any `ValijaBridge` call can discover the vault auto-locked underneath the
 * current screen (`SessionGuard`'s idle TTL, checked lazily per-action —
 * there is no push notification for it, per §6's no-polling rule). Without
 * this, a screen that gets back `VAULT_LOCKED` just shows the translated
 * error text and dead-ends there: nothing routes the app back to
 * `LockedScreen`. Wrapping the bridge once, here, means no individual
 * screen has to know about this — the same way every screen already
 * doesn't know about `wireFocusRefresh`.
 */
export function withLockDetection(bridge: ValijaBridge, onLocked: () => void): ValijaBridge {
  return wrap(bridge, onLocked) as ValijaBridge;
}
