---
title: Content model
description: The JSON fields and conventions used by Blogger posts and pages.
---

# Content model

Posts and pages are stored as individual JSON files. Both share a common set of
fields; posts add Blogger-specific metadata.

## Common fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Letters, digits, `_` and `-` only. Used as the file name. |
| `type` | `"post"` or `"page"` | yes | Must match the directory and schema. |
| `title` | string | yes | May be empty for a draft. |
| `slug` | string | yes | Lowercase letters, digits and single hyphens; maximum 80 characters. |
| `content` | string | no | Rich-text HTML. Defaults to `""`. |
| `status` | `"draft"`, `"published"` or `"scheduled"` | yes | Editorial state. |
| `featuredImage` | string or `null` | no | Image URL; defaults to `null`. |
| `createdAt` | string | yes | ISO 8601 UTC timestamp. |
| `updatedAt` | string | yes | ISO 8601 UTC timestamp. |
| `publishedAt` | string or `null` | no | Set when transitioning to published. |
| `publishAt` | string or `null` | no | Required for scheduled items. |
| `trashedAt` | string or `null` | no | Non-null means soft-deleted. |

Unknown fields are rejected by the schema validator.

## Post fields

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `excerpt` | string | `""` | Falls back to generated plain text from `content`. |
| `labels` | string[] | `[]` | Rendered as Blogger labels and label archives. |
| `author` | string | `"admin"` | Resolved against `data/authors.json` when possible. |
| `allowComments` | boolean | `true` | Exposed as `data:post.allowComments`. |

## Page fields

Pages contain only the common fields. They do not have labels, excerpts,
authors or comment flags.

## Status and scheduling

`status` is the stored editorial state. The effective status also considers time
and trash state:

- `trashedAt !== null` → `trash`
- `status: "scheduled"` with `publishAt <= now` → `published`
- otherwise → the stored `status`

Scheduled items are not rewritten by a background timer. They become visible to
rendering automatically when the current time passes `publishAt`.

Publishing sets `publishedAt` to the current time. If `publishAt` is supplied,
it is retained for the canonical date-based route.

## Trash and deletion

- **Trash** sets `trashedAt`; the file remains and is excluded from public
  output.
- **Restore** sets `trashedAt` to `null`.
- **Delete** removes the file after copying it into the backup directory.

Bulk operations support `publish`, `unpublish`, `trash`, `restore` and `delete`.
Each ID succeeds or fails independently; failures are returned with their error
code and message.

## Slugs and uniqueness

Slugs are normalized to `lowercase-words-with-hyphens`. Reserved slugs such as
`api`, `search`, `preview`, `dashboard`, `p` and `index` are rejected with a
suggested alternative. If a slug is already used by another non-trashed item of
the same kind, the API returns `BLOGGER_CONTENT_SLUG_CONFLICT` with a suggested
suffix such as `hello-world-2`.

## Site settings

`data/settings.json` controls the rendered site identity:

| Field | Type | Default |
| --- | --- | --- |
| `title` | string | `Guchho Blog` |
| `description` | string | `A Guchho Blogger site` |
| `baseUrl` | string | `http://localhost:3000/` |
| `favicon` | string | `https://guchho.js.org/favicon.ico` |
| `author` | string | `admin` |
| `postsPerPage` | positive integer | `10` |

`data/categories.json` and `data/authors.json` add labels and author profiles.
See [Content files](../reference/content-files.md) for examples.

## Hashing and stale writes

Every create or update response includes a `hash`. Send that hash with the next
`PUT` request. If the file changed since it was read, the API returns
`BLOGGER_CONTENT_STALE` with the current hash; reload before saving.

Continue with [Rendering and routes](rendering.md).
