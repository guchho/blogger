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
  return {
    model,
    saveUrl: `${origin}/api/layout/save`,
    statusUrl: `${origin}/api/layout/status`,
    widgetTypes,
  };
}

export { applyLayoutOperations, availableWidgetTypes, validateLayoutXml };
