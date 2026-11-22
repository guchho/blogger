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
    `<a class="btn btn-ghost" href="${escapeHtml(kind === "post" ? routes.postNew : routes.pageNew)}?id=${encodeURIComponent(item.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2L16 5a1.5 1.5 0 0 0-2 0L3.5 15.5V20z"/></svg>Edit</a>` +
    (trash
      ? `<button type="button" class="btn btn-ghost" data-content-action="restore" data-id="${escapeHtml(item.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>Restore</button>` +
        `<button type="button" class="btn btn-ghost danger" data-content-action="delete" data-id="${escapeHtml(item.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Delete</button>`
      : `<a class="btn btn-ghost" href="${escapeHtml(itemPath(item))}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>View</a>` +
        `<button type="button" class="btn btn-ghost" data-content-action="trash" data-id="${escapeHtml(item.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>Trash</button>`) +
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
  const active = items.filter((item) => item.trashedAt === null);
  const published = items.filter((item) => effectiveStatus(item) === "published").length;
  const drafts = items.filter((item) => {
    const s = effectiveStatus(item);
    return s === "draft" || s === "scheduled";
  }).length;
  const trashed = items.length - active.length;
  return (
    `<div class="page-head"><div><p class="eyebrow">Content</p><h1>${escapeHtml(plural.charAt(0).toUpperCase() + plural.slice(1))}</h1>` +
    `<p class="subtitle" data-guchho-content="summary">Manage ${items.length} ${plural} stored as JSON files.</p></div>` +
    `<div class="page-head-actions"><a class="btn btn-primary" href="${escapeHtml(kind === "post" ? input.routes.postNew : input.routes.pageNew)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New ${singular}</a></div></div>` +
    `<div class="kpi-grid">` +
    `<div class="kpi-card kpi-blue"><div class="kpi-head"><span class="kpi-flag">Total</span></div><div class="kpi-value">${items.length}</div><div class="kpi-label">All ${plural}</div></div>` +
    `<div class="kpi-card kpi-green"><div class="kpi-head"><span class="kpi-flag">Live</span></div><div class="kpi-value">${published}</div><div class="kpi-label">Published</div></div>` +
    `<div class="kpi-card kpi-amber"><div class="kpi-head"><span class="kpi-flag">Work</span></div><div class="kpi-value">${drafts}</div><div class="kpi-label">Drafts / scheduled</div></div>` +
    `<div class="kpi-card kpi-purple"><div class="kpi-head"><span class="kpi-flag">Trash</span></div><div class="kpi-value">${trashed}</div><div class="kpi-label">In trash</div></div></div>` +
    `<section class="panel"><div class="panel-head"><div><h2>All ${escapeHtml(plural)}</h2><p class="panel-sub">Search, filter, and manage content.</p></div></div>` +
    `<div class="toolbar" data-guchho-content="toolbar">` +
    `<input class="search" id="content-search" type="search" placeholder="Search ${plural}" aria-label="Search ${plural}">` +
    `<select class="field" id="content-sort" aria-label="Sort ${plural}" style="width:auto;margin:0">` +
    `<option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option>` +
    `<option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select></div>` +
    `<div class="tabs" data-guchho-content="tabs">` +
    tabs.map((tab, index) =>
      `<button type="button" class="tab${index === 0 ? " active" : ""}" data-content-status="${tab.key}">${escapeHtml(tab.label)}</button>`
    ).join("") + `</div>` +
    `<table class="table" data-guchho-content="table"><thead><tr>` +
    headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("") +
    `</tr></thead><tbody id="content-rows">` +
    active.map((item) => row(item, kind, input.routes)).join("") +
    `</tbody></table>` +
    `<div class="toolbar"><select class="field" id="content-bulk-action" aria-label="Bulk action" style="width:auto;margin:0">` +
    `<option value="publish">Publish</option><option value="unpublish">Unpublish</option>` +
    `<option value="trash">Move to trash</option><option value="restore">Restore</option>` +
    `<option value="delete">Delete forever</option></select>` +
    `<button type="button" class="btn" id="content-bulk-apply">Apply to selected</button>` +
    `<span class="note" id="content-status-text" data-guchho-content="status">Saved</span></div></section>` +
    `<script type="application/json" id="content-dashboard-payload" data-guchho-content="payload">${encoded(payload)}</script>` +
    `<script data-guchho-content="script">${CONTENT_DASHBOARD_SCRIPT}</script>`
  );
}

