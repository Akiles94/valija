import { defineConfig } from "tsup";

/** Builds the living-docs generator (never shipped: output is git-ignored, see .gitignore `dist/`). */
export default defineConfig({
  entry: { "living-docs": "tools/living-docs/valija/composition/main.ts" },
  outDir: "tools/living-docs/dist",
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  // Same native externals as the product build: loaded from node_modules, never bundled.
  external: ["better-sqlite3-multiple-ciphers", "argon2", "@napi-rs/keyring"],
});
