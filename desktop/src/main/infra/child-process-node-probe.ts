import { execFile } from "node:child_process";
import type { NodeProbe } from "../application/ports/node-probe.js";

/**
 * `shell: true` is required on Windows: `execFile` alone cannot resolve a
 * `.cmd` shim (how `npm` itself is installed there) without going through
 * the shell — see Node's own `child_process` docs on Windows `.bat`/`.cmd`
 * files. There is no untrusted input here — `command` is always one of the
 * two literal names below.
 */
function runs(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ["--version"], { shell: true }, (error) => resolve(error === null));
  });
}

/**
 * A genuine child-process probe — it actually runs `node --version` and
 * `npm --version` against `PATH`, rather than reading a value Node already
 * knows about itself (D-W, §9 item 71a).
 */
export class ChildProcessNodeProbe implements NodeProbe {
  async check(): Promise<{ nodeRunnable: boolean; npmRunnable: boolean }> {
    const [nodeRunnable, npmRunnable] = await Promise.all([runs("node"), runs("npm")]);
    return { nodeRunnable, npmRunnable };
  }
}
