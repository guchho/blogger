---
title: Content API
description: Dev-only HTTP endpoints used by the dashboard to read and save content.
---

# Content API

The Content API is served by the dev-only save service on `127.0.0.1`. It is
available during watch builds when the dashboard is enabled and content is not
disabled.

The default port is `3001`; the effective port is the `layoutSavePort` plugin
option, or the selected ephemeral port when it is `0`.

## Conventions

- Request and response bodies are JSON.
- Requests larger than 4 MB return `BLOGGER_CONTENT_TOO_LARGE`.
- Only localhost origins are accepted; browser requests from other origins
  return `BLOGGER_LAYOUT_ORIGIN_FORBIDDEN`.
- `OPTIONS` requests are answered for CORS preflight.
- Errors use `{ "error": "CODE", "message": "...", ...details }`.
- IDs may contain only letters, digits, hyphens and underscores.

## Status and metadata

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/content/status` | Service state, project root, content hash and item counts. |
| `GET` | `/api/content/meta` | Site settings, all labels and current content hash. |

Example `status` response:

```json
{
  "service": "guchho-blogger-content",
  "project": "/path/to/project",
  "hash": "sha256-hex",
  "posts": 2,
  "pages": 1,
  "postsDir": "/path/to/project/src/posts",
  "pagesDir": "/path/to/project/src/pages"
}
```

## List and create

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/posts` | List posts. |
| `POST` | `/api/posts` | Create a post; returns `201`. |
| `GET` | `/api/pages` | List pages. |
| `POST` | `/api/pages` | Create a page; returns `201`. |

List query parameters:

| Parameter | Values | Description |
| --- | --- | --- |
| `status` | `all`, `draft`, `published`, `scheduled`, `trash` | Filter by effective status. |
| `q` | string | Case-insensitive search over title, slug and body; posts also search excerpt, author and labels. |
| `label` | string | Filter posts by label. |
| `sort` | `date-desc`, `date-asc`, `title-asc`, `title-desc` | Sort order. Default is `date-desc`. |
| `trashed` | `1` | Include trashed items. |

The response is `{ "items": [...], "total": number }`.

A create body is a partial content object. The server supplies generated IDs and
timestamps when omitted. Successful create, update and action responses include:

```json
{
  "item": {},
  "hash": "sha256-hex",
  "backup": null
}
```

`backup` is a file name when an existing file was backed up.

## Read, update and delete

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/posts/:id` | Read one post and its hash. |
| `PUT` | `/api/posts/:id` | Patch one post. |
| `DELETE` | `/api/posts/:id` | Delete one post after backup. |
| `GET` | `/api/pages/:id` | Read one page and its hash. |
| `PUT` | `/api/pages/:id` | Patch one page. |
| `DELETE` | `/api/pages/:id` | Delete one page after backup. |

A `GET /api/posts/:id` response is:

```json
{
  "item": {},
  "hash": "sha256-hex"
}
```

A `PUT` body is a partial object with an optional `hash`:

```json
{
  "hash": "sha256-hex",
  "title": "Updated title"
}
```

If `hash` is supplied and does not match the file, the request returns
`BLOGGER_CONTENT_STALE` with the current hash in the response. Updates cannot
change `id`, `type` or `createdAt`.

A `DELETE` response is `{ "backup": "<file name>" }`.

## Status actions

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/posts/:id/publish` | Publish a post. |
| `POST` | `/api/posts/:id/unpublish` | Return a post to draft. |
| `POST` | `/api/posts/:id/trash` | Soft-delete a post. |
| `POST` | `/api/posts/:id/restore` | Restore a trashed post. |
| `POST` | `/api/pages/:id/publish` | Publish a page. |
| `POST` | `/api/pages/:id/unpublish` | Return a page to draft. |
| `POST` | `/api/pages/:id/trash` | Soft-delete a page. |
| `POST` | `/api/pages/:id/restore` | Restore a trashed page. |

Action bodies are optional. `publish` accepts `publishAt`:

```json
{
  "publishAt": "2026-12-01T09:00:00.000Z"
}
```

Publishing sets `publishedAt` to the current time. Trashing sets `trashedAt`;
restoring clears it.

## Bulk actions

| Method | Route |
| --- | --- |
| `POST` | `/api/posts/bulk` |
| `POST` | `/api/pages/bulk` |

Body:

```json
{
  "ids": ["first-item", "second-item"],
  "action": "publish"
}
```

Supported actions are `publish`, `unpublish`, `trash`, `restore` and `delete`.

Response:

```json
{
  "succeeded": 1,
  "failed": [
    {
      "id": "second-item",
      "code": "BLOGGER_CONTENT_NOT_FOUND",
      "message": "post not found"
    }
  ]
}
```

Bulk actions are per-item: one failure does not roll back the others.

## Examples

```bash
curl http://localhost:3001/api/content/status

curl 'http://localhost:3001/api/posts?status=published&sort=date-desc'

curl -X POST http://localhost:3001/api/posts/hello-world/trash \
  -H 'content-type: application/json' \
  -d '{}'
```

See [Error codes](errors.md) for all failure codes.
