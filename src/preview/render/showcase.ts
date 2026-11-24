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

const SHOWCASE_STYLE = readFileSync(
  new URL("../../style/widget-showcase.css", import.meta.url),
  "utf8"
);

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
