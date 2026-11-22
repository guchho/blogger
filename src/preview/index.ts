// Template rendering pipeline. It parses the compiled Blogger template, renders
// scenarios to static HTML and reports expressions the renderer could not
// evaluate. Used by watch previews and by production content emission.

import { buildContentScenarios, type ContentScenarioOptions } from "../content/scenarios.js";
import type { ContentSnapshot } from "../content/settings.js";
import type { BloggerWidgetRegistry } from "../types.js";
import { parseXml } from "../xml/parser.js";
import { SourceFile } from "../xml/source.js";
import { PREVIEW_FAVICON } from "./data/metadata.js";
import { applyMockData } from "./data/mockData.js";
import { mockPosts } from "./data/mock.js";
import { buildScenarios } from "./data/pages.js";
import {
  buildDashboardScreens,
  extractBaseStyle,
  PREVIEW_DASHBOARD_ROUTE,
} from "./dashboard.js";
import { previewFeedEntries, previewFeedScript } from "./feeds.js";
import type { PreviewScenario } from "./data/types.js";
import { withImageFallback } from "./render/image-fallback.js";
import { renderTemplate, type RenderReportDetail } from "./render/renderer.js";
import { buildShowcaseTemplate } from "./render/showcase.js";
import {
  buildWidgetRegistry,
  type WidgetRegistry,
} from "./render/widgets.js";
import { escapeHtml, type ValueMap } from "./values.js";

export interface PreviewPage {
  /** File name relative to the preview directory, e.g. "index.html". */
  file: string;
  /** Route-shaped path, e.g. "/2026/01/getting-started.html". */
  route: string;
  /** Human label shown in the preview index. */
  title: string;
  html: string;
}

export interface PreviewDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** `line:column` within the template, when the report came from a node. */
  location?: string;
  file?: string;
  line?: number;
  column?: number;
  hint?: string;
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
  /** Pristine entry source used by the Layout Editor. */
  layoutXml?: string;
  /** Port published to the Layout Editor for save requests. */
  layoutSavePort?: number;
  /** Favicon URL exposed as `data:blog.blogspotFaviconUrl`. Defaults to `favicon.ico`. */
  favicon?: string;
  /** Override the scenario set (mainly for tests). */
  scenarios?: PreviewScenario[];
  /** Inject a "mock preview" banner at the top of each page. Defaults to true. */
  banner?: boolean;
  /**
   * Dashboard button in the banner and generated dashboard page. `true` uses
   * the built-in page, `false` disables both, a string overrides the button URL.
   */
  dashboard?: boolean | string;
  /** Deep-merged preview data overrides. */
  mockData?: Record<string, unknown>;
  /** Custom widget definitions. */
  widgets?: BloggerWidgetRegistry;
  /** Prebuilt widget registry, mainly for internal reuse. */
  widgetRegistry?: WidgetRegistry;
  /** CMS content to render. When omitted, deterministic mock scenarios are used. */
  content?: ContentSnapshot;
  /** Options for CMS scenario generation. */
  contentOptions?: ContentScenarioOptions;
}

