import { blogger } from "./plugin.js";

export { blogger };
export default blogger;
export {
  TemplateCompiler,
  CSS_SKIN_TOKEN,
  CSS_TOKEN,
  JS_TOKEN,
  assetToken,
  isExternalSpecifier,
  isInside,
} from "./compiler/compiler.js";
export { assembleTemplate, findUnresolvedTokens } from "./compiler/assemble.js";
export {
  createPostRepository,
  createPageRepository,
  loadContent,
  loadSettings,
  resolveContentPaths,
  slugify,
  ensureUniqueSlug,
  validatePost,
  validatePage,
  sanitizeHtml,
  buildContentScenarios,
  postPath,
  pagePath,
  postUrl,
  pageUrl,
  searchUrl,
  assertNoRouteCollisions,
} from "./content/index.js";
export { ContentError } from "./content/index.js";
export { buildPreview } from "./preview/index.js";
export { buildScenarios } from "./preview/data/pages.js";
export { previewRouteFile } from "./preview/routes.js";
export { renderTemplate, TemplateRenderer } from "./preview/render/renderer.js";
export {
  buildWidgetRegistry,
  widgetDefaultMarkups,
} from "./preview/render/widgets.js";
export { parseXml } from "./xml/parser.js";
export { SourceFile, splitBom } from "./xml/source.js";
export type {
  PreviewBuildOptions,
  PreviewBuildResult,
  PreviewDiagnostic,
  PreviewPage,
  PreviewScenario,
  WidgetRegistry,
} from "./preview/index.js";
export type {
  BloggerContentOptions,
  BloggerMockData,
  BloggerPluginOptions,
  BloggerWidgetDefinition,
  BloggerWidgetDefinitionObject,
  BloggerWidgetRegistry,
  CompiledTemplate,
  CompileOptions,
  CompileResult,
  Diagnostic,
  DiagnosticSeverity,
  PreviewOptions,
  ResourceKind,
  ResourceReference,
  SourceLocation,
} from "./types.js";
export type {
  ContentItem,
  ContentKind,
  ContentPaths,
  ContentSnapshot,
  ContentStatus,
  Page,
  Post,
  SiteSettings,
} from "./content/index.js";
export type { Plugin } from "guchho";
