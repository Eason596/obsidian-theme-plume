import type { BlockRenderContext } from "./context";
import { renderInnerMarkdown } from "./pipeline";

const INLINE_MD_BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "UL",
  "OL",
  "LI",
  "PRE",
  "BLOCKQUOTE",
  "TABLE",
  "HR",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6"
]);

function appendPhrasingFromRendered(host: HTMLElement, node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    if (t) {
      host.appendChild(document.createTextNode(t));
    }
    return;
  }
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (node.tagName === "P" || INLINE_MD_BLOCK_TAGS.has(node.tagName)) {
    for (const child of Array.from(node.childNodes)) {
      appendPhrasingFromRendered(host, child);
    }
    return;
  }
  host.appendChild(node.cloneNode(true));
}

export async function renderInlineMarkdownInto(
  host: HTMLElement,
  text: string,
  ctx: BlockRenderContext,
  options?: { phrasingOnly?: boolean }
): Promise<void> {
  const temp = document.createElement("div");
  await renderInnerMarkdown(temp, text, ctx);

  const phrasingHost =
    options?.phrasingOnly === true
    || host.tagName === "P"
    || host.tagName === "SPAN";

  host.empty();

  if (phrasingHost) {
    for (const node of Array.from(temp.childNodes)) {
      appendPhrasingFromRendered(host, node);
    }
    return;
  }

  const elementChildren = Array.from(temp.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  );

  if (elementChildren.length === 1 && elementChildren[0].tagName === "P") {
    const paragraph = elementChildren[0];
    while (paragraph.firstChild) {
      host.appendChild(paragraph.firstChild);
    }
    return;
  }

  while (temp.firstChild) {
    host.appendChild(temp.firstChild);
  }
}
