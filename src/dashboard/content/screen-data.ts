import { defaultPage, defaultPost, effectiveStatus, type ContentItem } from "../../content/model.js";
import { pagePath, postPath } from "../../content/routes.js";
import type { ContentSnapshot } from "../../content/settings.js";
import { contentEditorMarkup } from "../../editor/content-editor/markup.js";
import { escapeHtml } from "../../preview/values.js";
import { CONTENT_DASHBOARD_SCRIPT } from "./client-script.js";

export interface ContentDashboardOptions {
  snapshot: ContentSnapshot;
  savePort: number;
}

export interface ContentDashboardInput extends ContentDashboardOptions {
  routes: {
    posts: string;
    pages: string;
    postNew: string;
    pageNew: string;
  };
}

export interface ContentDashboardPayload {
  kind: "post" | "page";
  apiBase: string;
  listUrl: string;
  items: Array<ContentItem & { path: string }>;
}

function encoded(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function statusLabel(item: ContentItem): string {
  const status = effectiveStatus(item);
  return status === "trash" ? "Trash" : status.charAt(0).toUpperCase() + status.slice(1);
}

function itemPath(item: ContentItem): string {
  return item.type === "post" ? postPath(item) : pagePath(item);
}

function row(
  item: ContentItem,
  kind: "post" | "page",
  routes: ContentDashboardInput["routes"]
): string {
  const author = item.type === "post" ? item.author : "";
  const labels = item.type === "post" ? item.labels.join(", ") : "";
  const status = statusLabel(item);
  const trash = item.trashedAt !== null;
  return (
    `<tr data-content-row="${escapeHtml(item.id)}">` +
    `<td><input type="checkbox" class="content-check" value="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.title)}"></td>` +
    `<td><a href="${escapeHtml(itemPath(item))}">${escapeHtml(item.title)}</a>` +
    `<div class="recent-meta">/${escapeHtml(item.slug)}</div></td>` +
    (kind === "post"
      ? `<td>${escapeHtml(author)}</td><td>${escapeHtml(labels)}</td>`
      : "") +
    `<td>${escapeHtml(item.createdAt.slice(0, 10))}</td>` +
    `<td><span class="pill${status === "Draft" || status === "Trash" ? " draft" : ""}">${escapeHtml(status)}</span></td>` +
    `<td><div class="actions">` +
    `<a href="${escapeHtml(kind === "post" ? routes.postNew : routes.pageNew)}?id=${encodeURIComponent(item.id)}">Edit</a>` +
    (trash
      ? `<button type="button" class="btn" data-content-action="restore" data-id="${escapeHtml(item.id)}">Restore</button>` +
        `<button type="button" class="btn" data-content-action="delete" data-id="${escapeHtml(item.id)}">Delete forever</button>`
      : `<a href="${escapeHtml(itemPath(item))}">View</a>` +
        `<button type="button" class="btn" data-content-action="trash" data-id="${escapeHtml(item.id)}">Trash</button>`) +
    `</div></td></tr>`
  );
}

function listScreen(kind: "post" | "page", input: ContentDashboardInput): string {
  const items = kind === "post" ? input.snapshot.posts : input.snapshot.pages;
  const singular = kind === "post" ? "post" : "page";
  const plural = `${singular}s`;
  const payload: ContentDashboardPayload = {
    kind,
    apiBase: `http://localhost:${input.savePort}`,
    listUrl: kind === "post" ? input.routes.posts : input.routes.pages,
    items: items.map((item) => ({ ...item, path: itemPath(item) })),
  };
  const headers = kind === "post"
    ? ["", "Title", "Author", "Labels", "Date", "Status", "Actions"]
    : ["", "Title", "Date", "Status", "Actions"];
  const tabs = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Drafts" },
    { key: "scheduled", label: "Scheduled" },
    { key: "trash", label: "Trash" },
  ];
  return (
    `<h1>${escapeHtml(plural.charAt(0).toUpperCase() + plural.slice(1))}</h1>` +
    `<p class="subtitle" data-guchho-content="summary">Manage ${items.length} ${plural} stored as JSON files.</p>` +
    `<div class="toolbar" data-guchho-content="toolbar">` +
    `<input class="search" id="content-search" type="search" placeholder="Search ${plural}" aria-label="Search ${plural}">` +
    `<select class="field" id="content-sort" aria-label="Sort ${plural}" style="width:auto;margin:0">` +
    `<option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option>` +
    `<option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select>` +
    `<a class="btn btn-primary" href="${escapeHtml(kind === "post" ? input.routes.postNew : input.routes.pageNew)}">New ${singular}</a></div>` +
    `<div class="tabs" data-guchho-content="tabs">` +
    tabs.map((tab, index) =>
      `<button type="button" class="tab${index === 0 ? " active" : ""}" data-content-status="${tab.key}">${escapeHtml(tab.label)}</button>`
    ).join("") + `</div>` +
    `<table class="table" data-guchho-content="table"><thead><tr>` +
    headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("") +
    `</tr></thead><tbody id="content-rows">` +
    items.filter((item) => item.trashedAt === null).map((item) => row(item, kind, input.routes)).join("") +
    `</tbody></table>` +
    `<div class="toolbar"><select class="field" id="content-bulk-action" aria-label="Bulk action" style="width:auto;margin:0">` +
    `<option value="publish">Publish</option><option value="unpublish">Unpublish</option>` +
    `<option value="trash">Move to trash</option><option value="restore">Restore</option>` +
    `<option value="delete">Delete forever</option></select>` +
    `<button type="button" class="btn" id="content-bulk-apply">Apply to selected</button>` +
    `<span class="note" id="content-status-text" data-guchho-content="status">Saved</span></div>` +
    `<script type="application/json" id="content-dashboard-payload" data-guchho-content="payload">${encoded(payload)}</script>` +
    `<script data-guchho-content="script">${CONTENT_DASHBOARD_SCRIPT}</script>`
  );
}

