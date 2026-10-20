/** Repository-level choices the core needs: title, folders, and how flows group by theme. */
export interface GuideSettings {
  readonly title: string;
  /** Repo-relative posix path of the hand-written flow sources. */
  readonly flowsDir: string;
  /** Repo-relative posix path of the generated guide. */
  readonly guideDir: string;
  /** Theme display order on the index; unknown themes sort after these, alphabetically. */
  readonly themeOrder: readonly string[];
  /** Reference kinds flows may cite as `{{kind:name}}`. */
  readonly referenceKinds: readonly string[];
}