export function buildPreview(options: PreviewBuildOptions): PreviewBuildResult {
  const source = new SourceFile(options.entryPath, options.xml);
  const baseDocument = parseXml(source);
  const registry =
    options.widgetRegistry ?? buildWidgetRegistry(options.widgets);
  const showcaseDocument = parseXml(
    new SourceFile(`${options.entryPath}#widgets`, buildShowcaseTemplate(registry))
  );
  const scenarios =
    options.scenarios ??
    (options.content === undefined
      ? buildScenarios()
      : buildContentScenarios(options.content, {
          ...options.contentOptions,
          baseUrl: options.contentOptions?.baseUrl ?? options.content.settings.baseUrl,
          favicon: options.favicon ?? options.content.settings.favicon,
          includeWidgets: options.contentOptions?.includeWidgets ?? options.banner !== false,
          sanitize: options.contentOptions?.sanitize ?? true,
        }));
  const favicon = options.favicon ?? PREVIEW_FAVICON;
  const withBanner = options.banner !== false;
  const dashboard = options.dashboard ?? true;
  const dashboardUrl =
    typeof dashboard === "string" ? dashboard : PREVIEW_DASHBOARD_ROUTE;
  const dashboardHref =
    withBanner && dashboard !== false ? dashboardUrl : undefined;
  const feedPosts: ValueMap[] =
    options.content === undefined
      ? mockPosts()
      : scenarios.flatMap((scenario) => {
          const view = scenario.data["view"];
          if (
            view !== null &&
            typeof view === "object" &&
            !Array.isArray(view) &&
            (view as ValueMap)["isPage"] === true
          ) {
            return [];
          }
          const post = scenario.data["post"];
          return post !== null && typeof post === "object" && !Array.isArray(post)
            ? [post as ValueMap]
            : [];
        });
  const feedScript = withBanner ? previewFeedScript(previewFeedEntries(feedPosts)) : "";

  const pages: PreviewPage[] = [];
  const diagnostics: PreviewDiagnostic[] = [];
  const seen = new Set<string>();

  for (const scenario of scenarios) {
    let data = applyMockData(scenario.data, options.mockData);
    data = applyScenarioOverrides(data, options.mockData);
    const blog = data["blog"];
    const blogData =
      blog !== null && typeof blog === "object" && !Array.isArray(blog)
        ? (blog as ValueMap)
        : {};
    data = {
      ...data,
      blog: { ...blogData, blogspotFaviconUrl: favicon },
    };
    const document =
      scenario.type === "widgets" ? showcaseDocument : baseDocument;
    const reports: PreviewDiagnostic[] = [];

    let html: string;
    try {
      const result = renderTemplate(document, data, {
        report: (
          code,
          message,
          location,
          detail?: RenderReportDetail
        ) => {
          reports.push({
            severity: detail?.severity ?? "warning",
            code,
            message,
            location,
            file: detail?.file,
            line: detail?.line,
            column: detail?.column,
            hint: detail?.hint,
          });
        },
      }, registry);
      html = withImageFallback(result.html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({
        severity: "error",
        code: "BLOGGER_PREVIEW_FAILED",
        message: `preview page "${scenario.title}" failed to render: ${message}`,
        hint: "check the template expressions and widget definitions used by this page",
      });
      html = fallbackPage(scenario.title, message);
    }

    for (const report of reports) {
      const key = [
        report.code,
        report.message,
        report.location ?? "",
        report.file ?? "",
        report.line ?? "",
        report.column ?? "",
      ].join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(report);
    }

    pages.push({
      file: scenario.file,
      route: scenario.route,
      title: scenario.title,
      html: withBanner
        ? injectPreviewChrome(html, feedScript, dashboardHref)
        : html,
    });
  }

  if (dashboard === true) {
    pages.push(
      ...buildDashboardScreens(
        pages.map(({ file, route, title }) => ({ file, route, title })),
        options.xml,
        extractBaseStyle(baseDocument),
        {
          xml: options.layoutXml ?? options.xml,
          entryPath: options.entryPath,
          css: extractBaseStyle(baseDocument),
          savePort: options.layoutSavePort ?? 3001,
        },
        favicon,
        options.content === undefined
          ? undefined
          : { snapshot: options.content, savePort: options.layoutSavePort ?? 3001 }
      )
    );
  }

  return { pages, diagnostics };
}

function applyScenarioOverrides(
  data: ValueMap,
  overrides: Record<string, unknown> | undefined
): ValueMap {
  if (overrides === undefined) return data;
  const output: ValueMap = { ...data };

  const postOverrides = overrides["post"];
  if (isPlainObject(postOverrides)) {
    const post = output["post"];
    if (isPlainObject(post)) {
      output["post"] = applyMockData(post as ValueMap, postOverrides);
    }
    const posts = output["posts"];
    if (Array.isArray(posts) && isPlainObject(posts[0])) {
      const copy = [...posts];
      copy[0] = applyMockData(posts[0] as ValueMap, postOverrides);
      output["posts"] = copy;
    }
  }

  const pageOverrides = overrides["page"];
  if (isPlainObject(pageOverrides)) {
    const page = output["page"];
    if (isPlainObject(page)) {
      output["page"] = applyMockData(page as ValueMap, pageOverrides);
    }
  }

  return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fallbackPage(title: string, message: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>` +
    `${escapeHtml(title)}</title></head><body>` +
    `<h1>Preview failed: ${escapeHtml(title)}</h1>` +
    `<pre>${escapeHtml(message)}</pre></body></html>`
  );
}

function injectPreviewChrome(
  html: string,
  feedScript: string,
  dashboardHref: string | undefined
): string {
  const dashboardButton =
    dashboardHref === undefined
      ? ""
      : ` <a role="button" data-guchho-preview="dashboard-button" ` +
        `href="${escapeHtml(dashboardHref)}" target="_blank" rel="noopener" ` +
        `style="display:inline-block;margin-left:8px;padding:3px 10px;border:1px solid #fff;` +
        `border-radius:4px;background:transparent;color:#fff;font:inherit;cursor:pointer;` +
        `text-decoration:none">Open dashboard</a>`;
  const banner =
    `<div data-guchho-preview="banner" style="position:relative;z-index:2147483647;` +
    `background:#111;color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;` +
    `padding:8px 12px;text-align:center">` +
    `Mock preview — Sample content, not a live Blogger page.${dashboardButton}</div>`;

  let output = html;
  if (feedScript !== "") {
    const head = /<head[^>]*>/i.exec(output);
    if (head !== null) {
      const at = head.index + head[0].length;
      output = output.slice(0, at) + feedScript + output.slice(at);
    } else {
      output = feedScript + output;
    }
  }

  const match = /<body[^>]*>/i.exec(output);
  if (match === null) return banner + output;
  const at = match.index + match[0].length;
  return output.slice(0, at) + banner + output.slice(at);
}

export { buildScenarios } from "./data/pages.js";
export { previewFeedEntries, previewFeedScript } from "./feeds.js";
export { previewRouteFile } from "./routes.js";
export { TemplateRenderer, renderTemplate } from "./render/renderer.js";
export {
  buildWidgetRegistry,
  widgetDefaultMarkups,
  type WidgetRegistry,
} from "./render/widgets.js";
export type { PreviewScenario } from "./data/types.js";
