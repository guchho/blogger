# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Native Blogger-style Layout Editor with gadget catalog, section and widget editing, drag reorder, and save-back to `template.xml`.
- LinkList editor with inline link rows, add/delete, move up/down, sorting, title, visibility, and maximum displayed items.
- File-based Post and Page CMS with draft/published states, scheduling, trash/restore, validation, backups, and local CRUD endpoints.
- Deterministic development previews, route-shaped preview files, and Blogger-style dashboard screens.
- Example project in [`example/`](example/) with a minimal Guchho configuration.

### Changed

- Simplified README with quick start, configuration, component, and example sections.
- Enforced LF line endings for reproducible golden snapshots on Windows.

## 0.1.0

- Initial release of `@guchho/blogger` with Blogger template compilation, XML assembly, validation, CSS/JS/asset bundling, and preview generation.
