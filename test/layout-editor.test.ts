import assert from "node:assert/strict";
import test from "node:test";

import { applyLayoutOperations, validateLayoutXml } from "../src/layout/operations.js";
import { extractLayout } from "../src/layout/extract.js";
import { LayoutError, type LayoutOperation } from "../src/layout/model.js";
import { serializeLayout } from "../src/layout/serialize.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
<b:skin version='1.0.0'><![CDATA[.post{color:red}]]></b:skin>
<b:template-skin><![CDATA[.widget{margin:4px}]]></b:template-skin>
<style><![CDATA[body{background:#fff}]]></style>
<!-- keep me -->
<custom:unknown flag='yes'/>
</head>
<body>
<b:section id='header' class='header section' showaddelement='false' maxwidgets='2'>
  <b:widget id='Header1' type='Header' title='Header' locked='true' visible='true' version='2'>
    <b:includable id='main'><h1><data:title/></h1></b:includable>
  </b:widget>
</b:section>
<b:section id='main' class='main section' maxwidgets='3' growth='yes'>
  <b:widget id='Blog1' type='Blog' title='Blog Posts' locked='false' visible='true' version='2'>
    <b:includable id='main'><data:posts/></b:includable>
  </b:widget>
  <b:widget id='HTML2' type='HTML' title='HTML' locked='false' visible='false' version='1'>
    <b:includable id='main'>hello</b:includable>
  </b:widget>
</b:section>
<b:section id='sidebar' class='sidebar section' maxwidgets='1'>
  <b:widget id='Profile1' type='Profile' title='Profile' locked='false' visible='true' version='2'>
    <b:includable id='main'><data:profile/></b:includable>
  </b:widget>
</b:section>
</body></html>`;

function apply(...operations: LayoutOperation[]) {
  return applyLayoutOperations(TEMPLATE, operations, "test-template.xml");
}

test("extracts sections with all supported attributes", () => {
  const model = extractLayout(TEMPLATE, "test-template.xml");
  assert.deepEqual(
    model.sections.map((section) => section.id),
    ["header", "main", "sidebar"]
  );
  const header = model.sections[0];
  assert.ok(header);
  assert.equal(header.className, "header section");
  assert.equal(header.showaddelement, false);
  assert.equal(header.maxwidgets, 2);
  const main = model.sections[1];
  assert.ok(main);
  assert.equal(main.growth, "yes");
  assert.equal(main.showaddelement, true);
  assert.equal(main.maxwidgets, 3);
});

test("extracts widgets with all supported attributes", () => {
  const model = extractLayout(TEMPLATE);
  const blog = model.sections[1]?.widgets[0];
  assert.ok(blog);
  assert.equal(blog.id, "Blog1");
  assert.equal(blog.type, "Blog");
  assert.equal(blog.title, "Blog Posts");
  assert.equal(blog.locked, false);
  assert.equal(blog.visible, true);
  assert.equal(blog.version, "2");
  assert.deepEqual(blog.includables, ["main"]);
  assert.equal(model.sections[0]?.widgets[0]?.locked, true);
  assert.equal(model.sections[1]?.widgets[1]?.visible, false);
});

test("extracts CSS from skin, template skin and style elements", () => {
  const css = extractLayout(TEMPLATE).css;
  assert.match(css.skin, /\.post\{color:red\}/);
  assert.match(css.templateSkin, /\.widget\{margin:4px\}/);
  assert.match(css.style, /body\{background:#fff\}/);
  assert.match(css.combined, /color:red/);
  assert.match(css.combined, /margin:4px/);
});

test("no operations produce byte-identical XML", () => {
  assert.equal(serializeLayout(TEMPLATE).xml, TEMPLATE);
});

test("adds a widget into the selected section", () => {
  const { xml, model } = apply({ kind: "addWidget", sectionId: "main", widgetType: "HTML" });
  assert.match(xml, /<b:widget id='HTML1'/);
  assert.equal(model.sections[1]?.widgets.length, 3);
  assert.equal(model.sections[1]?.widgets[2]?.type, "HTML");
  assert.match(xml, /<custom:unknown flag='yes'\/>/);
  assert.match(xml, /<!-- keep me -->/);
});

test("respects showaddelement and section widget limits", () => {
  assert.throws(
    () => apply({ kind: "addWidget", sectionId: "header", widgetType: "HTML" }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_ADDELEMENT_DISABLED"
  );
  assert.throws(
    () => apply({ kind: "addWidget", sectionId: "sidebar", widgetType: "HTML" }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_LIMIT"
  );
});

test("removes a widget and refuses to remove locked widgets", () => {
  const { xml, model } = apply({ kind: "removeWidget", widgetId: "HTML2" });
  assert.doesNotMatch(xml, /id='HTML2'/);
  assert.equal(model.sections[1]?.widgets.length, 1);
  assert.throws(
    () => apply({ kind: "removeWidget", widgetId: "Header1" }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_LOCKED"
  );
});

test("reorders widgets inside a section", () => {
  const { model } = apply({ kind: "reorderWidget", widgetId: "HTML2", index: 0 });
  assert.deepEqual(
    model.sections[1]?.widgets.map((widget) => widget.id),
    ["HTML2", "Blog1"]
  );
});

test("moves widgets between sections and honours target limits", () => {
  const { model } = apply({ kind: "moveWidget", widgetId: "HTML2", sectionId: "header", index: 0 });
  assert.deepEqual(
    model.sections[0]?.widgets.map((widget) => widget.id),
    ["HTML2", "Header1"]
  );
  assert.deepEqual(
    model.sections[1]?.widgets.map((widget) => widget.id),
    ["Blog1"]
  );
  assert.throws(
    () => apply({ kind: "moveWidget", widgetId: "Blog1", sectionId: "sidebar", index: 0 }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_LIMIT"
  );
  assert.throws(
    () => apply({ kind: "moveWidget", widgetId: "Header1", sectionId: "main", index: 0 }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_LOCKED"
  );
});

test("edits widget and section properties while preserving other attributes", () => {
  const { xml, model } = apply(
    { kind: "editWidget", widgetId: "Blog1", changes: { title: "New & Better", visible: false } },
    { kind: "editSection", sectionId: "main", changes: { className: "main custom", maxwidgets: 5 } }
  );
  assert.match(xml, /title='New &amp; Better'/);
  assert.match(xml, /visible='false'/);
  assert.match(xml, /class='main custom'/);
  assert.match(xml, /maxwidgets='5'/);
  assert.match(xml, /locked='false'/);
  assert.equal(model.sections[1]?.maxwidgets, 5);
  assert.equal(model.sections[1]?.widgets[0]?.title, "New & Better");
});

test("unsupported elements, comments and CSS survive serialization", () => {
  const { xml } = apply({ kind: "editWidget", widgetId: "Blog1", changes: { title: "X" } });
  for (const fragment of [
    "<custom:unknown flag='yes'/>",
    "<!-- keep me -->",
    "<![CDATA[.post{color:red}]]>",
    "<![CDATA[.widget{margin:4px}]]>",
    "<b:includable id='main'>",
  ]) {
    assert.ok(xml.includes(fragment), `missing ${fragment}`);
  }
});

test("invalid resulting XML is rejected before it is returned", () => {
  assert.throws(() => validateLayoutXml("<html><b:section id='x'></html>"));
});
