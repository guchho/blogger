import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BloggerError,
  DiagnosticCollector,
  makeLocation,
  type Span,
} from "../diagnostics.js";
import type {
  CompileOptions,
  CompileResult,
  ResourceKind,
  ResourceReference,
} from "../types.js";
import type { XmlAttribute, XmlDocument, XmlElement, XmlNode } from "../xml/ast.js";
import { attribute } from "../xml/ast.js";
import { parseXml } from "../xml/parser.js";
import { SourceFile, splitBom } from "../xml/source.js";
import { BloggerValidator } from "../validate/blogger.js";
import { applyEdits, removeFollowingNewline, type TextEdit } from "./edits.js";

export const CSS_TOKEN = "@@GUCHHO_BLOGGER_CSS@@";
export const CSS_SKIN_TOKEN = "@@GUCHHO_BLOGGER_CSS_SKIN@@";
export const JS_TOKEN = "@@GUCHHO_BLOGGER_JS@@";
export const ASSET_TOKEN_PREFIX = "@@GUCHHO_BLOGGER_ASSET_";
export const ASSET_TOKEN_SUFFIX = "@@";

export function assetToken(index: number): string {
  return `${ASSET_TOKEN_PREFIX}${index}${ASSET_TOKEN_SUFFIX}`;
}

const ASSET_ATTRIBUTES: Record<string, readonly string[]> = {
  img: ["src", "srcset"],
  source: ["src", "srcset"],
  video: ["src", "poster"],
  audio: ["src"],
  track: ["src"],
  iframe: ["src"],
  embed: ["src"],
  object: ["data"],
  input: ["src"],
};

class FileReadError extends Error {
  readonly filePath: string;

  constructor(filePath: string, cause: unknown) {
    super(`unable to read ${filePath}`);
    this.name = "FileReadError";
    this.filePath = filePath;
    this.cause = cause;
  }
}

interface CompileFileOptions {
  isEntry: boolean;
  includeParent?: XmlElement;
  /** Canonical paths of ancestors, used to detect include cycles. */
  stack: readonly string[];
}

export class TemplateCompiler {
  private readonly options: CompileOptions;
  private readonly diagnostics = new DiagnosticCollector();
  private readonly validator: BloggerValidator;
  private readonly watchFiles = new Set<string>();
  private readonly resources: ResourceReference[] = [];
  private readonly assetPaths: string[] = [];
  private readonly assetTokens = new Map<string, string>();
  private readonly resourceKeys = new Set<string>();

  constructor(options: CompileOptions) {
    this.options = options;
    this.validator = new BloggerValidator(this.diagnostics, {
      enabled: options.validate,
    });
  }

