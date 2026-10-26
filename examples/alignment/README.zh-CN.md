# 共用笔记约定

同一份笔记：`notes/basic.md`。库根需要有 `images/` 与 `assets/`。配色由 Obsidian 的 Plume 主题负责，插件负责语法。

## 两边都写这些

- 容器：`::: note`、`tip`、`tabs`、`steps`、`collapse`、`details`、`card`、`card-grid`、`card-masonry`、`table`、`npm-to`。
- 卡片标签：`<Card>`、`<LinkCard>`、`<ImageCard>`、`<RepoCard>`。不要写 `::: link-card`、`::: image-card`、`::: repo-card`。
- 行内：`H~2~O`、`x^2^`、`[^id]`、`[+label]`、`*[HTML]: 说明`、`==高亮==`。`word{.class}` 默认关闭，在插件设置里打开后才生效。
- 链接用明确路径，例如 `[安装](./install.md)` 或 `[标题](./guide.md#安装)`。不把块 ID 写进共用笔记。
- 折叠用 `::: details` 或 `::: collapse`。不把 Obsidian Callout 的 `+` / `-` 当作两边一致的折叠。
- 图片用相对路径，或 `/images/...`、`/assets/...`。发布时用插件命令复制到 VuePress 的 `docs/.vuepress/public`。

## 插件设置

容器、代码扩展、嵌入、行内语法默认打开。关掉后，对应原文留在笔记里，不再渲染成组件。属性语法默认关闭。

## 不再对齐

图表库、REPL、加密、第三方播放器和代码站嵌入、Twoslash、缩进参考线、彩色括号。Mermaid 和公式用两边各自现成的渲染。

## 对照

选择 Plume 主题后看 `notes/basic.md` 和 `notes/nested.md`。正文栏最宽约 48rem。实时预览使用同一套文字颜色。代码围栏里的组件标签仍是源码。
