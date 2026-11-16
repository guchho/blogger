# @guchho/blogger

Official Blogger template compiler plugin for [Guchho](https://guchho.js.org).

Develop a Blogger theme as a normal frontend project: split it into components,
style it with CSS, script it with JavaScript, and let Guchho produce one
production-ready `dist/template.xml`.

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
      validate: true,
    }),
  ],

  build: {
    entry: "src/index.html",
    outdir: "dist",
  },
};
```

The top-level Guchho configuration is unchanged. Blogger-specific options live
inside `blogger(...)`:

- `entry` — Blogger XML entry, relative to the project root. Default:
  `src/template.xml`.
- `validate` — enable conservative Blogger structural validation. Default:
  `true`.

The regular HTML entry is optional, but keeping one preserves Guchho's normal
preview and development flow. When it is present, `dist/index.html` and the
Blogger template build side by side.

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

Includes:

- resolve relative to the file that contains them,
- may nest recursively,
- must stay inside the project directory,
- are watched for rebuilds.

Missing files, cycles, invalid `src` values and `<g:include>` elements with
children are reported as errors with `file:line:column` locations.

## Styles, scripts and assets

Local `<link rel="stylesheet">` and `<script src>` references are bundled by
Guchho, then inlined into the final Blogger XML inside `<style>` and `<script>`
CDATA blocks.

Local assets referenced from common attributes (`src`, `href`, `poster`,
`srcset`, `data`) and CSS `url(...)` values are inlined as data URLs by
default. Absolute URLs, protocol-relative URLs and `data:`, `mailto:`, `tel:`
and fragment URLs are left untouched.

No local development path is written to the template.

## Output

`guchho build` writes:

- `dist/template.xml` — the complete Blogger template.
- `dist/index.html` — untouched when a normal HTML entry is configured.

The synthetic JavaScript module used to pull CSS, JS and assets through
Guchho is removed from the output after assembly.

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

## Current limitations

- One Blogger entry per build.
- When the template has a `<b:skin>`, theme CSS is appended inside it as an
  additional CDATA section; otherwise CSS is injected as a `<style>` element.
- The mock preview (`dist/preview.html`) is not implemented yet.
- Guchho's `transform` hook and `this.resolve()` are not used by this plugin.

## License

GPL-3.0-or-later.
