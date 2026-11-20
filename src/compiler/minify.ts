import type { XmlNode } from "../xml/ast.js";
import { isElement } from "../xml/ast.js";
import { parseXml } from "../xml/parser.js";
import { SourceFile } from "../xml/source.js";
import { applyEdits, type TextEdit } from "./edits.js";

const PRESERVE_WHITESPACE = new Set([
  "pre",
  "textarea",
  "script",
  "style",
  "b:skin",
  "b:template-skin",
]);

export function minifyXml(xml: string, fileName = "template.xml"): string {
  const document = parseXml(new SourceFile(fileName, xml));
  const edits: TextEdit[] = [];
  visit(document.children, false, edits);
  return applyEdits(xml, edits);
}

function visit(
  nodes: readonly XmlNode[],
  preserve: boolean,
  edits: TextEdit[]
): void {
  for (const node of nodes) {
    if (node.type === "text" && !preserve) {
      const collapsed = node.value.replace(/[ \t\r\n]+/g, " ");
      if (collapsed !== node.value) {
        edits.push({
          start: node.span.start,
          end: node.span.end,
          replacement: collapsed,
        });
      }
      continue;
    }
    if (!isElement(node)) continue;
    const inherited = preserve || PRESERVE_WHITESPACE.has(node.name);
    visit(node.children, inherited, edits);
  }
}
