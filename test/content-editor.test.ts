import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";

import { buildSnapshot, loadContent } from "../src/content/settings.js";
import { defaultPage, defaultPost } from "../src/content/model.js";
import { createPageRepository } from "../src/content/pages.js";
import { createPostRepository } from "../src/content/posts.js";
import { contentEditorMarkup } from "../src/editor/content-editor/markup.js";
import { buildDashboardScreens } from "../src/preview/dashboard.js";
import { withContentRoot } from "./helpers/content.js";

async function snapshotWithContent(rootPaths: Parameters<typeof loadContent>[0]) {
  await createPostRepository(rootPaths).create(
    defaultPost({
      id: "post-live",
      title: "Live CMS post",
      slug: "live-cms-post",
      content: "<p>Live body</p>",
      status: "published",
      publishAt: "2026-11-21T10:00:00Z",
      publishedAt: "2026-11-21T10:00:00Z",
      labels: ["News"],
      author: "writer",
    })
  );
  await createPageRepository(rootPaths).create(
    defaultPage({
      id: "page-live",
      title: "Live CMS page",
      slug: "live-cms-page",
      content: "<p>About from JSON</p>",
      status: "published",
      publishAt: "2026-11-21T10:00:00Z",
      publishedAt: "2026-11-21T10:00:00Z",
    })
  );
  return loadContent(rootPaths);
}

const TEMPLATE = `<html><body><b:section id="main"></b:section></body></html>`;

function screens(snapshot: Awaited<ReturnType<typeof buildSnapshot>>, withContent = true) {
  return buildDashboardScreens(
    [{ title: "Home", route: "/", file: "index.html" }],
    TEMPLATE,
    "",
    { xml: TEMPLATE, entryPath: "src/template.xml", css: "", savePort: 3101 },
    "favicon.ico",
    withContent ? { snapshot, savePort: 3101 } : undefined
  );
}

function payload(html: string, id: string): Record<string, unknown> {
  const match = new RegExp(`<script type="application/json" id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`).exec(html);
  assert.ok(match);
  return JSON.parse((match[1] as string).replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&"));
}

test("dashboard uses live JSON content instead of mock rows", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await snapshotWithContent(paths);
    const built = screens(snapshot);
    const posts = built.find((screen) => screen.file === "dashboard-posts.html");
    const pages = built.find((screen) => screen.file === "dashboard-pages.html");
    const overview = built.find((screen) => screen.file === "dashboard.html");
    assert.ok(posts);
    assert.ok(pages);
    assert.ok(overview);
    assert.match(posts.html, /Live CMS post/);
    assert.match(posts.html, /http:\/\/localhost:3101/);
    assert.match(pages.html, /Live CMS page/);
    assert.match(overview.html, /Live file-based content workspace/);
    assert.equal(posts.html.includes("Getting started with Guchho"), false);
    assert.equal(pages.html.includes("About from JSON"), true);
    assert.equal(payload(posts.html, "content-dashboard-payload")["listUrl"], "/__preview/dashboard/posts/");
  });
});

test("default dashboard keeps its mock markup when no content service is supplied", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await snapshotWithContent(paths);
    const built = screens(snapshot, false);
    for (const screen of built) {
      assert.equal(screen.html.includes("data-guchho-content="), false, screen.file);
      assert.equal(screen.html.includes("content-dashboard-payload"), false, screen.file);
      assert.equal(screen.html.includes("content-editor-payload"), false, screen.file);
    }
    const posts = built.find((screen) => screen.file === "dashboard-posts.html");
    assert.ok(posts);
    assert.match(posts.html, /Getting started with Guchho/);
  });
});

test("content editor exposes fields, labels and safe payloads", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await snapshotWithContent(paths);
    const built = screens(snapshot);
    const editor = built.find((screen) => screen.file === "dashboard-post-new.html");
    assert.ok(editor);
    for (const marker of [
      'data-guchho-content="editor"',
      'id="content-editor-form"',
      'id="content-title"',
      'id="content-slug"',
      'id="content-body-source"',
      'id="content-body-preview"',
      'id="content-excerpt"',
      'id="content-author"',
      'id="content-featured"',
      'id="content-allow-comments"',
      'id="content-publish-at"',
      'data-content-label="News"',
      "http://localhost:3101",
    ]) {
      assert.ok(editor.html.includes(marker), `missing editor marker: ${marker}`);
    }
    const data = payload(editor.html, "content-editor-payload");
    assert.equal(data["kind"], "post");
    assert.equal(data["existing"], false);
    assert.deepEqual(data["labels"], ["News"]);
    const script = /<script data-guchho-content="script">([\s\S]*?)<\/script>/.exec(editor.html);
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script[1] as string));
    assert.match(script[1] as string, /beforeunload/);
    assert.match(script[1] as string, /BLOGGER_CONTENT_STALE/);
    assert.match(script[1] as string, /setInterval\(poll, 15000\)/);
  });
});

test("page editor omits post-only fields", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await snapshotWithContent(paths);
    const built = screens(snapshot);
    const editor = built.find((screen) => screen.file === "dashboard-page-new.html");
    assert.ok(editor);
    assert.match(editor.html, /Pages have no labels, author or comments/);
    assert.equal(editor.html.includes('id="content-excerpt"'), false);
    assert.equal(editor.html.includes('id="content-author"'), false);
    assert.equal(payload(editor.html, "content-editor-payload")["kind"], "page");
  });
});

test("editor markup escapes JSON and visible values", () => {
  const html = contentEditorMarkup({
    kind: "post",
    apiBase: "http://localhost:3001",
    item: defaultPost({ title: "</script><img onerror=x>", slug: "x", content: "<script>alert(1)</script><p>safe</p>" }),
    hash: null,
    existing: false,
    labels: [],
    authors: [],
    defaultAuthor: "admin",
    listUrl: "/__preview/dashboard/posts/",
  });
  assert.equal(html.includes("</script><img"), false);
  assert.match(html, /&lt;\/script&gt;&lt;img onerror=x&gt;/);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.match(html, /<p>safe<\/p>/);
});
