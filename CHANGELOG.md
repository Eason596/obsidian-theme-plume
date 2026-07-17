# Changelog

> **English** | [中文](./CHANGELOG.zh-CN.md)

## Unreleased

## 1.2.0

### Changed

- Code highlighting now uses **Shiki** (default `vitesse-light` / `vitesse-dark`, same as VuePress Theme Plume), replacing highlight.js.
- Settings: choose separate Shiki themes for Obsidian light and dark appearance.

### Fixed

- First vault open could leave raw `::: code-tree` until switching notes; register processors earlier, retry section info, and re-render only when needed.
- Code-tree panel highlighting could stick with wrong colors until clicking another file (async Shiki race).
- Obsidian light/dark toggle now recolors Shiki tokens.
- `[!code word:…]` no longer corrupts inline `style` attributes.
- Prompt containers no longer force-collapse code whitespace.

## 1.1.1

### Fixed

- Plain code fences no longer collapse into one line in Reading view (skip highlight.js rewrite unless Plume fence meta is present).

## 1.1.0

### Added

- `::: table` — title / align / copy (HTML·Markdown) / max-content / full-width / hl-rows·cols·cells.
- `::: npm-to` — expand a single npm/npx fence into package-manager `code-tabs` (`tabs=`).
- `@[qrcode]` / `::: qrcode` — local QR generation (`card`, `title`, `align`, `logo`, …).
- `@[pdf]` / `@[bilibili]` / `@[youtube]` — iframe embeds (vault or remote PDF; official video players).
- Frontmatter `link-icons` / `link-icon-size` — auto favicons before external links.
- Tabs / code-tabs visual parity with VuePress (spacing, active bar, package-manager logos).
- Bilingual docs: `README.zh-CN.md`, `CHANGELOG.zh-CN.md`, `examples/plume-components.en.md`.

### Fixed

- Align containers: parse `::: left` and `::: justify` (previously only `center` / `right`).
- Field containers: VuePress positional name + `@type` / `@default` / `@required` body tags.
- Prompt containers: `::: danger`, `::: important` styles, `::: details … {open}`, GitHub Alerts Plume styling.
- Badges: VuePress `<Badge>` only (removed non-upstream `` `badge:` `` shorthand).
- Collapse examples: correct `:+` / `:-` documentation.
- Soft flush also refreshes Live Preview leading sections; code-tabs height / inactive panel hide.
- Link-card description host uses `div` (safer nesting); masonry cells drop extra link-card margin.

### Also

- Code fence meta: `{1,3-5}` highlights, `[!code …]` notations, `:line-numbers`, `:collapsed-lines`.
- File-tree CLI format (`├──` / `` ```tree `` / `` ```file-tree ``).
- Card icons: Iconify `collection:name` including `twemoji:` (online/offline Iconify).
- Card-masonry responsive `cols="{sm,md,lg}"`.
- Window chrome: reload / share / add / copy decorative icons (VuePress parity).

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
