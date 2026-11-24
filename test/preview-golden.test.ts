import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// `formatDate` uses the host locale, so pin the timezone to keep snapshots
// portable across machines.
process.env.TZ = "UTC";

import { buildPreview } from "../src/preview/index.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html b:css='false' expr:class='data:blog.languageDirection' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><title><data:view.title.escaped/></title></head>
<body>
<b:defaultmarkups>
  <b:defaultmarkup type='Common'>
    <b:includable id='widget-title'>
      <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    </b:includable>
  </b:defaultmarkup>
</b:defaultmarkups>
<b:section class='header' id='header' name='Header'>
  <b:widget id='Header1' title='Guchho Blogger Preview' type='Header'>
    <b:includable id='main'>
      <h1 class='blog-title'><data:blog.title/></h1>
      <p class='blog-desc'><data:blog.metaDescription/></p>
    </b:includable>
  </b:widget>
</b:section>
<b:section class='main' id='main' name='Main'>
  <b:widget id='Blog1' title='Posts' type='Blog'>
    <b:includable id='main' var='this'>
      <b:include name='widget-title'/>
      <b:if cond='data:view.isSingleItem'>
        <b:include data='post' name='singlePost'/>
      <b:else/>
        <b:loop index='i' values='data:posts' var='post'>
          <b:include data='post' name='postSummary'/>
        </b:loop>
      </b:if>
    </b:includable>
    <b:includable id='postSummary' var='post'>
      <article class='post'>
        <h2 class='post-title'><a expr:href='data:post.url'><data:post.title/></a></h2>
        <p class='post-snippet'><data:post.snippets.short/></p>
        <ul class='post-labels'>
          <b:loop values='data:post.labels' var='label'>
            <li><a expr:href='data:label.url'><data:label.name/></a></li>
          </b:loop>
        </ul>
      </article>
    </b:includable>
    <b:includable id='singlePost' var='post'>
      <article class='post single'>
        <h1 class='post-title'><data:post.title/></h1>
        <span class='byline'><data:post.author.name/></span>
        <span class='date' expr:datetime='data:post.date.iso8601'><data:post.date/></span>
        <div class='post-body'><data:post.body/></div>
        <b:if cond='data:post.numberOfComments'>
          <a class='comments' expr:href='data:post.commentsUrl'><data:post.numberOfComments/> <data:messages.comments/></a>
        </b:if>
      </article>
    </b:includable>
  </b:widget>
</b:section>
<b:section class='sidebar' id='sidebar' name='Sidebar'>
  <b:widget id='Label1' title='Labels' type='Label'>
    <b:includable id='main'>
      <b:include name='widget-title'/>
      <ul class='label-list'>
        <b:loop values='data:labels' var='label'>
          <li><a expr:href='data:label.url'><data:label.name/></a> <span class='count'><data:label.count/></span></li>
        </b:loop>
      </ul>
    </b:includable>
  </b:widget>
</b:section>
<b:section class='footer' id='footer' name='Footer'>
  <b:widget id='Attribution1' type='Attribution'>
    <b:includable id='main'>
      <div class='attribution'><data:messages.poweredBy/></div>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;

const SNAPSHOT_DIR = join(process.cwd(), "test", "snapshots", "preview");
const update = process.env.UPDATE_SNAPSHOTS === "1";

test("preview scenarios match golden snapshots", () => {
  const result = buildPreview({ entryPath: "template.xml", xml: TEMPLATE, banner: false });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.pages.length >= 7);

  if (update) mkdirSync(SNAPSHOT_DIR, { recursive: true });

  for (const page of result.pages) {
    const file = join(SNAPSHOT_DIR, page.file);
    if (update || !existsSync(file)) {
      mkdirSync(SNAPSHOT_DIR, { recursive: true });
      writeFileSync(file, page.html, "utf8");
      continue;
    }
    const expected = readFileSync(file, "utf8");
    assert.equal(
      page.html,
      expected,
      `snapshot mismatch for ${page.file}; re-run with UPDATE_SNAPSHOTS=1`
    );
  }
});
