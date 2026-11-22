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
    `<button type="button" class="btn" id="content-source-toggle" data-guchho-content="source-toggle"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M14 7l-4 10"/></svg><span id="content-source-label">HTML source</span></button>` +
    `<span style="flex:1"></span>` +
    `<button type="button" class="btn" id="content-trash" data-guchho-content="trash"${data.existing ? "" : " disabled"}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>Trash</button>` +
    `<button type="button" class="btn" id="content-delete" data-guchho-content="delete"${data.existing ? "" : " disabled"}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Delete forever</button></div>` +
    `<div class="grid2"><div><section class="panel"><div class="panel-head"><div><h2>Content</h2><p class="panel-sub">Title, slug, and body.</p></div><span class="layout-editor-summary" id="content-id" data-guchho-content="id">${data.existing ? escapeHtml(data.item.id) : "Not saved yet"}</span></div>` +
    `<input class="field editor-title" id="content-title" type="text" placeholder="Title" aria-label="Title" ` +
    `value="${escapeHtml(data.item.title)}" data-guchho-content="title">` +
    `<label class="layout-editor-field"><span>Slug</span><input class="field" id="content-slug" type="text" placeholder="slug" aria-label="Slug" ` +
    `value="${escapeHtml(data.item.slug)}" data-guchho-content="slug"></label>` +
    `<label class="layout-editor-field"><span>Body</span></label>` +
    `<div class="panel" id="content-body-preview" contenteditable="true" data-guchho-content="body-preview" style="min-height:320px;box-shadow:none">${body}</div>` +
    `<textarea class="field textarea" id="content-body-source" aria-label="Body" hidden data-guchho-content="body-source">` +
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
    `<script type="application/json" id="content-editor-payload" data-guchho-content="payload">${encoded(payload)}</script>` +
    `<script data-guchho-content="script">${CONTENT_EDITOR_SCRIPT}</script></div>`
  );
}
