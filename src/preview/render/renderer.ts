// Renders a parsed Blogger template into static HTML using the deterministic
// mock data. The renderer understands the Blogger element vocabulary
// (`b:*`, `data:*`, `expr:*`) and never touches the production compiler.

import {
  attribute,
  isElement,
  walk,
  type XmlDocument,
  type XmlElement,
  type XmlNode,
} from "../../xml/ast.js";
import type { ExprNode } from "../expr/ast.js";
import { makeLocation } from "../../diagnostics.js";
import { Evaluator, Scope } from "../expr/evaluator.js";
import { ExpressionError } from "../expr/errors.js";
import { parseExpression } from "../expr/parser.js";
import { decodeEntities } from "../expr/tokenizer.js";
import {
  HtmlString,
  escapeHtml,
  isMap,
  isTruthy,
  toText,
  type Value,
  type ValueMap,
} from "../values.js";
import { expandLinks, widgetDataFor } from "../data/mock.js";
import { builtinIncludables } from "./builtins.js";
import { withImageFallback } from "./image-fallback.js";
import {
  buildWidgetRegistry,
  type WidgetRegistry,
} from "./widgets.js";

export interface RenderReportDetail {
  severity?: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  hint?: string;
}

export interface RenderHost {
  report(
    code: string,
    message: string,
    location?: string,
    detail?: RenderReportDetail
  ): void;
}

export interface RenderResult {
  html: string;
  reports: string[];
}

type Layer = "widget" | "default" | "common" | "builtin";

interface RenderEnv {
  includables: Map<string, XmlElement>;
  widgetType: string;
}

interface ResolvedIncludable {
  node: XmlElement;
  layer: Layer;
}

interface Branch {
  cond?: string;
  isElse?: boolean;
  node: XmlElement;
  body: XmlNode[];
}

function staticImageSrc(nodes: readonly XmlNode[]): string | undefined {
  let result: string | undefined;
  walk(nodes, (node) => {
    if (result !== undefined || !isElement(node) || node.name !== "img") return;
    if (attribute(node, "src") === undefined) return;
    const value = attribute(node, "src")?.value;
    if (value !== undefined && value !== "") result = decodeEntities(value);
  });
  return result;
}

interface CaseBranch {
  value?: string;
  node: XmlElement;
  body: XmlNode[];
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const MAX_INCLUDE_DEPTH = 64;

export class TemplateRenderer {
  private readonly document: XmlDocument;
  private readonly data: ValueMap;
  private readonly host: RenderHost;
  private readonly evaluator: Evaluator;
  private readonly parseCache = new Map<string, ExprNode | null>();
  private readonly reports: string[] = [];
  private readonly defaultMarkups = new Map<string, Map<string, XmlElement>>();
  private readonly commonIncludables = new Map<string, XmlElement>();
  private readonly widgetRegistry: WidgetRegistry;
  private includeDepth = 0;
  private currentLayer: Layer = "common";

  constructor(
    document: XmlDocument,
    data: ValueMap,
    host: RenderHost,
    widgetRegistry?: WidgetRegistry
  ) {
    this.document = document;
    this.data = data;
    this.host = host;
    this.widgetRegistry = widgetRegistry ?? buildWidgetRegistry(undefined);
    this.evaluator = new Evaluator(data, {
      report: (code, message) => this.report(code, message),
    });
    this.collectDefaultMarkups();
  }

  render(): RenderResult {
    const out: string[] = [];
    const root = Scope.root(this.data);
    const env: RenderEnv = { includables: new Map(), widgetType: "Common" };
    this.renderNodes(this.document.children, root, env, out);
    return { html: out.join(""), reports: this.reports };
  }

  /** Renders each widget's main includable for the Layout Editor canvas. */
  renderWidgetMarkups(): Map<string, string> {
    const result = new Map<string, string>();
    const root = Scope.root(this.data);
    walk(this.document.children, (node) => {
      if (!isElement(node) || node.name !== "b:widget") return;
      const id = this.attrValue(node, "id");
      if (id === undefined || result.has(id)) return;
      const out: string[] = [];
      this.renderWidget(node, root, out);
      result.set(id, out.join(""));
    });
    return result;
  }

