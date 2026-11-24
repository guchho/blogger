import { PREVIEW_DASHBOARD_ROUTE } from "../dashboard.js";
import { PREVIEW_FAVICON } from "../data/metadata.js";
import { readFileSync } from "node:fs";

const WIDGET_SHOWCASE_SCRIPT = readFileSync(
  new URL("../../scripts/widget-showcase.js", import.meta.url),
  "utf8"
);
import type { WidgetRegistry } from "./widgets.js";

const GROUP_ORDER = ["Content", "Branding", "Navigation", "Community", "Discovery", "Utilities"];

const WIDGET_GROUPS: Record<string, string> = {
  Attribution: "Branding",
  Blog: "Content",
  BlogArchive: "Content",
  BlogSearch: "Discovery",
  ContactForm: "Community",
  FeaturedPost: "Content",
  FollowByEmail: "Community",
  Followers: "Community",
  Header: "Branding",
  HTML: "Content",
  Image: "Branding",
  Label: "Content",
  LinkList: "Navigation",
  PageList: "Navigation",
  PopularPosts: "Content",
  Profile: "Community",
  ReportAbuse: "Utilities",
  Search: "Discovery",
  Stats: "Utilities",
  Subscribe: "Community",
  Text: "Content",
  Translate: "Utilities",
};

const SHOWCASE_STYLE = `
:root{color-scheme:light;--bg:#f5f7fb;--panel:#fff;--line:#e5e9f2;--line-soft:#eef1f7;--ink:#182033;--muted:#667085;--accent:#6d5dfc;--accent-dark:#5848e4;--accent-soft:#efedff;--radius:16px;--shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px rgba(16,24,40,.08)}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 12% -10%,#e9e6ff 0,rgba(233,230,255,0) 32%),radial-gradient(circle at 90% 0,#e6f4ff 0,rgba(230,244,255,0) 28%),var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
a{color:var(--accent-dark);text-decoration:none}
a:hover{text-decoration:underline}
.showcase-page{max-width:1280px;margin:0 auto;padding:28px 24px 64px}
.showcase-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px;padding:28px;background:linear-gradient(135deg,#fff 0%,#fbfbff 100%);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow)}
.showcase-eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--accent-dark);font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
.showcase-eyebrow:before{content:'';width:22px;height:2px;border-radius:2px;background:var(--accent)}
.showcase-hero h1{margin:0 0 8px;font-size:30px;line-height:1.2;letter-spacing:-.03em}
.showcase-hero p{margin:0;max-width:640px;color:var(--muted);font-size:14px}
.showcase-actions{display:flex;gap:10px;flex:none}
.showcase-button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;font-weight:600;white-space:nowrap;cursor:pointer}
.showcase-button:hover{border-color:#c9cfe0;background:#f9faff;text-decoration:none}
.showcase-button.primary{border-color:var(--accent);background:var(--accent);color:#fff}
.showcase-button.primary:hover{border-color:var(--accent-dark);background:var(--accent-dark)}
.showcase-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}
.showcase-stat{padding:14px 16px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.03)}
.showcase-stat strong{display:block;font-size:20px;line-height:1.2;letter-spacing:-.02em}
.showcase-stat span{color:var(--muted);font-size:12px}
.showcase-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.03)}
.showcase-search{position:relative;display:flex;align-items:center;flex:0 1 300px;min-width:220px}
.showcase-search:before{content:'';position:absolute;left:12px;width:13px;height:13px;border:2px solid #98a2b3;border-radius:50%}
.showcase-search:after{content:'';position:absolute;left:23px;width:7px;height:2px;border-radius:2px;background:#98a2b3;transform:rotate(45deg)}
.showcase-search input{width:100%;height:38px;padding:0 12px 0 36px;border:1px solid var(--line);border-radius:10px;background:#fbfcfe;color:var(--ink);font:inherit}
.showcase-search input:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
.showcase-filters{display:flex;flex-wrap:wrap;gap:6px;flex:1}
.showcase-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:1px solid transparent;border-radius:999px;background:#f2f4f8;color:#475467;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.showcase-chip span{color:#98a2b3;font-size:11px}
.showcase-chip:hover{background:#e9ecf3}
.showcase-chip[aria-pressed='true']{border-color:#d9d3ff;background:var(--accent-soft);color:var(--accent-dark)}
.showcase-chip[aria-pressed='true'] span{color:var(--accent)}
.showcase-status{flex:none;color:var(--muted);font-size:12px;font-weight:600}
.widget-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start}
.widget-card{overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
.widget-card:hover{transform:translateY(-2px);border-color:#d7d2ff;box-shadow:0 16px 38px rgba(16,24,40,.12)}
.widget-card[hidden],.showcase-empty[hidden]{display:none!important}
.widget-card-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line-soft);background:linear-gradient(135deg,#fff,#faf9ff)}
.widget-mark{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border-radius:9px;background:var(--accent-soft);color:var(--accent-dark);font-size:13px;font-weight:800}
.widget-card-title{min-width:0;flex:1}
.widget-card-title h2{margin:0;font-size:14px;line-height:1.3;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.widget-card-title span{display:block;margin-top:2px;color:var(--muted);font-size:11px}
.widget-card-group{padding:3px 8px;border-radius:999px;background:#f2f4f8;color:#667085;font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}
.widget-card-body{min-height:96px;padding:14px 16px 16px;background:#fff;font-size:12px}
.widget-card-body .section.showcase{margin:0;padding:0;border:0;background:transparent}
.widget-card-body .widget{margin:0}
.widget-card-body .widget>.title,.widget-card-body h3.title{margin:0 0 8px;color:#344054;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.widget-card-body .post,.widget-card-body .widget-content{padding:10px;border:1px solid var(--line-soft);border-radius:10px;background:#fcfdff}
.widget-card-body .post-title{font-size:13px}
.widget-card-body .post-body p{margin:4px 0 0;color:#475467}
.widget-card-body form{margin:0}
.widget-card-body input,.widget-card-body textarea,.widget-card-body select{max-width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--ink);font:inherit}
.widget-card-body ul{margin:0;padding-left:18px}
.showcase-empty{padding:44px 20px;background:var(--panel);border:1px dashed var(--line);border-radius:var(--radius);color:var(--muted);text-align:center}
.showcase-empty strong{display:block;margin-bottom:4px;color:var(--ink);font-size:15px}
@media(max-width:900px){.showcase-hero{align-items:flex-start;flex-direction:column}.showcase-actions{width:100%}.showcase-button{flex:1}.showcase-toolbar{align-items:flex-start;flex-direction:column}.showcase-search{flex:1 1 auto;width:100%}.showcase-status{padding-left:2px}}
@media(max-width:600px){.showcase-page{padding:18px 14px 48px}.showcase-hero{padding:20px}.showcase-hero h1{font-size:24px}.showcase-stats{grid-template-columns:1fr}.widget-grid{grid-template-columns:1fr}}
`;

