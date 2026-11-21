import assert from "node:assert/strict";
import test from "node:test";

import { defaultPage, defaultPost } from "../src/content/model.js";
import { ContentError } from "../src/content/schema-helpers.js";
import { validatePage, validatePost } from "../src/content/schema.js";

test("valid posts round-trip with HTML preserved", () => {
  const original = defaultPost({
    id: "post-1",
    title: "Hello",
    slug: "hello",
    content: '<p class="lead">Hi &amp; <a href="/x">there</a></p>',
    labels: ["General", "News"],
  });
  const parsed = validatePost(JSON.parse(JSON.stringify(original)));
  assert.equal(parsed.content, original.content);
  assert.deepEqual(parsed.labels, ["General", "News"]);
  assert.equal(parsed.status, "draft");
});

test("pages never accept post-only fields", () => {
  const page = defaultPage({ id: "page-1", title: "About", slug: "about" });
  assert.equal(validatePage(JSON.parse(JSON.stringify(page))).type, "page");
  assert.throws(
    () => validatePage({ ...page, labels: ["News"] }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_UNKNOWN_FIELD"
  );
  assert.throws(
    () => validatePost({ ...defaultPost(), type: "page" }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_WRONG_TYPE"
  );
});

test("invalid fields, dates, slugs and statuses are rejected", () => {
  const post = defaultPost({ id: "post-1", title: "Title", slug: "title" });
  assert.throws(
    () => validatePost({ ...post, slug: "Bad Slug" }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_INVALID_SLUG"
  );
  assert.throws(
    () => validatePost({ ...post, createdAt: "yesterday" }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_INVALID_DATE"
  );
  assert.throws(
    () => validatePost({ ...post, status: "archived" }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_INVALID_STATUS"
  );
  assert.throws(
    () => validatePost({ ...post, unexpected: true }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_UNKNOWN_FIELD"
  );
  assert.throws(
    () => validatePost({ ...post, status: "scheduled" }),
    (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_MISSING_PUBLISH_DATE"
  );
});
