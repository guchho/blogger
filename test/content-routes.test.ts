import assert from "node:assert/strict";
import test from "node:test";

import { ContentError } from "../src/content/schema-helpers.js";
import {
  archiveUrl,
  assertNoRouteCollisions,
  labelUrl,
  pagePath,
  pageUrl,
  RESERVED_ROUTES,
  postPath,
  postUrl,
  searchUrl,
} from "../src/content/routes.js";
import { defaultPage, defaultPost } from "../src/content/model.js";

const POST = defaultPost({
  id: "post-1", title: "Hello", slug: "hello",
  publishAt: "2026-11-21T10:00:00Z", publishedAt: "2026-11-21T10:00:00Z", status: "published",
});
const PAGE = defaultPage({
  id: "page-1", title: "About", slug: "about",
  publishAt: "2026-11-21T10:00:00Z", status: "published",
});

test("Blogger-compatible routes are generated from content", () => {
  assert.equal(postPath(POST), "/2026/11/hello.html");
  assert.equal(pagePath(PAGE), "/p/about.html");
  assert.equal(postUrl("http://example.com", POST), "http://example.com/2026/11/hello.html");
  assert.equal(pageUrl("http://example.com/", PAGE), "http://example.com/p/about.html");
  assert.equal(labelUrl("http://example.com", "Web Dev"), "http://example.com/search/label/Web%20Dev/");
  assert.equal(archiveUrl("http://example.com", POST), "http://example.com/2026/11/");
  assert.equal(searchUrl("http://example.com", "cms"), "http://example.com/search/?q=cms");
});

test("duplicate and reserved routes are rejected", () => {
  const duplicate = defaultPost({ ...POST, id: "post-2" });
  assert.throws(
    () => assertNoRouteCollisions([POST, duplicate], []),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_ROUTE_CONFLICT"
  );
  assert.equal(RESERVED_ROUTES.has("/search/"), true);
  assert.equal(assertNoRouteCollisions([POST], [PAGE]).size, 2);
});
