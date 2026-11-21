import assert from "node:assert/strict";
import test from "node:test";

import { createPageRepository } from "../src/content/pages.js";
import { withContentRoot } from "./helpers/content.js";

test("pages are stored independently and have no post-only fields", async () => {
  await withContentRoot(async (paths) => {
    const pages = createPageRepository(paths);
    const created = await pages.create({ title: "About Us", slug: "about", content: "<p>About</p>" });
    assert.equal(created.item.type, "page");
    assert.equal("labels" in created.item, false);
    assert.equal("allowComments" in created.item, false);
    assert.equal((await pages.getBySlug("about"))?.id, created.item.id);
    assert.equal((await pages.list()).total, 1);
  });
});

test("pages support draft/published states, trash and restore", async () => {
  await withContentRoot(async (paths) => {
    const pages = createPageRepository(paths);
    const created = await pages.create({ title: "Contact", slug: "contact" });
    assert.equal(created.item.status, "draft");

    const published = await pages.setStatus(created.item.id, "published");
    assert.equal(published.item.status, "published");
    assert.ok(published.item.publishedAt);

    const trashed = await pages.trash(created.item.id);
    assert.ok(trashed.item.trashedAt);
    assert.equal((await pages.list()).total, 0);
    assert.equal((await pages.list({ includeTrashed: true })).total, 1);

    const restored = await pages.restore(created.item.id);
    assert.equal(restored.item.trashedAt, null);
    assert.equal((await pages.list()).total, 1);
  });
});
