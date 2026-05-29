# Obsidian Plume

在 Obsidian **阅读视图**中渲染 [VuePress Theme Plume](https://github.com/pengzhanbo/vuepress-theme-plume) 的 Markdown 容器语法（`::: file-tree`、`::: tabs`、`::: steps` 等）。

| | |
|---|---|
| 插件 ID | `obsidian-plume` |
| 版本 | 0.2.0（见 `manifest.json`） |
| 最低 Obsidian | 1.5.0 |
| 协议 | [MIT](./LICENSE)（上游致谢见 [NOTICE](./NOTICE)） |

## 项目来源

本仓库是将 [vuepress-theme-plume](https://github.com/pengzhanbo/vuepress-theme-plume) 的 Markdown 增强能力**迁移到 Obsidian** 的独立插件，**并非**上游官方仓库。解析、渲染与样式对齐过程中大量使用了 **AI 辅助开发工具**（如 Cursor）。

- 仅覆盖 Plume 的 **Markdown 容器与阅读视图渲染**，不包含 VuePress 站点主题、导航、博客、搜索等。
- 上游主题为 MIT；本仓库同样 MIT，并保留上游版权声明，详见 [NOTICE](./NOTICE)。

## 功能概览

- `:::` 自定义容器：文件树、代码树、选项卡、步骤、提示框、卡片、时间线等（见下表）。
- 容器内正文交给 **Obsidian 自带 Markdown 引擎**渲染，不内置 markdown-it。
- 代码块信息串中的 `title="..."` 会显示为 Plume 风格标题栏（`src/pipeline/code-fence-titles.ts`）。
- 行内 `` `badge:tip:文本` `` 徽章（不支持 HTML `<Badge>`，阅读视图会剥离未知标签）。
- 编辑时 **软刷新** Plume 块；命令面板可强制整页重建预览。
- 文件树 / 代码树支持 `colored` / `simple` 图标模式（`simple` 不加载离线 Iconify SVG）。

**组件示例稿**：[`examples/plume-components.md`](./examples/plume-components.md) — 每种容器的初版写法，可在 Obsidian 阅读视图中打开对照。

**在线预览（GitHub Pages）**：<https://eason596.github.io/obsidian-theme-plume/> — 由 `npm run build:demo` 将示例稿渲染为静态 HTML（见下方 [发布预览站](#发布预览站-github-pages)）。

## 安装

### 手动安装（开发构建）

```bash
git clone https://github.com/Eason596/obsidian-theme-plume.git
cd obsidian-theme-plume
npm install
npm run build
```

将**整个目录**复制到库内：

```text
<vault>/.obsidian/plugins/obsidian-plume/
```

目录内需包含至少：`manifest.json`、`main.js`、`styles.css`（`main.js` 由 `npm run build` 生成，未提交到 Git）。

在 **设置 → 社区插件** 中启用 **Obsidian Plume**。

> **升级提示**：插件 ID 为 `obsidian-plume`（旧 ID `vuepress-file-tree` 已废弃）。请删除旧插件目录，避免重复加载。

## 支持的语法

与 [Plume 文档](https://theme-plume.vuejs.press/) 大体一致；下表对应当前 `src/parser.ts` / `src/render.ts` 已实现的块类型。

| 类别 | 语法 | 说明 |
|------|------|------|
| 文件树 | `::: file-tree` | 也支持 Obsidian 围栏代码块 ` ```file-tree` / `filetree` / `file_tree` |
| 代码树 | `::: code-tree` | 单文件或虚拟目录树 + 代码高亮 |
| 目录嵌入 | `@[code-tree](path)` | 从库内目录读取文本文件生成代码树；路径支持 `/`、`./`、`../`、`@source/` |
| 选项卡 | `::: tabs` / `::: code-tabs` | 面板以 `@tab` / `@tab:active` 分隔；可用 `::: tabs#id` 或 `id="..."` |
| 步骤 | `::: steps` 或 `:::: steps` | 正文为 `1.` / `2.` 编号列表；Obsidian 内用自定义 `<ol>` 渲染，避免列表内 `:::` 被破坏 |
| 提示 | `::: note` / `info` / `tip` / `warning` / `caution` / `details` | 可选自定义标题 |
| 卡片 | `::: card` / `card-grid` / `card-masonry` | `icon=` 为 Obsidian Lucide 名或图片 URL；不支持 `twemoji:` |
| 折叠 | `::: collapse` | 列表项为面板；支持 `accordion`、`expand` |
| 外链卡片 | `::: repo-card` / `link-card` / `image-card` | `repo-card` 会请求 GitHub / Gitee API（需网络） |
| 布局 | `::: field` / `field-group` / `flex` / `window` / `chat` | |
| 时间线 | `::: timeline` | 支持 `horizontal`、`card`、`placement`、`line` 等属性 |
| 行内徽章 | `` `badge:tip:文本` `` | 类型与文本用 `:` 或 `|` 分隔 |
| 代码标题 | ` ```ts title="app.ts"` | 在围栏 info 中写 `title="..."` |

嵌套容器（如 Card → Collapse → code-tabs）在首段渲染时会递归解析内层块。

完整可运行示例见 **[examples/plume-components.md](./examples/plume-components.md)**（每种组件一节，便于在库内打开验收）。

### 片段预览

````markdown
::: tabs#demo
@tab 安装
```bash
npm install
```

@tab:active 配置
::: tip
保存后切换阅读视图即可预览。
:::
:::

@[code-tree](./src)

```ts title="main.ts"
export default class ObsidianPlumePlugin extends Plugin {}
```
````

## 架构（v0.2）

| 模块 | 职责 |
|------|------|
| `main.ts` | 插件入口、设置页、命令、解析缓存、`@[code-tree]` 目录扫描 |
| `src/parser.ts` | 纯函数解析 `:::` 容器、collapse 列表、`@[code-tree]` 嵌入 |
| `src/render.ts` | 各容器 DOM 渲染；经 `registerBlockRenderer` 分发 |
| `src/render/pipeline.ts` | 占位符 + 递归 `renderInnerMarkdown` |
| `src/render/blocks/collapse.ts` | Collapse 面板（合法 `<summary>`、懒加载正文） |
| `src/render/tabbed-container.ts` | `tabs` / `code-tabs` 共用导航与面板 |
| `src/render/tab-store.ts` | Tab 持久化与跨实例同步 |
| `src/render/code-fence.ts` | 代码块标题栏 DOM |
| `src/render/inline.ts` | 容器内行内 / 短语级 Markdown |
| `src/markdown/plume-markdown.ts` | `MarkdownRenderer` + `MarkdownRenderChild` 生命周期 |
| `src/pipeline/preview-pipeline.ts` | 与 Obsidian 分段后处理器协调（首段渲染、吸收内部段） |
| `src/pipeline/preview-sync.ts` | 未保存缓冲区、脏标记、滚动位置 |
| `src/pipeline/code-fence-titles.ts` | 代码块 `title` 签名增量修补 |
| `src/generated/*` | 离线 Iconify / VuePress 文件图标映射（`npm run generate:icons`） |

核心原则：**不重复实现 markdown-it**；顶层块在渲染前替换为 HTML 占位符，再填充组件并递归渲染内文。

## 设置

**设置 → Obsidian Plume**：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| Default file-tree icon mode | `colored` | `::: file-tree` 未指定 `icon=` 时使用；`simple` 不加载彩色离线 SVG |
| Remember tab selection | 开启 | `::: tabs#id` / `::: code-tabs#id` 选中项写入 `localStorage` |
| Lazy collapse bodies | 开启 | 折叠面板首次展开前不渲染正文 |
| Lazy tab panels | 开启 | 仅渲染当前选项卡；当前 tab 在块显示前渲染完成 |
| Debug render errors | 关闭 | 块渲染失败时在预览中显示简短提示 |

编辑后预览采用 **软刷新**（只重绘 Plume 块，不整页 `rerender`），减轻跳动。异常时可用命令 **Obsidian Plume: Force Refresh Current Preview** 做完整重建。

## 命令面板

| 命令 | 作用 |
|------|------|
| Obsidian Plume: Force Refresh Current Preview | 对当前笔记强制整页重建阅读视图 |
| Obsidian Plume: Self Check | 显示版本、图标模式、预览窗数量等自检信息 |

## 开发

```bash
npm install
npm run check          # TypeScript
npm test               # Vitest（src/parser.test.ts）
npm run test:legacy    # 旧版脚本测试
npm run dev            # 监听构建 + 生成图标
npm run build          # 类型检查 + 图标生成 + 生产构建 main.js
npm run build:demo     # 生成 docs/index.html（GitHub Pages 预览）
```

`build` / `dev` 会自动执行 `npm run generate:icons`（依赖 `@iconify-json/*`）。

### 测试说明

`src/parser.test.ts` 中部分用例读取**上级目录**的 `plume-complex-test.md`（多仓库工作区中的综合验收稿）。若单独克隆本仓库后 `npm test` 报找不到该文件，可将综合测试 Markdown 放到 `obsidian-theme-plume/../plume-complex-test.md`，或仅运行不依赖该 fixture 的用例。

人工验收推荐使用本仓库内的 [`examples/plume-components.md`](./examples/plume-components.md)。

## 与 VuePress / Plume 的差异

| 能力 | Obsidian Plume | VuePress Plume |
|------|----------------|----------------|
| 站点主题、导航、博客、搜索 | 否 | 是 |
| Markdown 容器与样式 | 是（子集） | 完整 |
| Mermaid / ECharts / 嵌入沙箱 | 未内置 | 支持；可配合 Obsidian 其他插件 |
| `repo-card` | 需联网拉取仓库元数据 | 类似 |
| `@[code-tree]` | 读取**当前库**内文本文件；跳过图片、音视频、Office、PDF 等 | 构建时读磁盘 |
| 阅读视图分段 | 跨段块由 `preview-pipeline` 首段渲染并吸收后续段（`plume-section-absorbed`） | 无此限制 |
| `<Badge>` HTML | 不支持 | 支持 |
| 实时预览 + 深嵌套 | 极端场景可能与纯 VuePress 有细微差异 | — |

## 发布预览站（GitHub Pages）

将 `examples/plume-components.md` 预渲染为静态页面，发布到 GitHub Pages。

### 本地生成

```bash
npm install
npm run build:demo
```

构建成功时终端会打印 `Wrote .../docs/index.html`。用浏览器直接打开该文件即可本地预览（`file://` 路径）。

若进程以 `JavaScript heap out of memory` 退出，说明 `@[code-tree]` 嵌入了过大目录；示例已改为 `../src`，构建脚本也会跳过 `main.js`、`offlineIconData.ts` 等大文件。

输出目录 `docs/`：

| 文件 | 说明 |
|------|------|
| `index.html` | 生成的预览页（**不要手改**，改示例后重新 build） |
| `styles.css` | 从插件根目录复制 |
| `demo-base.css` | 页面布局与 Obsidian 风格 CSS 变量 |
| `demo-client.js` | 选项卡切换等静态页交互 |

### 首次在 GitHub 开启 Pages

1. 推送代码到 `main`（含 `.github/workflows/pages.yml`）。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment → Source** 选 **GitHub Actions**（不要选 “Deploy from branch”）。
4. 推送触发 workflow，或到 **Actions** 手动运行 **Deploy GitHub Pages**。
5. 几分钟后访问：**https://eason596.github.io/obsidian-theme-plume/**

之后每次改 `examples/plume-components.md` 或样式，推送到 `main` 会自动重建；也可本地 `npm run build:demo` 后把 `docs/index.html` 一并提交。

> 预览站用 `marked` 渲染普通 Markdown，与 Obsidian 阅读视图在细节上可能略有差异；Plume 容器样式与 Obsidian 真环境更接近。选项卡、文件树/代码树、折叠手风琴、瀑布流等交互由 `docs/demo-client.js` 在浏览器中启用（静态 HTML 本身不含事件监听）。

## 发布到 GitHub

已安装 [GitHub CLI](https://cli.github.com/) 并登录后：

```cmd
scripts\publish-github.cmd
```

## 许可证

| 文件 | 说明 |
|------|------|
| [LICENSE](./LICENSE) | 本插件：MIT，Copyright (c) 2026 JY |
| [NOTICE](./NOTICE) | 上游 vuepress-theme-plume（MIT, pengzhanbo）及第三方资源说明 |
