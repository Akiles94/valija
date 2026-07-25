import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveStatePaths } from "../../shared/infra/state-paths.js";
import { SeqIds } from "../../testing/test-vault.js";
import type { LineageSeen } from "../domain/services/vault-lineage.js";
import { GENERATION_ZERO, nextGeneration } from "../domain/values/generation.js";
import type { WriteStamp } from "../domain/values/write-stamp.js";
import { FileDeviceIdentity } from "./file-device-identity.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-device-identity-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("FileDeviceIdentity", () => {
  it("generates a device id once and persists it across instances", () => {
    const paths = resolveStatePaths(join(tmp, "stable"));
    const first = new FileDeviceIdentity(paths, new SeqIds()).deviceId();
    const second = new FileDeviceIdentity(paths, new SeqIds()).deviceId();
    expect(second).toBe(first);
  });

  it("keeps last-seen isolated per vault", () => {
    const paths = resolveStatePaths(join(tmp, "isolation"));
    const identity = new FileDeviceIdentity(paths, new SeqIds());
    const seenA: LineageSeen = { generation: GENERATION_ZERO, writeStamp: "stamp-a" as WriteStamp };
    const seenB: LineageSeen = {
      generation: nextGeneration(GENERATION_ZERO),
      writeStamp: "stamp-b" as WriteStamp,
    };

    identity.recordSeen("vault-a", seenA);
    identity.recordSeen("vault-b", seenB);

    expect(identity.lastSeen("vault-a")).toEqual(seenA);
    expect(identity.lastSeen("vault-b")).toEqual(seenB);
    expect(identity.lastSeen("vault-c")).toBeNull();
  });

  it("records and reads last-activity per vault", () => {
    const paths = resolveStatePaths(join(tmp, "activity"));
    const identity = new FileDeviceIdentity(paths, new SeqIds());
    expect(identity.lastActivityAt("vault-a")).toBeNull();

    const at = new Date("2026-07-23T10:00:00.000Z");
    identity.recordActivity("vault-a", at);
    expect(identity.lastActivityAt("vault-a")?.toISOString()).toBe(at.toISOString());
  });

  it("stores state under the state root, not inside a vault folder", () => {
    const paths = resolveStatePaths(join(tmp, "location"));
    new FileDeviceIdentity(paths, new SeqIds()).deviceId();
    expect(existsSync(paths.state)).toBe(true);
    expect(paths.state.startsWith(paths.root)).toBe(true);
  });

  it("tolerates a missing or corrupt state file, starting fresh rather than throwing", () => {
    const paths = resolveStatePaths(join(tmp, "missing"));
    const identity = new FileDeviceIdentity(paths, new SeqIds());
    expect(identity.lastSeen("vault-a")).toBeNull();
    expect(identity.lastActivityAt("vault-a")).toBeNull();
  });
});
