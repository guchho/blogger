import { applyEdits, removeFollowingNewline, type TextEdit } from "../compiler/edits.js";
import { decodeEntities } from "../preview/expr/tokenizer.js";
import { DiagnosticCollector } from "../diagnostics.js";
import { builtinWidgetTypes, widgetDefaultMarkupSource } from "../preview/render/widgets.js";
import { BloggerValidator } from "../validate/blogger.js";
import {
  attribute,
  isElement,
  type XmlCData,
  type XmlDocument,
  type XmlElement,
  type XmlText,
} from "../xml/ast.js";
import { parseXml } from "../xml/parser.js";
import { SourceFile } from "../xml/source.js";
import { BLOG_POSTS_SETTING_NAMES, BLOG_POSTS_WIDGET_ID } from "./blog-posts.js";
import { getGadgetDefinition, normalizeGadgetSettings, validateGadgetSettings } from "./gadgets.js";
import {
  isLinkListIndexedKey,
  linkListWritableSettings,
  normalizeLinkListSettings,
  withoutLinkListIndexedSettings,
} from "./linklist/serialization.js";
import { sortLinkListLinks } from "./linklist/operations.js";
import { validateLinkListTitle } from "./linklist/validation.js";
import { LINKLIST_SETTING, LINKLIST_WIDGET_TYPE } from "./linklist/types.js";
import {
  allWidgetElements,
  extractLayout,
  findSectionElement,
  findWidgetElement,
  parseTemplate,
  valueOf,
} from "./extract.js";
import { LayoutError, type LayoutModel, type LayoutOperation } from "./model.js";

export interface ApplyResult {
  xml: string;
  model: LayoutModel;
}

export function applyLayoutOperations(
  sourceText: string,
  operations: readonly LayoutOperation[],
  entryPath = "src/template.xml",
  allowedWidgetTypes: readonly string[] = []
): ApplyResult {
  let xml = sourceText;
  for (const operation of operations) {
    const document = parseTemplate(xml, entryPath);
    const edits = operationEdits(document, xml, operation, allowedWidgetTypes);
    xml = applyEdits(xml, edits);
  }
  validateLayoutXml(xml, entryPath);
  return { xml, model: extractLayout(xml, entryPath) };
}

export function validateLayoutXml(xml: string, entryPath = "src/template.xml"): void {
  let document: XmlDocument;
  try {
    document = parseXml(new SourceFile(entryPath, xml));
  } catch (error) {
    throw new LayoutError(
      "BLOGGER_LAYOUT_INVALID_XML",
      error instanceof Error ? error.message : String(error)
    );
  }
  const diagnostics = new DiagnosticCollector();
  new BloggerValidator(diagnostics, { enabled: true }).validateDocument(document, undefined, true);
  const errors = diagnostics.diagnostics.filter((item) => item.severity === "error");
  if (errors.length > 0) {
    throw new LayoutError("BLOGGER_LAYOUT_INVALID_STRUCTURE", errors[0]?.message ?? "invalid template");
  }
}

export function availableWidgetTypes(): string[] {
  return builtinWidgetTypes();
}

