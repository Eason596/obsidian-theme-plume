import type { App, Component, MarkdownPostProcessorContext } from "obsidian";
import {
  processBadges,
  processGithubAlerts,
  processPlots
} from "../render";
import { processIconifyIcons } from "./iconify-online";
import { processLinkFavicons } from "./link-favicons";

export interface EnrichRenderContext {
  app: App;
  sourcePath: string;
  component: Component;
  postProcessorCtx?: MarkdownPostProcessorContext;
  sourceText?: string;
  isCurrent?: () => boolean;
  /** When false, skip favicon pass (caller will schedule it). Default true. */
  favicons?: boolean;
}

/**
 * One enrichment pass for badges / Iconify / GitHub alerts / plots / favicons.
 * Used by PreviewPipeline (Plume hosts) and the global post-processor (plain sections).
 */
export async function enrichRenderedRoot(
  root: HTMLElement,
  ctx: EnrichRenderContext
): Promise<void> {
  if (ctx.isCurrent && !ctx.isCurrent()) return;

  await processBadges(root, {
    app: ctx.app,
    sourcePath: ctx.sourcePath,
    component: ctx.component,
    postProcessorCtx: ctx.postProcessorCtx
  });
  if (ctx.isCurrent && !ctx.isCurrent()) return;

  await processIconifyIcons(root);
  if (ctx.isCurrent && !ctx.isCurrent()) return;

  processGithubAlerts(root);
  processPlots(root, ctx.sourceText);

  if (ctx.favicons === false) return;
  processLinkFavicons(root, {
    app: ctx.app,
    sourcePath: ctx.sourcePath,
    sourceText: ctx.sourceText,
    isCurrent: ctx.isCurrent
  });
}
