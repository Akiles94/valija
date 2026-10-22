import { describe, expect, it } from "vitest";
import { FakeDeviceIdentity, SeqIds } from "../../testing/test-vault.js";
import { parseGeneration } from "../domain/values/generation.js";
import { parseWriteStamp } from "../domain/values/write-stamp.js";
import { InMemoryActivityDeviceIdentity } from "./in-memory-activity-device-identity.js";

const AT = new Date("2026-10-21T12:00:00Z");

function seen() {
  const generation = parseGeneration(3);
  const writeStamp = parseWriteStamp("01SEQ000001");
  if (!generation.ok || !writeStamp.ok) throw new Error("bad fixture");
  return { generation: generation.value, writeStamp: writeStamp.value };
}

describe("InMemoryActivityDeviceIdentity (⚑ D-A.3)", () => {
  it("keeps activity in memory and never touches the shared identity's activity", () => {
    const shared = new FakeDeviceIdentity(new SeqIds());
    const wrapper = new InMemoryActivityDeviceIdentity(shared);
    wrapper.recordActivity("v1", AT);
    expect(wrapper.lastActivityAt("v1")).toEqual(AT);
    expect(shared.lastActivityAt("v1")).toBeNull();
  });

  it("does not read the shared activity either", () => {
    const shared = new FakeDeviceIdentity(new SeqIds());
    shared.recordActivity("v1", AT);
    expect(new InMemoryActivityDeviceIdentity(shared).lastActivityAt("v1")).toBeNull();
  });

  it("delegates the device id and lineage last-seen to the shared identity", () => {
    const shared = new FakeDeviceIdentity(new SeqIds());
    const wrapper = new InMemoryActivityDeviceIdentity(shared);
    expect(wrapper.deviceId()).toBe(shared.deviceId());
    wrapper.recordSeen("v1", seen());
    expect(shared.lastSeen("v1")).toEqual(seen());
    expect(wrapper.lastSeen("v1")).toEqual(seen());
  });

  it("two wrappers over one shared identity keep independent activity", () => {
    const shared = new FakeDeviceIdentity(new SeqIds());
    const one = new InMemoryActivityDeviceIdentity(shared);
    const two = new InMemoryActivityDeviceIdentity(shared);
    one.recordActivity("v1", AT);
    expect(two.lastActivityAt("v1")).toBeNull();
  });
});
