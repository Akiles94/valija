import { describe, expect, it, vi } from "vitest";
import type { DiagnosticCheck } from "../diagnostics.js";

const runDiagnosticsMock = vi.fn<() => Promise<DiagnosticCheck[]>>();
vi.mock("../diagnostics.js", () => ({
  runDiagnostics: (...args: unknown[]) => runDiagnosticsMock(...(args as [])),
}));

const { doctorCommand } = await import("./doctor.js");

describe("doctorCommand — prints runDiagnostics' checks, computing none of its own", () => {
  it("prints one ✓/✗ name-padded line per check, in runDiagnostics' own order — byte-identical to the pre-extraction format", async () => {
    const checks: DiagnosticCheck[] = [
      { name: "node", ok: true, detail: "v22.22.2 (need >=22)", fatal: true },
      { name: "sqlcipher", ok: true, detail: "native module loads", fatal: true },
      { name: "keychain", ok: false, detail: "some native probe failure" },
      { name: "vault", ok: false, detail: 'not initialized — run "valija init"' },
      { name: "claude-code", ok: false, detail: "config not found" },
    ];
    runDiagnosticsMock.mockResolvedValue(checks);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: only the checks the mocked runDiagnostics returns matter to this test
      await doctorCommand({} as any);
      expect(logSpy.mock.calls.map((call) => call[0])).toEqual([
        "✓ node             v22.22.2 (need >=22)",
        "✓ sqlcipher        native module loads",
        "✗ keychain         some native probe failure",
        '✗ vault            not initialized — run "valija init"',
        "✗ claude-code      config not found",
      ]);
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it("exits 1 when a fatal check fails", async () => {
    runDiagnosticsMock.mockResolvedValue([
      { name: "node", ok: false, detail: "v18.0.0 (need >=22)", fatal: true },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: only the checks the mocked runDiagnostics returns matter to this test
      await doctorCommand({} as any);
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it("does not exit when every failing check is non-fatal", async () => {
    runDiagnosticsMock.mockResolvedValue([
      { name: "keychain", ok: false, detail: "some native probe failure" },
      { name: "claude-code", ok: false, detail: "config not found" },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: only the checks the mocked runDiagnostics returns matter to this test
      await doctorCommand({} as any);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
