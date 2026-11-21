# @guchho/blogger

Official Blogger template compiler plugin for [Guchho](https://guchho.js.org).

Develop a Blogger theme as a normal frontend project: split it into components,
style it with CSS, script it with JavaScript, and let Guchho produce one
production-ready `dist/template.xml` plus a deterministic mock preview during
watch mode.

## Requirements

- Node.js 18 or newer.
- Guchho `1.0.10` or newer. Earlier releases cannot accept the Blogger entry
  contributed by the plugin.

## Install

```bash
npm install --save-dev guchho @guchho/blogger
```

## Configuration

```js
// guchho.config.js
import blogger from "@guchho/blogger";

export default {
  plugins: [
    blogger({
      entry: "src/template.xml",
      outfile: "dist/template.xml",
      minify: true,
      validate: true,
    }),
  ],

  build: {
    entry: "src/index.html",
    outdir: "dist",
  },
};
```

A normal HTML entry is optional. When present, it builds beside the Blogger
template and owns `dist/index.html`.

### Plugin options

- `entry` — Blogger XML entry, relative to the project root. Default:
  `src/template.xml`.
- `validate` — enable conservative Blogger structural validation. Default:
  `true`.
- `outfile` — production XML path, relative to the output directory. Default:
  `template.xml`. Paths outside the output directory are rejected.
- `minify` — collapse insignificant XML whitespace while preserving
  `<pre>`, `<textarea>`, `<script>`, `<style>`, `<b:skin>` and
  `<b:template-skin>`. Default: `false`.
- `preview` — emit static mock preview pages during watch builds. Default:
  `true`. Preview pages are never emitted for production builds.
- `previewDir` — preview directory relative to the output directory. Default:
  `preview`.
- `previewDashboard` — dashboard button and generated mock dashboard page in
  previews. `false` disables both; a string sets a custom button URL. Default:
  `true`.
 - `layoutSavePort` — local TCP port for the dev-only Layout Editor save service.
   Default: `3001`. The service binds to `127.0.0.1` and only starts during watch
   builds when the dashboard is enabled.
 - `favicon` — preview favicon URL exposed as `data:blog.blogspotFaviconUrl` and
   shown on the dashboard Settings screen. Default: `favicon.ico`. The bundled
   `favicon.ico` is emitted to the output directory unless the build already has
   one.
 - `content` — enable the file-based Post/Page CMS. `false` keeps the legacy
   XML-only build; an object configures content paths. Default: enabled.
   - `postsDir` — post JSON directory relative to the project root. Default:
     `src/posts`.
   - `pagesDir` — page JSON directory relative to the project root. Default:
     `src/pages`.
   - `dataDir` — settings/categories/authors JSON directory. Default: `data`.
   - `backupDir` — backup directory for overwritten/deleted content. Default:
     `.blogger-backups`.
   - `siteUrl` — public base URL for generated links; overrides `settings.json`.
   - `sanitize` — sanitize rich-text HTML before rendering. Default: `true`.

- `mockData` — preview data overrides as an object or a JSON fixture path
  relative to the project root. Objects deep-merge into the deterministic mock
  data; arrays replace.
- `widgets` — custom preview widget definitions keyed by Blogger widget type.

```js
blogger({
  outfile: "blogger/theme.xml",
  minify: true,
  mockData: "./preview-data.json",
  widgets: {
    Hero: {
      markup:
        "<b:includable id='main'>" +
        "<h1><data:title/></h1><p><data:subtitle/></p>" +
        "</b:includable>",
      data: {
        subtitle: "A custom hero",
        body: { __html: "<strong>Trusted HTML</strong>" },
      },
    },
  },
});
```

Custom widget `markup` may be a `<b:defaultmarkup>` fragment or one or more
`<b:includable>` elements. The `data` object is merged into that widget's
preview scope.

## Project layout

```text
src/
  template.xml
  index.html
  components/
    head.xml
    body.xml
  styles/
    main.css
  scripts/
    main.js
  assets/
    logo.svg
```

See [`examples/basic`](examples/basic) for a working project.

## Components

Use `<g:include src="..."/>` to compose the template:

```xml
<!-- src/template.xml -->
<html>
  <head>
    <g:include src="./components/head.xml"/>
    <link rel="stylesheet" href="./styles/main.css"/>
  </head>
  <body>
    <g:include src="./components/body.xml"/>
    <script src="./scripts/main.js"></script>
  </body>
</html>
```

Includes resolve relative to the file that contains them, may nest, must stay
inside the project, and are watched for rebuilds. Missing files, cycles,
invalid `src` values and `<g:include>` elements with children are errors with
`file:line:column` locations.

## Styles, scripts and assets

Local `<link rel="stylesheet">` and `<script src>` references are bundled by
Guchho, then inlined into the final Blogger XML inside `<style>` and `<script>`
CDATA blocks.

Local assets referenced from common attributes (`src`, `href`, `poster`,
`srcset`, `data`, `image[href|xlink:href]`, `use[href|xlink:href]`) and CSS
`url(...)` values are inlined as data URLs by default. Absolute URLs,
protocol-relative URLs and `data:`, `mailto:`, `tel:` and fragment URLs are
left untouched.

No local development path is written to the template.

## Output

`guchho build` writes:

- `dist/template.xml` by default — the complete Blogger template.
- `dist/index.html` — untouched when a normal HTML entry is configured.
- Any custom `outfile` path inside the output directory.

The synthetic JavaScript module used to pull CSS, JS and assets through Guchho
is removed from the output after assembly.

## Development preview

During `guchho dev`, the plugin writes deterministic HTML previews to
`dist/preview/` and route-shaped copies to the output root:

```text
dist/preview/index.html
dist/preview/post.html
dist/2026/01/getting-started-with-guchho.html
dist/search/label/Templates/index.html
dist/widgets.html
```

Root `index.html` is skipped when a normal HTML entry exists. Preview routes are
static files; query strings such as `/search?q=guchho` cannot be represented
and the search preview uses `/search/` instead. Route collisions are reported
and skipped.

The route-shaped files make the preview reachable from links inside the
rendered theme without a custom server.

Each page with a preview banner gets an **Open dashboard** button. It opens a
local Blogger-style admin area under `/__preview/dashboard/`, with route-shaped
and flat copies for every screen:

```text
dist/__preview/dashboard/index.html          dist/preview/dashboard.html
dist/__preview/dashboard/posts/index.html    dist/preview/dashboard-posts.html
dist/__preview/dashboard/pages/index.html    dist/preview/dashboard-pages.html
dist/__preview/dashboard/comments/index.html dist/preview/dashboard-comments.html
dist/__preview/dashboard/layout/index.html   dist/preview/dashboard-layout.html
dist/__preview/dashboard/theme/index.html    dist/preview/dashboard-theme.html
dist/__preview/dashboard/settings/index.html dist/preview/dashboard-settings.html
```

There are also static New Post and New Page editor screens under
`/__preview/dashboard/posts/new/` and `/__preview/dashboard/pages/new/`. Every
screen uses the same deterministic sample data as the theme previews; toolbar,
editor and moderation controls are visual only and no data is sent anywhere.
The Layout screen is a Blogger-style Layout Editor, not a Blog Preview. It
reads sections, widgets and CSS from the real `template.xml`, renders widgets in
a Shadow DOM canvas using the template's own styles, and supports adding,
editing, removing, reordering and moving widgets. Section limits and locked
widgets are enforced. Changes are serialized back into the pristine entry XML;
unsupported elements, attributes and formatting are preserved.

During watch builds with the dashboard enabled, the plugin also starts a
localhost save service on `layoutSavePort` (default `3001`). The editor sends
saves to `http://localhost:<port>/api/layout/save`; each save checks the source
hash to avoid overwriting external edits, writes a timestamped backup, and
validates the result before replacing the file. The service is intended only
for local development: it binds to `127.0.0.1`, accepts only localhost origins,
and is never started by production builds. Set `layoutSavePort: 0` to use an
available ephemeral port. If the configured port already hosts a Guchho save
service for the same project and entry, that service is reused silently; a
foreign listener still reports `BLOGGER_LAYOUT_SAVE_UNAVAILABLE`.

The Theme screen includes a **Base style (template.xml)** panel: CSS from every
`<style>` and `<b:skin>`
element is collected in document order, decoded and HTML-escaped. Long
stylesheets are capped at 12,000 characters, with a note reporting the total
length.
Set `previewDashboard: false` to remove the button and all admin screens, or
pass a URL string to point the button somewhere else. The default link is
root-relative, so previews should be served (as with `guchho dev`) rather than
opened directly via `file://`.

## File-based content

When `content` is enabled, Posts and Pages are stored as individual JSON files in
the consuming project. The Dashboard lists live content and opens Blogger-style
editors for creating and updating it; the dev-only save service exposes CRUD,
publish/unpublish, trash/restore and bulk endpoints under `/api/posts` and
`/api/pages`. All writes are validated, path-confined, hashed for stale-write
detection and backed up before replacement or deletion.

```text
src/
  posts/
    hello-world.json
  pages/
    about.json
data/
  settings.json
  categories.json
  authors.json
```

Production builds render content through the actual Blogger template and emit
HTML beside `template.xml`, using Blogger-compatible routes such as
`/2026/11/hello-world.html` and `/p/about.html`. Scheduled posts become published
when their `publishAt` time passes; trashed items are soft-deleted with
`trashedAt` and excluded from public output. Rich-text HTML is preserved in the
JSON and sanitized before rendering by default.

Enable the legacy behavior with `content: false`: no content files are watched,
no content endpoints are served, and production emits only the XML template plus
any normal HTML entry.

## Validation

XML well-formedness is always checked. With `validate: true`, the plugin also
enforces evidence-backed Blogger rules:

- the root should be `<html>`,
- `b:section` requires an `id`,
- `b:widget` requires `id` and `type` and must be a direct child of
  `b:section`,
- `b:section` and `b:widget` IDs must be unique,
- `b:includable` requires an `id`,
- `b:include` requires a `name`,
- `b:if` requires `cond`.

Unknown `b:*` elements and attributes, `data:*` / `expr:*` expressions and
comments are left unchanged. Blogger expressions are never evaluated during a
production build.

## Preview diagnostics

Preview diagnostics include `severity`, `code`, `message`, `location`, `file`,
`line`, `column` and `hint` when available:

| Code | Meaning |
| --- | --- |
| `BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION` | Malformed expression or unsupported syntax. |
| `BLOGGER_PREVIEW_UNSUPPORTED_HELPER` | Unknown helper function. |
| `BLOGGER_PREVIEW_UNSUPPORTED_ELEMENT` | Unknown `b:*` element. |
| `BLOGGER_PREVIEW_UNKNOWN_INCLUDABLE` | Missing includable. |
| `BLOGGER_PREVIEW_UNKNOWN_WIDGET` | Widget type without a fallback `main`. |
| `BLOGGER_PREVIEW_MISSING_DATA` | Referenced preview data does not exist. |
| `BLOGGER_PREVIEW_ROUTE_CONFLICT` | Preview route collided with an output file. |
| `BLOGGER_PREVIEW_ROUTE_INVALID` | Preview route could not be mapped safely. |
| `BLOGGER_PREVIEW_FAILED` | A preview page failed to render. |

See [`docs/blogger-compatibility.md`](docs/blogger-compatibility.md) for the
full preview data, expression and widget reference.

## Current limitations

 - One Blogger entry per build.
 - Search query strings cannot be represented by static preview routes.
 - Production XML is assembled from compiled resources; content is rendered to
   static HTML at build time, and live Blogger data never runs during a
   production build.
 - The content save service is local development only; it binds to
   `127.0.0.1`, accepts localhost origins and is never started by production
   builds.
 - Guchho's `transform` hook and `this.resolve()` are not used by this plugin.


## License

GPL-3.0-or-later.
