---
title: 对齐基线
cssclasses:
  - plume
---

# 对齐基线

一段中英文混排的正文，包含 `inline code` 和一个 [链接](https://example.com)。水是 H~2~O，平方是 x^2^，高亮是 ==关键词==。说明见脚注[^note]。术语见 [+api]。HTML 是标记语言。

[^note]: 脚注和上下标与 VuePress 使用同一写法。

[+api]: 应用程序接口

*[HTML]: 超文本标记语言

长链接不应撑破正文：https://example.com/this-is-a-very-long-path/that-should-wrap-inside-the-note

## 列表与引用

> 引用里的一句话。

- 第一项
- 第二项
  - 嵌套项

- [ ] 未完成任务
- [x] 已完成任务

## 表格与代码

| 列 | 说明 |
| --- | --- |
| A | 单元格 |

```ts
export const answer = 42;
```

不满 10 行的代码块不显示行号。满 10 行时默认显示，`:no-line-numbers` 可以关掉。

```ts
const line1 = 1;
const line2 = 2;
const line3 = 3;
const line4 = 4;
const line5 = 5;
const line6 = 6;
const line7 = 7;
const line8 = 8;
const line9 = 9;
const line10 = 10;
```

```ts:no-line-numbers
const line1 = 1;
const line2 = 2;
const line3 = 3;
const line4 = 4;
const line5 = 5;
const line6 = 6;
const line7 = 7;
const line8 = 8;
const line9 = 9;
const line10 = 10;
```

`npm-to` 未写 `tabs` 时，顺序是 pnpm、yarn、npm。

::: npm-to
```sh
npm install -D vue
```
:::

## 卡片

普通图片使用相对路径，附件和笔记在同一棵目录里：

![演示图片](../images/demo.png)

图片卡片使用网站公共路径。Obsidian 只接受库根目录上的同名文件，找不到时显示缺失说明，而不是改连到别的同名附件。

<ImageCard
  image="/images/demo.png"
  title="示例"
  description="一条公共路径映射。"
/>

下面这段是源码示例，不应渲染成卡片：

```md
<ImageCard
  image="/images/demo.png"
  title="不会渲染"
/>
```
