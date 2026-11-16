import { BloggerError } from "../diagnostics.js";

export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) return text;

  const ordered = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0;
  let output = "";

  for (const edit of ordered) {
    if (edit.start < cursor) {
      throw new BloggerError({
        code: "BLOGGER_INTERNAL_EDIT_OVERLAP",
        severity: "error",
        message: "internal compiler error: overlapping source edits",
      });
    }
    if (edit.start > text.length || edit.end > text.length) {
      throw new BloggerError({
        code: "BLOGGER_INTERNAL_EDIT_RANGE",
        severity: "error",
        message: "internal compiler error: source edit outside the file",
      });
    }
    output += text.slice(cursor, edit.start);
    output += edit.replacement;
    cursor = edit.end;
  }

  output += text.slice(cursor);
  return output;
}

export function removeFollowingNewline(text: string, end: number): number {
  if (text.startsWith("\r\n", end)) return end + 2;
  if (text[end] === "\n" || text[end] === "\r") return end + 1;
  return end;
}
