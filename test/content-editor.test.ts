import assert from "node:assert/strict";
import test from "node:test";
import { Script, runInNewContext } from "node:vm";

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
      'data-guchho-content="rich-toolbar"',
      'id="content-view-compose"',
      'data-editor-command="bold"',
      'id="content-editor-dialog"',
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

test("new editor screens are deterministic across rebuilds", async () => {
  await withContentRoot(async (paths) => {
    const snapshot = await snapshotWithContent(paths);
    const first = screens(snapshot);
    const second = screens(snapshot);
    for (const file of ["dashboard-post-new.html", "dashboard-page-new.html"]) {
      const a = first.find((screen) => screen.file === file);
      const b = second.find((screen) => screen.file === file);
      assert.ok(a);
      assert.ok(b);
      assert.equal(a.html, b.html, file);
    }
  });
});

type FakeNode = any;

function createFakeNode(id: string, values: Record<string, unknown> = {}): FakeNode {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  const node: FakeNode = {
    id,
    tagName: "DIV",
    nodeType: 1,
    hidden: true,
    disabled: false,
    value: "",
    innerHTML: "",
    textContent: "",
    checked: false,
    children: [],
    parentElement: null,
    ...values,
  };
  node.classList = {
    add(name: string) { classes.add(name); },
    remove(name: string) { classes.delete(name); },
    contains(name: string) { return classes.has(name); },
    toggle(name: string, force?: boolean) {
      const active = force === undefined ? !classes.has(name) : force;
      if (active) classes.add(name);
      else classes.delete(name);
      return active;
    },
  };
  node.setAttribute = (name: string, value: string) => { attributes.set(name, String(value)); };
  node.getAttribute = (name: string) => attributes.get(name) ?? null;
  node.addEventListener = (type: string, handler: (event: any) => void) => {
    const list = listeners.get(type) ?? [];
    list.push(handler);
    listeners.set(type, list);
  };
  node.fire = (type: string, event: any = {}) => {
    for (const handler of listeners.get(type) ?? []) handler.call(node, event);
  };
  node.focus = () => {};
  node.contains = (candidate: FakeNode): boolean =>
    candidate === node || node.children.some((child: FakeNode) => child.contains(candidate));
  node.querySelectorAll = (selector: string): FakeNode[] => collectNodes([node]).filter((entry) => matchesSelector(entry, selector));
  node.appendChild = (child: FakeNode) => {
    child.parentElement = node;
    node.children.push(child);
    return child;
  };
  node.replaceChildren = () => {
    for (const child of node.children) child.parentElement = null;
    node.children = [];
  };
  node.showModal = () => {};
  node.close = () => {};
  node.closest = () => null;
  return node;
}

function collectNodes(roots: FakeNode[]): FakeNode[] {
  const result: FakeNode[] = [];
  for (const root of roots) {
    result.push(root);
    for (const child of root.children ?? []) result.push(...collectNodes([child]));
  }
  return result;
}

function matchesSelector(node: FakeNode, selector: string): boolean {
  return selector.split(",").some((raw) => {
    let part = raw.trim();
    let checkedOnly = false;
    if (part.endsWith(":checked")) {
      checkedOnly = true;
      part = part.slice(0, -":checked".length);
    }
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part);
    if (attribute) {
      const value = node.getAttribute(attribute[1]);
      return value !== null && (!checkedOnly || node.checked) &&
        (attribute[2] === undefined || value === attribute[2]);
    }
    return (part === "*" || part.toLowerCase() === String(node.tagName).toLowerCase()) &&
      (!checkedOnly || node.checked);
  });
}