  private report(code: string, message: string, node?: XmlNode): void {
    const location = node === undefined ? undefined : this.location(node);
    const prefix = location === undefined ? "" : `${location}: `;
    this.reports.push(`${code}: ${prefix}${message}`);
    if (node === undefined) {
      this.host.report(code, message, location);

      return;
    }
    const source = makeLocation(
      node.source.path,
      node.source.text,
      node.span.start,
      node.span.end,
      node.source.starts
    );
    this.host.report(code, message, location, {
      file: source.file,
      line: source.line,
      column: source.column,
    });
  }

  private location(node: XmlNode): string {
    const { line, column } = makeLocation(
      node.source.path,
      node.source.text,
      node.span.start,
      node.span.end,
      node.source.starts
    );
    return `${line}:${column}`;
  }

  private collectDefaultMarkups(): void {
    walk(this.document.children, (node) => {
      if (!isElement(node) || node.name !== "b:defaultmarkups") return;
      for (const markup of node.children) {
        if (!isElement(markup) || markup.name !== "b:defaultmarkup") continue;
        const type = attribute(markup, "type")?.value ?? "Common";
        const target =
          type === "Common" ? this.commonIncludables : new Map<string, XmlElement>();
        for (const child of markup.children) {
          if (!isElement(child) || child.name !== "b:includable") continue;
          const id = attribute(child, "id")?.value;
          if (id) target.set(id, child);
        }
        if (type !== "Common") this.defaultMarkups.set(type, target);
      }
    });
  }

  private renderNodes(
    nodes: readonly XmlNode[],
    scope: Scope,
    env: RenderEnv,
    out: string[],
    rawText = false
  ): void {
    let index = 0;
    while (index < nodes.length) {
      const node = nodes[index] as XmlNode;
      if (isElement(node) && node.name === "b:if") {
        index = this.renderIfChain(nodes, index, scope, env, out);
        continue;
      }
      if (isElement(node) && node.name === "b:switch") {
        index = this.renderSwitch(nodes, index, scope, env, out);
        continue;
      }
      this.renderNode(node, scope, env, out, rawText);
      index++;
    }
  }

  private renderNode(
    node: XmlNode,
    scope: Scope,
    env: RenderEnv,
    out: string[],
    rawText = false
  ): void {
    switch (node.type) {
      case "text":
        out.push(rawText ? decodeEntities(node.value) : node.value);
        return;
      case "comment":
        out.push(`<!--${node.value}-->`);
        return;
      case "cdata":
        out.push(node.value);
        return;
      case "processing-instruction":
        // Drop the XML declaration; the preview is emitted as HTML.
        if (node.target === "xml") return;
        out.push(`<?${node.target} ${node.value}?>`);
        return;
      case "doctype":
        out.push(`<!DOCTYPE ${node.value}>`);
        return;
      case "element":
        this.renderElement(node, scope, env, out);
        return;
      default:
        return;
    }
  }

  private renderElement(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const name = element.name;
    if (name.startsWith("data:")) {
      out.push(this.outputValue(this.evaluateSource(name, scope, element), "text"));
      return;
    }
    if (name.startsWith("b:")) {
      this.renderBloggerElement(element, scope, env, out);
      return;
    }
    this.renderHtmlElement(element, scope, env, out);
  }

