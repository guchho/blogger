import assert from "node:assert/strict";
import test from "node:test";

import { ContentError } from "../src/content/schema-helpers.js";
import { createPostRepository } from "../src/content/posts.js";
import { withContentRoot } from "./helpers/content.js";

test("posts can be created, listed, updated and deleted as JSON files", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    const created = await posts.create({
      title: "Hello World",
      slug: "hello-world",
      content: "<p>Body</p>",
      labels: ["General"],
      author: "admin",
    });
    assert.equal(created.item.type, "post");
    assert.equal(created.hash.length, 64);
    assert.equal((await posts.get(created.item.id)).title, "Hello World");
    assert.equal((await posts.list()).total, 1);

    const updated = await posts.update(created.item.id, { title: "Updated", content: "<p>New</p>" }, created.hash);
    assert.equal(updated.item.title, "Updated");
    assert.equal(updated.item.content, "<p>New</p>");
    assert.match(updated.backup ?? "", /\.bak-/);

    await assert.rejects(
      () => posts.update(created.item.id, { title: "Stale" }, "not-the-hash"),
      (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_STALE"
    );

    const removed = await posts.remove(created.item.id);
    assert.match(removed.backup, /\.deleted-/);
    assert.equal((await posts.list()).total, 0);
  });
});

test("post search, status filtering, labels and sorting work", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    const first = await posts.create({
      title: "Alpha", slug: "alpha", content: "needle", labels: ["News"],
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    });
    const second = await posts.create({
      title: "Beta", slug: "beta", content: "haystack", labels: ["Tips"], status: "published",
      publishedAt: "2026-02-01T00:00:00Z", createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
    });
    assert.deepEqual((await posts.list({ search: "needle" })).items.map((item) => item.id), [first.item.id]);
    assert.deepEqual((await posts.list({ label: "Tips" })).items.map((item) => item.id), [second.item.id]);
    assert.deepEqual((await posts.list({ status: "published" })).items.map((item) => item.id), [second.item.id]);
    assert.deepEqual((await posts.list({ sort: "title-asc" })).items.map((item) => item.title), ["Alpha", "Beta"]);
    assert.deepEqual((await posts.list({ sort: "date-desc" })).items.map((item) => item.title), ["Beta", "Alpha"]);
    assert.equal((await posts.list({ limit: 1 })).total, 2);
  });
});

test("duplicate slugs are rejected with a suggestion", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    await posts.create({ title: "Hello", slug: "hello" });
    await assert.rejects(
      () => posts.create({ title: "Hello again", slug: "hello" }),
      (error: unknown) => {
        assert.ok(error instanceof ContentError);
        assert.equal(error.code, "BLOGGER_CONTENT_SLUG_CONFLICT");
        assert.equal(error.details["suggested"], "hello-2");
        return true;
      }
    );
    assert.equal(await posts.getBySlug("hello") !== null, true);
  });
});
