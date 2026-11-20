import { createHash } from "node:crypto";

import { decodeEntities } from "../preview/expr/tokenizer.js";
import {
  attribute,
  isElement,
  walk,
  type XmlDocument,
  type XmlElement,
  type XmlNode,
} from "../xml/ast.js";
import { parseXml } from "../xml/parser.js";
import { SourceFile } from "../xml/source.js";
import {
  LayoutError,
  type LayoutAttributeModel,
  type LayoutCssModel,
  type LayoutModel,
  type LayoutSectionModel,
  type LayoutWidgetModel,
} from "./model.js";

export function hashSource(xml: string): string {
  return createHash("sha256").update(xml).digest("hex");
}

export function parseTemplate(xml: string, entryPath: string): XmlDocument {
  return parseXml(new SourceFile(entryPath, xml));
}

export function extractLayout(xml: string, entryPath = "src/template.xml"): LayoutModel {
  const document = parseTemplate(xml, entryPath);
  const sections: LayoutSectionModel[] = [];
  const css: LayoutCssModel = {
    skin: "",
    templateSkin: "",
    style: "",
    combined: "",
  };

  walk(document.children, (node) => {
    if (!isElement(node)) return;
    if (node.name === "b:skin") css.skin = elementText(node);
    if (node.name === "b:template-skin") css.templateSkin = elementText(node);
    if (node.name === "style") css.style += `${elementText(node)}\n`;
    if (node.name === "b:section") sections.push(sectionModel(node));
  });

  css.style = css.style.trim();
  css.combined = [css.skin, css.templateSkin, css.style]
    .filter((chunk) => chunk !== "")
    .join("\n")
    .trim();

  return { entryPath, sections, css, hash: hashSource(xml) };
}

export function sectionModel(element: XmlElement): LayoutSectionModel {
  const id = valueOf(element, "id") ?? "";
  if (id === "") {
    throw new LayoutError(
      "BLOGGER_LAYOUT_SECTION_INVALID",
      "a b:section element is missing its id attribute"
    );
  }
  const maxwidgets = parseCount(valueOf(element, "maxwidgets"));
  const widgets: LayoutWidgetModel[] = [];
  for (const child of element.children) {
    if (isElement(child) && child.name === "b:widget") widgets.push(widgetModel(child, id));
  }
  return {
    id,
    name: decodeOptional(valueOf(element, "name")),
    className: decodeOptional(valueOf(element, "class")),
    maxwidgets,
    showaddelement: valueOf(element, "showaddelement") !== "false",
    growth: decodeOptional(valueOf(element, "growth")),
    span: element.span,
    startTagSpan: element.startTagSpan,
    endTagSpan: element.endTagSpan,
    attributes: attributeModels(element),
    widgets,
  };
}

export function widgetModel(element: XmlElement, sectionId: string): LayoutWidgetModel {
  const includables: string[] = [];
  for (const child of element.children) {
    if (!isElement(child) || child.name !== "b:includable") continue;
    const id = valueOf(child, "id");
    if (id !== undefined) includables.push(id);
  }
  return {
    id: valueOf(element, "id") ?? "",
    type: valueOf(element, "type") ?? "",
    title: decodeOptional(valueOf(element, "title")) ?? "",
    locked: valueOf(element, "locked") === "true",
    visible: valueOf(element, "visible") !== "false",
    version: valueOf(element, "version"),
    sectionId,
    span: element.span,
    attributes: attributeModels(element),
    includables,
  };
}

export function valueOf(element: XmlElement, name: string): string | undefined {
  return attribute(element, name)?.value;
}

export function attributeModels(element: XmlElement): LayoutAttributeModel[] {
  return element.attributes.map((item) => ({
    name: item.name,
    value: item.value,
    quote: item.quote,
    valueSpan: item.valueSpan,
    span: item.span,
  }));
}

export function findSectionElement(
  document: XmlDocument,
  id: string
): XmlElement | undefined {
  let found: XmlElement | undefined;
  walk(document.children, (node) => {
    if (found !== undefined || !isElement(node) || node.name !== "b:section") return;
    if (valueOf(node, "id") === id) found = node;
  });
  return found;
}

export function findWidgetElement(
  document: XmlDocument,
  id: string
): { widget: XmlElement; section: XmlElement } | undefined {
  let found: { widget: XmlElement; section: XmlElement } | undefined;
  walk(document.children, (node) => {
    if (found !== undefined || !isElement(node) || node.name !== "b:section") return;
    for (const child of node.children) {
      if (isElement(child) && child.name === "b:widget" && valueOf(child, "id") === id) {
        found = { widget: child, section: node };
        break;
      }
    }
  });
  return found;
}

export function allWidgetElements(document: XmlDocument): XmlElement[] {
  const widgets: XmlElement[] = [];
  walk(document.children, (node) => {
    if (isElement(node) && node.name === "b:widget") widgets.push(node);
  });
  return widgets;
}

function elementText(element: XmlElement): string {
  const chunks: string[] = [];
  const collect = (node: XmlNode): void => {
    if (node.type === "text" || node.type === "cdata") {
      chunks.push(decodeEntities(node.value));
      return;
    }
    if (isElement(node)) node.children.forEach(collect);
  };
  element.children.forEach(collect);
  return chunks.join("");
}

function decodeOptional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : decodeEntities(value);
}

function parseCount(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? Math.trunc(count) : undefined;
}
