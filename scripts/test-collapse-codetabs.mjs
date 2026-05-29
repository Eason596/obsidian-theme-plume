import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "vp-ct-"));
const out = join(dir, "parser.mjs");
await build({
  entryPoints: ["src/parser.ts"],
  bundle: false,
  format: "esm",
  outfile: out,
  platform: "node",
  loader: { ".ts": "ts" }
});

const { parseAllBlocks, dedentStepBody } = await import(pathToFileURL(out).href);

function contentIsOnlyBlocksAndBlankLines(content, blocks) {
  if (blocks.length === 0) return false;
  const lines = content.split(/\r?\n/);
  const inBlock = (line) => blocks.some((b) => line >= b.startLine && line <= b.endLine);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (inBlock(i)) continue;
    return false;
  }
  return true;
}

function parseCollapseSim(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const items = [];
  let current = null;
  const itemStart = /^(?:[-*+]\s+|\d+[.)]\s+)/;
  for (const line of lines) {
    if (itemStart.test(line)) {
      if (current) items.push(current);
      current = [line.replace(itemStart, "")];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) items.push(current);

  const buildItem = (rawLines) => {
    while (rawLines.length && rawLines[0].trim() === "") rawLines.shift();
    while (rawLines.length && rawLines[rawLines.length - 1].trim() === "") rawLines.pop();
    const blankIdx = rawLines.findIndex((l) => l.trim() === "");
    const bodyRaw = blankIdx === -1 ? "" : rawLines.slice(blankIdx + 1).join("\n");
    return dedentStepBody(bodyRaw);
  };

  const filtered = items
    .map(buildItem)
    .filter((body) => body.trim());
  if (filtered.length) return filtered;
  const t = raw.replace(/^\n+|\n+$/g, "");
  return t ? [dedentStepBody(t)] : [];
}

const full = readFileSync(new URL("../../plume-complex-test.md", import.meta.url), "utf8");
const grid = parseAllBlocks(full).find((b) => b.type === "card-grid" && b.rawContent.includes("后端"));
const card = parseAllBlocks(grid.rawContent).find((b) => b.type === "card");
const collapse = parseAllBlocks(card.rawContent).find((b) => b.type === "collapse");

console.log("collapse raw lines:", collapse.rawContent.split("\n").length);
const bodies = parseCollapseSim(collapse.rawContent);
console.log("collapse items:", bodies.length);

for (let i = 0; i < bodies.length; i++) {
  const body = bodies[i];
  const blocks = parseAllBlocks(body);
  const only = contentIsOnlyBlocksAndBlankLines(body, blocks);
  console.log(`\nitem ${i}: onlyBlocks=${only} types=${blocks.map((b) => b.type).join(",")}`);
  console.log("first lines:", body.split("\n").slice(0, 4).map((l) => JSON.stringify(l)).join("\n"));
  if (blocks[0]?.type === "code-tabs") {
    const { parseTabsRawContent } = await import(pathToFileURL(out).href);
    const tabs = parseTabsRawContent(blocks[0].rawContent);
    console.log("tabs:", tabs.length, tabs.map((t) => [t.title, t.content.split("\n")[0]]));
  }
}

// no blank line after title
const noBlank = `- API 模块
::: code-tabs
@tab GET
\`\`\`js
1
\`\`\`
:::`;
console.log("\n=== no blank after title ===");
console.log("bodies:", parseCollapseSim(noBlank).map((b) => JSON.stringify(b.split("\n")[0])));