  private renderBloggerElement(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    switch (element.name) {
      case "b:section":
        this.renderSection(element, scope, env, out);
        return;
      case "b:widget":
        this.renderWidget(element, scope, out);
        return;
      case "b:loop":
        this.renderLoop(element, scope, env, out);
        return;
      case "b:with":
        this.renderWith(element, scope, env, out);
        return;
      case "b:include":
        this.renderInclude(element, scope, env, out);
        return;
      case "b:includable":
      case "b:defaultmarkups":
      case "b:defaultmarkup":
      case "b:widget-settings":
      case "b:widget-setting":
      case "b:param":
      case "b:attr":
      case "b:class":
      case "b:elseif":
      case "b:else":
      case "b:case":
      case "b:default":
        return;
      case "b:tag":
        this.renderTag(element, scope, env, out);
        return;
      case "b:eval": {
        const expr = this.attrValue(element, "expr");
        if (expr !== undefined) {
          out.push(this.outputValue(this.evaluateSource(expr, scope, element), "text"));
        }
        return;
      }
      case "b:message":
        this.renderMessage(element, scope, out);
        return;
      case "b:comment":
        // Blogger uses b:comment to disable markup; the content never renders.
        return;
      case "b:whitespace":
        this.renderNodes(element.children, scope, env, out);
        return;
      case "b:skin":
      case "b:template-skin":
        out.push(`<style>${this.textContent(element)}</style>`);
        return;
      case "b:template-script":
        out.push(`<script>${this.textContent(element)}</script>`);
        return;
      default:
        this.report(
          "BLOGGER_PREVIEW_UNSUPPORTED_ELEMENT",
          `unsupported Blogger element "${element.name}"`,
          element
        );
        this.renderNodes(element.children, scope, env, out);
        return;
    }
  }

  private renderHtmlElement(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const attrs = this.buildAttributes(element, scope, env);
    out.push(`<${element.name}${attrs}>`);
    if (VOID_ELEMENTS.has(element.name.toLowerCase())) return;
    const name = element.name.toLowerCase();
    this.renderNodes(element.children, scope, env, out, name === "style" || name === "script");
    out.push(`</${element.name}>`);
  }

  private renderTag(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const cond = this.attrValue(element, "cond");
    if (cond !== undefined && !isTruthy(this.evaluateSource(cond, scope, element))) return;
    const tagName = this.attrValue(element, "name") ?? "span";
    const attrs = this.buildAttributes(element, scope, env, ["name", "cond"]);
    out.push(`<${tagName}${attrs}>`);
    if (!VOID_ELEMENTS.has(tagName.toLowerCase())) {
      this.renderNodes(element.children, scope, env, out);
      out.push(`</${tagName}>`);
    }
  }

  private renderSection(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const id = this.attrValue(element, "id") ?? "";
    const sectionClass = this.attrValue(element, "class");
    const name = this.attrValue(element, "name");
    const classes = ["section"];
    if (sectionClass) classes.push(sectionClass);
    out.push(`<div class="${classes.join(" ")}" id="${escapeHtml(id)}"`);
    if (name) out.push(` data-name="${escapeHtml(name)}"`);
    out.push(">");
    for (const child of element.children) {
      if (isElement(child) && child.name === "b:widget") {
        this.renderWidget(child, scope, out);
      } else if (isElement(child) && child.name === "b:section") {
        this.renderSection(child, scope, env, out);
      } else {
        this.renderNode(child, scope, env, out);
      }
    }
    out.push("</div>");
  }

  private renderWidget(element: XmlElement, scope: Scope, out: string[]): void {
    const id = this.attrValue(element, "id") ?? "";
    const type = this.attrValue(element, "type") ?? "HTML";
    const title = this.attrValue(element, "title") ?? "";
    const visible = this.attrValue(element, "visible");
    if (visible === "false") return;

    const settings = this.collectWidgetSettings(element);
    const thisData = this.buildWidgetData(id, type, title, settings);
    thisData["posts"] = this.data["posts"] ?? [];
    thisData["labels"] = this.data["labels"] ?? [];
    const bindings: ValueMap = { ...thisData, this: thisData, title };
    const widgetScope = scope.child(bindings);
    const includables = this.collectIncludables(element);
    const env: RenderEnv = { includables, widgetType: type };

    out.push(
      `<div class="widget ${escapeHtml(type)}" id="${escapeHtml(id)}" data-version="2">`
    );
    const main = this.resolveIncludable("main", env);
    if (main) {
      const varName = attribute(main.node, "var")?.value;
      const mainScope = varName
        ? widgetScope.child({ [varName]: thisData })
        : widgetScope;
      this.renderIncludableBody(main.node, mainScope, env, out, main.layer);
    } else {
      out.push(
        `<div class="widget-content widget-unknown"><p>Unknown widget type ` +
          `&quot;${escapeHtml(type)}&quot;.</p></div>`
      );
      this.report(
        "BLOGGER_PREVIEW_UNKNOWN_WIDGET",
        `widget "${type}" has no "main" includable`,
        element
      );
    }
    out.push("</div>");
  }

