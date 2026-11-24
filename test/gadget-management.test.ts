import assert from "node:assert/strict";
import test from "node:test";

import { Script } from "node:vm";

import {
  gadgetDefaultSettings,
  getGadgetDefinition,
  isFieldVisibleForValues,
  normalizeGadgetSettings,
  validateGadgetSettings,
} from "../src/layout/gadgets.js";
import { applyLayoutOperations } from "../src/layout/operations.js";
import { extractLayout } from "../src/layout/extract.js";
import { LayoutError, type LayoutOperation } from "../src/layout/model.js";
import { editorPayload, migrateLayoutModelSettings, serializeLayout } from "../src/layout/serialize.js";
import { layoutEditorMarkup } from "../src/preview/layout-editor/markup.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><b:skin><![CDATA[.post{color:red}]]></b:skin></head>
<body>
<b:section id='main' class='main section' maxwidgets='8'>
  <b:widget id='HTML1' type='HTML' title='HTML' locked='false' visible='true' version='2'>
    <b:widget-settings><b:widget-setting name='content'>hello</b:widget-setting></b:widget-settings>
    <b:includable id='main'><data:content/></b:includable>
  </b:widget>
  <b:widget id='Attribution1' type='Attribution' title='Attribution' locked='false' visible='true' version='2'>
    <b:includable id='main'>powered by Blogger</b:includable>
  </b:widget>
