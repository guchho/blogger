import {
  AUTHORS,
  mockComments,
  mockLabels,
  mockPages,
  mockPosts,
} from "./data/mock.js";
import {
  contentEditorBody,
  contentOverviewBody,
  contentPagesBody,
  contentPostsBody,
  type ContentDashboardOptions,
} from "../dashboard/content/screen-data.js";
import { readFileSync } from "node:fs";

const DASHBOARD_COMMENTS_SCRIPT = readFileSync(
  new URL("../scripts/dashboard-comments.js", import.meta.url),
  "utf8"
);
const DASHBOARD_NAV_SCRIPT = readFileSync(
  new URL("../scripts/dashboard-navigation.js", import.meta.url),
  "utf8"
);
const DASHBOARD_THEME_SCRIPT = readFileSync(
  new URL("../scripts/dashboard-theme.js", import.meta.url),
  "utf8"
);
const DASHBOARD_SETTINGS_SCRIPT = readFileSync(
  new URL("../scripts/dashboard-settings.js", import.meta.url),
  "utf8"
);
import { DEFAULT_FAVICON_URL } from "../defaults.js";
import { extractLayout } from "../layout/extract.js";
import { availableGadgetTypes } from "../layout/gadgets.js";
import { editorPayload } from "../layout/serialize.js";
import {
  blogMetadata,
  PREVIEW_BLOG_URL,
  PREVIEW_FAVICON,
} from "./data/metadata.js";
import { layoutEditorMarkup } from "./layout-editor/markup.js";
import { decodeEntities } from "./expr/tokenizer.js";
import { escapeHtml, toText, type ValueMap } from "./values.js";
import { isElement, walk, type XmlDocument, type XmlNode } from "../xml/ast.js";

export interface DashboardPageRef {
  title: string;
  route: string;
  file: string;
}

export interface DashboardScreen extends DashboardPageRef {
  html: string;
}

export interface LayoutEditorInput {
  xml: string;
  entryPath: string;
  css: string;
  savePort: number;
  widgetTypes?: string[];
}

export type DashboardScreenKey =
  | "overview"
  | "posts"
  | "post-new"
  | "pages"
  | "page-new"
  | "comments"
  | "layout"
  | "theme"
  | "settings";

const BLOG_TITLE = "Guchho Blogger Preview";
const BASE_STYLE_LIMIT = 12000;
const LAYOUT_SAVE_PORT = 3001;

export const PREVIEW_DASHBOARD_FILE = "dashboard.html";
export const PREVIEW_DASHBOARD_ROUTE = "/__preview/dashboard/";

const SCREEN_ROUTES: Record<DashboardScreenKey, string> = {
  overview: PREVIEW_DASHBOARD_ROUTE,
  posts: `${PREVIEW_DASHBOARD_ROUTE}posts/`,
  "post-new": `${PREVIEW_DASHBOARD_ROUTE}posts/new/`,
  pages: `${PREVIEW_DASHBOARD_ROUTE}pages/`,
  "page-new": `${PREVIEW_DASHBOARD_ROUTE}pages/new/`,
  comments: `${PREVIEW_DASHBOARD_ROUTE}comments/`,
  layout: `${PREVIEW_DASHBOARD_ROUTE}layout/`,
  theme: `${PREVIEW_DASHBOARD_ROUTE}theme/`,
  settings: `${PREVIEW_DASHBOARD_ROUTE}settings/`,
};

const SCREEN_FILES: Record<DashboardScreenKey, string> = {
  overview: PREVIEW_DASHBOARD_FILE,
  posts: "dashboard-posts.html",
  "post-new": "dashboard-post-new.html",
  pages: "dashboard-pages.html",
  "page-new": "dashboard-page-new.html",
  comments: "dashboard-comments.html",
  layout: "dashboard-layout.html",
  theme: "dashboard-theme.html",
  settings: "dashboard-settings.html",
};

const STYLE = readFileSync(new URL("../style/dashboard.css", import.meta.url), "utf8");

interface NavEntry {
  label: string;
  route: string;
  active: boolean;
  icon: string;
}

const NAV_ICONS: Record<string, string> = {
  overview: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  posts: "M6 3h9l4 4v14H6V3zm9 0v5h4M9 12h7M9 16h7",
  pages: "M7 3h8l4 4v14H7V3zm8 0v5h4M10 12h6M10 16h6",
  comments: "M4 5h16v11H9l-5 4V5z",
  layout: "M4 4h16v16H4V4zm6 0v16",
  theme: "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.4-.4-.6-.9-.6-1.4 0-1.1.9-2 2-2h1.8A4.4 4.4 0 0 0 21 10.6C21 6.4 16.9 3 12 3z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-3-2 1-2-1V5l-3-1-1 2-2 1-2-1-2 3 2 1v2l-2 1 2 3 2-1 2 1v3l3 1 1-2 2-1 2 1 2-3-2-1v-2z",
  "view-blog": "M14 4h6v6M20 4l-9 9M18 14v5H5V6h5",
  widgets: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z",
};

function navIcon(name: string): string {
  const path = NAV_ICONS[name] ?? NAV_ICONS.overview;
  return (
    `<span class="nav-icon" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>` +
    `</span>`
  );
}

function routeFor(pages: readonly DashboardPageRef[], title: string): string {
  return pages.find((page) => page.title === title)?.route ?? "/";
}

function pageHead(
  eyebrow: string,
  title: string,
  subtitle: string,
  actions = ""
): string {
  return (
    `<div class="page-head"><div>` +
    `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` +
    `<h1>${escapeHtml(title)}</h1>` +
    `<p class="subtitle">${escapeHtml(subtitle)}</p></div>` +
    (actions ? `<div class="page-head-actions">${actions}</div>` : "") +
    `</div>`
  );
}

