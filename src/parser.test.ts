import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAllBlocks, parseCollapseRawContent, parseTabsRawContent } from "./parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const complexPath = join(__dirname, "__fixtures__", "plume-complex-test.md");

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
      (b) => b.type === "card-grid" && b.rawContent.includes("Backend")
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

  it("parses Plume containers opened with four or more colons", () => {
    const md = `:::: file-tree title="Tree"
- docs/
::::

:::: code-tree title="Code" entry="src/main.ts"
\`\`\`ts title="src/main.ts"
export const ok = true
\`\`\`
::::

:::: tabs#pm
@tab npm
npm install
::::

:::: code-tabs#api
@tab GET
\`\`\`ts
fetch("/api")
\`\`\`
::::`;

    const blocks = parseAllBlocks(md);
    expect(blocks.map((b) => b.type)).toEqual([
      "file-tree",
      "code-tree",
      "tabs",
      "code-tabs"
    ]);
    expect(blocks.map((b) => b.markerLen)).toEqual([4, 4, 4, 4]);
    expect((blocks[0].attrs as { title?: string }).title).toBe("Tree");
    expect((blocks[1].attrs as { title?: string }).title).toBe("Code");
    expect((blocks[2].attrs as { id?: string }).id).toBe("pm");
    expect((blocks[3].attrs as { id?: string }).id).toBe("api");
  });

  it("keeps shorter nested container fences inside a longer outer container", () => {
    const md = `::::: card-grid cols="2"
::: card title="A"
body
:::

::: card title="B"
body
:::
:::::`;

    const grid = parseAllBlocks(md)[0];
    expect(grid?.type).toBe("card-grid");
    expect(grid.markerLen).toBe(5);

    const cards = parseAllBlocks(grid.rawContent).filter((b) => b.type === "card");
    expect(cards).toHaveLength(2);
    expect(contentIsOnlyBlocks(grid.rawContent, cards)).toBe(true);
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

  it("parses Vue component card grid syntax", () => {
    const md = `<CardGrid cols="2">
  <Card title="One" icon="smile">
    Card body.
  </Card>
  <RepoCard repo="vuepress/core" fullname />
</CardGrid>`;
    const grid = parseAllBlocks(md)[0];
    expect(grid?.type).toBe("card-grid");
    expect((grid!.attrs as { cols?: string }).cols).toBe("2");

    const children = parseAllBlocks(grid!.rawContent);
    expect(children.map((b) => b.type)).toEqual(["card", "repo-card"]);
    expect((children[0].attrs as { title?: string }).title).toBe("One");
    expect((children[1].attrs as { repo?: string; fullname?: boolean }).repo).toBe("vuepress/core");
    expect((children[1].attrs as { fullname?: boolean }).fullname).toBe(true);
  });

  it("parses Vue LinkCard body closed on the same line", () => {
    const md = `<LinkCard title="Docs" href="https://example.com">
  **Rich** description</LinkCard>`;
    const block = parseAllBlocks(md)[0];
    expect(block?.type).toBe("link-card");
    expect(block.rawContent).toBe("  **Rich** description");
  });
});
