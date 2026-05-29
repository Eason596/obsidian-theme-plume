# Obsidian Plume

在 Obsidian 阅读视图中渲染 [VuePress Theme Plume](https://github.com/pengzhanbo/vuepress-theme-plume) 的 Markdown 容器语法（`::: file-tree`、`::: tabs`、`:::: steps` 等）。

## 项目来源

本仓库是将 [vuepress-theme-plume](https://github.com/pengzhanbo/vuepress-theme-plume) 的 Markdown 增强能力**迁移到 Obsidian** 的独立插件项目，**并非**上游官方仓库。迁移与重构过程中大量使用了 **AI 辅助开发工具**（如 Cursor）完成解析、渲染与样式对齐。

- 仅覆盖 Plume 的 **Markdown 容器与阅读视图渲染**，不包含 VuePress 站点主题、导航、博客等功能。
- 上游主题采用 [MIT](https://github.com/pengzhanbo/vuepress-theme-plume/blob/main/LICENSE) 协议；本仓库同样以 MIT 发布，并保留上游版权声明，详见 [NOTICE](./NOTICE)。

## 架构（v0.2）

| 模块 | 职责 |
|------|------|
| `src/parser.ts` | 纯函数解析 `:::` 容器、collapse 列表、`@[code-tree]` 嵌入 |
| `src/render.ts` | 各容器 DOM 渲染入口；`registerBlockRenderer` 注册块分发 |
| `src/render/pipeline.ts` | **占位符 + 递归** `renderInnerMarkdown` |
| `src/render/blocks/collapse.ts` | Collapse 面板（合法 `<summary>`、懒加载正文） |
| `src/render/tabbed-container.ts` | `tabs` / `code-tabs` 共用导航与面板渲染 |
| `src/render/tab-store.ts` | Tab 持久化与跨实例同步（可设置关闭） |
| `src/markdown/plume-markdown.ts` | 统一 `MarkdownRenderer` + `MarkdownRenderChild` 生命周期 |
| `src/pipeline/preview-pipeline.ts` | 与 Obsidian 分段后处理器协调（首段渲染、吸收内部段） |
| `src/pipeline/code-fence-titles.ts` | 代码块 `title="..."` 标题栏增量修补 |

核心原则：**不重复实现 markdown-it**，容器内正文一律交给 Obsidian 渲染；自定义块在渲染前替换为 HTML 占位符，再填充组件。

## 支持的语法

与 Plume 文档一致。综合验收见仓库根目录 [`plume-complex-test.md`](../plume-complex-test.md)，基础用例见 [`模块测试.md`](../模块测试.md)。主要包括：

- `::: file-tree` / `::: code-tree` / `@[code-tree](path)`
- `::: tabs` / `::: code-tabs`
- `:::: steps`
- `::: tip` / `::: warning` 等提示容器
- `::: card` / `::: card-grid` / `::: card-masonry`
- `::: timeline` / `::: collapse`
- `::: repo-card` / `::: link-card` / `::: image-card`
- `::: field` / `::: field-group` / `::: flex` / `::: window` / `::: chat`
- `` `badge:tip:文本` `` 行内徽章

## 开发

```bash
cd obsidian-theme-plume
npm install
npm run check    # TypeScript
npm test         # Vitest parser 回归（无需启动 Obsidian）
npm run build
```

将本目录复制到 `<vault>/.obsidian/plugins/obsidian-plume/` 并在社区插件中启用 **Obsidian Plume**。

> **注意**：插件 id 已从 `vuepress-file-tree` 改为 `obsidian-plume`，升级时请删除旧插件目录或禁用旧 id，避免重复加载。

## 设置

在 **设置 → Obsidian Plume** 中可配置：

| 选项 | 说明 |
|------|------|
| Default file-tree icon mode | `colored` / `simple` |
| Remember tab selection | `::: tabs#id` / `::: code-tabs#id` 的选中项写入 localStorage |
| Lazy collapse bodies | 折叠面板首次展开前不渲染正文（减轻大文档开销） |
| Lazy tab panels | 仅渲染当前选项卡；当前 tab 在块显示前渲染完成 |
| Debug render errors | 块渲染失败时在预览中显示简短提示 |

编辑后预览同步采用 **软刷新**（只重绘 Plume 块，不整页 `rerender`），以减轻切换模式时的跳动；若异常可用命令 **Obsidian Plume: Force Refresh Current Preview** 做完整重建。

## 与 VuePress 的差异

- 仅覆盖 **Markdown 增强**（容器、文件树、代码块标题等），不包含 Plume 主题布局、导航、博客、搜索等站点功能。
- 图表（Mermaid/ECharts）、嵌入沙箱等重型能力未内置；可配合 Obsidian 其他插件使用。
- 阅读视图依赖 Obsidian **按段**后处理：块若跨多个 DOM 段，由 `preview-pipeline` 在首段渲染整块并**吸收**后续段（`plume-section-absorbed`），以保持大纲锚点可用；在段边界处编辑后，首段会安排重绘。极端深嵌套 + 实时预览可能与纯 VuePress 有细微差异。
- `simple` 图标模式不会加载离线 Iconify SVG 数据，可减小运行时开销。

## 许可证

| 文件 | 说明 |
|------|------|
| [LICENSE](./LICENSE) | 本插件代码：MIT，Copyright (c) 2026 JY |
| [NOTICE](./NOTICE) | 上游 vuepress-theme-plume（MIT, pengzhanbo）及第三方资源说明 |