function uiIcon(name: string): string {
  const paths: Record<string, string> = {
    posts: "M6 4h9l3 3v13H6V4zm9 0v4h4M9 11h6M9 15h6",
    pages: "M7 4h8l3 3v13H7V4zm8 0v4h4M10 11h5M10 15h5",
    views: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    pulse: "M3 12h4l2-5 4 10 2-5h6",
    add: "M12 5v14M5 12h14",
    arrow: "M7 17 17 7M9 7h8v8",
    quick: "M13 3 6 14h5l-1 7 8-11h-5z",
  };
  return (
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] ?? paths.posts}"/></svg>`
  );
}

function kpiCard(
  tone: string,
  icon: string,
  flag: string,
  value: string,
  label: string,
  foot: string
): string {
  return (
    `<div class="kpi-card ${tone}">` +
    `<div class="kpi-head"><span class="kpi-icon">${uiIcon(icon)}</span>` +
    `<span class="kpi-flag">${escapeHtml(flag)}</span></div>` +
    `<div class="kpi-value">${escapeHtml(value)}</div>` +
    `<div class="kpi-label">${escapeHtml(label)}</div>` +
    `<div class="kpi-foot">${escapeHtml(foot)}</div></div>`
  );
}

function panel(title: string, subtitle = "", action = ""): string {
  return (
    `<div class="panel-head"><div><h2>${escapeHtml(title)}</h2>` +
    (subtitle ? `<p class="panel-sub">${escapeHtml(subtitle)}</p>` : "") +
    `</div>${action}</div>`
  );
}

function textOf(node: XmlNode): string {
  if (node.type === "text" || node.type === "cdata") {
    return decodeEntities(node.value);
  }
  if (isElement(node)) return node.children.map(textOf).join("");
  return "";
}

export function extractBaseStyle(document: XmlDocument): string {
  const chunks: string[] = [];
  walk(document.children, (node) => {
    if (!isElement(node)) return;
    if (node.name !== "style" && node.name !== "b:skin") return;
    chunks.push(textOf(node));
  });
  return chunks.join("\n").trim();
}

function themeCodeLines(css: string, limit?: number): string {
  const text = limit === undefined ? css : css.slice(0, limit);
  return text
    .split("\n")
    .map(
      (line, index) =>
        `<span class="theme-code-line">` +
        `<span class="theme-code-number">${index + 1}</span>` +
        `<span class="theme-code-text">${escapeHtml(line) || " "}</span>` +
        `</span>`
    )
    .join("");
}

function baseStylePanel(css: string): string {
  const content =
    css === ""
      ? `<p class="theme-code-note">No base style found in template.xml.</p>`
      : `<div class="theme-code-wrap">${themeCodeLines(css, BASE_STYLE_LIMIT)}</div>` +
        (css.length > BASE_STYLE_LIMIT
          ? `<p class="theme-code-note">Showing first ${BASE_STYLE_LIMIT} of ${css.length} characters.</p>`
          : "");
  return (
    `<section class="theme-code-panel" data-guchho-preview="base-style" data-theme-panel="style">` +
    `<div class="theme-code-head"><div><h2>Base style (template.xml)</h2>` +
    `<p>Compiled CSS from style and b:skin sections.</p></div>` +
    `<span class="theme-code-badge">CSS</span></div>${content}</section>`
  );
}

function navGroups(
  pages: readonly DashboardPageRef[],
  active: DashboardScreenKey
): Array<{ title: string; items: NavEntry[] }> {
  const screen = (key: DashboardScreenKey, label: string): NavEntry => ({
    label,
    route: SCREEN_ROUTES[key],
    active: active === key,
    icon: key,
  });
  return [
    {
      title: "Blog",
      items: [
        screen("overview", "Overview"),
        { ...screen("posts", "Posts"), active: active === "posts" || active === "post-new" },
        { ...screen("pages", "Pages"), active: active === "pages" || active === "page-new" },
        screen("comments", "Comments"),
      ],
    },
    {
      title: "Design",
      items: [screen("layout", "Layout"), screen("theme", "Theme")],
    },
    {
      title: "Preview",
      items: [
        { label: "View blog", route: routeFor(pages, "Home"), active: false, icon: "view-blog" },
        { label: "Widgets showcase", route: routeFor(pages, "Widgets"), active: false, icon: "widgets" },
      ],
    },
    {
      title: "Settings",
      items: [screen("settings", "Settings")],
    },
  ];
}

function faviconHref(favicon: string): string {
  const value = favicon.trim();
  if (value === "") return DEFAULT_FAVICON_URL;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\.\//, "")}`;
}