  private buildWidgetData(
    id: string,
    type: string,
    title: string,
    settings: ValueMap
  ): ValueMap {
    const typeData = widgetDataFor({ type, id, title });
    const customData = this.widgetRegistry.data.get(type) ?? {};
    const data: ValueMap = {
      ...typeData,
      ...customData,
      ...settings,
      title,
      type,
      id,
      instanceId: id,
    };
    if (type === "LinkList") {
      const links = expandLinks(settings);
      if (links.length > 0) data["links"] = links;
    }
    return data;
  }

  private collectWidgetSettings(element: XmlElement): ValueMap {
    const settings: ValueMap = {};
    for (const child of element.children) {
      if (!isElement(child) || child.name !== "b:widget-settings") continue;
      for (const setting of child.children) {
        if (!isElement(setting) || setting.name !== "b:widget-setting") continue;
        const name = attribute(setting, "name")?.value;
        if (!name) continue;
        settings[name] = this.textContent(setting);
      }
    }
    return settings;
  }

  private collectIncludables(element: XmlElement): Map<string, XmlElement> {
    const includables = new Map<string, XmlElement>();
    for (const child of element.children) {
      if (!isElement(child) || child.name !== "b:includable") continue;
      const id = attribute(child, "id")?.value;
      if (id) includables.set(id, child);
    }
    return includables;
  }

  private resolveIncludable(
    name: string,
    env: RenderEnv
  ): ResolvedIncludable | undefined {
    const own = env.includables.get(name);
    if (own) return { node: own, layer: "widget" };
    const fromType = this.defaultMarkups.get(env.widgetType)?.get(name);
    if (fromType) return { node: fromType, layer: "default" };
    const fromRegistry = this.widgetRegistry.markups
      .get(env.widgetType)
      ?.get(name);
    if (fromRegistry) return { node: fromRegistry, layer: "default" };
    const fromCommon = this.commonIncludables.get(name);
    if (fromCommon) return { node: fromCommon, layer: "common" };
    const fromBuiltin = builtinIncludables().get(name);
    if (fromBuiltin) return { node: fromBuiltin, layer: "builtin" };
    return undefined;
  }

  // Blogger's `super.<name>` reaches the next layer up from the includable that
  // is currently rendering: widget overrides fall back to the widget-type
  // default markup (template first, then the built-in registry), which in turn
  // falls back to the `Common` markup.
  private resolveSuper(name: string, env: RenderEnv): ResolvedIncludable | undefined {
    if (this.currentLayer === "widget") {
      const fromType = this.defaultMarkups.get(env.widgetType)?.get(name);
      if (fromType) return { node: fromType, layer: "default" };
      const fromRegistry = this.widgetRegistry.markups
        .get(env.widgetType)
        ?.get(name);
      if (fromRegistry) return { node: fromRegistry, layer: "default" };
      const fromCommon = this.commonIncludables.get(name);
      if (fromCommon) return { node: fromCommon, layer: "common" };
    } else if (this.currentLayer === "default") {
      const fromCommon = this.commonIncludables.get(name);
      if (fromCommon) return { node: fromCommon, layer: "common" };
    }
    return undefined;
  }

