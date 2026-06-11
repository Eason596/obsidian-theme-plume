import { parseAllBlocks, dedentStepBody } from "../parser";
import { renderPlumeMarkdown } from "../markdown/plume-markdown";
import type { ParsedBlock } from "../types";
import { invokeBlockRenderer } from "./block-registry";
import {
  decorateCodeBlockTitles,
  decorateSubtreeCodeFences,
  scanCodeFenceTitles
} from "./code-fence";
import {
  type BlockRenderContext,
  toPlumeMarkdownContext
} from "./context";

export const BLOCK_PLACEHOLDER_CLASS = "vp-block-placeholder";
export const BLOCK_PLACEHOLDER_ATTR = "data-vp-block-id";

export function contentIsOnlyBlocksAndBlankLines(
  content: string,
  blocks: ParsedBlock[]
): boolean {
  if (blocks.length === 0) {
    return false;
  }
  const lines = content.split(/\r?\n/);
  const inBlock = (line: number): boolean =>
    blocks.some((b) => line >= b.startLine && line <= b.endLine);

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) {
      continue;
    }
    if (inBlock(i)) {
      continue;
    }
    return false;
  }
  return true;
}

export function pruneEmptyMarkdownNodes(root: HTMLElement): void {
  for (const p of Array.from(root.querySelectorAll("p"))) {
    if (p.closest(".vp-card-wrapper, .vp-file-tree, .vp-card-masonry, .vp-card-grid")) {
      continue;
    }
    const text = p.textContent?.replace(/\u00a0/g, "").trim() ?? "";
    if (text) {
      continue;
    }
    if (p.querySelector("img, pre, code, table, ul, ol, blockquote, .vp-block-placeholder")) {
      continue;
    }
    p.remove();
  }
}

export async function renderPlumeBlocksInto(
  container: HTMLElement,
  blocks: ParsedBlock[],
  ctx: BlockRenderContext
): Promise<void> {
  for (const block of blocks) {
    const host = document.createElement("div");
    // Must be in the document before render: Obsidian setIcon() only paints on connected nodes.
    container.appendChild(host);
    try {
      await invokeBlockRenderer(host, block, ctx);
    } catch (err) {
      console.error("[theme-plume] block render failed", err);
      host.textContent = block.rawContent;
    }
    while (host.firstChild) {
      container.insertBefore(host.firstChild, host);
    }
    host.remove();
  }
}

async function renderMarkdownInto(
  container: HTMLElement,
  markdown: string,
  ctx: BlockRenderContext
): Promise<void> {
  if (ctx.renderMarkdown) {
    await ctx.renderMarkdown(container, markdown);
    return;
  }
  await renderPlumeMarkdown(container, markdown, toPlumeMarkdownContext(ctx));
}

export async function renderNestedMarkdownContent(
  container: HTMLElement,
  markdown: string,
  ctx: BlockRenderContext,
  options?: { dedent?: boolean }
): Promise<void> {
  let content = markdown.replace(/^\n+|\n+$/g, "");
  if (!content) {
    return;
  }
  if (options?.dedent) {
    content = dedentStepBody(content);
  }

  const blocks = parseAllBlocks(content, ctx.defaultIconMode);
  if (blocks.length === 1) {
    await invokeBlockRenderer(container, blocks[0], ctx);
    pruneEmptyMarkdownNodes(container);
    decorateSubtreeCodeFences(container, content, ctx.defaultIconMode);
    return;
  }
  if (blocks.length > 0 && contentIsOnlyBlocksAndBlankLines(content, blocks)) {
    await renderPlumeBlocksInto(container, blocks, ctx);
    pruneEmptyMarkdownNodes(container);
    return;
  }

  await renderInnerMarkdown(container, content, ctx);
}

export async function renderInnerMarkdown(
  container: HTMLElement,
  markdown: string,
  ctx: BlockRenderContext
): Promise<void> {
  const source = markdown.replace(/^\n+|\n+$/g, "");
  if (!source) {
    return;
  }

  const blocks = parseAllBlocks(source, ctx.defaultIconMode);

  if (blocks.length === 0) {
    await renderMarkdownInto(container, markdown, ctx);
    decorateCodeBlockTitles(container, scanCodeFenceTitles(markdown), ctx.defaultIconMode);
    pruneEmptyMarkdownNodes(container);
    return;
  }

  const lines = source.split(/\r?\n/);
  const placeholderById = new Map<string, ParsedBlock>();
  const out: string[] = [];
  let cursor = 0;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    for (let k = cursor; k < block.startLine; k += 1) {
      out.push(lines[k]);
    }
    const opener = lines[block.startLine] ?? "";
    const indentMatch = opener.match(/^[\t ]*/);
    const indent = indentMatch?.[0] ?? "";
    const id = `vp-blk-${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
    placeholderById.set(id, block);
    if (out.length > 0 && out[out.length - 1].trim() !== "") {
      out.push("");
    }
    out.push(
      `${indent}<div class="${BLOCK_PLACEHOLDER_CLASS}" ${BLOCK_PLACEHOLDER_ATTR}="${id}"></div>`
    );
    cursor = block.endLine + 1;
    if (cursor < lines.length && lines[cursor].trim() === "") {
      out.push("");
      cursor += 1;
    }
  }

  for (let k = cursor; k < lines.length; k += 1) {
    out.push(lines[k]);
  }

  container.empty();
  const renderedMarkdown = out.join("\n");
  await renderMarkdownInto(container, renderedMarkdown, ctx);
  decorateCodeBlockTitles(container, scanCodeFenceTitles(renderedMarkdown), ctx.defaultIconMode);

  const placeholders = Array.from(
    container.querySelectorAll(`.${BLOCK_PLACEHOLDER_CLASS}[${BLOCK_PLACEHOLDER_ATTR}]`)
  );

  for (const node of placeholders) {
    if (!(node instanceof HTMLElement)) continue;
    const id = node.getAttribute(BLOCK_PLACEHOLDER_ATTR);
    if (!id) continue;
    const block = placeholderById.get(id);
    if (!block) continue;

    node.removeAttribute(BLOCK_PLACEHOLDER_ATTR);
    node.classList.remove(BLOCK_PLACEHOLDER_CLASS);
    node.empty();

    try {
      await invokeBlockRenderer(node, block, ctx);
      decorateSubtreeCodeFences(node, block.rawContent, ctx.defaultIconMode);
    } catch (err) {
      console.error("[theme-plume] block render failed", err);
      if (ctx.settings?.debugRender) {
        node.createEl("p", { cls: "plume-render-error", text: `Failed: ${block.type}` });
      }
      node.textContent = block.rawContent;
    }
  }

  pruneEmptyMarkdownNodes(container);
}