export function contentOverviewBody(
  pages: readonly { title: string; route: string }[],
  input: ContentDashboardInput
): string {
  const routeCards = pages
    .map(
      (page) =>
        `<a class="route-card" href="${escapeHtml(page.route)}">` +
        `<span class="route-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>` +
        `<span><span class="route-name">${escapeHtml(page.title)}</span>` +
        `<span class="route-path">${escapeHtml(page.route)}</span></span></a>`
    )
    .join("");
  const posts = input.snapshot.posts;
  const pageCount = input.snapshot.pages.length;
  const published = posts.filter((item) => effectiveStatus(item) === "published").length;
  const drafts = posts.filter((item) => {
    const status = effectiveStatus(item);
    return status === "draft" || status === "scheduled";
  }).length;
  const recent = [...posts]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
    .map(
      (post) =>
        `<div class="activity-item">` +
        `<span class="activity-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h9l3 3v13H6V4zm9 0v4h4M9 11h6M9 15h6"/></svg></span>` +
        `<div class="activity-body"><a class="activity-title" href="${escapeHtml(postPath(post))}">${escapeHtml(post.title)}</a>` +
        `<span class="activity-meta">Post · ${escapeHtml(post.createdAt.slice(0, 10))}</span></div>` +
        `<span class="activity-status pill${effectiveStatus(post) === "draft" ? " draft" : ""}">${escapeHtml(statusLabel(post))}</span></div>`
    )
    .join("");
  const routeCount = pages.length;
  const health = input.snapshot.hash ? "Healthy" : "Empty";
  const kpi = (tone: string, flag: string, value: string, label: string, foot: string, path: string) =>
    `<div class="kpi-card ${tone}"><div class="kpi-head"><span class="kpi-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg></span><span class="kpi-flag">${escapeHtml(flag)}</span></div>` +
    `<div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-foot">${escapeHtml(foot)}</div></div>`;
  return (
    `<div class="page-head"><div><p class="eyebrow">Overview</p><h1>Dashboard</h1>` +
    `<p class="subtitle">Live file-based content workspace with content, routes, and quick actions at a glance.</p></div>` +
    `<div class="page-head-actions"><a class="btn btn-primary" href="${escapeHtml(input.routes.postNew)}">New post</a>` +
    `<a class="btn" href="${escapeHtml(input.routes.pageNew)}">New page</a></div></div>` +
    `<div class="kpi-grid" data-guchho-preview="kpis">` +
    kpi("kpi-blue", "Content", String(posts.length), "Total posts", `${published} published`, "M6 4h9l3 3v13H6V4zm9 0v4h4M9 11h6M9 15h6") +
    kpi("kpi-green", "Pages", String(pageCount), "Total pages", "Managed as JSON", "M7 4h8l3 3v13H7V4zm8 0v4h4M10 11h5M10 15h5") +
    kpi("kpi-amber", "Preview", String(routeCount), "Preview routes", "Generated pages", "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z") +
    kpi("kpi-purple", "System", health, "Workspace health", `Hash ${escapeHtml(input.snapshot.hash.slice(0, 8))}`, "M3 12h4l2-5 4 10 2-5h6") +
    `</div>` +
    `<div class="overview-grid"><div>` +
    `<section class="panel" data-guchho-preview="recent"><div class="panel-head"><div><h2>Recent posts</h2><p class="panel-sub">Latest content activity.</p></div><a class="panel-link" href="${escapeHtml(input.routes.posts)}">All posts</a></div>` +
    `<div class="activity-list">${recent || `<div class="activity-item"><span class="activity-body"><span class="activity-title">No posts yet</span><span class="activity-meta">Create your first post to see activity here.</span></span></div>`}</div></section>` +
    `<section class="panel"><div class="panel-head"><div><h2>Preview routes</h2><p class="panel-sub">Pages generated for the current build.</p></div></div><div class="route-grid">${routeCards}</div></section>` +
    `</div><div>` +
    `<section class="panel"><div class="panel-head"><div><h2>Quick actions</h2><p class="panel-sub">Common workspace tasks.</p></div></div><div class="quick-list">` +
    `<a class="quick-item" href="${escapeHtml(input.routes.postNew)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>New post</a>` +
    `<a class="quick-item" href="${escapeHtml(input.routes.pageNew)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>New page</a>` +
    `<a class="quick-item" href="/"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7M9 7h8v8"/></svg>View blog</a></div></section>` +
    `<section class="panel"><div class="panel-head"><div><h2>Content status</h2><p class="panel-sub">Live snapshot from content files.</p></div></div>` +
    `<div class="status-row"><div class="status-label"><span>Published</span><span class="status-value">${published}</span></div><div class="status-bar"><span class="status-fill" style="width:${posts.length ? Math.round((published / posts.length) * 100) : 0}%"></span></div></div>` +
    `<div class="status-row"><div class="status-label"><span>Drafts/Scheduled</span><span class="status-value">${drafts}</span></div><div class="status-bar"><span class="status-fill" style="width:${posts.length ? Math.round((drafts / posts.length) * 100) : 0}%"></span></div></div>` +
    `<div class="status-row"><div class="status-label"><span>Pages</span><span class="status-value">${pageCount}</span></div><div class="status-bar"><span class="status-fill" style="width:${pageCount ? 100 : 0}%"></span></div></div></section>` +
    `<section class="panel"><div class="panel-head"><div><h2>Workspace</h2><p class="panel-sub">Content hash</p></div></div><p class="tip">Content is loaded from JSON files and reflected in preview routes. Hash: <code>${escapeHtml(input.snapshot.hash.slice(0, 12))}</code></p></section>` +
    `</div></div>`
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
