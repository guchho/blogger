import { makeLocation } from "../diagnostics.js";
import type { DiagnosticCollector } from "../diagnostics.js";
import type { XmlDocument, XmlElement, XmlNode } from "../xml/ast.js";
import { attribute } from "../xml/ast.js";

export interface BloggerValidationOptions {
  enabled: boolean;
}

export class BloggerValidator {
  private readonly diagnostics: DiagnosticCollector;
  private readonly options: BloggerValidationOptions;
  private readonly sectionIds = new Set<string>();
  private readonly widgetIds = new Set<string>();
  private rootChecked = false;

  constructor(
    diagnostics: DiagnosticCollector,
    options: BloggerValidationOptions
  ) {
    this.diagnostics = diagnostics;
    this.options = options;
  }

  validateDocument(
    document: XmlDocument,
    includeParent?: XmlElement,
    isEntry = false
  ): void {
    if (!this.options.enabled) return;
    const root = document.roots[0];
    if (root === undefined) return;

    if (isEntry && !this.rootChecked && document.roots.length === 1) {
      this.rootChecked = true;
      if (root.name !== "html") {
        this.diagnostics.warning(
          "BLOGGER_VALIDATION_ROOT",
          `expected the Blogger template root to be <html>, found <${root.name}>`,
          this.location(root)
        );
      }
    }

    const roots: XmlNode[] = [...document.children];
    for (const node of roots) {
      if (node.type === "element") {
        this.validateElement(node, includeParent);
      }
    }
  }

  private validateElement(
    element: XmlElement,
    parentOverride?: XmlElement
  ): void {
    const parent = parentOverride ?? element.parent;

    if (element.name === "b:section") {
      const id = attribute(element, "id");
      if (id === undefined || id.value.trim() === "") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_SECTION_ID",
          "a <b:section> must have a non-empty id attribute",
          this.location(element)
        );
      } else if (this.sectionIds.has(id.value)) {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_DUPLICATE_ID",
          `duplicate <b:section> id "${id.value}"`,
          this.location(element, id.valueSpan)
        );
      } else {
        this.sectionIds.add(id.value);
      }
    }

    if (element.name === "b:widget") {
      const id = attribute(element, "id");
      const type = attribute(element, "type");
      if (id === undefined || id.value.trim() === "") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_WIDGET_ID",
          "a <b:widget> must have a non-empty id attribute",
          this.location(element)
        );
      } else if (this.widgetIds.has(id.value)) {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_DUPLICATE_ID",
          `duplicate <b:widget> id "${id.value}"`,
          this.location(element, id.valueSpan)
        );
      } else {
        this.widgetIds.add(id.value);
      }
      if (type === undefined || type.value.trim() === "") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_WIDGET_TYPE",
          "a <b:widget> must have a non-empty type attribute",
          this.location(element)
        );
      }
      if (parent === undefined || parent.name !== "b:section") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_WIDGET_PARENT",
          "a <b:widget> must be a direct child of a <b:section>",
          this.location(element)
        );
      }
    }

    if (element.name === "b:includable") {
      const id = attribute(element, "id");
      if (id === undefined || id.value.trim() === "") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_INCLUDABLE_ID",
          "a <b:includable> must have a non-empty id attribute",
          this.location(element)
        );
      }
    }

    if (element.name === "b:include") {
      const name = attribute(element, "name");
      const exprName = attribute(element, "expr:name");
      const hasName = name !== undefined && name.value.trim() !== "";
      const hasExprName =
        exprName !== undefined && exprName.value.trim() !== "";
      if (!hasName && !hasExprName) {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_INCLUDE_NAME",
          "a <b:include> must have a non-empty name or expr:name attribute",
          this.location(element)
        );
      }
    }

    if (element.name === "b:if") {
      const cond = attribute(element, "cond");
      if (cond === undefined || cond.value.trim() === "") {
        this.diagnostics.error(
          "BLOGGER_VALIDATION_IF_COND",
          "a <b:if> must have a non-empty cond attribute",
          this.location(element)
        );
      }
    }

    for (const child of element.children) {
      if (child.type === "element") this.validateElement(child);
    }
  }

  private location(
    node: { source: import("../xml/source.js").SourceFile; span: { start: number; end: number } },
    span = node.span
  ): import("../types.js").SourceLocation {
    return makeLocation(
      node.source.path,
      node.source.text,
      span.start,
      span.end,
      node.source.starts
    );
  }
}
