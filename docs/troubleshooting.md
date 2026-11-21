# Troubleshooting

Solutions for common setup, preview, content and save-service problems.

## Preview does not open from the file system

The dashboard uses root-relative URLs such as `/__preview/dashboard/`. Open the
preview through `guchho dev` or another static server, not `file://`.

## Content changes do not appear

1. Confirm at least one JSON file exists in `src/posts` or `src/pages`. With no
   content files, preview uses deterministic mock data.
2. Check that `content` is not `false` in the plugin configuration.
3. Check that custom content paths are inside the project root.
4. Look for `BLOGGER_CONTENT_LOAD_FAILED` warnings caused by invalid JSON.
5. Draft, future-scheduled and trashed items are excluded from public output.

## `BLOGGER_CONTENT_STALE`

Another process changed the file after it was read. Reload the item, use the
current `hash`, and retry the update. The dashboard prompts to reload when this
happens.

## `BLOGGER_CONTENT_SLUG_CONFLICT`

The response includes a `suggested` slug. Use it or choose another unique slug.
Slugs are unique among non-trashed items of the same kind.

## `BLOGGER_CONTENT_ROUTE_CONFLICT` or `BLOGGER_CONTENT_ROUTE_RESERVED`

Two published items generated the same route, or an item used a route owned by
the preview system. Change the slug or publication date. Post routes include the
year and month, so two posts with the same slug in different months do not
conflict.

## `BLOGGER_CONTENT_PATH_FORBIDDEN`

Content directories and files must resolve inside the project root. Remove
absolute paths, `..` segments or symlinks that escape the project.

## `BLOGGER_LAYOUT_SAVE_UNAVAILABLE`

The configured `layoutSavePort` is occupied by a foreign listener.

- Choose another port, or
- set `layoutSavePort: 0` to use an available ephemeral port.

If another Guchho save service for the same project and entry owns the port, it
is reused automatically.

## `BLOGGER_LAYOUT_ORIGIN_FORBIDDEN`

The save service only accepts `http://localhost`, `http://127.0.0.1` and
`http://[::1]` origins. Serve the preview from localhost and do not proxy the
save service through another host.

## `BLOGGER_LAYOUT_STALE`

The template file changed outside the Layout Editor. Reload the dashboard before
saving. Each successful layout save creates a timestamped backup next to the
entry file.

## Invalid content schema

Common causes:

- missing `id`, `type`, `title`, `slug`, `status`, `createdAt` or `updatedAt`,
- uppercase letters or consecutive hyphens in `slug`,
- a timestamp without the UTC `Z` suffix,
- `scheduled` status without `publishAt`,
- a post field used in a page file,
- unknown fields.

See [Content files](reference/content-files.md) for complete examples.

## Unsupported preview expressions

Preview diagnostics include `BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION`,
`BLOGGER_PREVIEW_UNSUPPORTED_HELPER`,
`BLOGGER_PREVIEW_UNSUPPORTED_ELEMENT`,
`BLOGGER_PREVIEW_UNKNOWN_INCLUDABLE` and
`BLOGGER_PREVIEW_UNKNOWN_WIDGET`.

These affect local rendering and generated content pages. Production template
assembly preserves unknown Blogger expressions; Blogger remains responsible for
evaluating them after upload. See
[Blogger compatibility](blogger-compatibility.md).

## Search routes

Static output cannot represent `?q=term`. The generated search page uses
`/search/`. Label archives use `/search/label/<label>/` and are fully
representable as static routes.

## Dashboard is missing

Check `previewDashboard`:

- `false` removes the button and all dashboard screens.
- A string changes the button URL but keeps the screens.
- The dashboard is generated only during watch builds.

Also confirm `preview` is not `false`; preview generation supplies the banner
and generated admin pages.

## Need more help

Review:

- [Error codes](reference/errors.md)
- [Plugin options](reference/plugin-options.md)
- [Content API](reference/content-api.md)
- [Repository README](../README.md)
