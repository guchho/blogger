import {
  AUTHORS,
  mockComments,
  mockLabels,
  mockPages,
  mockPosts,
} from "./data/mock.js";
import { extractLayout } from "../layout/extract.js";
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

const STYLE = `
:root{color-scheme:light;--bg:#f6f7f9;--panel:#fff;--line:#e2e5ea;--line-soft:#eef1f5;--ink:#1f2329;--muted:#667085;--accent:#1a73e8;--accent-dark:#1558b8;--shadow:0 1px 2px rgba(15,23,42,.06),0 10px 28px rgba(15,23,42,.08);--radius:10px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.topbar{display:flex;align-items:center;gap:12px;height:56px;padding:0 20px;background:#202124;color:#fff}
.brand{font-weight:700;font-size:17px;letter-spacing:.2px}
.badge{padding:2px 7px;border-radius:10px;background:#3c4043;color:#e8eaed;font-size:11px}
.spacer{flex:1}
.blog{padding:4px 10px;border:1px solid #5f6368;border-radius:4px;color:#e8eaed;font-size:12px}
.top-link{color:#e8eaed;border:1px solid #5f6368;border-radius:4px;padding:4px 10px;font-size:12px}
.layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 56px)}
.sidebar{background:var(--panel);border-right:1px solid var(--line);padding:18px 12px}
.group{margin-bottom:18px}
.group-title{padding:0 10px;margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.nav-item{display:block;padding:8px 10px;border-radius:5px;color:var(--ink)}
.nav-item:hover,.nav-item.active{background:#e8f0fe;text-decoration:none;color:var(--accent)}
.content{padding:28px 32px;max-width:1180px}
.layout[data-screen="layout"] .content{max-width:1320px}
h1{margin:0 0 4px;font-size:24px}
h2{margin:0 0 12px;font-size:16px}
.subtitle{margin:0 0 22px;color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:24px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.stat-value{font-size:22px;font-weight:700}
.stat-label{color:var(--muted);font-size:12px}
.section-title{margin:0 0 12px;font-size:16px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:28px}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;color:var(--ink)}
.card:hover{border-color:var(--accent);text-decoration:none}
.card-title{font-weight:600;margin-bottom:6px}
.card-route{color:var(--muted);font-size:12px;word-break:break-all}
.recent{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:24px}
.recent-item{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid var(--line)}
.recent-item:last-child{border-bottom:0}
.recent-meta{color:var(--muted);font-size:12px}
.toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.btn{font:inherit;padding:7px 14px;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--ink);cursor:pointer}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.search{padding:7px 10px;border:1px solid var(--line);border-radius:4px;font:inherit;min-width:220px;background:var(--panel)}
.tabs{display:flex;gap:18px;border-bottom:1px solid var(--line);margin-bottom:14px}
.tab{padding:8px 2px;color:var(--muted);border-bottom:2px solid transparent}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}
.table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:24px}
.table th,.table td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.table th{color:var(--muted);font-size:12px;font-weight:600;background:#fafbfc}
.table tr:last-child td{border-bottom:0}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;background:#e8f0fe;color:var(--accent);font-size:11px}
.pill.draft{background:#fef7e0;color:#b06000}
.actions{display:flex;gap:10px;flex-wrap:wrap;font-size:12px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin-bottom:14px}
.panel h3{margin:0 0 10px;font-size:14px}
.grid2{display:grid;grid-template-columns:1fr 260px;gap:18px;align-items:start}
.field{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:4px;font:inherit;background:var(--panel);margin-bottom:12px}
.editor-title{font-size:20px!important}
.textarea{min-height:260px;resize:vertical;font:14px/1.6 inherit}
.code{background:#202124;color:#e8eaed;padding:14px;border-radius:6px;overflow:auto;max-height:280px;font:12px/1.5 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;word-break:break-word;margin:0}
.theme-card{display:flex;align-items:center;gap:16px}
.thumb{width:96px;height:64px;border-radius:4px;background:linear-gradient(135deg,#1a73e8,#00c2ff);flex:none}
.setting-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line)}
.setting-row:last-child{border-bottom:0}
.setting-label{color:var(--muted)}
.setting-favicon{display:inline-flex;align-items:center;gap:8px}
.setting-favicon img{width:18px;height:18px;object-fit:contain;border:1px solid var(--line);border-radius:3px;background:#fff}
.note{color:var(--muted);font-size:12px;margin-top:8px}
.base-style{margin-top:24px}
.base-style h2{margin-bottom:10px}
.layout-editor-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}
.layout-editor-heading{display:flex;flex-direction:column;gap:2px}
.layout-editor-eyebrow{color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.layout-editor-head h1{margin:0;font-size:28px;letter-spacing:-.02em}
.layout-editor-head .subtitle{margin:2px 0 0;max-width:760px}
.layout-editor-summary{flex:none;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--muted);font-size:12px;box-shadow:var(--shadow)}
.layout-editor-toolbar{position:sticky;top:12px;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius);background:rgba(255,255,255,.94);box-shadow:var(--shadow)}
.layout-editor-toolbar .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:88px;border-radius:7px;font-weight:600;transition:transform .12s ease,border-color .12s ease,background .12s ease}
.layout-editor-toolbar .btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.layout-editor-toolbar .btn:hover{transform:translateY(-1px)}
.layout-editor-toolbar .btn:disabled{opacity:.5;cursor:default;transform:none}
.layout-editor-toolbar .note{margin:0 0 0 auto;font-size:12px}
.layout-editor-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px}
.layout-editor-status::before{content:"";width:7px;height:7px;border-radius:50%;background:#12b76a}
.layout-editor-status[data-state="dirty"]{background:#fff7e6;color:#b54708}
.layout-editor-status[data-state="dirty"]::before{background:#f79009}
.layout-editor-message{margin:0 0 16px;padding:11px 14px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;background:#fff;color:var(--ink);box-shadow:var(--shadow)}
.layout-editor-message.error{border-left-color:#dc2626;background:#fef2f2;color:#991b1b}
.layout-editor-message.ok{border-left-color:#12b76a;background:#f0fdf4;color:#166534}
.layout-editor-canvas{margin-top:8px;min-height:280px;padding:18px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(180deg,#fbfcfe,#f7f9fc);box-shadow:inset 0 1px 0 #fff}
.layout-editor-dialog{width:min(440px,calc(100vw - 32px));padding:0;border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 64px rgba(15,23,42,.24);overflow:hidden}
.layout-editor-dialog::backdrop{background:rgba(15,23,42,.5)}
.layout-editor-dialog-head{padding:18px 20px;border-bottom:1px solid var(--line-soft);background:#fafbfc}
.layout-editor-dialog-head h2{margin:0;font-size:18px;letter-spacing:-.01em}
.layout-editor-dialog-body{padding:18px 20px 4px}
.layout-editor-field{display:block;margin-bottom:12px;font-size:12px;font-weight:600;color:var(--muted)}
.layout-editor-field span{display:block;margin-bottom:5px}
.layout-editor-check{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:13px}
.layout-editor-check input{width:16px;height:16px;accent-color:var(--accent)}
.layout-editor-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin:0;padding:14px 20px 18px;border-top:1px solid var(--line-soft);background:#fafbfc}
[hidden]{display:none!important}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
@media(max-width:760px){.layout{grid-template-columns:1fr}.sidebar{border-right:0;border-bottom:1px solid var(--line)}.stats{grid-template-columns:1fr}}
`;

