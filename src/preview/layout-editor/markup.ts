import { escapeHtml } from "../values.js";
import { LAYOUT_EDITOR_SCRIPT } from "./client-script.js";
import type { LayoutEditorPayload } from "../../layout/model.js";

const ICONS = {
  save: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h11l3 3v15H5z"/><path d="M9 3v6h7V4"/><rect x="8" y="13" width="8" height="6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
};

function icon(name: keyof typeof ICONS): string {
  return ICONS[name];
}

function dialogFrame(id: string, title: string, formId: string, fields: string): string {
  return (
    `<dialog class="layout-editor-dialog" id="${id}" data-guchho-preview="layout-dialog">` +
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

  return (
    `<div class="layout-editor-head">` +
    `<div class="layout-editor-heading">` +
    `<span class="layout-editor-eyebrow">Design / Layout</span>` +
    `<h1>Layout</h1>` +
    `<p class="subtitle">Sections and widgets loaded from ${escapeHtml(model.entryPath)}. ` +
    `${sectionCount} section${sectionCount === 1 ? "" : "s"}, ${widgetCount} widget${widgetCount === 1 ? "" : "s"}.</p>` +
    `</div><span class="layout-editor-summary">${summary}</span></div>` +
    `<div class="layout-editor-toolbar toolbar">` +
    `<button type="button" class="btn btn-primary" id="layout-editor-save" data-guchho-preview="layout-save" disabled>${icon("save")}<span>Save</span></button>` +
    `<button type="button" class="btn" id="layout-editor-reset" data-guchho-preview="layout-reset" disabled>${icon("reset")}<span>Reset</span></button>` +
    `<span class="pill layout-editor-status" id="layout-editor-status" data-guchho-preview="layout-status" data-state="saved">All changes saved</span>` +
    `<span class="note">Drag widgets to reorder or move them between sections.</span></div>` +
    `<p class="layout-editor-message" id="layout-editor-message" data-guchho-preview="layout-message" hidden></p>` +
    `<div class="layout-editor-canvas" id="layout-editor-shadow-host" data-guchho-preview="layout-canvas"></div>` +
    dialogFrame(
      "le-gadget-dialog",
      "Add a gadget",
      "le-gadget-form",
      field("Section", `<input class="field" id="le-gadget-section" type="hidden">`) +
        field("Gadget", `<select class="field" id="le-gadget-type">${payload.widgetTypes
          .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
          .join("")}</select>`)
    ) +
    dialogFrame(
      "le-widget-dialog",
      "Edit widget",
      "le-widget-form",
      field("Id", `<input class="field" id="le-widget-id" type="text" readonly>`) +
        field("Title", `<input class="field" id="le-widget-title" type="text">`) +
        field("Version", `<input class="field" id="le-widget-version" type="text">`) +
        `<label class="layout-editor-check"><input id="le-widget-locked" type="checkbox"> Locked</label>` +
        `<label class="layout-editor-check"><input id="le-widget-visible" type="checkbox"> Visible</label>`
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
      "le-confirm-dialog",
      "Remove widget",
      "le-confirm-form",
      `<p id="le-confirm-text"></p>`
    ) +
    `<script type="application/json" id="layout-editor-payload" data-guchho-preview="layout-payload">${encoded}</script>` +
    `<script data-guchho-preview="layout-editor-script">${LAYOUT_EDITOR_SCRIPT}</script>`
  );
}
