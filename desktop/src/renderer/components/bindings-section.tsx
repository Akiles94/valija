import { useEffect, useState } from "react";
import type {
  BindingMessage,
  BindingsInspectResponse,
  DialogFileChoiceResponse,
} from "../../shared/ipc/messages.js";
import { type LinkChoice, linkChoicesFor } from "../state/binding-link.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

interface InspectPanel {
  folder: DialogFileChoiceResponse;
  inspection: BindingsInspectResponse;
}

/**
 * The project's folder and repository links — parity with `valija links`,
 * `link` and `unlink` (and `which`, through the inspect panel). The app has
 * no working directory, so it never detects a project itself: it only
 * manages the links the CLI and AI tools use. All state is in React memory;
 * nothing here reaches `bridge.preferences`.
 */
export function BindingsSection({ bridge, project }: { bridge: ValijaBridge; project: string }) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [bindings, setBindings] = useState<BindingMessage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // Kept apart from `listError`, which every reload clears — a refused action must outlive its reload.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<InspectPanel | null>(null);
  const [choice, setChoice] = useState<LinkChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge and errorCopy are stable across renders; project/reloadToken are the real inputs
  useEffect(() => {
    let cancelled = false;
    setListError(null);
    bridge.bindings
      .list({ projectName: project })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setBindings(result.value);
        else setListError(errorCopy(result.error.code));
      })
      .catch(() => {
        if (!cancelled) setListError(errorCopy("UNEXPECTED"));
      });
    return () => {
      cancelled = true;
    };
  }, [project, reloadToken]);

  /** One bridge round-trip with the shared busy/error handling; a rejected call shows UNEXPECTED. */
  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await run();
    } catch {
      setError(errorCopy("UNEXPECTED"));
    } finally {
      setBusy(false);
    }
  }

  const chooseFolder = () =>
    act(async () => {
      setPanel(null);
      const folder = await bridge.dialog.chooseProjectFolder();
      if (folder === null) return;
      const result = await bridge.bindings.inspect({ handle: folder.handle });
      if (!result.ok) {
        setError(errorCopy(result.error.code));
        return;
      }
      setPanel({ folder, inspection: result.value });
      setChoice(linkChoicesFor(result.value)[0] ?? null);
    });

  const link = (handle: string, by: LinkChoice) =>
    act(async () => {
      const result = await bridge.bindings.link({ handle, projectName: project, by });
      if (!result.ok) {
        setError(errorCopy(result.error.code));
        return;
      }
      if (!result.value.changed) setNotice(t("bindings.alreadyLinked"));
      setPanel(null);
      setReloadToken((n) => n + 1);
    });

  const unlink = (bindingId: string) =>
    act(async () => {
      const result = await bridge.bindings.unlink({ bindingId });
      if (!result.ok) setError(errorCopy(result.error.code));
      setReloadToken((n) => n + 1);
    });

  return (
    <section className="bindings-section" aria-labelledby="bindings-title">
      <h2 id="bindings-title" className="item-section-title">
        {t("bindings.sectionTitle")}
      </h2>
      <p className="bindings-hint">{t("bindings.sectionHint")}</p>
      {listError !== null && <p className="error">{listError}</p>}
      {bindings !== null && bindings.length === 0 && (
        <p className="bindings-empty">{t("bindings.empty")}</p>
      )}
      {bindings !== null && bindings.length > 0 && (
        <ul className="bindings-list">
          {bindings.map((binding) => (
            <li key={binding.id} className="bindings-row">
              <span className="bindings-kind">
                {binding.kind === "repository"
                  ? t("bindings.kindRepository")
                  : t("bindings.kindFolder")}
              </span>
              <span className="bindings-target" title={binding.target}>
                {binding.target}
              </span>
              <button
                type="button"
                className="item-action"
                disabled={busy}
                onClick={() => void unlink(binding.id)}
              >
                {t("bindings.unlink")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error !== null && <p className="error">{error}</p>}
      {notice !== null && <p className="notice">{notice}</p>}
      {panel === null ? (
        <button type="button" disabled={busy} onClick={() => void chooseFolder()}>
          {t("bindings.linkFolder")}
        </button>
      ) : (
        <InspectPanelView
          panel={panel}
          project={project}
          choice={choice}
          busy={busy}
          onChoose={setChoice}
          onLink={(by) => void link(panel.folder.handle, by)}
          onCancel={() => {
            setPanel(null);
            setError(null);
          }}
        />
      )}
    </section>
  );
}

function InspectPanelView({
  panel,
  project,
  choice,
  busy,
  onChoose,
  onLink,
  onCancel,
}: {
  panel: InspectPanel;
  project: string;
  choice: LinkChoice | null;
  busy: boolean;
  onChoose: (choice: LinkChoice) => void;
  onLink: (by: LinkChoice) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const { inspection } = panel;
  const choices = linkChoicesFor(inspection);
  const resolvesTo = inspection.resolvesTo;

  return (
    <div className="bindings-inspect">
      <h3 className="bindings-folder">{panel.folder.displayName}</h3>
      <p>
        {resolvesTo === null
          ? t("bindings.resolvesNothing")
          : t(
              resolvesTo.kind === "repository"
                ? "bindings.resolvesNowRepository"
                : "bindings.resolvesNowFolder",
              { project: resolvesTo.project },
            )}
      </p>
      <p>
        {inspection.remote !== null
          ? t("bindings.isRepository", { remote: inspection.remote })
          : inspection.isRepository
            ? t("bindings.repositoryNoRemote")
            : t("bindings.notRepository")}
      </p>
      {inspection.hint !== undefined && inspection.hint !== project && (
        <p className="bindings-hint">{t("bindings.hint", { project: inspection.hint })}</p>
      )}
      {choices.length === 0 ? (
        <p className="error">{errorCopy("INVALID_WORKSPACE_PATH")}</p>
      ) : (
        <fieldset className="bindings-choices">
          <legend>{t("bindings.linkAs")}</legend>
          {choices.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="binding-link-choice"
                value={option}
                checked={choice === option}
                onChange={() => onChoose(option)}
              />
              {option === "repository"
                ? t("bindings.linkRepository")
                : t("bindings.linkFolderOnly")}
            </label>
          ))}
        </fieldset>
      )}
      <div className="modal-actions">
        <button type="button" disabled={busy} onClick={onCancel}>
          {t("bindings.cancel")}
        </button>
        {choice !== null && choices.includes(choice) && (
          <button type="button" disabled={busy} onClick={() => onLink(choice)}>
            {t("bindings.link")}
          </button>
        )}
      </div>
    </div>
  );
}
