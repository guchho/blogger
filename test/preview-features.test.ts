import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";

import { previewRouteFile } from "../src/preview/routes.js";
import { previewFeedEntries } from "../src/preview/feeds.js";
import { buildPreview } from "../src/preview/index.js";
import { buildScenarios } from "../src/preview/data/pages.js";
import { applyMockData } from "../src/preview/data/mockData.js";
import { widgetDefaultMarkups } from "../src/preview/render/widgets.js";
import { parseXml } from "../src/xml/parser.js";
import { SourceFile } from "../src/xml/source.js";
import { renderTemplate } from "../src/preview/render/renderer.js";
import { BloggerDate, HtmlString, type ValueMap } from "../src/preview/values.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='Hero1' title='Hero' type='Hero'>
    <b:includable id='main'>
      <h1><data:title/></h1>
      <p class='subtitle'><data:subtitle/></p>
      <div class='hero-body'><data:body/></div>
    </b:includable>
  </b:widget>
  <b:widget id='Blog1' title='Posts' type='Blog'>
    <b:includable id='main'>
      <b:loop values='data:posts' var='post'>
        <h2 class='post-title'><data:post.title/></h2>
      </b:loop>
    </b:includable>
  </b:widget>
  <b:widget id='Mystery1' title='Mystery' type='Mystery'/>
</b:section>
</body>
</html>`;

test("previewRouteFile maps routes to output files safely", () => {
  assert.equal(previewRouteFile("/"), "index.html");
  assert.equal(previewRouteFile("/2026/01/post.html"), "2026/01/post.html");
  assert.equal(previewRouteFile("/search/label/Templates/"), "search/label/Templates/index.html");
  assert.equal(previewRouteFile("/404.html"), "404.html");
  assert.equal(previewRouteFile("/search?q=guchho"), "search/index.html");

  assert.throws(() => previewRouteFile("/../escape"), /escapes/);
  assert.throws(() => previewRouteFile("https://example.com"), /absolute/);
  assert.throws(() => previewRouteFile("//example.com/post"), /absolute/);
});

test("buildPreview applies mockData and custom widget data", () => {
  const result = buildPreview({
    entryPath: "features.xml",
    xml: TEMPLATE,
    banner: false,
    mockData: {
      blog: { title: "Overridden blog" },
      post: { title: "Overridden post" },
    },
    widgets: {
      Hero: {
        markup:
          "<b:includable id='main'><h1><data:title/></h1>" +
          "<p class='subtitle'><data:subtitle/></p>" +
          "<div class='hero-body'><data:body/></div></b:includable>",
        data: {
          subtitle: "Custom subtitle",
          body: { __html: "<strong>Trusted custom body</strong>" },
        },
      },
      Mystery: "<b:includable id='main'><p class='mystery'>Solved</p></b:includable>",
    },
  });

  const post = result.pages.find((page) => page.file === "post.html");
  assert.ok(post);
  assert.equal(post.route, "/2026/01/getting-started-with-guchho.html");
  assert.match(post.html, /<h1>Hero<\/h1>/);
  assert.match(post.html, /Custom subtitle/);
  assert.match(post.html, /<strong>Trusted custom body<\/strong>/);
  assert.match(post.html, /Overridden post/);

  const widgets = result.pages.find((page) => page.file === "widgets.html");
  assert.ok(widgets);
  assert.match(widgets.html, /class="mystery">Solved/);
  assert.match(widgets.html, /Custom subtitle/);
});

test("unknown widget types fall back with one diagnostic", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='Mystery1' title='Mystery' type='Mystery'/>
</b:section>
</body>
</html>`;
  const result = buildPreview({
    entryPath: "unknown.xml",
    xml,
    banner: false,
  });

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.code, "BLOGGER_PREVIEW_UNKNOWN_WIDGET");
});

