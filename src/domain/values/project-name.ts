import { type DomainError, domainErr, ok, type Result } from "../errors.js";

const PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Unique project slug: 1-64 chars, lowercase letters, digits, hyphens (not leading). */
export type ProjectName = string & { readonly __brand: "ProjectName" };

export function parseProjectName(raw: string): Result<ProjectName, DomainError> {
  const normalized = raw.trim().toLowerCase();
  if (!PATTERN.test(normalized)) {
    return domainErr(
      "INVALID_PROJECT_NAME",
      `Project name must be 1-64 chars of [a-z0-9-], starting with a letter or digit. Got: "${raw}"`,
    );
  }
  return ok(normalized as ProjectName);
}
