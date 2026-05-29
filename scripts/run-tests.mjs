/**
 * Parser-level regression tests (no Obsidian runtime required).
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const dir = mkdtempSync(join(tmpdir(), "plume-test-"));
const out = join(dir, "parser.mjs");
await build({
  entryPoints: [join(root, "src/parser.ts")],
  bundle: false,
  format: "esm",
  outfile: out,
  platform: "node",
  loader: { ".ts": "ts" }
});

const { parseAllBlocks, parseTabsRawContent, parseCollapseRawContent } = await import(
  pathToFileURL(out).href
);

function contentIsOnlyBlocks(content, blocks) {
  const lines = content.split(/\r?\n/);
  const inBlock = (i) => blocks.some((b) => i >= b.startLine && i <= b.endLine);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (inBlock(i)) continue;
    return false;
  }
  return true;
}


// --- card-grid → card → collapse → code-tabs (from plume-complex-test §3.2) ---
const complexPath = join(root, "..", "plume-complex-test.md");
const complex = readFileSync(complexPath, "utf8");
const grid = parseAllBlocks(complex).find(
  (b) => b.type === "card-grid" && b.rawContent.includes("后端")
);
assert.ok(grid, "card-grid block in plume-complex-test.md");

const card = parseAllBlocks(grid.rawContent).find((b) => b.type === "card");
assert.ok(card, "card inside card-grid");

const collapse = parseAllBlocks(card.rawContent).find((b) => b.type === "collapse");
assert.ok(collapse, "collapse inside card");

const { preamble, items: collapseItems } = parseCollapseRawContent(collapse.rawContent);
assert.equal(collapseItems.length, 2, "two collapse panels");
assert.equal(preamble.trim(), "", "no preamble in §3.2 fixture");

const apiBody = collapseItems[0].body;
const blocks0 = parseAllBlocks(apiBody);
assert.equal(blocks0.length, 1, "API panel is single code-tabs block");
assert.equal(blocks0[0].type, "code-tabs");
assert.ok(contentIsOnlyBlocks(apiBody, blocks0));

const tabs = parseTabsRawContent(blocks0[0].rawContent);
assert.equal(tabs.length, 2);
assert.equal(tabs[0].title, "GET");
assert.equal(tabs[1].title, "POST");

// --- title without blank line before body ---
const noBlank = `- API
::: code-tabs
@tab A
\`\`\`js
1
\`\`\`
:::`;
const nbItem = parseCollapseRawContent(noBlank).items[0];
assert.ok(nbItem.body.includes("code-tabs"), "dedented body includes code-tabs");

// --- preamble before list ---
const withIntro = `Intro paragraph.

- Panel A
  text a
`;
const parsedIntro = parseCollapseRawContent(withIntro);
assert.ok(parsedIntro.preamble.includes("Intro"));
assert.equal(parsedIntro.items.length, 1);

// --- nested card-grid only cards ---
const inner = parseAllBlocks(grid.rawContent);
assert.equal(
  inner.filter((b) => b.type === "card").length,
  2,
  "two cards in grid"
);

console.log("All parser tests passed.");