test("messages preserve trusted HTML services while escaping params", () => {
  const template = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='Blog1' type='Blog'>
    <b:includable id='main'>
      <b:message name='messages.authorSaidWithLink'>
        <b:param name='authorName' value='&lt;Ada&gt;'/>
        <b:param name='authorUrl' value='https://example.com/?a=1&amp;b=2'/>
      </b:message>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;
  const document = parseXml(new SourceFile("messages.xml", template));
  const scenarios = buildScenarios();
  const scenario = scenarios.find((item) => item.type === "post");
  assert.ok(scenario);
  const result = renderTemplate(document, scenario.data as ValueMap, {});
  assert.match(result.html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  assert.match(result.html, /&lt;Ada&gt;/);
});

test("TemplateRenderer exposes registry-aware rendering for embedders", () => {
  const document = parseXml(new SourceFile("reuse.xml", TEMPLATE));
  const registry = {
    markups: new Map(),
    data: new Map(),
  };
  const result = renderTemplate(document, buildScenarios()[0]!.data, {
    report() {},
  }, registry);
  assert.match(result.html, /class="widget Hero"/);
});


test("mockData deep-merges maps and replaces arrays", () => {
  const base = {
    blog: { title: "Base", language: "en" },
    posts: ["a", "b"],
  } as const;
  const output = applyMockData(base as unknown as ValueMap, {
    blog: { title: "Override" },
    posts: ["c"],
  });

  assert.deepEqual(output["blog"], { title: "Override", language: "en" });
  assert.deepEqual(output["posts"], ["c"]);
  assert.deepEqual(base.posts, ["a", "b"]);
});


test("every built-in widget markup renders without preview diagnostics", () => {
  const types = [...widgetDefaultMarkups().markups.keys()];
  const widgets = types
    .map(
      (type, index) =>
        `<b:widget id='W${index}' type='${type}' title='${type}'/>`
    )
    .join("");
  const xml =
    "<html xmlns:b='http://www.google.com/2005/gml/b' " +
    "xmlns:data='http://www.google.com/2005/gml/data' " +
    "xmlns:expr='http://www.google.com/2005/gml/expr'>" +
    `<body><b:section id='main'>${widgets}</b:section></body></html>`;

  const result = buildPreview({ entryPath: "all-widgets.xml", xml, banner: false });
  assert.deepEqual(result.diagnostics, []);
  const showcase = result.pages.find((page) => page.file === "widgets.html");
  assert.ok(showcase);
  for (const type of types) {
    assert.match(showcase.html, new RegExp(`class="widget ${type}"`));
  }
  assert.match(showcase.html, /data-guchho-preview="widget-showcase"/);
  assert.match(showcase.html, /data-widget-search/);
  assert.match(showcase.html, /data-widget-filter="All"/);
  assert.match(showcase.html, /class="widget-card"/);
  assert.match(showcase.html, /Widget library/);
  const scriptMatch = /<script data-guchho-preview="widget-showcase-script">([\s\S]*?)<\/script>/.exec(
    showcase.html
  );
  assert.ok(scriptMatch);
  const script = (scriptMatch[1] as string).replace(/^<!\[CDATA\[|\]\]>$/g, "");
  assert.doesNotThrow(() => new Script(script));
});

test("preview pages answer Blogger JSONP feed requests", () => {
  const result = buildPreview({ entryPath: "feeds.xml", xml: TEMPLATE });
  const index = result.pages.find((page) => page.file === "index.html");
  assert.ok(index);
  assert.match(index.html, /data-guchho-preview="feeds"/);
  assert.match(index.html, /__guchhoPreviewFeeds/);
  assert.match(index.html, /"term":"Templates"/);
  assert.match(index.html, /openSearch\$totalResults/);
});

test("feed entries mirror mock post metadata", () => {
  const entries = previewFeedEntries([
    {
      id: "42",
      title: "A post",
      url: "http://localhost:3000/2026/01/a-post.html",
      body: new HtmlString("<p>Body</p>"),
      snippet: "Snippet",
      labels: [{ name: "Templates" }],
      author: { name: "Ada", profileUrl: "http://localhost:3000/p/about.html" },
      thumbnailUrl: "http://localhost:3000/thumb.png",
      date: new BloggerDate("2026-01-01T12:00:00.000Z"),
    },
  ]);
  assert.equal(entries.length, 1);
  assert.equal((entries[0]?.["title"] as { $t: string }).$t, "A post");
  assert.deepEqual(entries[0]?.["category"], [{ term: "Templates" }]);
  assert.equal(
    (entries[0]?.["published"] as { $t: string }).$t,
    "2026-01-01T12:00:00.000+00:00"
  );
});

test("preview images are self-contained and fall back when unavailable", () => {
  const scenarios = buildScenarios();
  const index = scenarios.find((scenario) => scenario.file === "index.html");
  const post = index?.data["posts"];
  assert.ok(Array.isArray(post));
  const first = post[0];
  assert.ok(first && typeof first === "object");
  assert.match(String((first as ValueMap)["featuredImage"]), /^data:image\/svg\+xml;base64,/);

  const imageTemplate =
    '<?xml version="1.0" encoding="UTF-8" ?>\n' +
    "<html><body>" +
    '<img class="broken" src="https://invalid.example/missing.png"/>' +
    '<img class="inline" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="/>' +
    "</body></html>";
  const result = buildPreview({
    entryPath: "images.xml",
    xml: imageTemplate,
    banner: false,
    dashboard: false,
  });
  const page = result.pages.find(({ file }) => file === "index.html");
  assert.ok(page);
  assert.match(
    page.html,
    /<img class="broken" src="https:\/\/invalid\.example\/missing\.png" onerror="this\.onerror=null;this\.src='data:image\/svg\+xml;base64,[^']+'"/,
  );
  assert.doesNotMatch(page.html, /class="inline"[^>]*onerror/);
});

test("b:else image supplies the fallback for a featured image", () => {
  const template =
    '<?xml version="1.0" encoding="UTF-8" ?>\n' +
    "<html xmlns:b='http://www.google.com/2005/gml/b' " +
    "xmlns:data='http://www.google.com/2005/gml/data' " +
    "xmlns:expr='http://www.google.com/2005/gml/expr'><body>" +
    "<b:section id='main'><b:widget id='Blog1' type='Blog'>" +
    "<b:includable id='main'><b:loop values='data:posts' var='post'>" +
    "<b:if cond='data:post.featuredImage'>" +
    "<img class='featured' expr:src='data:post.featuredImage resizeImage 280'/>" +
    "<b:else/>" +
    "<img class='default' src='https://example.com/default.png'/>" +
    "</b:if></b:loop></b:includable></b:widget></b:section>" +
    "</body></html>";
  const result = buildPreview({
    entryPath: "featured.xml",
    xml: template,
    banner: false,
    dashboard: false,
    mockData: { posts: [{ featuredImage: "https://example.com/missing.png" }] },
  });
  const page = result.pages.find(({ file }) => file === "index.html");
  assert.ok(page);
  assert.match(
    page.html,
    /class="featured"[^>]*onerror="this\.onerror=null;this\.src='https:\/\/example\.com\/default\.png'"/
  );
  assert.doesNotMatch(page.html, /class="default"/);
});

test("preview emits a single well-formed doctype and keeps head scripts", () => {
  const xml =
    '<?xml version="1.0" encoding="UTF-8" ?>\n<!DOCTYPE html>\n' +
    "<html xmlns:b='http://www.google.com/2005/gml/b' " +
    "xmlns:data='http://www.google.com/2005/gml/data' " +
    "xmlns:expr='http://www.google.com/2005/gml/expr'>" +
    "<head><title>Doctype</title></head><body><p>ok</p></body></html>";
  const result = buildPreview({ entryPath: "doctype.xml", xml });
  const index = result.pages.find((page) => page.file === "index.html");
  assert.ok(index);
  assert.equal(index.html.match(/<!doctype/gi)?.length, 1);
  assert.match(index.html, /<!DOCTYPE html>/);
  assert.doesNotMatch(index.html, /<!DOCTYPE <!DOCTYPE/);
  assert.match(index.html, /<head><script data-guchho-preview="feeds">/);
});

test("preview decodes XML entities in style and script text", () => {
  const xml = TEMPLATE.replace(
    "<body>",
    `<head><style>.icon:after{content:&quot;\\f107&quot;}</style><script>const s=&quot;x&quot;;</script></head><body>`
  );
  const result = buildPreview({ entryPath: "raw-text.xml", xml, banner: false });
  const index = result.pages.find((page) => page.file === "index.html");
  assert.ok(index);
  assert.match(index.html, /content:"\\f107"/);
  assert.match(index.html, /const s="x";/);
  assert.doesNotMatch(index.html, /&quot;\\f107&quot;/);
});
