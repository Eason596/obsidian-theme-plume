# Plume 文档写作说明

按 VuePress Theme Plume 写 Markdown。同一份正文要能在 Plume 网站和 Obsidian 插件里渲染。

骨架按本文件写。某一语法的属性、标记和可选取值，打开对应文档再使用。文档里没有的参数不要发明。即使官网还有更多功能，仍然遵守下面的「不要使用」。

文档根地址：<https://theme-plume.vuejs.press>

## 总则

- 正文用标准 Markdown：标题、段落、列表、引用、表格、任务列表、链接、图片、代码围栏。
- 容器用三个或更多冒号。外层必须比内层多至少一个冒号。
- 属性写在打开标记的同一行，字符串用双引号。组件标签可以多行，每个属性单独一行，引号内不要换行。
- 不要写 Vue 表达式、事件或动态绑定。
- 代码围栏里的 `@tab`、`:::` 和组件标签保持为源码。
- 中文技术文档用简体中文，语气直接。

## 不要使用

- `::: link-card`、`::: image-card`、`::: repo-card`。
- Obsidian Callout 的 `> [!NOTE]+` 与 `> [!NOTE]-`。
- 块 ID、`^block-id`、按块嵌入。
- `iconfont`、`fontawesome`、`{.class}` 属性语法。
- 图表库、REPL、加密、`@include`、CodePen、Replit、CodeSandbox、JSFiddle、Can I Use、ArtPlayer、Twoslash、Swiper、NpmBadge。
- 未在本文件或对应官网页面出现的组件。

## 文档索引

需要细参数时只打开这一行的链接。

| 写法 | 文档 |
| --- | --- |
| 基础 Markdown 与行内容器 | <https://theme-plume.vuejs.press/guide/markdown/basic/> |
| 提示容器 | <https://theme-plume.vuejs.press/guide/markdown/container/> |
| GitHub Alert | <https://theme-plume.vuejs.press/guide/markdown/github-alerts/> |
| 选项卡 | <https://theme-plume.vuejs.press/guide/markdown/tabs/> |
| 代码分组 `code-tabs` | <https://theme-plume.vuejs.press/guide/code/group/> |
| 步骤 | <https://theme-plume.vuejs.press/guide/markdown/steps/> |
| 折叠 | <https://theme-plume.vuejs.press/guide/markdown/collapse/> |
| 卡片容器 | <https://theme-plume.vuejs.press/guide/markdown/card/> |
| `<Card>` | <https://theme-plume.vuejs.press/guide/components/card/> |
| `<CardGrid>` | <https://theme-plume.vuejs.press/guide/components/card-grid/> |
| `<CardMasonry>` | <https://theme-plume.vuejs.press/guide/components/card-masonry/> |
| `<LinkCard>` | <https://theme-plume.vuejs.press/guide/components/link-card/> |
| `<ImageCard>` | <https://theme-plume.vuejs.press/guide/components/image-card/> |
| `<RepoCard>` | <https://theme-plume.vuejs.press/guide/components/github-repo-card/> |
| 代码块特性 | <https://theme-plume.vuejs.press/guide/code/features/> |
| `npm-to` | <https://theme-plume.vuejs.press/guide/markdown/npm-to/> |
| 代码树 | <https://theme-plume.vuejs.press/guide/markdown/code-tree/> |
| 文件树 | <https://theme-plume.vuejs.press/guide/markdown/file-tree/> |
| 高亮 | <https://theme-plume.vuejs.press/guide/markdown/mark/> |
| 注释 | <https://theme-plume.vuejs.press/guide/markdown/annotation/> |
| 缩写 | <https://theme-plume.vuejs.press/guide/markdown/abbreviation/> |
| `<Badge>` | <https://theme-plume.vuejs.press/guide/components/badge/> |
| 图标 | <https://theme-plume.vuejs.press/guide/markdown/icon/> |
| 表格容器 | <https://theme-plume.vuejs.press/guide/markdown/table/> |
| 二维码 | <https://theme-plume.vuejs.press/guide/markdown/qrcode/> |
| PDF | <https://theme-plume.vuejs.press/guide/embed/pdf/> |
| Bilibili | <https://theme-plume.vuejs.press/guide/embed/video/bilibili/> |
| YouTube | <https://theme-plume.vuejs.press/guide/embed/video/youtube/> |
| 时间线 | <https://theme-plume.vuejs.press/guide/markdown/timeline/> |
| 字段 | <https://theme-plume.vuejs.press/guide/markdown/field/> |
| 弹性布局 | <https://theme-plume.vuejs.press/guide/markdown/flex/> |
| 窗口 | <https://theme-plume.vuejs.press/guide/markdown/window/> |
| 对话 | <https://theme-plume.vuejs.press/guide/markdown/chat/> |

## 提示

类型只有 `note`、`info`、`tip`、`warning`、`caution`、`danger`、`important`、`details`。`danger` 与 `caution` 同类。细参数见容器文档。

