import { describe, expect, it } from "vitest";
import { createDeviceId, parseDeviceId } from "./device-id.js";

describe("device-id", () => {
  it("accepts a well-formed ULID", () => {
    const result = parseDeviceId("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed value", () => {
    const result = parseDeviceId("not-a-ulid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_DEVICE_ID");
  });

  it("creates a device id from the injected id generator", () => {
    const id = createDeviceId({ next: () => "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    expect(id).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });
});
