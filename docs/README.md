# @guchho/blogger documentation

Documentation for the Guchho Blogger template compiler, local preview, Layout
Editor, and file-based Post/Page CMS.

The package has two main jobs:

1. Compile a modular Blogger project into a production-ready `template.xml`.
2. Render that template locally so theme and content changes can be reviewed
   before publishing to Blogger.

## Start here

- [Getting started](getting-started.md) — install the plugin and run a first
  build.
- [Plugin options](reference/plugin-options.md) — every configuration key and
  its default.
- [Content CMS guide](guides/content-cms.md) — create and publish posts and
  pages from JSON files.
- [Dashboard guide](guides/dashboard.md) — use the local admin screens and
  Layout Editor.
- [Troubleshooting](troubleshooting.md) — common errors and fixes.

## Documentation map

### Concepts

- [Architecture](concepts/architecture.md)
- [Content model](concepts/content-model.md)
- [Rendering and routes](concepts/rendering.md)

### Guides

- [Content CMS](guides/content-cms.md)
- [Dashboard and Layout Editor](guides/dashboard.md)

### Reference

- [Plugin options](reference/plugin-options.md)
- [Content files](reference/content-files.md)
- [Content API](reference/content-api.md)
- [Error codes](reference/errors.md)
- [Programmatic API](reference/programmatic-api.md)
- [Blogger compatibility](blogger-compatibility.md)

## Project links

- [Repository README](../README.md)
- [CodeHemu example submodule](../example/README.md)

## Scope

`@guchho/blogger` targets Blogger-compatible templates running through Guchho.
It does not call the Blogger API, run a production server, or execute Blogger
expressions during `guchho build`. Content is rendered to static HTML at build
time; the local save service is intended only for development.