function shell(
  key: DashboardScreenKey,
  title: string,
  body: string,
  pages: readonly DashboardPageRef[],
  favicon: string
): string {
  const nav = navGroups(pages, key)
    .map(
      (group) =>
        `<div class="group"><div class="group-title">${escapeHtml(group.title)}</div>` +
        group.items
          .map(
            (item) =>
              `<a class="nav-item${item.active ? " active" : ""}" ` +
              `href="${escapeHtml(item.route)}"${item.active ? ' aria-current="page"' : ""}>` +
              `${navIcon(item.icon)}${escapeHtml(item.label)}</a>`
          )
          .join("") +
        `</div>`
    )
    .join("");

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<link rel="icon" href="${escapeHtml(faviconHref(favicon))}">` +
    `<title>${escapeHtml(title)} — ${escapeHtml(BLOG_TITLE)}</title><style>${STYLE}</style></head><body>` +
    `<header class="topbar">` +
    `<button type="button" class="nav-toggle" data-guchho-preview="nav-toggle" ` +
    `aria-label="Toggle sidebar" aria-controls="dashboard-sidebar" aria-expanded="false">` +
    `<span class="nav-toggle-bars" aria-hidden="true"><span></span><span></span><span></span></span>` +
    `</button><span class="brand">Blogger</span>` +
    `<span class="badge">Preview</span><span class="spacer"></span>` +
    `<a class="top-link" href="${escapeHtml(routeFor(pages, "Home"))}">View blog</a>` +
    `<span class="blog">${escapeHtml(BLOG_TITLE)}</span></header>` +
    `<div class="layout" data-guchho-preview="dashboard-screen" data-screen="${key}" data-nav="open">` +
    `<aside class="sidebar" id="dashboard-sidebar">${nav}</aside>` +
    `<div class="nav-backdrop" data-guchho-preview="nav-backdrop"></div>` +
    `<main class="content">${body}</main></div>` +
    `<script data-guchho-preview="nav-script">${DASHBOARD_NAV_SCRIPT}</script>` +
    (key === "comments"
      ? `<script data-guchho-preview="comments-script">${DASHBOARD_COMMENTS_SCRIPT}</script>`
      : "") +
    (key === "settings"
      ? `<script type="application/json" id="dashboard-settings-payload">` +
        JSON.stringify({ faviconUrl: DEFAULT_FAVICON_URL })
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026") +
        `</script>` +
        `<script data-guchho-preview="settings-script">${DASHBOARD_SETTINGS_SCRIPT}</script>`
      : "") +
    (key === "theme"
      ? `<script data-guchho-preview="theme-script">${DASHBOARD_THEME_SCRIPT}</script>`
      : "") +
    `</body></html>`
  );
}

function header(title: string, subtitle: string): string {
  return `<h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p>`;
}

function button(label: string, primary = false): string {
  return `<button type="button" class="btn${primary ? " btn-primary" : ""}">${escapeHtml(label)}</button>`;
}

function tabs(labels: string[], activeIndex = 0): string {
  return (
    `<div class="tabs">` +
    labels
      .map(
        (label, index) =>
          `<span class="tab${index === activeIndex ? " active" : ""}">${escapeHtml(label)}</span>`
      )
      .join("") +
    `</div>`
  );
}

function table(headers: string[], rows: string[]): string {
  return (
    `<table class="table"><thead><tr>` +
    headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("") +
    `</tr></thead><tbody>` +
    rows.map((row) => `<tr>${row}</tr>`).join("") +
    `</tbody></table>`
  );
}

function postStatus(index: number): string {
  return ["Published", "Published", "Published", "Draft"][index] ?? "Published";
}

function overviewBody(pages: readonly DashboardPageRef[]): string {
  const cards = pages
    .map(
      (page) =>
        `<a class="card" href="${escapeHtml(page.route)}">` +
        `<div class="card-title">${escapeHtml(page.title)}</div>` +
        `<div class="card-route">${escapeHtml(page.route)}</div></a>`
    )
    .join("");

  const recent = mockPosts()
    .slice(0, 4)
    .map((post) => {
      const title = toText(post["title"] ?? "");
      const url = toText(post["url"] ?? "");
      const date = toText(post["date"] ?? "");
      return (
        `<div class="activity-item">` +
        `<span class="activity-icon">${uiIcon("posts")}</span>` +
        `<div class="activity-body"><a class="activity-title" href="${escapeHtml(url)}">${escapeHtml(title)}</a>` +
        `<span class="activity-meta">Post · ${escapeHtml(date)}</span></div>` +
        `<span class="activity-status pill">Published</span></div>`
      );
    })
    .join("");

  const postCount = mockPosts().length;
  const previewCount = pages.length;
  const quick = (
    `<div class="quick-list">` +
    `<a class="quick-item" href="${SCREEN_ROUTES["post-new"]}">${uiIcon("add")} New post</a>` +
    `<a class="quick-item" href="${SCREEN_ROUTES["page-new"]}">${uiIcon("add")} New page</a>` +
    `<a class="quick-item" href="${routeFor(pages, "Home")}">${uiIcon("arrow")} View blog</a>` +
    `</div>`
  );
  const status = (
    `<div class="status-row"><div class="status-label"><span>Published posts</span><span class="status-value">${postCount}</span></div>` +
    `<div class="status-bar"><span class="status-fill" style="width:${postCount ? 100 : 0}%"></span></div></div>` +
    `<div class="status-row"><div class="status-label"><span>Preview pages</span><span class="status-value">${previewCount}</span></div>` +
    `<div class="status-bar"><span class="status-fill" style="width:${Math.min(100, previewCount * 14)}%"></span></div></div>`
  );

  return (
    pageHead(
      "Workspace",
      "Dashboard",
      "A clean overview of your preview workspace, content, and key actions.",
      `<a class="btn btn-primary" href="${SCREEN_ROUTES["post-new"]}">New post</a>` +
      `<a class="btn" href="${routeFor(pages, "Home")}">View blog</a>`
    ) +
    `<div class="kpi-grid" data-guchho-preview="kpis">` +
    kpiCard("kpi-blue", "posts", "Content", String(postCount), "Total posts", "Mock preview data") +
    kpiCard("kpi-green", "pages", "Pages", String(mockPages().length), "Total pages", "Static pages ready") +
    kpiCard("kpi-amber", "views", "Preview", String(previewCount), "Preview routes", "Generated scenarios") +
    kpiCard("kpi-purple", "pulse", "Health", "Ready", "Workspace status", "No build issues") +
    `</div>` +
    `<div class="overview-grid"><div>` +
    `<section class="panel" data-guchho-preview="recent">` +
    panel("Recent posts", "Latest items in your content feed.", `<a class="panel-link" href="${SCREEN_ROUTES.posts}">All posts</a>`) +
    `<div class="activity-list">${recent}</div></section>` +
    `<section class="panel">` +
    panel("Preview routes", "All generated pages available in this build.") +
    `<div class="cards">${cards}</div></section></div>` +
    `<div><section class="panel">${panel("Quick actions", "Common tasks for this workspace.")}${quick}</section>` +
    `<section class="panel">${panel("Content status", "At-a-glance workspace metrics.")}${status}</section>` +
    `<section class="panel">${panel("Workspace tip")}<p class="tip">Use the sidebar to jump into posts, pages, layout, and theme. The hamburger keeps the workspace focused on smaller screens.</p></section></div></div>`
  );
}

function postsBody(): string {
  const rows = mockPosts().map((post, index) => {
    const title = toText(post["title"] ?? "");
    const url = toText(post["url"] ?? "");
    const author = AUTHORS[index % AUTHORS.length]?.name ?? "Author";
    const labels = Array.isArray(post["labels"])
      ? (post["labels"] as ValueMap[])
          .map((label) => toText(label["name"] ?? ""))
          .filter((name) => name !== "")
          .join(", ")
      : "";
    const status = postStatus(index);
    return (
      `<td><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></td>` +
      `<td>${escapeHtml(author)}</td><td>${escapeHtml(labels)}</td>` +
      `<td>${escapeHtml(toText(post["date"] ?? ""))}</td>` +
      `<td><span class="pill${status === "Draft" ? " draft" : ""}">${escapeHtml(status)}</span></td>` +
      `<td><div class="actions"><a href="${SCREEN_ROUTES["post-new"]}">Edit</a>` +
      `<a href="${escapeHtml(url)}">View</a><button type="button" class="btn">Delete</button></div></td>`
    );
  });

  return (
    header("Posts", "Manage the deterministic mock posts used by the preview.") +
    `<div class="toolbar"><input class="search" type="search" placeholder="Search posts" aria-label="Search posts">` +
    button("New post", true) + `</div>` +
    tabs(["All", "Published", "Draft", "Scheduled"]) +
    table(["Title", "Author", "Labels", "Date", "Status", "Actions"], rows) +
    `<p class="note">Static preview — toolbar and action controls are visual only.</p>`
  );
}

function pagesBody(): string {
  const rows = mockPages().map((page) => {
    const title = toText(page["title"] ?? "");
    const url = toText(page["url"] ?? "");
    const author = toText((page["author"] as ValueMap | undefined)?.["name"] ?? "Author");
    return (
      `<td><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></td>` +
      `<td>${escapeHtml(author)}</td><td>${escapeHtml(toText(page["date"] ?? ""))}</td>` +
      `<td><span class="pill">Published</span></td>` +
      `<td><div class="actions"><a href="${SCREEN_ROUTES["page-new"]}">Edit</a>` +
      `<a href="${escapeHtml(url)}">View</a><button type="button" class="btn">Delete</button></div></td>`
    );
  });

  return (
    header("Pages", "Manage the static pages in the mock blog.") +
    `<div class="toolbar"><input class="search" type="search" placeholder="Search pages" aria-label="Search pages">` +
    button("New page", true) + `</div>` +
    tabs(["All", "Published", "Draft", "Scheduled"]) +
    table(["Title", "Author", "Date", "Status", "Actions"], rows) +
    `<p class="note">Static preview — toolbar and action controls are visual only.</p>`
  );
}

function editorBody(kind: "post" | "page"): string {
  const posts = mockPosts();
  const first = posts[0] ?? {};
  const title = kind === "post" ? "New post" : "New page";
  const labels = mockLabels()
    .map((label) => {
      const name = toText(label["name"] ?? "");
      return `<label><input type="checkbox"> ${escapeHtml(name)}</label>`;
    })
    .join(" ");

  return (
    header(title, `Blogger-style ${kind} composer — static preview.`) +
    `<div class="grid2"><div>` +
    `<div class="panel"><input class="field editor-title" type="text" placeholder="Title" aria-label="Title">` +
    `<textarea class="field textarea" placeholder="Start writing…" aria-label="Body">${escapeHtml(toText(first["body"] ?? ""))}</textarea>` +
    `<div class="toolbar">${button("Publish", true)}${button("Preview")}${button("Save draft")}</div></div>` +
    `</div><div>` +
    `<div class="panel"><h3>${kind === "post" ? "Labels" : "Page options"}</h3><div>${labels}</div></div>` +
    `<div class="panel"><h3>Publish</h3><div class="setting-row"><span class="setting-label">Visibility</span><span>Public</span></div>` +
    `<div class="setting-row"><span class="setting-label">Publish</span><span>Immediately</span></div></div>` +
    `<div class="panel"><h3>Schedule</h3><div class="setting-row"><span class="setting-label">Date</span><span>None</span></div></div>` +
    `</div></div>`
  );
}

function commentsBody(postUrl: string): string {
  type CommentStatus = "published" | "awaiting" | "spam";
  const statusLabels: Record<CommentStatus, string> = {
    published: "Published",
    awaiting: "Awaiting moderation",
    spam: "Spam",
  };
  const items = mockComments(postUrl).map((comment, index) => {
    const status: CommentStatus = index === 0 ? "published" : "awaiting";
    return {
      id: toText(comment["id"] ?? ""),
      author: toText(comment["author"] ?? ""),
      authorUrl: toText(comment["authorUrl"] ?? ""),
      avatar: toText(comment["authorAvatarSrc"] ?? ""),
      body: toText(comment["body"] ?? "").replace(/<[^>]*>/g, "").trim(),
      timestamp: toText(comment["timestamp"] ?? ""),
      url: `${postUrl}#comments`,
      status,
    };
  });
  const counts = { all: items.length, published: 0, awaiting: 0, spam: 0 };
  for (const item of items) counts[item.status] += 1;

  const rows = items
    .map(
      (item) =>
        `<li class="comment-row" data-comment-row data-id="${escapeHtml(item.id)}" data-status="${item.status}">` +
        `<input class="comment-select" type="checkbox" data-comment-check ` +
        `aria-label="Select comment from ${escapeHtml(item.author)}">` +
        `<img class="comment-avatar" src="${escapeHtml(item.avatar)}" alt="">` +
        `<div class="comment-main"><div class="comment-topline">` +
        `<a class="comment-author" href="${escapeHtml(item.authorUrl)}">${escapeHtml(item.author)}</a>` +
        `<span class="comment-time">${escapeHtml(item.timestamp)}</span></div>` +
        `<p class="comment-body" data-comment-body>${escapeHtml(item.body)}</p>` +
        `<a class="comment-post" data-comment-post href="${escapeHtml(item.url)}">View post</a></div>` +
        `<span class="comment-status comment-status-${item.status}" data-comment-status>` +
        `${statusLabels[item.status]}</span>` +
        `<div class="comment-actions"><button type="button" class="comment-action" ` +
        `data-comment-action="approve">Approve</button>` +
        `<button type="button" class="comment-action" data-comment-action="spam">Spam</button>` +
        `<button type="button" class="comment-action danger" data-comment-action="delete">Delete</button>` +
        `</div></li>`
    )
    .join("");

  const statIcon = (path: string): string =>
    `<span class="comments-stat-icon"><svg viewBox="0 0 24 24" width="18" height="18" ` +
    `fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ` +
    `stroke-linejoin="round"><path d="${path}"/></svg></span>`;
  const statusTabs: Array<[CommentStatus | "all", string]> = [
    ["all", "All"],
    ["published", "Published"],
    ["awaiting", "Awaiting moderation"],
    ["spam", "Spam"],
  ];
  const tabMarkup = statusTabs
    .map(
      ([key, label], index) =>
        `<button type="button" class="comments-tab" data-comment-tab="${key}" ` +
        `aria-selected="${index === 0 ? "true" : "false"}">${label} ` +
        `<span data-comment-count="${key}">${counts[key]}</span></button>`
    )
    .join("");
  const percent = (value: number): number =>
    counts.all === 0 ? 0 : Math.round((value / counts.all) * 100);

  return (
    `<div class="comments-studio" data-guchho-preview="comments-studio">` +
    `<header class="comments-hero"><div><div class="comments-eyebrow">Comments studio</div>` +
    `<h1>Comments</h1><p class="subtitle">Review reader responses, moderate the queue, and jump back into the blog preview.</p></div>` +
    `<div class="comments-hero-actions"><button type="button" class="comment-action" ` +
    `data-comment-export>Export CSV</button>` +
    `<a class="comment-action primary" href="${SCREEN_ROUTES.settings}">Moderation settings</a></div></header>` +
    `<div class="comments-stats">` +
    `<div class="comments-stat">${statIcon("M4 5h16v11H9l-5 4V5z")}<div>` +
    `<strong data-comment-count="all">${counts.all}</strong><span>Total comments</span></div></div>` +
    `<div class="comments-stat green">${statIcon("M20 6 9 17l-5-5")}<div>` +
    `<strong data-comment-count="published">${counts.published}</strong><span>Published</span></div></div>` +
    `<div class="comments-stat amber">${statIcon("M12 8v5M12 17h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z")}<div>` +
    `<strong data-comment-count="awaiting">${counts.awaiting}</strong><span>Awaiting moderation</span></div></div>` +
    `<div class="comments-stat red">${statIcon("M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6")}<div>` +
    `<strong data-comment-count="spam">${counts.spam}</strong><span>Spam</span></div></div>` +
    `</div><div class="comments-workspace">` +
    `<section class="comments-card"><div class="comments-card-head"><div>` +
    `<h2>Moderation queue</h2><p>Deterministic preview comments — actions update this view only.</p></div>` +
    `<input class="comments-search" type="search" placeholder="Search comments" ` +
    `aria-label="Search comments" data-comment-search></div>` +
    `<div class="comments-toolbar"><label class="comments-bulk">` +
    `<input type="checkbox" data-comment-select-all> Select all visible</label>` +
    `<span class="comments-selected" data-comment-selected>0 selected</span>` +
    `<button type="button" class="btn" data-comment-delete-selected>Delete selected</button>` +
    `<div class="comments-tabs">${tabMarkup}</div></div>` +
    `<div class="comments-summary" data-comment-summary aria-live="polite">${counts.all} comments shown</div>` +
    `<ul class="comments-list">${rows}</ul>` +
    `<div class="comments-empty" data-comment-empty hidden>No comments match this view.</div></section>` +
    `<aside class="comments-aside">` +
    `<section class="comments-side"><div class="comments-side-head"><h2>Moderation health</h2>` +
    `<p>Static preview snapshot</p></div><div class="comments-side-body"><div class="comments-health">` +
    `<div class="comments-meter green"><span>Published <b data-comment-count="published">${counts.published}</b></span>` +
    `<div><i style="width:${percent(counts.published)}%"></i></div></div>` +
    `<div class="comments-meter amber"><span>Awaiting <b data-comment-count="awaiting">${counts.awaiting}</b></span>` +
    `<div><i style="width:${percent(counts.awaiting)}%"></i></div></div>` +
    `<div class="comments-meter"><span>Spam <b data-comment-count="spam">${counts.spam}</b></span>` +
    `<div><i style="width:${percent(counts.spam)}%"></i></div></div></div></div></section>` +
    `<section class="comments-side"><div class="comments-side-head"><h2>Review checklist</h2>` +
    `<p>Keep the conversation healthy</p></div><div class="comments-side-body">` +
    `<ul class="comments-guide"><li>Approve relevant replies quickly.</li>` +
    `<li>Move obvious promotions to spam.</li>` +
    `<li>Export a copy before bulk deletion.</li></ul></div></section>` +
    `</aside></div></div>`
  );
}

