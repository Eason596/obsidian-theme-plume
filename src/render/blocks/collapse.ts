import { setIcon } from "obsidian";
import { parseCollapseRawContent } from "../../parser";
import type { CollapseContainerAttrs } from "../../types";
import { hashString } from "../../utils/hash";
import type { BlockRenderContext } from "../context";
import { renderInlineMarkdownInto } from "../inline";
import { renderNestedMarkdownContent } from "../pipeline";

interface CollapseItemMeta {
  expand?: boolean;
}

function shouldEagerRenderCollapseBody(
  details: HTMLDetailsElement,
  index: number,
  attrs: CollapseContainerAttrs,
  activeIndex: number,
  ctx: BlockRenderContext
): boolean {
  if (!ctx.settings?.collapseLazyBodies) {
    return true;
  }
  if (!details.open) {
    return false;
  }
  if (attrs.accordion) {
    return index === activeIndex;
  }
  return true;
}

function createCollapseDetailsElement(
  index: number,
  attrs: CollapseContainerAttrs,
  itemMeta: CollapseItemMeta[],
  activeIndex: number
): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "vp-collapse-item";
  details.setAttribute("role", "group");
  const meta = itemMeta[index];
  const expanded = attrs.accordion
    ? index === activeIndex
    : (meta?.expand ?? attrs.expand ?? false);
  details.open = expanded;
  details.dataset.index = String(index);

  const summary = document.createElement("summary");
  summary.className = "vp-collapse-header";
  summary.setAttribute("role", "button");
  summary.setAttribute("tabindex", "0");
  summary.setAttribute("aria-expanded", expanded ? "true" : "false");
  summary.id = `vp-collapse-summary-${index}`;
  details.appendChild(summary);

  const chevron = document.createElement("span");
  chevron.className = "vp-collapse-chevron";
  chevron.setAttribute("aria-hidden", "true");
  setIcon(chevron, "chevron-right");
  summary.appendChild(chevron);

  const title = document.createElement("span");
  title.className = "vp-collapse-title";
  summary.appendChild(title);

  const content = document.createElement("div");
  content.className = "vp-collapse-content";
  content.setAttribute("role", "region");
  content.setAttribute("aria-labelledby", summary.id);
  content.setAttribute("tabindex", "0");
  details.appendChild(content);

  const inner = document.createElement("div");
  inner.className = "vp-collapse-content-inner";
  content.appendChild(inner);

  return details;
}

function bindCollapseAccordion(wrapper: HTMLElement, details: HTMLDetailsElement): void {
  details.addEventListener("toggle", () => {
    if (!details.open) {
      return;
    }
    for (const sibling of Array.from(
      wrapper.querySelectorAll<HTMLDetailsElement>(":scope > .vp-collapse-item")
    )) {
      if (sibling !== details) {
        sibling.open = false;
      }
    }
  });
}

function scheduleCollapseBody(
  details: HTMLDetailsElement,
  inner: HTMLElement,
  body: string,
  ctx: BlockRenderContext,
  eager: boolean
): void {
  const bodyRevision = hashString(body);
  const mountBody = async (): Promise<void> => {
    if (
      inner.dataset.plumeCollapseBodyRev === bodyRevision
      && inner.childElementCount > 0
    ) {
      return;
    }
    inner.dataset.plumeCollapseBodyRev = bodyRevision;
    inner.dataset.plumeCollapseBody = "1";
    inner.empty();
    await renderNestedMarkdownContent(inner, body, ctx);
  };

  if (eager) {
    void mountBody();
    return;
  }

  details.addEventListener("toggle", () => {
    if (details.open) {
      void mountBody();
    }
  });
}

export async function renderCollapseBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: CollapseContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");
  if (!content) {
    return;
  }

  const { preamble, items } = parseCollapseRawContent(content);
  if (items.length === 0 && !preamble.trim()) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "vp-collapse obsidian-vuepress-collapse";
  if (attrs.accordion) {
    wrapper.dataset.accordion = "true";
  }
  container.appendChild(wrapper);

  if (preamble.trim()) {
    const intro = document.createElement("div");
    intro.className = "vp-collapse-preamble";
    wrapper.appendChild(intro);
    await renderNestedMarkdownContent(intro, preamble, ctx);
  }

  let activeIndex = -1;
  if (attrs.accordion) {
    activeIndex = items.findIndex((item) => item.expand === true);
    if (activeIndex === -1 && attrs.expand) {
      activeIndex = 0;
    }
  }

  for (const [index, item] of items.entries()) {
    const details = createCollapseDetailsElement(
      index,
      attrs,
      items.map((i) => ({ expand: i.expand })),
      activeIndex
    );
    wrapper.appendChild(details);

    const title = details.querySelector(".vp-collapse-title");
    const inner = details.querySelector(".vp-collapse-content-inner");
    const titleText = item.titleLines.join(" ").trim();

    if (title instanceof HTMLElement && titleText) {
      if (/[*_[\]`]/.test(titleText)) {
        await renderInlineMarkdownInto(title, titleText, ctx, { phrasingOnly: true });
      } else {
        title.textContent = titleText;
      }
    }

    if (inner instanceof HTMLElement && item.body.trim()) {
      const eager = shouldEagerRenderCollapseBody(details, index, attrs, activeIndex, ctx);
      scheduleCollapseBody(details, inner, item.body, ctx, eager);
    }

    if (attrs.accordion) {
      bindCollapseAccordion(wrapper, details);
    }
  }
}
