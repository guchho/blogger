// The value model for the preview evaluator. Values are plain JavaScript data
// with two wrappers that carry trust or type information Blogger distinguishes:
// `HtmlString` marks content that must not be escaped on output, and
// `BloggerDate` carries a timestamp with the date helpers Blogger exposes.

export class HtmlString {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export class BloggerDate {
  readonly date: Date;
  constructor(date: Date | string | number) {
    this.date = date instanceof Date ? date : new Date(date);
  }
}

export type Value =
  | null
  | boolean
  | number
  | string
  | HtmlString
  | BloggerDate
  | Invokable
  | Value[]
  | ValueMap;

export interface ValueMap {
  [key: string]: Value;
}

export interface Invokable {
  invoke(args: Value[]): Value;
}

export function isDate(value: Value): value is BloggerDate {
  return value instanceof BloggerDate;
}

export function isInvokable(value: Value): value is Invokable {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof HtmlString) &&
    !(value instanceof BloggerDate) &&
    typeof (value as Invokable).invoke === "function"
  );
}

export function isMap(value: Value): value is ValueMap {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof HtmlString) &&
    !(value instanceof BloggerDate) &&
    !isInvokable(value)
  );
}

/** Blogger truthiness: null, false, 0, "", and empty collections are falsy. */
export function isTruthy(value: Value): boolean {
  if (value === null || value === false) return false;
  if (value === true) return true;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value.length > 0;
  if (value instanceof HtmlString) return value.value.length > 0;
  if (value instanceof BloggerDate) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isInvokable(value)) return true;
  if (isMap(value)) return Object.keys(value).length > 0;
  return true;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function jsonEscape(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

/** Renders a value to text for output. Trusted HTML is returned unchanged. */
export function toText(value: Value): string {
  if (value === null || value === undefined) return "";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (value instanceof HtmlString) return value.value;
  if (value instanceof BloggerDate) return formatDate(value.date);
  if (Array.isArray(value)) return value.map((item) => toText(item)).join("");
  if (isInvokable(value)) return "";
  return Object.values(value).map((item) => toText(item)).join("");
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Blogger renders dates as a localized long date, e.g. "January 1, 2026". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function toNumber(value: Value): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof HtmlString) {
    const parsed = Number(value.value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function isResizableUrl(value: string): boolean {
  return /blogger\.googleusercontent\.com|blogspot\.com|\/s\d+(-[a-z0-9-]+)?\/|=s\d+(-[a-z0-9-]+)?(?:$|[&#])/i.test(
    value
  );
}

/**
 * Reads a property, including the metadata suffixes Blogger documents:
 * `.escaped`, `.jsonEscaped`, `.iso8601`, `.canonical`, `.isResizable`,
 * `.empty`, `.length`, `.first` and `.last`.
 */
export function getMember(object: Value, property: string): Value {
  if (object === null || object === undefined) return null;

  if (object instanceof HtmlString) {
    switch (property) {
      case "escaped":
        return new HtmlString(escapeHtml(object.value));
      case "jsonEscaped":
        return new HtmlString(jsonEscape(object.value));
      case "empty":
        return object.value.length === 0;
      case "length":
        return object.value.length;
      case "canonical":
        return object.value;
      case "isResizable":
        return isResizableUrl(object.value);
      default:
        return null;
    }
  }

  if (typeof object === "string") {
    switch (property) {
      case "escaped":
        return new HtmlString(escapeHtml(object));
      case "jsonEscaped":
        return new HtmlString(jsonEscape(object));
      case "empty":
        return object.length === 0;
      case "length":
        return object.length;
      case "canonical":
        return object;
      case "isResizable":
        return isResizableUrl(object);
      default:
        return null;
    }
  }

  if (typeof object === "number") {
    switch (property) {
      case "escaped":
        return new HtmlString(formatNumber(object));
      case "empty":
        return false;
      case "length":
        return formatNumber(object).length;
      default:
        return null;
    }
  }

  if (typeof object === "boolean") {
    if (property === "escaped") return new HtmlString(object ? "true" : "false");
    if (property === "empty") return false;
    return null;
  }

  if (object instanceof BloggerDate) {
    switch (property) {
      case "iso8601":
        return object.date.toISOString();
      case "escaped":
        return new HtmlString(escapeHtml(object.date.toISOString()));
      case "empty":
        return false;
      default:
        return null;
    }
  }

  if (Array.isArray(object)) {
    switch (property) {
      case "first":
        return object.length > 0 ? (object[0] as Value) : null;
      case "last":
        return object.length > 0 ? (object[object.length - 1] as Value) : null;
      case "length":
        return object.length;
      case "empty":
        return object.length === 0;
      default:
        // `data:widgets` is both iterable and keyed by widget type.
        return Object.prototype.hasOwnProperty.call(object, property)
          ? ((object as unknown as Record<string, Value>)[property] as Value)
          : null;
    }
  }

  if (isInvokable(object)) return null;

  if (property in object) return object[property] as Value;
  if (property === "empty") return Object.keys(object).length === 0;
  return null;
}

export function typeName(value: Value): string {
  if (value === null) return "null";
  if (value === true || value === false) return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (value instanceof HtmlString) return "html";
  if (value instanceof BloggerDate) return "date";
  if (Array.isArray(value)) return "array";
  if (isInvokable(value)) return "function";
  return "map";
}