function operationEdits(
  document: XmlDocument,
  text: string,
  operation: LayoutOperation,
  allowedWidgetTypes: readonly string[]
): TextEdit[] {
  switch (operation.kind) {
    case "addWidget":
      return addWidgetEdits(document, text, operation, allowedWidgetTypes);
    case "removeWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      assertUnlocked(found.widget);
      assertCapability(found.widget, "removable");
      return [removeElementEdit(text, found.widget)];
    }
    case "reorderWidget":
    case "moveWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      assertUnlocked(found.widget);
      assertCapability(found.widget, "movable");
      const targetId =
        operation.kind === "moveWidget" ? operation.sectionId : valueOf(found.section, "id") ?? "";
      const target =
        operation.kind === "moveWidget"
          ? findSectionElement(document, targetId)
          : found.section;
      if (target === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_SECTION_MISSING", `section "${targetId}" was not found`);
      }
      assertAllowedSection(found.widget, targetId);
      const after = directWidgets(target).filter((item) => item !== found.widget);
      assertCapacity(target, after.length + 1, operation.kind === "moveWidget");
      const fragment = text.slice(found.widget.span.start, found.widget.span.end);
      const insert = insertionEdit(text, target, fragment, operation.index, found.widget);
      return [removeElementEdit(text, found.widget), insert];
    }
    case "editWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      const edits: TextEdit[] = [];
      const { changes } = operation;
      const widgetType = valueOf(found.widget, "type") ?? "";
      if (widgetType === LINKLIST_WIDGET_TYPE && changes.title !== undefined) {
        const issue = validateLinkListTitle(changes.title);
        if (issue) throw new LayoutError("BLOGGER_LAYOUT_SETTING_INVALID", issue.message);
      }
      if (changes.visible !== undefined) assertCapability(found.widget, "canHide");
      assertAllowedSection(found.widget, valueOf(found.section, "id") ?? "");
      if (changes.title !== undefined) edits.push(...setAttributeEdits(found.widget, "title", changes.title));
      if (changes.locked !== undefined) edits.push(...setAttributeEdits(found.widget, "locked", String(changes.locked)));
      if (changes.visible !== undefined) edits.push(...setAttributeEdits(found.widget, "visible", String(changes.visible)));
      if (changes.version !== undefined) edits.push(...setAttributeEdits(found.widget, "version", changes.version));
      if (changes.imageUrl !== undefined && widgetType === "Header") {
        edits.push(...setWidgetSettingEdits(text, found.widget, "displayUrl", changes.imageUrl));
      }
      if (changes.settings !== undefined) {
        const isLinkList = widgetType === LINKLIST_WIDGET_TYPE;
        const existing = isLinkList ? widgetSettingsMap(found.widget) : {};
        const replacesLinks = Object.keys(changes.settings).some(isLinkListIndexedKey);
        const input = isLinkList
          ? { ...(replacesLinks ? withoutLinkListIndexedSettings(existing) : existing), ...changes.settings }
          : changes.settings;
        const definition = getGadgetDefinition(widgetType);
        const normalized = normalizeGadgetSettings(widgetType, input);
        const issues = validateGadgetSettings(widgetType, isLinkList ? input : normalized);
        if (issues.length > 0) {
          throw new LayoutError("BLOGGER_LAYOUT_SETTING_INVALID", issues[0]?.message ?? "invalid gadget setting");
        }
        let values: Record<string, string> = {};
        if (isLinkList) {
          const previousSorting = normalizeLinkListSettings(existing)[LINKLIST_SETTING.sorting];
          let next = normalized;
          if (next[LINKLIST_SETTING.sorting] !== previousSorting) {
            next = sortLinkListLinks(next, next[LINKLIST_SETTING.sorting]);
          }
          values = linkListWritableSettings(next);
          const removals = Object.keys(existing).filter(
            (key) =>
              (isLinkListIndexedKey(key) || key === LINKLIST_SETTING.legacyLinks) &&
              values[key] === undefined
          );
          edits.push(...removeWidgetSettingsEdits(text, found.widget, removals));
        } else if (definition) {
          for (const key of definition.settingKeys) {
            const value = normalized[key];
            if (typeof value === "string") values[key] = value;
          }
        } else {
          for (const [key, value] of Object.entries(normalized)) {
            if (typeof value === "string") values[key] = value;
          }
        }
        if (valueOf(found.widget, "id") === BLOG_POSTS_WIDGET_ID && widgetType === "Blog") {
          for (const name of BLOG_POSTS_SETTING_NAMES) {
            const value = normalized[name];
            if (typeof changes.settings[name] === "string" && typeof value === "string") values[name] = value;
          }
        }
        edits.push(...setWidgetSettingsEdits(text, found.widget, values));
      }
      return edits;
    }
    case "duplicateWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      const widgetType = valueOf(found.widget, "type") ?? "";
      const definition = getGadgetDefinition(widgetType);
      if (definition && definition.capabilities.duplicable === false) {
        throw new LayoutError("BLOGGER_LAYOUT_DUPLICATE_UNSUPPORTED", `widget type "${widgetType}" cannot be duplicated`);
      }
      assertInstanceLimit(document, widgetType, 1);
      const section = found.section;
      const siblings = directWidgets(section);
      assertCapacity(section, siblings.length + 1, false);
      const used = new Set(allWidgetElements(document).map((item) => valueOf(item, "id") ?? ""));
      const nextId = uniqueWidgetId(widgetType, used);
      let fragment = text.slice(found.widget.span.start, found.widget.span.end);
      const idAttr = attribute(found.widget, "id");
      if (idAttr) {
        const relStart = idAttr.valueSpan.start - found.widget.span.start;
        const relEnd = idAttr.valueSpan.end - found.widget.span.start;
        fragment = fragment.slice(0, relStart) + escapeAttribute(nextId, idAttr.quote) + fragment.slice(relEnd);
      }
      const titleAttr = attribute(found.widget, "title");
      if (titleAttr) {
        const baseTitle = decodeEntities(titleAttr.value).trim() || widgetType;
        const nextTitle = `${baseTitle} (Copy)`;
        const current = text.slice(found.widget.span.start, found.widget.span.end);
        const currentIdAttr = attribute(found.widget, "id");
        let adjusted = fragment;
        if (currentIdAttr) {
          const delta = (escapeAttribute(nextId, currentIdAttr.quote).length - (currentIdAttr.valueSpan.end - currentIdAttr.valueSpan.start));
          const relStart = titleAttr.valueSpan.start - found.widget.span.start + delta;
          const relEnd = titleAttr.valueSpan.end - found.widget.span.start + delta;
          adjusted = adjusted.slice(0, relStart) + escapeAttribute(nextTitle, titleAttr.quote) + adjusted.slice(relEnd);
        }
        fragment = adjusted;
      }
      const index = siblings.indexOf(found.widget) + 1;
      return [insertionEdit(text, section, fragment, index, found.widget)];
    }
    case "editSection": {
      const section = findSectionElement(document, operation.sectionId);
      if (section === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_SECTION_MISSING", `section "${operation.sectionId}" was not found`);
      }
      const edits: TextEdit[] = [];
      const { changes } = operation;
      if (changes.name !== undefined) edits.push(...setAttributeEdits(section, "name", changes.name));
      if (changes.className !== undefined) edits.push(...setAttributeEdits(section, "class", changes.className));
      if (changes.maxwidgets !== undefined) {
        edits.push(
          ...(changes.maxwidgets === null
            ? removeAttributeEdits(section, "maxwidgets")
            : setAttributeEdits(section, "maxwidgets", String(changes.maxwidgets)))
        );
      }
      if (changes.showaddelement !== undefined) {
        edits.push(...setAttributeEdits(section, "showaddelement", String(changes.showaddelement)));
      }
      if (changes.growth !== undefined) edits.push(...setAttributeEdits(section, "growth", changes.growth));
      return edits;
    }
  }
}

