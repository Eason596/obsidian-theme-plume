# Theme Plume

> **English** | [中文](./README.zh-CN.md)

Render [VuePress Theme Plume](https://github.com/pengzhanbo/vuepress-theme-plume) Markdown container syntax (`::: file-tree`, `::: tabs`, `::: steps`, and more) in Obsidian **Reading view**.

| | |
|---|---|
| Plugin ID | `theme-plume` |
| Version | 1.2.0 (see `manifest.json`) |
| Min Obsidian | 1.5.0 |
| License | [MIT](./LICENSE) (upstream acknowledgements: [NOTICE](./NOTICE)) |

## Project origin

This repository ports [vuepress-theme-plume](https://github.com/pengzhanbo/vuepress-theme-plume) Markdown enhancements **into Obsidian** as a standalone plugin. It is **not** the upstream official project. Parsing, rendering, and styling were developed with substantial **AI-assisted tooling** (e.g. Cursor).

- Covers Plume **Markdown containers and Reading-view rendering** only — not the VuePress site theme, nav, blog, search, etc.
- Upstream theme is MIT; this repo is also MIT and retains upstream copyright notices — see [NOTICE](./NOTICE).

## Features

- `:::` custom containers: file tree, code tree, tabs, steps, prompts, cards, tables, timelines, and more (see table below).
- Embeds: `@[code-tree]`, `@[qrcode]`, `@[pdf]`, `@[bilibili]`, `@[youtube]`.
- Container body Markdown is rendered by **Obsidian’s built-in engine** (no bundled markdown-it).
- Fence info `title="..."` shows a Plume-style title bar (`src/pipeline/code-fence-titles.ts`).
- Plume fence features (line highlight / focus / diff / line numbers) use **Shiki** (`vitesse-light` / `vitesse-dark`).
- Inline `<Badge type="tip" text="…">` badges (VuePress-aligned).
- Note frontmatter: `link-icons` / `link-icon-size` add site favicons before external links.
- Soft refresh of Plume blocks while editing (including Live Preview leading sections); command palette can force a full preview rebuild.
- File-tree / code-tree support `colored` / `simple` icon modes (`simple` skips offline Iconify SVGs).

**Component examples**: [`examples/plume-components.md`](./examples/plume-components.md) ([中文](./examples/plume-components.md) · [English](./examples/plume-components.en.md)) — open in Reading view to verify each container.

**Online preview (GitHub Pages)**: <https://eason596.github.io/obsidian-theme-plume/> — built from the Chinese example via `npm run build:demo` (see [Publish preview site](#publish-preview-site-github-pages)).

## Install

### Community plugins (recommended)

1. In Obsidian: **Settings → Community plugins → Browse**, search **Theme Plume**.
2. Install and enable.

If it is not listed yet, use manual install below or [BRAT](https://github.com/TfTHacker/obsidian42-brat) from GitHub.

**Submit to the community catalog** (maintainers): sign in at [community.obsidian.md](https://community.obsidian.md) → **Plugins → New plugin** → `https://github.com/Eason596/obsidian-theme-plume`. Before the first submission, publish a [GitHub Release](https://github.com/Eason596/obsidian-theme-plume/releases) whose `version` matches `manifest.json` (assets: `main.js`, `manifest.json`, `styles.css`).

### Manual install (dev build)

```bash
git clone https://github.com/Eason596/obsidian-theme-plume.git
cd obsidian-theme-plume
npm install
npm run build
```

Copy into the vault plugin folder:

```text
<vault>/.obsidian/plugins/theme-plume/
  manifest.json
  main.js
  styles.css
```

`main.js` is produced by `npm run build` and is not committed.

Enable **Theme Plume** under **Settings → Community plugins**.

> **Upgrade note**: Plugin ID is `theme-plume`. If you previously installed `obsidian-plume` or `vuepress-file-tree`, remove the old plugin folder first to avoid double-loading.

## Network usage

Most features work **offline by default**. The following touch the network only when used (no server telemetry, no accounts):

| Feature | Remote service | When |
|------|----------|----------|
| `::: repo-card` | GitHub / Gitee REST API | Rendering a repo-card with a repository URL |
| File-tree / code-tree `colored` icons | [Iconify API](https://api.iconify.design) | Iconify IDs not covered by the offline pack |
| Card `icon=` remote images | User-specified image URL | Cards with http(s) icons |
| `link-icons: true` | Google Favicon service | Note enables external-link favicons |
| `@[bilibili]` / `@[youtube]` | Official embed iframes | Rendering those embeds |
| `@[pdf](https://…)` | User-specified PDF URL | Remote PDF (vault paths need no extra network) |

Set **Default file-tree icon mode** to `simple` and avoid `repo-card` / remote embeds / `link-icons` for a fully offline core-container workflow.

## Supported syntax

Largely aligned with [Plume docs](https://theme-plume.vuejs.press/); the table matches block types implemented in `src/parser.ts` / `src/render.ts`.

| Category | Syntax | Notes |
|------|------|------|
| File tree | `::: file-tree` | Also fenced `` ```file-tree `` / `filetree` / `file_tree` / `tree`, and `├──` CLI output |
| Code tree | `::: code-tree` | Single file or virtual tree + highlighting |
| Directory embed | `@[code-tree](path)` | Reads text files from the vault; paths support `/`, `./`, `../`, `@source/` |
| Tabs | `::: tabs` / `::: code-tabs` | Panels split by `@tab` / `@tab:active`; `::: tabs#id` or `id="..."`; VuePress-like chrome |
| Package managers | `::: npm-to` | One npm/npx fence → multi-manager `code-tabs`; `tabs="npm,pnpm,yarn,bun,deno"` |
| Steps | `::: steps` or `:::: steps` | Body is a `1.` / `2.` ordered list; custom `<ol>` in Obsidian so nested `:::` stays intact |
| Prompts | `::: note` / `info` / `tip` / `warning` / `caution` / `danger` / `important` / `details` | `danger` ≈ `caution`; `details` supports `{open}`; also GitHub Alerts `> [!NOTE]` |
| Cards | `::: card` / `card-grid` / `card-masonry` | `icon=` Lucide, image URL, or Iconify (incl. `twemoji:`); masonry `cols="{sm,md,lg}"` |
| Collapse | `::: collapse` | List items as panels; `:+` open / `:-` closed; `accordion`, `expand` |
| Link cards | `::: repo-card` / `link-card` / `image-card` | `repo-card` calls GitHub / Gitee APIs (network) |
| Table | `::: table` | `title` / `align` / `copy` / `max-content` / `full-width` / `hl-rows`/`hl-cols`/`hl-cells` |
| QR code | `@[qrcode](text)` / `::: qrcode` | Local generation; `card`, `title`, `align`, `logo`, … |
| Media | `@[pdf]` / `@[bilibili]` / `@[youtube]` | iframe; PDF vault path or URL; videos default 16:9 |
| Layout | `::: field` / `field-group` / `flex` / `left`/`center`/`right`/`justify` / `window` / `chat` | `field` matches VuePress: positional name + `@type`/`@default`/`@required` |
| Timeline | `::: timeline` | `horizontal`, `card`, `placement`, `line`, … |
| Inline badge | `<Badge type="tip" text="…">` | Same as VuePress |
| Link icons | frontmatter `link-icons` / `link-icon-size` | Prefixed favicons for http(s) links on the note |
| Code title / meta | `` ```ts title="app.ts" `` / `{1,3}` / `:line-numbers` / `[!code …]` | Title bar + highlight / focus / diff / line numbers / collapse |

Nested containers (e.g. Card → Collapse → code-tabs) are parsed recursively on the first section render.

Full runnable examples: **[examples/plume-components.md](./examples/plume-components.md)** · **[examples/plume-components.en.md](./examples/plume-components.en.md)**.

### Snippet preview

````markdown
::: tabs#demo
@tab Install
```bash
npm install
```

@tab:active Config
::: tip
Switch to Reading view after save to preview.
:::
:::

::: npm-to
```sh
npm i -D theme-plume
```
:::

@[qrcode](https://obsidian.md)

@[code-tree](./src)

```ts title="main.ts"
export default class ObsidianPlumePlugin extends Plugin {}
```
````

## Architecture (v1.0)

| Module | Role |
|------|------|
| `main.ts` | Plugin entry, settings, commands, parse cache, `@[code-tree]` directory scan |
| `src/parser.ts` | Pure parse of `:::` containers, collapse lists, `@[code-tree]` embeds |
| `src/render.ts` | Container DOM rendering via `registerBlockRenderer` |
| `src/render/pipeline.ts` | Placeholders + recursive `renderInnerMarkdown` |
| `src/render/blocks/collapse.ts` | Collapse panels (valid `<summary>`, lazy body) |
| `src/render/tabbed-container.ts` | Shared nav/panels for `tabs` / `code-tabs` |
| `src/render/tab-store.ts` | Tab persistence and cross-instance sync |
| `src/render/code-fence.ts` | Code fence title-bar DOM |
| `src/render/inline.ts` | Inline / phrase Markdown inside containers |
| `src/markdown/plume-markdown.ts` | `MarkdownRenderer` + `MarkdownRenderChild` lifecycle |
| `src/pipeline/preview-pipeline.ts` | Coordinates with Obsidian section post-processors |
| `src/pipeline/preview-sync.ts` | Unsaved buffer, dirty flags, scroll position |
| `src/pipeline/code-fence-titles.ts` | Incremental patch for fence `title` |
| `src/generated/*` | Offline Iconify / VuePress file-icon maps (`npm run generate:icons`) |

Principle: **do not reimplement markdown-it**. Top-level blocks become HTML placeholders, then components fill in and recurse into body Markdown.

## Settings

**Settings → Theme Plume**:

| Option | Default | Description |
|------|--------|------|
| Default file-tree icon mode | `colored` | Used when `::: file-tree` omits `icon=`; `simple` skips colored offline SVGs |
| Remember tab selection | on | Persist `::: tabs#id` / `::: code-tabs#id` selection in `localStorage` |
| Lazy collapse bodies | on | Do not render collapse body until first expand |
| Lazy tab panels | on | Render only the active tab; finish before the block is shown |
| Debug render errors | off | Show a short hint in preview when a block fails |

Editing uses **soft refresh** (redraw Plume blocks only, no full-page `rerender`) to reduce jumpiness. Use **Theme Plume: Force Refresh Current Preview** for a full rebuild when needed.

## Command palette

| Command | Action |
|------|------|
| Theme Plume: Force Refresh Current Preview | Force a full Reading-view rebuild for the current note |
| Theme Plume: Self Check | Show version, icon mode, preview window count, etc. |

## Development

```bash
npm install
npm run check          # TypeScript
npm test               # Vitest (src/parser.test.ts)
npm run test:legacy    # Legacy script tests
npm run dev            # Watch build + generate icons
npm run build          # Typecheck + icons + production main.js
npm run build:demo     # Write docs/index.html (GitHub Pages preview)
```

`build` / `dev` run `npm run generate:icons` (depends on `@iconify-json/*`).

### Tests

Some cases in `src/parser.test.ts` read `plume-complex-test.md` from the **parent directory** (workspace fixture). If a standalone clone fails `npm test` on a missing file, place that Markdown at `obsidian-theme-plume/../plume-complex-test.md`, or run only tests that do not need the fixture.

For manual checks, prefer [`examples/plume-components.md`](./examples/plume-components.md) / [`.en.md`](./examples/plume-components.en.md).

## Differences vs VuePress / Plume

| Capability | Theme Plume | VuePress Plume |
|------|----------------|----------------|
| Site theme, nav, blog, search | No | Yes |
| Markdown containers & common embeds | Yes (table above; enough for daily notes) | Broader (caniuse, REPL, encrypt, sandboxes, …) |
| Mermaid / ECharts | Not built-in | Supported; use other Obsidian plugins if needed |
| `::: table` / `::: npm-to` / `@[qrcode]` | Yes | Yes |
| `@[pdf]` / `@[bilibili]` / `@[youtube]` | Yes (iframe) | Yes |
| `repo-card` | Network fetch for metadata | Similar |
| `@[code-tree]` | Reads **current vault** text files; skips images, A/V, Office, PDF, … | Reads disk at build time |
| Reading-view sections | Cross-section blocks: first section renders and absorbs later ones (`plume-section-absorbed`) | N/A |
| `<Badge>` HTML | Yes | Yes |
| GitHub Alerts `> [!NOTE]` | Obsidian callout + Plume prompt colors | Converted to hint containers |
| Note `link-icons` frontmatter | Yes (Obsidian-specific) | No equivalent |
| Live Preview + deep nesting | Soft flush for leading sections; edge cases may still differ from pure VuePress | — |

## Publish preview site (GitHub Pages)

Pre-render `examples/plume-components.md` to a static page on GitHub Pages.

### Local build

```bash
npm install
npm run build:demo
```

On success the terminal prints `Wrote .../docs/index.html`. Open that file in a browser (`file://`).

If the process exits with `JavaScript heap out of memory`, `@[code-tree]` may embed a huge directory; the example uses `../src`, and the build skips large files such as `main.js` and `offlineIconData.ts`.

Output under `docs/`:

| File | Notes |
|------|------|
| `index.html` | Generated preview (**do not edit by hand**; rebuild after changing examples) |
| `styles.css` | Copied from the plugin root |
| `demo-base.css` | Layout + Obsidian-like CSS variables |
| `demo-client.js` | Static-page interactions (tabs, etc.) |

### Enable Pages on GitHub (first time)

1. Push to `main` (including `.github/workflows/pages.yml`).
2. Repo **Settings → Pages**.
3. **Build and deployment → Source** → **GitHub Actions** (not “Deploy from branch”).
4. Push to trigger the workflow, or run **Deploy GitHub Pages** under **Actions**.
5. After a few minutes: **https://eason596.github.io/obsidian-theme-plume/**

Later, pushes that change `examples/plume-components.md` or styles rebuild automatically; you can also commit `docs/index.html` after a local `npm run build:demo`.

> The preview site uses `marked` for ordinary Markdown; details may differ from Obsidian Reading view. Plume container styling is closer to Obsidian. Tabs, trees, collapse accordion, masonry, etc. are wired by `docs/demo-client.js` (static HTML has no listeners by itself).

## Release a new version

After maintainers push a semver tag, GitHub Actions builds and creates a Release (`main.js`, `manifest.json`, `styles.css`):

```bash
# 1. Bump version in manifest.json and package.json
# 2. Commit and push
git push origin main
# 3. Tag and push (tag must match manifest version)
git tag 1.0.1
git push origin 1.0.1
```

## Publish to GitHub

With [GitHub CLI](https://cli.github.com/) installed and logged in:

```cmd
scripts\publish-github.cmd
```

## License

| File | Notes |
|------|------|
| [LICENSE](./LICENSE) | This plugin: MIT, Copyright (c) 2026 JY |
| [NOTICE](./NOTICE) | Upstream vuepress-theme-plume (MIT, pengzhanbo) and third-party notes |

## Documentation languages

| Doc | English | 中文 |
|------|---------|------|
| README | [README.md](./README.md) | [README.zh-CN.md](./README.zh-CN.md) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) | [CHANGELOG.zh-CN.md](./CHANGELOG.zh-CN.md) |
| Component examples | [plume-components.en.md](./examples/plume-components.en.md) | [plume-components.md](./examples/plume-components.md) |
