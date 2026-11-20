import {
  BloggerDate,
  HtmlString,
  isMap,
  type Value,
  type ValueMap,
} from "../values.js";

export function applyMockData(
  data: ValueMap,
  overrides: Record<string, unknown> | undefined
): ValueMap {
  if (overrides === undefined) return data;
  return mergeMap(data, overrides);
}

export function toValue(value: unknown): Value {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof HtmlString || value instanceof BloggerDate) return value;
  if (Array.isArray(value)) return value.map((item) => toValue(item));
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object["__html"] === "string") {
      return new HtmlString(object["__html"]);
    }
    const output: ValueMap = {};
    for (const [key, item] of Object.entries(object)) {
      output[key] = toValue(item);
    }
    return output;
  }
  return null;
}

export function mergeMap(
  base: ValueMap,
  overrides: Record<string, unknown>
): ValueMap {
  const output: ValueMap = { ...base };
  for (const [key, raw] of Object.entries(overrides)) {
    const current = output[key];
    if (
      raw !== null &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      !(raw instanceof HtmlString) &&
      !(raw instanceof BloggerDate) &&
      current !== undefined &&
      isMap(current)
    ) {
      output[key] = mergeMap(current, raw as Record<string, unknown>);
    } else {
      output[key] = toValue(raw);
    }
  }
  return output;
}
