# Content CMS guide

The file-based CMS stores posts and pages as JSON in the consuming project. The
dashboard edits those files through a local save service, and production builds
render them into static HTML.

## Enable content

Content is enabled by default. Configure it when the default directories or
render behavior need to change:

```js
import blogger from "@guchho/blogger";

export default {
  plugins: [
    blogger({
      content: {
        postsDir: "content/posts",
        pagesDir: "content/pages",
        dataDir: "content/data",
        backupDir: ".content-backups",
        siteUrl: "https://example.com/",
        sanitize: true,
      },
    }),
  ],
};
```

All directories must stay inside the project root. `siteUrl` overrides
`baseUrl` from `data/settings.json`.

Set `content: false` for the legacy XML-only build.

## Create a post

Create `src/posts/hello-world.json`:

```json
{
  "id": "hello-world",
  "type": "post",
  "title": "Hello world",
  "slug": "hello-world",
  "content": "<p>My first post.</p>",
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

## Create a page

Create `src/pages/about.json`:

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

The dashboard can create these files automatically. Direct file edits are also
supported; watch mode reloads JSON files in the content and data directories.

## Site settings

`data/settings.json`:

```json
{
  "title": "My Blog",
  "description": "A Guchho Blogger site",
  "baseUrl": "https://example.com/",
  "favicon": "favicon.ico",
  "author": "admin",
  "postsPerPage": 10
}
```

`data/categories.json` may be an array or `{ "categories": [...] }`.
`data/authors.json` may be an array or `{ "authors": [...] }`.

## Publish and schedule

- **Publish now** sets `status` to `published` and `publishedAt` to the current
  time.
- **Unpublish** returns the item to `draft`.
- **Schedule** sets `status` to `scheduled` and requires `publishAt`.
- A scheduled item is treated as published when its `publishAt` time passes.
  No background process edits the JSON file.

A schedule request can include `publishAt`:

```bash
curl -X POST http://localhost:3001/api/posts/hello-world/publish \
  -H 'content-type: application/json' \
  -d '{"publishAt":"2026-12-01T09:00:00.000Z"}'
```

The actual port is reported by the local save service; `3001` is the default.

## Edit safely from scripts

Read an item, keep its `hash`, and send the hash with updates:

```bash
curl http://localhost:3001/api/posts/hello-world

curl -X PUT http://localhost:3001/api/posts/hello-world \
  -H 'content-type: application/json' \
  -d '{"hash":"<hash from GET>","title":"Updated title"}'
```

A mismatched hash returns `BLOGGER_CONTENT_STALE` with the current hash. Reload
and retry with fresh data.

## Trash, restore and delete

- Trash is a soft delete: `trashedAt` is set and the item leaves public output.
- Restore clears `trashedAt`.
- Delete removes the JSON file and stores a timestamped backup under
  `backupDir`.

Bulk operations are available at `/api/posts/bulk` and `/api/pages/bulk`:

```json
{
  "ids": ["hello-world", "second-post"],
  "action": "trash"
}
```

See [Content API](../reference/content-api.md) for every endpoint and
[Error codes](../reference/errors.md) for failure responses.
