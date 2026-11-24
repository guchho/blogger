import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";

import { PREVIEW_DASHBOARD_ROUTE } from "../src/preview/dashboard.js";
import { PREVIEW_FAVICON } from "../src/preview/data/metadata.js";
import { buildPreview } from "../src/preview/index.js";
import type { PreviewBuildOptions } from "../src/preview/index.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='Blog1' type='Blog' title='Posts' visible='true'>
    <b:includable id='main' var='this'><data:post.title/></b:includable>
  </b:widget>
</b:section>
</body></html>`;

const EXAMPLE_TEMPLATE = readFileSync(
  new URL("../examples/src/template.xml", import.meta.url),
  "utf8"
);
const NORMALIZED_EDITOR_CSS = readFileSync(
  new URL("../src/preview/layout-editor/editor.css", import.meta.url),
  "utf8"
).replace(/\s+/g, "");

function assetSource(result: ReturnType<typeof buildPreview>, file: string): string {
  const asset = result.assets.find((item) => item.file === file);
  assert.ok(asset, `missing asset: ${file}`);
  return asset.source;
}

interface StructureTestNode {
  id?: string;
  sectionId?: string;
  children: StructureTestNode[];
}

function findStructureNode(
  nodes: StructureTestNode[],
  id: string
): StructureTestNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findStructureNode(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

const SCREENS = [
  ["dashboard.html", "overview", "Dashboard"],
  ["dashboard-posts.html", "posts", "Posts"],
  ["dashboard-post-new.html", "post-new", "New post"],
  ["dashboard-pages.html", "pages", "Pages"],
  ["dashboard-page-new.html", "page-new", "New page"],
  ["dashboard-comments.html", "comments", "Comments"],
  ["dashboard-layout.html", "layout", "Layout"],
  ["dashboard-theme.html", "theme", "Theme"],
  ["dashboard-settings.html", "settings", "Settings"],
] as const;

function build(options: Partial<PreviewBuildOptions> = {}) {
  return buildPreview({ entryPath: "dashboard-test.xml", xml: TEMPLATE, ...options });
}

test("banner includes an escaped dashboard button by default", () => {
  const result = build();
  const home = result.pages.find((item) => item.file === "index.html");
  assert.ok(home);
  assert.match(home.html, /data-guchho-preview="banner"/);
  assert.ok(home.html.includes("Mock preview — Sample content, not a live Blogger page."));
  assert.match(home.html, /data-guchho-preview="dashboard-button"/);
  assert.match(home.html, /role="button"/);
  assert.ok(home.html.includes("Open dashboard"));
  assert.ok(home.html.includes(`href="${PREVIEW_DASHBOARD_ROUTE}"`));
  assert.ok(home.html.includes('target="_blank"'));
  assert.ok(home.html.includes('rel="noopener"'));
  assert.equal(result.diagnostics.length, 0);
});

test("all nine Blogger-like admin screens are generated", () => {
  const result = build();
  assert.equal(result.pages.length, 17);
  for (const [file, key, title] of SCREENS) {
    const screen = result.pages.find((item) => item.file === file);
    assert.ok(screen, `missing screen: ${file}`);
    assert.equal(screen.title, title);
    assert.ok(screen.html.includes('data-guchho-preview="dashboard-screen"'));
    assert.ok(screen.html.includes(`data-screen="${key}"`));
    assert.equal(screen.html.includes('data-guchho-preview="banner"'), false);
    assert.equal(screen.html.includes('data-guchho-preview="dashboard-button"'), false);
    assert.ok(screen.html.includes('class="nav-item active"'), `${key} has no active nav item`);
    assert.ok(screen.html.includes('aria-current="page"'), `${key} has no current page`);
  }
});

test("dashboard uses the Guchho favicon URL by default", () => {
  const result = build();
  for (const [file] of SCREENS) {
    const screen = result.pages.find((item) => item.file === file);
    assert.ok(screen, `missing screen: ${file}`);
    assert.ok(
      screen.html.includes(`<link rel="icon" href="${PREVIEW_FAVICON}">`),
      `${file} has no default favicon link`
    );
  }
  const settings = result.pages.find(
    (item) => item.file === "dashboard-settings.html"
  );
  assert.ok(settings);
  assert.ok(settings.html.includes("Favicon"));
  assert.ok(
    settings.html.includes(`<img src="${PREVIEW_FAVICON}" alt="">`),
    "settings has no favicon preview"
  );
  assert.ok(settings.html.includes(`<span>${PREVIEW_FAVICON}</span>`));
  assert.ok(settings.html.includes("Favicon URL"));
  assert.ok(settings.html.includes('id="settings-favicon"'));
  assert.ok(settings.html.includes('id="settings-title"'));
  assert.ok(settings.html.includes('id="settings-description"'));
  assert.ok(settings.html.includes('data-guchho-preview="settings-save"'));
  assert.ok(settings.html.includes('data-guchho-preview="settings-script"'));
  assert.ok(settings.html.includes("Live preview"));
  assert.ok(settings.html.includes("More options"));
});

test("favicon option flows into preview data and dashboard", () => {
  const faviconTemplate = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body><a expr:href='data:blog.blogspotFaviconUrl'>icon</a></body></html>`;
  const result = buildPreview({
    entryPath: "favicon-test.xml",
    xml: faviconTemplate,
    favicon: "brand.png",
    scenarios: [
      {
        type: "index",
        file: "favicon.html",
        route: "/favicon",
        title: "Favicon",
        data: {},
      },
    ],
  });
  const page = result.pages.find((item) => item.file === "favicon.html");
  assert.ok(page);
  assert.ok(page.html.includes('href="brand.png"'));
  const settings = result.pages.find(
    (item) => item.file === "dashboard-settings.html"
  );
  assert.ok(settings);
  assert.ok(settings.html.includes('<link rel="icon" href="/brand.png">'));
  assert.ok(settings.html.includes("<span>brand.png</span>"));
});

