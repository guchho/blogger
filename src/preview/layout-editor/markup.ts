import { escapeHtml } from "../values.js";
import { readFileSync } from "node:fs";
import {
  BLOG_POSTS_CLIENT_CONFIG,
  BLOG_POSTS_DIALOG_ID,
  BLOG_POSTS_FORM_ID,
  blogPostsSettingsMarkup,
} from "./blog-posts-settings.js";
import {
  LAYOUT_SKIN_CSS_URL,
  LAYOUT_TEMPLATE_SKIN_CSS_URL,
} from "./skin-css.js";
import type { LayoutEditorPayload } from "../../layout/model.js";
import {
  LINKLIST_CLIENT_CONFIG,
  LINKLIST_DIALOG_ID,
  LINKLIST_FORM_ID,
  linkListSettingsMarkup,
} from "../../layout/linklist/editor.js";

const LAYOUT_EDITOR_SCRIPT = readFileSync(
  new URL("../../scripts/layout-editor.js", import.meta.url),
  "utf8"
);
const EDITOR_CSS = readFileSync(new URL("./editor.css", import.meta.url), "utf8");

const ICONS = {
  save: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h11l3 3v15H5z"/><path d="M9 3v6h7V4"/><rect x="8" y="13" width="8" height="6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
};

function icon(name: keyof typeof ICONS): string {
  return ICONS[name];
}

const GADGET_ICON_PATHS: Record<string, string> = {
  post: '<path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  header: '<path d="M3 5h18v6H3z"/><path d="M3 15h10M3 19h14"/>',
  pages: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  label: '<path d="M3 5h12l6 7-6 7H3z"/><circle cx="8" cy="12" r="1.5"/>',
  archive: '<path d="M3 4h18v4H3z"/><path d="M5 8v12h14V8M9 12h6"/>',
  popular: '<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z"/>',
  featured: '<path d="M4 4h16v16H4z"/><path d="M4 14h16M8 8h8"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  text: '<path d="M4 6h16M4 11h16M4 16h11"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 6-5 4 3 3-2 4 4"/>',
  link: '<path d="M9 15l6-6M7 12l-2 2a4 4 0 0 0 6 6l2-2M17 12l2-2a4 4 0 0 0-6-6l-2 2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  subscribe: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  followers: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 15c2.8.2 5 2.3 5 5"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  translate: '<path d="M4 5h10M9 3v3M6 8c1.5 4 5 7 9 8M12 11c-2 3-5 5-8 6"/><path d="m14 20 4-9 4 9M15 17h6"/>',
  report: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
  contact: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h5"/>',
  attribution: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  puzzle: '<path d="M9 3h6v3a2 2 0 1 0 4 0h2v6h-3a2 2 0 1 0 0 4h3v5H9v-3a2 2 0 1 0-4 0H3V9h2a2 2 0 1 0 4 0z"/>',
};

