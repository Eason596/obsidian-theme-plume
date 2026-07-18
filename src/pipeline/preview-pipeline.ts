import { Component, MarkdownRenderChild, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import { renderInnerMarkdown, type BlockRenderContext } from "../render";
import { enrichRenderedRoot } from "../render/enrichment";
import { processLinkFavicons } from "../render/link-favicons";
import type { FileTreeIconMode, ParsedBlock } from "../types";
import { hashString } from "../utils/hash";
import { CodeFenceTitleService } from "./code-fence-titles";
import { normalizeMarkdownNewlines } from "./preview-sync";
import { appendRenderSentinel, hasRenderSentinel } from "./render-sentinel";
import {
  SectionRenderCoordinator,
  type SectionRenderTicket
} from "./section-render-coordinator";

const HIDDEN_SECTION_CLASS = "plume-section-absorbed";
const MAX_LEADING_SECTIONS = 512;

export interface PreviewPipelineOptions {
  plugin: Plugin;
  getDefaultIconMode: () => FileTreeIconMode;
  getOrParseBlocks: (text: string, sourcePath: string) => ParsedBlock[];
  /** Prefer unsaved editor buffer over section snapshot (info.text). */
  getDocumentText?: (sourcePath: string, sectionSnapshot: string) => string;
  isDocumentDirty?: (sourcePath: string) => boolean;
  /**
   * Clear dirty after a successful section commit. Pass the text that was
   * rendered so a newer editor buffer is not marked clean by mistake.
   */
  clearDocumentDirty?: (sourcePath: string, renderedText: string) => void;
  /** Verify that a connected section still belongs to a view showing this file. */
  isRenderTargetCurrent?: (rootElement: HTMLElement, sourcePath: string) => boolean;
  buildRenderContext: (
    sourcePath: string,
    ctx: MarkdownPostProcessorContext,
    component: Component
  ) => BlockRenderContext;
}

interface LeadingEntry {
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
}

interface SectionRenderScope {
  root: MarkdownRenderChild;
  cycle: Component | null;
  sourcePath: string;
}

/**
 * Coordinates Obsidian's per-section post-processor with Plume's block model.
 *
 * Strategy (stable, battle-tested in this codebase):
 * 1. Parse blocks from the full file text (section info always carries full text).
 * 2. Leading section (contains block open line) renders the whole block via
 *    placeholder-based `renderInnerMarkdown` (no fighting markdown-it).
 * 3. Interior sections are visually absorbed (zero height, not display:none)
 *    so outline scroll positions stay usable.
 * 4. Interior edits schedule a leading-section refresh.
 */
export class PreviewPipeline {
  private leadingSections = new Map<string, LeadingEntry>();
  private pendingReRender = new Set<string>();
  /** Retry / leading-re-render timeouts keyed by id → sourcePath (null = global). */
  private retryTimers = new Map<number, string | null>();
  private sectionScopes = new WeakMap<HTMLElement, SectionRenderScope>();
  private sectionScopeSet = new Set<SectionRenderScope>();
  private sectionRenders = new SectionRenderCoordinator();
  readonly codeFenceTitles: CodeFenceTitleService;

  constructor(private readonly options: PreviewPipelineOptions) {
    this.codeFenceTitles = new CodeFenceTitleService(
      options.plugin.app,
      options.getDefaultIconMode
    );
  }

  clear(): void {
    this.clearRetryTimers();
    for (const scope of this.sectionScopeSet) {
      scope.root.unload();
    }
    this.sectionScopeSet.clear();
    this.sectionScopes = new WeakMap<HTMLElement, SectionRenderScope>();
    this.sectionRenders = new SectionRenderCoordinator();
    this.leadingSections.clear();
    this.pendingReRender.clear();
    this.codeFenceTitles.clear();
  }

  /** Drop section skip keys so the next post-process pass rebuilds blocks (e.g. after save). */
  invalidateBlocksForFile(sourcePath: string): void {
    for (const [key, entry] of this.leadingSections) {
      if (!key.startsWith(`${sourcePath}::`)) {
        continue;
      }
      delete entry.el.dataset.plumeBlockKey;
    }
  }

  forgetFile(sourcePath: string): void {
    this.clearRetryTimersForFile(sourcePath);
    for (const key of Array.from(this.leadingSections.keys())) {
      if (key.startsWith(`${sourcePath}::`)) {
        this.leadingSections.delete(key);
        this.pendingReRender.delete(key);
      }
    }
    this.codeFenceTitles.forgetFile(sourcePath);
  }

  private scheduleRetry(
    fn: () => void,
    delayMs: number,
    sourcePath: string | null
  ): void {
    const id = window.setTimeout(() => {
      this.retryTimers.delete(id);
      fn();
    }, delayMs);
    this.retryTimers.set(id, sourcePath);
  }

  private clearRetryTimers(): void {
    for (const id of this.retryTimers.keys()) {
      window.clearTimeout(id);
    }
    this.retryTimers.clear();
  }

  private clearRetryTimersForFile(sourcePath: string): void {
    for (const [id, path] of this.retryTimers) {
      if (path !== sourcePath) continue;
      window.clearTimeout(id);
      this.retryTimers.delete(id);
    }
  }

  /**
   * Re-run leading-section renderers (e.g. while preview is visible and the file is edited).
   * When `excludePreviewRoots` is set, skip hosts inside Reading view (already rebuilt
   * by previewMode.set).
   */
  refreshLeadingSectionsForFile(
    sourcePath: string,
    options?: { excludePreviewRoots?: boolean }
  ): void {
    for (const [key, entry] of this.leadingSections) {
      if (!key.startsWith(`${sourcePath}::`)) {
        continue;
      }
      if (!entry.el.isConnected) {
        this.leadingSections.delete(key);
        continue;
      }
      if (
        options?.excludePreviewRoots
        && entry.el.closest(".markdown-preview-view")
      ) {
        continue;
      }
      if (this.pendingReRender.has(key)) {
        continue;
      }
      this.pendingReRender.add(key);
      queueMicrotask(() => {
        this.pendingReRender.delete(key);
        const fresh = this.leadingSections.get(key);
        if (!fresh?.el.isConnected) {
          return;
        }
        if (
          options?.excludePreviewRoots
          && fresh.el.closest(".markdown-preview-view")
        ) {
          return;
        }
        // Keep plumeBlockKey — processSection skips when the block hash is unchanged.
        void this.processSection(fresh.el, fresh.ctx).catch((err) => {
          console.error("[theme-plume] leading refresh failed", err);
        });
      });
    }
  }

  async processSection(
    rootElement: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    attempt = 0
  ): Promise<void> {
    // MarkdownRenderer calls made by this pipeline also run global
    // post-processors. They are already owned by the outer section render and
    // must not be mistaken for independent Obsidian document sections.
    if (rootElement.closest(".plume-section-render-host")) return;

    const previousSourcePath = this.sectionRenders.sourcePathFor(rootElement);
    const renderTicket = this.sectionRenders.begin(rootElement, ctx.sourcePath);
    if (!this.isCurrentRenderTarget(renderTicket)) {
      this.forgetSectionEntries(rootElement);
      return;
    }
    rootElement.dataset.plumeSourcePath = ctx.sourcePath;
    this.forgetReusedSectionEntries(rootElement, ctx.sourcePath);
    if (previousSourcePath && previousSourcePath !== ctx.sourcePath) {
      // Drop the previous note's widgets once — avoids showing file A under file B.
      rootElement.empty();
      delete rootElement.dataset.plumeBlockKey;
      delete rootElement.dataset.plumeBadgeRerender;
      rootElement.classList.remove("plume-has-block");
    }

    const info = ctx.getSectionInfo(rootElement);
    if (!info) {
      this.unhideSection(rootElement);
      // Brief retry when section info is not ready yet (user can also switch notes).
      if (attempt < 3 && rootElement.isConnected) {
        const delayMs = attempt === 0 ? 0 : attempt === 1 ? 48 : 120;
        this.scheduleRetry(() => {
          if (!rootElement.isConnected) return;
          if (rootElement.dataset.plumeBlockKey) return;
          void this.processSection(rootElement, ctx, attempt + 1).catch((err) => {
            console.error("[theme-plume] section retry failed", err);
          });
        }, delayMs, ctx.sourcePath);
      }
      return;
    }

    const isDirty = this.options.isDocumentDirty?.(ctx.sourcePath) ?? false;
    const liveText = normalizeMarkdownNewlines(
      this.options.getDocumentText?.(ctx.sourcePath, info.text) ?? info.text
    );
    const snapshotText = normalizeMarkdownNewlines(info.text);
    // Unsaved edits use the live buffer; otherwise prefer the section snapshot so
    // lineStart/lineEnd stay aligned with what Obsidian used to build this section.
    const docText = isDirty ? liveText : snapshotText;
    if (!isDirty && liveText !== snapshotText) {
      // File-switch race: sourcePath/editor already moved on, section snapshot has not.
      // Do not blank the section on every retry (that flashes). Path-change above
      // already cleared the wrong note when the section was reused.
      // Note: newline-only differences are ignored via normalizeMarkdownNewlines —
      // without that, Windows `\r\n` vault reads skipped all Plume containers.
      if (attempt < 3 && rootElement.isConnected) {
        const delayMs = attempt === 0 ? 0 : attempt === 1 ? 48 : 120;
        this.scheduleRetry(() => {
          if (!this.isCurrentRenderTarget(renderTicket)) return;
          void this.processSection(rootElement, ctx, attempt + 1).catch((err) => {
            console.error("[theme-plume] stale section snapshot retry failed", err);
          });
        }, delayMs, ctx.sourcePath);
      }
      return;
    }
    const blocks = this.options.getOrParseBlocks(docText, ctx.sourcePath);
    if (blocks.length === 0) {
      this.unhideSection(rootElement);
      const renderComponent = this.getRenderCycle(rootElement, ctx, true);
      await this.codeFenceTitles.decorateSection(
        rootElement,
        docText,
        info.lineStart,
        info.lineEnd,
        renderComponent
      );
      if (!this.isCurrentRenderTarget(renderTicket)) return;
      return;
    }

    const sectionStart = info.lineStart;
    const sectionEnd = info.lineEnd;
    const overlapping = blocks.filter(
      (b) => b.endLine >= sectionStart && b.startLine <= sectionEnd
    );

    if (overlapping.length === 0) {
      this.unhideSection(rootElement);
      const renderComponent = this.getRenderCycle(rootElement, ctx, true);
      await this.codeFenceTitles.decorateSection(
        rootElement,
        docText,
        info.lineStart,
        info.lineEnd,
        renderComponent
      );
      if (!this.isCurrentRenderTarget(renderTicket)) return;
      return;
    }

    const interior = overlapping.find((b) => b.startLine < sectionStart);
    if (interior) {
      this.releaseRenderCycle(rootElement);
      this.absorbSection(rootElement);
      for (const b of overlapping) {
        if (b.startLine < sectionStart) {
          this.scheduleLeadingReRender(ctx.sourcePath, b.startLine, rootElement);
        }
      }
      return;
    }

    const lines = docText.split(/\r?\n/);
    let renderEnd = sectionEnd;
    for (const b of overlapping) {
      if (b.endLine > renderEnd) {
        renderEnd = b.endLine;
      }
    }

    const slice = lines.slice(sectionStart, renderEnd + 1).join("\n");
    const lineKey = overlapping.map((b) => `${b.startLine}:${b.endLine}`).join("|");
    const blocksKey = overlapping.map((b) => hashString(b.rawContent)).join("|");
    const blockKey = `${lineKey}|${hashString(slice)}|${blocksKey}`;

    // Skip rebuild when this section's Plume content is unchanged. Document-level
    // dirty / snapshot drift alone must not tear down card-masonry etc.
    const renderSentinelMissing = !hasRenderSentinel(rootElement);
    const shouldRerender =
      rootElement.dataset.plumeBlockKey !== blockKey
      || rootElement.childElementCount === 0
      || renderSentinelMissing;

    if (!shouldRerender) {
      const renderComponent = this.getRenderCycle(rootElement, ctx);
      const lineEnd = slice.split(/\r?\n/).length;
      // Soft flush: skip full fence decorate when titles/features already applied.
      if (this.codeFenceTitles.sectionNeedsDecorate(rootElement, slice, 0, lineEnd)) {
        await this.codeFenceTitles.decorateSection(
          rootElement,
          slice,
          0,
          lineEnd,
          renderComponent
        );
      }
      if (!this.isCurrentRenderTarget(renderTicket)) return;
      // Later processSection passes bump the render ticket and used to cancel
      // deferred favicons — re-apply cheaply when icons never landed.
      if (!rootElement.querySelector(".vp-link-favicon")) {
        processLinkFavicons(rootElement, {
          app: this.options.plugin.app,
          sourcePath: ctx.sourcePath,
          sourceText: docText,
          isCurrent: () => this.isCurrentRenderTarget(renderTicket)
        });
      }
      return;
    }

    const renderComponent = this.getRenderCycle(rootElement, ctx, true);
    rootElement.empty();
    this.unhideSection(rootElement);
    rootElement.classList.add("plume-has-block");

    // Keep the host connected for Obsidian setIcon()/MarkdownRenderer, but do
    // all async work inside it. A newer render removes this host; only the
    // current ticket may hoist its children into the reused section root.
    const renderHost = rootElement.ownerDocument.createElement("div");
    renderHost.className = "plume-section-render-host";
    rootElement.appendChild(renderHost);

    const renderCtx = this.options.buildRenderContext(ctx.sourcePath, ctx, renderComponent);

    for (const b of overlapping) {
      if (b.startLine >= sectionStart) {
        const key = `${ctx.sourcePath}::${b.startLine}`;
        this.leadingSections.delete(key);
        this.leadingSections.set(key, { el: rootElement, ctx });
        while (this.leadingSections.size > MAX_LEADING_SECTIONS) {
          const oldest = this.leadingSections.keys().next().value as string | undefined;
          if (oldest === undefined) break;
          this.leadingSections.delete(oldest);
          this.pendingReRender.delete(oldest);
        }
      }
    }

    try {
      await renderInnerMarkdown(renderHost, slice, renderCtx);
      if (!this.isCurrentHost(renderTicket, renderHost)) return;
      // renderInnerMarkdown already decorated; only re-run when titles/features missing.
      const lineEnd = slice.split(/\r?\n/).length;
      if (this.codeFenceTitles.sectionNeedsDecorate(renderHost, slice, 0, lineEnd)) {
        await this.codeFenceTitles.decorateSection(
          renderHost,
          slice,
          0,
          lineEnd,
          renderComponent
        );
      }
      if (!this.isCurrentHost(renderTicket, renderHost)) return;
      // Enrich once after async rebuild (global PP skips `.plume-has-block`).
      // Favicons run after commit so a follow-up ticket bump does not cancel them.
      await enrichRenderedRoot(renderHost, {
        app: this.options.plugin.app,
        sourcePath: ctx.sourcePath,
        component: renderComponent,
        postProcessorCtx: ctx,
        sourceText: docText,
        favicons: false,
        isCurrent: () => this.isCurrentHost(renderTicket, renderHost)
      });
      if (!this.isCurrentHost(renderTicket, renderHost)) return;
      appendRenderSentinel(renderHost);
    } catch (err) {
      if (!this.isCurrentHost(renderTicket, renderHost)) return;
      console.error("[theme-plume] section render failed", err);
      renderHost.empty();
      const errEl = renderHost.createDiv({ cls: "plume-render-error" });
      errEl.createEl("p", {
        text: "Obsidian Plume: block render failed. See developer console for details."
      });
      errEl.createEl("pre", { text: slice });
    }

    if (!this.sectionRenders.commitHost(renderTicket, renderHost)) return;
    rootElement.dataset.plumeBlockKey = blockKey;
    rootElement.dataset.plumeSourcePath = ctx.sourcePath;
    rootElement.classList.add("plume-has-block");
    // Only clear dirty if the editor buffer still matches what we rendered.
    this.options.clearDocumentDirty?.(ctx.sourcePath, docText);
    // Prefer live connectedness over render tickets — a follow-up begin() must
    // not cancel favicons for DOM that is still on screen.
    processLinkFavicons(rootElement, {
      app: this.options.plugin.app,
      sourcePath: ctx.sourcePath,
      sourceText: docText,
      isCurrent: () =>
        rootElement.isConnected
        && rootElement.dataset.plumeSourcePath === ctx.sourcePath
    });

    this.scheduleRemeasure(rootElement);
  }

  private isCurrentHost(ticket: SectionRenderTicket, host: HTMLElement): boolean {
    return this.isCurrentRenderTarget(ticket) && host.parentElement === ticket.root;
  }

  private isCurrentRenderTarget(ticket: SectionRenderTicket): boolean {
    return this.sectionRenders.isCurrent(ticket)
      && (this.options.isRenderTargetCurrent?.(ticket.root, ticket.sourcePath) ?? true);
  }

  private forgetSectionEntries(el: HTMLElement): void {
    for (const [key, entry] of this.leadingSections) {
      if (entry.el !== el) continue;
      this.leadingSections.delete(key);
      this.pendingReRender.delete(key);
    }
  }

  private forgetReusedSectionEntries(el: HTMLElement, sourcePath: string): void {
    for (const [key, entry] of this.leadingSections) {
      if (entry.el !== el || key.startsWith(`${sourcePath}::`)) continue;
      this.leadingSections.delete(key);
      this.pendingReRender.delete(key);
    }
  }

  private scheduleRemeasure(el: HTMLElement): void {
    if (!el.querySelector(".vp-card-masonry, .vp-card-grid")) {
      return;
    }
    window.requestAnimationFrame(() => {
      if (!el.isConnected) {
        return;
      }
      try {
        this.options.plugin.app.workspace.trigger("resize");
      } catch {
        /* best-effort */
      }
    });
  }

  private scheduleLeadingReRender(
    sourcePath: string,
    blockStartLine: number,
    triggerEl: HTMLElement
  ): void {
    const key = `${sourcePath}::${blockStartLine}`;
    const entry = this.leadingSections.get(key);
    if (!entry) {
      return;
    }
    if (!entry.el.isConnected) {
      this.leadingSections.delete(key);
      return;
    }
    if (entry.el === triggerEl) {
      return;
    }
    if (this.pendingReRender.has(key)) {
      return;
    }

    this.pendingReRender.add(key);
    // Debounce: many interior sections (e.g. :::: card-masonry) would otherwise
    // empty+rebuild the leading host repeatedly and flash back to raw markers.
    this.scheduleRetry(() => {
      this.pendingReRender.delete(key);
      const fresh = this.leadingSections.get(key);
      if (!fresh || !fresh.el.isConnected) {
        return;
      }
      // Already has rendered Plume widgets — skip tear-down
      if (
        fresh.el.querySelector(
          ".vp-card-masonry, .vp-card-grid, .vp-code-tree, .vp-custom-container, .vp-card-wrapper"
        )
      ) {
        return;
      }
      delete fresh.el.dataset.plumeBlockKey;
      void this.processSection(fresh.el, fresh.ctx).catch((err) => {
        console.error("[theme-plume] leading re-render failed", err);
      });
    }, 50, sourcePath);
  }

  private absorbSection(el: HTMLElement): void {
    el.empty();
    el.classList.add(HIDDEN_SECTION_CLASS);
    delete el.dataset.plumeBlockKey;
    el.classList.remove("plume-has-block");
  }

  /** One root child per Obsidian section, with a replaceable child per render pass. */
  private getRenderCycle(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    replace = false
  ): Component {
    let scope = this.sectionScopes.get(el);
    if (scope && scope.sourcePath !== ctx.sourcePath) {
      scope.root.unload();
      this.sectionScopeSet.delete(scope);
      this.sectionScopes.delete(el);
      scope = undefined;
    }
    if (!scope) {
      const root = new MarkdownRenderChild(el);
      ctx.addChild(root);
      const cycle = new Component();
      root.addChild(cycle);
      scope = { root, cycle, sourcePath: ctx.sourcePath };
      this.sectionScopes.set(el, scope);
      this.sectionScopeSet.add(scope);
      const registeredScope = scope;
      root.register(() => {
        this.sectionScopeSet.delete(registeredScope);
      });
      return cycle;
    }
    if (!replace && scope.cycle) {
      return scope.cycle;
    }
    if (scope.cycle) {
      scope.root.removeChild(scope.cycle);
    }
    scope.cycle = new Component();
    scope.root.addChild(scope.cycle);
    return scope.cycle;
  }

  private releaseRenderCycle(el: HTMLElement): void {
    const scope = this.sectionScopes.get(el);
    if (!scope) return;
    if (scope.cycle) {
      scope.root.removeChild(scope.cycle);
      scope.cycle = null;
    }
  }

  private unhideSection(el: HTMLElement): void {
    if (el.classList.contains(HIDDEN_SECTION_CLASS)) {
      el.classList.remove(HIDDEN_SECTION_CLASS);
    }
    delete el.dataset.plumeBlockKey;
    el.classList.remove("plume-has-block");
  }
}
