import type { ContextItem } from "../../domain/entities/context-item.js";
import type { Project, ProjectSummary } from "../../domain/entities/project.js";
import type { StorableItemType } from "../../domain/values/item-type.js";
import type { ProjectName } from "../../domain/values/project-name.js";

/** Persistence port for projects, looked up by their unique slug. */
export interface ProjectRepository {
  save(project: Project): void;
  findByName(name: ProjectName): Project | null;
  list(): ProjectSummary[];
}

/**
 * Optional narrowing for listing a project's items: by type, pinned only, a limit, archived
 * included.
 */
export interface FindByProjectFilters {
  type?: StorableItemType;
  pinned?: boolean;
  limit?: number;
  includeArchived?: boolean;
}

/** A full-text search hit, with the name of the project it belongs to. */
export interface SearchResult {
  item: ContextItem;
  projectName: ProjectName;
}

/**
 * Persistence port for context items: save, list by project, full-text search and archive (soft
 * delete).
 */
export interface ContextItemRepository {
  save(item: ContextItem): void;
  findByProject(projectId: string, filters?: FindByProjectFilters): ContextItem[];
  search(query: string, projectId?: string, limit?: number): SearchResult[];
  archive(itemId: string): boolean;
}
