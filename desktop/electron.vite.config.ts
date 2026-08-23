import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const NATIVE_MODULES = ["better-sqlite3-multiple-ciphers", "argon2", "@napi-rs/keyring"];

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: {
        external: NATIVE_MODULES,
      },
    },
    plugins: [externalizeDepsPlugin({ exclude: [] })],
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        output: {
          // Sandboxed preload scripts (webPreferences.sandbox: true) load as
          // CommonJS regardless of the package's own "type": "module" — force
          // it explicitly rather than relying on electron-vite's default.
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    plugins: [react()],
  },
});
