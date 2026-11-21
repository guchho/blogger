import { isPost, type ContentItem } from "../../content/model.js";
import { sanitizeHtml } from "../../content/sanitize.js";
import { escapeHtml } from "../../preview/values.js";
import { CONTENT_EDITOR_SCRIPT } from "./client-script.js";

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
    `<div class="layout-editor-head"><div class="layout-editor-heading">` +
    `<span class="layout-editor-eyebrow">Content › ${data.kind === "post" ? "Posts" : "Pages"}</span>` +
    `<h1 id="content-editor-heading">${data.existing ? "Edit" : "New"} ${escapeHtml(data.kind)}</h1>` +
    `<p class="subtitle">Saved as JSON in the configured ${escapeHtml(data.kind)}s directory.</p>` +
    `</div><span class="layout-editor-summary" id="content-id" data-guchho-content="id">` +
    `${data.existing ? escapeHtml(data.item.id) : "Not saved yet"}</span></div>` +
    `<div class="toolbar" data-guchho-content="toolbar">` +
    `<button type="button" class="btn btn-primary" id="content-save-draft" data-guchho-content="save-draft">Save draft</button>` +
    `<button type="button" class="btn" id="content-publish" data-guchho-content="publish">Publish</button>` +
    `<button type="button" class="btn" id="content-schedule" data-guchho-content="schedule">Schedule</button>` +
    `<button type="button" class="btn" id="content-source-toggle" data-guchho-content="source-toggle">` +
    `<span id="content-source-label">HTML source</span></button>` +
    `<button type="button" class="btn" id="content-trash" data-guchho-content="trash"${data.existing ? "" : " disabled"}>Trash</button>` +
    `<button type="button" class="btn" id="content-delete" data-guchho-content="delete"${data.existing ? "" : " disabled"}>Delete forever</button>` +
    `<span class="pill" id="content-editor-status" data-guchho-content="status" data-state="${data.existing ? "saved" : "new"}">` +
    `${data.existing ? "All changes saved" : "Not saved yet"}</span></div>` +
    `<div class="grid2"><div><div class="panel">` +
    `<input class="field editor-title" id="content-title" type="text" placeholder="Title" aria-label="Title" ` +
    `value="${escapeHtml(data.item.title)}" data-guchho-content="title">` +
    `<input class="field" id="content-slug" type="text" placeholder="Slug" aria-label="Slug" ` +
    `value="${escapeHtml(data.item.slug)}" data-guchho-content="slug">` +
    `<div class="toolbar" data-guchho-content="body-toolbar"><span class="note">Rich text body</span></div>` +
    `<div class="panel" id="content-body-preview" contenteditable="true" data-guchho-content="body-preview">${body}</div>` +
    `<textarea class="field textarea" id="content-body-source" aria-label="Body" hidden data-guchho-content="body-source">` +
    `${escapeHtml(data.item.content)}</textarea></div></div><div>` +
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
    `<script type="application/json" id="content-editor-payload" data-guchho-content="payload">${encoded(payload)}</script>` +
    `<script data-guchho-content="script">${CONTENT_EDITOR_SCRIPT}</script></div>`
  );
}
