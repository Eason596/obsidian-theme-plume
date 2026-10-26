---
title: 嵌套组件
cssclasses:
  - plume
---

# 嵌套组件

外层用更长的围栏，内层容器、多行卡片和代码围栏都留在各自的正文里。代码围栏中的 `@tab` 不会拆出新选项卡。

:::: card-grid

::: card title="选项卡与提示" icon="layout-grid"

卡片正文和页面正文使用同一套字号与颜色。

::: tabs
@tab 说明

下面的提示里有一段代码。

::: tip 注意
围栏里的标记仍是源码。

```ts
const marker = "@tab 假的";
```

:::

@tab 列项

- 第一项
- 第二项

:::

:::

::: card title="折叠、步骤与图片" icon="list"

::: collapse
- 展开后是步骤

  ::: steps
  1. 第一步

     步骤正文里的 `code`。

  2. 第二步

     结束。
  :::

:::

多行图片卡片：

<ImageCard
  image="/images/demo.png"
  title="嵌套图片"
/>

:::

::::
