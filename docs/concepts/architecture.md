# Architecture

`@guchho/blogger` has two related pipelines: a production template compiler and
a local rendering layer used by previews and static content output.

## Production template pipeline

During `guchho build`:

1. Content is initialized, creating one published default post when the posts
   directory is empty and seeding is enabled.
2. The configured XML entry is parsed.
3. `<g:include>` components are inlined.
4. Local CSS, JavaScript and assets are bundled and inlined.
5. Conservative Blogger structure validation runs when `validate` is enabled.
6. A synthetic carrier token is replaced and the final `template.xml` is
   emitted.
7. When content files exist, the template is rendered again through the local
   Blogger-compatible renderer and static post/page/label/archive/search pages
   are emitted beside `template.xml`.

Production never evaluates live Blogger data and never emits preview banner,
dashboard or widget showcase pages.

## Watch preview pipeline

During `guchho dev`, content is initialized and seeded before the compiled
template is rendered into static HTML for a set of scenarios. Preview pages are
written in two forms:

- under `previewDir` (`dist/preview/` by default), and
- at route-shaped output paths so links inside the theme resolve.

If content files exist, scenarios are generated from them. With seeding disabled
and no content files, the built-in deterministic mock data is used. The renderer
reports unsupported expressions, missing includables and unknown widget types as
diagnostics.

When the dashboard is enabled, the plugin also generates Blogger-style admin
screens under `/__preview/dashboard/` and starts a localhost save service.

## Content pipeline

Posts, pages and settings are plain JSON files under the consuming project:

```text
src/posts/*.json
src/pages/*.json
data/settings.json
data/categories.json
data/authors.json
```

The plugin loads these files into a `ContentSnapshot`. The snapshot carries a
SHA-256 hash derived from canonical JSON, so a content change can trigger a
rebuild and editors can detect stale writes.

All content mutations are:

- validated against the post/page schema,
- confined to the configured directories inside the project,
- serialized through a per-file lock,
- written atomically through a temporary file and rename,
- backed up before replacement or deletion.

## Local save service

A Node HTTP service binds to `127.0.0.1` during watch builds when the dashboard
is enabled. It serves:

- Layout Editor saves under `/api/layout/*`,
- CMS operations under `/api/content/*`, `/api/posts/*` and `/api/pages/*`.

Only localhost origins are accepted. The service is never started by a
production build and must not be exposed as a public CMS backend.

## Separation of concerns

| Layer | Responsibility |
| --- | --- |
| Compiler | XML assembly, resources, validation, production template |
| Content storage | JSON files, schema validation, hashing, backups, locks |
| Renderer | Blogger expression evaluation and template rendering |
| Scenarios | Mapping content to Blogger view data and routes |
| Dashboard | Local admin UI and editor screens |
| Save service | Localhost write endpoints for layout and content |

Continue with [Content model](content-model.md) and
[Rendering and routes](rendering.md).
