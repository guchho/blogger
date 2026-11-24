import { gadgetCatalog, getGadgetDefinition, normalizeGadgetSettings } from "./gadgets.js";
import {
  applyLayoutOperations,
  availableWidgetTypes,
  validateLayoutXml,
} from "./operations.js";
import { extractLayout } from "./extract.js";
import type { LayoutEditorPayload, LayoutModel, LayoutOperation } from "./model.js";

export function serializeLayout(
  sourceText: string,
  operations: readonly LayoutOperation[] = [],
  entryPath = "src/template.xml",
  allowedWidgetTypes: readonly string[] = []
): { xml: string; model: LayoutModel } {
  if (operations.length === 0) {
    const model = extractLayout(sourceText, entryPath);
    validateLayoutXml(sourceText, entryPath);
    return { xml: sourceText, model };
  }
  return applyLayoutOperations(sourceText, operations, entryPath, allowedWidgetTypes);
}

export function migrateLayoutModelSettings(model: LayoutModel): LayoutModel {
  const migrated: LayoutModel = JSON.parse(JSON.stringify(model));
  for (const section of migrated.sections) {
    for (const widget of section.widgets) {
      widget.settings = normalizeGadgetSettings(widget.type, widget.settings);
    }
  }
  return migrated;
}

export function editorPayload(
  inputModel: LayoutModel,
  savePort: number,
  widgetTypes: string[] = availableWidgetTypes()
): LayoutEditorPayload {
  const model = migrateLayoutModelSettings(inputModel);
  const origin = `http://localhost:${savePort}`;
  const widgetTypeLabels: Record<string, string> = {};
  for (const type of widgetTypes) widgetTypeLabels[type] = getGadgetDefinition(type)?.label ?? type;
  const builtInTypes = new Set(gadgetCatalog().map((item) => item.type));
  const catalog = gadgetCatalog().map((item) => {
    const def = getGadgetDefinition(item.type);
    return {
      type: item.type,
      label: item.label,
      category: item.category,
      description: item.description,
      icon: item.icon,
      implemented: item.implemented,
      configurable: item.configurable,
      capabilities: item.capabilities,
      sections: (def?.sections ?? []).map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field })) })),
      defaults: { ...(def?.defaults ?? {}) },
    };
  });
  for (const type of widgetTypes) {
    if (builtInTypes.has(type)) continue;
    catalog.push({
      type,
      label: widgetTypeLabels[type] ?? type,
      category: "Custom",
      description: "Custom widget type registered by the theme. Preview markup comes from the plugin widget registry.",
      icon: "puzzle",
      implemented: "partial",
      configurable: false,
      capabilities: { configurable: false, duplicable: true, removable: true, movable: true, canHide: true },
      sections: [],
      defaults: {},
    });
  }
  return {
    model,
    saveUrl: `${origin}/api/layout/save`,
    statusUrl: `${origin}/api/layout/status`,
    widgetTypes,
    widgetTypeLabels,
    gadgetCatalog: catalog,
    allowedWidgetTypes: widgetTypes,
  };
}

export { applyLayoutOperations, availableWidgetTypes, validateLayoutXml };