function layoutBody(layout: LayoutEditorInput): string {
  const model = extractLayout(layout.xml, layout.entryPath);
  const widgetTypes = [...new Set([...availableGadgetTypes(), ...(layout.widgetTypes ?? [])])];
  return layoutEditorMarkup(editorPayload(model, layout.savePort || LAYOUT_SAVE_PORT, widgetTypes));
}

function themeBody(
  templateXml: string | undefined,
  baseStyle: string
): string {
  const metadata = blogMetadata("index", PREVIEW_BLOG_URL);
  const description = toText(metadata["metaDescription"] ?? "");
  const excerpt = (templateXml ?? "").slice(0, 3000);
  const xmlPanel =
    `<section class="theme-code-panel" data-theme-panel="xml">` +
    `<div class="theme-code-head"><div><h2>Template excerpt</h2>` +
    `<p>A snapshot of the current Blogger XML source.</p></div>` +
    `<span class="theme-code-badge">XML</span></div>` +
    `<div class="theme-code-wrap">${themeCodeLines(excerpt)}</div>` +
    `<p class="theme-code-note">Showing the first ${Math.min(3000, excerpt.length)} characters of the compiled template.</p>` +
    `</section>`;
  return (
    `<div class="theme-studio" data-guchho-preview="theme-studio">` +
    `<header class="theme-hero"><div><div class="theme-eyebrow">Theme studio</div>` +
    `<h1>Theme</h1><p class="subtitle">Inspect the active template, review compiled base styles, and jump into the right editor.</p></div>` +
    `<div class="theme-hero-actions">${button("Backup", true)}` +
    `<a class="theme-action" href="${SCREEN_ROUTES.layout}">Open layout editor</a></div></header>` +
    `<div class="theme-stats">` +
    `<div class="theme-stat"><strong>${templateXml?.length ?? 0}</strong><span>Template characters</span></div>` +
    `<div class="theme-stat"><strong>${baseStyle.length}</strong><span>Base style characters</span></div>` +
    `<div class="theme-stat"><strong>template.xml</strong><span>Source of truth</span></div>` +
    `</div>` +
    `<div class="theme-overview">` +
    `<section class="theme-preview-card"><div class="theme-preview">` +
    `<div class="theme-visual" aria-hidden="true"></div><div class="theme-preview-body">` +
    `<span class="theme-status-pill">Active theme</span>` +
    `<h2>${escapeHtml(BLOG_TITLE)}</h2><p>${escapeHtml(description)}</p>` +
    `<div class="theme-hero-actions">${button("Edit HTML")}${button("Customize")}</div>` +
    `</div></div><ul class="theme-meta">` +
    `<li><div><span>Template</span><strong>Current template</strong></div></li>` +
    `<li><div><span>Editor</span><strong>Blogger XML</strong></div></li>` +
    `<li><div><span>Styles</span><strong>Base + skin CSS</strong></div></li>` +
    `<li><div><span>Preview</span><strong>Deterministic</strong></div></li>` +
    `</ul></section>` +
    `<aside class="theme-info-card"><div class="theme-info-head"><h2>Quick actions</h2>` +
    `<p>Jump between theme, layout and widget tools.</p></div>` +
    `<ul class="theme-link-list">` +
    `<li><a href="${SCREEN_ROUTES.layout}">Edit layout <small>Sections & widgets</small></a></li>` +
    `<li><a href="/__preview/widgets/">Widget showcase <small>All widget types</small></a></li>` +
    `<li><a href="${SCREEN_ROUTES.settings}">Site settings <small>Title & favicon</small></a></li>` +
    `</ul></aside></div>` +
    `<section class="theme-code-card"><div class="theme-code-toolbar">` +
    `<div class="theme-tabs" role="tablist" aria-label="Theme source">` +
    `<button type="button" class="theme-tab" role="tab" data-theme-tab="xml" aria-selected="true">Template XML</button>` +
    `<button type="button" class="theme-tab" role="tab" data-theme-tab="style" aria-selected="false">Base style</button>` +
    `</div><div class="theme-code-tools">` +
    `<input class="theme-code-search" type="search" data-theme-search placeholder="Search lines..." aria-label="Search source lines" />` +
    `<button type="button" class="theme-copy" data-theme-copy>Copy</button>` +
    `<span class="theme-code-status" data-theme-status></span></div></div>` +
    xmlPanel +
    baseStylePanel(baseStyle) +
    `</section></div>`
  );
}