test("settings editor script is valid JavaScript and scoped to settings", () => {
  const result = build();
  const settings = result.pages.find((item) => item.file === "dashboard-settings.html");
  assert.ok(settings);
  const match = /<script data-guchho-preview="settings-script">([\s\S]*?)<\/script>/.exec(
    settings.html
  );
  assert.ok(match);
  assert.doesNotThrow(() => new Script(match[1] as string));
  const overview = result.pages.find((item) => item.file === "dashboard.html");
  assert.ok(overview);
  assert.equal(overview.html.includes("settings-script"), false);
});

test("overview links to every preview scenario", () => {
  const result = build();
  const overview = result.pages.find((item) => item.file === "dashboard.html");
  assert.ok(overview);
  assert.equal(overview.route, PREVIEW_DASHBOARD_ROUTE);

  for (const item of result.pages) {
    if (item.file.startsWith("dashboard")) continue;
    assert.ok(overview.html.includes(item.title), `missing title: ${item.title}`);
    assert.ok(
      overview.html.includes(`href="${item.route}"`),
      `missing route: ${item.route}`
    );
  }
});

test("every sidebar admin link resolves to a generated route", () => {
  const result = build();
  const routes = new Set(result.pages.map((item) => item.route));
  const screen = result.pages.find((item) => item.file === "dashboard-settings.html");
  assert.ok(screen);
  const links = [...screen.html.matchAll(/href="(\/__preview\/dashboard\/[^"]*)"/g)].map(
    (match) => match[1]
  );
  assert.ok(links.length >= 7);
  for (const link of links) {
    assert.ok(routes.has(link as string), `unresolved admin route: ${link}`);
  }
});

