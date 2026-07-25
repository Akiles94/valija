import { describe, expect, it } from "vitest";
import type { DeviceId } from "../values/device-id.js";
import { GENERATION_ZERO, nextGeneration } from "../values/generation.js";
import type { WriteStamp } from "../values/write-stamp.js";
import { classifyLineage, type LineageStamp } from "./vault-lineage.js";

const deviceA = "01ARZ3NDEKTSV4RRFFQ69G5FAA" as DeviceId;
const stampA = "01ARZ3NDEKTSV4RRFFQ69G5FA1" as WriteStamp;
const stampB = "01ARZ3NDEKTSV4RRFFQ69G5FA2" as WriteStamp;

const stampAt = (generation = GENERATION_ZERO, writeStamp = stampA): LineageStamp => ({
  generation,
  writeStamp,
  writer: deviceA,
  writtenAt: "2026-07-23T00:00:00.000Z",
});

describe("classifyLineage", () => {
  it("is fast-forward when this device has never seen the vault before", () => {
    expect(classifyLineage(stampAt(), null)).toBe("fast-forward");
  });

  it("is in-sync when the current stamp matches what was last seen", () => {
    const current = stampAt(GENERATION_ZERO, stampA);
    expect(classifyLineage(current, { generation: GENERATION_ZERO, writeStamp: stampA })).toBe(
      "in-sync",
    );
  });

  it("is a clean fast-forward when the generation moved forward from what was last seen", () => {
    const current = stampAt(nextGeneration(GENERATION_ZERO), stampB);
    expect(classifyLineage(current, { generation: GENERATION_ZERO, writeStamp: stampA })).toBe(
      "fast-forward",
    );
  });

  it("is a fork when the same generation has a different stamp (two devices wrote independently)", () => {
    const current = stampAt(GENERATION_ZERO, stampB);
    expect(classifyLineage(current, { generation: GENERATION_ZERO, writeStamp: stampA })).toBe(
      "fork",
    );
  });

  it("is a fork when the current generation is behind this device's own last write", () => {
    const current = stampAt(GENERATION_ZERO, stampB);
    expect(
      classifyLineage(current, { generation: nextGeneration(GENERATION_ZERO), writeStamp: stampA }),
    ).toBe("fork");
  });
});
