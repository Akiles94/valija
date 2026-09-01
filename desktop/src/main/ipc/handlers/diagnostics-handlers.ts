import os from "node:os";
import { app } from "electron";
import type { Container } from "../../../../../src/delivery/container.js";
import { runDiagnostics } from "../../../../../src/delivery/diagnostics.js";
import { LATEST_SCHEMA_VERSION } from "../../../../../src/shared/infra/migrations.js";
import type {
  DiagnosticsCopyReportRequest,
  DiagnosticsRunResponse,
} from "../../../shared/ipc/messages.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";
import { buildDiagnosticsReport } from "../../application/services/diagnostics-report.js";

/**
 * `diagnostics:run` is reachable only from the renderer's explicit "Run
 * checks" action (§4.6 step 26/26') — nothing in this file schedules it, so
 * the keychain probe `runDiagnostics` performs (through `checkKeychain`) only
 * ever happens because a user asked. `diagnostics:copyReport` never
 * recomputes the checks — it takes the rows the renderer already has, so
 * clicking Copy report doesn't silently re-run that probe.
 */
export function createDiagnosticsHandlers(getContainer: () => Container, clipboard: ClipboardPort) {
  return {
    "diagnostics:run": async (): Promise<DiagnosticsRunResponse> => {
      const checks = await runDiagnostics(getContainer());
      return { checks };
    },

    "diagnostics:copyReport": (req: DiagnosticsCopyReportRequest): void => {
      const container = getContainer();
      const status = container.vaultStatus.execute();
      const report = buildDiagnosticsReport({
        checks: req.checks,
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron ?? "unknown",
        osLabel: `${os.type()} ${os.release()}`,
        vaultPath: container.paths.root,
        schemaVersion: LATEST_SCHEMA_VERSION,
        generation: status.ok ? (status.value.generation ?? null) : null,
      });
      clipboard.writeText(report);
    },
  };
}
