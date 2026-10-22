import type { SecretFindingMessage } from "../../shared/ipc/messages.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";
import { describeSecretFindings } from "../state/secret-findings.js";

/**
 * The refusal, in words: what kind, which lines, why it matters — never the
 * secret (D-D, D-H). Main has already refused; this only describes it. With no
 * findings to show (not expected — the same detector runs in main) it falls
 * back to the generic POSSIBLE_SECRET copy, still offering Save anyway.
 */
export function SecretWarning({
  findings,
  onEditText,
  onSaveAnyway,
  disabled,
}: {
  findings: readonly SecretFindingMessage[];
  onEditText: () => void;
  onSaveAnyway: () => void;
  disabled: boolean;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  return (
    <div className="secret-warning" role="alert">
      <p className="secret-warning-title">{t("secrets.warningTitle")}</p>
      <p>
        {findings.length > 0 ? describeSecretFindings(findings, t) : errorCopy("POSSIBLE_SECRET")}
      </p>
      <p className="secret-warning-body">{t("secrets.warningBody")}</p>
      <div className="secret-warning-actions">
        <button type="button" onClick={onEditText} disabled={disabled}>
          {t("secrets.editText")}
        </button>
        <button type="button" onClick={onSaveAnyway} disabled={disabled}>
          {t("secrets.saveAnyway")}
        </button>
      </div>
    </div>
  );
}
