import type { Span } from "../diagnostics.js";
import type { SourceFile } from "./source.js";

export interface XmlAttribute {
  name: string;
  nameSpan: Span;
  quote: '"' | "'";
  /** Attribute value without quotes, exactly as authored. */
  value: string;
  /** Span of the value, excluding quotes. */
  valueSpan: Span;
  /** Span of `name="value"`. */
  span: Span;
}

export interface XmlNodeBase {
  span: Span;
  source: SourceFile;
}

export interface XmlText extends XmlNodeBase {
  type: "text";
  value: string;
}

export interface XmlComment extends XmlNodeBase {
  type: "comment";
  value: string;
}

export interface XmlCData extends XmlNodeBase {
  type: "cdata";
  value: string;
}

export interface XmlProcessingInstruction extends XmlNodeBase {
  type: "processing-instruction";
  target: string;
  value: string;
}

export interface XmlDoctype extends XmlNodeBase {
  type: "doctype";
  value: string;
}

export interface XmlElement extends XmlNodeBase {
  type: "element";
  name: string;
  nameSpan: Span;
  attributes: XmlAttribute[];
  children: XmlNode[];
  selfClosing: boolean;
  startTagSpan: Span;
  endTagSpan?: Span;
  parent?: XmlElement;
}

export type XmlNode =
  | XmlElement
  | XmlText
  | XmlComment
  | XmlCData
  | XmlProcessingInstruction
  | XmlDoctype;

export interface XmlDocument {
  source: SourceFile;
  children: XmlNode[];
  roots: XmlElement[];
  declaration?: XmlProcessingInstruction;
}

export function isElement(node: XmlNode): node is XmlElement {
  return node.type === "element";
}

export function walk(
  nodes: readonly XmlNode[],
  visit: (node: XmlNode) => void
): void {
  for (const node of nodes) {
    visit(node);
    if (node.type === "element") walk(node.children, visit);
  }
}

export function attribute(
  element: XmlElement,
  name: string
): XmlAttribute | undefined {
  return element.attributes.find((candidate) => candidate.name === name);
}
