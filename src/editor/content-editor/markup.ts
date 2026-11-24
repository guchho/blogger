import { isPost, type ContentItem } from "../../content/model.js";
import { sanitizeHtml } from "../../content/sanitize.js";
import { escapeHtml } from "../../preview/values.js";
import { readFileSync } from "node:fs";

const CONTENT_EDITOR_SCRIPT = readFileSync(
  new URL("../../scripts/content-editor.js", import.meta.url),
  "utf8"
);

export interface ContentEditorData {
  kind: "post" | "page";
  apiBase: string;
  item: ContentItem;
  hash: string | null;
  existing: boolean;
  labels: string[];
  authors: string[];
  defaultAuthor: string;
  listUrl: string;
}

function encoded(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

const ICONS: Record<string, string> = {
  undo: '<path d="M9 7H4V2"/><path d="M4 7a8 8 0 1 1-1.5 6.4"/>',
  redo: '<path d="M15 7h5V2"/><path d="M20 7a8 8 0 1 0 1.5 6.4"/>',
  clear: '<path d="M4 18h16"/><path d="m6 14 8-8 4 4-8 8H6z"/><path d="m11 9 4 4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1-1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  symbol: '<path d="M8 20 16 4"/><path d="M5 10h14M9 16h6"/>',
  snippet: '<path d="M8 3h8l4 4v14H8z"/><path d="M16 3v5h4M11 13h6M11 17h4"/>',
  widget: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  ai: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  jump: '<path d="M4 12h16M5 7v10M19 7v10"/>',
  bullet: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  number: '<path d="M9 6h12M9 12h12M9 18h12M3 5h2v4M3 9h3M4 14h2l-2 3h2"/>',
  quote: '<path d="M9 7H5a2 2 0 0 0-2 2v3h5v5H3v-5"/><path d="M20 7h-4a2 2 0 0 0-2 2v3h5v5h-5v-5"/>',
  outdent: '<path d="M4 6h16M10 12h10M10 18h10M4 10v4M4 14l2-2"/>',
  indent: '<path d="M4 6h16M10 12h10M10 18h10M4 10v4M4 14l2-2"/>',
  alignLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignCenter: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  alignJustify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  ltr: '<path d="M4 12h15M15 8l4 4-4 4"/>',
  rtl: '<path d="M20 12H5M9 8l-4 4 4 4"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
};

function icon(name: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${ICONS[name] ?? ""}</svg>`
  );
}

function attribute(name: string, value: string): string {
  return ` ${name}="${escapeHtml(value)}"`;
}

function toolButton(
  id: string,
  title: string,
  glyph: string,
  attributes: Record<string, string> = {}
): string {
  const extras = Object.entries(attributes)
    .map(([name, value]) => attribute(name, value))
    .join("");
  return (
    `<button type="button" class="editor-tool" id="${id}" title="${escapeHtml(title)}" ` +
    `aria-label="${escapeHtml(title)}"${extras}>${glyph}</button>`
  );
}

function editorMenu(
  name: string,
  title: string,
  glyph: string,
  items: string,
  className = ""
): string {
  return (
    `<div class="editor-menu${className === "" ? "" : ` ${className}`}" data-editor-menu-root="${name}">` +
    `<button type="button" class="editor-tool editor-menu-button" data-editor-menu-toggle="${name}" ` +
    `title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" aria-haspopup="true" aria-expanded="false">` +
    `${glyph}${icon("chevron")}</button>` +
    `<div class="editor-menu-list" data-editor-menu="${name}" hidden>${items}</div></div>`
  );
}

function menuItem(title: string, attributes: Record<string, string>, glyph: string): string {
  const extras = Object.entries(attributes)
    .map(([name, value]) => attribute(name, value))
    .join("");
  return `<button type="button" class="editor-menu-item" title="${escapeHtml(title)}"${extras}>${glyph}</button>`;
}

