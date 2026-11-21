import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { startSaveService } from "../src/layout/save-service.js";
import { resolveContentPaths } from "../src/content/storage.js";
import type { ContentPaths } from "../src/content/storage.js";

const TEMPLATE = `<?xml version="1.0"?>
<html xmlns:b='http://www.google.com/2005/gml/b'><body>
<b:section id='main'><b:widget id='Blog1' type='Blog'>
<b:includable id='main'>posts</b:includable></b:widget></b:section>
</body></html>`;

async function withApi(
  run: (context: {
    base: string;
    paths: ContentPaths;
    request(method: string, route: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }>;
  }) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-content-api-"));
  const entry = path.join(root, "template.xml");
  await fs.writeFile(entry, TEMPLATE, "utf8");
  const paths = resolveContentPaths(root);
  const service = await startSaveService({ entryPath: entry, projectRoot: root, port: 0, contentPaths: paths });
  try {
    const base = `http://127.0.0.1:${service.port}`;
    await run({
      base,
      paths,
      async request(method, route, body, headers = {}) {
        const response = await fetch(`${base}${route}`, {
          method,
          headers: { "content-type": "application/json", ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: (await response.json()) as Record<string, unknown> };
      },
    });
  } finally {
    await service.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("content status advertises the capability and current counts", async () => {
  await withApi(async ({ request }) => {
    const status = await request("GET", "/api/layout/status");
    assert.deepEqual(status.body["capabilities"], ["layout", "content"]);
    const content = await request("GET", "/api/content/status");
    assert.equal(content.status, 200);
    assert.equal(content.body["posts"], 0);
    assert.equal(content.body["pages"], 0);
  });
});

test("posts and pages CRUD endpoints persist data", async () => {
  await withApi(async ({ request, paths }) => {
    const post = await request("POST", "/api/posts", { title: "API Post", slug: "api-post", content: "<p>Hi</p>" });
    assert.equal(post.status, 201);
    const id = post.body["item"] && typeof post.body["item"] === "object"
      ? String((post.body["item"] as Record<string, unknown>)["id"])
      : "";
    assert.ok(id.startsWith("post-"));

    const listed = await request("GET", "/api/posts");
    assert.equal(listed.body["total"], 1);
    const single = await request("GET", `/api/posts/${id}`);
    assert.equal(single.status, 200);

    const updated = await request("PUT", `/api/posts/${id}`, { title: "Renamed", hash: post.body["hash"] });
    assert.equal(updated.status, 200);
    const stale = await request("PUT", `/api/posts/${id}`, { title: "Stale", hash: post.body["hash"] });
    assert.equal(stale.status, 409);
    assert.equal(stale.body["error"], "BLOGGER_CONTENT_STALE");

    const published = await request("POST", `/api/posts/${id}/publish`, {});
    assert.equal((published.body["item"] as Record<string, unknown>)["status"], "published");
    const trashed = await request("POST", `/api/posts/${id}/trash`, {});
    assert.ok((trashed.body["item"] as Record<string, unknown>)["trashedAt"]);
    const restored = await request("POST", `/api/posts/${id}/restore`, {});
    assert.equal((restored.body["item"] as Record<string, unknown>)["trashedAt"], null);

    const page = await request("POST", "/api/pages", { title: "API Page", slug: "api-page" });
    assert.equal(page.status, 201);
    assert.equal((await request("GET", "/api/pages")).body["total"], 1);

    const bulk = await request("POST", "/api/posts/bulk", { ids: [id], action: "unpublish" });
    assert.equal(bulk.body["succeeded"], 1);

    const removed = await request("DELETE", `/api/posts/${id}`);
    assert.equal(removed.status, 200);
    assert.equal((await request("GET", "/api/posts")).body["total"], 0);
    assert.equal((await fs.readdir(paths.backupDir)).length > 0, true);
  });
});

test("content API rejects invalid ids, actions and foreign origins", async () => {
  await withApi(async ({ request }) => {
    assert.equal((await request("GET", "/api/posts/..%2Fescape")).status, 400);
    assert.equal((await request("GET", "/api/posts/missing")).status, 404);
    assert.equal((await request("POST", "/api/posts/bulk", { ids: [], action: "explode" })).status, 400);
    const forbidden = await request("GET", "/api/content/status", undefined, {
      origin: "https://evil.example",
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await request("GET", "/api/unknown")).status, 404);
  });
});
