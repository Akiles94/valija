import type { ProjectName } from "../values/project-name.js";

export interface Project {
  readonly id: string;
  readonly name: ProjectName;
  readonly description?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectSummary {
  readonly project: Project;
  readonly itemCount: number;
  readonly lastActivityAt: Date | null;
}
