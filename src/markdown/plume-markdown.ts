import {
  App,
  Component,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer
} from "obsidian";

export interface PlumeMarkdownContext {
  app: App;
  sourcePath: string;
  component: Component;
  postProcessorCtx?: MarkdownPostProcessorContext;
}

function createRenderToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function attachRenderChild(
  host: HTMLElement,
  ctx: PlumeMarkdownContext
): MarkdownRenderChild {
  const child = new MarkdownRenderChild(host);
  if (ctx.postProcessorCtx) {
    ctx.postProcessorCtx.addChild(child);
  } else {
    ctx.component.addChild(child);
  }
  return child;
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
  if (!markdown.trim()) {
    return;
  }

  const token = createRenderToken();
  container.dataset.plumeMdToken = token;
  container.empty();

  const host = document.createElement("div");
  host.classList.add("markdown-rendered");
  container.appendChild(host);

  const child = attachRenderChild(host, ctx);

  try {
    await MarkdownRenderer.render(ctx.app, markdown, host, ctx.sourcePath, child);
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      return;
    }
    // Hoist even when `container` is not yet in the live preview tree (nested blocks
    // are often built inside a detached staging host before append).
    while (host.firstChild) {
      container.appendChild(host.firstChild);
    }
    host.remove();
  } catch {
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      return;
    }
    container.empty();
    container.textContent = markdown;
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
  if (!markdown.trim()) {
    return;
  }

  const token = createRenderToken();
  container.dataset.plumeMdToken = token;
  container.empty();

  const host = document.createElement("div");
  host.classList.add("markdown-rendered");
  container.appendChild(host);

  const child = attachRenderChild(host, ctx);

  try {
    await MarkdownRenderer.render(ctx.app, markdown, host, ctx.sourcePath, child);
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      return;
    }
    while (host.firstChild) {
      container.insertBefore(host.firstChild, host);
    }
    host.remove();
  } catch {
    if (container.dataset.plumeMdToken !== token) {
      host.remove();
      return;
    }
    container.empty();
    container.textContent = markdown;
  }
}