function addWidgetEdits(
  document: XmlDocument,
  text: string,
  operation: Extract<LayoutOperation, { kind: "addWidget" }>,
  allowedWidgetTypes: readonly string[]
): TextEdit[] {
  const sectionId = operation.sectionId;
  const widgetType = operation.widgetType;
  if (widgetType === LINKLIST_WIDGET_TYPE && operation.title !== undefined) {
    const issue = validateLinkListTitle(operation.title);
    if (issue) throw new LayoutError("BLOGGER_LAYOUT_SETTING_INVALID", issue.message);
  }
  const section = findSectionElement(document, sectionId);
  if (section === undefined) {
    throw new LayoutError("BLOGGER_LAYOUT_SECTION_MISSING", `section "${sectionId}" was not found`);
  }
  if (valueOf(section, "showaddelement") === "false") {
    throw new LayoutError(
      "BLOGGER_LAYOUT_ADDELEMENT_DISABLED",
      `section "${sectionId}" does not allow adding widgets`
    );
  }
  assertCapacity(section, directWidgets(section).length + 1, false);
  const supported = new Set([...availableWidgetTypes(), ...allowedWidgetTypes]);
  if (!supported.has(widgetType)) {
    throw new LayoutError("BLOGGER_LAYOUT_WIDGET_TYPE_INVALID", `unknown widget type "${widgetType}"`);
  }
  assertAllowedSectionForType(widgetType, sectionId);
  assertInstanceLimit(document, widgetType, 0);
  const settings = normalizeSettingsForType(widgetType, operation.settings ?? {});
  const used = new Set(allWidgetElements(document).map((item) => valueOf(item, "id") ?? ""));
  const id = uniqueWidgetId(widgetType, used);
  const title = operation.title?.trim() || getGadgetDefinition(widgetType)?.label || widgetType;
  const markup = buildWidgetMarkup(id, widgetType, title, settings);
  const indent = sectionIndent(text, section);
  const fragment = indentWidgetMarkup(markup, indent);
  return [insertionEdit(text, section, fragment, Number.MAX_SAFE_INTEGER)];
}