function settingsIcon(name: string): string {
  const paths: Record<string, string> = {
    identity: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    publish: '<path d="M5 12h14M13 6l6 6-6 6M5 4h6"/>',
    comments: '<path d="M4 5h16v11H9l-5 4V5z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.2-2.2-.9-1.1-.2-2.8 1.3-2.8H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  return (
    `<span class="settings-card-icon" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24">${paths[name] ?? paths.more ?? ""}</svg></span>`
  );
}

function settingsCard(icon: string, title: string, subtitle: string, body: string): string {
  return (
    `<section class="panel settings-card">` +
    `<div class="settings-card-head">${settingsIcon(icon)}<div>` +
    `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p>` +
    `</div></div><div class="settings-card-body">${body}</div></section>`
  );
}

function settingsField(
  label: string,
  id: string,
  control: string,
  help = "",
  full = false
): string {
  return (
    `<label class="settings-field${full ? " full" : ""}" for="${id}">` +
    `<span>${escapeHtml(label)}</span>${control}` +
    (help === "" ? "" : `<small>${escapeHtml(help)}</small>`) +
    `</label>`
  );
}

function settingsText(id: string, value: string, extra = ""): string {
  return `<input id="${id}" type="text" value="${escapeHtml(value)}"${extra}>`;
}

