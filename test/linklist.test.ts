import assert from "node:assert/strict";
import test from "node:test";

import {
  addLinkListLink,
  deleteLinkListLink,
  editLinkListLink,
  moveLinkListLink,
  sortLinkListLinks,
} from "../src/layout/linklist/operations.js";
import {
  linkListLinks,
  linkListSettingsFromLinks,
  linkListTextFromLinks,
  migrateLegacyLinkListSettings,
  normalizeLinkListSettings,
  parseLinkListText,
} from "../src/layout/linklist/serialization.js";
import {
  isLinkListUrl,
  validateLinkListSettings,
  validateLinkListTitle,
} from "../src/layout/linklist/validation.js";
import { LINKLIST_SORTING } from "../src/layout/linklist/types.js";
import { applyLayoutOperations } from "../src/layout/operations.js";
import { LayoutError } from "../src/layout/model.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><b:skin><![CDATA[.post{color:red}]]></b:skin></head>
<body>
<b:section id='sidebar' name='Sidebar' showaddelement='yes'>
  <b:widget id='LinkList1' locked='true' title='Link List' type='LinkList' visible='true' version='2'>
    <b:widget-settings>
      <b:widget-setting name='sorting'>NONE</b:widget-setting>
      <b:widget-setting name='text-0'><![CDATA[<i>Home</i>]]></b:widget-setting>
      <b:widget-setting name='link-0'>/</b:widget-setting>
      <b:widget-setting name='text-1'>Zulu</b:widget-setting>
      <b:widget-setting name='link-1'>https://zulu.example.com</b:widget-setting>
      <b:widget-setting name='text-2'>Old</b:widget-setting>
      <b:widget-setting name='link-2'>/old</b:widget-setting>
      <b:widget-setting name='links'>Legacy | /legacy</b:widget-setting>
      <b:widget-setting name='custom.keep'>kept</b:widget-setting>
    </b:widget-settings>
    <b:includable id='main'><data:links/></b:includable>
  </b:widget>