function assertUnlocked(widget: XmlElement): void {
  if (valueOf(widget, "locked") !== "true") return;
  throw new LayoutError(
    "BLOGGER_LAYOUT_LOCKED",
    `widget "${valueOf(widget, "id") ?? ""}" is locked and cannot be changed`
  );
}

function assertCapability(
  widget: XmlElement,
  capability: "removable" | "movable" | "canHide"
): void {
  const type = valueOf(widget, "type") ?? "";
  const definition = getGadgetDefinition(type);
  if (definition && definition.capabilities[capability] === false) {
    throw new LayoutError(
      "BLOGGER_LAYOUT_CAPABILITY_UNSUPPORTED",
      `widget type "${type}" does not support ${capability}`
    );
  }
}

function assertAllowedSection(widget: XmlElement, sectionId: string): void {
  assertAllowedSectionForType(valueOf(widget, "type") ?? "", sectionId);
}

function assertAllowedSectionForType(widgetType: string, sectionId: string): void {
  const definition = getGadgetDefinition(widgetType);
  const allowed = definition?.capabilities.allowedSectionIds;
  if (allowed && allowed.length > 0 && !allowed.includes(sectionId)) {
    throw new LayoutError(
      "BLOGGER_LAYOUT_SECTION_INCOMPATIBLE",
      `widget type "${widgetType}" cannot be placed in section "${sectionId}"`
    );
  }
}

function assertInstanceLimit(
  document: XmlDocument,
  widgetType: string,
  additional: number
): void {
  const definition = getGadgetDefinition(widgetType);
  const limit = definition?.capabilities.maxInstances;
  if (limit === undefined) return;
  const count = allWidgetElements(document).filter(
    (item) => valueOf(item, "type") === widgetType
  ).length;
  if (count + additional > limit) {
    throw new LayoutError(
      "BLOGGER_LAYOUT_MAX_INSTANCES",
      `widget type "${widgetType}" allows at most ${limit} instance${limit === 1 ? "" : "s"}`
    );
  }
}