  private renderInclude(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const cond = this.attrValue(element, "cond");
    if (cond !== undefined && !isTruthy(this.evaluateSource(cond, scope, element))) return;

    const name = this.includeName(element, scope);
    if (name === undefined) return;

    const resolved = name.startsWith("super.")
      ? this.resolveSuper(name.slice("super.".length), env)
      : this.resolveIncludable(name, env);
    if (!resolved) {
      this.report(
        "BLOGGER_PREVIEW_UNKNOWN_INCLUDABLE",
        `unknown includable "${name}"`,
        element
      );
      return;
    }
    if (this.includeDepth >= MAX_INCLUDE_DEPTH) {
      this.report("BLOGGER_PREVIEW_LIMIT", `include depth exceeded at "${name}"`, element);
      return;
    }
    const target = resolved.node;

    const dataAttr = this.attrValue(element, "data");
    const varName = attribute(target, "var")?.value;

    const bindings: ValueMap = {};
    if (dataAttr !== undefined) {
      const dataValue = this.evaluateSource(dataAttr, scope, element);
      if (varName) {
        bindings[varName] = dataValue;
      } else if (isMap(dataValue)) {
        for (const [key, value] of Object.entries(dataValue)) bindings[key] = value;
      }
    } else if (varName) {
      const inherited = scope.get(varName);
      bindings[varName] = inherited !== undefined ? inherited : null;
    }

    for (const child of element.children) {
      if (!isElement(child) || child.name !== "b:param") continue;
      const paramName = this.attrValue(child, "name");
      if (!paramName) continue;
      bindings[paramName] = this.paramValue(child, scope);
    }

    const includeScope = Object.keys(bindings).length > 0 ? scope.child(bindings) : scope;
    this.renderIncludableBody(target, includeScope, env, out, resolved.layer);
  }

  private includeName(element: XmlElement, scope: Scope): string | undefined {
    const literal = this.attrValue(element, "name");
    if (literal !== undefined) return literal;
    const dynamic = attribute(element, "expr:name")?.value;
    if (dynamic !== undefined) {
      const value = toText(this.evaluateSource(dynamic, scope, element));
      return value === "" ? undefined : value;
    }
    return undefined;
  }

  private renderIncludableBody(
    includable: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[],
    layer: Layer
  ): void {
    const previous = this.currentLayer;
    this.currentLayer = layer;
    this.includeDepth++;
    try {
      this.renderNodes(includable.children, scope, env, out);
    } finally {
      this.includeDepth--;
      this.currentLayer = previous;
    }
  }

  private renderLoop(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const valuesSource = this.attrValue(element, "values");
    if (valuesSource === undefined) return;
    const values = this.evaluateSource(valuesSource, scope, element);
    const varName = this.attrValue(element, "var");
    const indexName = this.attrValue(element, "index");

    const iterate = (items: Value[]): void => {
      items.forEach((item, position) => {
        const bindings: ValueMap = {};
        if (varName) bindings[varName] = item;
        if (indexName) bindings[indexName] = position;
        const loopScope =
          Object.keys(bindings).length > 0 ? scope.child(bindings) : scope;
        this.renderNodes(element.children, loopScope, env, out);
      });
    };

    if (Array.isArray(values)) {
      iterate(values as Value[]);
      return;
    }
    if (values !== null && typeof values === "object" && !(values instanceof HtmlString)) {
      iterate(Object.values(values as ValueMap) as Value[]);
    }
  }

  private renderWith(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): void {
    const valueSource = this.attrValue(element, "value");
    const varName = this.attrValue(element, "var");
    const value = valueSource !== undefined ? this.evaluateSource(valueSource, scope, element) : null;
    const withScope = varName ? scope.child({ [varName]: value }) : scope;
    this.renderNodes(element.children, withScope, env, out);
  }

  private renderMessage(element: XmlElement, scope: Scope, out: string[]): void {
    const nameSource = this.attrValue(element, "name");
    const value =
      nameSource !== undefined ? this.evaluateSource(nameSource, scope, element) : null;
    const trusted = value instanceof HtmlString;
    const message = toText(value);
    const params: Record<string, string> = {};
    for (const child of element.children) {
      if (!isElement(child) || child.name !== "b:param") continue;
      const paramName = this.attrValue(child, "name");
      if (!paramName) continue;
      params[paramName] = toText(this.paramValue(child, scope));
    }
    const substituted = message.replace(/\{(\w+)\}/g, (whole, key: string) =>
      key in params
        ? trusted
          ? escapeHtml(params[key] as string)
          : (params[key] as string)
        : whole
    );
    out.push(trusted ? substituted : escapeHtml(substituted));
  }

