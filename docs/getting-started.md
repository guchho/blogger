---
title: Getting started
description: Install @guchho/blogger, configure the plugin, and run your first build.
---

# Getting started

This guide installs `@guchho/blogger`, creates a minimal Guchho configuration,
and explains the first development and production builds.

## Requirements

- Node.js 18 or newer.
- Guchho `1.0.10` or newer.

## Install

```bash
npm install --save-dev guchho @guchho/blogger
```

## Configure the plugin

```js
// guchho.config.js
import blogger from "@guchho/blogger";

export default {
  plugins: [
    blogger({
      entry: "src/template.xml",
      outfile: "template.xml",
    }),
  ],

  build: {
    entry: "src/index.html",
    outdir: "dist",
  },
};
```

The HTML entry is optional. When present, it builds beside the Blogger template
and owns `dist/index.html`.

## Create the project files

```text
my-theme/
├── guchho.config.js
├── src/
│   ├── template.xml
│   ├── index.html
│   ├── components/
│   │   └── head.xml
│   ├── styles/
│   │   └── main.css
│   ├── posts/
│   │   └── hello-world.json
│   └── pages/
│       └── about.json
└── data/
    ├── settings.json
    ├── categories.json
    └── authors.json
```

The `src/posts`, `src/pages` and `data` directories are the defaults for the
file-based CMS. They are created on first write. See
[Content files](reference/content-files.md) for the JSON schema and
[Plugin options](reference/plugin-options.md) to change the paths.

## Run the development preview

```bash
npx guchho dev
```

Watch mode:

- compiles `src/template.xml` into `dist/template.xml`,
- writes preview pages and layout CSS to `dist/preview/` and route-shaped copies
  to the output root, including `/__preview/layout/skin.css` and
  `/__preview/layout/template-skin.css`,
- starts the local dashboard and save service when the dashboard is enabled,
- watches template, content and data files for changes.

Open the served preview with `http://localhost:3000/` or the port used by your
Guchho setup. Previews use root-relative dashboard links, so open them through
the dev server rather than `file://`.

The dev build creates a published `src/posts/hello-world.json` when no post JSON
files exist, then renders content through the real template and shows it in the
posts dashboard at `http://localhost:3000/__preview/dashboard/posts/`. Set
`content.seedDefaultPost: false` to keep empty directories empty; in that case
the plugin uses deterministic built-in mock preview data.

## Run a production build

```bash
npx guchho build
```

A production build also seeds `src/posts/hello-world.json` when the posts
directory has no JSON files, then writes:

- `dist/template.xml` — the complete Blogger template,
- `dist/index.html` — only when a normal HTML entry is configured,
- rendered content pages, such as `dist/2026/11/hello-world.html` and
  `dist/p/about.html`, when posts or pages exist.

Production never writes mock preview pages and never starts the local save
service.

Legacy XML-only output is available with:

```js
blogger({ content: false });
```

## Next steps

- Follow the [Content CMS guide](guides/content-cms.md) to create posts and
  pages.
- Read [Architecture](concepts/architecture.md) to understand the pipelines.
- See [Blogger compatibility](blogger-compatibility.md) for supported template
  constructs and preview data.
