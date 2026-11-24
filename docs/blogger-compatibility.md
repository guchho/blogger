# Blogger compatibility

This document describes what `@guchho/blogger` understands when it compiles a
Blogger template and when it renders the development preview. It is a
compatibility reference, not a Blogger specification: Blogger remains the
source of truth for production rendering.

Two pipelines consume a template:

- **Production build** parses the XML, expands `<g:include>` components, bundles
  local CSS/JavaScript/assets and writes `dist/template.xml`. It never evaluates
  Blogger expressions.
- **Preview** (watch mode only) parses the assembled template and renders every
  mock scenario to static HTML with a small Blogger-compatible expression
  engine. Production output never contains preview data.

## Template structure

### Components and resources

| Construct | Behavior |
| --- | --- |
| `<g:include src="..."/>` | Inlines a relative XML component. May nest. Must stay inside the project. Cycles and missing files are errors. |
| `<link rel="stylesheet" href="...">` | Local stylesheets are bundled and inlined into the template. |
| `<script src="...">` | Local scripts are bundled and inlined into the template. |
| Local asset attributes | `src`, `srcset`, `poster`, `data`, `link[href]`, `image[href|xlink:href]`, `use[href|xlink:href]` and CSS `url(...)` values are inlined as data URLs. |
| Absolute, protocol-relative, `data:`, `mailto:`, `tel:` and fragment URLs | Left untouched. |

Styles are appended to `<b:skin>` when present (as an additional CDATA
section); otherwise a `<style>` element is injected. Scripts become a `<script>`
element. No local development path is written to `dist/template.xml`.

### Blogger elements

| Element | Attributes | Behavior |
| --- | --- | --- |
| `<b:section>` | `id`, `class`, `name` | Renders a `<div class="section">` container. |
| `<b:widget>` | `id`, `type`, `title`, `visible` | Renders `<div class="widget TYPE">` and the `main` includable. `visible="false"` skips it. |
| `<b:includable>` | `id`, `var` | A named template body. Only rendered through `b:include` or as a widget's `main`. |
| `<b:include>` | `name` or `expr:name`, `cond`, `data`, plus child `b:param` | Renders another includable. Supports `super.NAME` fallback. |
| `<b:param>` | `name`, `value` or `expr:value` | Passes a value into `b:include` or `b:message`. |
| `<b:loop>` | `values`, `var`, `index` | Iterates arrays, or map values. |
| `<b:with>` | `value`, `var` | Binds a local value. |
| `<b:if>` | `cond` | Conditional block. |
| `<b:elseif>` | `cond` | Branch of a `b:if`. |
| `<b:else>` | — | Default branch of a `b:if`. |
| `<b:switch>` | `var` | Selects a `b:case` by text equality. |
| `<b:case>` | `value` | Branch of a `b:switch`. |
| `<b:default>` | — | Default branch of a `b:switch`. |
| `<b:tag>` | `name`, `cond` | Renders a dynamic element name; omitted when `cond` is false. |
| `<b:attr>` | `name`, `value`/`expr:value`, `cond` | Adds or overrides an attribute. |
| `<b:class>` | `name`/`expr:name`, `cond` | Adds a class. |
| `<b:eval>` | `expr` | Outputs an expression as text. |
| `<b:message>` | `name` | Outputs a message with `{param}` substitution from child `b:param`. Trusted `HtmlString` messages keep their markup; substituted params are still escaped. |
| `<b:comment>` | — | Content is never rendered. |
| `<b:whitespace>` | — | Renders its children transparently. |
| `<b:skin>`, `<b:template-skin>` | — | Rendered as a `<style>` element. |
| `<b:template-script>` | — | Rendered as a `<script>` element. |
| `<b:widget-settings><b:widget-setting name="...">` | `name` | Values become `data:NAME` inside the widget. |
| `<b:defaultmarkups><b:defaultmarkup type="...">` | `type` | Provides widget-type fallback includables. |
| `<data:NAME>` | — | Outputs a value; trusted HTML is not escaped. |

