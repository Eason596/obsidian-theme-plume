import { parseAllBlocks, parseCodeTreeRawContent } from "../../src/parser";
import { gatherMasonryItems } from "../../src/render";
import type { BlockRenderContext } from "../../src/render/context";
import type { CodeTreeFileItem, ParsedBlock } from "../../src/types";
import { renderDemoMarkdown } from "./demo-markdown";
import {
  type CodeTreeEmbedLimits,
  resolveCodeTreeEmbedFromDisk
} from "./fs-embed";

function parseColsAttr(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function measureHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  let mt = 0;
  let mb = 0;
  if (typeof getComputedStyle === "function") {
    const style = getComputedStyle(el);
    mt = Number.parseFloat(style.marginTop) || 0;
    mb = Number.parseFloat(style.marginBottom) || 0;
  }
  return Math.ceil((rect.height || el.offsetHeight || 80) + mt + mb);
}

function layoutMasonry(wrapper: HTMLElement, items: HTMLElement[], gap: number, fixedCols?: number): void {
  wrapper.replaceChildren();
  const width = wrapper.clientWidth || 880;
  let cols = fixedCols ?? 2;
  if (!fixedCols) {
    if (width >= 960) cols = 3;
    else if (width >= 640) cols = 2;
    else cols = 1;
  }

  wrapper.style.setProperty("--vp-card-masonry-gap", `${gap}px`);
  wrapper.style.setProperty("--vp-card-masonry-cols", String(cols));
  wrapper.dataset.cols = String(cols);

  const columns: HTMLElement[] = [];
  for (let i = 0; i < cols; i += 1) {
    const col = document.createElement("div");
    col.className = "card-masonry-item";
    col.style.gap = `${gap}px`;
    columns.push(col);
    wrapper.appendChild(col);
  }

  const heights = new Array<number>(cols).fill(0);
  for (const item of items) {
    item.classList.add("vp-card-masonry-cell");
    let idx = 0;
    let min = heights[0];
    for (let k = 1; k < cols; k += 1) {
      if (heights[k] < min) {
        min = heights[k];
        idx = k;
      }
    }
    columns[idx].appendChild(item);
    heights[idx] += measureHeight(item) + gap;
  }
}

/** True when masonry already has real Plume cells (not marked `::: card` text). */
function masonryHasPlumeItems(wrapper: HTMLElement): boolean {
  if (
    wrapper.querySelector(
      ".card-masonry-item .vp-card-wrapper, .card-masonry-item .vp-image-card, .card-masonry-item .vp-code-block-title"
    )
  ) {
    return true;
  }
  const loose = wrapper.querySelector(":scope > .vp-card-wrapper, :scope > .vp-image-card");
  if (loose) {
    return true;
  }
  const bad = wrapper.querySelector("p.vp-card-masonry-cell");
  return !bad && Boolean(wrapper.querySelector(".card-masonry-item pre code"));
}

async function resolveCodeTreeFiles(
  block: ParsedBlock,
  repoRoot: string,
  sourcePath: string,
  embedLimits?: CodeTreeEmbedLimits
): Promise<CodeTreeFileItem[]> {
  if (block.type === "code-tree") {
    return parseCodeTreeRawContent(block.rawContent);
  }
  if (block.type === "code-tree-embed") {
    const dirPath = (block.attrs as { dirPath?: string }).dirPath ?? "";
    return (
      (await resolveCodeTreeEmbedFromDisk(repoRoot, sourcePath, dirPath, embedLimits)) ?? []
    );
  }
  return [];
}

const DEMO_TEMPLATE_MAX_CHARS = 32_000;

export async function enrichDemoPage(
  container: HTMLElement,
  markdown: string,
  repoRoot: string,
  sourcePath: string,
  embedLimits?: CodeTreeEmbedLimits,
  ctx?: BlockRenderContext
): Promise<void> {
  const blocks = parseAllBlocks(markdown, "colored");
  const codeTreeBlocks = blocks.filter(
    (b) => b.type === "code-tree" || b.type === "code-tree-embed"
  );
  const trees = Array.from(container.querySelectorAll<HTMLElement>(".obsidian-vuepress-code-tree"));

  for (let i = 0; i < codeTreeBlocks.length; i += 1) {
    const block = codeTreeBlocks[i];
    const tree = trees[i];
    if (!tree) {
      continue;
    }

    const files = await resolveCodeTreeFiles(block, repoRoot, sourcePath, embedLimits);
    if (files.length === 0) {
      continue;
    }

    tree.querySelector(".demo-code-tree-templates")?.remove();
    const templates = document.createElement("div");
    templates.className = "demo-code-tree-templates";
    templates.hidden = true;

    for (const file of files) {
      const tpl = document.createElement("div");
      tpl.className = "demo-code-tree-template";
      tpl.dataset.path = file.filepath;
      const body =
        file.content.length > DEMO_TEMPLATE_MAX_CHARS
          ? `${file.content.slice(0, DEMO_TEMPLATE_MAX_CHARS)}\n\n… (demo build 截断)`
          : file.content;
      await renderDemoMarkdown(
        tpl,
        `\`\`\`${file.language || "text"}\n${body}\n\`\`\``
      );
      templates.appendChild(tpl);
    }

    tree.appendChild(templates);
  }

  if (!ctx) {
    return;
  }

  const masonryBlocks = blocks.filter((b) => b.type === "card-masonry");
  const masonryEls = Array.from(container.querySelectorAll<HTMLElement>(".vp-card-masonry"));

  for (let i = 0; i < masonryBlocks.length; i += 1) {
    const block = masonryBlocks[i];
    const wrapper = masonryEls[i];
    if (!wrapper) {
      continue;
    }

    if (masonryHasPlumeItems(wrapper)) {
      continue;
    }

    const gap = Number.parseInt((block.attrs as { gap?: string }).gap ?? "16", 10) || 16;
    const cols = parseColsAttr((block.attrs as { cols?: string }).cols);
    const items = await gatherMasonryItems(block.rawContent, ctx);
    if (items.length === 0) {
      continue;
    }

    wrapper.style.width = "880px";
    layoutMasonry(wrapper, items, gap, cols);
    wrapper.style.width = "";
  }
}
