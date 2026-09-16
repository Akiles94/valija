import { useT } from "../../state/i18n-context.js";

export const NEW_PROJECT = "__new__";

/** The project-destination controls, moved verbatim from import.tsx (GUI-LAYOUT slice 10c) — the existing DOM tests find them by `getByLabelText("Import into")` / `"Project name"`, which must keep working. */
export function DestinationPicker({
  existingProjects,
  projectChoice,
  newProjectName,
  hintText,
  onProjectChoiceChange,
  onNewProjectNameChange,
}: {
  existingProjects: readonly string[];
  projectChoice: string;
  newProjectName: string;
  hintText: string;
  onProjectChoiceChange: (value: string) => void;
  onNewProjectNameChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <>
      <label>
        {t("import.projectLabel")}
        <select value={projectChoice} onChange={(e) => onProjectChoiceChange(e.target.value)}>
          <option value={NEW_PROJECT}>{t("import.projectNewOption")}</option>
          {existingProjects.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {projectChoice === NEW_PROJECT && (
        <div className="new-project-field">
          <label htmlFor="new-project-name">{t("import.projectNameLabel")}</label>
          <input
            id="new-project-name"
            type="text"
            value={newProjectName}
            onChange={(e) => onNewProjectNameChange(e.target.value)}
            placeholder={t("import.projectNamePlaceholder")}
            aria-describedby="new-project-name-hint"
          />
          <p id="new-project-name-hint" className="project-slug-hint">
            {hintText}
          </p>
        </div>
      )}
    </>
  );
}
