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
}

export interface SectionChanges {
  name?: string;
  className?: string;
  maxwidgets?: number | null;
  showaddelement?: boolean;
  growth?: string;
}

export type LayoutOperation =
  | { kind: "addWidget"; sectionId: string; widgetType: string }
  | { kind: "removeWidget"; widgetId: string }
  | { kind: "reorderWidget"; widgetId: string; index: number }
  | { kind: "moveWidget"; widgetId: string; sectionId: string; index: number }
  | { kind: "editWidget"; widgetId: string; changes: WidgetChanges }
  | { kind: "editSection"; sectionId: string; changes: SectionChanges };

export interface LayoutEditorPayload {
  model: LayoutModel;
  saveUrl: string;
  statusUrl: string;
  widgetTypes: string[];
}

export class LayoutError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LayoutError";
    this.code = code;
  }
}
