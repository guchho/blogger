import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { SourceFile } from "../src/xml/source.js";
import { parseXml } from "../src/xml/parser.js";
import { renderTemplate } from "../src/preview/render/renderer.js";
import { buildScenarios } from "../src/preview/data/pages.js";

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
<b:section class='main' id='main' name='Main'>
  <b:widget id='Blog1' title='Posts' type='Blog' visible='true'>
    <b:widget-settings>
      <b:widget-setting name='showDate'>true</b:widget-setting>
    </b:widget-settings>
    <b:includable id='main' var='this'>
      <b:include name='widget-title'/>
      <div class='blog-posts'>
        <b:class cond='data:view.isHomepage' name='home'/>
        <b:loop index='i' values='data:posts' var='post'>
          <article class='post' expr:data-index='data:i + 1'>
            <h2><a expr:href='data:post.url'><data:post.title/></a></h2>
            <b:tag cond='data:post.labels' class='labels-tag' name='section'>
              <ul>
                <b:loop values='data:post.labels' var='label'>
                  <li><data:label.name/></li>
                </b:loop>
              </ul>
            </b:tag>
            <b:with value='data:post.snippets.short snippet { length: 5 }' var='short'>
              <p class='snippet'><b:eval expr='data:short'/></p>
            </b:with>
            <b:switch var='data:view.pageType'>
              <b:case value='index'/><span class='pt'>listing</span>
              <b:default/><span class='pt'>single</span>
            </b:switch>
            <b:include data='post' name='footer'/>
          </article>
        </b:loop>
      </div>
    </b:includable>
    <b:includable id='footer' var='post'>
      <div class='post-footer'>
        <b:attr cond='data:post.numberOfComments' name='data-comments' value='yes'/>
        <b:if cond='data:post.numberOfComments'><b:message name='messages.comments'/></b:if>
      </div>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;

function render(template: string, data: Record<string, unknown>): { html: string; reports: string[] } {
  const document = parseXml(new SourceFile("test.xml", template));
  const reports: string[] = [];
  const result = renderTemplate(
    document,
    data as import("../src/preview/values.js").ValueMap,
    { report: (code, message) => reports.push(`${code}: ${message}`) }
  );
  return { html: result.html, reports };
}

test("renders sections, widgets and loops with mock data", () => {
  const scenario = buildScenarios()[0];
  assert.ok(scenario);
  const { html, reports } = render(TEMPLATE, scenario.data);

  assert.deepEqual(reports, []);
  assert.match(html, /<div class="section main" id="main"/);
  assert.match(html, /<div class="widget Blog" id="Blog1"/);
  assert.match(html, /<h3 class="title">Posts<\/h3>/);
  assert.match(html, /data-index="1"/);
  assert.match(html, /href="http:\/\/localhost:3000\/2026\/01\/getting-started-with-guchho\.html"/);
  assert.match(html, /<span class="pt">listing<\/span>/);
  assert.equal(html.includes("single"), false);
  assert.equal((html.match(/<article class="post"/g) ?? []).length, 4);
});

test("renders dynamic classes and attributes", () => {
  const scenario = buildScenarios()[0];
  assert.ok(scenario);
  const { html } = render(TEMPLATE, scenario.data);
  assert.match(html, /class="blog-posts home"/);
  assert.match(html, /class="labels-tag"/);
  assert.match(html, /data-comments="yes"/);
});

test("resolves common includables and messages", () => {
  const scenario = buildScenarios()[0];
  assert.ok(scenario);
  const { html } = render(TEMPLATE, scenario.data);
  assert.match(html, /Comments/);
  assert.match(html, /<p class="snippet">Getti…<\/p>/);
});

const WIDGETS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='PageList1' title='Pages' type='PageList'/>
  <b:widget id='Label1' title='Labels' type='Label'/>
  <b:widget id='Text1' title='Text' type='Text'/>
  <b:widget id='Image1' title='Image' type='Image'/>
  <b:widget id='Attribution1' type='Attribution'/>
</b:section>
</body>
</html>`;

test("renders widgets through the built-in registry without reports", () => {
  const scenario = buildScenarios()[0];
  assert.ok(scenario);
  const { html, reports } = render(WIDGETS_TEMPLATE, scenario.data);
  assert.deepEqual(reports, []);
  assert.match(html, /class="widget PageList"/);
  assert.match(html, /<ul class="pagelist">/);
  assert.match(html, /<a href="http:\/\/localhost:3000\/p\/about\.html">About<\/a>/);
  assert.match(html, /<ul class="label-list">/);
  assert.match(html, /A deterministic mock text widget\./);
  assert.match(html, /<img alt="Mock image"[^>]*src="data:image\/svg\+xml;base64,/);
  assert.match(html, /class="powered-by">Powered by Blogger<\/span>/);
});

const THEME_PATH = "demo/theme.xml";

const SUPER_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:defaultmarkups>
  <b:defaultmarkup type='Blog'>
    <b:includable id='main'>
      <div class='default-main'><b:include name='posts'/></div>
    </b:includable>
    <b:includable id='posts'><p class='default-posts'>default posts</p></b:includable>
  </b:defaultmarkup>
</b:defaultmarkups>
<b:section id='main'>
  <b:widget id='Blog1' type='Blog' title='Posts'>
    <b:includable id='main'>
      <div class='custom-main'>
        <p class='custom-posts'>custom posts</p>
        <b:include name='super.main'/>
      </div>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;

test("resolves super.main to the widget-type default markup", () => {
  const scenario = buildScenarios()[0];
  assert.ok(scenario);
  const { html, reports } = render(SUPER_TEMPLATE, scenario.data);
  assert.deepEqual(reports, []);
  assert.match(html, /class="custom-main"/);
  assert.match(html, /class="custom-posts"/);
  assert.match(html, /class="default-main"/);
  assert.match(html, /class="default-posts"/);
});

const BROKEN_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<body>
<b:section id='main'>
  <b:widget id='Blog1' type='Blog' title='Posts'>
    <b:includable id='main'>
      <b:include name='does-not-exist'/>
    </b:includable>
  </b:widget>
</b:section>
</body>
</html>`;

test("reports include diagnostics with a line:column location", () => {
  const document = parseXml(new SourceFile("broken.xml", BROKEN_TEMPLATE));
  const diagnostics: Array<{ code: string; message: string; location?: string }> = [];
  renderTemplate(document, {} as import("../src/preview/values.js").ValueMap, {
    report: (code, message, location) => diagnostics.push({ code, message, location }),
  });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.code, "BLOGGER_PREVIEW_UNKNOWN_INCLUDABLE");
  assert.match(diagnostics[0]?.message ?? "", /does-not-exist/);
  assert.match(diagnostics[0]?.location ?? "", /^7:\d+$/);
});

test("renders the real theme fixture without reports", { skip: !existsSync(THEME_PATH) }, () => {
  const text = readFileSync(THEME_PATH, "utf8");
  const document = parseXml(new SourceFile(THEME_PATH, text));
  for (const scenario of buildScenarios()) {
    const reports: string[] = [];
    const result = renderTemplate(document, scenario.data, {
      report: (code, message) => reports.push(`${code}: ${message}`),
    });
    assert.deepEqual(reports, [], `scenario ${scenario.file} reported diagnostics`);
    assert.match(result.html, /<body/);
    assert.match(result.html, /<\/html>/);
  }
});
