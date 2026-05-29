import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "vp-nested-"));
const out = join(dir, "parser.mjs");
await build({
  entryPoints: ["src/parser.ts"],
  bundle: false,
  format: "esm",
  outfile: out,
  platform: "node",
  loader: { ".ts": "ts" }
});

const { parseAllBlocks, parseTabsRawContent, dedentStepBody } = await import(
  pathToFileURL(out).href
);

const collapseBody = `- API 模块

  ::: code-tabs
  @tab GET
  \`\`\`http title="list.http"
  GET /api/items HTTP/1.1
  \`\`\`

  @tab POST
  \`\`\`http title="create.http"
  POST /api/items HTTP/1.1
  \`\`\`
  :::

- 数据库

  使用 SQLite / PostgreSQL 均可。`;

function parseCollapseSim(raw) {
  const lines = raw.split("\n");
  const parts = [];
  let current = null;
  const itemStart = /^(?:[-*+]\s+|\d+[.)]\s+)/;
  for (const line of lines) {
    if (itemStart.test(line)) {
      if (current) parts.push(current.join("\n"));
      current = [line.replace(itemStart, "")];
    } else if (current) {
      current.push(line.replace(/^ {1,2}/, ""));
    }
  }
  if (current) parts.push(current.join("\n"));
  return parts;
}

function buildBody(part) {
  const lines = part.split("\n");
  const blankIdx = lines.findIndex((l) => l.trim() === "");
  return blankIdx === -1 ? "" : lines.slice(blankIdx + 1).join("\n");
}

const parts = parseCollapseSim(collapseBody);
console.log("collapse list items:", parts.length);

for (let i = 0; i < parts.length; i++) {
  const body = buildBody(parts[i]);
  console.log(`\n=== item ${i} body (raw) ===`);
  console.log(body.split("\n").slice(0, 6).map((l) => JSON.stringify(l)).join("\n"));

  const dedented = dedentStepBody(body);
  console.log("=== dedented ===");
  console.log(dedented.split("\n").slice(0, 6).map((l) => JSON.stringify(l)).join("\n"));

  const blocksRaw = parseAllBlocks(body);
  const blocksDed = parseAllBlocks(dedented);
  console.log("blocks without dedent:", blocksRaw.map((b) => b.type));
  console.log("blocks with dedent:", blocksDed.map((b) => b.type));

  if (blocksDed[0]?.type === "code-tabs") {
    const tabs = parseTabsRawContent(blocksDed[0].rawContent);
    console.log("tabs:", tabs.length, tabs.map((t) => t.title));
    console.log("tab0 content lines:", tabs[0]?.content?.split("\n").length);
  }
}

const cardGridSnippet = `::: card title="后端" icon="server"
::: collapse expand
${collapseBody}
:::
:::`;

console.log("\n=== card-grid inner parse ===");
const blocks = parseAllBlocks(cardGridSnippet);
console.log(
  blocks.map((b) => `${b.type} L${b.startLine}-${b.endLine}`)
);

const full = readFileSync(new URL("../../plume-complex-test.md", import.meta.url), "utf8");
const fileBlocks = parseAllBlocks(full);
const grid = fileBlocks.find((b) => b.type === "card-grid" && b.rawContent.includes("后端"));
console.log("\n=== file card-grid block ===");
console.log("found", !!grid, grid ? `L${grid.startLine}-${grid.endLine}` : "");
if (grid) {
  const inner = parseAllBlocks(grid.rawContent);
  console.log("inner blocks:", inner.map((b) => b.type));
  const card = inner.find((b) => b.type === "card");
  if (card) {
    const cardInner = parseAllBlocks(card.rawContent);
    console.log("card inner:", cardInner.map((b) => b.type));
    const collapse = cardInner.find((b) => b.type === "collapse");
    if (collapse) {
      console.log("collapse raw first 3 lines:", collapse.rawContent.split("\n").slice(0, 3));
    }
  }
}
