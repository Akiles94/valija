import type { DiagnosticCheckMessage } from "../../shared/ipc/messages.js";

/**
 * D-V(d) made structural on the Diagnostics screen: a check's `detail` is
 * shown close to verbatim (D-T Option 3) *except* when `errorCode` is set —
 * that means `detail` is a raw `DomainError.message` from a failed
 * `VaultStatus` read, and the on-screen row must localize from the code
 * instead. The Copy report keeps using `detail` directly, which stays the
 * one place that raw text may still appear.
 */
export function checkRowDetail(
  check: DiagnosticCheckMessage,
  errorCopy: (code: string) => string,
): string {
  return check.errorCode !== undefined ? errorCopy(check.errorCode) : check.detail;
}