function gadgetIcon(name: string): string {
  const paths = GADGET_ICON_PATHS[name] ?? GADGET_ICON_PATHS.puzzle;
  return `<svg class="le-gadget-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function dialogFrame(
  id: string,
  title: string,
  formId: string,
  fields: string,
  className = ""
): string {
  return (
    `<dialog class="layout-editor-dialog${className ? ` ${className}` : ""}" id="${id}" data-guchho-preview="layout-dialog">` +
    `<form id="${formId}">` +
    `<div class="layout-editor-dialog-head"><h2>${escapeHtml(title)}</h2></div>` +
    `<div class="layout-editor-dialog-body">${fields}</div>` +
    `<div class="layout-editor-dialog-actions">` +
    `<button type="button" class="btn" data-le-close="${id}">Cancel</button>` +
    `<button type="submit" class="btn btn-primary" data-le-apply="${id}">Apply</button></div></form></dialog>`
  );
}

function field(label: string, control: string): string {
  return `<label class="layout-editor-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

export function layoutEditorMarkup(payload: LayoutEditorPayload): string {
  const { model } = payload;
  const encoded = JSON.stringify({
    ...payload,
    client: {
      blogPosts: BLOG_POSTS_CLIENT_CONFIG,
      linkList: LINKLIST_CLIENT_CONFIG,
      skinCssUrl: LAYOUT_SKIN_CSS_URL,
      templateSkinCssUrl: LAYOUT_TEMPLATE_SKIN_CSS_URL,
      editorCss: EDITOR_CSS,
    },
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const sectionCount = model.sections.length;
  const widgetCount = model.sections.reduce((total, section) => total + section.widgets.length, 0);
  const summary = `${sectionCount} section${sectionCount === 1 ? "" : "s"} · ${widgetCount} widget${widgetCount === 1 ? "" : "s"}`;

  const catalog = payload.gadgetCatalog ?? [];
  const categories = [...new Set(catalog.map((item) => item.category))].sort();
  const addGadgetBody =
    `<input class="field" id="le-gadget-section" type="hidden">` +
    `<div class="le-catalog-filters">` +
    `<label class="layout-editor-field le-catalog-search"><span>Search gadgets</span>` +
    `<input class="field" id="le-gadget-search" type="search" placeholder="Search by name or description" aria-label="Search gadgets" data-guchho-preview="le-gadget-search"></label>` +
    `<label class="layout-editor-field"><span>Category</span><select class="field" id="le-gadget-category" aria-label="Filter gadgets by category" data-guchho-preview="le-gadget-category">` +
    `<option value="">All categories</option>` +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("") +
    `</select></label>` +
    `<label class="layout-editor-field"><span>Support</span><select class="field" id="le-gadget-support" aria-label="Filter gadgets by support level">` +
    `<option value="">Any support</option><option value="full">Full support</option><option value="partial">Partial</option><option value="unsupported">Unsupported</option>` +
    `</select></label></div>` +
    `<p class="le-catalog-empty" id="le-gadget-empty" hidden>No gadgets match your filters.</p>` +
    `<div class="le-gadget-catalog" id="le-gadget-catalog" data-guchho-preview="le-gadget-catalog">` +
    catalog.map((item) => {
      const impl = item.implemented === "full" ? "Full support" : item.implemented === "partial" ? "Partial" : "Unsupported";
      const caps = JSON.stringify(item.capabilities);
      return (
        `<button type="button" class="le-gadget-card" data-le-add-type="${escapeHtml(item.type)}" ` +
        `data-category="${escapeHtml(item.category)}" data-support="${escapeHtml(item.implemented)}" ` +
        `data-capabilities="${escapeHtml(caps)}" data-guchho-preview="le-gadget-card">` +
        `<span class="le-gadget-card-head"><span class="le-gadget-card-title">${gadgetIcon(item.icon)}<span class="le-gadget-card-name">${escapeHtml(item.label)}</span></span>` +
        `<span class="le-gadget-card-badge le-gadget-card-badge-${escapeHtml(item.implemented)}">${impl}</span></span>` +
        `<span class="le-gadget-card-desc">${escapeHtml(item.description)}</span>` +
        `<span class="le-gadget-card-meta">${escapeHtml(item.category)} · ${escapeHtml(item.type)}</span>` +
        `</button>`
      );
    }).join("") +
    `</div>` +
    `<div class="le-gadget-detail" id="le-gadget-detail" data-guchho-preview="le-gadget-detail" aria-live="polite">` +
    `<p class="le-gadget-detail-empty">Select a gadget to see its details.</p></div>` +
    `<details class="le-gadget-fallback"><summary>Gadget type (fallback)</summary>` +
    `<label class="layout-editor-field"><span>Type</span><select class="field" id="le-gadget-type">${payload.widgetTypes
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(payload.widgetTypeLabels?.[type] ?? type)}</option>`)
      .join("")}</select></label></details>`;

  return (
    `<div class="layout-editor-head">` +
    `<div class="layout-editor-heading">` +
    `<span class="layout-editor-eyebrow">Theme › Layout</span>` +
    `<h1>Layout</h1>` +
    `<p class="subtitle">Arrange the sections and gadgets that make up your blog. ` +
    `Changes are saved to ${escapeHtml(model.entryPath)}.</p>` +
    `</div><span class="layout-editor-summary">${summary}</span></div>` +
    `<div class="layout-editor-toolbar toolbar">` +
    `<button type="button" class="btn btn-primary" id="layout-editor-save" data-guchho-preview="layout-save" disabled>${icon("save")}<span>Save</span></button>` +
    `<button type="button" class="btn" id="layout-editor-reset" data-guchho-preview="layout-reset" disabled>${icon("reset")}<span>Reset</span></button>` +
    `<span class="pill layout-editor-status" id="layout-editor-status" data-guchho-preview="layout-status" data-state="saved">All changes saved</span>` +
    `<span class="note">Drag widgets to reorder or move them between sections.</span></div>` +
    `<p class="layout-editor-message" id="layout-editor-message" data-guchho-preview="layout-message" hidden></p>` +
    `<p class="sr-only" id="layout-editor-live" data-guchho-preview="layout-live" aria-live="polite"></p>` +
    `<div class="layout-editor-canvas" id="layout-editor-shadow-host" data-guchho-preview="layout-canvas"></div>` +
    dialogFrame("le-gadget-dialog", "Add a gadget", "le-gadget-form", addGadgetBody, "layout-editor-dialog-wide") +
    dialogFrame(BLOG_POSTS_DIALOG_ID, "Blog Posts", BLOG_POSTS_FORM_ID, blogPostsSettingsMarkup(), "layout-editor-dialog-wide") +
    dialogFrame(LINKLIST_DIALOG_ID, "Link List", LINKLIST_FORM_ID, linkListSettingsMarkup(), "layout-editor-dialog-wide") +
    dialogFrame(
      "le-widget-dialog",
      "Edit gadget",
      "le-widget-form",
      `<div id="le-widget-generic-fields" data-guchho-preview="le-widget-generic-fields"></div>` +
      `<details class="le-advanced" id="le-widget-advanced"><summary>Advanced</summary>` +
      `<div id="le-widget-advanced-fields" data-guchho-preview="le-widget-advanced-fields"></div>` +
      field("Id", `<input class="field" id="le-widget-id" type="text" readonly>`) +
      field("Title", `<input class="field" id="le-widget-title" type="text">`) +
      field("Version", `<input class="field" id="le-widget-version" type="text">`) +
      `<div id="le-widget-image-field" hidden>${field("Image URL", `<input class="field" id="le-widget-image-url" type="url" placeholder="https://example.com/logo.png">`)}</div>` +
      `<label class="layout-editor-check"><input id="le-widget-locked" type="checkbox"> Locked</label>` +
      `<label class="layout-editor-check"><input id="le-widget-visible" type="checkbox"> Visible</label>` +
      `</details>`,
      "layout-editor-dialog-wide"
    ) +
    dialogFrame(
      "le-section-dialog",
      "Section settings",
      "le-section-form",
      field("Id", `<input class="field" id="le-section-id" type="text" readonly>`) +
        field("Name", `<input class="field" id="le-section-name" type="text">`) +
        field("Class", `<input class="field" id="le-section-class" type="text">`) +
        field("Max widgets", `<input class="field" id="le-section-maxwidgets" type="number" min="0">`) +
        field("Growth", `<input class="field" id="le-section-growth" type="text">`) +
        `<label class="layout-editor-check"><input id="le-section-showaddelement" type="checkbox"> Show add element</label>`
    ) +
    dialogFrame(
      "le-move-dialog",
      "Move gadget",
      "le-move-form",
      `<input class="field" id="le-move-widget" type="hidden">` +
      field("Move to section", `<select class="field" id="le-move-section" data-guchho-preview="le-move-section"></select>`) +
      field("Position", `<select class="field" id="le-move-position"><option value="start">At the start</option><option value="end">At the end</option></select>`) +
      `<p class="le-settings-hint">You can also drag a gadget with the mouse. This dialog provides the same move with a keyboard.</p>`
    ) +
    dialogFrame("le-confirm-dialog", "Confirm action", "le-confirm-form", `<p id="le-confirm-text"></p>`) +
    `<script type="application/json" id="layout-editor-payload" data-guchho-preview="layout-payload">${encoded}</script>` +
    `<script data-guchho-preview="layout-editor-script">${LAYOUT_EDITOR_SCRIPT}</script>`
  );
}
