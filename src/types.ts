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

export interface BloggerWidgetDefinitionObject {
  /** A `<b:defaultmarkup>` or `<b:includable>` XML fragment. */
  markup: string;
  /** Deterministic preview data merged into the widget data scope. */
  data?: Record<string, unknown>;
}

export type BloggerWidgetDefinition =
  | string
  | BloggerWidgetDefinitionObject;

export type BloggerWidgetRegistry = Record<string, BloggerWidgetDefinition>;

export type BloggerMockData = Record<string, unknown>;

export interface BloggerContentOptions {
  /** Post JSON directory, relative to the project. Defaults to `src/posts`. */
  postsDir?: string;
  /** Page JSON directory, relative to the project. Defaults to `src/pages`. */
  pagesDir?: string;
  /** Settings JSON directory, relative to the project. Defaults to `data`. */
  dataDir?: string;
  /** Backup directory, relative to the project. Defaults to `.blogger-backups`. */
  backupDir?: string;
  /** Public base URL used to generate content links. Overrides `settings.json`. */
  siteUrl?: string;
  /** Sanitize rich-text HTML before rendering. Defaults to true. */
  sanitize?: boolean;
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
  /** Dashboard button and mock dashboard page in previews. Defaults to true. */
  previewDashboard?: boolean | string;
  /** Output XML path, relative to the output dir. Defaults to "template.xml". */
  outfile?: string;
  /** Conservatively remove insignificant XML whitespace. Defaults to false. */
  minify?: boolean;
  /** Preview data overrides, or a JSON fixture path relative to the project. */
  mockData?: BloggerMockData | string;
  /** Custom preview widget definitions keyed by Blogger widget type. */
  widgets?: BloggerWidgetRegistry;
  /** Local port for the dev-only Layout Editor save service. Defaults to 3001. */
  layoutSavePort?: number;
  /** Preview favicon URL. Defaults to `favicon.ico`. */
  favicon?: string;
  /**
   * Enable file-based content and rendered HTML output. Set to false to keep
   * the legacy XML-only build. Defaults to true.
   */
  content?: boolean | BloggerContentOptions;
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
  /** Byte-for-byte entry source before include expansion, CSS tokens and BOM splitting. */
  sourceText: string;
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
