import { lineStarts } from "../diagnostics.js";

export class SourceFile {
  readonly path: string;
  readonly text: string;
  readonly bom: string;
  readonly starts: number[];

  constructor(path: string, text: string, bom = "") {
    this.path = path;
    this.text = text;
    this.bom = bom;
    this.starts = lineStarts(text);
  }
}

export function splitBom(text: string): { bom: string; text: string } {
  return text.startsWith("\uFEFF")
    ? { bom: "\uFEFF", text: text.slice(1) }
    : { bom: "", text };
}