function normalizeSettingsForType(
  widgetType: string,
  settings: Readonly<Record<string, string>>
): Record<string, string> {
  const normalized = normalizeGadgetSettings(widgetType, settings);
  const isLinkList = widgetType === LINKLIST_WIDGET_TYPE;
  const issues = validateGadgetSettings(widgetType, isLinkList ? settings : normalized);
  if (issues.length > 0) {
    throw new LayoutError("BLOGGER_LAYOUT_SETTING_INVALID", issues[0]?.message ?? "invalid gadget setting");
  }
  if (isLinkList) return linkListWritableSettings(normalized);
  const definition = getGadgetDefinition(widgetType);
  const known = definition ? definition.settingKeys : Object.keys(normalized);
  const values: Record<string, string> = {};
  for (const key of known) {
    const value = normalized[key];
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function assertCapacity(section: XmlElement, count: number, moving: boolean): void {
  const raw = valueOf(section, "maxwidgets");
  if (raw === undefined || raw.trim() === "") return;
  const limit = Number(raw);
  if (Number.isFinite(limit) && limit < 0) return;
  if (!Number.isFinite(limit) || count <= limit) return;
  throw new LayoutError(
    "BLOGGER_LAYOUT_LIMIT",
    `section "${valueOf(section, "id") ?? ""}" allows at most ${limit} widget${limit === 1 ? "" : "s"}` +
      (moving ? " when moving a widget into it" : "")
  );
}

function directWidgets(section: XmlElement): XmlElement[] {
  return section.children.filter(
    (node): node is XmlElement => isElement(node) && node.name === "b:widget"
  );
}

function uniqueWidgetId(type: string, used: ReadonlySet<string>): string {
  const prefix = type.replace(/[^A-Za-z0-9]/g, "") || "Widget";
  for (let index = 1; index < 10000; index++) {
    const candidate = `${prefix}${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new LayoutError("BLOGGER_LAYOUT_ID_EXHAUSTED", "unable to generate a unique widget id");
}

function buildWidgetMarkup(
  id: string,
  type: string,
  title: string,
  settings: Readonly<Record<string, string>>
): string {
  const body = widgetDefaultMarkupSource(type) ?? "";
  const entries = Object.entries(settings);
  const settingsMarkup = entries.length === 0
    ? ""
    : `<b:widget-settings>${entries.map((entry) => widgetSettingMarkup({ name: entry[0], value: entry[1] })).join("")}</b:widget-settings>`;
  return (
    `<b:widget id='${escapeAttribute(id)}' type='${escapeAttribute(type)}' ` +
    `title='${escapeAttribute(title)}' locked='false' visible='true' version='2'>` +
    `${settingsMarkup}<b:includable id='main'>${body}</b:includable></b:widget>`
  );
}

function indentWidgetMarkup(markup: string, indent: string): string {
  return markup.split("\n").join(`\n${indent}`);
}

interface WidgetSettingEntry {
  name: string;
  value: string;
}

function setWidgetSettingEdits(
  text: string,
  widget: XmlElement,
  name: string,
  value: string
): TextEdit[] {
  return setWidgetSettingsEdits(text, widget, { [name]: value });
}

function setWidgetSettingsEdits(
  text: string,
  widget: XmlElement,
  values: Readonly<Record<string, string>>
): TextEdit[] {
  const entries = Object.entries(values).map(([name, value]) => ({ name, value }));
  if (entries.length === 0) return [];
  const settings = widget.children.find(
    (node): node is XmlElement => isElement(node) && node.name === "b:widget-settings"
  );
  if (settings === undefined) return insertSettingsBlockEdits(text, widget, entries);
  const edits: TextEdit[] = [];
  const missing: WidgetSettingEntry[] = [];
  for (const entry of entries) {
    const setting = settings.children.find(
      (node): node is XmlElement =>
        isElement(node) && node.name === "b:widget-setting" && valueOf(node, "name") === entry.name
    );
    if (setting === undefined) {
      missing.push(entry);
      continue;
    }
    edits.push(...setWidgetSettingValueEdit(setting, entry.value));
  }
  if (missing.length > 0) edits.push(...insertMissingSettingEdits(text, settings, missing));
  return edits;
}

function widgetSettingsMap(widget: XmlElement): Record<string, string> {
  const values: Record<string, string> = {};
  const settings = widget.children.find(
    (node): node is XmlElement => isElement(node) && node.name === "b:widget-settings"
  );
  if (settings === undefined) return values;
  for (const setting of settings.children) {
    if (!isElement(setting) || setting.name !== "b:widget-setting") continue;
    const name = valueOf(setting, "name");
    if (name === undefined) continue;
    const chunks: string[] = [];
    for (const node of setting.children) {
      if (node.type === "text" || node.type === "cdata") chunks.push(decodeEntities(node.value));
    }
    values[name] = chunks.join("");
  }
  return values;
}

function removeWidgetSettingsEdits(
  text: string,
  widget: XmlElement,
  names: readonly string[]
): TextEdit[] {
  if (names.length === 0) return [];
  const settings = widget.children.find(
    (node): node is XmlElement => isElement(node) && node.name === "b:widget-settings"
  );
  if (settings === undefined) return [];
  const remove = new Set(names);
  const edits: TextEdit[] = [];
  for (const setting of settings.children) {
    if (!isElement(setting) || setting.name !== "b:widget-setting") continue;
    const name = valueOf(setting, "name");
    if (name === undefined || !remove.has(name)) continue;
    const lineStart = text.lastIndexOf("\n", setting.span.start - 1) + 1;
    const ownLine = /^[\t ]*$/.test(text.slice(lineStart, setting.span.start));
    edits.push({
      start: ownLine ? lineStart : setting.span.start,
      end: ownLine ? removeFollowingNewline(text, setting.span.end) : setting.span.end,
      replacement: "",
    });
  }
  return edits;
}

function setWidgetSettingValueEdit(setting: XmlElement, value: string): TextEdit[] {
  if (setting.selfClosing) {
    const at = setting.startTagSpan.end - 2;
    return [
      {
        start: at,
        end: setting.startTagSpan.end,
        replacement: `>${escapeXmlText(value)}</b:widget-setting>`,
      },
    ];
  }
  const content = setting.children.find(
    (node): node is XmlText | XmlCData => node.type === "text" || node.type === "cdata"
  );
  if (content?.type === "cdata") {
    const escaped = value.split("]]>").join("]]]]><![CDATA[>");
    return [
      {
        start: content.span.start,
        end: content.span.end,
        replacement: `<![CDATA[${escaped}]]>`,
      },
    ];
  }
  if (content !== undefined) {
    return [
      { start: content.span.start, end: content.span.end, replacement: escapeXmlText(value) },
    ];
  }
  const at = setting.endTagSpan?.start ?? setting.span.end;
  return [{ start: at, end: at, replacement: escapeXmlText(value) }];
}

function widgetSettingMarkup(entry: WidgetSettingEntry): string {
  return (
    `<b:widget-setting name='${escapeAttribute(entry.name)}'>` +
    `${escapeXmlText(entry.value)}</b:widget-setting>`
  );
}

function insertSettingsBlockEdits(
  text: string,
  widget: XmlElement,
  entries: readonly WidgetSettingEntry[]
): TextEdit[] {
  const baseIndent = elementIndent(text, widget);
  const indent = childIndent(text, widget);
  const markup =
    `<b:widget-settings>\n${indent}${entries
      .map(widgetSettingMarkup)
      .join(`\n${indent}`)}\n${indent}</b:widget-settings>`;
  if (widget.selfClosing) {
    const at = widget.startTagSpan.end - 2;
    return [
      { start: at, end: widget.startTagSpan.end, replacement: ">" },
      {
        start: widget.startTagSpan.end,
        end: widget.startTagSpan.end,
        replacement: `\n${indent}${markup}\n${baseIndent}</b:widget>`,
      },
    ];
  }
  return [
    {
      start: widget.startTagSpan.end,
      end: widget.startTagSpan.end,
      replacement: `\n${indent}${markup}`,
    },
  ];
}

function insertMissingSettingEdits(
  text: string,
  settings: XmlElement,
  entries: readonly WidgetSettingEntry[]
): TextEdit[] {
  const baseIndent = elementIndent(text, settings);
  const indent = childIndent(text, settings);
  const fragment = entries
    .map((entry) => `${indent}${widgetSettingMarkup(entry)}`)
    .join("\n");
  if (settings.selfClosing) {
    const at = settings.startTagSpan.end - 2;
    return [
      { start: at, end: settings.startTagSpan.end, replacement: ">" },
      {
        start: settings.startTagSpan.end,
        end: settings.startTagSpan.end,
        replacement: `\n${fragment}\n${baseIndent}</b:widget-settings>`,
      },
    ];
  }
  const at = settings.endTagSpan?.start ?? settings.span.end;
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  if (/^[\t ]*$/.test(text.slice(lineStart, at))) {
    return [{ start: lineStart, end: lineStart, replacement: `${fragment}\n` }];
  }
  return [{ start: at, end: at, replacement: `\n${fragment}` }];
}

function elementIndent(text: string, element: XmlElement): string {
  const lineStart = text.lastIndexOf("\n", element.span.start - 1) + 1;
  return /^[\t ]*/.exec(text.slice(lineStart, element.span.start))?.[0] ?? "";
}

function childIndent(text: string, element: XmlElement): string {
  const first = element.children.find((node) => node.type === "element");
  if (first !== undefined) {
    const indent = elementIndent(text, first as XmlElement);
    if (indent !== "") return indent;
  }
  return `${elementIndent(text, element)}  `;
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setAttributeEdits(element: XmlElement, name: string, value: string): TextEdit[] {
  const existing = attribute(element, name);
  if (existing !== undefined) {
    return [
      {
        start: existing.valueSpan.start,
        end: existing.valueSpan.end,
        replacement: escapeAttribute(value, existing.quote),
      },
    ];
  }
  const quote = "'";
  const at = element.selfClosing ? element.startTagSpan.end - 2 : element.startTagSpan.end - 1;
  return [
    {
      start: at,
      end: at,
      replacement: ` ${name}=${quote}${escapeAttribute(value, quote)}${quote}`,
    },
  ];
}

function removeAttributeEdits(element: XmlElement, name: string): TextEdit[] {
  const existing = attribute(element, name);
  if (existing === undefined) return [];
  const text = element.source.text;
  let start = existing.span.start;
  while (start > 0 && (text[start - 1] === " " || text[start - 1] === "\t")) start--;
  return [{ start, end: existing.span.end, replacement: "" }];
}

function removeElementEdit(text: string, element: XmlElement): TextEdit {
  let start = element.span.start;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  if (/^[\t ]*$/.test(text.slice(lineStart, start))) start = lineStart;
  return { start, end: removeFollowingNewline(text, element.span.end), replacement: "" };
}

function insertionEdit(
  text: string,
  section: XmlElement,
  fragment: string,
  index: number,
  exclude?: XmlElement
): TextEdit {
  const children = directWidgets(section).filter((item) => item !== exclude);
  const endStart = section.endTagSpan?.start ?? section.span.end;
  const target = children[index];
  if (target !== undefined) {
    const at = text.lastIndexOf("\n", target.span.start - 1) + 1;
    return { start: at, end: at, replacement: `${fragment}\n` };
  }
  const lineStart = text.lastIndexOf("\n", endStart - 1) + 1;
  if (/^[\t ]*$/.test(text.slice(lineStart, endStart))) {
    return { start: lineStart, end: lineStart, replacement: `${fragment}\n` };
  }
  return { start: endStart, end: endStart, replacement: `\n${fragment}` };
}

function sectionIndent(text: string, section: XmlElement): string {
  const first = directWidgets(section)[0];
  if (first !== undefined) {
    const lineStart = text.lastIndexOf("\n", first.span.start - 1) + 1;
    const match = /^[\t ]*/.exec(text.slice(lineStart, first.span.start));
    if (match !== null && match[0] !== "") return match[0];
  }
  const sectionLine = text.lastIndexOf("\n", section.span.start - 1) + 1;
  const base = /^[\t ]*/.exec(text.slice(sectionLine, section.span.start))?.[0] ?? "";
  return `${base}  `;
}

function escapeAttribute(value: string, quote: '"' | "'" = "'"): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(quote === "'" ? /'/g : /"/g, quote === "'" ? "&apos;" : "&quot;");
}

