/** The syntactic form an exported symbol was declared with. */
export type DeclarationKind =
  | "class"
  | "function"
  | "interface"
  | "type"
  | "const"
  | "let"
  | "var"
  | "enum"
  | "namespace";

/** An exported code symbol and its TSDoc, as the coverage rules and link resolution see it. */
export interface DocumentedSymbol {
  readonly name: string;
  readonly declaration: DeclarationKind;
  /** Repo-relative posix path of the declaring file. */
  readonly file: string;
  readonly line: number;
  /** The attached `/** … *\/` text with comment markers stripped, or `null` when none. */
  readonly doc: string | null;
  readonly requiresDoc: boolean;
}
