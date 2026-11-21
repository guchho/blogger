# Dashboard and Layout Editor

The preview dashboard is a local Blogger-style admin area for testing a theme.
It is generated during watch builds and is not part of the production output.

## Open the dashboard

Start the dev server:

```bash
npx guchho dev
```

Then open:

```text
http://localhost:3000/__preview/dashboard/
```

A flat copy is also written to `dist/preview/dashboard.html`. Each preview page
has an **Open dashboard** button when the dashboard is enabled.

The dashboard uses root-relative links. Serve the output with `guchho dev` or
another static server; opening files with `file://` will not work correctly.

## Available screens

| Screen | Behavior |
| --- | --- |
| Dashboard | Overview of the local editor. |
| Posts | Live list of post JSON files with publish, schedule, trash and bulk actions. |
| Pages | Live list of page JSON files with the same actions. |
| New Post / New Page | Live editors that create content files through the save service. |
| Comments | Visual mock moderation screen. |
| Layout | Working Blogger-style Layout Editor. |
| Theme | Theme preview and base-style inspector. |
| Settings | Visual settings screen. |

When content is disabled, Posts and Pages remain deterministic visual mock
screens and do not write files.

## Content editors

The Posts and Pages screens read live content from the local save service.
Editing a item supports:

- title, slug, excerpt, labels, author and featured image,
- rich-text body HTML,
- draft, published and scheduled statuses,
- publish date and `publishAt`,
- trash and restore,
- stale-write detection.

The editor reloads the current hash before saves. If another process changed the
file, the API returns `BLOGGER_CONTENT_STALE` and the editor prompts for a
reload instead of overwriting the change.

## Layout Editor

The Layout screen is distinct from the Blog Preview. It reads sections, widgets
and CSS from the real `template.xml`, renders widgets into a Shadow DOM canvas
using the template's own styles, and supports:

- adding widgets,
- editing widget settings,
- removing widgets,
- reordering widgets within a section,
- moving widgets between sections.

Section limits and locked widgets are enforced. Changes are serialized back
into the pristine entry XML; unsupported elements, attributes and formatting are
preserved.

Each save:

1. verifies the source hash,
2. writes a timestamped `.layout-backup-*.xml` file,
3. validates the resulting XML,
4. atomically replaces the entry file.

A conflicting external edit returns `BLOGGER_LAYOUT_STALE`.

## Save service

The local service binds to `127.0.0.1` and accepts only localhost origins.

```js
blogger({
  layoutSavePort: 3001,
  previewDashboard: true,
});
```

- `layoutSavePort: 3001` uses a fixed port (the default).
- `layoutSavePort: 0` chooses an available ephemeral port.
- `previewDashboard: false` removes the dashboard button and admin screens.
- `previewDashboard: "/admin/"` keeps the screens but changes the button URL.

If the configured port already hosts a Guchho save service for the same project
and entry, it is reused. A foreign listener produces
`BLOGGER_LAYOUT_SAVE_UNAVAILABLE`.

The service is never started by production builds. Do not expose it publicly or
use it as a production CMS backend.

## Theme screen

The Theme screen includes a **Base style (template.xml)** panel. CSS from every
`<style>` and `<b:skin>` element is collected in document order, decoded and
HTML-escaped. Long stylesheets are capped at 12,000 characters, with a note
showing the total length.

See [Content CMS](content-cms.md) for file formats and
[Troubleshooting](../troubleshooting.md) if the dashboard or save service does
not load.
