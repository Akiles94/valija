import { describe, expect, it } from "vitest";
import type { ContextItemView } from "../../context/application/dto/context-item-view.js";
import type { DeviceId } from "../../vault/domain/values/device-id.js";
import { itemHeaderLine, writerLabel } from "./render.js";

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

describe("itemHeaderLine", () => {
  const view: ContextItemView = {
    id: "01J3Q8Z6M4X5Y7T9B2C1D0E8F6",
    project: "valija",
    type: "decision",
    content: "body",
    tags: [],
    pinned: false,
    createdAt: "2026-07-20T10:00:00.000Z",
  };

  it("always shows the full id, with no marks for a plain item", () => {
    expect(itemHeaderLine(view)).toBe("— decision · 2026-07-20  id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6");
  });

  it("adds the pin, tags and archived marks when they apply", () => {
    expect(itemHeaderLine({ ...view, pinned: true, tags: ["storage"], archived: true })).toBe(
      "— decision · 2026-07-20  id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6  📌  [storage]  [archived]",
    );
  });
});