Includable resolution order for a widget's `main` (and other includes) is:
widget includables → template `b:defaultmarkup` → built-in widget registry →
`Common` markup → built-in includables. `super.NAME` moves to the next layer.

### Attributes

- `expr:foo="..."` evaluates the expression and writes attribute `foo`.
- `b:*` attributes and `xmlns*` attributes are not emitted.
- Literal attributes are copied unchanged.
- Dynamic attributes from `<b:attr>`/`<b:class>` children are merged in.
- Namespace prefixes such as `expr:` are the only attribute prefixes with
  special meaning.
- `cond` is honored on `b:if`, `b:elseif`, `b:include`, `b:tag`, `b:attr` and
  `b:class`. Widgets are hidden with `visible="false"`. Other elements keep
  `cond` as a literal attribute; wrap them in `<b:if>` or `<b:tag>` instead.

## Expression language

Expressions appear in `expr:*` attributes, `cond`, `values`, `value`, `data`,
`expr:name`, `expr:value`, `b:eval expr` and `b:message name`.

### Literals and references

| Form | Example |
| --- | --- |
| String | `'text'`, `"text"` (backslash escapes supported) |
| Number | `42`, `3.5` |
| Boolean | `true`, `false` |
| Null | `null` |
| Array | `[1, 2, 3]` |
| Map | `{ length: 160 }` |
| Set-like array | `{ 'a', 'b' }` |
| Lambda | `p => p.title`, `(a, b) => a + b` |
| Data reference | `data:post.title`, bare `post.title` |
| Index | `data:posts[0]`, `data:map['key']` |
| Member | `data:post.author.name` |

XML entities in expressions are decoded before parsing (`&quot;`, `&amp;`,
`&lt;`, `&gt;`, numeric references), so quoted strings work inside XML
attributes.

### Operators

| Operator | Meaning |
| --- | --- |
| `not`, `!` | Logical negation |
| `and` | Logical and (short-circuits, returns boolean) |
| `or` | Logical or (short-circuits, returns boolean) |
| `==`, `!=` | Loose equality (numeric, boolean or text comparison) |
| `<`, `>`, `<=`, `>=` | Numeric when either side is a number, otherwise text order |
| `in`, `not in` | Membership in an array, map key or substring |
| `contains` | Substring/member test |
| `+` | Numeric addition when both sides are numbers, otherwise text concatenation |
| `test ? a : b` | Conditional |
| `left ?: right` | Coalesce: `left` when truthy, otherwise `right` |

There is no `-`, `*`, `/` or `%` operator. Use the helper functions for
collection work.

### Truthiness

`null`, `false`, `0`, `NaN`, empty strings, empty HTML strings, empty arrays and
empty maps are falsy. Everything else, including dates and functions, is truthy.

### Helper calls

Helpers can be called directly or postfix:

```xml
<data:post.body snippet { length: 160 }/>
<b:eval expr='resizeImage(data:post.featuredImage, 1920)'/>
```

Postfix calls take zero or one argument. Direct calls accept any number of
arguments. Unknown helpers are reported and evaluate to `null`.

| Helper | Result |
| --- | --- |
| `resizeImage(image, width)` | Resizes a Blogger image URL (`/sNNN/` or `=sNNN`). |
| `snippet(value, { length })` | Strips tags, collapses whitespace and truncates with `…`. |
| `fragment(url, name)` | Replaces the URL fragment. |
| `take` / `limit` `(values, n)` | First `n` items. |
| `skip` / `offset` `(values, n)` | Drops the first `n` items. |
| `count` / `length` `(value)` | Length of an array, map, string or HTML string. |
| `first` / `last` `(values[, predicate])` | First/last matching item. |
| `any` / `all` / `none` `(values[, predicate])` | Predicate checks. |
| `map` / `select` `(values, lambda)` | Projects each item. |
| `filter` / `where` `(values, lambda)` | Filters items. |
| `contains(haystack, needle)` | Substring, array member or map key test. |
| `startsWith` / `endsWith` `(text, text)` | Text prefix/suffix test. |
| `keys` / `values` `(map)` | Map keys or values. |
| `toJson(value)` | JSON string. |
| `trim` / `toLowerCase` / `toUpperCase` `(text)` | Text transforms. |
| `date(value)` | `BloggerDate` value. |
| `default(value, fallback)` | `value` when truthy, otherwise `fallback`. |
| `isResizable(url)` | True for Blogger/ blogspot image URLs. |
| `empty(value)` | True when the value is falsy. |
| `escaped(value)` / `jsonEscaped(value)` | Escaped text (also available as properties). |

