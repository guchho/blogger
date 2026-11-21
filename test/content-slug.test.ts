import assert from "node:assert/strict";
import test from "node:test";

import { ContentError } from "../src/content/schema-helpers.js";
import { assertSlug, ensureUniqueSlug, isValidSlug, slugify } from "../src/content/slug.js";

test("slugify produces URL-safe lowercase slugs", () => {
  assert.equal(slugify("Hello World!"), "hello-world");
  assert.equal(slugify("  Multiple   Spaces  "), "multiple-spaces");
  assert.equal(slugify("Café Résumé"), "cafe-resume");
  assert.equal(slugify("!!!"), "untitled");
  assert.equal(isValidSlug("hello-world"), true);
  assert.equal(isValidSlug("Hello-world"), false);
  assert.throws(() => assertSlug("bad slug"), (error: unknown) => error instanceof ContentError);
});

test("duplicate slugs get an incremental suggestion", () => {
  assert.deepEqual(ensureUniqueSlug("hello", []), { slug: "hello" });
  assert.deepEqual(ensureUniqueSlug("Hello", ["hello"]), { slug: "hello", suggested: "hello-2" });
  assert.deepEqual(ensureUniqueSlug("hello", ["hello", "hello-2", "hello-3"]), {
    slug: "hello",
    suggested: "hello-4",
  });
});

test("reserved slugs are suggested with a safe suffix", () => {
  const result = ensureUniqueSlug("search", []);
  assert.equal(result.slug, "search");
  assert.equal(result.suggested, "search-post");
});
