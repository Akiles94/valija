import { describe, expect, it } from "vitest";
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
    const store = fakeStore({ vaultPath: "/a/b", theme: "dark", language: "es", tourSeen: true });
    const handlers = createPreferencesHandlers(store);
    expect(handlers["preferences:read"]()).toEqual({
      vaultPath: "/a/b",
      theme: "dark",
      language: "es",
      tourSeen: true,
    });
  });

  it("preferences:write updates theme/language/tourSeen but never touches vaultPath (§8.6)", () => {
    const store = fakeStore({
      vaultPath: "/a/b",
      theme: "system",
      language: "system",
      tourSeen: false,
    });
    const handlers = createPreferencesHandlers(store);

    handlers["preferences:write"]({ theme: "dark", language: "es", tourSeen: true });

    expect(store.read()).toEqual({
      vaultPath: "/a/b", // unchanged, carried forward from the existing file
      theme: "dark",
      language: "es",
      tourSeen: true,
    });
  });
});