</b:section>
</body></html>`;

const CUSTOM_TEMPLATE = TEMPLATE.replace(
  "</b:section>",
  `<b:widget id='Custom1' type='Hero' title='Hero' locked='false' visible='true' version='2'><b:includable id='main'>hero</b:includable></b:widget></b:section>`
);

function apply(operations: LayoutOperation[], allowed: string[] = [], source = TEMPLATE) {
  return applyLayoutOperations(source, operations, "test-template.xml", allowed);
}

test("gadget defaults and validation cover ads and unknown settings", () => {
  const settings = gadgetDefaultSettings("Blog");
  assert.equal(settings.showAdsBetweenPosts, "false");
  assert.equal(settings.postsPerAd, "1");
  assert.equal(settings.adFormat, "recommended");

  const normalized = normalizeGadgetSettings("Blog", {
    showAuthor: "yes",
    postsPerPage: "99999",
    adFormat: "bogus",
    style_json: '{"keep":true}',
  });
  assert.equal(normalized.showAuthor, "false");
  assert.equal(normalized.postsPerPage, "1000");
  assert.equal(normalized.adFormat, "recommended");
  assert.equal(normalized.style_json, '{"keep":true}');

  const issues = validateGadgetSettings("Image", { sourceUrl: "not a url" });
  assert.ok(issues.some((issue) => issue.key === "sourceUrl"));
});

test("addWidget persists a title and normalized settings in one operation", () => {
  const result = apply([
    {
      kind: "addWidget",
      sectionId: "main",
      widgetType: "Image",
      title: "Banner",
      settings: { sourceUrl: "https://example.com/a.png", altText: "A banner" },
    },
  ]);
  assert.match(result.xml, /title='Banner'/);
  assert.match(result.xml, /<b:widget-setting name='sourceUrl'>https:\/\/example\.com\/a\.png<\/b:widget-setting>/);
  const model = extractLayout(result.xml, "test-template.xml");
  const widget = model.sections[0]?.widgets.find((item) => item.type === "Image");
  assert.equal(widget?.title, "Banner");
  assert.equal(widget?.settings.sourceUrl, "https://example.com/a.png");
  assert.equal(widget?.settings.title, "");
});

test("custom widget types are accepted only when the plugin registers them", () => {
  assert.throws(
    () => apply([{ kind: "addWidget", sectionId: "main", widgetType: "Hero" }]),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_WIDGET_TYPE_INVALID"
  );
  const result = apply([{ kind: "addWidget", sectionId: "main", widgetType: "Hero" }], ["Hero"]);
  assert.match(result.xml, /type='Hero'/);

  const payload = editorPayload(extractLayout(CUSTOM_TEMPLATE, "test-template.xml"), 3001, [
    "HTML",
    "Hero",
  ]);
  assert.deepEqual(payload.allowedWidgetTypes, ["HTML", "Hero"]);
  const custom = payload.gadgetCatalog?.find((item) => item.type === "Hero");
  assert.equal(custom?.category, "Custom");
  assert.equal(custom?.implemented, "partial");
  assert.equal(custom?.configurable, false);
});

test("duplicateWidget copies settings with a new identity and respects limits", () => {
  const result = apply([{ kind: "duplicateWidget", widgetId: "HTML1" }]);
  const widgets = extractLayout(result.xml, "test-template.xml").sections[0]?.widgets ?? [];
  assert.equal(widgets.length, 3);
  const copy = widgets.find((item) => item.id === "HTML2");
  assert.equal(copy?.type, "HTML");
  assert.equal(copy?.id, "HTML2");
  assert.equal(copy?.title, "HTML (Copy)");
  assert.equal(copy?.settings.content, "hello");

  assert.throws(
    () => apply([{ kind: "duplicateWidget", widgetId: "Blog1" }], [], TEMPLATE.replace("id='HTML1' type='HTML'", "id='Blog1' type='Blog'")),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_DUPLICATE_UNSUPPORTED"
  );
  assert.throws(
    () => apply([{ kind: "duplicateWidget", widgetId: "Followers1" }], [], TEMPLATE.replace("id='HTML1' type='HTML'", "id='Followers1' type='Followers'")),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_MAX_INSTANCES"
  );
});

test("capability rules block unsupported remove, move and hide operations", () => {
  const remove = (): unknown =>
    apply([{ kind: "removeWidget", widgetId: "Attribution1" }]);
  assert.throws(remove, (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_CAPABILITY_UNSUPPORTED");

  const move = (): unknown =>
    apply([{ kind: "moveWidget", widgetId: "Attribution1", sectionId: "main", index: 0 }]);
  assert.throws(move, (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_CAPABILITY_UNSUPPORTED");

  const hide = (): unknown =>
    apply([{ kind: "editWidget", widgetId: "Attribution1", changes: { visible: false } }]);
  assert.throws(hide, (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_CAPABILITY_UNSUPPORTED");
});

test("serializeLayout forwards allowed widget types to operations", () => {
  const result = serializeLayout(TEMPLATE, [{ kind: "addWidget", sectionId: "main", widgetType: "Hero" }], "test-template.xml", ["Hero"]);
  assert.match(result.xml, /type='Hero'/);
});

test("payload migration fills known defaults and preserves unknown settings", () => {
  const source = TEMPLATE.replace("type='HTML'", "type='Blog'").replace(
    "name='content'>hello",
    "name='style_json'>{\"keep\":true}"
  );
  const original = extractLayout(source, "test-template.xml");
  const migrated = migrateLayoutModelSettings(original);
  const originalWidget = original.sections[0]?.widgets[0];
  const migratedWidget = migrated.sections[0]?.widgets[0];
  assert.equal(originalWidget?.settings.postsPerPage, undefined);
  assert.equal(migratedWidget?.settings.postsPerPage, "10");
  assert.equal(migratedWidget?.settings.showAdsBetweenPosts, "false");
  assert.equal(migratedWidget?.settings.style_json, '{"keep":true}');
  assert.notEqual(migrated, original);
});

test("Blog Posts ads edits persist without deleting unknown settings", () => {
  const source = TEMPLATE.replace("id='HTML1' type='HTML'", "id='Blog1' type='Blog'").replace(
    "name='content'>hello",
    "name='postsPerAd'>2</b:widget-setting><b:widget-setting name='style_json'>{\"theme\":true}"
  );
  const result = apply([
    {
      kind: "editWidget",
      widgetId: "Blog1",
      changes: {
        settings: {
          postsPerPage: "7",
          showAdsBetweenPosts: "true",
          postsPerAd: "3",
          adFormat: "vertical",
        },
      },
    },
  ], [], source);
  assert.match(result.xml, /<b:widget-setting name='postsPerPage'>7<\/b:widget-setting>/);
  assert.match(result.xml, /<b:widget-setting name='showAdsBetweenPosts'>true<\/b:widget-setting>/);
  assert.match(result.xml, /<b:widget-setting name='postsPerAd'>3<\/b:widget-setting>/);
  assert.match(result.xml, /<b:widget-setting name='adFormat'>vertical<\/b:widget-setting>/);
  assert.match(result.xml, /<b:widget-setting name='style_json'>\{"theme":true\}<\/b:widget-setting>/);
});

test("conditional fields follow their showIf rules", () => {
  const definition = getGadgetDefinition("Blog");
  const authorLabel = definition?.sections
    .flatMap((section) => section.fields)
    .find((field) => field.key === "authorLabel");
  assert.ok(authorLabel);
  assert.equal(isFieldVisibleForValues(authorLabel, { showAuthor: "true" }), true);
  assert.equal(isFieldVisibleForValues(authorLabel, { showAuthor: "false" }), false);
});

test("layout markup exposes catalog search, detail, move and live feedback controls", () => {
  const payload = editorPayload(extractLayout(TEMPLATE, "test-template.xml"), 3001);
  const html = layoutEditorMarkup(payload);
  for (const marker of [
    'id="le-gadget-search"',
    'id="le-gadget-category"',
    'data-guchho-preview="le-gadget-detail"',
    'id="le-move-dialog"',
    'id="layout-editor-live"',
    'id="le-gadget-empty"',
    'id="le-widget-advanced-fields"',
    "le-gadget-card-icon",
    "data-le-apply=",
    "Number of posts between ads",
    "le-blog-show-ads",
  ]) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  const match = /<script data-guchho-preview="layout-editor-script">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match);
  assert.doesNotThrow(() => new Script(match[1] as string));
  assert.match(match[1] as string, /duplicateWidget/);
  assert.match(match[1] as string, /validateGenericFields/);
  assert.match(match[1] as string, /le-custom-field/);
  assert.match(match[1] as string, /data-move-item/);
  assert.match(match[1] as string, /le-drop-invalid/);
  assert.doesNotMatch(match[1] as string, /actionButton\('duplicate-widget'/);
  assert.doesNotMatch(match[1] as string, /actionButton\('move-widget'/);
  assert.doesNotMatch(match[1] as string, /actionButton\('toggle-visible'/);
});
