// A parse or evaluation failure inside one expression. The renderer turns this
// into a `BLOGGER_PREVIEW_*` diagnostic and maps the offset back to a source
// location.

export class ExpressionError extends Error {
  readonly start: number;
  readonly end: number;
  readonly code: string;

  constructor(code: string, message: string, start: number, end = start) {
    super(message);
    this.name = "ExpressionError";
    this.code = code;
    this.start = start;
    this.end = Math.max(end, start);
  }
}
