import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [
          "better-sqlite3-multiple-ciphers",
          "argon2",
          "@napi-rs/keyring",
        ],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        external: [
          "better-sqlite3-multiple-ciphers",
          "argon2",
          "@napi-rs/keyring",
        ],
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
      },
    },
    plugins: [react()],
  },
});
