/**
 * Whether the system Node.js/npm a connected AI tool's `npx` invocation
 * would use are actually runnable (D-W) — a real executable check, never a
 * read of `process.versions`, which inside Electron names the bundled
 * runtime, not the system one (`refined.md` §3 fact 6).
 */
export interface NodeProbe {
  check(): Promise<{ nodeRunnable: boolean; npmRunnable: boolean }>;
}