### Value properties

| Value | Properties |
| --- | --- |
| String / HTML string | `.escaped`, `.jsonEscaped`, `.empty`, `.length`, `.canonical`; `.isResizable` is true for Blogger image URLs |
| Number | `.escaped`, `.empty`, `.length` |
| Boolean | `.escaped`, `.empty` |
| `BloggerDate` | `.iso8601`, `.escaped`, `.empty` |
| Array | `.first`, `.last`, `.length`, `.empty`, plus keys added by the mock data (e.g. `data:widgets.Blog`) |
| Map | Dynamic keys plus `.empty` |

Dates render as an `en-US` long date (`January 1, 2026`); `.iso8601` exposes the
ISO timestamp.

### Output escaping

Normal strings are HTML-escaped in both text and attribute contexts. Values
wrapped as trusted HTML (`HtmlString`) are emitted unchanged. Blogger post
bodies, widget HTML/Text content and LinkList text are trusted; most other mock
values are plain strings.

## Widgets

The preview ships minimal built-in `main` markups for these widget types. A
theme can override any of them with its own `<b:includable id="main">`; the
fallback exists so a bare `<b:widget type="...">` still renders.

| Type | Mock-specific data |
| --- | --- |
| `Blog` | `posts` (title, body, author, labels, dates, URLs, comments and backlinks metadata) |
| `Header` | `title`, `description`, `image` |
| `PageList` | `pages` |
| `Label` | `labels` |
| `BlogArchive` | `posts` |
| `PopularPosts` | `posts` |
| `FeaturedPost` | `posts` |
| `BlogSearch`, `Search` | `blog.searchUrl`, `messages.search` |
| `FollowByEmail` | `messages.emailAddress`, `messages.subscribe` |
| `HTML`, `Text` | `content` |
| `Image` | `sourceUrl`, `link`, `width`, `height`, `altText`, `caption` |
| `LinkList` | `links` (expanded from native `sorting`, `shownum`, `text-N` / `link-N` settings) |
| `Profile` | `team` |
| `Subscribe` | `feedUrl` |
| `Followers` | `totalCount` |
| `Stats` | `totalCount` |
| `Translate` | Renders a placeholder element. |
| `ReportAbuse` | `reportAbuseUrl` |
| `ContactForm` | `contactFormMessage`, `contactFormMessageSent`, `contactFormMessageError` |
| `Attribution` | `blog.title`, `messages.poweredBy` |

Every widget also receives `type`, `id`, `title`, `instanceId`,
`allBylineItems`, `headerByline`, `footerBylines`, `messages`, `sharing`,
`postDisplay`, `links`, `image`, `height`, `width`, `imagePlacement`,
`sourceUrl`, `description`, `style`, `display`, `showFreqNumbers` and its
`b:widget-settings` values. LinkList settings are expanded with `expandLinks`,
including alphabetical/reverse sorting and the `shownum` display limit.

Widgets also appear in `data:widgets`, which is an array that additionally
carries one key per widget type, so `data:widgets.Blog.first` works like
Blogger.

## Mock data and scenarios

Preview data is deterministic. Nothing is fetched from the network and the clock
is fixed (base date 2026-01-01). Available scenarios:

