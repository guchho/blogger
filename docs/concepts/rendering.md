---
title: Rendering and routes
description: How local content becomes Blogger-style view data and static routes.
---

# Rendering and routes

Content is rendered through the same Blogger-compatible renderer used by the
development preview. Production builds use the real template, but the data comes
from local JSON files rather than the Blogger API.

## View data

Posts and pages are converted into Blogger-style value maps before rendering.

A post exposes values including:

- `title`, `body`, `content`, `snippet`, `excerpt` and `description`,
- `url`, `canonical`, `link` and `shareUrl`,
- `date`, `timestamp` and `lastUpdated`,
- `author` and `authorProfileUrl`,
- `labels`, `featuredImage` and `thumbnailUrl`,
- `allowComments`, `numberOfComments` and `commentsUrl`.

A page exposes the common post fields without labels or comments.

Rich-text `content` is sanitized by default. Set `content.sanitize: false` to
disable sanitization; this should only be done for trusted source files.

## Worked example

Given `src/posts/hello-world.json`:

```json
{
  "id": "hello-world",
  "type": "post",
  "title": "Hello world",
  "slug": "hello-world",
  "content": "<p>My first post.</p>",
  "excerpt": "A short introduction.",
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

the post scenario sets `data:view.isPost` to `true` and exposes the item through
`data:post`:

```xml
<b:if cond='data:view.isPost'>
  <h1><data:post.title/></h1>
  <p><data:post.date/> by <data:post.author.name/></p>
  <div><data:post.body/></div>
  <a expr:href='data:post.labels.first.url'>
    <data:post.labels.first.name/>
  </a>
</b:if>
```

`data:post.date` renders as `November 21, 2026`, and the scenario is written to
`dist/2026/11/hello-world.html`. On home, label and archive views the same post
appears inside `data:posts` instead. For the complete field list, see
[Data fields](../reference/data-fields.md).

## Generated scenarios

When content exists, the renderer builds scenarios for:

- home (`/`),
- each published post,
- each published page,
- each label,
- each month with published posts,
- search (`/search/`),
- not found (`/404.html`),
- the widget showcase in previews when widgets are included.

Only published items are included. Scheduled items become visible when
`publishAt` has passed, and trashed items are always excluded.

## Public routes

| Content | Route pattern | Example |
| --- | --- | --- |
| Post | `/YYYY/MM/<slug>.html` | `/2026/11/hello-world.html` |
| Page | `/p/<slug>.html` | `/p/about.html` |
| Label | `/search/label/<encoded-label>/` | `/search/label/Templates/` |
| Archive | `/YYYY/MM/` | `/2026/11/` |
| Search | `/search/` | `/search/` |

Post dates come from `publishAt`, then `publishedAt`, then `createdAt`.

The `siteUrl` plugin option overrides `settings.json` `baseUrl` for generated
links. The base URL must be absolute.

Reserved routes are rejected: `/`, `/search/`, `/search`, `/dashboard/`,
`/preview/`, `/__preview/`, `/404.html`, `/favicon.ico` and `/template.xml`.
Two items cannot generate the same route; collisions are reported with
`BLOGGER_CONTENT_ROUTE_CONFLICT`.

## Static output limitations

Static files cannot represent query strings. Search previews use `/search/`
instead of `/search?q=term`, even though the rendered search page may reference
a query.

Route-shaped files are emitted so a plain static server can serve links from
the template:

```text
dist/index.html
dist/2026/11/hello-world.html
dist/p/about.html
dist/search/label/Templates/index.html
dist/2026/11/index.html
dist/search/index.html
```

## Preview versus production

| Aspect | `guchho dev` | `guchho build` |
| --- | --- | --- |
| Data | Content files or built-in mock data | Content files only |
| Banner | Added by default | Never |
| Dashboard | Generated when enabled | Never |
| Save service | Started locally when enabled | Never |
| Content pages | Preview output | Production HTML output |

See [Blogger compatibility](../blogger-compatibility.md) for the expression
language and widget behavior used by the renderer.
