import { describe, expect, it } from "vitest";
import { groupDiagnosticRows } from "./diagnostic-groups.js";
import type { DiagnosticRow } from "./diagnostic-rows.js";

function row(key: string): DiagnosticRow {
  return {
    key,
    name: key,
    status: "OK",
    explanation: "",
    detail: "",
    ok: true,
    fatal: false,
  };
}

describe("groupDiagnosticRows", () => {
  it("each system key lands in the system group", () => {
    const rows = ["node", "tool-node", "sqlcipher", "keychain"].map(row);
    const groups = groupDiagnosticRows(rows, []);
    expect(groups).toEqual([{ id: "system", rows }]);
  });

  it("each vault key lands in the vault group", () => {
    const rows = ["vault", "journal", "sync", "lineage", "auto-lock"].map(row);
    const groups = groupDiagnosticRows(rows, []);
    expect(groups).toEqual([{ id: "vault", rows }]);
  });

  it("a client key lands in the tools group", () => {
    const rows = [row("claude-code"), row("chatgpt")];
    const groups = groupDiagnosticRows(rows, ["claude-code", "chatgpt"]);
    expect(groups).toEqual([{ id: "tools", rows }]);
  });

  it("an unrecognised key lands in other", () => {
    const rows = [row("some-future-check")];
    const groups = groupDiagnosticRows(rows, []);
    expect(groups).toEqual([{ id: "other", rows }]);
  });

  it("groups with no rows are absent from the result", () => {
    const rows = [row("node")];
    const groups = groupDiagnosticRows(rows, []);
    expect(groups.map((g) => g.id)).toEqual(["system"]);
  });

  it("group order is system, vault, tools, other; row order inside a group is preserved", () => {
    const other = row("some-future-check");
    const claudeCode = row("claude-code");
    const autoLock = row("auto-lock");
    const vaultRow = row("vault");
    const toolNode = row("tool-node");
    const node = row("node");
    const rows = [other, claudeCode, autoLock, vaultRow, toolNode, node];
    const groups = groupDiagnosticRows(rows, ["claude-code"]);

    expect(groups.map((g) => g.id)).toEqual(["system", "vault", "tools", "other"]);
    expect(groups.find((g) => g.id === "system")?.rows).toEqual([toolNode, node]);
    expect(groups.find((g) => g.id === "vault")?.rows).toEqual([autoLock, vaultRow]);
    expect(groups.find((g) => g.id === "tools")?.rows).toEqual([claudeCode]);
    expect(groups.find((g) => g.id === "other")?.rows).toEqual([other]);
  });
});
