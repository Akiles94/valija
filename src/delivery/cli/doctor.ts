import type { Container } from "../container.js";
import { runDiagnostics } from "../diagnostics.js";

/** `valija doctor`: prints one line per diagnostic check and exits 1 when a fatal check fails. */
export async function doctorCommand(c: Container): Promise<void> {
  const checks = await runDiagnostics(c);

  let fatal = false;
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name.padEnd(16)} ${check.detail}`);
    if (!check.ok && check.fatal) fatal = true;
  }
  if (fatal) process.exit(1);
}
