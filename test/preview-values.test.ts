import assert from "node:assert/strict";
import test from "node:test";

import {
  BloggerDate,
  HtmlString,
  escapeHtml,
  getMember,
  isTruthy,
  jsonEscape,
  toNumber,
  toText,
  typeName,
  type Value,
  type ValueMap,
} from "../src/preview/values.js";

test("escapeHtml escapes the five dangerous characters", () => {
  assert.equal(
    escapeHtml(`<a href="x" class='y'>&</a>`),
    "&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
  );
});

test("jsonEscape escapes quotes and backslashes without the outer quotes", () => {
  assert.equal(jsonEscape('a"b\\c'), 'a\\"b\\\\c');
});

test("isTruthy follows Blogger truthiness rules", () => {
  assert.equal(isTruthy(null), false);
  assert.equal(isTruthy(false), false);
  assert.equal(isTruthy(0), false);
  assert.equal(isTruthy(""), false);
  assert.equal(isTruthy([]), false);
  assert.equal(isTruthy({} as ValueMap), false);
  assert.equal(isTruthy(new HtmlString("")), false);
  assert.equal(isTruthy(true), true);
  assert.equal(isTruthy(1), true);
  assert.equal(isTruthy("x"), true);
  assert.equal(isTruthy([0]), true);
  assert.equal(isTruthy({ a: 1 }), true);
});

test("toText renders scalars, collections and trusted HTML", () => {
  assert.equal(toText(null), "");
  assert.equal(toText(true), "true");
  assert.equal(toText(false), "false");
  assert.equal(toText(42), "42");
  assert.equal(toText("hi"), "hi");
  assert.equal(toText(new HtmlString("<b>hi</b>")), "<b>hi</b>");
  assert.equal(toText([1, "a", true]), "1atrue");
  assert.equal(toText({ a: "x", b: "y" }), "xy");
});

test("toNumber coerces values like Blogger", () => {
  assert.equal(toNumber(5), 5);
  assert.equal(toNumber(true), 1);
  assert.equal(toNumber(false), 0);
  assert.equal(toNumber("12"), 12);
  assert.equal(toNumber("nope"), 0);
  assert.equal(toNumber(new HtmlString("7")), 7);
  assert.equal(toNumber(null), 0);
});

test("getMember exposes string metadata suffixes", () => {
  assert.equal(toText(getMember("a<b", "escaped") as Value), "a&lt;b");
  assert.ok(getMember("a<b", "escaped") instanceof HtmlString);
  assert.equal(getMember("abc", "length"), 3);
  assert.equal(getMember("", "empty"), true);
  assert.equal(getMember("abc", "canonical"), "abc");
  assert.equal(getMember("abc", "isResizable"), false);
});

test("getMember exposes array metadata and own type keys", () => {
  const array = [1, 2, 3] as unknown as Value[];
  assert.equal(getMember(array, "first"), 1);
  assert.equal(getMember(array, "last"), 3);
  assert.equal(getMember(array, "length"), 3);
  assert.equal(getMember(array, "empty"), false);
  assert.equal(getMember([] as Value[], "empty"), true);
  (array as unknown as Record<string, Value>)["Blog"] = "bucket";
  assert.equal(getMember(array, "Blog"), "bucket");
  assert.equal(getMember(array, "missing"), null);
});

test("getMember exposes date metadata", () => {
  const date = new BloggerDate(Date.UTC(2026, 0, 1, 12, 0, 0));
  assert.equal(getMember(date, "iso8601"), "2026-01-01T12:00:00.000Z");
  assert.equal(toText(getMember(date, "escaped") as Value), "2026-01-01T12:00:00.000Z");
  assert.equal(getMember(date, "empty"), false);
});

test("getMember exposes map emptiness and members", () => {
  const map: ValueMap = { name: "Guchho" };
  assert.equal(getMember(map, "name"), "Guchho");
  assert.equal(getMember(map, "empty"), false);
  assert.equal(getMember({} as ValueMap, "empty"), true);
  assert.equal(getMember(map, "missing"), null);
});

test("getMember on HtmlString escapes its raw value", () => {
  const html = new HtmlString("<b>x</b>");
  assert.equal(toText(getMember(html, "escaped") as Value), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(getMember(html, "length"), 8);
  assert.equal(getMember(html, "canonical"), "<b>x</b>");
});

test("toText formats a date as a long localized date", () => {
  const date = new BloggerDate(Date.UTC(2026, 0, 1, 12, 0, 0));
  assert.match(toText(date), /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
});

test("typeName classifies every value kind", () => {
  assert.equal(typeName(null), "null");
  assert.equal(typeName(true), "boolean");
  assert.equal(typeName(1), "number");
  assert.equal(typeName("s"), "string");
  assert.equal(typeName(new HtmlString("x")), "html");
  assert.equal(typeName(new BloggerDate(0)), "date");
  assert.equal(typeName([]), "array");
  assert.equal(typeName({}), "map");
});