</b:section>
</body></html>`;

function initialSettings(): Record<string, string> {
  return {
    sorting: LINKLIST_SORTING.none,
    shownum: "",
    "text-0": "Zulu",
    "link-0": "/zulu",
    "text-1": "Alpha",
    "link-1": "https://alpha.example.com",
  };
}

function editSettings(settings: Record<string, string>) {
  return applyLayoutOperations(
    TEMPLATE,
    [{ kind: "editWidget", widgetId: "LinkList1", changes: { settings } }],
    "linklist-template.xml"
  );
}

test("link CRUD operations are immutable and renumber links", () => {
  const source = initialSettings();
  const added = addLinkListLink(source, { name: "Middle", url: "/middle" });
  assert.equal(source["text-2"], undefined);
  assert.deepEqual(linkListLinks(added).map((link) => link.name), ["Zulu", "Alpha", "Middle"]);

  assert.deepEqual(linkListLinks(editLinkListLink(source, 1, { name: "Beta", url: "/beta" })).map((link) => link.name), ["Zulu", "Beta"]);
  assert.deepEqual(linkListLinks(deleteLinkListLink(source, 0)).map((link) => link.name), ["Alpha"]);
  assert.deepEqual(linkListLinks(moveLinkListLink(source, 1, "up")).map((link) => link.name), ["Alpha", "Zulu"]);
  assert.deepEqual(linkListLinks(moveLinkListLink(source, 0, "down")).map((link) => link.name), ["Alpha", "Zulu"]);
});

test("sorting operates on site names and preserves order for Don't sort", () => {
  const source = initialSettings();
  assert.deepEqual(
    linkListLinks(sortLinkListLinks(source, LINKLIST_SORTING.alphabetical)).map((link) => link.name),
    ["Alpha", "Zulu"]
  );
  assert.deepEqual(
    linkListLinks(sortLinkListLinks(source, LINKLIST_SORTING.reverseAlphabetical)).map((link) => link.name),
    ["Zulu", "Alpha"]
  );
  assert.deepEqual(
    linkListLinks(sortLinkListLinks(source, LINKLIST_SORTING.none)).map((link) => link.name),
    ["Zulu", "Alpha"]
  );
});

test("validation accepts relative and HTTP/HTTPS URLs and rejects unsafe values", () => {
  assert.equal(isLinkListUrl("/about.html"), true);
  assert.equal(isLinkListUrl("#top"), true);
  assert.equal(isLinkListUrl("https://example.com"), true);
  assert.equal(isLinkListUrl("http://example.com/path"), true);
  assert.equal(isLinkListUrl("javascript:alert(1)"), false);
  assert.equal(isLinkListUrl("mailto:hello@example.com"), false);
  assert.equal(isLinkListUrl("/has space"), false);
  assert.equal(validateLinkListTitle("x".repeat(100)), undefined);
  assert.match(validateLinkListTitle("x".repeat(101))?.message ?? "", /at most 100/);
});

test("validation reports site name, site URL, sorting and show errors", () => {
  const issues = validateLinkListSettings({
    sorting: "SOMETIMES",
    shownum: "0",
    "text-0": "",
    "link-0": "javascript:alert(1)",
    "text-1": "No URL",
  });
  const messages = issues.map((issue) => issue.message).join(" ");
  assert.match(messages, /Sort links/);
  assert.match(messages, /Show/);
  assert.match(messages, /Site Name is required for link 1/);
  assert.match(messages, /Site URL for link 1/);
  assert.match(messages, /Site URL is required for link 2/);
  assert.match(
    validateLinkListSettings({ "text-0": "Only name" }).map((issue) => issue.message).join(" "),
    /Site URL is required for link 1/
  );
});

test("serialization migrates legacy links and preserves unknown settings", () => {
  const migrated = migrateLegacyLinkListSettings({
    links: "Home | /\nDocs | https://example.com",
    "custom.keep": "kept",
  });
  assert.equal(migrated.links, undefined);
  assert.equal(migrated["text-0"], "Home");
  assert.equal(migrated["link-0"], "/");
  assert.equal(migrated["text-1"], "Docs");
  assert.equal(migrated["link-1"], "https://example.com");
  assert.equal(migrated["custom.keep"], "kept");

  const normalized = normalizeLinkListSettings({ sorting: "BAD", shownum: "0", "custom.keep": "kept" });
  assert.equal(normalized.sorting, LINKLIST_SORTING.none);
  assert.equal(normalized.shownum, "");
  assert.equal(normalized["custom.keep"], "kept");
});

test("link text serialization round-trips native Labels and URLs", () => {
  const links = [
    { name: "Home", url: "/" },
    { name: "<i>Docs</i>", url: "https://example.com/docs" },
  ];
  assert.equal(linkListTextFromLinks(links), "Home | /\n<i>Docs</i> | https://example.com/docs");
  assert.deepEqual(parseLinkListText("Home | /\n<i>Docs</i> | https://example.com/docs"), links);
  assert.deepEqual(parseLinkListText("Only name\n | /orphan\n\n"), [
    { name: "Only name", url: "" },
    { name: "", url: "/orphan" },
  ]);
});

test("sorting is stable for equal site names", () => {
  const settings = {
    "text-0": "Alpha",
    "link-0": "/first",
    "text-1": "alpha",
    "link-1": "/second",
    "text-2": "Beta",
    "link-2": "/third",
  };
  assert.deepEqual(
    linkListLinks(sortLinkListLinks(settings, LINKLIST_SORTING.alphabetical)).map((link) => link.url),
    ["/first", "/second", "/third"]
  );
});

test("serializing a link list removes stale numbered settings only", () => {
  const next = linkListSettingsFromLinks(
    { "text-0": "Old", "link-0": "/old", "text-9": "Stale", "link-9": "/stale", "custom.keep": "kept" },
    [{ name: "New", url: "/new" }]
  );
  assert.equal(next["text-0"], "New");
  assert.equal(next["link-0"], "/new");
  assert.equal(next["text-9"], undefined);
  assert.equal(next["link-9"], undefined);
  assert.equal(next["custom.keep"], "kept");
});

test("editing LinkList writes native settings, deletes removed links and preserves unknown settings", () => {
  const { xml, model } = editSettings({
    sorting: LINKLIST_SORTING.none,
    shownum: "2",
    "text-0": "Home",
    "link-0": "/",
    "text-1": "Docs",
    "link-1": "https://example.com/docs",
  });
  assert.match(xml, /<b:widget-setting name='shownum'>2<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='text-0'><!\[CDATA\[Home\]\]><\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='link-0'>\/<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='text-1'>Docs<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='custom.keep'>kept<\/b:widget-setting>/);
  assert.doesNotMatch(xml, /name='text-2'/);
  assert.doesNotMatch(xml, /name='link-2'/);
  assert.doesNotMatch(xml, /name='links'/);
  const widget = model.sections[0]?.widgets[0];
  assert.equal(widget?.id, "LinkList1");
  assert.equal(widget?.sectionId, "sidebar");
  assert.equal(widget?.title, "Link List");
  assert.equal(widget?.visible, true);
  assert.deepEqual(linkListLinks(widget?.settings ?? {}).map((link) => link.name), ["Home", "Docs"]);
});

test("changing sorting rewrites stored link order", () => {
  const { xml } = editSettings({ sorting: LINKLIST_SORTING.alphabetical });
  assert.match(xml, /<b:widget-setting name='text-0'><!\[CDATA\[<i>Home<\/i>\]\]><\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='text-1'>Old<\/b:widget-setting>/);
});

test("title, visibility and link validation are enforced by the save operation", () => {
  assert.throws(
    () => applyLayoutOperations(TEMPLATE, [{ kind: "editWidget", widgetId: "LinkList1", changes: { title: "x".repeat(101) } }], "linklist-template.xml"),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_SETTING_INVALID"
  );
  assert.throws(
    () => editSettings({ "link-1": "javascript:alert(1)" }),
    (error: unknown) => error instanceof LayoutError && error.code === "BLOGGER_LAYOUT_SETTING_INVALID"
  );
  const { xml } = applyLayoutOperations(
    TEMPLATE,
    [{ kind: "editWidget", widgetId: "LinkList1", changes: { title: "Blogroll", visible: false, settings: { sorting: LINKLIST_SORTING.none } } }],
    "linklist-template.xml"
  );
  assert.match(xml, /title='Blogroll'/);
  assert.match(xml, /visible='false'/);
  assert.match(xml, /locked='true'/);
});

test("adding a LinkList writes native numbered settings", () => {
  const { xml, model } = applyLayoutOperations(
    TEMPLATE,
    [{ kind: "addWidget", sectionId: "sidebar", widgetType: "LinkList", title: "Blogroll", settings: { sorting: LINKLIST_SORTING.none, shownum: "1", "text-0": "Home", "link-0": "/" } }],
    "linklist-template.xml"
  );
  const addedMarkup = xml.slice(xml.indexOf("<b:widget id='LinkList2'"));
  assert.doesNotMatch(addedMarkup, /name='links'/);
  assert.match(xml, /<b:widget-setting name='text-0'>Home<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='link-0'>\/<\/b:widget-setting>/);
  const added = model.sections[0]?.widgets[1];
  assert.equal(added?.type, "LinkList");
  assert.deepEqual(linkListLinks(added?.settings ?? {}).map((link) => link.name), ["Home"]);
});