  async compile(): Promise<CompileResult> {
    try {
      const xml = await this.compileFile(this.options.entryPath, {
        isEntry: true,
        stack: [],
      });
      if (this.diagnostics.hasErrors()) {
        return { diagnostics: [...this.diagnostics.diagnostics] };
      }
      return {
        diagnostics: [...this.diagnostics.diagnostics],
        template: {
          marker: createMarker(this.options.entryPath),
          entryPath: this.options.entryPath,
          xml,
          watchFiles: [...this.watchFiles].sort(),
          resources: this.resources.map((resource) => ({ ...resource })),
        },
      };
    } catch (error) {
      if (error instanceof BloggerError) {
        this.diagnostics.add(error.diagnostic);
      } else if (error instanceof FileReadError) {
        this.diagnostics.error(
          "BLOGGER_ENTRY_MISSING",
          `unable to read the Blogger entry "${error.filePath}"`,
          undefined,
          "check the entry option and the file system",
          [String((error as Error).cause ?? error)]
        );
      } else {
        this.diagnostics.error(
          "BLOGGER_INTERNAL",
          `internal compiler error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return { diagnostics: [...this.diagnostics.diagnostics] };
    }
  }

  private async compileFile(
    filePath: string,
    options: CompileFileOptions
  ): Promise<string> {
    const canonical = path.resolve(filePath);

    if (options.stack.includes(canonical)) {
      throw new BloggerError({
        code: "BLOGGER_INCLUDE_CYCLE",
        severity: "error",
        message: `include cycle detected: ${[...options.stack, canonical].join(" -> ")}`,
        location: this.fileLocation(canonical),
      });
    }

    const source = await this.readSource(canonical, options.isEntry);
    this.checkEncoding(source);
    this.watchFiles.add(canonical);

    const document = parseXml(source, { fragment: !options.isEntry });
    this.validator.validateDocument(
      document,
      options.includeParent,
      options.isEntry
    );

    const edits: TextEdit[] = [];
    if (!options.isEntry && document.declaration !== undefined) {
      const declaration = document.declaration;
      edits.push({
        start: declaration.span.start,
        end: removeFollowingNewline(source.text, declaration.span.end),
        replacement: "",
      });
    }

    for (const node of document.children) {
      await this.visitNode(node, edits, options);
    }

    if (options.isEntry) {
      this.addInjectionEdits(document, edits);
    }

    const compiled = applyEdits(source.text, edits);
    return options.isEntry ? `${source.bom}${compiled}` : compiled;
  }

  private async visitNode(
    node: XmlNode,
    edits: TextEdit[],
    options: CompileFileOptions
  ): Promise<void> {
    if (node.type !== "element") return;

    if (node.name === "g:include") {
      await this.visitInclude(node, edits, options);
      return;
    }

    if (isStylesheetLink(node)) {
      this.visitStylesheet(node, edits);
      return;
    }

    if (isLocalScript(node)) {
      this.visitScript(node, edits);
      return;
    }

    this.visitAssetAttributes(node, edits);

    for (const child of node.children) {
      await this.visitNode(child, edits, options);
    }
  }

  private async visitInclude(
    element: XmlElement,
    edits: TextEdit[],
    options: CompileFileOptions
  ): Promise<void> {
    const src = attribute(element, "src");
    if (src === undefined || src.value.trim() === "") {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_SRC",
        "a <g:include> must have a non-empty src attribute",
        src === undefined
          ? this.location(element.source, element.nameSpan)
          : this.location(element.source, src.valueSpan)
      );
      return;
    }

    const nonWhitespaceChild = element.children.find(
      (child) => child.type !== "text" || child.value.trim() !== ""
    );
    if (nonWhitespaceChild !== undefined) {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_CHILDREN",
        "a <g:include> must be self-closing or empty",
        this.location(element.source, nonWhitespaceChild.span)
      );
      return;
    }

    const specifier = src.value.trim();
    if (isExternalSpecifier(specifier) || path.isAbsolute(specifier)) {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_INVALID",
        "the src of a <g:include> must be a relative local path",
        this.location(element.source, src.valueSpan)
      );
      return;
    }
    if (specifier.includes("?") || specifier.includes("#")) {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_INVALID",
        "the src of a <g:include> must not contain a query or fragment",
        this.location(element.source, src.valueSpan)
      );
      return;
    }

    const resolved = path.resolve(path.dirname(element.source.path), specifier);
    if (!isInside(this.options.projectRoot, resolved)) {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_OUTSIDE_PROJECT",
        `the include "${specifier}" resolves outside the project directory`,
        this.location(element.source, src.valueSpan),
        "move the component inside the project"
      );
      return;
    }

    const stack = [...options.stack, element.source.path];
    if (stack.includes(resolved)) {
      this.diagnostics.error(
        "BLOGGER_INCLUDE_CYCLE",
        `include cycle detected: ${[...stack, resolved].join(" -> ")}`,
        this.location(element.source, src.valueSpan)
      );
      return;
    }

    try {
      const child = await this.compileFile(resolved, {
        isEntry: false,
        includeParent: element.parent,
        stack,
      });
      edits.push({
        start: element.span.start,
        end: element.span.end,
        replacement: child,
      });
    } catch (error) {
      if (error instanceof FileReadError) {
        this.diagnostics.error(
          "BLOGGER_INCLUDE_MISSING",
          `unable to read included component "${specifier}"`,
          this.location(element.source, src.valueSpan),
          "create the file or correct the src attribute"
        );
      } else if (error instanceof BloggerError) {
        this.diagnostics.add(error.diagnostic);
      } else {
        throw error;
      }
    }
  }

  private visitStylesheet(element: XmlElement, edits: TextEdit[]): void {
    const href = attribute(element, "href");
    if (href === undefined) {
      this.diagnostics.warning(
        "BLOGGER_RESOURCE_HREF",
        "a stylesheet <link> has no href attribute",
        this.location(element.source, element.nameSpan)
      );
      return;
    }

    const specifier = href.value.trim();
    if (specifier === "" || isExternalSpecifier(specifier)) return;

    const resolved = this.resolveLocal(
      specifier,
      element.source,
      href.valueSpan,
      "BLOGGER_RESOURCE_INVALID",
      "stylesheet"
    );
    if (resolved === undefined) return;

    this.addResource("css", resolved, specifier, element.source.path, element.source, href.valueSpan);
    edits.push({ start: element.span.start, end: element.span.end, replacement: "" });
  }

  private visitScript(element: XmlElement, edits: TextEdit[]): void {
    const src = attribute(element, "src");
    if (src === undefined) return;

    const specifier = src.value.trim();
    if (specifier === "" || isExternalSpecifier(specifier)) return;

    const resolved = this.resolveLocal(
      specifier,
      element.source,
      src.valueSpan,
      "BLOGGER_RESOURCE_INVALID",
      "script"
    );
    if (resolved === undefined) return;

    if (element.children.some((child) => child.type === "element")) {
      this.diagnostics.error(
        "BLOGGER_RESOURCE_SCRIPT_CHILDREN",
        "a <script src> element must not have element children",
        this.location(element.source, element.nameSpan)
      );
      return;
    }

    this.addResource("js", resolved, specifier, element.source.path, element.source, src.valueSpan);
    edits.push({ start: element.span.start, end: element.span.end, replacement: "" });
  }

  private visitAssetAttributes(element: XmlElement, edits: TextEdit[]): void {
    const names = ASSET_ATTRIBUTES[element.name];
    if (names === undefined) return;

    if (element.name === "input" && attribute(element, "type")?.value.toLowerCase() !== "image") {
      return;
    }

    for (const name of names) {
      const attr = attribute(element, name);
      if (attr === undefined) continue;
      if (name === "srcset") {
        this.visitSrcSet(element, attr, edits);
      } else {
        this.visitAssetAttribute(element, attr, edits);
      }
    }
  }

  private visitAssetAttribute(
    element: XmlElement,
    attr: XmlAttribute,
    edits: TextEdit[]
  ): void {
    const specifier = attr.value.trim();
    if (specifier === "" || specifier.startsWith("#") || isExternalSpecifier(specifier)) {
      return;
    }

    const resolved = this.resolveLocal(
      specifier,
      element.source,
      attr.valueSpan,
      "BLOGGER_ASSET_INVALID",
      "asset"
    );
    if (resolved === undefined) return;

    const token = this.tokenForAsset(resolved, specifier, element.source.path, element.source, attr.valueSpan);
    edits.push({
      start: attr.valueSpan.start,
      end: attr.valueSpan.end,
      replacement: token,
    });
  }

  private visitSrcSet(
    element: XmlElement,
    attr: XmlAttribute,
    edits: TextEdit[]
  ): void {
    if (attr.value.includes("data:")) return;

    const candidates = attr.value.split(",");
    const output: string[] = [];
    let changed = false;

    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (trimmed === "") continue;
      const match = /^(\S+)([\s\S]*)$/.exec(trimmed);
      if (match === null) {
        output.push(trimmed);
        continue;
      }
      const specifier = match[1] as string;
      const descriptor = match[2] ?? "";
      if (specifier.startsWith("#") || isExternalSpecifier(specifier)) {
        output.push(`${specifier}${descriptor}`);
        continue;
      }
      const resolved = this.resolveLocal(
        specifier,
        element.source,
        attr.valueSpan,
        "BLOGGER_ASSET_INVALID",
        "asset"
      );
      if (resolved === undefined) {
        output.push(`${specifier}${descriptor}`);
        continue;
      }
      const token = this.tokenForAsset(
        resolved,
        specifier,
        element.source.path,
        element.source,
        attr.valueSpan
      );
      output.push(`${token}${descriptor}`);
      changed = true;
    }

    if (!changed) return;
    edits.push({
      start: attr.valueSpan.start,
      end: attr.valueSpan.end,
      replacement: output.join(", "),
    });
  }

  private addInjectionEdits(document: XmlDocument, edits: TextEdit[]): void {
    const root = document.roots[0];
    if (root === undefined) return;

    if (this.resources.some((resource) => resource.kind === "css")) {
      const skin = findFirst(root, "b:skin");
      if (skin?.endTagSpan !== undefined) {
        const at = skin.endTagSpan.start;
        edits.push({ start: at, end: at, replacement: CSS_SKIN_TOKEN });
      } else {
        const head = findFirst(root, "head");
        if (head === undefined) {
          this.diagnostics.warning(
            "BLOGGER_RESOURCE_NO_HEAD",
            "theme CSS was found, but the template has no <head>; injecting it after the root start tag",
            this.location(root.source, root.nameSpan)
          );
        }
        const at = head?.endTagSpan?.start ?? root.startTagSpan.end;
        edits.push({ start: at, end: at, replacement: CSS_TOKEN });
      }
    }

    if (this.resources.some((resource) => resource.kind === "js")) {
      const body = findFirst(root, "body");
      if (body === undefined) {
        this.diagnostics.warning(
          "BLOGGER_RESOURCE_NO_BODY",
          "theme JavaScript was found, but the template has no <body>; injecting it before the root end tag",
          this.location(root.source, root.nameSpan)
        );
      }
      const at =
        body?.endTagSpan?.start ??
        root.endTagSpan?.start ??
        root.span.end;
      edits.push({ start: at, end: at, replacement: JS_TOKEN });
    }
  }

  private resolveLocal(
    specifier: string,
    source: SourceFile,
    span: Span,
    code: string,
    kind: string
  ): string | undefined {
    const cleaned = specifier.split(/[?#]/, 1)[0] ?? "";
    if (cleaned === "") return undefined;

    const resolved = cleaned.startsWith("/")
      ? path.resolve(this.options.projectRoot, cleaned.slice(1))
      : path.resolve(path.dirname(source.path), cleaned);

    if (!isInside(this.options.projectRoot, resolved)) {
      this.diagnostics.error(
        code,
        `the ${kind} path "${specifier}" resolves outside the project directory`,
        this.location(source, span),
        "move the file inside the project"
      );
      return undefined;
    }

    return resolved;
  }

  private tokenForAsset(
    resolved: string,
    specifier: string,
    importer: string,
    source: SourceFile,
    span: Span
  ): string {
    let token = this.assetTokens.get(resolved);
    if (token !== undefined) return token;

    token = assetToken(this.assetPaths.length);
    this.assetPaths.push(resolved);
    this.assetTokens.set(resolved, token);
    this.addResource("asset", resolved, specifier, importer, source, span);
    return token;
  }

  private addResource(
    kind: ResourceKind,
    resolved: string,
    specifier: string,
    importer: string,
    source: SourceFile,
    span: Span
  ): void {
    const key = `${kind}:${resolved}`;
    if (this.resourceKeys.has(key)) return;
    this.resourceKeys.add(key);

    const location = this.location(source, span);
    this.resources.push({
      kind,
      path: resolved,
      specifier,
      importer,
      location,
    });
  }

  private async readSource(filePath: string, _isEntry: boolean): Promise<SourceFile> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      throw new FileReadError(filePath, error);
    }
    const { bom, text } = splitBom(raw);
    return new SourceFile(filePath, text, bom);
  }

  private checkEncoding(source: SourceFile): void {
    const match = /^\s*<\?xml\b[^?]*\bencoding\s*=\s*["']([^"']+)["']/i.exec(
      source.text
    );
    if (match === null) return;
    const encoding = (match[1] ?? "").toLowerCase();
    if (encoding === "utf-8" || encoding === "utf8") return;

    const start = source.text.indexOf(match[1] ?? "");
    this.diagnostics.error(
      "BLOGGER_XML_ENCODING",
      `unsupported XML encoding "${match[1]}"; templates must be UTF-8`,
      this.location(source, { start, end: start + (match[1]?.length ?? 0) }),
      "save the file as UTF-8"
    );
  }

  private location(source: SourceFile, span: Span): import("../types.js").SourceLocation {
    return makeLocation(source.path, source.text, span.start, span.end, source.starts);
  }

  private fileLocation(filePath: string): import("../types.js").SourceLocation {
    return { file: filePath, line: 1, column: 1, length: 1 };
  }
}

function createMarker(entryPath: string): string {
  return `@@GUCHHO_BLOGGER_MARKER:${entryPath}@@`;
}

function findFirst(element: XmlElement, name: string): XmlElement | undefined {
  if (element.name === name) return element;
  for (const child of element.children) {
    if (child.type !== "element") continue;
    const found = findFirst(child, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

function isStylesheetLink(element: XmlElement): boolean {
  if (element.name !== "link") return false;
  const rel = attribute(element, "rel");
  if (rel === undefined) return false;
  return rel.value
    .toLowerCase()
    .split(/\s+/)
    .includes("stylesheet");
}

function isLocalScript(element: XmlElement): boolean {
  if (element.name !== "script") return false;
  const src = attribute(element, "src");
  return src !== undefined && src.value.trim() !== "" && !isExternalSpecifier(src.value.trim());
}

export function isExternalSpecifier(specifier: string): boolean {
  const value = specifier.trim();
  if (value === "") return true;
  if (value.startsWith("//")) return true;
  if (value.startsWith("#")) return true;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

export function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
