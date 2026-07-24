import { describe, expect, it } from "vitest";
import type { DeviceId } from "../../vault/domain/values/device-id.js";
import { writerLabel } from "./render.js";

const longId = "01J8F2WX9ABCDEFG" as DeviceId; // > 10 chars → truncated
const shortId = "01SEQ00001" as DeviceId; // 10 chars → shown whole

describe("writerLabel", () => {
  it("labels this device with a short id prefix", () => {
    expect(writerLabel(longId, true)).toBe("this device (01J8F2WX9A…)");
  });

  it("labels another device with a short id — what tells a 3-device fork apart", () => {
    expect(writerLabel(longId, false)).toBe("another device (01J8F2WX9A…)");
  });

  it("does not truncate an id of 10 chars or fewer", () => {
    expect(writerLabel(shortId, true)).toBe("this device (01SEQ00001)");
  });

  it("falls back to 'unknown device' when there is no writer", () => {
    expect(writerLabel(undefined, undefined)).toBe("unknown device");
  });
});
