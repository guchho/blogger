// Dev-only preview pipeline. It parses the compiled Blogger template, renders
// every mock scenario to static HTML and reports any expression the preview
// engine could not evaluate. Nothing here runs during a production build.

import { parseXml } from "../xml/parser.js";
import { SourceFile } from "../xml/source.js";
import { buildScenarios } from "./data/pages.js";
import type { PreviewScenario } from "./data/types.js";
import { renderTemplate } from "./render/renderer.js";
import { escapeHtml } from "./values.js";

export interface PreviewPage {
  /** File name relative to the preview directory, e.g. "index.html". */
  file: string;
  /** Human label shown in the preview index. */
  title: string;
  html: string;
}

export interface PreviewDiagnostic {
  code: string;
  message: string;
  /** `line:column` within the template, when the report came from a node. */
  location?: string;
}

export interface PreviewBuildResult {
  pages: PreviewPage[];
  diagnostics: PreviewDiagnostic[];
}

export interface PreviewBuildOptions {
  /** Path used for diagnostics; also the template identity. */
  entryPath: string;
  /** The compiled Blogger template XML. */
  xml: string;
  /** Override the scenario set (mainly for tests). */
  scenarios?: PreviewScenario[];
  /** Inject a "mock preview" banner at the top of each page. Defaults to true. */
  banner?: boolean;
}

export function buildPreview(options: PreviewBuildOptions): PreviewBuildResult {
  const source = new SourceFile(options.entryPath, options.xml);
  const document = parseXml(source);
  const scenarios = options.scenarios ?? buildScenarios();
  const withBanner = options.banner !== false;

  const pages: PreviewPage[] = [];
  const diagnostics: PreviewDiagnostic[] = [];

  for (const scenario of scenarios) {
    const reports: PreviewDiagnostic[] = [];
    const result = renderTemplate(document, scenario.data, {
      report: (code, message, location) => reports.push({ code, message, location }),
    });
    diagnostics.push(...reports);
    const html = withBanner ? injectBanner(result.html, scenario.title) : result.html;
    pages.push({ file: scenario.file, title: scenario.title, html });
  }

  return { pages, diagnostics };
}

function injectBanner(html: string, title: string): string {
  const banner =
    `<div data-guchho-preview="banner" style="position:relative;z-index:2147483647;` +
    `background:#111;color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;` +
    `padding:8px 12px;text-align:center">` +
    `Mock preview — ${escapeHtml(title)}. Rendered from deterministic sample data; ` +
    `not a live Blogger page.</div>`;
  const match = /<body[^>]*>/i.exec(html);
  if (match === null) return banner + html;
  const at = match.index + match[0].length;
  return html.slice(0, at) + banner + html.slice(at);
}

export { buildScenarios } from "./data/pages.js";
export { TemplateRenderer, renderTemplate } from "./render/renderer.js";
export type { PreviewScenario } from "./data/types.js";

/** Diagnostic code prefix the preview engine uses. */
export const PREVIEW_DIAGNOSTIC_PREFIX = "BLOGGER_PREVIEW";

export function isPreviewDiagnostic(diagnostic: { code: string }): boolean {
  return diagnostic.code.startsWith(PREVIEW_DIAGNOSTIC_PREFIX);
}