interface NavEntry {
  label: string;
  route: string;
  active: boolean;
}

function routeFor(pages: readonly DashboardPageRef[], title: string): string {
  return pages.find((page) => page.title === title)?.route ?? "/";
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

function baseStylePanel(css: string): string {
  const content =
    css === ""
      ? `<p class="note">No base style found in template.xml.</p>`
      : `<pre class="code">${escapeHtml(css.slice(0, BASE_STYLE_LIMIT))}</pre>` +
        (css.length > BASE_STYLE_LIMIT
          ? `<p class="note">Showing first ${BASE_STYLE_LIMIT} of ${css.length} characters.</p>`
          : "");
  return (
    `<section class="base-style" data-guchho-preview="base-style">` +
    `<h2>Base style (template.xml)</h2>${content}</section>`
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
        { label: "View blog", route: routeFor(pages, "Home"), active: false },
        { label: "Widgets showcase", route: routeFor(pages, "Widgets"), active: false },
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
  if (value === "") return "/favicon.ico";
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
              `${escapeHtml(item.label)}</a>`
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
    `<header class="topbar"><span class="brand">Blogger</span>` +
    `<span class="badge">Preview</span><span class="spacer"></span>` +
    `<a class="top-link" href="${escapeHtml(routeFor(pages, "Home"))}">View blog</a>` +
    `<span class="blog">${escapeHtml(BLOG_TITLE)}</span></header>` +
    `<div class="layout" data-guchho-preview="dashboard-screen" data-screen="${key}">` +
    `<aside class="sidebar">${nav}</aside><main class="content">${body}</main></div>` +
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
    .slice(0, 3)
    .map((post) => {
      const title = toText(post["title"] ?? "");
      const url = toText(post["url"] ?? "");
      return (
        `<div class="recent-item"><a href="${escapeHtml(url)}">${escapeHtml(title)}</a>` +
        `<span class="recent-meta">Published · Mock content</span></div>`
      );
    })
    .join("");

  return (
    header("Dashboard", "Mock preview workspace — rendered from deterministic sample data.") +
    `<div class="stats">` +
    `<div class="stat"><div class="stat-value">${pages.length}</div><div class="stat-label">Preview pages</div></div>` +
    `<div class="stat"><div class="stat-value">${mockPosts().length}</div><div class="stat-label">Posts</div></div>` +
    `<div class="stat"><div class="stat-value">Ready</div><div class="stat-label">Preview status</div></div>` +
    `</div><h2>Preview pages</h2><div class="cards">${cards}</div>` +
    `<h2>Recent posts</h2><div class="recent">${recent}</div>` +
    `<div class="toolbar">${button("New post", true)}${button("New page")}</div>`
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

function commentsBody(): string {
  const rows = mockComments().map((comment) => {
    const author = toText(comment["author"] ?? "");
    const body = toText(comment["body"] ?? "");
    const url = toText(comment["url"] ?? "");
    return (
      `<td>${escapeHtml(author)}</td><td>${escapeHtml(body)}</td>` +
      `<td><a href="${escapeHtml(url)}">View post</a></td>` +
      `<td><span class="pill">Published</span></td>` +
      `<td><div class="actions"><button type="button" class="btn">Approve</button>` +
      `<button type="button" class="btn">Spam</button><button type="button" class="btn">Delete</button></div></td>`
    );
  });

  return (
    header("Comments", "Moderation queue from deterministic mock comments.") +
    `<div class="toolbar"><input class="search" type="search" placeholder="Search comments" aria-label="Search comments">` +
    button("Delete selected") + `</div>` +
    tabs(["All", "Published", "Awaiting moderation", "Spam"]) +
    table(["Author", "Comment", "Post", "Status", "Actions"], rows)
  );
}

function layoutBody(layout: LayoutEditorInput): string {
  const model = extractLayout(layout.xml, layout.entryPath);
  return layoutEditorMarkup(editorPayload(model, layout.savePort || LAYOUT_SAVE_PORT));
}

function themeBody(
  templateXml: string | undefined,
  baseStyle: string
): string {
  const metadata = blogMetadata("index", PREVIEW_BLOG_URL);
  const description = toText(metadata["metaDescription"] ?? "");
  const excerpt = (templateXml ?? "").slice(0, 3000);
  return (
    header("Theme", "Current template and a snippet of the compiled Blogger XML.") +
    `<div class="panel"><div class="theme-card"><div class="thumb"></div><div>` +
    `<h2>${escapeHtml(BLOG_TITLE)}</h2><p class="subtitle">${escapeHtml(description)}</p>` +
    `<div class="toolbar">${button("Backup", true)}${button("Edit HTML")}${button("Customize")}</div>` +
    `</div></div></div>` +
    `<h2>Template excerpt</h2><pre class="code">${escapeHtml(excerpt)}</pre>` +
    `<p class="note">Showing the first ${Math.min(3000, excerpt.length)} characters of the compiled template.</p>` +
    baseStylePanel(baseStyle)
  );
}

function settingsBody(favicon: string): string {
  const metadata = blogMetadata("index", PREVIEW_BLOG_URL, favicon);
  const title = toText(metadata["title"] ?? "");
  const description = toText(metadata["metaDescription"] ?? "");
  const language = toText(metadata["language"] ?? "");

  return (
    header("Settings", "Blog settings mirrored from the deterministic preview metadata.") +
    `<div class="panel"><h3>Basic info</h3>` +
    `<div class="setting-row"><span class="setting-label">Title</span><span>${escapeHtml(title)}</span></div>` +
    `<div class="setting-row"><span class="setting-label">Description</span><span>${escapeHtml(description)}</span></div>` +
    `<div class="setting-row"><span class="setting-label">Language</span><span>${escapeHtml(language)}</span></div>` +
    `</div><div class="panel"><h3>Publishing</h3>` +
    `<div class="setting-row"><span class="setting-label">Blog address</span><span>${escapeHtml(PREVIEW_BLOG_URL)}</span></div>` +
    `<div class="setting-row"><span class="setting-label">Favicon</span>` +
    `<span class="setting-favicon"><img src="${escapeHtml(faviconHref(favicon))}" alt="">` +
    `<span>${escapeHtml(favicon)}</span></span></div>` +
    `<div class="setting-row"><span class="setting-label">Posts per page</span><span>10</span></div></div>` +
    `<div class="panel"><h3>Comments</h3>` +
    `<div class="setting-row"><span class="setting-label">Comment moderation</span><span>Off</span></div>` +
    `<div class="setting-row"><span class="setting-label">Who can comment</span><span>Anyone</span></div></div>` +
    `<p class="note">Static preview — settings are read-only.</p>`
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
  favicon = PREVIEW_FAVICON
): DashboardScreen[] {
  const bodies: Record<DashboardScreenKey, string> = {
    overview: overviewBody(pages),
    posts: postsBody(),
    "post-new": editorBody("post"),
    pages: pagesBody(),
    "page-new": editorBody("page"),
    comments: commentsBody(),
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
