import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  LoadResult,
  NormalizedOutputOptions,
  OutputAsset,
  OutputBundle,
  OutputChunk,
  Plugin,
  PluginContext,
  ResolvedId,
} from "guchho";

import { assembleTemplate } from "./compiler/assemble.js";
import {
  TemplateCompiler,
  assetToken,
  isInside,
} from "./compiler/compiler.js";
import { minifyXml } from "./compiler/minify.js";
import { loadContent, resolveContentPaths } from "./content/index.js";
import type { ContentPaths, ContentSnapshot } from "./content/index.js";
import { formatDiagnostic } from "./diagnostics.js";
import { startSaveService, type SaveServiceHandle } from "./layout/save-service.js";
import { buildPreview, previewRouteFile } from "./preview/index.js";
import { buildWidgetRegistry, type WidgetRegistry } from "./preview/render/widgets.js";
import { parseXml } from "./xml/parser.js";
import { SourceFile } from "./xml/source.js";
import type {
  BloggerPluginOptions,
  CompiledTemplate,
  Diagnostic,
  ResourceReference,
} from "./types.js";

const DEFAULT_ENTRY = "src/template.xml";
const DEFAULT_OUTFILE = "template.xml";
const DEFAULT_LAYOUT_SAVE_PORT = 3001;
const DEFAULT_FAVICON = "favicon.ico";
const DEFAULT_SITE_URL = "http://localhost:3000/";
const CARRIER_NAMESPACE = "guchho-blogger";
const CARRIER_OUTPUT = "guchho-blogger-carrier";

interface BuildStartResult {
  entries: { input: string; output: string }[];
  watchFiles: string[];
}

interface BloggerPluginState {
  entryPath: string;
  fullCarrierEntry: string;
  fullCarrierId: string;
  configuredCarrierId: string;
  fullMarker: string;
  configuredMarker: string;
  template?: CompiledTemplate;
  widgetRegistry?: WidgetRegistry;
  mockData?: Record<string, unknown>;
  mockFixture?: string;
  saveService?: SaveServiceHandle;
  contentPaths?: ContentPaths;
  contentSnapshot?: ContentSnapshot;
  contentError?: string;
}

