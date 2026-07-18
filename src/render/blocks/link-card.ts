import type { LinkCardContainerAttrs } from "../../types";
import type { BlockRenderContext } from "../context";
import { applyInlineIcon } from "../inline-icon";
import { renderInnerMarkdown } from "../pipeline";
import { classifyLinkHref, safeExternalRel, safeLinkTarget } from "../../utils/safe-url";

function appendSvgMarkup(host: HTMLElement, svg: string): void {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const svgElement = parsed.documentElement;
  if (svgElement.nodeName.toLowerCase() !== "svg") return;
  host.appendChild(host.ownerDocument.importNode(svgElement, true));
}

/* ===== LinkCard ===== */

const LINK_CARD_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

export async function renderLinkCardBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: LinkCardContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const href = attrs.href.trim();
  if (!href) return;
  const classified = classifyLinkHref(href);
  if (classified.kind === "unsafe") {
    container.createEl("p", {
      cls: "plume-render-error",
      text: "link-card: unsafe URL protocol."
    });
    return;
  }
  const external = classified.kind === "external";

  const wrapper = container.createDiv({ cls: "vp-link-card" });
  const body = wrapper.createSpan({ cls: "body" });

  // The whole card is clickable via an absolutely-positioned link::before
  // overlay (matches VuePress behaviour), so the visible <a> just needs to
  // host the title row.
  const link = body.createEl("a", {
    cls: external ? "link external-link" : "link internal-link",
    href: external ? classified.href : "#",
    text: ""
  });
  if (external) {
    const target = safeLinkTarget(attrs.target);
    link.setAttribute("target", target);
    link.setAttribute("rel", safeExternalRel(attrs.rel, target));
  } else {
    // Internal Obsidian note path — hijack click to use workspace opener so
    // hover-preview and tab/split modifiers still work.
    link.setAttribute("data-href", href);
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      const inNewLeaf =
        ev.ctrlKey || ev.metaKey || (ev as MouseEvent).button === 1;
      ctx.app.workspace.openLinkText(href, ctx.sourcePath, inNewLeaf);
    });
  }

  if (attrs.icon) {
    applyInlineIcon(link, attrs.icon, "vp-link-card-icon vp-icon");
  }

  const titleText = attrs.title?.trim() || href;
  link.createSpan({ cls: "text", text: titleText });

  // Description: explicit attr wins; otherwise fall back to container body
  // (rendered as markdown so users can write rich text).
  if (attrs.description) {
    body.createEl("p", { cls: "vp-link-card-desc", text: attrs.description });
  } else {
    const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
    if (bodyMd) {
      // Use div (not p) so nested block markdown / lists stay valid HTML.
      const descHost = body.createDiv({ cls: "vp-link-card-desc" });
      await renderInnerMarkdown(descHost, bodyMd, ctx);
      const onlyP =
        descHost.children.length === 1 && descHost.firstElementChild?.tagName === "P"
          ? (descHost.firstElementChild as HTMLElement)
          : null;
      if (onlyP) {
        while (onlyP.firstChild) descHost.appendChild(onlyP.firstChild);
        onlyP.remove();
      }
    }
  }

  const arrow = wrapper.createSpan({ cls: "vp-link-card-arrow" });
  appendSvgMarkup(arrow, LINK_CARD_ARROW_SVG);
}
