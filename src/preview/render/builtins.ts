// Built-in default includables Blogger provides for sharing icons. Themes
// reference them through dynamic include names such as
// `expr:name='data:platform.key + "Icon"'`, so the preview needs a small
// registry of placeholders to resolve those names.

import { isElement, type XmlElement } from "../../xml/ast.js";
import { parseXml } from "../../xml/parser.js";
import { SourceFile } from "../../xml/source.js";

const PLATFORMS = ["blogThis", "facebook", "twitter", "email", "pinterest", "print"];

function iconIncludable(id: string, extraClass: string): string {
  return `  <b:includable id='${id}'><span class='sharing-icon ${extraClass}' expr:class='data:iconClass' role='img'></span></b:includable>`;
}

const BUILTIN_XML = [
  "<b:builtin-includables>",
  ...PLATFORMS.map((platform) => iconIncludable(`${platform}Icon`, `${platform}-icon`)),
  iconIncludable("shareIcon", "share-icon"),
  iconIncludable("otherSharingIcon", "other-sharing-icon"),
  // Blogger injects feed/meta links here. The preview renders nothing rather
  // than reporting a missing includable.
  "<b:includable id='all-head-content'></b:includable>",
  "</b:builtin-includables>",
].join("\n");

let cache: Map<string, XmlElement> | undefined;

export function builtinIncludables(): Map<string, XmlElement> {
  if (cache !== undefined) return cache;
  const document = parseXml(new SourceFile("<builtins>", BUILTIN_XML));
  const map = new Map<string, XmlElement>();
  for (const root of document.roots) {
    for (const child of root.children) {
      if (!isElement(child) || child.name !== "b:includable") continue;
      const id = child.attributes.find((attr) => attr.name === "id")?.value;
      if (id) map.set(id, child);
    }
  }
  cache = map;
  return map;
}