function options(values: ReadonlyArray<readonly [string, string]>): string {
  return values
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

function editorToolbar(): string {
  const headings = ([
    ["h1", "Major heading"], ["h2", "Heading"], ["h3", "Subheading"],
    ["h4", "Minor heading"], ["p", "Paragraph"], ["div", "Normal text"],
  ] as ReadonlyArray<readonly [string, string]>)
    .map(([value, label]) =>
      menuItem(
        label,
        { "data-editor-command": "formatBlock", "data-editor-value": value },
        `<span class="editor-heading-sample editor-heading-${value}">${label}</span>`
      )
    )
    .join("");

  const symbols = [
    "©", "®", "™", "€", "£", "¥", "§", "¶", "•", "–", "—", "…", "“", "”", "‘", "’",
    "°", "±", "×", "÷", "→", "←", "↑", "↓", "★", "☆", "✓", "✗",
  ]
    .map((value) =>
      menuItem(
        `Insert ${value}`,
        { "data-editor-symbol": value },
        `<span class="editor-symbol">${escapeHtml(value)}</span>`
      )
    )
    .join("");

  const snippets = ([
    ["callout", "Callout box"], ["note", "Note / quote"], ["code", "Code block"],
    ["button", "Link button"], ["divider", "Divider"],
  ] as ReadonlyArray<readonly [string, string]>)
    .map(([value, label]) =>
      menuItem(
        label,
        { "data-editor-snippet": value },
        `<span>${label}</span>`
      )
    )
    .join("");

  const insert = ([
    ["link", "Insert / edit link", icon("link"), "link"],
    ["image", "Insert image", icon("image"), "image"],
    ["video", "Insert video", icon("video"), "video"],
    ["jump", "Insert jump break", icon("jump"), "jump"],
    ["widget", "Insert widget block", icon("widget"), "widget"],
    ["ai", "AI draft", icon("ai"), "ai"],
  ] as ReadonlyArray<readonly [string, string, string, string]>)
    .map(([value, label, glyph, key]) =>
      menuItem(label, { "data-editor-insert": value }, `${glyph}<span>${label}</span><small>${key}</small>`)
    )
    .join("");

  const more = ([
    ["selectAll", "Select all", "Select all"], ["copy", "Copy", "Copy"],
    ["cut", "Cut", "Cut"], ["paste", "Paste", "Paste"],
  ] as ReadonlyArray<readonly [string, string, string]>)
    .map(([command, label, text]) =>
      menuItem(label, { "data-editor-command": command }, `<span>${text}</span>`)
    )
    .join("");

  const languages = ([
    ["en", "English", "ltr"], ["hi", "हिन्दी", "ltr"], ["bn", "বাংলা", "ltr"],
    ["ar", "العربية", "rtl"], ["he", "עברית", "rtl"],
  ] as ReadonlyArray<readonly [string, string, string]>)
    .map(([code, label, direction]) =>
      menuItem(
        label,
        { "data-editor-language": code, "data-editor-direction": direction },
        `<span>${label}</span><small>${direction.toUpperCase()}</small>`
      )
    )
    .join("");

  return (
    `<div class="editor-toolbars" data-guchho-content="rich-toolbar">` +
    `<div class="editor-toolbar" role="toolbar" aria-label="Text formatting">` +
    `<div class="editor-tool-group editor-view-toggle" role="group" aria-label="Editor view">` +
    `<button type="button" class="editor-tool editor-view-button active" id="content-view-compose" ` +
    `data-editor-view="compose" aria-pressed="true" title="Compose view">Compose</button>` +
    `<button type="button" class="editor-tool editor-view-button" id="content-source-toggle" ` +
    `data-editor-view="html" aria-pressed="false" title="HTML view" ` +
    `data-guchho-content="source-toggle"><span id="content-source-label">HTML</span></button></div>` +
    `<span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    toolButton("content-undo", "Undo (Ctrl+Z)", icon("undo"), { "data-editor-command": "undo" }) +
    toolButton("content-redo", "Redo (Ctrl+Y)", icon("redo"), { "data-editor-command": "redo" }) +
    `</div><span class="editor-separator"></span>` +
    editorMenu("heading", "Text style", '<span class="editor-menu-label">Normal text</span>', headings, "editor-menu-heading") +
    `<select class="editor-select" id="content-font-family" data-editor-select="fontFamily" title="Font family" aria-label="Font family">` +
    options([
      ["", "Default"], ["Arial, sans-serif", "Arial"], ["Georgia, serif", "Georgia"],
      ["'Times New Roman', serif", "Times New Roman"], ["'Courier New', monospace", "Courier New"],
      ["Verdana, sans-serif", "Verdana"], ["Roboto, sans-serif", "Roboto"],
    ]) +
    `</select>` +
    `<select class="editor-select editor-select-size" id="content-font-size" data-editor-select="fontSize" title="Font size" aria-label="Font size">` +
    options([
      ["", "Size"], ["12px", "12"], ["14px", "14"], ["16px", "16"],
      ["18px", "18"], ["24px", "24"], ["32px", "32"], ["48px", "48"],
    ]) +
    `</select>` +
    `<span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    toolButton("content-bold", "Bold (Ctrl+B)", "<strong>B</strong>", { "data-editor-command": "bold" }) +
    toolButton("content-italic", "Italic (Ctrl+I)", "<em>I</em>", { "data-editor-command": "italic" }) +
    toolButton("content-underline", "Underline (Ctrl+U)", '<span class="editor-underline">U</span>', { "data-editor-command": "underline" }) +
    toolButton("content-strike", "Strikethrough", '<span class="editor-strike">S</span>', { "data-editor-command": "strikeThrough" }) +
    `</div>` +
    `<label class="editor-color" title="Text color"><span class="editor-color-letter">A</span>` +
    `<input type="color" id="content-text-color" data-editor-color="foreColor" value="#1f2329" aria-label="Text color"></label>` +
    `<label class="editor-color" title="Text background color"><span class="editor-color-letter editor-color-highlight">A</span>` +
    `<input type="color" id="content-background-color" data-editor-color="hiliteColor" value="#fff3b0" aria-label="Text background color"></label>` +
    toolButton("content-clear-format", "Clear formatting", icon("clear"), { "data-editor-command": "removeFormat" }) +
    `</div>` +
    `<div class="editor-toolbar" role="toolbar" aria-label="Insert and layout">` +
    `<div class="editor-tool-group">` +
    toolButton("content-link", "Insert / edit link (Ctrl+K)", icon("link"), { "data-editor-insert": "link" }) +
    toolButton("content-image", "Insert image", icon("image"), { "data-editor-insert": "image" }) +
    toolButton("content-video", "Insert video", icon("video"), { "data-editor-insert": "video" }) +
    editorMenu("symbols", "Special characters", icon("symbol"), symbols, "editor-menu-symbols") +
    editorMenu("snippet", "HTML snippet", icon("snippet"), snippets) +
    `</div><span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    editorMenu("insert", "Insert widget or AI content", icon("widget"), insert) +
    toolButton("content-jump", "Insert jump break", icon("jump"), { "data-editor-insert": "jump" }) +
    `</div><span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    toolButton("content-align-left", "Align left", icon("alignLeft"), { "data-editor-command": "justifyLeft" }) +
    toolButton("content-align-center", "Align center", icon("alignCenter"), { "data-editor-command": "justifyCenter" }) +
    toolButton("content-align-right", "Align right", icon("alignRight"), { "data-editor-command": "justifyRight" }) +
    toolButton("content-align-justify", "Justify", icon("alignJustify"), { "data-editor-command": "justifyFull" }) +
    `</div><span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    toolButton("content-outdent", "Decrease indent", icon("outdent"), { "data-editor-command": "outdent" }) +
    toolButton("content-indent", "Increase indent", icon("indent"), { "data-editor-command": "indent" }) +
    toolButton("content-ltr", "Left to right", icon("ltr"), { "data-editor-command": "ltr" }) +
    toolButton("content-rtl", "Right to left", icon("rtl"), { "data-editor-command": "rtl" }) +
    `</div><span class="editor-separator"></span>` +
    `<div class="editor-tool-group">` +
    toolButton("content-bullet", "Bulleted list", icon("bullet"), { "data-editor-command": "insertUnorderedList" }) +
    toolButton("content-number", "Numbered list", icon("number"), { "data-editor-command": "insertOrderedList" }) +
    toolButton("content-quote", "Blockquote", icon("quote"), { "data-editor-command": "formatBlock", "data-editor-value": "blockquote" }) +
    editorMenu("input", "Input tools", '<span class="editor-menu-label">Input</span>', languages) +
    editorMenu("more", "More editing actions", '<span class="editor-menu-label">More</span>', more) +
    `</div></div></div>`
  );
}

function editorDialog(): string {
  return (
    `<dialog class="editor-dialog" id="content-editor-dialog" data-guchho-content="dialog">` +
    `<form class="editor-dialog-form" id="content-editor-dialog-form" novalidate>` +
    `<h2 id="content-editor-dialog-title">Insert</h2>` +
    `<div class="editor-dialog-fields" id="content-editor-dialog-fields"></div>` +
    `<div class="editor-dialog-actions">` +
    `<button type="button" class="btn" id="content-editor-dialog-cancel">Cancel</button>` +
    `<button type="submit" class="btn btn-primary" id="content-editor-dialog-confirm">Insert</button>` +
    `</div></form></dialog>`
  );
}

function checkbox(name: string, label: string, checked: boolean, attribute: string): string {
  return (
    `<label class="layout-editor-check" data-guchho-content="label">` +
    `<input type="checkbox" data-content-label="${escapeHtml(attribute)}"${checked ? " checked" : ""}> ` +
    `${escapeHtml(label)}<span data-guchho-content="label-name" hidden>${escapeHtml(name)}</span></label>`
  );
}

export function contentEditorMarkup(data: ContentEditorData): string {
  const post = isPost(data.item) ? data.item : null;
  const payload = {
    kind: data.kind,
    apiBase: data.apiBase,
    item: data.item,
    hash: data.hash,
    existing: data.existing,
    labels: data.labels,
    authors: data.authors,
    defaultAuthor: data.defaultAuthor,
    listUrl: data.listUrl,
  };
  const labels = data.labels
    .map((label) => checkbox(label, label, post?.labels.includes(label) ?? false, label))
    .join(" ");
  const authorOptions = data.authors
    .map((author) => `<option value="${escapeHtml(author)}">${escapeHtml(author)}</option>`)
    .join("");
  const body = sanitizeHtml(data.item.content) || "<p>Start writing...</p>";
  const publishAt = data.item.publishAt?.slice(0, 16) ?? "";

  return (
    `<div data-guchho-content="editor" data-kind="${escapeHtml(data.kind)}">` +
    `<form id="content-editor-form" data-guchho-content="form">` +
    `<div class="page-head"><div>` +
    `<p class="eyebrow">Editor · ${data.kind === "post" ? "Posts" : "Pages"}</p>` +
    `<h1 id="content-editor-heading">${data.existing ? "Edit" : "New"} ${escapeHtml(data.kind)}</h1>` +
    `<p class="subtitle">Compose and publish ${escapeHtml(data.kind)} content with file-based storage.</p></div>` +
    `<div class="page-head-actions"><span class="pill" id="content-editor-status" data-guchho-content="status" data-state="${data.existing ? "saved" : "new"}">` +
    `${data.existing ? "All changes saved" : "Not saved yet"}</span></div></div>` +
    `<div class="toolbar panel" data-guchho-content="toolbar" style="padding:14px 16px">` +
    `<button type="button" class="btn btn-primary" id="content-save-draft" data-guchho-content="save-draft"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5V4zm2 0v5h8V4M8 15h8"/></svg>Save draft</button>` +
    `<button type="button" class="btn" id="content-publish" data-guchho-content="publish"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>Publish</button>` +
    `<button type="button" class="btn" id="content-schedule" data-guchho-content="schedule"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>Schedule</button>` +
    `<span style="flex:1"></span>` +
    `<button type="button" class="btn" id="content-trash" data-guchho-content="trash"${data.existing ? "" : " disabled"}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>Trash</button>` +
    `<button type="button" class="btn" id="content-delete" data-guchho-content="delete"${data.existing ? "" : " disabled"}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Delete forever</button></div>` +
    `<div class="grid2"><div><section class="panel"><div class="panel-head"><div><h2>Content</h2><p class="panel-sub">Title, slug, and body.</p></div><span class="layout-editor-summary" id="content-id" data-guchho-content="id">${data.existing ? escapeHtml(data.item.id) : "Not saved yet"}</span></div>` +
    `<input class="field editor-title" id="content-title" type="text" placeholder="Title" aria-label="Title" ` +
    `value="${escapeHtml(data.item.title)}" data-guchho-content="title">` +
    `<label class="layout-editor-field"><span>Slug</span><input class="field" id="content-slug" type="text" placeholder="slug" aria-label="Slug" ` +
    `value="${escapeHtml(data.item.slug)}" data-guchho-content="slug"></label>` +
    `<label class="layout-editor-field"><span>Body</span></label>` +
    editorToolbar() +
    `<div class="panel editor-body-panel" id="content-body-preview" contenteditable="true" data-guchho-content="body-preview" role="textbox" aria-multiline="true" aria-label="Post body" spellcheck="true">${body}</div>` +
    `<textarea class="field textarea editor-source" id="content-body-source" aria-label="HTML source" hidden data-guchho-content="body-source">` +
    `${escapeHtml(data.item.content)}</textarea></section></div><div>` +
    (post !== null
      ? `<div class="panel"><h3>Excerpt &amp; labels</h3>` +
        `<textarea class="field" id="content-excerpt" aria-label="Excerpt" data-guchho-content="excerpt">${escapeHtml(post.excerpt)}</textarea>` +
        `<div data-guchho-content="labels">${labels || `<span class="note">No labels configured.</span>`}</div></div>` +
        `<div class="panel"><h3>Post options</h3>` +
        `<label class="layout-editor-field"><span>Author</span>` +
        `<input class="field" id="content-author" list="content-authors" value="${escapeHtml(post.author || data.defaultAuthor)}" data-guchho-content="author"></label>` +
        `<datalist id="content-authors">${authorOptions}</datalist>` +
        `<label class="layout-editor-field"><span>Featured image URL</span>` +
        `<input class="field" id="content-featured" type="url" value="${escapeHtml(post.featuredImage ?? "")}" data-guchho-content="featured"></label>` +
        `<label class="layout-editor-check"><input id="content-allow-comments" type="checkbox"${post.allowComments ? " checked" : ""}> Allow comments</label></div>`
      : `<div class="panel"><h3>Page options</h3><p class="note">Pages have no labels, author or comments.</p></div>`) +
    `<div class="panel"><h3>Publish</h3>` +
    `<label class="layout-editor-field"><span>Status</span><select class="field" id="content-status" data-guchho-content="status-select">` +
    `<option value="draft"${data.item.status === "draft" ? " selected" : ""}>Draft</option>` +
    `<option value="published"${data.item.status === "published" ? " selected" : ""}>Published</option>` +
    `<option value="scheduled"${data.item.status === "scheduled" ? " selected" : ""}>Scheduled</option>` +
    `</select></label>` +
    `<label class="layout-editor-field"><span>Publish at</span>` +
    `<input class="field" id="content-publish-at" type="datetime-local" value="${escapeHtml(publishAt)}" data-guchho-content="publish-at"></label>` +
    `<p class="note">Drafts autosave locally. Publish and schedule save immediately.</p></div>` +
    `</div></div></form>` +
    editorDialog() +
    `<script type="application/json" id="content-editor-payload" data-guchho-content="payload">${encoded(payload)}</script>` +
    `<script data-guchho-content="script">${CONTENT_EDITOR_SCRIPT}</script></div>`
  );
}
