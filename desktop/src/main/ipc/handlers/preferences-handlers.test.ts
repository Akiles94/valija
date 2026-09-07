import { describe, expect, it, vi } from "vitest";
import type {
  AppPreferences,
  AppPreferencesStore,
} from "../../application/ports/app-preferences.js";
import { createPreferencesHandlers } from "./preferences-handlers.js";

function fakeStore(initial: AppPreferences) {
  let current = initial;
  const store: AppPreferencesStore = {
    read: () => current,
    write: (next) => {
      current = next;
    },
  };
  return store;
}

describe("preferences-handlers", () => {
  it("preferences:read returns exactly what the store holds", () => {
    const store = fakeStore({
      vaultPath: "/a/b",
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
    const handlers = createPreferencesHandlers(store);
    expect(handlers["preferences:read"]()).toEqual({
      vaultPath: "/a/b",
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
  });

  it("preferences:write updates theme/language/tourSeen/autoLockMinutes but never touches vaultPath (§8.6)", () => {
    const store = fakeStore({
      vaultPath: "/a/b",
      theme: "system",
      language: "system",
      tourSeen: false,
      autoLockMinutes: 15,
    });
    const handlers = createPreferencesHandlers(store);

    handlers["preferences:write"]({
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 30,
    });

    expect(store.read()).toEqual({
      vaultPath: "/a/b", // unchanged, carried forward from the existing file
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 30,
    });
  });

  it("calls onAutoLockChanged with the new value only when autoLockMinutes actually changes (CONNECT D5)", () => {
    const store = fakeStore({
      vaultPath: "/a/b",
      theme: "dark",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
    const onAutoLockChanged = vi.fn();
    const handlers = createPreferencesHandlers(store, onAutoLockChanged);

    handlers["preferences:write"]({
      theme: "light",
      language: "es",
      tourSeen: true,
      autoLockMinutes: 15,
    });
    expect(onAutoLockChanged).not.toHaveBeenCalled();

    handlers["preferences:write"]({
      theme: "light",
      language: "es",
      tourSeen: true,
      autoLockMinutes: null,
    });
    expect(onAutoLockChanged).toHaveBeenCalledTimes(1);
    expect(onAutoLockChanged).toHaveBeenCalledWith(null);
  });
});
