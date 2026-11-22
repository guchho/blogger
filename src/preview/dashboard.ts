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
import { DASHBOARD_NAV_SCRIPT } from "../dashboard/navigation-script.js";
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
.nav-toggle{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;padding:0;border:1px solid #5f6368;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
.nav-toggle:hover{background:rgba(255,255,255,.12)}
.nav-toggle:focus-visible{outline:2px solid #8ab4f8;outline-offset:2px}
.nav-toggle-bars{position:relative;display:block;width:16px;height:12px}
.nav-toggle-bars span{position:absolute;left:0;width:16px;height:2px;border-radius:1px;background:currentColor;transition:top .18s ease,opacity .18s ease,transform .18s ease}
.nav-toggle-bars span:nth-child(1){top:0}
.nav-toggle-bars span:nth-child(2){top:5px}
.nav-toggle-bars span:nth-child(3){top:10px}
.nav-toggle[aria-expanded="true"] .nav-toggle-bars span:nth-child(1){top:5px;transform:rotate(45deg)}
.nav-toggle[aria-expanded="true"] .nav-toggle-bars span:nth-child(2){opacity:0}
.nav-toggle[aria-expanded="true"] .nav-toggle-bars span:nth-child(3){top:5px;transform:rotate(-45deg)}
.layout{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:calc(100vh - 56px);transition:grid-template-columns .2s ease}
.layout[data-nav="closed"],.layout[data-screen="layout"][data-nav="closed"]{grid-template-columns:0 minmax(0,1fr)}
.layout[data-nav="closed"] .sidebar{padding-left:0;padding-right:0;border-right:0;overflow:hidden}
.layout[data-nav="closed"] .sidebar>*{visibility:hidden}
.nav-backdrop{display:none}
.sidebar{background:var(--panel);border-right:1px solid var(--line);padding:18px 12px;overflow:auto}
.group{margin-bottom:18px}
.group-title{padding:0 10px;margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:5px;color:var(--ink)}
.nav-item:hover,.nav-item.active{background:#e8f0fe;text-decoration:none;color:var(--accent)}
.nav-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;flex:none;opacity:.75}
.nav-item.active .nav-icon{opacity:1}
.content{padding:32px 36px 40px;max-width:1240px}
.layout[data-screen="layout"] .content{max-width:1320px}
.layout[data-screen="layout"]{grid-template-columns:220px minmax(0,1fr);background:#f1f3f4}
.layout[data-screen="layout"] .sidebar{position:sticky;top:0;height:calc(100vh - 56px);overflow:auto;padding:22px 12px}
.layout[data-screen="layout"] .content{width:100%;max-width:none;padding:30px clamp(22px,4vw,64px)}
.layout[data-screen="layout"] .topbar{height:64px;background:#fff;color:#5f6368;border-bottom:1px solid #dadce0;padding:0 28px;box-shadow:0 1px 2px rgba(60,64,67,.12)}
.layout[data-screen="layout"] .brand{color:#4285f4;font-size:20px;font-weight:600}
.layout[data-screen="layout"] .badge{background:#e8f0fe;color:#1967d2}
.layout[data-screen="layout"] .top-link{color:#1967d2;border-color:#dadce0}
.layout[data-screen="layout"] .blog{color:#5f6368;border-color:#dadce0}
.layout[data-screen="layout"] .nav-item.active{border-radius:0 22px 22px 0;background:#e8f0fe;color:#1967d2;font-weight:600}
h1{margin:0 0 6px;font-size:30px;line-height:1.2;letter-spacing:-.02em}
h2{margin:0 0 14px;font-size:17px;letter-spacing:-.01em}
.subtitle{margin:0 0 24px;color:var(--muted);font-size:14px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:24px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.stat-value{font-size:22px;font-weight:700}
.stat-label{color:var(--muted);font-size:12px}
.section-title{margin:0 0 12px;font-size:16px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:28px}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;color:var(--ink);box-shadow:var(--shadow);transition:border-color .15s ease,transform .15s ease}
.card:hover{border-color:#b8d3ff;text-decoration:none;transform:translateY(-1px)}
.card-title{font-weight:600;margin-bottom:6px}
.card-route{color:var(--muted);font-size:12px;word-break:break-all}
.recent{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:24px}
.recent-item{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid var(--line)}
.recent-item:last-child{border-bottom:0}
.recent-meta{color:var(--muted);font-size:12px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:0 0 22px;margin-bottom:24px;border-bottom:1px solid var(--line)}
.page-head .subtitle{margin:0;max-width:640px}
.eyebrow{margin:0 0 8px;color:var(--accent);font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}
.page-head-actions{display:flex;gap:10px;flex:none}
.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}
.kpi-card{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;box-shadow:var(--shadow)}
.kpi-card:after{content:"";position:absolute;right:-28px;top:-28px;width:96px;height:96px;border-radius:50%;background:var(--tint);opacity:.5}
.kpi-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.kpi-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:var(--tint);color:var(--tone)}
.kpi-flag{color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.kpi-value{font-size:30px;font-weight:750;line-height:1;letter-spacing:-.03em}
.kpi-label{margin-top:6px;color:var(--muted);font-size:12px;font-weight:600}
.kpi-foot{margin-top:12px;padding-top:10px;border-top:1px solid var(--line-soft);color:var(--muted);font-size:11px}
.kpi-blue{--tone:#1a73e8;--tint:#e8f0fe}
.kpi-green{--tone:#12b76a;--tint:#e7f7ef}
.kpi-amber{--tone:#b06000;--tint:#fef7e0}
.kpi-purple{--tone:#7b4dd8;--tint:#f1ebfd}
.overview-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}
.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.panel-head h2{margin:0}
.panel-sub{margin:4px 0 0;color:var(--muted);font-size:12px}
.panel-link{flex:none;font-size:12px;font-weight:600}
.activity-list{border-top:1px solid var(--line-soft)}
.activity-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line-soft)}
.activity-item:last-child{border-bottom:0}
.activity-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border-radius:8px;background:#eef2f7;color:var(--muted)}
.activity-body{min-width:0;flex:1}
.activity-title{display:block;color:var(--ink);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.activity-meta{display:block;margin-top:2px;color:var(--muted);font-size:11px}
.activity-status{flex:none}
.route-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.route-card{display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid var(--line-soft);border-radius:8px;background:#fafbfc;color:var(--ink)}
.route-card:hover{border-color:var(--accent);background:#f5f9ff;text-decoration:none}
.route-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border-radius:6px;background:#e8f0fe;color:var(--accent)}
.route-name{display:block;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.route-path{display:block;color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.quick-list{display:grid;gap:8px}
.quick-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;background:#fafbfc;color:var(--ink);font-size:13px;font-weight:600}
.quick-item:hover{border-color:var(--accent);background:#f5f9ff;text-decoration:none}
.status-row{padding:9px 0;border-bottom:1px solid var(--line-soft)}
.status-row:last-child{border-bottom:0}
.status-label{display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;color:var(--muted);font-size:12px}
.status-value{color:var(--ink);font-weight:700}
.status-bar{height:6px;border-radius:99px;background:#eef1f5;overflow:hidden}
.status-fill{display:block;height:100%;border-radius:99px;background:var(--accent)}
.tip{margin:0;color:var(--muted);font-size:12px;line-height:1.6}
.toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;padding:8px 14px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);cursor:pointer;font-weight:600;transition:background .15s ease,border-color .15s ease,transform .15s ease}
.btn:hover{background:#f6f9ff;border-color:#b8d3ff;text-decoration:none;transform:translateY(-1px)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-dark);border-color:var(--accent-dark)}
.btn-ghost{padding:5px 8px;border-color:transparent;background:transparent;color:var(--muted);font-size:12px}
.btn-ghost:hover{background:#f0f5ff;border-color:#d9e7ff;color:var(--accent);transform:none}
.btn-ghost.danger:hover{background:#fff1f1;border-color:#ffd7d7;color:#c62828}
.search{padding:7px 10px;border:1px solid var(--line);border-radius:4px;font:inherit;min-width:220px;background:var(--panel)}
.tabs{display:inline-flex;gap:4px;padding:4px;margin-bottom:16px;border:1px solid var(--line);border-radius:10px;background:#f7f9fc}
.tab{appearance:none;border:0;background:transparent;padding:8px 14px;border-radius:7px;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s ease,color .15s ease,box-shadow .15s ease}
.tab:hover{color:var(--ink);background:#eef3fb}
.tab.active{color:var(--accent);background:var(--panel);box-shadow:0 1px 2px rgba(15,23,42,.08)}
.tab:focus-visible{outline:2px solid #8ab4f8;outline-offset:1px}
.table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:24px}
.table th,.table td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.table th{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;background:#fafbfc}
.table tbody tr:hover td{background:#fbfdff}
.table tr:last-child td{border-bottom:0}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;background:#e8f0fe;color:var(--accent);font-size:11px}
.pill.draft{background:#fef7e0;color:#b06000}
.actions{display:flex;gap:10px;flex-wrap:wrap;font-size:12px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)}
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
.layout-editor-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px;padding-bottom:17px;border-bottom:1px solid #dadce0}
.layout-editor-heading{display:flex;flex-direction:column;gap:2px}
.layout-editor-eyebrow{color:#5f6368;font-size:12px;font-weight:500;letter-spacing:0;text-transform:none}
.layout-editor-head h1{margin:0;font-size:26px;font-weight:400;letter-spacing:0}
.layout-editor-head .subtitle{margin:2px 0 0;max-width:760px}
.layout-editor-summary{flex:none;padding:6px 10px;border:1px solid #dadce0;border-radius:4px;background:#fff;color:#5f6368;font-size:12px;box-shadow:none}
.layout-editor-toolbar{position:sticky;top:10px;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:10px 12px;border:1px solid #dadce0;border-radius:4px;background:rgba(255,255,255,.97);box-shadow:0 1px 2px rgba(60,64,67,.12)}
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
.layout-editor-canvas{margin-top:8px;min-height:320px;padding:20px;border:1px solid #dadce0;border-radius:4px;background:#e8eaed;box-shadow:none}
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
.editor-toolbars{position:sticky;top:0;z-index:6;margin:-2px -2px 12px;padding:8px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.97);box-shadow:0 1px 2px rgba(15,23,42,.06);backdrop-filter:blur(6px)}
.editor-toolbar{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.editor-toolbar+.editor-toolbar{margin-top:6px;padding-top:6px;border-top:1px solid var(--line-soft)}
.editor-tool-group{display:flex;align-items:center;gap:2px}
.editor-tool{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:30px;height:30px;padding:0 6px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
.editor-tool svg{display:block;flex:none}
.editor-tool:hover:not(:disabled),.editor-tool.active{background:#e8f0fe;border-color:#c6dafc;color:var(--accent);text-decoration:none}
.editor-tool:focus-visible,.editor-select:focus-visible,.editor-color input:focus-visible{outline:2px solid #8ab4f8;outline-offset:1px}
.editor-tool:disabled{opacity:.4;cursor:default}
.editor-view-button{min-width:58px;font-size:12px;font-weight:600}
.editor-separator{width:1px;height:20px;margin:0 5px;background:var(--line)}
.editor-select{height:30px;max-width:160px;padding:0 6px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--ink);font:inherit;font-size:12px}
.editor-select-size{width:66px}
.editor-color{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);border-radius:5px;background:var(--panel);cursor:pointer;overflow:hidden}
.editor-color input{position:absolute;right:2px;bottom:1px;left:2px;width:calc(100% - 4px);height:5px;padding:0;border:0;background:transparent;cursor:pointer}
.editor-color-letter{font-size:13px;font-weight:700;line-height:1}
.editor-color-highlight{background:linear-gradient(transparent 60%,#fff3b0 60%)}
.editor-menu{position:relative}
.editor-menu-button>svg:last-child{width:12px;height:12px;opacity:.7}
.editor-menu-list{position:absolute;z-index:20;top:calc(100% + 4px);left:0;min-width:190px;max-height:300px;overflow:auto;padding:5px;border:1px solid var(--line);border-radius:7px;background:var(--panel);box-shadow:var(--shadow)}
.editor-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:5px;background:transparent;color:var(--ink);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.editor-menu-item:hover,.editor-menu-item:focus-visible{background:#e8f0fe;color:var(--accent)}
.editor-menu-item small{margin-left:auto;color:var(--muted);font-size:10px}
.editor-heading-sample{font-size:12px}
.editor-heading-h1{font-size:18px;font-weight:700}
.editor-heading-h2{font-size:16px;font-weight:700}
.editor-heading-h3{font-size:14px;font-weight:700}
.editor-heading-h4,.editor-heading-p,.editor-heading-div{font-size:12px}
.editor-symbol{font-size:16px}
.editor-body-panel{min-height:360px;outline:none;line-height:1.7}
.editor-body-panel:focus{border-color:#b8d3ff;box-shadow:0 0 0 3px rgba(26,115,232,.12)}
.editor-body-panel img{max-width:100%;height:auto}
.editor-body-panel iframe{max-width:100%;border:1px solid var(--line);border-radius:6px}
.editor-source{min-height:360px;margin:0;font:12px/1.6 ui-monospace,SFMono-Regular,monospace}
[data-editor-view="html"] .editor-body-panel{display:none}
.editor-dialog{width:min(480px,calc(100vw - 32px));padding:0;border:1px solid var(--line);border-radius:12px;box-shadow:0 24px 64px rgba(15,23,42,.24);overflow:hidden}
.editor-dialog::backdrop{background:rgba(15,23,42,.5)}
.editor-dialog h2{margin:0;padding:16px 18px;border-bottom:1px solid var(--line-soft);background:#fafbfc;font-size:17px}
.editor-dialog-fields{padding:16px 18px 4px}
.editor-dialog-field{display:block;margin-bottom:12px;color:var(--muted);font-size:12px;font-weight:600}
.editor-dialog-field span{display:block;margin-bottom:5px}
.editor-dialog-field input,.editor-dialog-field textarea{width:100%;margin:0;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font:inherit;background:var(--panel);color:var(--ink)}
.editor-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin:0;padding:14px 18px 18px;border-top:1px solid var(--line-soft);background:#fafbfc}
[hidden]{display:none!important}
@media(max-width:1024px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid{grid-template-columns:1fr}}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
@media(max-width:760px){.layout,.layout[data-screen="layout"]{display:block;grid-template-columns:1fr}.sidebar,.layout[data-screen="layout"] .sidebar,.layout[data-nav="closed"] .sidebar{position:fixed;z-index:30;top:56px;bottom:0;left:0;width:min(280px,82vw);height:auto;padding:18px 12px;border-right:1px solid var(--line);border-bottom:0;box-shadow:var(--shadow);transform:translateX(-100%);transition:transform .2s ease}.layout[data-nav="open"] .sidebar{transform:none}.layout[data-nav="open"] .nav-backdrop{display:block;position:fixed;z-index:29;inset:56px 0 0;background:rgba(15,23,42,.4)}.stats{grid-template-columns:1fr}.page-head{display:block}.page-head-actions{margin-top:14px;flex-wrap:wrap}.kpi-grid,.stats{grid-template-columns:1fr}.route-grid{grid-template-columns:1fr 1fr}.layout[data-screen="layout"] .content{padding:22px 16px}.layout[data-screen="layout"] .topbar{padding:0 14px}}
@media(max-width:900px){.editor-toolbars{position:static}.editor-select{max-width:130px}}
@media(max-width:760px){.editor-toolbar{gap:3px}.editor-tool{height:34px}.editor-select-size{width:58px}.editor-separator{margin:0 2px}.editor-menu-list{position:fixed;left:12px;right:12px;top:auto;max-height:50vh}.editor-body-panel,.editor-source{min-height:300px}}
`;

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
  const bodies: Record<DashboardScreenKey, string> = {
    overview:
      contentInput === undefined ? overviewBody(pages) : contentOverviewBody(pages, contentInput),
    posts: contentInput === undefined ? postsBody() : contentPostsBody(contentInput),
    "post-new":
      contentInput === undefined ? editorBody("post") : contentEditorBody("post", contentInput),
    pages: contentInput === undefined ? pagesBody() : contentPagesBody(contentInput),
    "page-new":
      contentInput === undefined ? editorBody("page") : contentEditorBody("page", contentInput),
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