function settingsTextarea(id: string, value: string): string {
  return `<textarea id="${id}">${escapeHtml(value)}</textarea>`;
}

function settingsSelect(
  id: string,
  options: ReadonlyArray<readonly [string, string]>,
  selected: string
): string {
  return (
    `<select id="${id}">` +
    options
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>` +
          `${escapeHtml(label)}</option>`
      )
      .join("") +
    `</select>`
  );
}

function settingsToggle(id: string, label: string, help: string, checked: boolean): string {
  return (
    `<label class="settings-toggle" for="${id}"><span>` +
    `<strong>${escapeHtml(label)}</strong><small>${escapeHtml(help)}</small>` +
    `</span><span class="settings-switch">` +
    `<input id="${id}" type="checkbox"${checked ? " checked" : ""}><span></span>` +
    `</span></label>`
  );
}

function settingsBody(favicon: string): string {
  const metadata = blogMetadata("index", PREVIEW_BLOG_URL, favicon);
  const title = toText(metadata["title"] ?? "");
  const description = toText(metadata["metaDescription"] ?? "");
  const language = toText(metadata["language"] ?? "");
  const faviconSource = escapeHtml(faviconHref(favicon));

  return (
    header("Settings", "Shape how your blog looks and behaves across the preview.") +
    `<div class="settings-shell" data-guchho-preview="settings-form"><div class="settings-main">` +
    settingsCard(
      "identity",
      "Identity",
      "The name, description and icon readers see first.",
      `<div class="settings-grid">` +
      settingsField(
        "Blog title",
        "settings-title",
        settingsText("settings-title", title),
        "Shown in the header, browser results and live preview.",
        true
      ) +
      settingsField(
        "Description",
        "settings-description",
        settingsTextarea("settings-description", description),
        "A short summary used by search and social previews.",
        true
      ) +
      settingsField(
        "Favicon URL",
        "settings-favicon",
        settingsText(
          "settings-favicon",
          favicon,
          ` placeholder="${DEFAULT_FAVICON_URL}"`
        ),
        "Use a site URL, root path, or paste an image data URL.",
        true
      ) +
      `<div class="settings-upload">` +
      `<label class="settings-upload-button" for="settings-favicon-file">Choose image</label>` +
      `<input id="settings-favicon-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml">` +
      `<span class="settings-file-name"><img src="${faviconSource}" alt=""><span>${escapeHtml(favicon)}</span></span>` +
      `</div>` +
      settingsField(
        "Language",
        "settings-language",
        settingsSelect(
          "settings-language",
          [
            ["en", "English"],
            ["es", "Español"],
            ["fr", "Français"],
            ["de", "Deutsch"],
          ],
          language
        )
      ) +
      settingsField(
        "Time zone",
        "settings-timezone",
        settingsSelect(
          "settings-timezone",
          [
            ["UTC", "UTC"],
            ["America/New_York", "New York"],
            ["Europe/London", "London"],
            ["Asia/Kolkata", "Kolkata"],
          ],
          "UTC"
        )
      ) +
      `</div>`
    ) +
    settingsCard(
      "publish",
      "Publishing",
      "Control the address and shape of your blog feed.",
      `<div class="settings-grid">` +
      settingsField(
        "Blog address",
        "settings-blog-address",
        settingsText("settings-blog-address", PREVIEW_BLOG_URL, " readonly"),
        "Deterministic local preview address.",
        true
      ) +
      settingsField(
        "Posts per page",
        "settings-posts-per-page",
        settingsSelect(
          "settings-posts-per-page",
          [
            ["5", "5 posts"],
            ["10", "10 posts"],
            ["15", "15 posts"],
            ["20", "20 posts"],
          ],
          "10"
        )
      ) +
      settingsField(
        "Permalink style",
        "settings-permalink",
        settingsSelect(
          "settings-permalink",
          [
            ["default", "Default"],
            ["date", "Date based"],
            ["title", "Post title"],
          ],
          "default"
        )
      ) +
      `</div>`
    ) +
    settingsCard(
      "comments",
      "Comments",
      "Set the default conversation rules for new posts.",
      settingsToggle(
        "settings-comment-moderation",
        "Comment moderation",
        "Review comments before they appear.",
        false
      ) +
      `<div class="settings-grid">` +
      settingsField(
        "Who can comment",
        "settings-who-can-comment",
        settingsSelect(
          "settings-who-can-comment",
          [
            ["Anyone", "Anyone"],
            ["Registered users", "Registered users"],
            ["Only me", "Only me"],
          ],
          "Anyone"
        ),
        "",
        true
      ) +
      `</div>` +
      settingsToggle(
        "settings-enable-profile-images",
        "Profile images",
        "Show avatars beside comments.",
        true
      )
    ) +
    settingsCard(
      "palette",
      "Style",
      "Tune the accent color and corner softness.",
      `<div class="settings-grid">` +
      settingsField(
        "Accent color",
        "settings-accent",
        `<input id="settings-accent" type="color" value="#1a73e8">`,
        "Applied to the live preview card."
      ) +
      settingsField(
        "Corner radius",
        "settings-radius",
        settingsSelect(
          "settings-radius",
          [
            ["0", "Sharp"],
            ["8", "Soft"],
            ["12", "Rounded"],
            ["18", "Pill"],
          ],
          "12"
        ),
        "Changes the preview post card."
      ) +
      `</div>`
    ) +
    settingsCard(
      "more",
      "More options",
      "Extra preview details and visibility controls.",
      settingsToggle(
        "settings-show-title",
        "Show blog title",
        "Display the title in the live preview.",
        true
      ) +
      settingsToggle(
        "settings-show-description",
        "Show description",
        "Display the short summary in the live preview.",
        true
      ) +
      settingsToggle(
        "settings-show-sharing",
        "Show sharing links",
        "Display share and email chips in the live preview.",
        true
      ) +
      `<div class="settings-grid">` +
      settingsField(
        "Analytics ID",
        "settings-analytics",
        settingsText("settings-analytics", "", ' placeholder="UA-000000-1"'),
        "Stored locally for preview only.",
        true
      ) +
      `</div>`
    ) +
    `<div class="settings-actions">` +
    `<button type="button" class="btn btn-primary" id="settings-save" ` +
    `data-guchho-preview="settings-save">Save changes</button>` +
    `<button type="button" class="btn" id="settings-reset">Reset</button>` +
    `<span class="settings-status" id="settings-status" data-state="saved" aria-live="polite">Ready</span>` +
    `</div>` +
    `</div><aside class="settings-aside">` +
    `<section class="panel settings-preview" id="settings-preview">` +
    `<div class="settings-preview-cover"></div><div class="settings-preview-body">` +
    `<div class="settings-preview-avatar"><img id="settings-preview-favicon" src="${faviconSource}" alt=""></div>` +
    `<div class="settings-preview-kicker">Live preview</div>` +
    `<h2 id="settings-preview-title">${escapeHtml(title)}</h2>` +
    `<p id="settings-preview-description">${escapeHtml(description)}</p>` +
    `<div class="settings-preview-url" id="settings-preview-url">${escapeHtml(PREVIEW_BLOG_URL)}</div>` +
    `<div class="settings-preview-tags"><span class="settings-chip">Preview</span><span class="settings-chip">Local draft</span></div>` +
    `<div class="settings-preview-post"><span class="settings-pill">Sample post</span>` +
    `<strong>How your blog will look</strong><small>Updates as you type</small></div>` +
    `<div class="settings-preview-sharing" id="settings-preview-sharing">` +
    `<span>Share</span><span>Email</span></div>` +
    `</div><p class="settings-preview-note" id="settings-preview-meta">10 posts per page · ${escapeHtml(language)}</p>` +
    `</section><section class="panel"><h3>Quick tips</h3><ul class="settings-tip-list">` +
    `<li>Upload a square PNG or SVG for the sharpest favicon.</li>` +
    `<li>Keep the description under 160 characters for clean previews.</li>` +
    `<li>Changes are stored in this browser only.</li>` +
    `</ul></section></aside></div>` +
    `<p class="note">Static preview — settings are saved in this browser and do not modify template.xml.</p>`
  );
}

export function buildDashboardScreens(
  pages: readonly DashboardPageRef[],
  templateXml?: string,
  baseStyle = "",
  layout: LayoutEditorInput = {
    xml: templateXml ?? "",
    entryPath: "src/template.xml",
    css: baseStyle,
    savePort: 3001,
  },
  favicon = PREVIEW_FAVICON,
  content?: ContentDashboardOptions,
): DashboardScreen[] {
  const contentInput = content === undefined ? undefined : {
    ...content,
    routes: {
      posts: SCREEN_ROUTES.posts,
      pages: SCREEN_ROUTES.pages,
      postNew: SCREEN_ROUTES["post-new"],
      pageNew: SCREEN_ROUTES["page-new"],
    },
  };
  const postRoute = pages.find(
    (page) => page.file === "post.html" || page.file.startsWith("post-")
  )?.route;
  const postUrl =
    postRoute === undefined
      ? new URL("2026/01/getting-started-with-guchho.html", PREVIEW_BLOG_URL).toString()
      : new URL(postRoute, PREVIEW_BLOG_URL).toString();
  const bodies: Record<DashboardScreenKey, string> = {
    overview:
      contentInput === undefined ? overviewBody(pages) : contentOverviewBody(pages, contentInput),
    posts: contentInput === undefined ? postsBody() : contentPostsBody(contentInput),
    "post-new":
      contentInput === undefined ? editorBody("post") : contentEditorBody("post", contentInput),
    pages: contentInput === undefined ? pagesBody() : contentPagesBody(contentInput),
    "page-new":
      contentInput === undefined ? editorBody("page") : contentEditorBody("page", contentInput),
    comments: commentsBody(postUrl),
    layout: layoutBody(layout),
    theme: themeBody(templateXml, baseStyle),
    settings: settingsBody(favicon),
  };
  const titles: Record<DashboardScreenKey, string> = {
    overview: "Dashboard",
    posts: "Posts",
    "post-new": "New post",
    pages: "Pages",
    "page-new": "New page",
    comments: "Comments",
    layout: "Layout",
    theme: "Theme",
    settings: "Settings",
  };

  return (Object.keys(SCREEN_ROUTES) as DashboardScreenKey[]).map((key) => ({
    file: SCREEN_FILES[key],
    route: SCREEN_ROUTES[key],
    title: titles[key],
    html: shell(key, titles[key], bodies[key], pages, favicon),
  }));
}
