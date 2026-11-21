import assert from "node:assert/strict";
import test from "node:test";

import { buildContentScenarios } from "../src/content/scenarios.js";
import { loadContent } from "../src/content/settings.js";
import { createPageRepository } from "../src/content/pages.js";
import { createPostRepository } from "../src/content/posts.js";
import { buildPreview } from "../src/preview/index.js";
import { withContentRoot } from "./helpers/content.js";

const TEMPLATE = `<html><body>
<b:section id='main'>
<b:widget id='Blog1' type='Blog'>
<b:includable id='main'>
<h1><data:blog.title/></h1>
<b:loop values='data:posts' var='post'>
<article class='post'>
<h2><data:post.title/></h2>
<div class='body'><data:post.body/></div>
<span class='author'><data:post.author.name/></span>
<b:loop values='data:post.labels' var='label'><span class='label'><data:label.name/></span></b:loop>
</article>
</b:loop>
<b:if cond='data:view.isPage'>
<article class='page'><h2><data:page.title/></h2><div class='body'><data:page.body/></div></article>
</b:if>
</b:includable>
</b:widget>
</b:section>
</body></html>`;

async function seed(paths: Parameters<typeof loadContent>[0]) {
  const posts = createPostRepository(paths);
  const pages = createPageRepository(paths);
  await posts.create({
    id: "post-hello",
    title: "Real CMS Post",
    slug: "real-cms-post",
    content: '<p class="lead">Real body content</p><script>alert(1)</script>',
    status: "published",
    publishAt: "2026-11-21T10:00:00Z",
    publishedAt: "2026-11-21T10:00:00Z",
    labels: ["Templates"],
    author: "admin",
  });
  await pages.create({
    id: "page-about",
    title: "Real About Page",
    slug: "real-about",
    content: "<p>About from JSON</p>",
    status: "published",
    publishAt: "2026-11-21T10:00:00Z",
  });
  return loadContent(paths);
}

test("CMS content renders through the Blogger template", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await seed(paths);
    const result = buildPreview({
      entryPath: "template.xml",
      xml: TEMPLATE,
      banner: false,
      dashboard: false,
      content: snapshot,
      contentOptions: { baseUrl: "https://example.com/", sanitize: true },
    });
    const home = result.pages.find((page) => page.route === "/");
    assert.ok(home);
    assert.match(home.html, /Real CMS Post/);
    assert.match(home.html, /Real body content/);
    assert.match(home.html, /Templates/);
    assert.equal(home.html.includes("deterministic mock posts"), false);
    assert.equal(home.html.includes("alert(1)"), false);

    const post = result.pages.find((page) => page.route === "/2026/11/real-cms-post.html");
    const page = result.pages.find((page) => page.route === "/p/real-about.html");
    assert.ok(post);
    assert.ok(page);
    assert.match(post.html, /Real CMS Post/);
    assert.match(page.html, /About from JSON/);
  });
});

test("content scenarios include labels, archives, search and 404", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await seed(paths);
    const scenarios = buildContentScenarios(snapshot, { baseUrl: "https://example.com/" });
    const routes = scenarios.map((scenario) => scenario.route);
    assert.ok(routes.includes("/"));
    assert.ok(routes.includes("/2026/11/real-cms-post.html"));
    assert.ok(routes.includes("/p/real-about.html"));
    assert.ok(routes.includes("/search/label/Templates/"));
    assert.ok(routes.includes("/2026/11/"));
    assert.ok(routes.includes("/search/"));
    assert.ok(routes.includes("/404.html"));
  });
});
