import { escapeHtml } from "../values.js";
import {
  BLOG_POSTS_DIALOG_ID,
  BLOG_POSTS_FORM_ID,
  blogPostsSettingsMarkup,
} from "./blog-posts-settings.js";
import { LAYOUT_EDITOR_SCRIPT } from "../../scripts/layout-editor-script.js";
import type { LayoutEditorPayload } from "../../layout/model.js";

const ICONS = {
  save: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h11l3 3v15H5z"/><path d="M9 3v6h7V4"/><rect x="8" y="13" width="8" height="6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
};

function icon(name: keyof typeof ICONS): string {
  return ICONS[name];
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
    `<button type="submit" class="btn btn-primary">Apply</button></div></form></dialog>`
  );
}

function field(label: string, control: string): string {
  return `<label class="layout-editor-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

export function layoutEditorMarkup(payload: LayoutEditorPayload): string {
  const { model } = payload;
  const encoded = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const sectionCount = model.sections.length;
  const widgetCount = model.sections.reduce((total, section) => total + section.widgets.length, 0);
  const summary = `${sectionCount} section${sectionCount === 1 ? "" : "s"} · ${widgetCount} widget${widgetCount === 1 ? "" : "s"}`;

  const catalog = payload.gadgetCatalog ?? [];
  const addGadgetBody =
    `<input class="field" id="le-gadget-section" type="hidden">` +
    `<div class="le-gadget-catalog" id="le-gadget-catalog" data-guchho-preview="le-gadget-catalog">` +
    catalog.map((item) => {
      const impl = item.implemented === "full" ? "Full support" : item.implemented === "partial" ? "Partial" : "Unsupported";
      return (
        `<button type="button" class="le-gadget-card" data-le-add-type="${escapeHtml(item.type)}" data-guchho-preview="le-gadget-card">` +
        `<span class="le-gadget-card-head"><span class="le-gadget-card-name">${escapeHtml(item.label)}</span>` +
        `<span class="le-gadget-card-badge le-gadget-card-badge-${escapeHtml(item.implemented)}">${impl}</span></span>` +
        `<span class="le-gadget-card-desc">${escapeHtml(item.description)}</span>` +
        `<span class="le-gadget-card-meta">${escapeHtml(item.category)}</span>` +
        `</button>`
      );
    }).join("") +
    `</div>` +
    `<label class="layout-editor-field"><span>Gadget type (fallback)</span><select class="field" id="le-gadget-type">${payload.widgetTypes
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(payload.widgetTypeLabels?.[type] ?? type)}</option>`)
      .join("")}</select></label>`;

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
    `<div class="layout-editor-canvas" id="layout-editor-shadow-host" data-guchho-preview="layout-canvas"></div>` +
    dialogFrame("le-gadget-dialog", "Add a gadget", "le-gadget-form", addGadgetBody, "layout-editor-dialog-wide") +
    dialogFrame(BLOG_POSTS_DIALOG_ID, "Blog Posts", BLOG_POSTS_FORM_ID, blogPostsSettingsMarkup(), "layout-editor-dialog-wide") +
    dialogFrame(
      "le-widget-dialog",
      "Edit gadget",
      "le-widget-form",
      `<div id="le-widget-generic-fields" data-guchho-preview="le-widget-generic-fields"></div>` +
      `<details class="le-advanced" id="le-widget-advanced"><summary>Advanced</summary>` +
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
    dialogFrame("le-confirm-dialog", "Remove gadget", "le-confirm-form", `<p id="le-confirm-text"></p>`) +
    `<script type="application/json" id="layout-editor-payload" data-guchho-preview="layout-payload">${encoded}</script>` +
    `<script data-guchho-preview="layout-editor-script">${LAYOUT_EDITOR_SCRIPT}</script>`
  );
}