  private renderIfChain(
    nodes: readonly XmlNode[],
    index: number,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): number {
    const ifNode = nodes[index] as XmlElement;
    const branches = this.splitIfBranches(ifNode);
    const chosen = branches.findIndex(
      (branch) =>
        branch.cond === undefined ||
        isTruthy(this.evaluateSource(branch.cond, scope, branch.node))
    );
    const branch = branches[chosen];
    if (branch === undefined) return index + 1;

    const fallback =
      chosen === 0
        ? staticImageSrc(branches.find((candidate) => candidate.isElse)?.body ?? [])
        : undefined;
    if (fallback === undefined) {
      this.renderNodes(branch.body, scope, env, out);
      return index + 1;
    }

    const rendered: string[] = [];
    this.renderNodes(branch.body, scope, env, rendered);
    out.push(withImageFallback(rendered.join(""), fallback));
    return index + 1;
  }

  private splitIfBranches(ifNode: XmlElement): Branch[] {
    const branches: Branch[] = [];
    let current: Branch = { cond: attribute(ifNode, "cond")?.value, node: ifNode, body: [] };
    for (const child of ifNode.children) {
      if (isElement(child) && child.name === "b:elseif") {
        branches.push(current);
        current = { cond: attribute(child, "cond")?.value, node: child, body: [] };
      } else if (isElement(child) && child.name === "b:else") {
        branches.push(current);
        current = { isElse: true, node: child, body: [] };
      } else {
        current.body.push(child);
      }
    }
    branches.push(current);
    return branches;
  }

  private renderSwitch(
    nodes: readonly XmlNode[],
    index: number,
    scope: Scope,
    env: RenderEnv,
    out: string[]
  ): number {
    const switchNode = nodes[index] as XmlElement;
    const varSource = this.attrValue(switchNode, "var");
    const subject =
      varSource !== undefined ? toText(this.evaluateSource(varSource, scope, switchNode)) : "";
    const branches = this.splitSwitchBranches(switchNode);

    let chosen: CaseBranch | undefined;
    for (const branch of branches) {
      if (branch.value === undefined) continue;
      const candidate = toText(this.evaluateSource(branch.value, scope, branch.node));
      if (candidate === subject) {
        chosen = branch;
        break;
      }
    }
    if (!chosen) chosen = branches.find((branch) => branch.value === undefined);
    if (chosen) this.renderNodes(chosen.body, scope, env, out);
    return index + 1;
  }

  private splitSwitchBranches(switchNode: XmlElement): CaseBranch[] {
    const branches: CaseBranch[] = [];
    let current: CaseBranch | undefined;
    for (const child of switchNode.children) {
      if (isElement(child) && child.name === "b:case") {
        if (current) branches.push(current);
        current = { value: attribute(child, "value")?.value, node: child, body: [] };
      } else if (isElement(child) && child.name === "b:default") {
        if (current) branches.push(current);
        current = { node: child, body: [] };
      } else if (current) {
        current.body.push(child);
      }
    }
    if (current) branches.push(current);
    return branches;
  }

  private buildAttributes(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv,
    skip: readonly string[] = []
  ): string {
    const ordered: string[] = [];
    const values = new Map<string, string>();

    const setValue = (name: string, value: string): void => {
      if (name === "class" && values.has("class")) {
        const existing = values.get("class") as string;
        values.set("class", existing ? `${existing} ${value}` : value);
      } else {
        values.set(name, value);
      }
      if (!ordered.includes(name)) ordered.push(name);
    };

    for (const attr of element.attributes) {
      if (skip.includes(attr.name)) continue;
      if (attr.name.startsWith("b:") || attr.name.startsWith("xmlns")) continue;
      if (attr.name.startsWith("expr:")) {
        const attrName = attr.name.slice("expr:".length);
        setValue(
          attrName,
          this.outputValue(this.evaluateSource(attr.value, scope, element), "attribute")
        );
      } else {
        setValue(attr.name, attr.value);
      }
    }

    for (const [name, value] of this.collectDynamicAttributes(element, scope, env)) {
      setValue(name, value);
    }

    let output = "";
    for (const name of ordered) {
      const value = values.get(name) ?? "";
      output += ` ${name}="${value}"`;
    }
    return output;
  }