function createEditorHarness(item: Record<string, any>) {
  const nodes = new Map<string, FakeNode>();
  const node = (id: string, values: Record<string, unknown> = {}) => {
    const created = createFakeNode(id, values);
    nodes.set(id, created);
    return created;
  };
  const button = (id: string, attributes: Record<string, string> = {}) => {
    const created = node(id, { tagName: "BUTTON" });
    for (const [name, value] of Object.entries(attributes)) created.setAttribute(name, value);
    return created;
  };
  node("content-editor-payload", {
    tagName: "SCRIPT",
    textContent: JSON.stringify({
      kind: "page",
      apiBase: "http://localhost:3001",
      item,
      hash: null,
      existing: true,
      listUrl: "/__preview/dashboard/pages/",
    }),
  });
  const form = node("content-editor-form", { tagName: "FORM" });
  const status = node("content-editor-status");
  const source = node("content-body-source", { tagName: "TEXTAREA", hidden: true, value: "" });
  const preview = node("content-body-preview", { hidden: false, innerHTML: "" });
  const compose = node("content-view-compose", { tagName: "BUTTON" });
  const toggle = node("content-source-toggle", { tagName: "BUTTON" });
  const publish = node("content-publish", { tagName: "BUTTON" });
  node("content-title", { tagName: "INPUT", value: item.title });
  node("content-slug", { tagName: "INPUT", value: item.slug });
  node("content-status", { tagName: "SELECT", value: item.status });
  node("content-publish-at", { tagName: "INPUT", value: "" });
  node("content-editor-dialog", { tagName: "DIALOG" });
  node("content-editor-dialog-title", { tagName: "H2" });
  node("content-editor-dialog-fields", { tagName: "DIV" });
  node("content-editor-dialog-form", { tagName: "FORM" });
  node("content-editor-dialog-confirm", { tagName: "BUTTON" });
  node("content-editor-dialog-cancel", { tagName: "BUTTON" });
  button("content-bold", { "data-editor-command": "bold" });
  button("content-undo", { "data-editor-command": "undo" });
  button("content-redo", { "data-editor-command": "redo" });
  button("content-rtl", { "data-editor-command": "rtl" });
  button("content-link", { "data-editor-insert": "link" });
  button("content-jump", { "data-editor-insert": "jump" });
  const fontFamily = node("content-font-family", { tagName: "SELECT", value: "Arial, sans-serif" });
  fontFamily.setAttribute("data-editor-select", "fontFamily");
  const fontSize = node("content-font-size", { tagName: "SELECT", value: "18px" });
  fontSize.setAttribute("data-editor-select", "fontSize");

  const commands: Array<{ command: string; value: any }> = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  let selectedText = "";
  const selection = {
    rangeCount: 1,
    anchorNode: preview,
    getRangeAt: () => ({}),
    removeAllRanges() {},
    addRange() {},
    toString: () => selectedText,
  };
  const allNodes = () => collectNodes(Array.from(nodes.values()));
  const documentStub: any = {
    getElementById: (id: string) => nodes.get(id) ?? null,
    querySelectorAll: (selector: string) => allNodes().filter((entry) => matchesSelector(entry, selector)),
    createElement: (tagName: string) => createFakeNode("", { tagName: tagName.toUpperCase() }),
    addEventListener() {},
    queryCommandState: (command: string) => command === "bold",
    execCommand(command: string, _ui: boolean, value: any) {
      commands.push({ command, value: value === undefined ? null : value });
      if (command === "insertHTML") preview.innerHTML += String(value ?? "");
      if (command === "bold") preview.innerHTML = `<strong>${preview.innerHTML}</strong>`;
      return true;
    },
  };
  const location = { search: "", pathname: "/__preview/dashboard/pages/new/" };
  const html = contentEditorMarkup({
    kind: "page",
    apiBase: "http://localhost:3001",
    item: item as any,
    hash: null,
    existing: true,
    labels: [],
    authors: [],
    defaultAuthor: "admin",
    listUrl: "/__preview/dashboard/pages/",
  });
  const script = /<script data-guchho-content="script">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(script);
  const context: any = {
    document: documentStub,
    window: {
      getSelection: () => selection,
      history: { replaceState() {} },
      location,
      addEventListener() {},
      confirm: () => true,
    },
    location,
    fetch: (url: string, options: { body: string }) => {
      const body = JSON.parse(options.body) as Record<string, unknown>;
      requests.push({ url, body });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ item: { ...item, ...body }, hash: "hash" }),
      });
    },
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout() {},
    console,
  };
  return {
    node,
    button,
    get: (id: string) => nodes.get(id) as FakeNode,
    form,
    status,
    source,
    preview,
    compose,
    toggle,
    publish,
    fontFamily,
    fontSize,
    commands,
    requests,
    document: documentStub,
    html,
    script: script[1] as string,
    context,
    setSelectedText: (value: string) => { selectedText = value; },
    start: async () => {
      runInNewContext(script[1] as string, context);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

test("editor saves body typed in the visual editor", async () => {
  const item = defaultPage({
    id: "page-live",
    title: "Live CMS page",
    slug: "live-cms-page",
    content: "",
    status: "draft",
  });
  const harness = createEditorHarness(item);
  await harness.start();
  harness.preview.innerHTML = "<p>Typed in visual editor</p>";
  harness.form.fire("input");
  harness.publish.fire("click");
  await harness.flush();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0]?.body["content"], "<p>Typed in visual editor</p>");

  harness.toggle.fire("click");
  assert.equal(harness.source.value, "<p>Typed in visual editor</p>");
  harness.source.value = "<p>From HTML source</p>";
  harness.publish.fire("click");
  await harness.flush();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1]?.body["content"], "<p>From HTML source</p>");
});

