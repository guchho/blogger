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
  entryPath = "src/template.xml"
): ApplyResult {
  let xml = sourceText;
  for (const operation of operations) {
    const document = parseTemplate(xml, entryPath);
    const edits = operationEdits(document, xml, operation);
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
  operation: LayoutOperation
): TextEdit[] {
  switch (operation.kind) {
    case "addWidget":
      return addWidgetEdits(document, text, operation.sectionId, operation.widgetType);
    case "removeWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      assertUnlocked(found.widget);
      return [removeElementEdit(text, found.widget)];
    }
    case "reorderWidget":
    case "moveWidget": {
      const found = findWidgetElement(document, operation.widgetId);
      if (found === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_WIDGET_MISSING", `widget "${operation.widgetId}" was not found`);
      }
      assertUnlocked(found.widget);
      const targetId =
        operation.kind === "moveWidget" ? operation.sectionId : valueOf(found.section, "id") ?? "";
      const target =
        operation.kind === "moveWidget"
          ? findSectionElement(document, targetId)
          : found.section;
      if (target === undefined) {
        throw new LayoutError("BLOGGER_LAYOUT_SECTION_MISSING", `section "${targetId}" was not found`);
      }
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
      if (changes.title !== undefined) edits.push(...setAttributeEdits(found.widget, "title", changes.title));
      if (changes.locked !== undefined) edits.push(...setAttributeEdits(found.widget, "locked", String(changes.locked)));
      if (changes.visible !== undefined) edits.push(...setAttributeEdits(found.widget, "visible", String(changes.visible)));
      if (changes.version !== undefined) edits.push(...setAttributeEdits(found.widget, "version", changes.version));
      const widgetType = valueOf(found.widget, "type") ?? "";
      if (changes.imageUrl !== undefined && widgetType === "Header") {
        edits.push(...setWidgetSettingEdits(text, found.widget, "displayUrl", changes.imageUrl));
      }
      if (changes.settings !== undefined) {
        const definition = getGadgetDefinition(widgetType);
        const normalized = normalizeGadgetSettings(widgetType, changes.settings);
        const issues = validateGadgetSettings(widgetType, normalized);
        if (issues.length > 0) {
          throw new LayoutError("BLOGGER_LAYOUT_SETTING_INVALID", issues[0]?.message ?? "invalid gadget setting");
        }
        const values: Record<string, string> = {};
        if (definition) {
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
  sectionId: string,
  widgetType: string
): TextEdit[] {
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
  if (!availableWidgetTypes().includes(widgetType)) {
    throw new LayoutError("BLOGGER_LAYOUT_WIDGET_TYPE_INVALID", `unknown widget type "${widgetType}"`);
  }
  const used = new Set(allWidgetElements(document).map((item) => valueOf(item, "id") ?? ""));
  const id = uniqueWidgetId(widgetType, used);
  const markup = buildWidgetMarkup(id, widgetType);
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

function buildWidgetMarkup(id: string, type: string): string {
  const body = widgetDefaultMarkupSource(type) ?? "";
  return (
    `<b:widget id='${escapeAttribute(id)}' type='${escapeAttribute(type)}' ` +
    `title='${escapeAttribute(type)}' locked='false' visible='true' version='2'>` +
    `<b:includable id='main'>${body}</b:includable></b:widget>`
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

