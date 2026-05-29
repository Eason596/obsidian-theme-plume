import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAllBlocks, parseCollapseRawContent, parseTabsRawContent } from "./parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const complexPath = join(__dirname, "..", "..", "plume-complex-test.md");

function contentIsOnlyBlocks(
  content: string,
  blocks: ReturnType<typeof parseAllBlocks>
): boolean {
  const lines = content.split(/\r?\n/);
  const inBlock = (i: number): boolean =>
    blocks.some((b) => i >= b.startLine && i <= b.endLine);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (inBlock(i)) continue;
    return false;
  }
  return true;
}

describe("parser", () => {
  it("parses card-grid → card → collapse → code-tabs from plume-complex-test §3.2", () => {
    const complex = readFileSync(complexPath, "utf8");
    const grid = parseAllBlocks(complex).find(
      (b) => b.type === "card-grid" && b.rawContent.includes("后端")
    );
    expect(grid).toBeDefined();

    const card = parseAllBlocks(grid!.rawContent).find((b) => b.type === "card");
    expect(card).toBeDefined();

    const collapse = parseAllBlocks(card!.rawContent).find((b) => b.type === "collapse");
    expect(collapse).toBeDefined();

    const { preamble, items: collapseItems } = parseCollapseRawContent(collapse!.rawContent);
    expect(collapseItems).toHaveLength(2);
    expect(preamble.trim()).toBe("");

    const apiBody = collapseItems[0].body;
    const blocks0 = parseAllBlocks(apiBody);
    expect(blocks0).toHaveLength(1);
    expect(blocks0[0].type).toBe("code-tabs");
    expect(contentIsOnlyBlocks(apiBody, blocks0)).toBe(true);

    const tabs = parseTabsRawContent(blocks0[0].rawContent);
    expect(tabs).toHaveLength(2);
    expect(tabs[0].title).toBe("GET");
    expect(tabs[1].title).toBe("POST");
  });

  it("parses collapse title without blank line before body", () => {
    const noBlank = `- API
::: code-tabs
@tab A
\`\`\`js
1
\`\`\`
:::`;
    const nbItem = parseCollapseRawContent(noBlank).items[0];
    expect(nbItem.body).toContain("code-tabs");
  });

  it("parses ::: tabs id=\"...\" attribute form", () => {
    const md = `::: tabs id="install-tabs"
@tab npm
hi
:::`;
    const block = parseAllBlocks(md).find((b) => b.type === "tabs");
    expect(block).toBeDefined();
    expect((block!.attrs as { id?: string }).id).toBe("install-tabs");
  });

  it("parses card-grid nested card icon attrs", () => {
    const md = `:::: card-grid

::: card title="卡片标题 1" icon="smile"

content one
:::

::: card title="卡片标题 2" icon="sparkles"

content two
:::

::::`;
    const grid = parseAllBlocks(md)[0];
    expect(grid?.type).toBe("card-grid");
    const cards = parseAllBlocks(grid!.rawContent).filter((b) => b.type === "card");
    expect(cards).toHaveLength(2);
    expect((cards[0].attrs as { icon?: string }).icon).toBe("smile");
    expect((cards[1].attrs as { icon?: string }).icon).toBe("sparkles");
    expect(contentIsOnlyBlocks(grid!.rawContent, cards)).toBe(true);
  });

  it("parses collapse preamble before list items", () => {
    const withIntro = `Intro paragraph.

- Panel A
  text a
`;
    const parsedIntro = parseCollapseRawContent(withIntro);
    expect(parsedIntro.preamble).toContain("Intro");
    expect(parsedIntro.items).toHaveLength(1);
  });
});
