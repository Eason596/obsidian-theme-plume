import type { App, Component, MarkdownPostProcessorContext } from "obsidian";
import type { PlumeMarkdownContext } from "../markdown/plume-markdown";
import type { CodeTreeFileItem, FileTreeIconMode } from "../types";

export interface BlockRenderContext {
  app: App;
  sourcePath: string;
  component: Component;
  postProcessorCtx?: MarkdownPostProcessorContext;
  defaultIconMode: FileTreeIconMode;
  renderMarkdown?: (container: HTMLElement, markdown: string) => Promise<void>;
  /** Resolve a @[code-tree](path) embed into a flat list of CodeTreeFileItem. */
  resolveCodeTreeEmbed?: (
    sourcePath: string,
    dirPath: string
  ) => Promise<CodeTreeFileItem[] | null>;
  /** Plugin settings snapshot for renderers. */
  settings?: PlumeRenderSettings;
  /** Bumps on each editor change so nested UI (tabs/collapse) can invalidate caches. */
  contentEpoch?: number;
}

/** Settings passed into the render pipeline (subset of plugin settings). */
export interface PlumeRenderSettings {
  defaultIconMode: FileTreeIconMode;
  persistTabSelection: boolean;
  collapseLazyBodies: boolean;
  tabsLazyPanels: boolean;
  debugRender: boolean;
}

export function toPlumeMarkdownContext(ctx: BlockRenderContext): PlumeMarkdownContext {
  return {
    app: ctx.app,
    sourcePath: ctx.sourcePath,
    component: ctx.component,
    postProcessorCtx: ctx.postProcessorCtx
  };
}

export function toBlockRenderContext(
  md: PlumeMarkdownContext,
  defaultIconMode: FileTreeIconMode,
  settings?: PlumeRenderSettings
): BlockRenderContext {
  return {
    app: md.app,
    sourcePath: md.sourcePath,
    component: md.component,
    postProcessorCtx: md.postProcessorCtx,
    defaultIconMode,
    settings
  };
}

export function triggerPreviewReflow(app: App): void {
  window.requestAnimationFrame(() => {
    try {
      app.workspace.trigger("resize");
    } catch {
      /* best-effort */
    }
  });
}
