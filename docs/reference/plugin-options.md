# Plugin options

All options are passed to the default export or named `blogger()` function in
`guchho.config.js`.

```js
import blogger from "@guchho/blogger";

export default {
  plugins: [blogger({ /* options */ })],
};
```

## Build options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | string | `src/template.xml` | Blogger XML entry, relative to the project root. |
| `validate` | boolean | `true` | Enforce conservative Blogger structure rules after XML well-formedness. |
| `outfile` | string | `template.xml` | Production XML path, relative to the output directory. Paths outside it are rejected. |
| `minify` | boolean | `false` | Collapse insignificant XML whitespace while preserving raw-text elements. |
| `mockData` | object or string | unset | Preview data overrides. Objects deep-merge; arrays replace. A string is a JSON fixture path relative to the project. |
| `widgets` | object | unset | Custom preview widget definitions keyed by Blogger widget type. |

## Preview options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preview` | boolean | `true` | Emit static mock previews during watch builds. Never enabled by production builds. |
| `previewDir` | string | `preview` | Preview directory relative to the output directory. Must stay inside it. |
| `previewDashboard` | boolean or string | `true` | `true` generates the dashboard and button; `false` disables both; a string changes the button URL. |
| `layoutSavePort` | number | `3001` | Local TCP port for the dev save service. `0` selects an available port. |
| `favicon` | string | `https://guchho.js.org/favicon.ico` | Preview favicon URL, exposed as `data:blog.blogspotFaviconUrl`. |

## Content options

`content` may be `false`, `true` (the default) or an options object.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | boolean or object | `true` | Enable the file-based Post/Page CMS and content HTML output. |
| `content.postsDir` | string | `src/posts` | Post JSON directory relative to the project root. |
| `content.pagesDir` | string | `src/pages` | Page JSON directory relative to the project root. |
| `content.dataDir` | string | `data` | Settings, categories and authors JSON directory. |
| `content.backupDir` | string | `.blogger-backups` | Backup directory for replaced or deleted content. |
| `content.siteUrl` | string | `baseUrl` from settings | Absolute public base URL used for generated links. |
| `content.sanitize` | boolean | `true` | Sanitize rich-text HTML before rendering. |
| `content.seedDefaultPost` | boolean | `true` | Create one published `hello-world.json` post during dev and production builds when the posts directory has no JSON files. |

## Complete example

```js
import blogger from "@guchho/blogger";

export default {
  plugins: [
    blogger({
      entry: "src/template.xml",
      outfile: "blogger/theme.xml",
      validate: true,
      minify: true,
      preview: true,
      previewDir: "preview",
      previewDashboard: true,
      layoutSavePort: 3001,
      favicon: "https://guchho.js.org/favicon.ico",
      mockData: "./preview-data.json",
      widgets: {
        Hero: {
          markup:
            "<b:includable id='main'>" +
            "<h1><data:title/></h1>" +
            "</b:includable>",
          data: {
            subtitle: "A custom hero",
          },
        },
      },
      content: {
        postsDir: "src/posts",
        pagesDir: "src/pages",
        dataDir: "data",
        backupDir: ".blogger-backups",
        siteUrl: "https://example.com/",
        sanitize: true,
        seedDefaultPost: true,
      },
    }),
  ],

  build: {
    entry: "src/index.html",
    outdir: "dist",
  },
};
```

Custom widget `markup` may be a `<b:defaultmarkup>` fragment or one or more
`<b:includable>` elements. The `data` object is merged into that widget's preview
scope.

## Related references

- [Content files](content-files.md)
- [Content API](content-api.md)
- [Dashboard guide](../guides/dashboard.md)
