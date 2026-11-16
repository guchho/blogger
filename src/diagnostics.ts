import type {
  Diagnostic,
  DiagnosticSeverity,
  SourceLocation,
} from "./types.js";

export interface Span {
  start: number;
  end: number;
}

export class BloggerError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(diagnostic: Diagnostic) {
    super(formatDiagnostic(diagnostic));
    this.name = "BloggerError";
    this.diagnostic = diagnostic;
  }
}

export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

export function makeLocation(
  file: string,
  text: string,
  start: number,
  end: number,
  starts: number[] = lineStarts(text)
): SourceLocation {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((starts[mid] ?? 0) <= start) low = mid + 1;
    else high = mid - 1;
  }
  const lineIndex = Math.max(0, high);
  const lineStart = starts[lineIndex] ?? 0;
  const lineEnd = text.indexOf("\n", lineStart);
  const lineText = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  return {
    file,
    line: lineIndex + 1,
    column: start - lineStart + 1,
    length: Math.max(1, end - start),
    lineText,
  };
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const location =
    diagnostic.location === undefined
      ? ""
      : `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column}: `;
  const head = `${location}${diagnostic.severity}: ${diagnostic.message} [${diagnostic.code}]`;
  const notes = diagnostic.notes ?? [];
  const hint = diagnostic.hint === undefined ? [] : [`hint: ${diagnostic.hint}`];
  return [head, ...notes.map((note) => `note: ${note}`), ...hint].join("\n");
}

export class DiagnosticCollector {
  readonly diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  error(
    code: string,
    message: string,
    location?: SourceLocation,
    hint?: string,
    notes?: string[]
  ): void {
    this.add({ code, severity: "error", message, location, hint, notes });
  }

  warning(
    code: string,
    message: string,
    location?: SourceLocation,
    hint?: string,
    notes?: string[]
  ): void {
    this.add({ code, severity: "warning", message, location, hint, notes });
  }

  hasErrors(): boolean {
    return this.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  }

  errors(): Diagnostic[] {
    return this.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  }
}

export function diagnostic(
  code: string,
  severity: DiagnosticSeverity,
  message: string,
  location?: SourceLocation
): Diagnostic {
  return { code, severity, message, location };
}
