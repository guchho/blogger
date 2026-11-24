import { escapeHtml } from "../../preview/values.js";
import {
  LINKLIST_DEFAULT_SETTINGS,
  LINKLIST_LINKS_HINT,
  LINKLIST_SETTING,
  LINKLIST_SORTING_OPTIONS,
  LINKLIST_TITLE_MAX_LENGTH,
  LINKLIST_WIDGET_TYPE,
} from "./types.js";

export const LINKLIST_DIALOG_ID = "le-linklist-dialog";
export const LINKLIST_FORM_ID = "le-linklist-form";
export const LINKLIST_ADVANCED_ID = "le-linklist-advanced";

export const LINKLIST_FIELD_IDS = {
  widgetId: "le-linklist-widget-id",
  title: "le-linklist-title",
  titleError: "le-linklist-title-error",
  visible: "le-linklist-visible",
  sorting: "le-linklist-sorting",
  shownum: "le-linklist-shownum",
  shownumError: "le-linklist-shownum-error",
  links: "le-linklist-links",
  linksHint: "le-linklist-links-hint",
  linksError: "le-linklist-links-error",
  advancedTitle: "le-linklist-advanced-title",
  locked: "le-linklist-locked",
  version: "le-linklist-version",
  advancedVisible: "le-linklist-advanced-visible",
} as const;

export const LINKLIST_CLIENT_CONFIG = {
  widgetType: LINKLIST_WIDGET_TYPE,
  dialogId: LINKLIST_DIALOG_ID,
  formId: LINKLIST_FORM_ID,
  advancedId: LINKLIST_ADVANCED_ID,
  fields: LINKLIST_FIELD_IDS,
  setting: LINKLIST_SETTING,
  sortingOptions: LINKLIST_SORTING_OPTIONS.map((option) => ({ ...option })),
  defaults: { ...LINKLIST_DEFAULT_SETTINGS },
  titleMaxLength: LINKLIST_TITLE_MAX_LENGTH,
  linksHint: LINKLIST_LINKS_HINT,
  linksSeparator: "|",
} as const;

function field(label: string, control: string): string {
  return `<label class="layout-editor-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

function group(title: string, content: string): string {
  return `<section class="le-settings-group"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function error(id: string): string {
  return `<small class="le-linklist-error" id="${id}" role="alert"></small>`;
}

export function linkListSettingsMarkup(): string {
  const ids = LINKLIST_FIELD_IDS;
  const general =
    `<label class="layout-editor-field"><span>Title</span>` +
    `<input class="field" id="${ids.title}" type="text" maxlength="${LINKLIST_TITLE_MAX_LENGTH}" aria-describedby="${ids.titleError}">` +
    error(ids.titleError) +
    `</label>` +
    `<label class="layout-editor-check"><input id="${ids.visible}" type="checkbox"><span>Show this widget</span></label>` +
    field(
      "Sort links",
      `<select class="field" id="${ids.sorting}">${LINKLIST_SORTING_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("")}</select>`
    ) +
    `<label class="layout-editor-field"><span>Show</span>` +
    `<input class="field" id="${ids.shownum}" type="number" min="1" step="1" placeholder="All" inputmode="numeric" aria-describedby="${ids.shownumError}">` +
    error(ids.shownumError) +
    `</label>`;
  const links =
    `<label class="layout-editor-field"><span>Links</span>` +
    `<small class="le-settings-hint" id="${ids.linksHint}">${escapeHtml(LINKLIST_LINKS_HINT)}</small>` +
    `<textarea class="field" id="${ids.links}" rows="8" spellcheck="false" placeholder="${escapeHtml(
      LINKLIST_LINKS_HINT
    )}" aria-describedby="${ids.linksHint} ${ids.linksError}" style="width:100%;box-sizing:border-box;min-height:160px;resize:vertical;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font:inherit;line-height:1.5"></textarea>` +
    error(ids.linksError) +
    `</label>`;
  const advanced =
    `<details class="le-advanced" id="${LINKLIST_ADVANCED_ID}"><summary>Advanced</summary>` +
    group(
      "Settings",
      field("Id", `<input class="field" id="${ids.widgetId}" type="text" readonly>`) +
        `<label class="layout-editor-field"><span>Title</span>` +
        `<input class="field" id="${ids.advancedTitle}" type="text" maxlength="${LINKLIST_TITLE_MAX_LENGTH}">` +
        `</label>` +
        field("Version", `<input class="field" id="${ids.version}" type="text">`)
    ) +
    `<label class="layout-editor-check"><input id="${ids.locked}" type="checkbox"><span>Locked</span></label>` +
    `<label class="layout-editor-check"><input id="${ids.advancedVisible}" type="checkbox"><span>Visible</span></label>` +
    `</details>`;
  return group("General", general) + group("Links", links) + advanced;
}
