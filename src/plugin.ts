import { promises as fs } from "node:fs";
import path from "node:path";

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
} from "./compiler/compiler.js";
import { formatDiagnostic } from "./diagnostics.js";
import { buildPreview } from "./preview/index.js";
import type {
  BloggerPluginOptions,
  CompiledTemplate,
  Diagnostic,
  ResourceReference,
} from "./types.js";

const DEFAULT_ENTRY = "src/template.xml";
const OUTPUT_FILE = "template.xml";
const CARRIER_NAMESPACE = "guchho-blogger";
const CARRIER_OUTPUT = "guchho-blogger-carrier";

interface BuildStartResult {
  entries: { input: string; output: string }[];
  watchFiles: string[];
}

interface BloggerPluginState {
  entryPath: string;
  carrierEntry: string;
  carrierId: string;
  marker: string;
  template?: CompiledTemplate;
}

export function blogger(options: BloggerPluginOptions = {}): Plugin {
  const state: BloggerPluginState = {
    entryPath: path.resolve(process.cwd(), options.entry ?? DEFAULT_ENTRY),
    carrierEntry: "",
    carrierId: "",
    marker: "",
  };
  state.carrierEntry = `\0guchho-blogger-entry:${state.entryPath}`;
  state.carrierId = `\0guchho-blogger:${state.entryPath}`;
  state.marker = `@@GUCHHO_BLOGGER_CARRIER:${state.entryPath.replace(/\\/g, "/")}@@`;

  const validate = options.validate !== false;
  const previewEnabled = options.preview !== false;
  const previewDir = normalizeDir(options.previewDir ?? "preview");

  return {
    name: "guchho:blogger",

    async buildStart(this: PluginContext): Promise<BuildStartResult> {
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
      return {
        entries: [{ input: state.carrierEntry, output: CARRIER_OUTPUT }],
        watchFiles: watchFilesFor(result.template),
      };
    },

    resolveId(
      this: PluginContext,
      source: string,
      _importer: string | undefined,
      _resolveOptions: unknown
    ): ResolvedId | null {
      if (source !== state.carrierId && source !== state.carrierEntry) {
        return null;
      }

      return {
        id: state.carrierId,
        namespace: CARRIER_NAMESPACE,
        watchFiles:
          state.template === undefined
            ? undefined
            : watchFilesFor(state.template),
      } as ResolvedId;
    },

    load(this: PluginContext, id: string): LoadResult | null {
      if (id !== state.carrierId) return null;

      const template = state.template;
      if (template === undefined) {
        this.error({
          message: "the Blogger carrier was loaded before the template was compiled",
          id: state.entryPath,
          code: "BLOGGER_INTERNAL",
        });
        return null;
      }

      return {
        code: carrierCode(template, state.marker),
        loader: "js",
        resolveDir: path.dirname(state.entryPath),
        watchFiles: watchFilesFor(template),
      };
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
          entry.type === "chunk" && entry.code.includes(state.marker)
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

      const outputDir =
        typeof outputOptions.dir === "string"
          ? outputOptions.dir
          : path.dirname(carrier.fileName);

      const cssAssets = entries.filter(
        (entry): entry is OutputAsset =>
          entry.type === "asset" && entry.fileName.endsWith(".css")
      );
      const css = inlineBundleUrls(
        cssAssets.map((asset) => sourceText(asset.source)).join("\n"),
        entries,
        outputDir
      );

      const hasJs = template.resources.some((resource) => resource.kind === "js");
      const js = hasJs
        ? inlineBundleUrls(
            stripModuleSyntax(
              stripCarrierCode(carrier.code, state.marker, state.carrierId)
            ),
            entries,
            outputDir
          )
        : "";

      const assets = await assetDataUrls(this, template);
      const xml = assembleTemplate(template, { css, js, assets });
      assertNoUnresolvedTokens(this, xml, state.entryPath);

      // Remove only the synthetic carrier chunk. It is an implementation detail
      // of pulling CSS/JS/assets through Guchho, never part of the output.
      // Deleting the whole bundle when the carrier is the only chunk used to
      // also erase a normal HTML entry, whose page is an asset and not a chunk,
      // so a project with both entries silently lost dist/index.html.
      delete bundle[carrier.fileName];

      this.emitFile({
        type: "asset",
        fileName: OUTPUT_FILE,
        source: xml,
      });

      if (previewEnabled && this.meta?.watchMode === true) {
        emitPreview(this, xml, previewDir, state.entryPath);
      }
    },
  } as unknown as Plugin;
}

function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function emitPreview(
  context: PluginContext,
  xml: string,
  previewDir: string,
  entryPath: string
): void {
  let result;
  try {
    result = buildPreview({ entryPath, xml });
  } catch (error) {
    context.warn({
      message: `Blogger preview could not be rendered: ${
        error instanceof Error ? error.message : String(error)
      }`,
      id: entryPath,
      code: "BLOGGER_PREVIEW_FAILED",
    });
    return;
  }

  for (const diagnostic of result.diagnostics) {
    const where = diagnostic.location ? ` (${entryPath}:${diagnostic.location})` : "";
    context.warn({
      message: `Blogger preview: ${diagnostic.message}${where}`,
      id: entryPath,
      code: diagnostic.code,
    });
  }

  for (const page of result.pages) {
    context.emitFile({
      type: "asset",
      fileName: previewDir === "" ? page.file : `${previewDir}/${page.file}`,
      source: page.html,
    });
  }
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
  for (const resource of template.resources) {
    if (resource.kind !== "asset") files.add(resource.path);
  }
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
