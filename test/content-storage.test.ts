import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ContentError } from "../src/content/schema-helpers.js";
import {
  contentHash,
  deleteWithBackup,
  readAll,
  readJsonFile,
  resolveContentPaths,
  safeFileName,
  writeJsonAtomic,
  withFileLock,
} from "../src/content/storage.js";
import { validatePost } from "../src/content/schema.js";
import { defaultPost } from "../src/content/model.js";

async function withRoot(run: (root: string, paths: ReturnType<typeof resolveContentPaths>) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-content-storage-"));
  try {
    await run(root, resolveContentPaths(root));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("content paths are confined to the project root", async () => {
  await withRoot((root) => {
    assert.throws(
      () => resolveContentPaths(root, { postsDir: "../outside" }),
      (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_PATH_FORBIDDEN"
    );
    assert.throws(
      () => resolveContentPaths(root, { dataDir: path.resolve(root, "..", "data") }),
      (error: unknown) => error instanceof ContentError
    );
    assert.throws(() => safeFileName("../escape"), (error: unknown) => error instanceof ContentError);
    assert.equal(safeFileName("post-1"), "post-1.json");
  });
});

test("atomic writes create JSON, preserve content and back up previous versions", async () => {
  await withRoot(async (root, paths) => {
    const file = path.join(paths.postsDir, "post-1.json");
    const post = defaultPost({ id: "post-1", title: "Hello", slug: "hello", content: "<p>Hi</p>" });
    const first = await writeJsonAtomic(paths, file, post);
    assert.equal(first.backup, null);
    assert.equal((await readJsonFile(file, validatePost)).content, "<p>Hi</p>");
    assert.equal(first.hash, contentHash(post));

    const updated = { ...post, title: "Hello again" };
    const second = await writeJsonAtomic(paths, file, updated);
    assert.match(second.backup ?? "", /^post-1\.json\.bak-/);
    assert.equal(await fs.readFile(path.join(paths.backupDir, second.backup ?? ""), "utf8"),
      `${JSON.stringify(post, null, 2)}\n`);
    assert.equal((await readJsonFile(file, validatePost)).title, "Hello again");

    const leftovers = (await fs.readdir(paths.postsDir)).filter((name) => name.includes(".tmp-"));
    assert.deepEqual(leftovers, []);
  });
});

test("readAll validates JSON and reports invalid files", async () => {
  await withRoot(async (_root, paths) => {
    await fs.mkdir(paths.postsDir, { recursive: true });
    const post = defaultPost({ id: "post-a", title: "A", slug: "a" });
    await fs.writeFile(path.join(paths.postsDir, "post-a.json"), JSON.stringify(post), "utf8");
    await fs.writeFile(path.join(paths.postsDir, "bad.json"), "{", "utf8");
    await assert.rejects(
      () => readAll(paths.postsDir, validatePost),
      (error: unknown) => error instanceof ContentError && error.code === "BLOGGER_CONTENT_INVALID_JSON"
    );
    await fs.rm(path.join(paths.postsDir, "bad.json"), { force: true });
    const items = await readAll(paths.postsDir, validatePost);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "post-a");
  });
});

test("per-file lock serializes concurrent operations", async () => {
  await withRoot(async (_root, paths) => {
    const order: number[] = [];
    const file = path.join(paths.postsDir, "lock.json");
    await Promise.all([
      withFileLock(file, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        order.push(1);
      }),
      withFileLock(file, async () => {
        order.push(2);
      }),
    ]);
    assert.deepEqual(order, [1, 2]);
  });
});

test("deletion keeps a recoverable backup", async () => {
  await withRoot(async (_root, paths) => {
    const file = path.join(paths.postsDir, "gone.json");
    await writeJsonAtomic(paths, file, defaultPost({ id: "gone", title: "Gone", slug: "gone" }));
    const backup = await deleteWithBackup(paths, file);
    assert.match(backup ?? "", /^gone\.json\.deleted-/);
    assert.equal(await fs.readFile(path.join(paths.backupDir, backup ?? ""), "utf8").then((text) => JSON.parse(text).id), "gone");
    assert.equal(await fs.access(file).then(() => true).catch(() => false), false);
  });
});