export function contentOverviewBody(
  pages: readonly { title: string; route: string }[],
  input: ContentDashboardInput
): string {
  const cards = pages
    .map(
      (page) =>
        `<a class="card" href="${escapeHtml(page.route)}">` +
        `<div class="card-title">${escapeHtml(page.title)}</div>` +
        `<div class="card-route">${escapeHtml(page.route)}</div></a>`
    )
    .join("");
  const recent = [...input.snapshot.posts]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3)
    .map(
      (post) =>
        `<div class="recent-item"><a href="${escapeHtml(postPath(post))}">${escapeHtml(post.title)}</a>` +
        `<span class="recent-meta">${escapeHtml(statusLabel(post))} · ${escapeHtml(post.createdAt.slice(0, 10))}</span></div>`
    )
    .join("");
  return (
    `<h1>Dashboard</h1><p class="subtitle">Live file-based content workspace — posts and pages are stored as JSON.</p>` +
    `<div class="stats">` +
    `<div class="stat"><div class="stat-value">${pages.length}</div><div class="stat-label">Preview pages</div></div>` +
    `<div class="stat"><div class="stat-value">${input.snapshot.posts.length}</div><div class="stat-label">Posts</div></div>` +
    `<div class="stat"><div class="stat-value">${input.snapshot.pages.length}</div><div class="stat-label">Pages</div></div>` +
    `</div><h2>Preview pages</h2><div class="cards">${cards}</div>` +
    `<h2>Recent posts</h2><div class="recent">${recent || `<div class="recent-item">No posts yet.</div>`}</div>` +
    `<div class="toolbar"><a class="btn btn-primary" href="${escapeHtml(input.routes.postNew)}">New post</a>` +
    `<a class="btn" href="${escapeHtml(input.routes.pageNew)}">New page</a></div>` +
    `<p class="note" data-guchho-content="hash">Content hash: ${escapeHtml(input.snapshot.hash.slice(0, 12))}</p>`
  );
}

export function contentPostsBody(input: ContentDashboardInput): string {
  return listScreen("post", input);
}

export function contentPagesBody(input: ContentDashboardInput): string {
  return listScreen("page", input);
}

export function contentEditorBody(
  kind: "post" | "page",
  input: ContentDashboardInput
): string {
  const labels = [
    ...new Set([
      ...input.snapshot.settings.categories,
      ...input.snapshot.posts.flatMap((post) => post.labels),
    ]),
  ].sort();
  const authors = [
    ...new Set([
      input.snapshot.settings.author,
      ...input.snapshot.settings.authors.map((author) => author.name),
    ]),
  ].filter((author) => author !== "").sort();
  return contentEditorMarkup({
    kind,
    apiBase: `http://localhost:${input.savePort}`,
    item:
      kind === "post"
        ? defaultPost({ id: "", createdAt: "", updatedAt: "" })
        : defaultPage({ id: "", createdAt: "", updatedAt: "" }),
    hash: null,
    existing: false,
    labels,
    authors,
    defaultAuthor: input.snapshot.settings.author,
    listUrl: kind === "post" ? input.routes.posts : input.routes.pages,
  });
}
