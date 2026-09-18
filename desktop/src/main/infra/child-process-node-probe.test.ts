import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChildProcessNodeProbe } from "./child-process-node-probe.js";

describe("ChildProcessNodeProbe", () => {
  it("reports node as runnable on a machine that has it on PATH (this test's own runtime)", async () => {
    const result = await new ChildProcessNodeProbe().check();
    expect(result.nodeRunnable).toBe(true);
  });

  it("does not throw and does not crash the probe when npm resolves too", async () => {
    const result = await new ChildProcessNodeProbe().check();
    expect(typeof result.npmRunnable).toBe("boolean");
  });

  it("is a genuine child-process spawn, not a read of process.versions — asserted by that read's absence from the source", () => {
    const source = readFileSync(new URL("./child-process-node-probe.ts", import.meta.url), "utf8");
    expect(source).not.toContain("process.versions");
  });
});
