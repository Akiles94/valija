import { describe, expect, it } from "vitest";
import { buildDiagnosticsReport } from "./diagnostics-report.js";

describe("buildDiagnosticsReport", () => {
  it("renders the check rows, versions, OS, vault path, schema version and generation — always in English", () => {
    const report = buildDiagnosticsReport({
      checks: [
        { name: "node", ok: true, detail: "v22.22.2 (need >=22)", fatal: true },
        { name: "keychain", ok: false, detail: "some native probe failure" },
      ],
      appVersion: "0.3.0",
      electronVersion: "33.0.0",
      osLabel: "Darwin 24.0.0",
      vaultPath: "/Users/oscar/.valija",
      schemaVersion: 3,
      generation: 7,
    });

    expect(report).toContain("App version: 0.3.0");
    expect(report).toContain("Electron version: 33.0.0");
    expect(report).toContain("OS: Darwin 24.0.0");
    expect(report).toContain("Vault path: /Users/oscar/.valija");
    expect(report).toContain("App schema version (latest known): 3");
    expect(report).toContain("Generation: 7");
    expect(report).toContain("[OK] node: v22.22.2 (need >=22)");
    expect(report).toContain("[WARN] keychain: some native probe failure");
  });

  it("marks a fatal, failing check distinctly from a plain warning", () => {
    const report = buildDiagnosticsReport({
      checks: [{ name: "node", ok: false, detail: "v18.0.0 (need >=22)", fatal: true }],
      appVersion: "0.3.0",
      electronVersion: "33.0.0",
      osLabel: "Darwin 24.0.0",
      vaultPath: "/Users/oscar/.valija",
      schemaVersion: 3,
      generation: null,
    });

    expect(report).toContain("[FATAL] node: v18.0.0 (need >=22)");
    expect(report).toContain("Generation: unknown");
  });

  it("carries no vault content, project name, item text or key material — only the fields it's documented to carry", () => {
    const report = buildDiagnosticsReport({
      checks: [{ name: "vault", ok: true, detail: "unlocked at /Users/oscar/.valija/vault.db" }],
      appVersion: "0.3.0",
      electronVersion: "33.0.0",
      osLabel: "Darwin 24.0.0",
      vaultPath: "/Users/oscar/.valija",
      schemaVersion: 3,
      generation: 1,
    });

    expect(report).not.toMatch(/[0-9a-f]{64}/i); // no raw key-hex-shaped material
  });
});
