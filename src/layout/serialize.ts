import { gadgetCatalog, getGadgetDefinition } from "./gadgets.js";
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
  entryPath = "src/template.xml"
): { xml: string; model: LayoutModel } {
  if (operations.length === 0) {
    const model = extractLayout(sourceText, entryPath);
    validateLayoutXml(sourceText, entryPath);
    return { xml: sourceText, model };
  }
  return applyLayoutOperations(sourceText, operations, entryPath);
}

export function editorPayload(
  model: LayoutModel,
  savePort: number,
  widgetTypes: string[] = availableWidgetTypes()
): LayoutEditorPayload {
  const origin = `http://localhost:${savePort}`;
  const widgetTypeLabels: Record<string, string> = {};
  for (const type of widgetTypes) widgetTypeLabels[type] = getGadgetDefinition(type)?.label ?? type;
  return {
    model,
    saveUrl: `${origin}/api/layout/save`,
    statusUrl: `${origin}/api/layout/status`,
    widgetTypes,
    widgetTypeLabels,
    gadgetCatalog: gadgetCatalog().map((item) => {
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
    }),
  };
}

export { applyLayoutOperations, availableWidgetTypes, validateLayoutXml };
