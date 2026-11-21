import assert from "node:assert/strict";
import test from "node:test";

import { effectiveStatus, isPublished } from "../src/content/model.js";
import { createPostRepository } from "../src/content/posts.js";
import { withContentRoot } from "./helpers/content.js";

const FUTURE = "2099-01-01T00:00:00Z";
const PAST = "2020-01-01T00:00:00Z";

test("scheduled posts become published once their publish date passes", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    const created = await posts.create({
      title: "Future", slug: "future", status: "scheduled", publishAt: FUTURE,
    });
    assert.equal(effectiveStatus(created.item, new Date("2026-01-01T00:00:00Z")), "scheduled");
    assert.equal(isPublished(created.item, new Date("2026-01-01T00:00:00Z")), false);
    assert.equal(effectiveStatus(created.item, new Date("2100-01-01T00:00:00Z")), "published");
    assert.equal(
      (await posts.list({ status: "published", now: new Date("2100-01-01T00:00:00Z") })).total,
      1
    );
    assert.equal((await posts.list({ status: "scheduled", now: new Date() })).total, 1);
  });
});

test("publish and unpublish transitions update dates and statuses", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    const created = await posts.create({ title: "Draft", slug: "draft" });
    const published = await posts.setStatus(created.item.id, "published", PAST);
    assert.equal(published.item.status, "published");
    assert.equal(published.item.publishAt, PAST);
    assert.ok(published.item.publishedAt);

    const unpublished = await posts.setStatus(created.item.id, "draft");
    assert.equal(unpublished.item.status, "draft");
    assert.equal((await posts.list({ status: "published" })).total, 0);
  });
});

test("scheduling without a publish date is rejected", async () => {
  await withContentRoot(async (paths) => {
    const posts = createPostRepository(paths);
    const created = await posts.create({ title: "No date", slug: "no-date" });
    await assert.rejects(() => posts.setStatus(created.item.id, "scheduled"));
  });
});
