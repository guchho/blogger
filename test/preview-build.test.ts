import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { buildPreview } from "../src/preview/index.js";

const SMALL_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main' class='main'>
  <b:widget id='Blog1' type='Blog' title='Posts' visible='true'>
    <b:includable id='main' var='this'>
      <b:loop values='data:posts' var='post'><data:post.title/></b:loop>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;

test("buildPreview renders every scenario with no diagnostics", () => {
  const result = buildPreview({ entryPath: "test.xml", xml: SMALL_TEMPLATE });
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(
    result.pages.map((page) => page.file),
    [
      "index.html",
      "post.html",
      "page.html",
      "label.html",
      "archive.html",
      "search.html",
      "404.html",
      "widgets.html",
      "dashboard.html",
      "dashboard-posts.html",
      "dashboard-post-new.html",
      "dashboard-pages.html",
      "dashboard-page-new.html",
      "dashboard-comments.html",
      "dashboard-layout.html",
      "dashboard-theme.html",
      "dashboard-settings.html",
    ]
  );
  for (const page of result.pages) {
    assert.match(page.html, /<body>/);
  }
});

const THEME_PATH = "demo/theme.xml";

test("buildPreview renders the real theme fixture", { skip: !existsSync(THEME_PATH) }, () => {
  const xml = readFileSync(THEME_PATH, "utf8");
  const result = buildPreview({ entryPath: THEME_PATH, xml });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.pages.length, 17);
  const index = result.pages.find((page) => page.file === "index.html");
  assert.ok(index);
  assert.match(index.html, /Getting started with Guchho/);
});
