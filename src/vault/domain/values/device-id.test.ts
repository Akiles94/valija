import { describe, expect, it } from "vitest";
import { createDeviceId, parseDeviceId } from "./device-id.js";

describe("device-id", () => {
  it("accepts any non-empty id, ULID or otherwise (ids are opaque in this codebase)", () => {
    expect(parseDeviceId("01ARZ3NDEKTSV4RRFFQ69G5FAV").ok).toBe(true);
    expect(parseDeviceId("01SEQ000001").ok).toBe(true);
  });

  it("rejects an empty or blank value", () => {
    const result = parseDeviceId("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_DEVICE_ID");
  });

  it("creates a device id from the injected id generator", () => {
    const id = createDeviceId({ next: () => "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    expect(id).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });
});
