export type DiagnosticSeverity = "error" | "warning";

export interface SourceLocation {
  file: string;
  /** 1-based line. */
  line: number;
  /** 1-based column, counted in UTF-16 code units. */
  column: number;
  /** Length in UTF-16 code units. */
  length: number;
  lineText?: string;
}

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  location?: SourceLocation;
  hint?: string;
  notes?: string[];
}

export interface BloggerPluginOptions {
  /** Blogger XML entry, relative to the project directory. */
  entry?: string;
  /** Enforce conservative Blogger structural rules after XML well-formedness. */
  validate?: boolean;
  /**
   * Emit mock preview pages during watch builds. Defaults to true; previews are
   * never emitted for production (non-watch) builds regardless of this flag.
   */
  preview?: boolean;
  /** Directory for preview pages, relative to the output dir. Defaults to "preview". */
  previewDir?: string;
}

export type ResourceKind = "css" | "js" | "asset";

export interface ResourceReference {
  kind: ResourceKind;
  /** Absolute path on disk. */
  path: string;
  /** Original URL or path as written in the template. */
  specifier: string;
  /** File that contained the reference. */
  importer: string;
  /** Where the reference appeared, for resource diagnostics. */
  location?: SourceLocation;
}

export interface CompiledTemplate {
  marker: string;
  entryPath: string;
  xml: string;
  watchFiles: string[];
  resources: ResourceReference[];
}

export interface CompileOptions {
  validate: boolean;
  projectRoot: string;
  entryPath: string;
}

export interface CompileResult {
  template?: CompiledTemplate;
  diagnostics: Diagnostic[];
}

export interface PreviewOptions {
  entryPath: string;
  xml: string;
  marker: string;
}