test("dashboard has a hamburger toggle and icons on every nav item", () => {
  const result = build();
  const screen = result.pages.find((item) => item.file === "dashboard.html");
  assert.ok(screen);
  for (const marker of [
    'data-guchho-preview="nav-toggle"',
    'aria-label="Toggle sidebar"',
    'aria-controls="dashboard-sidebar"',
    '<aside class="sidebar" id="dashboard-sidebar">',
    'data-guchho-preview="nav-backdrop"',
    'data-guchho-preview="nav-script"',
    'viewBox="0 0 24 24"',
  ]) {
    assert.ok(screen.html.includes(marker), `missing marker: ${marker}`);
  }
  assert.ok(screen.html.includes('data-guchho-preview="kpis"'), "kpi grid missing");
  assert.ok(screen.html.includes('data-guchho-preview="recent"'), "recent panel missing");
  const items = [...screen.html.matchAll(/<a class="nav-item[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(items.length >= 9);
  for (const item of items) {
    assert.match(item[1] as string, /^<span class="nav-icon"/);
  }
  const match = /<script data-guchho-preview="nav-script">([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(match);
  assert.doesNotThrow(() => new Script(match[1] as string));
});

test("content screens use deterministic mock data", () => {
  const result = build();
  const content: Record<string, string[]> = {
    "dashboard-posts.html": ["Getting started with Guchho", "New post", "Published", "Draft"],
    "dashboard-pages.html": ["About", "New page", "Published"],
    "dashboard-comments.html": ["Reader One", "View post", "Approve"],
    "dashboard-layout.html": ["Guchho Blogger Preview", "Posts", "Add a Gadget", "layout-editor-save"],
    "dashboard-theme.html": ["Backup", "Edit HTML", "&lt;b:section"],
    "dashboard-settings.html": ["Guchho Blogger Preview", "Blog address", "Comments"],
    "dashboard-post-new.html": ['placeholder="Title"', "Labels", "Publish"],
    "dashboard-page-new.html": ['placeholder="Title"', "Page options", "Publish"],
  };
  for (const [file, expected] of Object.entries(content)) {
    const screen = result.pages.find((item) => item.file === file);
    assert.ok(screen, `missing screen: ${file}`);
    for (const text of expected) {
      assert.ok(screen.html.includes(text), `${file} missing: ${text}`);
    }
  }
});

test("comments studio offers search, status tabs, bulk moderation and scoped scripting", () => {
  const result = build();
  const screen = result.pages.find((item) => item.file === "dashboard-comments.html");
  assert.ok(screen);
  for (const marker of [
    'data-guchho-preview="comments-studio"',
    'data-comment-search',
    'data-comment-select-all',
    'data-comment-delete-selected',
    'data-comment-tab="all"',
    'data-comment-tab="awaiting"',
    'data-comment-row',
    "Comments studio",
    "Moderation queue",
    "Delete selected",
    "Export CSV",
  ]) {
    assert.ok(screen.html.includes(marker), `missing marker: ${marker}`);
  }
  const match = /<script data-guchho-preview="comments-script">([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(match);
  assert.doesNotThrow(() => new Script(match[1] as string));
  assert.equal(screen.html.includes('data-guchho-preview="theme-script"'), false);
});

test("dashboard: false removes the button and every admin screen", () => {
  const result = build({ dashboard: false });
  assert.equal(result.pages.some((item) => item.file.startsWith("dashboard")), false);
  const home = result.pages.find((item) => item.file === "index.html");
  assert.ok(home);
  assert.equal(home.html.includes("dashboard-button"), false);
});

test("a custom dashboard URL overrides the button target", () => {
  const custom = '/custom/"dashboard"?from=preview&tab=posts';
  const result = build({ dashboard: custom });
  assert.equal(result.pages.some((item) => item.file.startsWith("dashboard")), false);
  const home = result.pages.find((item) => item.file === "index.html");
  assert.ok(home);
  assert.ok(home.html.includes('href="/custom/&quot;dashboard&quot;?from=preview&amp;tab=posts"'));
  assert.equal(home.html.includes('href="/__preview/dashboard/"'), false);
});

test("banner: false suppresses the button but keeps admin screens", () => {
  const result = build({ banner: false });
  assert.equal(result.pages.filter((item) => item.file.startsWith("dashboard")).length, 9);
  const home = result.pages.find((item) => item.file === "index.html");
  assert.ok(home);
  assert.equal(home.html.includes("dashboard-button"), false);
  assert.equal(home.html.includes('data-guchho-preview="banner"'), false);
});

const CSS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><style>.from-style{color:red}</style></head>
<body>
<b:skin><![CDATA[.from-skin{content:"quoted" & more}]]></b:skin>
<b:section id='main'></b:section>
</body></html>`;

test("Layout renders a real editor from template.xml without a blog preview", () => {
  const result = buildPreview({
    entryPath: "css-template.xml",
    xml: CSS_TEMPLATE,
    layoutXml: CSS_TEMPLATE,
    layoutSavePort: 3001,
  });
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(
    result.assets.map((asset) => asset.file),
    ["layout/skin.css", "layout/template-skin.css"]
  );
  assert.match(assetSource(result, "layout/skin.css"), /\.from-skin\{content:"quoted" & more\}/);
  assert.equal(assetSource(result, "layout/template-skin.css").trim(), "");
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  for (const marker of [
    'data-guchho-preview="layout-canvas"',
    'data-guchho-preview="layout-payload"',
    'data-guchho-preview="layout-editor-script"',
    'data-guchho-preview="layout-save"',
    'data-guchho-preview="layout-reset"',
    'data-guchho-preview="layout-status"',
    'data-guchho-preview="layout-dialog"',
    "layout-editor-shadow-host",
    "http://localhost:3001/api/layout/save",
    ".from-style{color:red}",
    "css-template.xml",
    "le-gadget-dialog",
    "le-blog-posts-dialog",
    "Show this widget",
    "Number of posts on the main page",
    "Post page link text",
    "Show date header",
    "Post Information",
    "Show author",
    "Author prefix",
    "Show publish time",
    "Publish time prefix",
    "Date format",
    "Engagement",
    "Show comment count",
    "Comment link text",
    "Show labels with prefix",
    "Email post link",
    "Share buttons",
    "Show location",
    "Show author profile",
    "Arrange Items",
    "Date Header",
    "Post Title",
    "Post Body",
    "Comments",
    "Email Post Link",
    "Labels",
    "Location",
    "Author Profile",
    "le-widget-dialog",
    "le-widget-image-url",
    "Image URL",
    "le-section-dialog",
    "layout-editor-head",
    "layout-editor-eyebrow",
    "layout-editor-summary",
    'data-state="saved"',
    "body#layout.blogger-layout-page",
    "layout-widget-state",
    "layout-title",
    "dropregion_v",
  ]) {
    assert.ok(screen.html.includes(marker), `missing editor marker: ${marker}`);
  }
  assert.equal(screen.html.includes("Page structure"), false);
  assert.equal(screen.html.includes("layout-preview"), false);
  assert.equal(screen.html.includes("<iframe"), false);
  assert.equal(screen.html.includes("srcdoc="), false);
  assert.equal(screen.html.includes("Mock preview —"), false);
  assert.equal(screen.html.includes('data-guchho-preview="base-style"'), false);
});

test("Layout editor client script is valid JavaScript", () => {
  const result = buildPreview({
    entryPath: "script-template.xml",
    xml: TEMPLATE,
    layoutXml: TEMPLATE,
  });
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  const match = /<script data-guchho-preview="layout-editor-script">([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(match);
  assert.doesNotThrow(() => new Script(match[1] as string));
});

const NESTED_LAYOUT = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><b:template-skin><![CDATA[body#layout #main-wrapper{width:66%}]]></b:template-skin></head>
<body>
<div id='content-wrapper' class='row'>
  <div id='main-wrapper'>
    <b:section id='main' name='Main'>
      <b:widget id='Blog1' type='Blog' title='Posts'>
        <b:includable id='main'><div class='post-title'><data:blog.title/></div></b:includable>
      </b:widget>
    </b:section>
  </div>
</div>
</body></html>`;

test("Layout payload carries nested structure for the Blogger layout renderer", () => {
  const result = buildPreview({
    entryPath: "nested-layout.xml",
    xml: NESTED_LAYOUT,
    layoutXml: NESTED_LAYOUT,
    banner: false,
  });
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  const match = /<script type="application\/json" id="layout-editor-payload"[^>]*>([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(match);
  const payload = JSON.parse(match[1] as string);
  const structure = payload.model.structure;
  assert.equal(structure[0].id, "content-wrapper");
  assert.equal(structure[0].children[0].id, "main-wrapper");
  assert.equal(structure[0].children[0].children[0].sectionId, "main");
  assert.equal("content" in payload.model.sections[0].widgets[0], false);
  assert.match(screen.html, /page\.id = 'layout'/);
  assert.match(screen.html, /page\.className = 'blogger-layout-page'/);
  assert.match(assetSource(result, "layout/template-skin.css"), /body#layout #main-wrapper\{width:66%\}/);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-page#content-wrapper/);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-page\.le-wrapper\{display:block!important;float:none!important/);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-pagediv\.le-section\{position:relative;display:block!important;float:none!important/);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-page\.le-widget\{position:relative;display:block!important/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.widget-content\.visibility\{display:flex!important;align-items:center;flex-wrap:nowrap/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.widget-content\{display:flex;flex-direction:column\}/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.le-section-count/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.le-widget-row/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.le-grip/);
  assert.match(screen.html, /data-label="/);
  assert.match(NORMALIZED_EDITOR_CSS, /#content-wrapper>\.container>#main-wrapper\{flex:21460px!important/);
  assert.equal(screen.html.includes("Page structure"), false);
});

test("real example layout preserves Blogger wrapper positions and visibility", () => {
  const result = buildPreview({
    entryPath: "examples/src/template.xml",
    xml: EXAMPLE_TEMPLATE,
    layoutXml: EXAMPLE_TEMPLATE,
    banner: false,
  });
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  const match = /<script type="application\/json" id="layout-editor-payload"[^>]*>([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(match);
  const payload = JSON.parse(match[1] as string) as { model: { structure: StructureTestNode[]; sections: unknown[] } };
  const structure = payload.model.structure;
  assert.ok(findStructureNode(structure, "outer-wrapper"));
  assert.ok(findStructureNode(structure, "content-wrapper"));
  assert.ok(findStructureNode(structure, "main-wrapper"));
  assert.ok(findStructureNode(structure, "sidebar-wrapper"));
  assert.ok(findStructureNode(structure, "footer-wrapper"));
  assert.ok(payload.model.sections.length > 4);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-page\.hidden-widgets\{display:block!important/);
  assert.equal(screen.html.includes("Page structure"), false);
  assert.equal(screen.html.includes("https://www.blogger.com/static/v1/layouts/"), false);
});

test("Layout editor chrome is applied after template CSS", () => {
  const result = buildPreview({
    entryPath: "chrome-template.xml",
    xml: TEMPLATE,
    layoutXml: TEMPLATE,
  });
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  assert.match(
    screen.html,
    /style\.textContent = \(model\.css\.style \|\| ''\) \+ '\\n' \+ "body#layout\.blogger-layout-page/
  );
  assert.ok(screen.html.includes("skin.href = '/__preview/layout/skin.css'"));
  assert.ok(screen.html.includes("templateSkin.href = '/__preview/layout/template-skin.css'"));
  assert.equal(screen.html.includes("function editorCss()"), false);
  const skinAppend = screen.html.indexOf("shadow.appendChild(skin)");
  const templateSkinAppend = screen.html.indexOf("shadow.appendChild(templateSkin)");
  const styleAppend = screen.html.indexOf("shadow.appendChild(style)");
  assert.ok(skinAppend >= 0 && skinAppend < templateSkinAppend);
  assert.ok(templateSkinAppend < styleAppend);
  assert.match(NORMALIZED_EDITOR_CSS, /body#layout\.blogger-layout-pagediv\.le-section/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.layout-widget-state\.visible\{/);
  assert.match(NORMALIZED_EDITOR_CSS, /\.layout-widget-statesvg\{/);
  assert.match(screen.html, /icon\(widget\.visible !== false \? 'eye' : 'eye-off'\)/);
});

test("Theme shows decoded, escaped template base style", () => {
  const result = buildPreview({ entryPath: "css-template.xml", xml: CSS_TEMPLATE });
  const screen = result.pages.find((item) => item.file === "dashboard-theme.html");
  assert.ok(screen);
  assert.ok(screen.html.includes('data-guchho-preview="base-style"'));
  assert.ok(screen.html.includes("Base style (template.xml)"));
  assert.ok(screen.html.includes(".from-style{color:red}"));
  assert.ok(screen.html.includes(".from-skin{content:&quot;quoted&quot; &amp; more}"));
  assert.equal(screen.html.includes("No base style found"), false);
});

test("Theme base style panel has a deterministic fallback when there is no CSS", () => {
  const result = build();
  const screen = result.pages.find((item) => item.file === "dashboard-theme.html");
  assert.ok(screen);
  assert.ok(screen.html.includes("No base style found in template.xml."));
});

test("Theme base style panel truncates long CSS and reports the total length", () => {
  const longCss = `.long{content:"${"x".repeat(12010)}"}`;
  const result = buildPreview({
    entryPath: "long-css.xml",
    xml: TEMPLATE.replace("<body>", `<head><style>${longCss}</style></head><body>`),
  });
  const screen = result.pages.find((item) => item.file === "dashboard-theme.html");
  assert.ok(screen);
  assert.match(screen.html, /Showing first 12000 of \d+ characters\./);
  assert.equal(screen.html.includes("No base style found"), false);
});

test("Theme studio offers source tabs, search, copy and scoped scripting", () => {
  const result = build();
  const screen = result.pages.find((item) => item.file === "dashboard-theme.html");
  assert.ok(screen);
  assert.ok(screen.html.includes('data-guchho-preview="theme-studio"'));
  assert.ok(screen.html.includes('data-theme-tab="xml"'));
  assert.ok(screen.html.includes('data-theme-tab="style"'));
  assert.ok(screen.html.includes("data-theme-search"));
  assert.ok(screen.html.includes("data-theme-copy"));
  assert.ok(screen.html.includes('data-theme-panel="style"'));
  assert.ok(screen.html.includes("Theme studio"));
  assert.ok(screen.html.includes("Quick actions"));
  assert.ok(screen.html.includes('href="/__preview/widgets/"'));
  const scriptMatch = /<script data-guchho-preview="theme-script">([\s\S]*?)<\/script>/.exec(
    screen.html
  );
  assert.ok(scriptMatch);
  assert.doesNotThrow(() => new Script(scriptMatch[1] as string));
  const overview = result.pages.find((item) => item.file === "dashboard.html");
  assert.ok(overview);
  assert.equal(overview.html.includes("theme-script"), false);
});

test("Layout editor still renders its template sections with no preview scenarios", () => {
  const result = buildPreview({
    entryPath: "empty.xml",
    xml: TEMPLATE,
    layoutXml: TEMPLATE,
    scenarios: [],
  });
  const screen = result.pages.find((item) => item.file === "dashboard-layout.html");
  assert.ok(screen);
  assert.ok(screen.html.includes('data-guchho-preview="layout-canvas"'));
  assert.ok(screen.html.includes("main"));
  assert.equal(screen.html.includes("No home preview available."), false);
});