export function buildShowcaseTemplate(registry: WidgetRegistry): string {
  const types = [...registry.markups.keys()].sort((a, b) => a.localeCompare(b));
  const counts: Record<string, number> = {};
  for (const type of types) {
    const group = groupFor(type);
    counts[group] = (counts[group] ?? 0) + 1;
  }
  const groups = [
    ...GROUP_ORDER.filter((group) => counts[group] !== undefined),
    ...(counts.Other === undefined ? [] : ["Other"]),
  ];
  const filters = ["All", ...groups]
    .map((group) => {
      const count = group === "All" ? types.length : counts[group] ?? 0;
      return (
        `<button type="button" class="showcase-chip" data-widget-filter="${escapeText(group)}" aria-pressed="${group === "All"}">` +
        `${escapeText(group)} <span>${count}</span></button>`
      );
    })
    .join("");

  const sections = types
    .map((type, index) => {
      const typeAttribute = escapeAttribute(type);
      const group = groupFor(type);
      const section =
        `<b:section class='showcase' id='showcase-${index + 1}' name='${typeAttribute}'>` +
        `<b:widget id='Showcase${index + 1}' type='${typeAttribute}' title='${typeAttribute}'/>` +
        `</b:section>`;
      return (
        `<article class="widget-card" data-group="${escapeText(group)}" data-type="${typeAttribute}" ` +
        `data-search="${escapeText(type + " " + group)}" data-widget-card="">` +
        `<div class="widget-card-head">` +
        `<span class="widget-mark" aria-hidden="true">${escapeText(type.slice(0, 1).toUpperCase())}</span>` +
        `<div class="widget-card-title"><h2>${escapeText(type)}</h2><span>Showcase${index + 1}</span></div>` +
        `<span class="widget-card-group">${escapeText(group)}</span>` +
        `</div><div class="widget-card-body">${section}</div></article>`
      );
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr' lang='en'>
<head>
<title>Widget showcase — Guchho Blogger Preview</title>
<link rel='icon' href='${PREVIEW_FAVICON}' />
<style><![CDATA[${SHOWCASE_STYLE}]]></style>
</head>
<body>
<div class="showcase-page" data-guchho-preview="widget-showcase">
  <header class="showcase-hero">
    <div>
      <div class="showcase-eyebrow">Widget library</div>
      <h1>Widget showcase</h1>
      <p>Every built-in and custom widget rendered with deterministic preview data. Search the library or filter by category to inspect a specific widget.</p>
    </div>
    <div class="showcase-actions">
      <a class="showcase-button" href="/">View blog</a>
      <a class="showcase-button primary" href="${PREVIEW_DASHBOARD_ROUTE}">Open dashboard</a>
    </div>
  </header>
  <div class="showcase-stats">
    <div class="showcase-stat"><strong>${types.length}</strong><span>Available widgets</span></div>
    <div class="showcase-stat"><strong>${groups.length}</strong><span>Widget categories</span></div>
    <div class="showcase-stat"><strong>Deterministic</strong><span>Mock preview data</span></div>
  </div>
  <div class="showcase-toolbar">
    <label class="showcase-search"><input type="search" data-widget-search="" placeholder="Search widgets..." aria-label="Search widgets" /></label>
    <div class="showcase-filters" role="group" aria-label="Filter widgets by category">${filters}</div>
    <span class="showcase-status" data-widget-status="">${types.length} of ${types.length} widgets</span>
  </div>
  <main class="widget-grid">${sections}</main>
  <div class="showcase-empty" data-widget-empty="" hidden="hidden"><strong>No widgets found</strong><span>Try a different search or category.</span></div>
</div>
<script data-guchho-preview="widget-showcase-script"><![CDATA[${WIDGET_SHOWCASE_SCRIPT}]]></script>
</body>
</html>`;
}

function groupFor(type: string): string {
  return WIDGET_GROUPS[type] ?? "Other";
}

function escapeAttribute(value: string): string {
  return escapeText(value);
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
