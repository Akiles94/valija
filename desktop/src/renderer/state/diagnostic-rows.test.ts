import { describe, expect, it } from "vitest";
import { createTranslator } from "../../shared/i18n/translate.js";
import type { DiagnosticCheckMessage, ToolsStatusEntry } from "../../shared/ipc/messages.js";
import { diagnosticRows } from "./diagnostic-rows.js";

const t = createTranslator("en").t;
const errorCopy = (code: string) => `localized(${code})`;

function check(
  overrides: Partial<DiagnosticCheckMessage> & { name: string },
): DiagnosticCheckMessage {
  return { ok: true, detail: "detail", ...overrides };
}

describe("diagnosticRows", () => {
  it("gives the tool-Node row a status that agrees with its own ok/detail — C1's regression case", () => {
    const running = diagnosticRows({
      checks: [],
      toolsStatus: [],
      nodeStatus: { nodeRunnable: true, npmRunnable: true },
      t,
      errorCopy,
    });
    const okRow = running.find((r) => r.key === "tool-node");
    expect(okRow?.ok).toBe(true);
    expect(okRow?.status).toBe(t("diagnostics.ok"));
    expect(okRow?.detail).toBe(t("diagnostics.toolNodeOk"));

    const missing = diagnosticRows({
      checks: [],
      toolsStatus: [],
      nodeStatus: { nodeRunnable: false, npmRunnable: true },
      t,
      errorCopy,
    });
    const missingRow = missing.find((r) => r.key === "tool-node");
    expect(missingRow?.ok).toBe(false);
    // The bug this test guards against: a status word that says "OK" while
    // ok is false and detail says otherwise.
    expect(missingRow?.status).not.toBe(t("diagnostics.ok"));
    expect(missingRow?.status).toBe(t("diagnostics.warning"));
    expect(missingRow?.detail).toBe(t("diagnostics.toolNodeMissing"));
  });

  it("omits the tool-Node row entirely when nodeStatus hasn't been fetched yet", () => {
    const rows = diagnosticRows({ checks: [], toolsStatus: [], nodeStatus: null, t, errorCopy });
    expect(rows.find((r) => r.key === "tool-node")).toBeUndefined();
  });

  it("labels ok / warning / fatal correctly for a regular check", () => {
    const rows = diagnosticRows({
      checks: [
        check({ name: "sqlcipher", ok: true }),
        check({ name: "keychain", ok: false }),
        check({ name: "node", ok: false, fatal: true }),
      ],
      toolsStatus: [],
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "sqlcipher")?.status).toBe(t("diagnostics.ok"));
    expect(rows.find((r) => r.key === "keychain")?.status).toBe(t("diagnostics.warning"));
    expect(rows.find((r) => r.key === "node")?.status).toBe(t("diagnostics.fatal"));
  });

  it("puts the app-Node row first, from the 'node' check, distinct from the tool-Node row", () => {
    const rows = diagnosticRows({
      checks: [check({ name: "node", ok: true, detail: "v22.0.0" })],
      toolsStatus: [],
      nodeStatus: { nodeRunnable: true, npmRunnable: true },
      t,
      errorCopy,
    });
    expect(rows[0]?.key).toBe("node");
    expect(rows[0]?.name).toBe(t("diagnostics.appNodeRow"));
    expect(rows[1]?.key).toBe("tool-node");
    expect(rows[1]?.name).toBe(t("diagnostics.toolNodeRow"));
    expect(rows[0]?.name).not.toBe(rows[1]?.name);
  });

  it("shows a connected client's real vault path as its extra line", () => {
    const toolsStatus: ToolsStatusEntry[] = [
      { client: "cursor", connected: true, vaultPath: "/Users/oscar/.valija" },
    ];
    const rows = diagnosticRows({
      checks: [check({ name: "cursor", ok: true, detail: "valija installed" })],
      toolsStatus,
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "cursor")?.extra).toBe(
      t("diagnostics.clientVaultPath", { vaultPath: "/Users/oscar/.valija" }),
    );
  });

  it("shows the default-location line when a client is installed but tools:status reports no vaultPath (W2)", () => {
    const toolsStatus: ToolsStatusEntry[] = [{ client: "claude-code", connected: true }];
    const rows = diagnosticRows({
      checks: [check({ name: "claude-code", ok: true, detail: "valija installed" })],
      toolsStatus,
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "claude-code")?.extra).toBe(
      t("diagnostics.clientVaultPathDefault"),
    );
  });

  it("shows no extra line for a client that isn't connected at all", () => {
    const toolsStatus: ToolsStatusEntry[] = [{ client: "claude-desktop", connected: false }];
    const rows = diagnosticRows({
      checks: [check({ name: "claude-desktop", ok: false, detail: "config not found" })],
      toolsStatus,
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "claude-desktop")?.extra).toBeUndefined();
  });

  it("gives no explanation, rather than a wrong one, for a name that is neither a fixed check nor a reported client", () => {
    const rows = diagnosticRows({
      checks: [check({ name: "some-future-check", ok: true })],
      toolsStatus: [{ client: "cursor", connected: false }],
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "some-future-check")?.explanation).toBe("");
  });

  it("localizes from errorCode instead of the raw detail, via checkRowDetail", () => {
    const rows = diagnosticRows({
      checks: [
        check({
          name: "vault",
          ok: false,
          detail: "raw domain message",
          errorCode: "STORAGE_ERROR",
        }),
      ],
      toolsStatus: [],
      nodeStatus: null,
      t,
      errorCopy,
    });
    expect(rows.find((r) => r.key === "vault")?.detail).toBe("localized(STORAGE_ERROR)");
  });
});
