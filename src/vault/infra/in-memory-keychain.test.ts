import { describe, expect, it } from "vitest";
import { InMemoryKeychain } from "./in-memory-keychain.js";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

/** The private buffer behind a key — read only to prove it is zeroed. */
const bufferOf = (keychain: InMemoryKeychain, vaultId: string): Buffer | undefined =>
  (keychain as unknown as { keys: Map<string, Buffer> }).keys.get(vaultId);

describe("InMemoryKeychain", () => {
  it("round-trips a key per vault", () => {
    const keychain = new InMemoryKeychain();
    keychain.setKey("v1", KEY_A);
    keychain.setKey("v2", KEY_B);
    expect(keychain.getKey("v1")).toBe(KEY_A);
    expect(keychain.getKey("v2")).toBe(KEY_B);
    expect(keychain.getKey("missing")).toBeNull();
  });

  it("replaces the key on a second setKey, zeroing the old bytes", () => {
    const keychain = new InMemoryKeychain();
    keychain.setKey("v1", KEY_A);
    const first = bufferOf(keychain, "v1");
    keychain.setKey("v1", KEY_B);
    expect(keychain.getKey("v1")).toBe(KEY_B);
    expect(first?.every((byte) => byte === 0)).toBe(true);
  });

  it("deleteKey reports whether a key was present", () => {
    const keychain = new InMemoryKeychain();
    expect(keychain.deleteKey("v1")).toBe(false);
    keychain.setKey("v1", KEY_A);
    expect(keychain.deleteKey("v1")).toBe(true);
    expect(keychain.getKey("v1")).toBeNull();
    expect(keychain.deleteKey("v1")).toBe(false);
  });

  it("zeroes the owned buffer on delete (best effort, §11.3)", () => {
    const keychain = new InMemoryKeychain();
    keychain.setKey("v1", KEY_A);
    const owned = bufferOf(keychain, "v1");
    expect(owned?.length).toBe(64);
    keychain.deleteKey("v1");
    expect(owned?.every((byte) => byte === 0)).toBe(true);
  });

  it("two keychains never share keys", () => {
    const one = new InMemoryKeychain();
    const two = new InMemoryKeychain();
    one.setKey("v1", KEY_A);
    expect(two.getKey("v1")).toBeNull();
  });
});
