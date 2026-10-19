import type { ProjectName } from "../values/project-name.js";

/** A named container for the context of one piece of work. */
export interface Project {
  readonly id: string;
  readonly name: ProjectName;
  readonly description?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A project with its item count and the time of its latest item. */
export interface ProjectSummary {
  readonly project: Project;
  readonly itemCount: number;
  readonly lastActivityAt: Date | null;
}
