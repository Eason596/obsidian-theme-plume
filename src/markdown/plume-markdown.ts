import {
  App,
  Component,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer
} from "obsidian";
import { applyVuepressMarkdownTransforms } from "../render/markdown-transforms";
import { processIconifyIcons } from "../render/iconify-online";

export interface PlumeMarkdownContext {
  app: App;
  sourcePath: string;
  component: Component;
  postProcessorCtx?: MarkdownPostProcessorContext;
}

function createRenderToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const activeMarkdownChildren = new WeakMap<
  HTMLElement,
  { parent: Component; child: MarkdownRenderChild }
>();

function attachRenderChild(
  container: HTMLElement,
  host: HTMLElement,
  ctx: PlumeMarkdownContext
): MarkdownRenderChild {
  const previous = activeMarkdownChildren.get(container);
  if (previous) {
    previous.parent.removeChild(previous.child);
  }
  const child = new MarkdownRenderChild(host);
  ctx.component.addChild(child);
  activeMarkdownChildren.set(container, { parent: ctx.component, child });
  ctx.component.register(() => {
    if (activeMarkdownChildren.get(container)?.child === child) {
      activeMarkdownChildren.delete(container);
    }
  });
  return child;
}

function releaseRenderChild(
  container: HTMLElement,
  ctx: PlumeMarkdownContext,
  child: MarkdownRenderChild
): void {
  if (activeMarkdownChildren.get(container)?.child === child) {
    activeMarkdownChildren.delete(container);
  }
  ctx.component.removeChild(child);
}

/**
 * Render markdown into `container` using Obsidian's renderer with proper
 * lifecycle management (MarkdownRenderChild). Cancels stale async renders via token.
 */
export async function renderPlumeMarkdown(
  container: HTMLElement,
  markdown: string,
  ctx: PlumeMarkdownContext
): Promise<void> {
  const source = applyVuepressMarkdownTransforms(markdown);
  if (!source.trim()) {
    return;
  }

  const token = createRenderToken();
  container.dataset.plumeMdToken = token;
  container.empty();

  const host = document.createElement("div");
  host.classList.add("markdown-rendered");
  container.appendChild(host);

  const child = attachRenderChild(container, host, ctx);

  try {
    await MarkdownRenderer.render(ctx.app, source, host, ctx.sourcePath, child);
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      releaseRenderChild(container, ctx, child);
      return;
    }
    // Hoist even when `container` is not yet in the live preview tree (nested blocks
    // are often built inside a detached staging host before append).
    while (host.firstChild) {
      container.appendChild(host.firstChild);
    }
    host.remove();
    child.containerEl = container;
    await processIconifyIcons(container);
  } catch {
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      releaseRenderChild(container, ctx, child);
      return;
    }
    releaseRenderChild(container, ctx, child);
    container.empty();
    container.textContent = source;
  }
}

/**
 * Render into a staging host, then move children into `container` (used when
 * we must not leave an extra wrapper in the DOM).
 */
export async function renderPlumeMarkdownInto(
  container: HTMLElement,
  markdown: string,
  ctx: PlumeMarkdownContext
): Promise<void> {
  const source = applyVuepressMarkdownTransforms(markdown);
  if (!source.trim()) {
    return;
  }

  const token = createRenderToken();
  container.dataset.plumeMdToken = token;
  container.empty();

  const host = document.createElement("div");
  host.classList.add("markdown-rendered");
  container.appendChild(host);

  const child = attachRenderChild(container, host, ctx);

  try {
    await MarkdownRenderer.render(ctx.app, source, host, ctx.sourcePath, child);
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      releaseRenderChild(container, ctx, child);
      return;
    }
    while (host.firstChild) {
      container.insertBefore(host.firstChild, host);
    }
    host.remove();
    child.containerEl = container;
    await processIconifyIcons(container);
  } catch {
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      releaseRenderChild(container, ctx, child);
      return;
    }
    releaseRenderChild(container, ctx, child);
    container.empty();
    container.textContent = source;
  }
}
