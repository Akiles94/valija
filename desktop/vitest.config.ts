import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // jest-dom matchers (toBeDisabled, etc.) for the handful of DOM-level
    // tests (P-D5) — harmless no-op for the many headless tests, which never
    // call a DOM matcher.
    setupFiles: ["src/renderer/testing/vitest-setup.ts"],
  },
});
