---
title: Obsidian Plume component examples
description: Container syntax acceptance draft aligned with upstream Plume examples — check each item in Reading view
---

# Obsidian Plume component examples

> [中文](./plume-components.md) | **English**

Open this page in Obsidian **Reading view** with the **Obsidian Plume** plugin enabled. Content aligns with [`示例.md`](../../示例.md) at the repo root, with path and icon notes adapted for Obsidian.

> **Where is the source?** This file is the Markdown source. The online preview site shows a **Markdown source** panel above each section; in Obsidian, switch to **Edit mode** to view `:::` fence blocks.

> **Paths**: This file lives under `examples/`. `@[code-tree]` uses `..` to point at the plugin root; change other vault paths to match your folder names.

---

## Table of contents

> **Obsidian**: The list below is clickable. **GitHub Pages preview** uses a fixed sidebar TOC on the left.

- [Prompt containers](#1-提示容器-prompt)
- [Steps](#2-步骤--steps)
- [File tree](#3-文件树--file-tree)
- [Code tree](#4-代码树--code-tree)
- [Directory embed @[code-tree]](#5-目录嵌入-code-tree)
- [Field / field-group](#6-字段-field--field-group)
- [Tabs](#7-选项卡--tabs)
- [Code tabs](#8-代码选项卡--code-tabs)
- [Timeline](#9-时间线--timeline)
- [Flex layout](#10-弹性布局--flex)
- [Align](#10b-对齐--align)
- [Collapse](#11-折叠--collapse)
- [Chat](#12-对话--chat)
- [Code block title](#13-代码块标题-title)
- [Inline badge](#14-行内徽章-badge)
- [Card / card-grid](#15-卡片--card)
- [Link card](#16-链接卡片--link-card)
- [Image card](#17-图片卡片--image-card)
- [Masonry card-masonry](#18-瀑布流--card-masonry)
- [Repo card](#19-仓库卡片--repo-card)
- [Window](#20-窗口--window)
- [Table](#21-表格--table)
- [npm-to](#22-npm-to)
- [QR code qrcode](#23-二维码--qrcode)
- [PDF / video embeds](#24-pdf--bilibili--youtube)
- [External link favicon](#25-外链-favicon)

---

<a id="1-提示容器-prompt"></a>
## 1. Prompt containers

### Default title styles

::: note
This is a note box
:::

::: info
This is an info box
:::

::: tip
This is a tip box
:::

::: warning
This is a warning box
:::

::: caution
This is a caution box
:::

::: danger
`danger` is in the same family as `caution` (aligned with VuePress Plume)
:::

::: important
This is important information
:::

::: details
This is a details collapsible box
:::

### Custom titles

::: caution STOP
Danger zone — do not proceed
:::

::: details Click to view code
```js
console.log('Hello, VitePress!')
```
:::

::: details Expanded by default {open}
When using `{open}`, the block is expanded by default (aligned with VuePress).
:::

### GitHub Alerts

> [!NOTE]
> Same GitHub Alert syntax as VuePress; Reading view applies Plume prompt box styling.

> [!TIP]
> Helpful advice.

> [!IMPORTANT]
> Key information the user should know.

> [!WARNING]
> Content that needs immediate attention.

> [!CAUTION]
> Risk or negative consequence warning.

---

<a id="2-步骤--steps"></a>
## 2. Steps `::: steps`

:::: steps
1. Step 1

   ```ts
   console.log('Hello World!')
   ```

2. Step 2

   Related content for step 2

3. Step 3

   ::: tip
   Prompt container
   :::

4. Done
::::

---

<a id="3-文件树--file-tree"></a>
## 3. File tree `::: file-tree`

::: file-tree

- docs
  - .vuepress
    - ++ config.ts
  - -- page1.md
  - README.md
- theme  # A **theme** directory
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

> `++` / `--` mean focus / fade; `…` is an ellipsis node. Optional `icon="colored"` / `icon="simple"`.

---

<a id="4-代码树--code-tree"></a>
## 4. Code tree `::: code-tree`

### code-tree container

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
## 5. Directory embed `@[code-tree]`

### Simple config

@[code-tree](../src)

### With options

@[code-tree title="Plugin source" height="800px" entry="parser.ts](../src)

> Paths are relative to this file; `build:demo` skips oversized files and items like `main.js` to avoid exhausting memory during static site builds.

---

<a id="6-字段-field--field-group"></a>
## 6. Field `field` / `field-group`

Aligned with VuePress: position name + `@tag` syntax (recommended); legacy attribute syntax still works.

:::: field-group

::: field theme
@type ThemeConfig
@default { base: '/' }
@required

Theme configuration
:::

::: field enabled
@type boolean
@default true
@optional

Whether enabled
:::

::: field callback
@type (...args: any[]) => void
@default () => {}
@optional

Added in v1.0.0
Callback function
:::

::: field other
@type string
@deprecated

Deprecated in v0.9.0
Deprecated property
:::

::::

---

<a id="7-选项卡--tabs"></a>
## 7. Tabs `::: tabs`

::: tabs
@tab npm

npm should be installed together with Node.js.

@tab pnpm

```sh
corepack enable
corepack use pnpm@8
```

:::

> Supports `::: tabs#id` / `id="..."` and localStorage to remember the selected tab (see plugin settings).

---

<a id="8-代码选项卡--code-tabs"></a>
## 8. Code tabs `::: code-tabs`

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
## 9. Timeline `::: timeline`

::: timeline
- Node one
  time=2025-03-20 type=success

  Body content

- Node two
  time=2025-02-21 type=warning

  Body content

- Node three
  time=2025-01-22 type=danger

  Body content
:::

::: timeline horizontal
- Node one
  time=2025-03-20

  Body content

- Node two
  time=2025-04-20 type=success

  Body content

- Node three
  time=2025-01-22 type=danger

  Body content

- Node four
  time=2025-01-22 type=important

  Body content
:::

::: timeline placement="right"
- Node one
  time=2025-03-20

  Body content

- Node two
  time=2025-04-20 type=success

  Body content

- Node three
  time=2025-01-22 type=danger

  Body content

- Node four
  time=2025-01-22 type=important

  Body content
:::

::: timeline placement="between"
- Node one
  time=2025-03-20 placement=right

  Body content

- Node two
  time=2025-04-20 type=success

  Body content

- Node three
  time=2025-01-22 type=danger placement=right

  Body content

- Node four
  time=2025-01-22 type=important

  Body content
:::

::: timeline line="dotted"
- Node one
  time=2025-03-20

  Body content

- Node two
  time=2025-04-20 type=success

  Body content

- Node three
  time=2025-01-22 type=danger line=dashed

  Body content

- Node four
  time=2025-01-22 type=important line=solid

  Body content
:::

---

<a id="10-弹性布局--flex"></a>
## 10. Flex layout `::: flex`

::: flex between center

| Col 1 | Col 2 | Col 3 |
| ---- | ---- | ---- |
| 1    | 2    | 3    |
| 4    | 5    | 6    |

| Col 1 | Col 2 | Col 3 |
| ---- | ---- | ---- |
| 1    | 2    | 3    |
| 4    | 5    | 6    |

:::

---

<a id="10b-对齐--align"></a>
## 10b. Align `::: left` / `center` / `right` / `justify`

::: left
Left-aligned text
:::

::: center
Centered text
:::

::: right
Right-aligned text
:::

::: justify
Justified text. With longer content, lines are distributed for full justification, matching VuePress Plume's `::: justify`.
:::

---

<a id="11-折叠--collapse"></a>
## 11. Collapse `::: collapse`

::: collapse expand
- :+ Title 1

  Body content

- :- Title 2

  Body content

- Title 3

  Body content
:::

> `:+` prefix means expanded by default; `:-` means collapsed by default; `accordion` attribute enables accordion mode.

---

<a id="12-对话--chat"></a>
## 12. Chat `::: chat`

::: chat title="Title"
{:2025-03-24 10:15:00}

{User One}
Message from User One

{.}
My message

{User Two}
Message from User Two

{.}
My message
:::

---

<a id="13-代码块标题-title"></a>
## 13. Code block title

Write `title="..."` in the fence info string:

```py title="test.py"
import numpy as np
```

```ts title="example.ts"
const answer = 42
```

---

<a id="14-行内徽章-badge"></a>
## 14. Inline badge

Aligned with VuePress — use HTML `<Badge>`:
- VuePress - <Badge type="info" text="v2" />
- VuePress - <Badge type="tip" text="v2" />
- VuePress - <Badge type="warning" text="v2" />
- VuePress - <Badge type="danger" text="v2" />
- VuePress - <Badge text="v2" color="#8e5cd9" bg-color="rgba(159, 122, 234, 0.16)" />


 <a id="15-卡片--card"></a>
## 15. Card `::: card` / `card-grid`

> **`icon`**: Lucide name (e.g. `smile`), image URL, or Iconify `collection:name` (including `twemoji:astonished-face`; online Iconify / offline pack).

### Single card

::: card title="Title" icon="smile"

Card content goes here.
:::

### Multiple cards

:::: card-grid

::: card title="Card title 1" icon="smile"

Card content goes here.
:::

::: card title="Card title 2" icon="sparkles"

Card content goes here.
:::

::::

---

<a id="16-链接卡片--link-card"></a>
## 16. Link card `::: link-card`

::: link-card href="https://obsidian.md" title="Obsidian" icon="external-link" description="The Swiss Army knife of personal knowledge bases"
:::

`href` can also be a bare positional argument:

::: link-card https://github.com title="GitHub" icon="github"
:::

`description` in the body (Markdown supported) has lower priority than the `description=` attribute:

::: link-card href="我的笔记" title="Jump to note" icon="file-text"
This is a **multi-line** description; you can write markdown.
:::

---

<a id="17-图片卡片--image-card"></a>
## 17. Image card `::: image-card`

::: image-card image="https://picsum.photos/id/1015/600/400" title="Starry sky" author="John" date="2025-06-01" width="600" center
:::

---

<a id="18-瀑布流--card-masonry"></a>
## 18. Masonry `::: card-masonry`

### Card masonry

:::: card-masonry

::: card title="Card 1"
Card content
:::

::: card title="Card 2"
Card content

Card content
:::

::: card title="Card 3"
Card content
:::

::: card title="Card 4"
Card content
:::

::: card title="Card 5"
Card content

Card content
:::

::: card title="Card 6"
Card content
:::

::::

### Code block masonry

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

### Image masonry

::: card-masonry cols=3
::: image-card image="https://picsum.photos/id/1015/600/400" title="Mountain stream" author="Unsplash" date="2024-03-12"
In the valley at dawn, water trickles from between the rocks, carrying a cold mist.
:::

::: image-card image="https://picsum.photos/id/1025/600/700" title="Thoughtful monkey" author="Picsum" date="2023-11-04"
:::

::: image-card image="https://picsum.photos/id/1043/600/500" title="Bridge in morning fog" author="Anonymous" date="2024-01-20" href="https://picsum.photos/id/1043"
Mist rolls over the old bridge; distant lights still glow.
:::

::: image-card image="https://picsum.photos/id/1059/600/800" title="Forest path" author="Unsplash"
Fallen leaves cover the whole path with no end in sight.
:::

::: image-card image="https://picsum.photos/id/106/600/400" title="Flower field" date="2024-05-08"
:::

::: image-card image="https://picsum.photos/id/1074/600/600" title="Snow plain" author="Photographer" date="2025-12-25"
Snow in the far north — so quiet you can hear your own breath.
:::

::: image-card image="https://picsum.photos/id/110/600/900" title="Canyon overlook" author="John Doe" date="2024-08-15"
Standing at the cliff edge, the wind carries every sound away.
:::

::: image-card image="https://picsum.photos/id/1084/600/450" title="Coast at dusk"
:::

::: image-card image="https://picsum.photos/id/1080/600/600" title="Cherries" author="Studio" date="2025-04-01" href="https://picsum.photos"
A few cherries on the plate, bright red.
:::

:::

---

<a id="19-仓库卡片--repo-card"></a>
## 19. Repo card `::: repo-card`

Requires network access to GitHub / Gitee API (not in `示例.md`; Obsidian extension):

::: repo-card repo="pengzhanbo/vuepress-theme-plume" provider="github"
:::

---

<a id="20-窗口--window"></a>
## 20. Window `::: window`

::: window title="Terminal" height="200"

```bash title="build.sh"
npm run build
```
:::

---

<a id="21-表格--table"></a>
## 21. Table `::: table`

Copy button in the top-right (Copy HTML / Copy Markdown). Use `copy="false"` if not needed.

::: table title="Basic table" align="center" copy="all"

| Name | Version | Description |
| ---- | ---- | ---- |
| Theme Plume | 1.1.0 | Obsidian plugin |
| VuePress Plume | — | Upstream theme |

:::

::: table title="Highlight" max-content hl-rows="tip:1" hl-cols="warning:2"

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
## 23. QR code `@[qrcode]` / `::: qrcode`

@[qrcode align="center" title="Obsidian"](https://obsidian.md)

@[qrcode card title="Cursor"](https://cursor.com/cn)

::: qrcode card title="Short text"
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
## 25. External link favicon

In note frontmatter (wrap with a pair of `---` at the top of the file):

```yaml
---
link-icons: true
link-icon-size: 16
---
```

When enabled, http(s) external links on this page show site favicons (network required). See `Theme-Plume-更新验收.md` in the vault for examples.