```md
::: tip 标题
提示正文。
:::

::: details 默认展开 {open}
折叠正文。
:::
```

GitHub Alert 写成 `> [!TIP]`，不要加 `+` 或 `-`。

## 选项卡、步骤、折叠

```md
::: tabs#install
@tab 安装

说明。

@tab:active 配置 #config

当前面板。
:::
```

````md
::: code-tabs
```sh title="pnpm" :active
pnpm add vue
```

```sh title="yarn"
yarn add vue
```
:::
````

```md
::: steps
1. 第一步

   说明。

2. 第二步
:::
```

```md
::: collapse accordion
- 面板标题

  正文。

- :+ 默认展开

  正文。
:::
```

步骤或折叠里再套容器时，外层冒号更多。`:+` 默认展开，`:-` 默认折叠。其余属性查对应文档。

## 卡片

`::: card`、`::: card-grid`、`::: card-masonry` 与 `<Card>`、`<CardGrid>`、`<CardMasonry>` 等价。文档优先用容器。网格和瀑布流的外层冒号更长。`cols`、`gap`、`icon` 的取值查卡片文档。

```md
:::: card-grid
::: card title="标题" icon="mdi:github"
卡片正文。
:::
::::
```

链接卡片、图片卡片、仓库卡片只用标签。属性表查组件文档，不要改用冒号容器。

```md
<LinkCard href="https://example.com" title="文档" icon="mdi:book-open" description="一句说明" />

<ImageCard image="/images/demo.png" title="示例" />

<RepoCard repo="vuepress/core" provider="github" />
```

普通图片用相对路径：`![说明](../images/demo.png)`。`<ImageCard image>` 用 `/images/...` 或 `/assets/...`。

## 代码、代码树、文件树

满 10 行显示行号。`:line-numbers`、`:no-line-numbers`、`title`、`{1,3-4}`、`[!code]` 的完整形式查代码块特性文档。未写 `tabs` 的 `::: npm-to` 顺序是 pnpm、yarn、npm。

````md
```ts title="src/index.ts"
const value = 1;
```

::: npm-to
```sh
npm install -D vuepress vuepress-theme-plume
```
:::
````

````md
::: code-tree title="源码"
```ts title="src/index.ts" :active
export const ready = true;
```
:::
````

目录嵌入：`@[code-tree](./src)`。文件树用 `::: file-tree`，文件夹名以 `/` 结尾。行内的 `#`、`**名字**`、`++`、`--` 查文件树文档。`icon` 只能是 `colored` 或 `simple`。

## 行内、徽章、图标

上下标、高亮、注释、缩写、脚注的边界情况查对应文档。代码围栏和行内代码里的这些标记保持原样。

```md
H~2~O、x^2^、==关键词==、[+api]、HTML、[^id]

[+api]: 应用程序接口

*[HTML]: 超文本标记语言

[^id]: 脚注正文。
```

```md
<Badge type="tip" text="推荐" />
::mdi:github::
<Icon name="mdi:github" />
```

`==文字==` 是高亮。`~~删除线~~` 不是下标。`[^id]` 是脚注，不是上标。

## 表格、二维码、媒体、时间线、字段、布局

每种先写最小结构。标题、对齐、复制、高亮、页码、自动播放、时间、字段标签和布局标志都查索引里的文档。

```md
::: table title="表题"
| 列 | 说明 |
| --- | --- |
| A | 内容 |
:::

@[qrcode](https://example.com)

@[pdf](../assets/files/guide.pdf)

@[bilibili](BV1xx411c7mD)

@[youtube](dQw4w9WgXcQ)

::: timeline
- 发布
  time="2026"

  说明。
:::

::: field theme
字段说明。

@type string
:::

::: center
居中内容。
:::

::: flex
左块

右块
:::

::: window title="预览"
窗口内容。
:::

::: chat title="示例"
{助手}
第一句。

{.}
自己的一句。
:::
```

对齐容器还有 `::: left`、`::: right`、`::: justify`。`::: field-group` 包住多个 `::: field`。`demo-wrapper` 与 `window` 相同。

## 链接与嵌套

内部链接写明确路径：`[安装](./install.md)`、`[小节](./guide.md#安装)`。不要做同名模糊查找，不要写块引用。

外层冒号必须多于内层。网格的直接子块应是卡片、链接卡片、图片卡片或仓库卡片。

## 写作时怎么选

- 一句注意用 `::: tip` 或 `::: warning`。危险操作用 `::: danger`。
- 并列且没有顺序用 `::: tabs`。有先后用 `::: steps`。
- 可跳过的长说明用 `::: details` 或 `::: collapse`。
- 多个同级入口用 `::: card-grid`。一个外链用 `<LinkCard>`。
- 多个源文件用 `::: code-tree`。只展示目录用 `::: file-tree`。
- 参数说明用 `::: field`。代码能短则短。
- 没有必要时不要使用 `chat`、`window`、`timeline`、`flex`。
