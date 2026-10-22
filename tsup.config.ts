import { defineConfig } from "tsup";

export default defineConfig({
  // `sdk` is the `valija/sdk` entry; it never imports delivery/cli or delivery/mcp, so commander
  // and the MCP SDK stay out of its chunks (every dependency is external, F2).
  entry: { program: "src/delivery/cli/program.ts", sdk: "src/delivery/sdk/index.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  // No `dts`: tsup's declaration build needs TypeScript's classic JS API, which TS 7 no longer
  // ships (F1, advances/SDK/spike.md). `npm run build` emits them with `tsc -p tsconfig.sdk.json`.
  // Native modules must stay external — they are loaded from node_modules at runtime.
  external: ["better-sqlite3-multiple-ciphers", "argon2", "@napi-rs/keyring"],
});
