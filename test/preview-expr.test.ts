import assert from "node:assert/strict";
import test from "node:test";

import { parseExpression } from "../src/preview/expr/parser.js";
import { Evaluator, Scope } from "../src/preview/expr/evaluator.js";
import { HtmlString, type ValueMap } from "../src/preview/values.js";

function evaluate(expression: string, data: ValueMap): { value: unknown; reports: string[] } {
  const reports: string[] = [];
  const evaluator = new Evaluator(data, {
    report: (code, message) => reports.push(`${code}: ${message}`),
  });
  const node = parseExpression(expression);
  const value = evaluator.evaluate(node, Scope.root({}));
  return { value, reports };
}

test("resolves data references and property chains", () => {
  const data: ValueMap = { view: { isPost: true, title: "Hello" } };
  assert.equal(evaluate("data:view.isPost", data).value, true);
  assert.equal(evaluate("data:view.title", data).value, "Hello");
});

test("evaluates boolean and comparison operators", () => {
  const data: ValueMap = { view: { isPost: true, isPage: false, url: "/p/contact.html" } };
  assert.equal(evaluate("data:view.isPost and data:view.isPage", data).value, false);
  assert.equal(evaluate("data:view.isPost or data:view.isPage", data).value, true);
  assert.equal(evaluate("not data:view.isPage", data).value, true);
  assert.equal(evaluate('data:view.url contains "contact.html"', data).value, true);
});

test("concatenates strings with +", () => {
  const data: ValueMap = { blog: { homepageUrl: "https://x.example/" } };
  assert.equal(
    evaluate('data:blog.homepageUrl + "feeds/posts/default"', data).value,
    "https://x.example/feeds/posts/default"
  );
});

test("supports array indexing and set membership", () => {
  const data: ValueMap = {
    posts: [{ id: "1", reactionsUrl: "r" }],
    this: { style: "FLAT" },
  };
  assert.equal(evaluate("data:posts[0].reactionsUrl", data).value, "r");
  assert.equal(evaluate('data:this.style in {"FLAT", "MENU"}', data).value, true);
  assert.equal(evaluate('data:this.style in {"MENU"}', data).value, false);
});

test("supports lambdas with filter, map and first", () => {
  const data: ValueMap = {
    platforms: [{ key: "blogThis" }, { key: "facebook" }],
    widgets: [{ type: "HTML" }, { type: "Blog" }],
  };
  const filtered = evaluate('data:platforms filter (p => p.key not in {"blogThis"})', data).value;
  assert.deepEqual((filtered as { key: string }[]).map((item) => item.key), ["facebook"]);

  const mapped = evaluate("data:platforms map (p => p.key)", data).value;
  assert.deepEqual(mapped, ["blogThis", "facebook"]);

  const first = evaluate('data:widgets first (w => w.type == "Blog")', data).value;
  assert.deepEqual(first, { type: "Blog" });
});

test("supports coalescing and ternary", () => {
  const data: ValueMap = { a: "", b: "fallback", flag: false };
  assert.equal(evaluate("data:a ?: data:b", data).value, "fallback");
  assert.equal(evaluate('data:flag ? "yes" : "no"', data).value, "no");
});

test("supports postfix helper chains", () => {
  const data: ValueMap = {
    post: {
      featuredImage: "https://blogger.googleusercontent.com/img/s72-c/a.png",
      snippets: { short: "<p>Hello world</p>" },
      url: "https://x.example/post.html",
    },
  };
  assert.equal(
    evaluate("data:post.featuredImage resizeImage 380", data).value,
    "https://blogger.googleusercontent.com/img/s380/a.png"
  );
  assert.equal(
    evaluate("data:post.snippets.short snippet { length: 5 }", data).value,
    "Hello…"
  );
  assert.equal(
    evaluate('data:post.url fragment "more"', data).value,
    "https://x.example/post.html#more"
  );
});

test("supports direct helper calls", () => {
  const data: ValueMap = {
    post: { featuredImage: "https://x.example/img/s72-c/a.png" },
  };
  assert.equal(
    evaluate('resizeImage(data:post.featuredImage, 1600, "1600:900")', data).value,
    "https://x.example/img/s1600/a.png"
  );
});

test("supports loop index arithmetic and trusted HTML", () => {
  const data: ValueMap = { i: 1, post: { body: new HtmlString("<b>hi</b>") } };
  assert.equal(evaluate("data:i + 1", data).value, 2);
  assert.equal(evaluate("data:post.body", data).value instanceof HtmlString, true);
});

test("reports unsupported helpers instead of throwing", () => {
  const data: ValueMap = {};
  const result = evaluate("data:x mysteryHelper 5", data);
  assert.equal(result.value, null);
  assert.ok(result.reports.some((report) => report.includes("mysteryHelper")));
});
