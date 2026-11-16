import type { CompiledTemplate } from "../types.js";
import { CSS_SKIN_TOKEN, CSS_TOKEN, JS_TOKEN } from "./compiler.js";

export interface AssembleInput {
  css: string;
  js: string;
  /** Asset token to replacement value, usually a data URL. */
  assets: ReadonlyMap<string, string>;
}

export function assembleTemplate(
  template: CompiledTemplate,
  input: AssembleInput
): string {
  let xml = template.xml;

  if (xml.includes(CSS_SKIN_TOKEN)) {
    xml = replaceAll(xml, CSS_SKIN_TOKEN, cdata(input.css));
  }
  if (xml.includes(CSS_TOKEN)) {
    xml = replaceAll(xml, CSS_TOKEN, `<style>${cdata(input.css)}</style>`);
  }
  if (xml.includes(JS_TOKEN)) {
    xml = replaceAll(
      xml,
      JS_TOKEN,
      `<script>${cdata(`\n${input.js}\n`)}</script>`
    );
  }

  for (const [token, value] of input.assets) {
    if (xml.includes(token)) xml = replaceAll(xml, token, value);
  }

  return xml;
}

export function findUnresolvedTokens(xml: string): string[] {
  const found = new Set<string>();
  const pattern = /@@GUCHHO_BLOGGER_[A-Z0-9_]+@@/g;
  for (const match of xml.matchAll(pattern)) {
    const token = match[0];
    if (token !== undefined) found.add(token);
  }
  return [...found];
}

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

function cdata(text: string): string {
  return `<![CDATA[${text.split("]]>").join("]]]]><![CDATA[>")}]]>`;
}
