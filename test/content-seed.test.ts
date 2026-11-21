import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_SEED_POST_ID,
  DEFAULT_SEED_TIMESTAMP,
  ensureDefaultPost,
} from "../src/content/seed.js";
import { validatePost } from "../src/content/schema.js";
import { loadContent } from "../src/content/settings.js";
import { withContentRoot } from "./helpers/content.js";

test("default post seeding creates one published post with stable dates", async () => {
  await withContentRoot(async (paths) => {
    const result = await ensureDefaultPost(paths, new Date(DEFAULT_SEED_TIMESTAMP));

    assert.equal(result.created, true);
    assert.equal(result.item?.id, DEFAULT_SEED_POST_ID);
    assert.equal(result.item?.slug, "hello-world");
    assert.equal(result.item?.status, "published");
    assert.equal(result.item?.createdAt, DEFAULT_SEED_TIMESTAMP);
    assert.equal(result.item?.publishedAt, DEFAULT_SEED_TIMESTAMP);
    assert.equal(result.item?.publishAt, DEFAULT_SEED_TIMESTAMP);
    assert.match(result.item?.content ?? "", /Welcome to your Guchho Blogger site/);
    assert.equal(
      result.file,
      path.join(paths.postsDir, `${DEFAULT_SEED_POST_ID}.json`)
    );

    const parsed = validatePost(
      JSON.parse(await fs.readFile(result.file!, "utf8")) as unknown
    );
    assert.deepEqual(parsed, result.item);

    const snapshot = await loadContent(paths);
    assert.equal(snapshot.posts.length, 1);
    assert.equal(snapshot.posts[0]?.title, "Hello world");
  });
});

test("default post seeding does not overwrite existing content", async () => {
  await withContentRoot(async (paths) => {
    const existing = {
      id: "custom-post",
      type: "post",
      title: "Existing Post",
      slug: "existing-post",
      content: "<p>Keep me</p>",
      status: "draft",
      featuredImage: null,
      createdAt: DEFAULT_SEED_TIMESTAMP,
      updatedAt: DEFAULT_SEED_TIMESTAMP,
      publishedAt: null,
      publishAt: null,
      trashedAt: null,
      excerpt: "",
      labels: [],
      author: "admin",
      allowComments: true,
    };
    const file = path.join(paths.postsDir, "custom-post.json");
    await fs.mkdir(paths.postsDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(existing), "utf8");

    const result = await ensureDefaultPost(paths, new Date(DEFAULT_SEED_TIMESTAMP));

    assert.equal(result.created, false);
    assert.equal(result.item, undefined);
    assert.deepEqual(
      JSON.parse(await fs.readFile(file, "utf8")) as unknown,
      existing
    );
    assert.deepEqual(await fs.readdir(paths.postsDir), ["custom-post.json"]);
  });
});

test("default post seeding skips invalid JSON instead of replacing it", async () => {
  await withContentRoot(async (paths) => {
    const file = path.join(paths.postsDir, "broken.json");
    await fs.mkdir(paths.postsDir, { recursive: true });
    await fs.writeFile(file, "{not json", "utf8");

    const result = await ensureDefaultPost(paths, new Date(DEFAULT_SEED_TIMESTAMP));

    assert.equal(result.created, false);
    assert.equal(await fs.readFile(file, "utf8"), "{not json");
  });
});
