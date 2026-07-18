# 更新日志

> [English](./CHANGELOG.md) | **中文**

## 1.2.1

### 变更

- 仅桌面版（`isDesktopOnly`）：二维码拆成同目录 `qrcode-lib.cjs`（Electron `require` 加载），不再打进 `main.js`。
- 共用 `enrichRenderedRoot`（badges / Iconify / alerts / plots / favicons），避免 pipeline 与全局后处理器重复 enrichment。

### 修复

- 软刷新按 `blockKey` / sentinel 跳过未变的 Plume 段，不再因文档 dirty 强制拆掉 `card-masonry`。
- 软刷新不再在未 `previewMode.set` 时标记 Reading 已同步；真正 set 后跳过 Reading leading 再刷。
- 过期快照比较前统一换行符，避免 Windows 下 `\r\n` 导致 `::: card` 等容器被跳过。
- `processBadges` 不再整段重渲含 `:::` 的 section（卡片内 Badge/Iconify 会与 pipeline 竞态，留下原始 `:::`）。
- badges / Iconify / favicons 只 enrichment 一次：pipeline 负责 `.plume-has-block`，全局后处理器跳过。
- 外链图标：用 Obsidian `requestUrl` 拉成 data URL（预览里远程 `<img>` 常被拦截）；站点 → Yandex → Google，域名缓存 + 并发上限；优先读笔记正文 frontmatter。
- 仅当 live 缓冲仍等于本次渲染文本时才清 dirty，避免快打字竞态。
- 主题刷新装饰围栏时优先用 `.line`；WeakMap 丢失时不再用扁平 `textContent` 压成一行。
- 尚无 title bar 时保留 title dirty；Release 附带 `qrcode-lib.cjs`。
- Fence soft-skip / 观察者收敛 / scan 缓存 / section 级 feature 匹配 / 高度解锁辅助。
- Shiki 改为按需加载受支持的语法与精选主题，实时预览和阅读模式共用同一套配色管线；生产版 `main.js` 启用压缩。
- 渲染段被替换时会释放 Tab 同步监听、瀑布流观察器、Markdown 渲染子组件和代码围栏观察器。
- 卡片和嵌入拒绝活动内容协议，媒体 iframe 增加沙箱，并清洗远程 Iconify SVG。

## 1.2.0

### 变更

- 代码高亮改为 **Shiki**（默认 `vitesse-light` / `vitesse-dark`，与 VuePress Theme Plume 一致），替换 highlight.js。
- 设置中可为 Obsidian 亮色 / 暗色分别选择 Shiki 主题。

### 修复

- 首次打开库时 `::: code-tree` 可能仍显示原文：提前注册后处理器、重试 section info，仅在必要时强制重渲。
- code-tree 面板高亮可能卡住（异步 Shiki 竞态），需点其他文件才恢复。
- 切换 Obsidian 亮/暗后会重新上色。
- `[!code word:…]` 不再误伤内联 `style` 属性。
- 提示容器内代码不再被 `white-space` 挤成一行。

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
