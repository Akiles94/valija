import { useT } from "../state/i18n-context.js";

export function NoVaultScreen({
  onCreateVault,
  onPointAtExisting,
}: {
  onCreateVault: () => void;
  onPointAtExisting: () => void;
}) {
  const t = useT();
  return (
    <div className="screen">
      <h1>{t("noVault.title")}</h1>
      <div className="actions">
        <button type="button" onClick={onCreateVault}>
          {t("noVault.createVault")}
        </button>
        <button type="button" onClick={onPointAtExisting}>
          {t("noVault.haveOne")}
        </button>
      </div>
      <p className="explainer">{t("noVault.haveOneExplainer")}</p>
    </div>
  );
}