test("rich editor commands, dialogs, shortcuts and views really work", async () => {
  const item = defaultPage({
    id: "page-live",
    title: "Live CMS page",
    slug: "live-cms-page",
    content: "<p>Hello</p>",
    status: "draft",
  });
  const harness = createEditorHarness(item);
  assert.ok(harness.html.includes('id="content-view-compose"'));
  assert.ok(harness.html.includes('id="content-editor-dialog"'));
  await harness.start();
  assert.equal(harness.preview.innerHTML, "<p>Hello</p>");

  harness.get("content-bold").fire("click");
  assert.deepEqual(harness.commands[harness.commands.length - 1], { command: "bold", value: null });
  assert.equal(harness.preview.innerHTML, "<strong><p>Hello</p></strong>");
  assert.equal(harness.status.textContent, "Unsaved changes");

  harness.get("content-undo").fire("click");
  assert.equal(harness.preview.innerHTML, "<p>Hello</p>");
  harness.get("content-redo").fire("click");
  assert.equal(harness.preview.innerHTML, "<strong><p>Hello</p></strong>");

  harness.fontFamily.value = "Arial, sans-serif";
  harness.fontFamily.fire("change");
  assert.deepEqual(harness.commands[harness.commands.length - 1], {
    command: "fontName",
    value: "Arial, sans-serif",
  });
  harness.fontSize.value = "18px";
  harness.fontSize.fire("change");
  assert.deepEqual(harness.commands[harness.commands.length - 1], { command: "fontSize", value: "5" });

  harness.form.fire("keydown", {
    ctrlKey: true, metaKey: false, altKey: false, key: "b",
    target: { tagName: "DIV" },
    preventDefault() {},
  });
  assert.equal(harness.commands[harness.commands.length - 1]?.command, "bold");

  harness.setSelectedText("Blogger");
  harness.get("content-link").fire("click");
  const fields = harness.document.querySelectorAll("[data-dialog-field]");
  assert.equal(fields.length, 2);
  fields[0].value = "Blogger";
  fields[1].value = "blogger.com";
  harness.get("content-editor-dialog-confirm").fire("click");
  const inserted = harness.commands.filter((entry) => entry.command === "insertHTML").pop();
  assert.match(String(inserted?.value), /href="https:\/\/blogger\.com"/);

  harness.get("content-rtl").fire("click");
  assert.match(String(harness.preview.innerHTML), /dir="rtl"/);

  harness.toggle.fire("click");
  assert.equal(harness.source.hidden, false);
  assert.equal(harness.preview.hidden, true);
  assert.equal(harness.form.getAttribute("data-editor-view"), "html");
  assert.equal(harness.get("content-bold").disabled, true);
  harness.get("content-jump").fire("click");
  assert.equal(harness.commands.filter((entry) => entry.command === "jump").length, 0);

  harness.toggle.fire("click");
  assert.equal(harness.preview.hidden, false);
  assert.equal(harness.get("content-bold").disabled, false);
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
