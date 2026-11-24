# @guchho/blogger

Official Blogger template compiler plugin for [Guchho](https://guchho.js.org).

Build Blogger templates like a normal frontend project: split XML into components, use local CSS, JavaScript and assets, and let Guchho produce one `dist/template.xml` plus local previews.

[![Guchho Plugin Blogger](https://raw.githubusercontent.com/guchho/plugins/refs/heads/main/resources/guchho_blogger_plugin.png)](https://github.com/guchho)

Requires Node.js 18+ and Guchho 1.1.0+.

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

See [`example/`](example/) for a complete small project:

```bash
cd example
npm install
npm run dev
```

## Docs

- [Documentation hub](docs/README.md)
- [Blogger compatibility](docs/blogger-compatibility.md)

## License

GPL-3.0-or-later
