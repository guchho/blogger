---
title: Programmatic API
description: ESM imports and TypeScript signatures for using @guchho/blogger directly.
---

# Programmatic API

The package is an ESM module. Import helpers from the package root:

```js
import blogger, {
  buildContentScenarios,
  buildPreview,
  createPageRepository,
  createPostRepository,
  loadContent,
  resolveContentPaths,
} from "@guchho/blogger";
```

## Plugin

```ts
blogger(options?: BloggerPluginOptions): Plugin
```

Creates the Guchho plugin. See [Plugin options](plugin-options.md) for every
configuration key.

## Content loading

```ts
resolveContentPaths(
  projectRoot: string,
  overrides?: {
    postsDir?: string;
    pagesDir?: string;
    dataDir?: string;
    backupDir?: string;
  }
): ContentPaths
```

Resolves and validates the configured content directories. Paths must remain
inside `projectRoot`.

```ts
loadContent(paths: ContentPaths): Promise<ContentSnapshot>
loadSettings(paths: ContentPaths): Promise<SiteSettings>
```

Load all content or site settings from JSON files.

```ts
createPostRepository(paths: ContentPaths): ContentRepository<Post>
createPageRepository(paths: ContentPaths): ContentRepository<Page>
```

Create a repository with `all`, `list`, `get`, `find`, `getBySlug`, `slugs`,
`hash`, `create`, `update`, `setStatus`, `trash`, `restore`, `remove`, `bulk` and
`filePath` methods.

## Validation and slugs

```ts
validatePost(value: unknown): Post
validatePage(value: unknown): Page
slugify(input: string): string
ensureUniqueSlug(input: string, taken: Iterable<string>): UniqueSlugResult
sanitizeHtml(html: string): string
ContentError
```

`validatePost` and `validatePage` throw `ContentError` on invalid input.
`ensureUniqueSlug` returns a `suggested` value for reserved or duplicate slugs.

## Rendering

```ts
buildPreview(options: PreviewBuildOptions): PreviewBuildResult
buildContentScenarios(
  snapshot: ContentSnapshot,
  options?: ContentScenarioOptions
): PreviewScenario[]
buildScenarios(): PreviewScenario[]
renderTemplate(document, data, options?, registry?): { html: string }
TemplateRenderer
previewRouteFile(route: string): string
```

`buildPreview` renders scenarios into `{ pages, diagnostics }`. Passing
`content` switches it from built-in mock scenarios to content scenarios.

```ts
postPath(item): string
pagePath(item): string
postUrl(baseUrl, item): string
pageUrl(baseUrl, item): string
searchUrl(baseUrl, query?): string
assertNoRouteCollisions(posts, pages): Map<string, string>
```

Route helpers generate the same paths used by the plugin.

## Compiler helpers

```ts
TemplateCompiler
assembleTemplate
findUnresolvedTokens
parseXml
SourceFile
splitBom
isInside
buildWidgetRegistry
widgetDefaultMarkups
```

These are useful for tools that inspect or build on the compilation pipeline.

## Type exports

The package exports these TypeScript types:

- `BloggerContentOptions`, `BloggerPluginOptions`, `BloggerMockData`
- `BloggerWidgetDefinition`, `BloggerWidgetDefinitionObject`,
  `BloggerWidgetRegistry`
- `ContentItem`, `ContentKind`, `ContentPaths`, `ContentSnapshot`,
  `ContentStatus`, `Page`, `Post`, `SiteSettings`
- `PreviewBuildOptions`, `PreviewBuildResult`, `PreviewDiagnostic`,
  `PreviewPage`, `PreviewScenario`, `WidgetRegistry`
- `CompiledTemplate`, `CompileOptions`, `CompileResult`, `Diagnostic`,
  `DiagnosticSeverity`, `PreviewOptions`, `ResourceKind`, `ResourceReference`,
  `SourceLocation`
- `Plugin` from Guchho

## Example: list published posts

```js
import {
  createPostRepository,
  resolveContentPaths,
} from "@guchho/blogger";

const paths = resolveContentPaths(process.cwd());
const posts = createPostRepository(paths);
const result = await posts.list({ status: "published" });

for (const post of result.items) {
  console.log(post.slug, post.title);
}
```
