import type { SchemaVersionsMessage } from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "./bridge.js";

interface SessionRoutes {
  onLocked: () => void;
  onSchemaTooNew: (versions: SchemaVersionsMessage) => void;
}

/** The `error` of a failed `IpcResult`, or null for anything else. */
function failedError(value: unknown): { code?: unknown; schema?: unknown } | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== false) {
    return null;
  }
  const error = (value as { error?: unknown }).error;
  return typeof error === "object" && error !== null ? error : null;
}

function isSchemaVersions(value: unknown): value is SchemaVersionsMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { vaultVersion?: unknown }).vaultVersion === "number" &&
    typeof (value as { supportedVersion?: unknown }).supportedVersion === "number"
  );
}

function route(result: unknown, routes: SessionRoutes): void {
  const error = failedError(result);
  if (error === null) return;
  if (error.code === "VAULT_LOCKED") routes.onLocked();
  // Only the typed refusal (with its numbers) routes; a bare code stays the screen's inline error.
  if (error.code === "VAULT_SCHEMA_TOO_NEW" && isSchemaVersions(error.schema)) {
    routes.onSchemaTooNew(error.schema);
  }
}

function wrap(target: object, routes: SessionRoutes): object {
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === "function") {
      wrapped[key] = async (...args: unknown[]) => {
        const result = await value(...args);
        route(result, routes);
        return result;
      };
    } else if (typeof value === "object" && value !== null) {
      wrapped[key] = wrap(value, routes);
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
 *
 * (SDK, P-18 (b)) `{ code: "VAULT_SCHEMA_TOO_NEW", schema }` from any call routes
 * to the terminal "Update Valija" screen the same way, so the locked screen's
 * unlock, the upgrade check and every content call need no change of their own.
 */
export function withLockDetection(
  bridge: ValijaBridge,
  onLocked: () => void,
  onSchemaTooNew: (versions: SchemaVersionsMessage) => void = () => {},
): ValijaBridge {
  return wrap(bridge, { onLocked, onSchemaTooNew }) as ValijaBridge;
}