export function blogger(options: BloggerPluginOptions = {}): Plugin {
  const state: BloggerPluginState = {
    entryPath: path.resolve(process.cwd(), options.entry ?? DEFAULT_ENTRY),
    fullCarrierEntry: "",
    fullCarrierId: "",
    configuredCarrierId: "",
    fullMarker: "",
    configuredMarker: "",
  };
  const markerBase = state.entryPath.replace(/\\/g, "/");
  state.fullCarrierEntry = `\0guchho-blogger-entry:${state.entryPath}`;
  state.fullCarrierId = `\0guchho-blogger:carrier:${state.entryPath}`;
  state.configuredCarrierId = `\0guchho-blogger:configured:${state.entryPath}`;
  state.fullMarker = `@@GUCHHO_BLOGGER_CARRIER:${markerBase}@@`;
  state.configuredMarker = `@@GUCHHO_BLOGGER_CONFIGURED:${markerBase}@@`;

  const validate = options.validate !== false;
  const previewEnabled = options.preview !== false;
  const previewDir = normalizeDir(options.previewDir ?? "preview");
  const layoutSavePort = options.layoutSavePort ?? DEFAULT_LAYOUT_SAVE_PORT;
  const contentEnabled = options.content !== false;
  const contentOptions = typeof options.content === "object" ? options.content : {};

  try {
    state.contentPaths = resolveContentPaths(process.cwd(), contentOptions);
  } catch (error) {
    state.contentError = error instanceof Error ? error.message : String(error);
  }

  return {
    name: "guchho:blogger",

    async buildStart(this: PluginContext): Promise<BuildStartResult> {
      if (contentEnabled && state.contentError !== undefined) {
        this.warn({
          message: `Blogger content is disabled: ${state.contentError}`,
          id: state.entryPath,
          code: "BLOGGER_CONTENT_PATH_FORBIDDEN",
        });
      }
      const compiler = new TemplateCompiler({
        entryPath: state.entryPath,
        projectRoot: process.cwd(),
        validate,
      });
      const result = await compiler.compile();

      for (const diagnostic of result.diagnostics) {
        if (diagnostic.severity !== "warning") continue;
        this.warn(toLog(diagnostic));
      }

      if (result.template === undefined) {
        const errors = result.diagnostics.filter(
          (diagnostic) => diagnostic.severity === "error"
        );
        const text =
          errors.length === 0
            ? "the Blogger template could not be compiled"
            : errors.map((diagnostic) => formatDiagnostic(diagnostic)).join("\n\n");
        this.error({
          message: text,
          id: state.entryPath,
          code: "BLOGGER_BUILD_FAILED",
        });
      }

      state.template = result.template;

      try {
        state.widgetRegistry = buildWidgetRegistry(options.widgets);
      } catch (error) {
        this.error({
          message: `invalid custom widget definition: ${
            error instanceof Error ? error.message : String(error)
          }`,
          id: state.entryPath,
          code: "BLOGGER_WIDGET_INVALID",
        });
      }

      try {
        const loaded = await loadMockData(this, options.mockData);
        state.mockData = loaded.data;
        state.mockFixture = loaded.fixture;
      } catch (error) {
        this.error({
          message: `unable to load mock preview data: ${
            error instanceof Error ? error.message : String(error)
          }`,
          id: state.entryPath,
          code: "BLOGGER_MOCK_DATA_INVALID",
        });
      }

      if (contentEnabled && state.contentPaths !== undefined) {
        try {
          const snapshot = await loadContent(state.contentPaths);
          state.contentSnapshot =
            snapshot.posts.length > 0 || snapshot.pages.length > 0 ? snapshot : undefined;
        } catch (error) {
          state.contentSnapshot = undefined;
          this.warn({
            message: `Blogger content could not be loaded: ${
              error instanceof Error ? error.message : String(error)
            }`,
            id: state.entryPath,
            code: "BLOGGER_CONTENT_LOAD_FAILED",
          });
        }
      }

      if (
        previewEnabled &&
        options.previewDashboard !== false &&
        isWatchBuild(this.meta?.watchMode === true)
      ) {
        try {
          state.saveService = await startSaveService({
            entryPath: state.entryPath,
            projectRoot: process.cwd(),
            port: layoutSavePort,
            contentPaths: state.contentPaths,
          });
        } catch (error) {
          this.warn({
            message: `Blogger Layout save service could not start on port ${layoutSavePort}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            code: "BLOGGER_LAYOUT_SAVE_UNAVAILABLE",
          });
        }
      }

      const contentWatchFiles =
        state.contentPaths === undefined || !contentEnabled
          ? []
          : await jsonFilesIn([
              state.contentPaths.postsDir,
              state.contentPaths.pagesDir,
              state.contentPaths.dataDir,
            ]);

      return {
        entries: [{ input: state.fullCarrierEntry, output: CARRIER_OUTPUT }],
        watchFiles: [
          ...watchFilesFor(result.template),
          ...(state.mockFixture === undefined ? [] : [state.mockFixture]),
          ...contentWatchFiles,
        ],
      };
    },

    resolveId(
      this: PluginContext,
      source: string,
      _importer: string | undefined,
      _resolveOptions: unknown
    ): ResolvedId | null {
      const watchFiles =
        state.template === undefined ? undefined : watchFilesFor(state.template);

      if (source === state.fullCarrierId || source === state.fullCarrierEntry) {
        return {
          id: state.fullCarrierId,
          namespace: CARRIER_NAMESPACE,
          watchFiles,
        } as ResolvedId;
      }

      if (
        !source.startsWith("\0") &&
        path.resolve(process.cwd(), source) === state.entryPath
      ) {
        return {
          id: state.configuredCarrierId,
          namespace: CARRIER_NAMESPACE,
          watchFiles,
        } as ResolvedId;
      }

      return null;
    },

    load(this: PluginContext, id: string): LoadResult | null {
      const template = state.template;
      if (template === undefined) {
        this.error({
          message: "the Blogger carrier was loaded before the template was compiled",
          id: state.entryPath,
          code: "BLOGGER_INTERNAL",
        });
        return null;
      }

      if (id === state.fullCarrierId) {
        return {
          code: carrierCode(template, state.fullMarker),
          loader: "js",
          resolveDir: path.dirname(state.entryPath),
          watchFiles: watchFilesFor(template),
        };
      }

      if (id === state.configuredCarrierId) {
        return {
          code: `export const __guchhoBloggerConfiguredCarrier = ${JSON.stringify(
            state.configuredMarker
          )};
`,
          loader: "js",
          resolveDir: path.dirname(state.entryPath),
          watchFiles: watchFilesFor(template),
        };
      }

      return null;
    },

    async generateBundle(
      this: PluginContext,
      outputOptions: NormalizedOutputOptions,
      bundle: OutputBundle
    ): Promise<void> {
      const template = state.template;
      if (template === undefined) {
        this.error({
          message: "the Blogger template is missing during generateBundle",
          id: state.entryPath,
          code: "BLOGGER_INTERNAL",
        });
        return;
      }

      const entries = Object.values(bundle);
      const carrier = entries.find(
        (entry): entry is OutputChunk =>
          entry.type === "chunk" && entry.code.includes(state.fullMarker)
      );

      if (carrier === undefined) {
        this.error({
          message:
            "Guchho did not load the Blogger carrier entry; this Guchho version does not support entries contributed from buildStart",
          id: state.entryPath,
          code: "BLOGGER_CORE_UNSUPPORTED",
        });
        return;
      }

      const hasHtmlEntry = entries.some(
        (entry) => entry.fileName.replace(/\\/g, "/") === "index.html"
      );
      const bundleDir =
        typeof outputOptions.dir === "string"
          ? outputOptions.dir
          : path.dirname(carrier.fileName);
      const outputDir = path.resolve(process.cwd(), bundleDir);

      let outfile: string;
      try {
        outfile = resolveOutfile(
          options.outfile ?? DEFAULT_OUTFILE,
          outputDir,
          process.cwd()
        );
      } catch (error) {
        this.error({
          message: error instanceof Error ? error.message : String(error),
          id: state.entryPath,
          code: "BLOGGER_OUTPUT_INVALID",
        });
        return;
      }

      const cssAssets = entries.filter(
        (entry): entry is OutputAsset =>
          entry.type === "asset" && entry.fileName.endsWith(".css")
      );
      const css = inlineBundleUrls(
        cssAssets.map((asset) => sourceText(asset.source)).join("\n"),
        entries,
        bundleDir
      );

      const hasJs = template.resources.some((resource) => resource.kind === "js");
      const js = hasJs
        ? inlineBundleUrls(
            stripModuleSyntax(
              stripCarrierCode(
                carrier.code,
                state.fullMarker,
                state.fullCarrierId
              )
            ),
            entries,
            bundleDir
          )
        : "";

      const assets = await assetDataUrls(this, template);
      let xml = assembleTemplate(template, { css, js, assets });
      assertNoUnresolvedTokens(this, xml, state.entryPath);

      if (options.minify === true) {
        try {
          xml = minifyXml(xml, state.entryPath);
        } catch (error) {
          this.error({
            message: `unable to minify the assembled Blogger XML: ${
              error instanceof Error ? error.message : String(error)
            }`,
            id: state.entryPath,
            code: "BLOGGER_OUTPUT_INVALID_XML",
          });
          return;
        }
      }

      try {
        parseXml(new SourceFile(state.entryPath, xml));
      } catch (error) {
        this.error({
          message: `the assembled Blogger XML is not well-formed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          id: state.entryPath,
          code: "BLOGGER_OUTPUT_INVALID_XML",
        });
        return;
      }

      deleteCarrierChunks(bundle, state);

      if (bundle[DEFAULT_FAVICON] === undefined && outfile !== DEFAULT_FAVICON) {
        const faviconSource = await resolveFaviconSource(process.cwd());
        if (faviconSource !== undefined) {
          this.emitFile({
            type: "asset",
            fileName: DEFAULT_FAVICON,
            source: await fs.readFile(faviconSource),
          });
        }
      }

      if (bundle[outfile] !== undefined) {
        this.error({
          message: `the Blogger output "${outfile}" collides with another emitted file`,
          id: state.entryPath,
          code: "BLOGGER_OUTPUT_CONFLICT",
        });
        return;
      }

      this.emitFile({
        type: "asset",
        fileName: outfile,
        source: xml,
      });

      if (previewEnabled && isWatchBuild(this.meta?.watchMode === true)) {
        emitPreview(this, xml, {
          previewDir,
          dashboard: options.previewDashboard,
          entryPath: state.entryPath,
          layoutXml: template.sourceText,
          layoutSavePort: state.saveService?.port ?? layoutSavePort,
          favicon: options.favicon ?? DEFAULT_FAVICON,
          hasHtmlEntry,
          existing: new Set(Object.keys(bundle)),
          widgetRegistry: state.widgetRegistry,
          mockData: state.mockData,
          widgets: options.widgets,
          content: state.contentSnapshot,
          contentOptions: {
            baseUrl:
              contentOptions.siteUrl ??
              (state.contentSnapshot === undefined
                ? DEFAULT_SITE_URL
                : state.contentSnapshot.settings.baseUrl),
            sanitize: contentOptions.sanitize ?? true,
          },
        });
      }

      if (
        contentEnabled &&
        state.contentSnapshot !== undefined &&
        !isWatchBuild(this.meta?.watchMode === true)
      ) {
        emitContentPages(this, xml, {
          entryPath: state.entryPath,
          content: state.contentSnapshot,
          baseUrl:
            contentOptions.siteUrl ??
            (state.contentSnapshot === undefined
              ? DEFAULT_SITE_URL
              : state.contentSnapshot.settings.baseUrl),
          sanitize: contentOptions.sanitize ?? true,
          favicon: options.favicon ?? state.contentSnapshot.settings.favicon ?? DEFAULT_FAVICON,
          hasHtmlEntry,
          existing: new Set(Object.keys(bundle)),
          widgetRegistry: state.widgetRegistry,
          widgets: options.widgets,
        });
      }
    },

    async closeBundle(this: PluginContext): Promise<void> {
      if (state.saveService === undefined) return;
      const service = state.saveService;
      state.saveService = undefined;
      try {
        await service.close();
      } catch (error) {
        this.warn({
          message: `Blogger Layout save service could not stop: ${
            error instanceof Error ? error.message : String(error)
          }`,
          code: "BLOGGER_LAYOUT_SAVE_STOP_FAILED",
        });
      }
    },
  } as unknown as Plugin;
}

function isWatchBuild(metaWatchMode: boolean): boolean {
  if (metaWatchMode) return true;
  const command = process.argv[2];
  return (
    command === "dev" ||
    command === "watch" ||
    process.argv.includes("--watch")
  );
}

async function resolveFaviconSource(projectRoot: string): Promise<string | undefined> {
  const candidates = [
    path.join(projectRoot, DEFAULT_FAVICON),
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      DEFAULT_FAVICON
    ),
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

function normalizeDir(dir: string): string {
  const normalized = dir.replace(/\\/g, "/");
  if (
    path.isAbsolute(dir) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(`previewDir must be a relative path inside the output dir: ${dir}`);
  }
  return normalized.replace(/^\/+|\/+$/g, "");
}

interface PreviewEmitOptions {
  previewDir: string;
  dashboard?: boolean | string;
  entryPath: string;
  layoutXml: string;
  layoutSavePort: number;
  favicon?: string;
  hasHtmlEntry: boolean;
  existing: Set<string>;
  widgetRegistry?: WidgetRegistry;
  mockData?: Record<string, unknown>;
  widgets?: BloggerPluginOptions["widgets"];
  content?: ContentSnapshot;
  contentOptions?: {
    baseUrl?: string;
    favicon?: string;
    sanitize?: boolean;
    now?: Date;
  };
}

function emitPreview(
  context: PluginContext,
  xml: string,
  options: PreviewEmitOptions
): void {
  let result;
  try {
    result = buildPreview({
      entryPath: options.entryPath,
      xml,
      layoutXml: options.layoutXml,
      layoutSavePort: options.layoutSavePort,
      favicon: options.favicon,
      dashboard: options.dashboard,
      widgetRegistry: options.widgetRegistry,
       mockData: options.mockData,
       widgets: options.widgets,
       content: options.content,
       contentOptions: options.contentOptions,
     });
  } catch (error) {
    context.warn({
      message: `Blogger preview could not be rendered: ${
        error instanceof Error ? error.message : String(error)
      }`,
      id: options.entryPath,
      code: "BLOGGER_PREVIEW_FAILED",
    });
    return;
  }

  for (const diagnostic of result.diagnostics) {
    const where =
      diagnostic.file !== undefined && diagnostic.line !== undefined
        ? ` (${diagnostic.file}:${diagnostic.line}:${diagnostic.column ?? 1})`
        : "";
    context.warn({
      message: `Blogger preview ${diagnostic.severity}: ${diagnostic.message}${where}`,
      id: diagnostic.file ?? options.entryPath,
      line: diagnostic.line,
      column:
        diagnostic.column === undefined ? undefined : Math.max(0, diagnostic.column - 1),
      code: diagnostic.code,
    });
  }

  const emitted = new Set(options.existing);
  for (const page of result.pages) {
    const flat =
      options.previewDir === ""
        ? page.file
        : `${options.previewDir}/${page.file}`;
    emitPreviewFile(context, emitted, flat, page.html, false);

    let routeFile: string;
    try {
      routeFile = previewRouteFile(page.route);
    } catch (error) {
      context.warn({
        message: `Blogger preview route "${page.route}" was skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
        id: options.entryPath,
        code: "BLOGGER_PREVIEW_ROUTE_INVALID",
      });
      continue;
    }

    if (routeFile === "index.html" && options.hasHtmlEntry) continue;
    if (emitted.has(routeFile) && routeFile !== flat) {
      if (routeFile !== "index.html") {
        context.warn({
          message: `Blogger preview route "${page.route}" collides with "${routeFile}" and was skipped`,
          id: options.entryPath,
          code: "BLOGGER_PREVIEW_ROUTE_CONFLICT",
        });
      }
      continue;
    }
    emitPreviewFile(context, emitted, routeFile, page.html, routeFile === "index.html");
  }
}

function emitPreviewFile(
  context: PluginContext,
  emitted: Set<string>,
  fileName: string,
  source: string,
  reserved: boolean
): void {
  if (emitted.has(fileName)) {
    if (!reserved) {
      context.warn({
        message: `Blogger preview file "${fileName}" collides with an existing output and was skipped`,
        code: "BLOGGER_PREVIEW_ROUTE_CONFLICT",
      });
    }
    return;
  }
  context.emitFile({ type: "asset", fileName, source });
  emitted.add(fileName);
}

async function jsonFilesIn(directories: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const directory of directories) {
    try {
      for (const name of await fs.readdir(directory)) {
        if (name.endsWith(".json")) files.push(path.join(directory, name));
      }
    } catch {
      continue;
    }
  }
  return files;
}

interface ContentEmitOptions {
  entryPath: string;
  content: ContentSnapshot;
  baseUrl: string;
  sanitize: boolean;
  favicon?: string;
  hasHtmlEntry: boolean;
  existing: Set<string>;
  widgetRegistry?: WidgetRegistry;
  widgets?: BloggerPluginOptions["widgets"];
}

function emitContentPages(
  context: PluginContext,
  xml: string,
  options: ContentEmitOptions
): void {
  let result;
  try {
    result = buildPreview({
      entryPath: options.entryPath,
      xml,
      banner: false,
      dashboard: false,
      favicon: options.favicon,
      widgetRegistry: options.widgetRegistry,
      widgets: options.widgets,
      content: options.content,
      contentOptions: {
        baseUrl: options.baseUrl,
        favicon: options.favicon,
        sanitize: options.sanitize,
        includeWidgets: false,
      },
    });
  } catch (error) {
    context.warn({
      message: `Blogger content pages could not be rendered: ${
        error instanceof Error ? error.message : String(error)
      }`,
      id: options.entryPath,
      code: "BLOGGER_CONTENT_RENDER_FAILED",
    });
    return;
  }

  const emitted = new Set(options.existing);
  for (const page of result.pages) {
    let file: string;
    try {
      file = previewRouteFile(page.route);
    } catch (error) {
      context.warn({
        message: `Blogger content route "${page.route}" was skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
        id: options.entryPath,
        code: "BLOGGER_CONTENT_ROUTE_INVALID",
      });
      continue;
    }
    if (file === "index.html" && options.hasHtmlEntry) continue;
    emitPreviewFile(context, emitted, file, page.html, file === "index.html");
  }
}

function resolveOutfile(
  value: string,
  outputDir: string,
  cwd: string
): string {
  const trimmed = value.trim();
  if (trimmed === "") return DEFAULT_OUTFILE;

  const candidate = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(cwd, trimmed);
  if (isInside(outputDir, candidate)) {
    return path.relative(outputDir, candidate).replace(/\\/g, "/");
  }

  if (!path.isAbsolute(trimmed)) {
    const fromOutput = path.resolve(outputDir, trimmed);
    if (isInside(outputDir, fromOutput)) {
      return path.relative(outputDir, fromOutput).replace(/\\/g, "/");
    }
  }

  throw new Error(
    `outfile must resolve inside the Guchho output directory (${outputDir}): ${value}`
  );
}

function deleteCarrierChunks(
  bundle: OutputBundle,
  state: BloggerPluginState
): void {
  for (const [fileName, entry] of Object.entries(bundle)) {
    if (entry.type !== "chunk") continue;
    if (
      entry.code.includes(state.fullMarker) ||
      entry.code.includes(state.configuredMarker) ||
      entry.code.includes(state.fullCarrierId) ||
      entry.code.includes(state.configuredCarrierId)
    ) {
      delete bundle[fileName];
    }
  }
}

async function loadMockData(
  context: PluginContext,
  value: BloggerPluginOptions["mockData"]
): Promise<{
  data?: Record<string, unknown>;
  fixture?: string;
}> {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    if (value === null || Array.isArray(value)) {
      context.error({
        message: "mockData must be an object or a JSON fixture path",
        code: "BLOGGER_MOCK_DATA_INVALID",
      });
    }
    return { data: value };
  }

  const fixture = path.resolve(process.cwd(), value);
  let text: string;
  try {
    text = await fs.readFile(fixture, "utf8");
  } catch {
    throw new Error(`unable to read "${value}"`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `"${value}" is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`"${value}" must contain a JSON object`);
  }
  return { data: parsed as Record<string, unknown>, fixture };
}

function carrierCode(template: CompiledTemplate, marker: string): string {
  const imports = template.resources
    .filter((resource) => resource.kind === "css" || resource.kind === "js")
    .map((resource) => `import ${JSON.stringify(toImportSpecifier(resource.path))};`);

  return [
    ...imports,
    `export const __guchhoBloggerCarrier = ${JSON.stringify(marker)};`,
    "",
  ].join("\n");
}

function toImportSpecifier(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function watchFilesFor(template: CompiledTemplate): string[] {
  const files = new Set(template.watchFiles);
  for (const resource of template.resources) files.add(resource.path);
  return [...files];
}

function toLog(diagnostic: Diagnostic): {
  message: string;
  id?: string;
  line?: number;
  column?: number;
  code?: string;
} {
  const location = diagnostic.location;
  return {
    message: formatDiagnostic(diagnostic),
    ...(location === undefined
      ? {}
      : {
          id: location.file,
          line: location.line,
          column: Math.max(0, location.column - 1),
        }),
    code: diagnostic.code,
  };
}

async function assetDataUrls(
  context: PluginContext,
  template: CompiledTemplate
): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  let index = 0;

  for (const resource of template.resources) {
    if (resource.kind !== "asset") continue;
    const token = assetToken(index++);
    try {
      const bytes = await fs.readFile(resource.path);
      assets.set(token, toDataUrl(bytes, resource.path));
    } catch {
      context.error({
        message: `unable to read the asset "${resource.specifier}"`,
        id: resource.location?.file ?? resource.importer,
        line: resource.location?.line,
        column:
          resource.location === undefined
            ? undefined
            : Math.max(0, resource.location.column - 1),
        code: "BLOGGER_ASSET_MISSING",
      });
    }
  }

  return assets;
}

function assertNoUnresolvedTokens(
  context: PluginContext,
  xml: string,
  entryPath: string
): void {
  const tokens = new Set<string>();
  for (const match of xml.matchAll(/@@GUCHHO_BLOGGER_[A-Z0-9_]+@@/g)) {
    const token = match[0];
    if (token !== undefined) tokens.add(token);
  }
  if (tokens.size === 0) return;

  context.error({
    message: `unresolved Blogger resource token(s): ${[...tokens].join(", ")}`,
    id: entryPath,
    code: "BLOGGER_RESOURCE_UNRESOLVED",
  });
}

function stripCarrierCode(
  code: string,
  marker: string,
  carrierId: string
): string {
  return code
    .split("\n")
    .filter(
      (line) =>
        !line.includes(marker) &&
        !line.includes(carrierId) &&
        !line.includes("__guchhoBloggerCarrier")
    )
    .join("\n");
}

function stripModuleSyntax(code: string): string {
  return code
    .replace(/^\s*import\s+(?:[^;]*?\sfrom\s*)?["'][^"']+["']\s*;?\s*$/gm, "")
    .replace(/\bexport\s*\{[^}]*\}\s*;?/g, "")
    .replace(/\bexport\s+default\s+/g, "")
    .replace(/\bexport\s+(?=(?:const|let|var|function|class|async)\b)/g, "");
}

function inlineBundleUrls(
  text: string,
  entries: readonly (OutputChunk | OutputAsset)[],
  outputDir?: string
): string {
  const replacements = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== "asset") continue;
    if (entry.fileName.endsWith(".css")) continue;
    if (entry.fileName.endsWith(".js")) continue;
    const key =
      outputDir === undefined
        ? entry.fileName
        : path.relative(outputDir, entry.fileName).replace(/\\/g, "/");
    replacements.set(key, toDataUrl(entry.source, entry.fileName));
  }

  let output = text;

  const cssUrl = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
  output = output.replace(cssUrl, (whole, _quote: string, url: string) => {
    const key = normalizeBundleKey(url);
    const data = replacements.get(key);
    return data === undefined ? whole : `url("${data}")`;
  });

  for (const [fileName, data] of replacements) {
    output = output.split(fileName).join(data);
    output = output.split(`./${fileName}`).join(data);
    output = output.split(`/${fileName}`).join(data);
  }

  return output;
}

function normalizeBundleKey(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0] ?? "";
  return withoutQuery.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function sourceText(source: string | Uint8Array): string {
  return typeof source === "string" ? source : Buffer.from(source).toString("utf8");
}

function toDataUrl(source: string | Uint8Array, filePath: string): string {
  const bytes =
    typeof source === "string" ? Buffer.from(source, "utf8") : Buffer.from(source);
  return `data:${mimeType(filePath)};base64,${bytes.toString("base64")}`;
}

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".css": "text/css",
  ".eot": "application/vnd.ms-fontobject",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

function mimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] ?? "application/octet-stream";
}
