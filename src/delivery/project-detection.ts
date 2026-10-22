import { homedir } from "node:os";
import type { DetectionKind } from "../context/application/dto/project-resolution-output.js";
import { contextErr } from "../context/domain/errors.js";
import type { BindingKind } from "../context/domain/values/binding-target.js";
import { type DomainError, ok, type Result } from "../shared/domain/result.js";
import type { Container } from "./container.js";

/** The project a surface will use, and how it was detected (absent when it was given explicitly). */
export interface ProjectChoice {
  project: string;
  detectedBy?: DetectionKind;
}

const DETECTION_LABELS: Record<DetectionKind, string> = {
  folder: "linked folder",
  repository: "linked repository",
  env: "VALIJA_PROJECT",
};

/**
 * Explicit wins untouched — no session, no probe, no env read, so an explicit
 * call is byte-identical to before detection existed. Otherwise
 * `VALIJA_PROJECT`, then bindings, or a PROJECT_NOT_DETECTED /
 * PROJECT_AMBIGUOUS error ending in `remedy`. Messages carry slugs only, never
 * a path or a remote (refined.md §10).
 */
export function chooseProject(
  c: Container,
  explicit: string | undefined,
  directories: string[],
  remedy: string,
): Result<ProjectChoice, DomainError> {
  if (explicit !== undefined) return ok({ project: explicit });
  const resolved = c.resolveProject.execute({
    directories,
    ...(c.envProject === undefined ? {} : { envProject: c.envProject }),
  });
  if (!resolved.ok) return resolved;
  const r = resolved.value;
  if (r.outcome === "detected") return ok({ project: r.project, detectedBy: r.detectedBy });
  if (r.outcome === "ambiguous") {
    return contextErr(
      "PROJECT_AMBIGUOUS",
      `This workspace's folders are linked to different projects: ${r.projects.join(", ")}. ${remedy}`,
    );
  }
  return contextErr(
    "PROJECT_NOT_DETECTED",
    `No project was given and none is linked to this workspace.${hintSentence(r.hint)} ${remedy}`,
  );
}

/** "linked folder" | "linked repository" | "VALIJA_PROJECT" — the only detection words a response ever shows. */
export function detectionLabel(kind: DetectionKind): string {
  return DETECTION_LABELS[kind];
}

/** A folder with `~` for the home directory; a repository as-is. For CLI and desktop display only. */
export function displayTarget(
  view: { kind: BindingKind; target: string },
  home: string = homedir(),
): string {
  if (view.kind === "repository" || home === "") return view.target;
  if (view.target === home) return "~";
  const rest = view.target.slice(home.length);
  return view.target.startsWith(home) && /^[\\/]/.test(rest) ? `~${rest}` : view.target;
}

function hintSentence(hint: string | undefined): string {
  if (hint === undefined) return "";
  return ` A project named "${hint}" matches this repository's name; link it with: valija link ${hint}.`;
}
