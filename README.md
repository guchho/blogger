# @guchho/blogger

Official Blogger template compiler plugin for [Guchho](https://guchho.js.org).

Build Blogger templates like a normal frontend project: split XML into components, use local CSS, JavaScript and assets, and let Guchho produce one `dist/template.xml` plus local previews.

[![Guchho Plugin Blogger](https://raw.githubusercontent.com/guchho/plugins/refs/heads/main/resources/guchho_blogger_plugin.png)](https://github.com/guchho)

## Install

```bash
npm install --save-dev guchho @guchho/blogger
```

## Setup

Create `guchho.config.js`:

```js
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

`src/index.html` is optional. Local CSS, JavaScript and assets referenced from the template are bundled into the final XML.

## Components

Use `<g:include>` to split a template:

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

Includes resolve relative to the file that contains them, may nest, and are watched for rebuilds.

## Run

```bash
npx guchho dev
npx guchho build
```

`build` writes `dist/template.xml`. `dev` also writes static pages to `dist/preview/` and a Blogger-style dashboard to `dist/__preview/dashboard/`.

## Example

[`example/`](example/) is a Git submodule pointing to the [CodeHemu](https://github.com/code-hemu/codehemu) Blogger theme source. It is included as a real-world reference; tests use a local fixture instead.

After cloning this repository, initialize it with:

```bash
git submodule update --init example
```

## Docs

- [Documentation hub](docs/README.md)
- [Blogger compatibility](docs/blogger-compatibility.md)

## Disclaimer

@guchho/blogger is an independent, community-developed project providing tools and utilities for working with Blogger and developing Blogger themes. It is **not affiliated with, endorsed by, sponsored by, or otherwise associated with Google LLC or Blogger**.

"Blogger" and related names are trademarks of Google LLC.


## License

@guchho/blogger is licensed under **GPL-3.0**. Copyright © [CodeHemu](https://github.com/code-hemu).