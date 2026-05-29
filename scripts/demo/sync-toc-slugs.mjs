import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const path = join(root, "examples", "plume-components.md");
const slugger = new GithubSlugger();
const lines = readFileSync(path, "utf8").split(/\r?\n/);

const sections = [];
for (const line of lines) {
  const m = line.match(/^## (\d+\.\s+.+)$/);
  if (!m) continue;
  const plain = m[1].replace(/`([^`]+)`/g, "$1").trim();
  sections.push({ label: plain, id: slugger.slug(plain) });
}

const tocStart = lines.findIndex((l) => l.trim() === "## 目录");
const tocEnd = lines.findIndex((l, i) => i > tocStart && l.trim() === "---");
if (tocStart < 0 || tocEnd < 0) {
  throw new Error("TOC section not found");
}

const tocLines = [
  "## 目录",
  "",
  "> 使用无序列表，避免 `1. […](#1-…)` 被解析成错误锚点。各节标题前已插入与下表一致的 `<a id>` 锚点。",
  "",
  ...sections.map((s) => {
    const short = s.label.replace(/^\d+\.\s+/, "");
    const name = short.split(/`|\s/)[0].length > 20 ? short.slice(0, 40) : short;
    return `- [${short}](#${s.id})`;
  }),
  ""
];

const displayNames = [
  "文件树 file-tree",
  "代码树 code-tree",
  "目录嵌入 @[code-tree]",
  "选项卡 tabs",
  "代码选项卡 code-tabs",
  "步骤 steps",
  "提示容器 prompt",
  "卡片 card",
  "卡片网格 card-grid",
  "瀑布流 card-masonry",
  "折叠 collapse",
  "仓库卡片 repo-card",
  "链接卡片 link-card",
  "图片卡片 image-card",
  "字段 field / field-group",
  "弹性布局 flex",
  "窗口 window",
  "对话 chat",
  "时间线 timeline",
  "行内徽章 badge",
  "代码块标题 title",
  "围栏代码块 file-tree"
];

const newToc = [
  "## 目录",
  "",
  "> 使用无序列表，避免 `1. […](#1-…)` 被解析成错误锚点。各节标题前已插入与下表一致的 `<a id>` 锚点。",
  "",
  ...sections.map((s, i) => `- [${displayNames[i]}](#${s.id})`),
  ""
];

const out = [...lines.slice(0, tocStart), ...newToc, ...lines.slice(tocEnd)];
writeFileSync(path, out.join("\n"), "utf8");
console.log(sections.map((s) => s.id).join("\n"));
