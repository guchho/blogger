# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Changed

- Preview layout CSS assets now comment out `background-color` and remove complete rules using `:active`, `:hover`, `:focus`, `:focus-visible`, or `:target`.

## 0.1.0

### Added

- Native Blogger-style Layout Editor with gadget catalog, section and widget editing, drag reorder, and save-back to `template.xml`.
- LinkList editor with inline link rows, add/delete, move up/down, sorting, title, visibility, and maximum displayed items.
- File-based Post and Page CMS with draft/published states, scheduling, trash/restore, validation, backups, and local CRUD endpoints.
- Deterministic development previews, route-shaped preview files, and Blogger-style dashboard screens.
- CodeHemu Blogger theme source as the [`example/`](example/) Git submodule.

### Changed

- Simplified README with quick start, configuration, component, and example sections.
- Tests use a local fixture instead of the example project.
- Enforced LF line endings for reproducible golden snapshots on Windows.

- Initial release of `@guchho/blogger` with Blogger template compilation, XML assembly, validation, CSS/JS/asset bundling, and preview generation.
