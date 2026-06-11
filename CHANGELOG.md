# Changelog

## 1.0.3

### Fixed

- Renamed the settings heading so it no longer repeats the plugin name.

## 1.0.2

### Fixed

- Addressed Obsidian community plugin review findings for manifest text, settings headings, DOM safety, inline style usage, iOS-compatible icon parsing, and popout timer compatibility.
- Kept committed VuePress file-icon rules during CI release builds when upstream source definitions are unavailable.

### Changed

- Added GitHub release artifact attestations for published plugin assets.

## 0.2.0 (unreleased)

### Fixed

- Collapse panels: valid `<summary>` markup (`span` title, phrasing-only inline MD).
- Nested Card → Collapse → code blocks / code-tabs rendering (detached DOM + body mount).
- Flex container: correct `BlockRenderContext` when rendering segment markdown.
- Code-tabs keyboard navigation (`role="tab"`).
- Markdown render token races when building nested containers in parallel.

### Changed

- Tabs and code-tabs share `render/tabbed-container.ts`; legacy `renderTabsInto` removed.
- Collapse rendering moved to `render/blocks/collapse.ts`; list parsing in `parser.ts`.
- Render pipeline split: `render/pipeline.ts`, `render/block-registry.ts`, `render/context.ts`.
- Per-note parse cache keyed by `sourcePath` (avoids stale blocks when switching files).
- Settings UI: tab persistence, lazy collapse bodies, debug render errors.
- Colored offline icons load SVG map on first use (`simple` mode skips).
- `npm test` uses Vitest (`src/parser.test.ts`); `npm run test:legacy` keeps the old script.

### Added

- `src/render/index.ts` barrel for pipeline helpers.
- Manual regression checklist in `plume-complex-test.md` §七.