| File | Route | Page type | Contents |
| --- | --- | --- | --- |
| `index.html` | `/` | `index` | Homepage with all default widgets |
| `post.html` | `/2026/01/getting-started-with-guchho.html` | `item` | One post |
| `page.html` | `/p/about.html` | `static_page` | One static page |
| `label.html` | `/search/label/Templates/` | `label` | Label results |
| `archive.html` | `/2026/01/` | `archive` | Archive results |
| `search.html` | `/search/` | `search` | Search results; `/search?q=...` is not a distinct static route |
| `404.html` | `/404.html` | `error_page` | Not found |
| `widgets.html` | `/__preview/widgets/` | `index` | Built-in and custom widget showcase |

Flat pages are written under `previewDir`; route-shaped copies are written at
the output root unless a normal HTML entry owns `index.html`.

The root object exposes `data:view`, `data:blog`, `data:posts`, `data:post`,
`data:page`, `data:labels`, `data:comments`, `data:widgets`,
`data:allBylineItems`, `data:messages`, `data:skin`, `data:defaultTitle`,
`data:newerPageUrl`, `data:olderPageUrl`, `data:sourceUrl`, `data:feedPath`,
`data:cmtIframeInitialHeight`, `data:showCmtPopup`, `data:navMessage`,
`data:adClientId`, `data:archive`, `data:search` and `data:settings`. Blog
metadata includes `pageName`, `searchUrl`, `analytics4` and
`analyticsAccountNumber`.

Posts use deterministic authors (Ada Lovelace, Grace Hopper), titles, labels,
comment threads, image URLs and dates. The blog URL is
`http://localhost:3000/`.

## Known differences from Blogger

- **No live data.** Blogger fetches posts, comments, feeds and pagination from
  its backend. The preview always uses the fixed mock dataset above.
- **Minimal default markup.** Built-in widget markups are structural fallbacks,
  not pixel-accurate copies of Blogger's defaults.
- **Limited expression language.** Only the operators, helpers and properties
  listed here are implemented. Unsupported helpers, elements and malformed
  expressions produce `BLOGGER_PREVIEW_*` diagnostics and evaluate to `null`
  instead of failing the build.
- **No arithmetic beyond `+`.** Use text helpers instead of `-`, `*`, `/`, `%`.
- **No `cond` on arbitrary HTML elements.** Use `b:if`, `b:tag`, `b:attr` or
  `b:class`.
- **Postfix helpers accept at most one argument.** Use the direct-call form for
  more.
- **Escaping is not context-sensitive.** Text and attribute output use the same
  HTML escaping; only trusted `HtmlString` values bypass it.
- **Dates are fixed to `en-US` long format.** Blogger's locale and timezone
  behavior is not reproduced.
- **Production does not evaluate expressions.** Blogger evaluates them
  server-side when the theme is installed.
- **One Blogger entry per build.** Configured `outfile` and an optional normal
  HTML entry are emitted side by side; preview pages are emitted only during
  watch builds.
- **Static preview routes.** Query strings are ignored when mapping routes to
  files, so `/search?q=...` cannot have its own preview file.
- **Whitespace minification is opt-in.** `minify: true` collapses formatting
  whitespace outside raw-text and skin elements; it does not rewrite markup.
- **Conservative validation.** Structural checks cover the root element,
  section/widget IDs and placement, includable IDs, include names and `b:if`
  conditions. Unknown `b:*` elements, `data:*`/`expr:*` expressions and
  comments are left unchanged.

## Limits and diagnostics

| Limit | Value |
| --- | --- |
| Expression evaluation depth | 64 |
| Expression evaluation steps | 200,000 |
| Include depth | 64 |

Preview diagnostics use these codes:

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
| `BLOGGER_PREVIEW_LIMIT` | Include, expression depth or step limit exceeded. |
| `BLOGGER_PREVIEW_FAILED` | A preview page or the preview pipeline could not render. |

Compiler and validation diagnostics (`BLOGGER_INCLUDE_*`, `BLOGGER_RESOURCE_*`,
`BLOGGER_VALIDATION_*`, `BLOGGER_XML_*`, `BLOGGER_ASSET_*`) are reported during
the production build as well.
