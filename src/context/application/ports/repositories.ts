import type { ContextItem } from "../../domain/entities/context-item.js";
import type { Project, ProjectSummary } from "../../domain/entities/project.js";
import type { ItemType } from "../../domain/values/item-type.js";
import type { ProjectName } from "../../domain/values/project-name.js";

export interface ProjectRepository {
  save(project: Project): void;
  findByName(name: ProjectName): Project | null;
  list(): ProjectSummary[];
}

export interface FindByProjectFilters {
  type?: ItemType;
  pinned?: boolean;
  limit?: number;
  includeArchived?: boolean;
}

export interface SearchResult {
  item: ContextItem;
  projectName: ProjectName;
}

export interface ContextItemRepository {
  save(item: ContextItem): void;
  findByProject(projectId: string, filters?: FindByProjectFilters): ContextItem[];
  search(query: string, projectId?: string, limit?: number): SearchResult[];
  archive(itemId: string): boolean;
}
