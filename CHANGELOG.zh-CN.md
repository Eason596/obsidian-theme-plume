# 更新日志

> [English](./CHANGELOG.md) | **中文**

## 未发布

## 1.1.1

### 修复

- 普通代码围栏在阅读视图不再被挤成一行（无 Plume 特性时不再用 highlight.js 重写 DOM）。

## 1.1.0

### 新增

- `::: table` — title / align / copy（HTML·Markdown）/ max-content / full-width / hl-rows·cols·cells。
- `::: npm-to` — 单条 npm/npx 围栏展开为多包管理器 `code-tabs`（`tabs=`）。
- `@[qrcode]` / `::: qrcode` — 本地生成二维码（`card`、`title`、`align`、`logo` 等）。
- `@[pdf]` / `@[bilibili]` / `@[youtube]` — iframe 嵌入（库内或远程 PDF；官方视频播放器）。
- Frontmatter `link-icons` / `link-icon-size` — 外链前自动加网站 favicon。
- Tabs / code-tabs 观感对齐 VuePress（间距、激活条、包管理器 logos）。
- 双语文档：`README.zh-CN.md`、`CHANGELOG.zh-CN.md`、`examples/plume-components.en.md`。

### 修复

- 对齐容器：解析 `::: left` 与 `::: justify`（此前仅有 `center` / `right`）。
- Field 容器：VuePress 位置名 + `@type` / `@default` / `@required` 正文标签。
- 提示容器：`::: danger`、`::: important` 样式、`::: details … {open}`、GitHub Alerts 的 Plume 配色。
- 徽章：仅保留 VuePress `<Badge>`（移除非上游 `` `badge:` `` 简写）。
- Collapse 示例：修正 `:+` / `:-` 文档说明。
- 软刷新同时刷新 Live Preview 的 leading section；code-tabs 高度 / 非激活面板隐藏。
- Link-card 描述宿主改为 `div`（嵌套更安全）；masonry 单元格去掉 link-card 多余外边距。

### 亦含

- 代码围栏 meta：`{1,3-5}` 高亮、`[!code …]` 标记、`:line-numbers`、`:collapsed-lines`。
- 文件树 CLI 格式（`├──` / `` ```tree `` / `` ```file-tree ``）。
- 卡片图标：Iconify `collection:name`（含 `twemoji:`，在线/离线 Iconify）。
- Card-masonry 响应式 `cols="{sm,md,lg}"`。
- Window 装饰图标：reload / share / add / copy（对齐 VuePress）。

## 1.0.3

### 修复

- 调整设置页标题文案，避免与插件名重复。

## 1.0.2

### 修复

- 处理 Obsidian 社区插件审阅意见：manifest 文案、设置标题、DOM 安全、内联样式、iOS 兼容图标解析、弹出窗计时器兼容性。
- CI 发布构建在上游源定义不可用时，仍保留已提交的 VuePress 文件图标规则。

### 变更

- 为发布的插件资源增加 GitHub release artifact attestations。

## 0.2.0（未发布）

### 修复

- Collapse 面板：合法 `<summary>` 标记（`span` 标题、仅 phrasing 的行内 MD）。
- 嵌套 Card → Collapse → 代码块 / code-tabs 渲染（脱离 DOM + body 挂载）。
- Flex 容器：渲染分段 Markdown 时使用正确的 `BlockRenderContext`。
- Code-tabs 键盘导航（`role="tab"`）。
- 并行构建嵌套容器时的 Markdown 渲染 token 竞态。

### 变更

- Tabs 与 code-tabs 共用 `render/tabbed-container.ts`；移除旧版 `renderTabsInto`。
- Collapse 渲染迁至 `render/blocks/collapse.ts`；列表解析在 `parser.ts`。
- 渲染管线拆分：`render/pipeline.ts`、`render/block-registry.ts`、`render/context.ts`。
- 按笔记 `sourcePath` 的解析缓存（切换文件时避免陈旧块）。
- 设置 UI：tab 持久化、懒加载折叠正文、调试渲染错误。
- 彩色离线图标首次使用时加载 SVG 映射（`simple` 模式跳过）。
- `npm test` 使用 Vitest（`src/parser.test.ts`）；`npm run test:legacy` 保留旧脚本。

### 新增

- `src/render/index.ts` 桶导出管线辅助函数。
- `plume-complex-test.md` §七 手动回归清单。
