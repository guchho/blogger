import type { Span } from "../diagnostics.js";

export interface LayoutAttributeModel {
  name: string;
  value: string;
  quote: '"' | "'";
  valueSpan: Span;
  span: Span;
}

export interface LayoutSectionModel {
  id: string;
  name?: string;
  className?: string;
  maxwidgets?: number;
  showaddelement: boolean;
  growth?: string;
  span: Span;
  startTagSpan: Span;
  endTagSpan?: Span;
  attributes: LayoutAttributeModel[];
  widgets: LayoutWidgetModel[];
}

export interface LayoutWidgetModel {
  id: string;
  type: string;
  title: string;
  locked: boolean;
  visible: boolean;
  version?: string;
  sectionId: string;
  span: Span;
  attributes: LayoutAttributeModel[];
  includables: string[];
  settings: Record<string, string>;
}

export interface LayoutStructureNode {
  tag: string;
  id?: string;
  className?: string;
  cond?: string;
  sectionId?: string;
  children: LayoutStructureNode[];
}

export interface LayoutCssModel {
  skin: string;
  templateSkin: string;
  style: string;
  combined: string;
}

export interface LayoutModel {
  entryPath: string;
  sections: LayoutSectionModel[];
  /** Nested wrapper/section tree that mirrors the template page structure. */
  structure?: LayoutStructureNode[];
  css: LayoutCssModel;
  hash: string;
}

export interface WidgetChanges {
  title?: string;
  locked?: boolean;
  visible?: boolean;
  version?: string;
  imageUrl?: string;
  settings?: Record<string, string>;
}

export interface SectionChanges {
  name?: string;
  className?: string;
  maxwidgets?: number | null;
  showaddelement?: boolean;
  growth?: string;
}

export type LayoutOperation =
  | { kind: "addWidget"; sectionId: string; widgetType: string; title?: string; settings?: Record<string, string> }
  | { kind: "removeWidget"; widgetId: string }
  | { kind: "reorderWidget"; widgetId: string; index: number }
  | { kind: "moveWidget"; widgetId: string; sectionId: string; index: number }
  | { kind: "duplicateWidget"; widgetId: string }
  | { kind: "editWidget"; widgetId: string; changes: WidgetChanges }
  | { kind: "editSection"; sectionId: string; changes: SectionChanges };

export interface LayoutGadgetCatalogField {
  kind: string;
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  maxLength?: number;
  showIf?: { key: string; equals?: string | boolean; notEquals?: string | boolean; truthy?: boolean; falsy?: boolean };
  advanced?: boolean;
  itemOrder?: readonly string[];
}

export interface LayoutGadgetCatalogSection {
  id: string;
  label: string;
  description?: string;
  fields: LayoutGadgetCatalogField[];
}

export interface LayoutGadgetCatalogEntry {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  implemented: "full" | "partial" | "unsupported";
  configurable: boolean;
  capabilities: {
    configurable: boolean;
    duplicable: boolean;
    removable: boolean;
    movable: boolean;
    canHide: boolean;
    maxInstances?: number;
    allowedSectionIds?: string[];
  };
  sections: LayoutGadgetCatalogSection[];
  defaults: Record<string, string>;
}

export interface LayoutEditorPayload {
  model: LayoutModel;
  saveUrl: string;
  statusUrl: string;
  widgetTypes: string[];
  widgetTypeLabels?: Record<string, string>;
  gadgetCatalog?: LayoutGadgetCatalogEntry[];
  allowedWidgetTypes?: string[];
}

export class LayoutError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LayoutError";
    this.code = code;
  }
}
