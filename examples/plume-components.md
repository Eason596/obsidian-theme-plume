---
title: Obsidian Plume 组件示例
description: 各 Plume 容器语法的初版示例，可在阅读视图中逐项对照完善
---

# Obsidian Plume 组件示例

在 Obsidian **阅读模式**打开本页，并启用 **Obsidian Plume** 插件。每个小节对应一种（或一组）容器语法，可按需增删改。

> 路径说明：本文件位于 `examples/`，`@[code-tree]` 示例使用相对路径 `../src` 指向插件源码目录。

---

## 目录

1. [文件树 file-tree](#1-文件树-file-tree)
2. [代码树 code-tree](#2-代码树-code-tree)
3. [目录嵌入 @[code-tree]](#3-目录嵌入-code-tree)
4. [选项卡 tabs](#4-选项卡-tabs)
5. [代码选项卡 code-tabs](#5-代码选项卡-code-tabs)
6. [步骤 steps](#6-步骤-steps)
7. [提示容器 prompt](#7-提示容器-prompt)
8. [卡片 card](#8-卡片-card)
9. [卡片网格 card-grid](#9-卡片网格-card-grid)
10. [瀑布流 card-masonry](#10-瀑布流-card-masonry)
11. [折叠 collapse](#11-折叠-collapse)
12. [仓库卡片 repo-card](#12-仓库卡片-repo-card)
13. [链接卡片 link-card](#13-链接卡片-link-card)
14. [图片卡片 image-card](#14-图片卡片-image-card)
15. [字段 field / field-group](#15-字段-field--field-group)
16. [弹性布局 flex](#16-弹性布局-flex)
17. [窗口 window](#17-窗口-window)
18. [对话 chat](#18-对话-chat)
19. [时间线 timeline](#19-时间线-timeline)
20. [行内徽章 badge](#20-行内徽章-badge)
21. [代码块标题 title](#21-代码块标题-title)
22. [围栏代码块 file-tree](#22-围栏代码块-file-tree)

---

## 1. 文件树 `::: file-tree`

::: file-tree title="示例目录" icon="colored"
- project
  - src
    - **main.ts**
    - parser.ts
  - package.json
  - README.md
:::

---

## 2. 代码树 `::: code-tree`

::: code-tree title="迷你项目" height="280px" entry="src/main.ts"
```ts title="src/main.ts"
export function main() {
  console.log('hello')
}
```

```json title="package.json"
{ "name": "demo", "version": "0.0.1" }
```
:::

---

## 3. 目录嵌入 `@[code-tree]`

从当前库读取目录下的文本文件（需网络权限仅用于 repo-card，此项读本地库）：

@[code-tree title="插件 src" height="300px" entry="parser.ts"](../src)

---

## 4. 选项卡 `::: tabs`

::: tabs#showcase-tabs
@tab npm

```bash
npm install
```

@tab:active pnpm

```bash
pnpm install
```

@tab 说明

支持 `::: tabs#id` 或 `id="..."`，选中项可写入 localStorage（见插件设置）。
:::

---

## 5. 代码选项卡 `::: code-tabs`

::: code-tabs
@tab JavaScript
```js title="app.js"
export default { name: 'plume' }
```

@tab TypeScript
```ts title="app.ts"
export default { name: 'plume' } as const
```
:::

---

## 6. 步骤 `::: steps`

:::: steps
1. 第一步

   步骤正文，可含 `行内代码`。

2. 第二步

   ```bash
   npm run build
   ```

3. 第三步

   ::: tip
   步骤内可嵌套提示容器。
   :::
::::

---

## 7. 提示容器 prompt

::: note 备注
**note** — 可选自定义标题。
:::

::: info
**info** — 使用默认标题。
:::

::: tip 技巧
**tip** — 常用提示。
:::

::: warning
**warning** — 警告信息。
:::

::: caution 注意
**caution** — 强调风险。
:::

::: details 点击展开
**details** — 可折叠详情块。
:::

---

## 8. 卡片 `::: card`

::: card title="单张卡片" icon="star"
卡片正文，支持 **Markdown**、[链接](https://obsidian.md) 与 `代码`。
:::

---

## 9. 卡片网格 `::: card-grid`

:::: card-grid cols="3"
::: card title="A" icon="box"
网格卡片 A
:::

::: card title="B" icon="zap"
网格卡片 B
:::

::: card title="C" icon="heart"
网格卡片 C
:::
::::

---

## 10. 瀑布流 `::: card-masonry`

::: card-masonry gap="12"

```ts title="a.ts"
export const a = 1
```

```json title="b.json"
{ "ok": true }
```

```css title="c.css"
.box { padding: 8px; }
```
:::

---

## 11. 折叠 `::: collapse`

::: collapse accordion
- 面板一

  第一个折叠项正文。

- :- 面板二

  `:-` 前缀表示默认展开。

- 面板三

  较短内容。
:::

---

## 12. 仓库卡片 `::: repo-card`

需联网请求 GitHub / Gitee API：

::: repo-card repo="pengzhanbo/vuepress-theme-plume" provider="github"
:::

---

## 13. 链接卡片 `::: link-card`

::: link-card href="https://github.com/pengzhanbo/vuepress-theme-plume" title="VuePress Theme Plume" icon="github" description="上游主题仓库"
:::

---

## 14. 图片卡片 `::: image-card`

::: image-card image="https://picsum.photos/id/1015/600/400" title="示例图片" author="Picsum" date="2025-06-01" width="400" center
:::

---

## 15. 字段 `field` / `field-group`

::: field-group

::: field name="name" type="string" required
用户名称，必填。
:::

::: field name="email" type="string" optional
电子邮箱，选填。
:::

::: field name="legacy" type="string" deprecated
已废弃字段示例。
:::

:::

::: field name="port" type="number" default="5173"
独立 field，带默认值。
:::

---

## 16. 弹性布局 `::: flex`

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

## 17. 窗口 `::: window`

::: window title="终端" height="200"
```bash title="build.sh"
npm run build
```
:::

---

## 18. 对话 `::: chat`

::: chat title="示例频道"
{:2025-06-01 10:00}

{Alice}
大家好，这是 **chat** 容器示例。

{.}
收到，样式正常即可。

{Bob}
+1
:::

---

## 19. 时间线 `::: timeline`

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


---

## 20. 行内徽章 badge

`badge:tip:已完成` · `badge:info:进行中` · `badge:warning:待处理` · `badge:danger:阻塞`

（语法：反引号包裹 `` `badge:类型:文本` ``，类型与文本也可用 `|` 分隔。）

---

## 21. 代码块标题 title

在围栏 info 中写 `title="..."`：

```ts title="example.ts"
const answer = 42
```

```bash title="install.sh"
npm install obsidian-plume
```

---

## 22. 围栏代码块 file-tree

除 `::: file-tree` 外，也支持 Obsidian 原生围栏（语言标识 `file-tree` / `filetree` / `file_tree`）：

```file-tree
- vault
  - notes
    - daily.md
  - .obsidian
    - plugins
      - obsidian-plume
```

---

## 后续可补充

- 多层嵌套（Steps → Tabs → Card、Card-grid → Collapse → code-tabs 等）
- `icon="simple"` 与 `colored` 对比
- 与 Obsidian 原生列表、引用块混排时的表现

完善后可将本文件作为库内验收稿，或复制到任意笔记中使用。
