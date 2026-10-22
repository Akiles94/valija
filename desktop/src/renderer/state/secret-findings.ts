import {
  compareFindings,
  isSecretKind,
  type SecretFinding,
} from "../../../../src/context/domain/values/secret-finding.js";
import type { Translator } from "../../shared/i18n/translate.js";
import type { SecretFindingMessage } from "../../shared/ipc/messages.js";

/**
 * "Stripe secret key (line 3), Private key (lines 12–40)" in the UI language,
 * sorted and capped like the CLI (D-H, D-O). An unknown kind (a stale main) is
 * skipped rather than shown as a raw id (F7).
 */
export function describeSecretFindings(
  findings: readonly SecretFindingMessage[],
  t: Translator["t"],
  cap = 5,
): string {
  const known = findings.filter((f): f is SecretFinding => isSecretKind(f.kind));
  const sorted = [...known].sort(compareFindings);
  const shown = sorted.slice(0, cap).map((finding) => describeOne(finding, t));
  const hidden = sorted.length - shown.length;
  return [...shown, ...(hidden > 0 ? [t("secrets.more", { count: hidden })] : [])].join(", ");
}

function describeOne(finding: SecretFinding, t: Translator["t"]): string {
  const where =
    finding.firstLine === finding.lastLine
      ? t("secrets.line", { line: finding.firstLine })
      : t("secrets.lines", { from: finding.firstLine, to: finding.lastLine });
  return t("secrets.finding", { kind: t(`secrets.kinds.${finding.kind}`), where });
}
