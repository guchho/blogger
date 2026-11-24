# Content files

Posts, pages and site data are JSON files inside the consuming project. Direct
edits are supported; watch mode reloads them and production reads them at build
time.

## Default layout

```text
<project>/
├── src/
│   ├── posts/
│   │   └── <id>.json
│   └── pages/
│       └── <id>.json
├── data/
│   ├── settings.json
│   ├── categories.json
│   └── authors.json
└── .blogger-backups/
```

The file name must be the item `id` plus `.json`. IDs may contain only letters,
digits, hyphens and underscores. Paths are confined to the project root.

## Default post seeding

During dev and production builds, the plugin checks the configured posts
directory before loading content. If it contains no JSON files, the plugin
creates `hello-world.json`: a published post with the title `Hello world` and an
ISO 8601 timestamp. Existing JSON files are never overwritten, including invalid
files. A seeding failure is reported as a `BLOGGER_CONTENT_SEED_FAILED` warning
and the build continues.

Set `content.seedDefaultPost: false` to keep empty posts directories empty. When
content is disabled with `content: false`, no post is seeded.

## Post schema

```json
{
  "id": "hello-world",
  "type": "post",
  "title": "Hello world",
  "slug": "hello-world",
  "content": "<p>Post body.</p>",
  "excerpt": "",
  "status": "published",
  "labels": ["News"],
  "author": "admin",
  "featuredImage": null,
  "allowComments": true,
  "createdAt": "2026-11-21T09:00:00.000Z",
  "updatedAt": "2026-11-21T09:00:00.000Z",
  "publishedAt": "2026-11-21T09:00:00.000Z",
  "publishAt": "2026-11-21T09:00:00.000Z",
  "trashedAt": null
}
```

`excerpt`, `labels`, `author`, `allowComments`, `content`, `featuredImage`,
`publishedAt`, `publishAt` and `trashedAt` have defaults. All other fields are
required.

## Page schema

```json
{
  "id": "about",
  "type": "page",
  "title": "About",
  "slug": "about",
  "content": "<p>About this blog.</p>",
  "status": "published",
  "featuredImage": null,
  "createdAt": "2026-11-21T09:00:00.000Z",
  "updatedAt": "2026-11-21T09:00:00.000Z",
  "publishedAt": "2026-11-21T09:00:00.000Z",
  "publishAt": "2026-11-21T09:00:00.000Z",
  "trashedAt": null
}
```

Pages do not accept post-only fields such as `labels`, `excerpt`, `author` or
`allowComments`.

## Validation rules

- `type` must be `post` in `postsDir` and `page` in `pagesDir`.
- `status` must be `draft`, `published` or `scheduled`.
- `scheduled` items require a non-null `publishAt`.
- Dates must be ISO 8601 UTC timestamps ending in `Z`.
- `slug` must be lowercase alphanumeric with single hyphens, at most 80
  characters.
- `featuredImage` must be a URL string or `null`.
- Unknown fields are rejected.

Invalid JSON or schema errors prevent content from loading. Watch mode reports
them as `BLOGGER_CONTENT_LOAD_FAILED` warnings.

## settings.json

```json
{
  "title": "My Blog",
  "description": "A Guchho Blogger site",
  "baseUrl": "https://example.com/",
  "favicon": "https://guchho.js.org/favicon.ico",
  "author": "admin",
  "postsPerPage": 10
}
```

All keys are optional. Missing values fall back to the defaults shown in
[Content model](../concepts/content-model.md).

## categories.json

Either form is accepted:

```json
["News", "Tutorials"]
```

```json
{ "categories": ["News", "Tutorials"] }
```

## authors.json

Either form is accepted:

```json
[
  {
    "name": "admin",
    "profileUrl": "https://example.com/p/about.html",
    "aboutMe": "Site administrator",
    "avatar": "https://example.com/avatar.png"
  }
]
```

```json
{
  "authors": [
    {
      "name": "admin",
      "profileUrl": "https://example.com/p/about.html"
    }
  ]
}
```

Only `name` is required for an author. Unknown author fields are ignored.

## Backups

Before an existing file is replaced, a copy is written to `backupDir` as:

```text
<id>.json.bak-<timestamp>
```

Deleted files are written as:

```text
<id>.json.deleted-<timestamp>
```

Continue with the [Content API](content-api.md).
