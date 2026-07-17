---
title: Obsidian Plume 组件示例
description: 对照上游 Plume 示例整理的容器语法验收稿，可在阅读视图中逐项检查
---

# Obsidian Plume 组件示例

> **中文** | [English](./plume-components.en.md)

在 Obsidian **阅读模式**打开本页，并启用 **Obsidian Plume** 插件。内容与仓库根目录 [`示例.md`](../../示例.md) 对齐，并按 Obsidian 环境做了路径与图标说明。

> **源码在哪？** 本文件即 Markdown 原文。在线预览站每节上方有 **Markdown 源码** 面板；Obsidian 中请用 **编辑模式** 查看 `:::` 围栏块。

> **路径**：本文件位于 `examples/`。`@[code-tree]` 使用 `..` 指向插件根目录；库内其它路径请改成你的文件夹名。

---

## 目录

> **Obsidian**：下方列表可点击跳转。**GitHub Pages 预览**使用左侧固定目录栏。

- [提示容器](#1-提示容器-prompt)
- [步骤 steps](#2-步骤--steps)
- [文件树 file-tree](#3-文件树--file-tree)
- [代码树 code-tree](#4-代码树--code-tree)
- [目录嵌入 @[code-tree]](#5-目录嵌入-code-tree)
- [字段 field / field-group](#6-字段-field--field-group)
- [选项卡 tabs](#7-选项卡--tabs)
- [代码选项卡 code-tabs](#8-代码选项卡--code-tabs)
- [时间线 timeline](#9-时间线--timeline)
- [弹性布局 flex](#10-弹性布局--flex)
- [对齐 align](#10b-对齐--align)
- [折叠 collapse](#11-折叠--collapse)
- [对话 chat](#12-对话--chat)
- [代码块标题 title](#13-代码块标题-title)
- [行内徽章 badge](#14-行内徽章-badge)
- [卡片 card / card-grid](#15-卡片--card)
- [链接卡片 link-card](#16-链接卡片--link-card)
- [图片卡片 image-card](#17-图片卡片--image-card)
- [瀑布流 card-masonry](#18-瀑布流--card-masonry)
- [仓库卡片 repo-card](#19-仓库卡片--repo-card)
- [窗口 window](#20-窗口--window)
- [表格 table](#21-表格--table)
- [npm-to](#22-npm-to)
- [二维码 qrcode](#23-二维码--qrcode)
- [PDF / 视频嵌入](#24-pdf--bilibili--youtube)
- [外链 favicon](#25-外链-favicon)

---

<a id="1-提示容器-prompt"></a>
## 1. 提示容器 prompt

### 默认标题样式

::: note
这是一个注释框
:::

::: info
这是一个信息框
:::

::: tip
这是一个提示框
:::

::: warning
这是一个警告框
:::

::: caution
这是一个危险警告框
:::

::: danger
`danger` 与 `caution` 同族（对齐 VuePress Plume）
:::

::: important
这是重要信息
:::

::: details
这是一个详情折叠框
:::

### 自定义标题

::: caution STOP
危险区域，请勿继续
:::

::: details 点我查看代码
```js
console.log('Hello, VitePress!')
```
:::

::: details 默认展开 {open}
使用 `{open}` 时默认展开（对齐 VuePress）。
:::

### GitHub Alerts

> [!NOTE]
> 与 VuePress 相同的 GitHub Alert 语法；阅读视图中会套用 Plume 提示框配色。

> [!TIP]
> 有用的建议。

> [!IMPORTANT]
> 需要用户知晓的关键信息。

> [!WARNING]
> 需要立即注意的内容。

> [!CAUTION]
> 风险或负面后果提示。

---

<a id="2-步骤--steps"></a>
## 2. 步骤 `::: steps`

:::: steps
1. 步骤 1

   ```ts
   console.log('Hello World!')
   ```

2. 步骤 2

   这里是步骤 2 的相关内容

3. 步骤 3

   ::: tip
   提示容器
   :::

4. 结束
::::

---

<a id="3-文件树--file-tree"></a>
## 3. 文件树 `::: file-tree`

::: file-tree

- docs
  - .vuepress
    - ++ config.ts
  - -- page1.md
  - README.md
- theme  # 一个 **主题** 目录
  - client
    - components
      - **Navbar.vue**
    - composables
      - useNavbar.ts
    - styles
      - navbar.css
    - config.ts
  - node/
- package.json
- pnpm-lock.yaml
- .gitignore
- README.md
- …
:::

> `++` / `--` 表示聚焦 / 淡化；`…` 为省略号节点。可选 `icon="colored"` / `icon="simple"`。

---

<a id="4-代码树--code-tree"></a>
## 4. 代码树 `::: code-tree`

### code-tree 容器

::: code-tree title="Vue App" height="400px" entry="src/main.ts"
```vue title="src/components/HelloWorld.vue"
<template>
  <div class="hello">
    <h1>Hello World</h1>
  </div>
</template>
```

```vue title="src/App.vue"
<template>
  <div id="app">
    <h3>vuepress-theme-plume</h3>
    <HelloWorld />
  </div>
</template>
```

```ts title="src/main.ts"
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

```json title="package.json"
{
  "name": "Vue App",
  "scripts": {
    "dev": "vite"
  }
}
```
:::

---

<a id="5-目录嵌入-code-tree"></a>
## 5. 目录嵌入 `@[code-tree]`

### 简单配置

@[code-tree](../src)

### 添加配置

@[code-tree title="插件源码" height="800px" entry="parser.ts"](../src)

> 路径相对于本文件；`build:demo` 会跳过超大文件与 `main.js` 等，避免静态站构建占满内存。

---

<a id="6-字段-field--field-group"></a>
## 6. 字段 `field` / `field-group`

对齐 VuePress：位置名 + `@tag` 语法（推荐）；仍兼容旧的属性写法。

:::: field-group

::: field theme
@type ThemeConfig
@default { base: '/' }
@required

主题配置
:::

::: field enabled
@type boolean
@default true
@optional

是否启用
:::

::: field callback
@type (...args: any[]) => void
@default () => {}
@optional

v1.0.0 新增
回调函数
:::

::: field other
@type string
@deprecated

v0.9.0 弃用
已弃用属性
:::

::::

---

<a id="7-选项卡--tabs"></a>
## 7. 选项卡 `::: tabs`

::: tabs
@tab npm

npm 应该与 Node.js 被一同安装。

@tab pnpm

```sh
corepack enable
corepack use pnpm@8
```

:::

> 支持 `::: tabs#id` / `id="..."` 与 localStorage 记忆选中项（见插件设置）。

---

<a id="8-代码选项卡--code-tabs"></a>
## 8. 代码选项卡 `::: code-tabs`

::: code-tabs
@tab config.js
```js
/**
 * @type {import('vuepress').UserConfig}
 */
const config = {
  // ..
}

export default config
```

@tab config.ts
```ts
import type { UserConfig } from 'vuepress'

const config: UserConfig = {
  // ..
}

export default config
```
:::

---

<a id="9-时间线--timeline"></a>
## 9. 时间线 `::: timeline`

::: timeline
- 节点一
  time=2025-03-20 type=success

  正文内容

- 节点二
  time=2025-02-21 type=warning

  正文内容

- 节点三
  time=2025-01-22 type=danger

  正文内容
:::

::: timeline horizontal
- 节点一
  time=2025-03-20

  正文内容

- 节点二
  time=2025-04-20 type=success

  正文内容

- 节点三
  time=2025-01-22 type=danger

  正文内容

- 节点四
  time=2025-01-22 type=important

  正文内容
:::

::: timeline placement="right"
- 节点一
  time=2025-03-20

  正文内容

- 节点二
  time=2025-04-20 type=success

  正文内容

- 节点三
  time=2025-01-22 type=danger

  正文内容

- 节点四
  time=2025-01-22 type=important

  正文内容
:::

::: timeline placement="between"
- 节点一
  time=2025-03-20 placement=right

  正文内容

- 节点二
  time=2025-04-20 type=success

  正文内容

- 节点三
  time=2025-01-22 type=danger placement=right

  正文内容

- 节点四
  time=2025-01-22 type=important

  正文内容
:::

::: timeline line="dotted"
- 节点一
  time=2025-03-20

  正文内容

- 节点二
  time=2025-04-20 type=success

  正文内容

- 节点三
  time=2025-01-22 type=danger line=dashed

  正文内容

- 节点四
  time=2025-01-22 type=important line=solid

  正文内容
:::

---

<a id="10-弹性布局--flex"></a>
## 10. 弹性布局 `::: flex`

::: flex between center

| 列 1 | 列 2 | 列 3 |
| ---- | ---- | ---- |
| 1    | 2    | 3    |
| 4    | 5    | 6    |

| 列 1 | 列 2 | 列 3 |
| ---- | ---- | ---- |
| 1    | 2    | 3    |
| 4    | 5    | 6    |

:::

---

<a id="10b-对齐--align"></a>
## 10b. 对齐 `::: left` / `center` / `right` / `justify`

::: left
左对齐文本
:::

::: center
居中文本
:::

::: right
右对齐文本
:::

::: justify
两端对齐文本。较长内容时会按两端对齐方式排布，与 VuePress Plume 的 `::: justify` 一致。
:::

---

<a id="11-折叠--collapse"></a>
## 11. 折叠 `::: collapse`

::: collapse expand
- :+ 标题 1

  正文内容

- :- 标题 2

  正文内容

- 标题 3

  正文内容
:::

> `:+` 前缀表示默认展开，`:-` 表示默认折叠；`accordion` 属性可改为手风琴模式。

---

<a id="12-对话--chat"></a>
## 12. 对话 `::: chat`

::: chat title="标题"
{:2025-03-24 10:15:00}

{用户一}
用户一的消息

{.}
本人的消息

{用户二}
用户二的消息

{.}
本人的消息
:::

---

<a id="13-代码块标题-title"></a>
## 13. 代码块标题 title

在围栏 info 中写 `title="..."`：

```py title="test.py"
import numpy as np
```

```ts title="example.ts"
const answer = 42
```

---

<a id="14-行内徽章-badge"></a>
## 14. 行内徽章 badge

对齐 VuePress，使用 HTML `<Badge>`：
- VuePress - <Badge type="info" text="v2" />
- VuePress - <Badge type="tip" text="v2" />
- VuePress - <Badge type="warning" text="v2" />
- VuePress - <Badge type="danger" text="v2" />
- VuePress - <Badge text="v2" color="#8e5cd9" bg-color="rgba(159, 122, 234, 0.16)" />


 <a id="15-卡片--card"></a>
## 15. 卡片 `::: card` / `card-grid`

> **`icon`**：Lucide 名（如 `smile`）、图片 URL，或 Iconify `collection:name`（含 `twemoji:astonished-face`；在线 Iconify / 离线包）。

### 单个卡片

::: card title="标题" icon="smile"

这里是卡片内容。
:::

### 多个卡片

:::: card-grid

::: card title="卡片标题 1" icon="smile"

这里是卡片内容。
:::

::: card title="卡片标题 2" icon="sparkles"

这里是卡片内容。
:::

::::

---

<a id="16-链接卡片--link-card"></a>
## 16. 链接卡片 `::: link-card`

::: link-card href="https://obsidian.md" title="Obsidian 官网" icon="external-link" description="个人知识库的瑞士军刀"
:::

`href` 也可裸写位置参数：

::: link-card https://github.com title="GitHub" icon="github"
:::

`description` 写在 body（支持 Markdown），优先级低于 `description=` 属性：

::: link-card href="我的笔记" title="跳到笔记" icon="file-text"
这是一段**多行**描述，可以写 markdown。
:::

---

<a id="17-图片卡片--image-card"></a>
## 17. 图片卡片 `::: image-card`

::: image-card image="https://picsum.photos/id/1015/600/400" title="星空" author="John" date="2025-06-01" width="600" center
:::

---

<a id="18-瀑布流--card-masonry"></a>
## 18. 瀑布流 `::: card-masonry`

### 卡片瀑布

:::: card-masonry

::: card title="卡片1"
卡片内容
:::

::: card title="卡片2"
卡片内容

卡片内容
:::

::: card title="卡片3"
卡片内容
:::

::: card title="卡片4"
卡片内容
:::

::: card title="卡片5"
卡片内容

卡片内容
:::

::: card title="卡片6"
卡片内容
:::

::::

### 代码块瀑布

::: card-masonry

```ts
const a = 1
```

```json
{
  "name": "John"
}
```

```css
p {
  color: red;
}
```

```html
<html>
  <body>
    <h1>Hello world</h1>
  </body>
</html>
```

```ts
const a = 12
const b = 1
```

```rust
fn main() {
    println!("Hello, world!");
}
```

:::

### 图片瀑布

::: card-masonry cols=3
::: image-card image="https://picsum.photos/id/1015/600/400" title="山涧溪流" author="Unsplash" date="2024-03-12"
清晨的山谷里，溪水从石缝中流出，带着冷冽的雾气。
:::

::: image-card image="https://picsum.photos/id/1025/600/700" title="小猴沉思" author="Picsum" date="2023-11-04"
:::

::: image-card image="https://picsum.photos/id/1043/600/500" title="桥与晨雾" author="Anonymous" date="2024-01-20" href="https://picsum.photos/id/1043"
雾气漫过老桥，远处的灯还没熄。
:::

::: image-card image="https://picsum.photos/id/1059/600/800" title="林间小路" author="Unsplash"
落叶铺满整条小路，没有尽头。
:::

::: image-card image="https://picsum.photos/id/106/600/400" title="花田" date="2024-05-08"
:::

::: image-card image="https://picsum.photos/id/1074/600/600" title="雪原" author="Photographer" date="2025-12-25"
极北的雪，安静得能听见自己的呼吸。
:::

::: image-card image="https://picsum.photos/id/110/600/900" title="峡谷俯瞰" author="John Doe" date="2024-08-15"
站在悬崖边，风把所有声音都带走了。
:::

::: image-card image="https://picsum.photos/id/1084/600/450" title="海岸黄昏"
:::

::: image-card image="https://picsum.photos/id/1080/600/600" title="樱桃" author="Studio" date="2025-04-01" href="https://picsum.photos"
盘子里的几颗樱桃，红得发亮。
:::

:::

---

<a id="19-仓库卡片--repo-card"></a>
## 19. 仓库卡片 `::: repo-card`

需联网请求 GitHub / Gitee API（`示例.md` 未收录，Obsidian 扩展）：

::: repo-card repo="pengzhanbo/vuepress-theme-plume" provider="github"
:::

---

<a id="20-窗口--window"></a>
## 20. 窗口 `::: window`

::: window title="终端" height="200"

```bash title="build.sh"
npm run build
```
:::

---

<a id="21-表格--table"></a>
## 21. 表格 `::: table`

右上角为复制按钮（复制 HTML / 复制 Markdown）。不需要可写 `copy="false"`。

::: table title="基础表" align="center" copy="all"

| 名称 | 版本 | 说明 |
| ---- | ---- | ---- |
| Theme Plume | 1.2.0 | Obsidian 插件 |
| VuePress Plume | — | 上游主题 |

:::

::: table title="高亮" max-content hl-rows="tip:1" hl-cols="warning:2"

| A | B | C |
| - | - | - |
| 1 | 2 | 3 |
| 4 | 5 | 6 |

:::

---

<a id="22-npm-to"></a>
## 22. `::: npm-to`

::: npm-to
```sh
npm install -D vuepress vuepress-theme-plume
```
:::

::: npm-to tabs="npm,pnpm,yarn,bun"
```sh
npx vp-update
```
:::

---

<a id="23-二维码--qrcode"></a>
## 23. 二维码 `@[qrcode]` / `::: qrcode`

@[qrcode align="center" title="Obsidian"](https://obsidian.md)

@[qrcode card title="Cursor"](https://cursor.com/cn)

::: qrcode card title="短文本"
Theme Plume
:::

---

<a id="24-pdf--bilibili--youtube"></a>
## 24. PDF / Bilibili / YouTube

@[pdf height="360px"](https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf)

@[bilibili](BV1EZ42187Hg)

@[youtube ratio="16:9"](dQw4w9WgXcQ)

---

<a id="25-外链-favicon"></a>
## 25. 外链 favicon

在笔记 frontmatter（文件最上方用一对 `---` 包住）写入：

```yaml
---
link-icons: true
link-icon-size: 16
---
```


开启后，本页 http(s) 外链前会显示网站图标（需网络）。示例见库内 `Theme-Plume-更新验收.md`。

