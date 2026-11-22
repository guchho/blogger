import { BloggerError, makeLocation } from "../diagnostics.js";
import type {
  XmlAttribute,
  XmlDocument,
  XmlElement,
  XmlNode,
  XmlProcessingInstruction,
  XmlText,
} from "./ast.js";
import { SourceFile } from "./source.js";

const NAME_START = /^[\p{L}_:]/u;
const NAME_CHAR = /^[\p{L}\p{N}_.:-]/u;

function isWhitespace(char: string | undefined): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isNameStart(char: string | undefined): boolean {
  return char !== undefined && NAME_START.test(char);
}

function isNameChar(char: string | undefined): boolean {
  return char !== undefined && NAME_CHAR.test(char);
}

export interface ParseOptions {
  /** A component may contain several top-level nodes. */
  fragment?: boolean;
}

export class XmlParser {
  private readonly source: SourceFile;
  private readonly text: string;
  private index = 0;
  private readonly options: ParseOptions;

  constructor(source: SourceFile, options: ParseOptions = {}) {
    this.source = source;
    this.text = source.text;
    this.options = options;
  }

  parse(): XmlDocument {
    const children: XmlNode[] = [];
    const roots: XmlElement[] = [];
    let declaration: XmlProcessingInstruction | undefined;

    while (this.index < this.text.length) {
      if (this.text.startsWith("<!--", this.index)) {
        children.push(this.parseComment());
      } else if (this.text.startsWith("<![CDATA[", this.index)) {
        children.push(this.parseCData());
      } else if (this.text.startsWith("<?", this.index)) {
        const pi = this.parseProcessingInstruction();
        if (pi.target === "xml") {
          if (declaration !== undefined || roots.length > 0 || children.some((node) => node.type !== "text" || node.value.trim() !== "")) {
            this.fail(
              "BLOGGER_XML_MALFORMED",
              "the XML declaration must appear once, at the very start of the file",
              pi.span.start,
              pi.span.end
            );
          }
          declaration = pi;
        } else {
          children.push(pi);
        }
      } else if (this.text.startsWith("<!DOCTYPE", this.index)) {
        if (this.options.fragment !== true && roots.length > 0) {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            "a document type declaration must appear before the root element",
            this.index,
            this.index + 9
          );
        }
        children.push(this.parseDoctype());
      } else if (this.text.startsWith("</", this.index)) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          "unexpected closing tag",
          this.index,
          Math.min(this.text.length, this.index + 2)
        );
      } else if (this.text[this.index] === "<") {
        const element = this.parseElement();
        children.push(element);
        roots.push(element);
      } else {
        const text = this.parseText();
        children.push(text);
        if (
          this.options.fragment !== true &&
          text.value.trim() !== "" &&
          roots.length === 0
        ) {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            "text is not allowed before the root element",
            text.span.start,
            text.span.end
          );
        }
        if (
          this.options.fragment !== true &&
          text.value.trim() !== "" &&
          roots.length > 0
        ) {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            "text is not allowed after the root element",
            text.span.start,
            text.span.end
          );
        }
      }
    }

    if (this.options.fragment !== true) {
      if (roots.length === 0) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          "the file has no root element",
          0,
          Math.max(1, this.text.length)
        );
      }
      if (roots.length > 1) {
        const second = roots[1] as XmlElement;
        this.fail(
          "BLOGGER_XML_MALFORMED",
          "an XML document can have only one root element",
          second.span.start,
          second.span.end
        );
      }
    }

    return {
      source: this.source,
      children,
      roots,
      declaration,
    };
  }

  private parseElement(): XmlElement {
    const start = this.index;
    this.index++;
    const nameStart = this.index;
    const name = this.readName();
    if (name === "") {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        "an element name is required after \"<\"",
        start,
        Math.min(this.text.length, start + 1)
      );
    }
    const nameSpan = { start: nameStart, end: this.index };
    const attributes: XmlAttribute[] = [];
    let selfClosing = false;
    let startTagEnd = this.index;

    while (true) {
      this.skipWhitespace();
      if (this.index >= this.text.length) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          `unclosed start tag for <${name}>`,
          start,
          Math.max(start + 1, this.index)
        );
      }
      if (this.text.startsWith("/>", this.index)) {
        this.index += 2;
        selfClosing = true;
        startTagEnd = this.index;
        break;
      }
      if (this.text[this.index] === ">") {
        this.index++;
        startTagEnd = this.index;
        break;
      }

      const attribute = this.parseAttribute();
      if (attributes.some((candidate) => candidate.name === attribute.name)) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          `duplicate attribute "${attribute.name}" on <${name}>`,
          attribute.nameSpan.start,
          attribute.nameSpan.end
        );
      }
      attributes.push(attribute);
    }

    const element: XmlElement = {
      type: "element",
      source: this.source,
      name,
      nameSpan,
      attributes,
      children: [],
      selfClosing,
      startTagSpan: { start, end: startTagEnd },
      span: { start, end: startTagEnd },
    };

    if (selfClosing) {
      return element;
    }

    while (true) {
      if (this.index >= this.text.length) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          `unclosed element <${name}>`,
          start,
          Math.max(start + 1, this.index)
        );
      }
      if (this.text.startsWith("</", this.index)) {
        const endTagStart = this.index;
        this.index += 2;
        const endNameStart = this.index;
        const endName = this.readName();
        if (endName === "") {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            `missing name in closing tag for <${name}>`,
            endTagStart,
            Math.min(this.text.length, endTagStart + 2)
          );
        }
        if (endName !== name) {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            `closing tag </${endName}> does not match <${name}>`,
            endTagStart,
            Math.max(endTagStart + 2, this.index)
          );
        }
        this.skipWhitespace();
        if (this.text[this.index] !== ">") {
          this.fail(
            "BLOGGER_XML_MALFORMED",
            `expected ">" after closing tag </${name}>`,
            endNameStart,
            Math.max(endNameStart + 1, this.index)
          );
        }
        this.index++;
        element.endTagSpan = { start: endTagStart, end: this.index };
        element.span.end = this.index;
        return element;
      }

      if (this.text.startsWith("<!--", this.index)) {
        element.children.push(this.parseComment());
      } else if (this.text.startsWith("<![CDATA[", this.index)) {
        element.children.push(this.parseCData());
      } else if (this.text.startsWith("<?", this.index)) {
        element.children.push(this.parseProcessingInstruction());
      } else if (this.text.startsWith("<!DOCTYPE", this.index)) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          "a document type declaration is not allowed inside an element",
          this.index,
          this.index + 9
        );
      } else if (this.text.startsWith("<!", this.index)) {
        this.fail(
          "BLOGGER_XML_MALFORMED",
          "unsupported markup declaration",
          this.index,
          Math.min(this.text.length, this.index + 2)
        );
      } else if (this.text[this.index] === "<") {
        const child = this.parseElement();
        child.parent = element;
        element.children.push(child);
      } else {
        element.children.push(this.parseText());
      }
    }
  }

  private parseAttribute(): XmlAttribute {
    const start = this.index;
    const nameStart = this.index;
    const name = this.readName();
    if (name === "") {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        "an attribute name is required",
        start,
        Math.min(this.text.length, start + 1)
      );
    }
    const nameSpan = { start: nameStart, end: this.index };
    this.skipWhitespace();
    if (this.text[this.index] !== "=") {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        `expected "=" after attribute "${name}"`,
        this.index,
        Math.min(this.text.length, this.index + 1)
      );
    }
    this.index++;
    this.skipWhitespace();
    const quote = this.text[this.index];
    if (quote !== '"' && quote !== "'") {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        `the value of attribute "${name}" must be quoted`,
        this.index,
        Math.min(this.text.length, this.index + 1)
      );
    }
    this.index++;
    const valueStart = this.index;
    const valueEnd = this.text.indexOf(quote, this.index);
    if (valueEnd === -1) {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        `unclosed value for attribute "${name}"`,
        valueStart,
        Math.max(valueStart + 1, this.text.length)
      );
    }
    const value = this.text.slice(valueStart, valueEnd);
    this.index = valueEnd + 1;
    const valueSpan = { start: valueStart, end: valueEnd };
    return {
      name,
      nameSpan,
      quote,
      value,
      valueSpan,
      span: { start, end: this.index },
    };
  }

  private parseText(): XmlText {
    const start = this.index;
    const next = this.text.indexOf("<", this.index);
    this.index = next === -1 ? this.text.length : next;
    return {
      type: "text",
      source: this.source,
      value: this.text.slice(start, this.index),
      span: { start, end: this.index },
    };
  }

  private parseComment(): XmlNode {
    const start = this.index;
    const end = this.text.indexOf("-->", start + 4);
    if (end === -1) {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        "unclosed XML comment",
        start,
        Math.max(start + 4, this.text.length)
      );
    }
    this.index = end + 3;
    return {
      type: "comment",
      source: this.source,
      value: this.text.slice(start + 4, end),
      span: { start, end: this.index },
    };
  }

  private parseCData(): XmlNode {
    const start = this.index;
    const end = this.text.indexOf("]]>", start + 9);
    if (end === -1) {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        "unclosed CDATA section",
        start,
        Math.max(start + 9, this.text.length)
      );
    }
    this.index = end + 3;
    return {
      type: "cdata",
      source: this.source,
      value: this.text.slice(start + 9, end),
      span: { start, end: this.index },
    };
  }

  private parseProcessingInstruction(): XmlProcessingInstruction {
    const start = this.index;
    this.index += 2;
    const target = this.readName();
    if (target === "") {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        "a processing instruction target is required",
        start,
        Math.min(this.text.length, start + 2)
      );
    }
    const end = this.text.indexOf("?>", this.index);
    if (end === -1) {
      this.fail(
        "BLOGGER_XML_MALFORMED",
        `unclosed processing instruction <?${target}`,
        start,
        Math.max(start + 2, this.text.length)
      );
    }
    const valueStart = this.index;
    const value = this.text.slice(valueStart, end).trimStart();
    this.index = end + 2;
    return {
      type: "processing-instruction",
      source: this.source,
      target,
      value,
      span: { start, end: this.index },
    };
  }

  private parseDoctype(): XmlNode {
    const start = this.index;
    this.index += 9;
    let quote: string | undefined;
    let bracketDepth = 0;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (quote !== undefined) {
        if (char === quote) quote = undefined;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === "[") {
        bracketDepth++;
      } else if (char === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (char === ">" && bracketDepth === 0) {
        const value = this.text.slice(start + 9, this.index).trim();
        this.index++;
        return {
          type: "doctype",
          source: this.source,
          value,
          span: { start, end: this.index },
        };
      }
      this.index++;
    }
    this.fail(
      "BLOGGER_XML_MALFORMED",
      "unclosed document type declaration",
      start,
      Math.max(start + 9, this.text.length)
    );
  }

  private readName(): string {
    const start = this.index;
    let char = this.text[this.index];
    if (!isNameStart(char)) return "";
    while (this.index < this.text.length) {
      const codePoint = this.text.codePointAt(this.index);
      if (codePoint === undefined) break;
      char = String.fromCodePoint(codePoint);
      if (!isNameChar(char)) break;
      this.index += char.length;
    }
    return this.text.slice(start, this.index);
  }

  private skipWhitespace(): void {
    while (isWhitespace(this.text[this.index])) this.index++;
  }

  private fail(code: string, message: string, start: number, end: number): never {
    const location = makeLocation(
      this.source.path,
      this.source.text,
      start,
      end,
      this.source.starts
    );
    throw new BloggerError({ code, severity: "error", message, location });
  }
}

export function parseXml(source: SourceFile, options?: ParseOptions): XmlDocument {
  return new XmlParser(source, options).parse();
}
