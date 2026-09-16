import { describe, expect, it } from "vitest";
import { relocationProgress } from "./relocation-steps.js";

describe("relocationProgress (D-15)", () => {
  it("choose: step 1, not in progress", () => {
    expect(relocationProgress("choose")).toEqual({ current: 1, inProgress: false });
  });

  it("preflight: step 2, not in progress", () => {
    expect(relocationProgress("preflight")).toEqual({ current: 2, inProgress: false });
  });

  it("moveFailed: step 2, not in progress", () => {
    expect(relocationProgress("moveFailed")).toEqual({ current: 2, inProgress: false });
  });

  it("moving: step 2, in progress", () => {
    expect(relocationProgress("moving")).toEqual({ current: 2, inProgress: true });
  });

  it("done: step 3, not in progress — the only stage that reaches step 3", () => {
    expect(relocationProgress("done")).toEqual({ current: 3, inProgress: false });
  });

  it("only done yields step 3", () => {
    const stages = ["choose", "preflight", "moveFailed", "moving", "done"] as const;
    const stepThreeStages = stages.filter((s) => relocationProgress(s).current === 3);
    expect(stepThreeStages).toEqual(["done"]);
  });
});
