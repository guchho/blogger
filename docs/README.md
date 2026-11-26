---
title: '@guchho/blogger'
description: Template compiler, local preview, Layout Editor, and file-based CMS for Blogger themes.
---

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
- [Example content](#example-content) — posts and pages included with the example project.

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

## Example content

The `example/` project includes published posts and pages that exercise dated
post routes, short page routes, labels, excerpts, and Blogger data tags.

### Posts

- [Designing with Blogger data tags](https://github.com/guchho/blogger/blob/main/example/src/posts/designing-with-blogger-data-tags.json) — use `data:` expressions and `b:loop` blocks in a template.
- [Building a faster preview workflow](https://github.com/guchho/blogger/blob/main/example/src/posts/building-a-faster-preview-workflow.json) — keep the feedback loop short while editing widgets and layouts.
- [A practical guide to content models](https://github.com/guchho/blogger/blob/main/example/src/posts/a-practical-guide-to-content-models.json) — understand posts, pages, slugs, status, and scheduled publishing.
- [Custom widgets without custom code](https://github.com/guchho/blogger/blob/main/example/src/posts/custom-widgets-without-custom-code.json) — extend a template with built-in widgets and includables.
- [Why static previews matter](https://github.com/guchho/blogger/blob/main/example/src/posts/why-static-previews-matter.json) — review deterministic output, real routes, and collaboration artifacts.
- [Writing with the rich editor](https://github.com/guchho/blogger/blob/main/example/src/posts/writing-with-the-rich-editor.json) — see how dashboard formatting becomes sanitized HTML.

### Pages

- [About](https://github.com/guchho/blogger/blob/main/example/src/pages/about.json) — introduction to the example project and its local content.
- [Contact](https://github.com/guchho/blogger/blob/main/example/src/pages/contact.json) — starter copy for a project contact page.
- [Privacy policy](https://github.com/guchho/blogger/blob/main/example/src/pages/privacy-policy.json) — notes on content files, browser storage, and external links.
- [Resources](https://github.com/guchho/blogger/blob/main/example/src/pages/resources.json) — reading list for template structure, content workflow, and design checks.

## Project links

- [Repository README](https://github.com/guchho/blogger/blob/main/README.md)
- [CodeHemu example submodule](https://github.com/guchho/blogger/blob/main/example/README.md)

## Scope

`@guchho/blogger` targets Blogger-compatible templates running through Guchho.
It does not call the Blogger API, run a production server, or execute Blogger
expressions during `guchho build`. Content is rendered to static HTML at build
time; the local save service is intended only for development.
