import type { ContextItem } from "../../domain/entities/context-item.js";
import type { Project, ProjectSummary } from "../../domain/entities/project.js";
import type { ProjectBinding } from "../../domain/entities/project-binding.js";
import type { BoundProject } from "../../domain/services/project-resolution.js";
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

/** An item and the slug of the project it lives in — what every by-id lookup returns. */
export interface ItemWithProject {
  item: ContextItem;
  projectName: ProjectName;
}

/** Persistence port for context items: save, look up by id or id prefix, list by project and full-text search. */
export interface ContextItemRepository {
  save(item: ContextItem): void;
  /** Exact, case-sensitive, vault-wide; archived items included. */
  findById(itemId: string): ItemWithProject | null;
  /** Case-insensitive prefix match, vault-wide, sorted by id; archived items included. */
  findByIdPrefix(prefix: string, limit: number): ItemWithProject[];
  findByProject(projectId: string, filters?: FindByProjectFilters): ContextItem[];
  search(query: string, projectId?: string, limit?: number): SearchResult[];
}

/** Persistence port for folder and repository links: add, remove and list them with their project. */
export interface ProjectBindingRepository {
  /** Insert-only. `false` when the (kind, target) pair is already taken — the caller turns that into BINDING_CONFLICT. */
  add(binding: ProjectBinding): boolean;
  /** `false` when no row had that id. */
  remove(bindingId: string): boolean;
  /** Every binding with its project's slug, ordered by project, kind, target. */
  list(): BoundProject[];
}