  private collectDynamicAttributes(
    element: XmlElement,
    scope: Scope,
    env: RenderEnv
  ): Array<[string, string]> {
    const attrs: Array<[string, string]> = [];
    const classes: string[] = [];
    for (const child of element.children) {
      if (!isElement(child)) continue;
      if (child.name === "b:class") {
        const cond = this.attrValue(child, "cond");
        if (cond !== undefined && !isTruthy(this.evaluateSource(cond, scope, child))) continue;
        const literal = this.attrValue(child, "name");
        if (literal) classes.push(literal);
        const exprName = attribute(child, "expr:name")?.value;
        if (exprName !== undefined) {
          const value = toText(this.evaluateSource(exprName, scope, child));
          if (value) classes.push(value);
        }
      } else if (child.name === "b:attr") {
        const cond = this.attrValue(child, "cond");
        if (cond !== undefined && !isTruthy(this.evaluateSource(cond, scope, child))) continue;
        const name = this.attrValue(child, "name");
        if (!name) continue;
        const exprValue = attribute(child, "expr:value")?.value;
        const literal = this.attrValue(child, "value");
        const value =
          exprValue !== undefined
            ? this.outputValue(this.evaluateSource(exprValue, scope, child), "attribute")
            : (literal ?? "");
        attrs.push([name, value]);
      }
    }
    if (classes.length > 0) attrs.push(["class", classes.join(" ")]);
    void env;
    return attrs;
  }

  private evaluateSource(source: string, scope: Scope, node?: XmlNode): Value {
    const parsed = this.parseCached(source, node);
    if (!parsed) return null;
    try {
      return this.evaluator.evaluate(parsed, scope);
    } catch (error) {
      if (error instanceof ExpressionError) {
        this.report(error.code, error.message, node);
        return null;
      }
      throw error;
    }
  }

  private parseCached(source: string, node?: XmlNode): ExprNode | null {
    const key = source.trim();
    if (key === "") return null;
    if (this.parseCache.has(key)) return this.parseCache.get(key) ?? null;
    try {
      const parsed = parseExpression(source);
      this.parseCache.set(key, parsed);
      return parsed;
    } catch (error) {
      if (error instanceof ExpressionError) {
        this.report(error.code, error.message, node);
        this.parseCache.set(key, null);
        return null;
      }
      throw error;
    }
  }

  private outputValue(value: Value, context: "text" | "attribute"): string {
    if (value instanceof HtmlString) return value.value;
    const text = toText(value);
    void context;
    return escapeHtml(text);
  }

  private attrValue(element: XmlElement, name: string): string | undefined {
    return attribute(element, name)?.value;
  }

  private paramValue(element: XmlElement, scope: Scope): Value {
    const exprValue = attribute(element, "expr:value")?.value;
    if (exprValue !== undefined) return this.evaluateSource(exprValue, scope, element);
    const literal = this.attrValue(element, "value");
    return literal === undefined ? null : decodeEntities(literal);
  }

  private textContent(element: XmlElement): string {
    let text = "";
    for (const child of element.children) {
      if (child.type === "text") text += decodeEntities(child.value);
      else if (child.type === "cdata") text += child.value;
      else if (isElement(child)) text += this.textContent(child);
    }
    return text;
  }
}

export function renderTemplate(
  document: XmlDocument,
  data: ValueMap,
  host: RenderHost,
  widgetRegistry?: WidgetRegistry
): RenderResult {
  return new TemplateRenderer(document, data, host, widgetRegistry).render();
}

export function renderWidgetMarkups(
  document: XmlDocument,
  data: ValueMap,
  host: RenderHost,
  widgetRegistry?: WidgetRegistry
): Map<string, string> {
  return new TemplateRenderer(
    document,
    data,
    host,
    widgetRegistry
  ).renderWidgetMarkups();
}
