// The documented Blogger helper functions and collection filters. A helper is
// called either postfix (`value snippet { length: 160 }`) or directly
// (`resizeImage(data:post.featuredImage, 1920)`); both arrive here as an
// argument list where the receiver, when there is one, is the first argument.

import {
  BloggerDate,
  HtmlString,
  getMember,
  isInvokable,
  isMap,
  isResizableUrl,
  isTruthy,
  toNumber,
  toText,
  type Value,
  type ValueMap,
} from "../values.js";

export interface HelperContext {
  /** Runs a lambda value with the given arguments. */
  invoke(callable: Value, args: Value[]): Value;
  /** Reports an unsupported or malformed helper invocation. */
  report(code: string, message: string): void;
}

export type HelperFn = (args: Value[], context: HelperContext) => Value;

function asArray(value: Value): Value[] {
  return Array.isArray(value) ? value : [];
}

function arg(args: Value[], index: number): Value {
  return args[index] ?? null;
}

function requireString(value: Value): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof HtmlString) return value.value;
  return undefined;
}

function optionMap(value: Value | undefined): ValueMap | undefined {
  if (value !== undefined && isMap(value)) return value;
  return undefined;
}

function optionNumber(value: Value | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function resizeUrl(url: string, width: number | undefined): string {
  if (width === undefined) return url;
  const pattern = /\/s\d+(-c)?\//;
  if (pattern.test(url)) return url.replace(pattern, `/s${width}/`);
  if (url.includes("=s")) return url.replace(/=s\d+/, `=s${width}`);
  return url;
}

export const FUNCTIONS: Record<string, HelperFn> = {
  resizeImage(args) {
    const image = arg(args, 0);
    const url = requireString(image);
    if (url === undefined) return null;
    const width = optionNumber(arg(args, 1));
    return resizeUrl(url, width);
  },

  snippet(args) {
    const value = arg(args, 0);
    const text = value === null || value === undefined ? "" : stripTags(toText(value));
    const options = optionMap(arg(args, 1));
    const length = options === undefined ? undefined : optionNumber(options["length"]);
    if (length === undefined || text.length <= length) return text;
    return `${text.slice(0, length).trimEnd()}…`;
  },

  fragment(args) {
    const url = requireString(arg(args, 0)) ?? "";
    const name = requireString(arg(args, 1)) ?? "";
    if (name === "") return url;
    const base = url.split("#", 1)[0] ?? url;
    return `${base}#${name}`;
  },

  take(args, context) {
    return takeInternal(args, context, "take");
  },
  limit(args, context) {
    return takeInternal(args, context, "limit");
  },

  skip(args, context) {
    return skipInternal(args, context, "skip");
  },
  offset(args, context) {
    return skipInternal(args, context, "offset");
  },

  count(args) {
    const value = arg(args, 0);
    if (Array.isArray(value)) return value.length;
    if (isMap(value)) return Object.keys(value).length;
    if (value instanceof HtmlString) return value.value.length;
    if (typeof value === "string") return value.length;
    return 0;
  },

  length(args) {
    return FUNCTIONS["count"]!(args, noopContext);
  },

  first(args, context) {
    return firstInternal(args, context);
  },

  last(args, context) {
    const items = asArray(arg(args, 0));
    const predicate = arg(args, 1);
    if (isInvokable(predicate)) {
      for (let index = items.length - 1; index >= 0; index--) {
        if (isTruthy(context.invoke(predicate, [items[index] as Value, index]))) {
          return items[index] as Value;
        }
      }
      return null;
    }
    return items.length > 0 ? (items[items.length - 1] as Value) : null;
  },

  any(args, context) {
    const items = asArray(arg(args, 0));
    const predicate = arg(args, 1);
    if (!isInvokable(predicate)) return items.length > 0;
    return items.some((item, index) => isTruthy(context.invoke(predicate, [item, index])));
  },

  all(args, context) {
    const items = asArray(arg(args, 0));
    const predicate = arg(args, 1);
    if (!isInvokable(predicate)) return true;
    return items.every((item, index) => isTruthy(context.invoke(predicate, [item, index])));
  },

  none(args, context) {
    const items = asArray(arg(args, 0));
    const predicate = arg(args, 1);
    if (!isInvokable(predicate)) return items.length === 0;
    return items.every((item, index) => !isTruthy(context.invoke(predicate, [item, index])));
  },

  map(args, context) {
    return mapInternal(args, context);
  },
  select(args, context) {
    return mapInternal(args, context);
  },

  filter(args, context) {
    return filterInternal(args, context);
  },
  where(args, context) {
    return filterInternal(args, context);
  },

  contains(args) {
    const haystack = arg(args, 0);
    const needle = arg(args, 1);
    if (typeof haystack === "string") return haystack.includes(toText(needle));
    if (haystack instanceof HtmlString) return haystack.value.includes(toText(needle));
    if (Array.isArray(haystack)) return haystack.some((item) => toText(item) === toText(needle));
    return false;
  },

  startsWith(args) {
    const value = requireString(arg(args, 0));
    if (value === undefined) return false;
    return value.startsWith(toText(arg(args, 1)));
  },

  endsWith(args) {
    const value = requireString(arg(args, 0));
    if (value === undefined) return false;
    return value.endsWith(toText(arg(args, 1)));
  },

  keys(args) {
    const value = arg(args, 0);
    if (isMap(value)) return Object.keys(value);
    return [];
  },

  values(args) {
    const value = arg(args, 0);
    if (isMap(value)) return Object.values(value);
    return [];
  },

  toJson(args) {
    const value = arg(args, 0);
    try {
      return JSON.stringify(toPlain(value));
    } catch {
      return null;
    }
  },

  trim(args) {
    return toText(arg(args, 0)).trim();
  },

  toLowerCase(args) {
    return toText(arg(args, 0)).toLowerCase();
  },

  toUpperCase(args) {
    return toText(arg(args, 0)).toUpperCase();
  },

  date(args) {
    const value = arg(args, 0);
    if (value instanceof BloggerDate) return value;
    if (typeof value === "string" || typeof value === "number") return new BloggerDate(value);
    return null;
  },

  default(args) {
    const value = arg(args, 0);
    return isTruthy(value) ? value : (arg(args, 1) ?? null);
  },

  isResizable(args) {
    const url = requireString(arg(args, 0));
    if (url === undefined) return false;
    return isResizableUrl(url);
  },

  empty(args) {
    return !isTruthy(arg(args, 0));
  },

  escaped(args) {
    return getMember(arg(args, 0) ?? null, "escaped");
  },

  jsonEscaped(args) {
    return getMember(arg(args, 0) ?? null, "jsonEscaped");
  },
};

const noopContext: HelperContext = {
  invoke: () => null,
  report: () => undefined,
};

function takeInternal(args: Value[], context: HelperContext, name: string): Value {
  const items = asArray(arg(args, 0));
  const count = optionNumber(arg(args, 1));
  if (count === undefined) {
    context.report(
      "BLOGGER_PREVIEW_UNSUPPORTED_HELPER",
      `the "${name}" helper needs a numeric count`
    );
    return items;
  }
  return items.slice(0, Math.max(0, Math.trunc(count)));
}

function skipInternal(args: Value[], context: HelperContext, name: string): Value {
  const items = asArray(arg(args, 0));
  const count = optionNumber(arg(args, 1));
  if (count === undefined) {
    context.report(
      "BLOGGER_PREVIEW_UNSUPPORTED_HELPER",
      `the "${name}" helper needs a numeric count`
    );
    return items;
  }
  return items.slice(Math.max(0, Math.trunc(count)));
}

function firstInternal(args: Value[], context: HelperContext): Value {
  const items = asArray(arg(args, 0));
  const predicate = arg(args, 1);
  if (isInvokable(predicate)) {
    for (let index = 0; index < items.length; index++) {
      if (isTruthy(context.invoke(predicate, [items[index] as Value, index]))) {
        return items[index] as Value;
      }
    }
    return null;
  }
  return items.length > 0 ? (items[0] as Value) : null;
}

function mapInternal(args: Value[], context: HelperContext): Value {
  const items = asArray(arg(args, 0));
  const mapper = arg(args, 1);
  if (!isInvokable(mapper)) return items.slice();
  return items.map((item, index) => context.invoke(mapper, [item, index]));
}

function filterInternal(args: Value[], context: HelperContext): Value {
  const items = asArray(arg(args, 0));
  const predicate = arg(args, 1);
  if (!isInvokable(predicate)) return items.slice();
  return items.filter((item, index) => isTruthy(context.invoke(predicate, [item, index])));
}

function toPlain(value: Value): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof HtmlString) return value.value;
  if (value instanceof BloggerDate) return value.date.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlain(item));
  if (isMap(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = toPlain(item);
    return output;
  }
  return null;
}

export function hasFunction(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS, name);
}

export function callFunction(
  name: string,
  args: Value[],
  context: HelperContext
): Value | undefined {
  const fn = FUNCTIONS[name];
  if (fn === undefined) return undefined;
  return fn(args, context);
}

export { toNumber };
