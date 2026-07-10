import { defineConfig } from "tsup";

export default defineConfig({
  entry: { program: "src/interfaces/cli/program.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Native modules must stay external — they are loaded from node_modules at runtime.
  external: ["better-sqlite3-multiple-ciphers", "argon2", "@napi-rs/keyring"],
});
