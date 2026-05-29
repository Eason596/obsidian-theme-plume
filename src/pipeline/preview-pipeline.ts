import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { parseAllBlocks } from "../parser";
import { renderInnerMarkdown, type BlockRenderContext } from "../render";
import type { FileTreeIconMode, ParsedBlock } from "../types";
import { hashString } from "../utils/hash";
import { CodeFenceTitleService } from "./code-fence-titles";

const HIDDEN_SECTION_CLASS = "plume-section-absorbed";

export interface PreviewPipelineOptions {
  plugin: Plugin;
  getDefaultIconMode: () => FileTreeIconMode;
  getOrParseBlocks: (text: string, sourcePath: string) => ParsedBlock[];
  /** Prefer unsaved editor buffer over section snapshot (info.text). */
  getDocumentText?: (sourcePath: string, sectionSnapshot: string) => string;
  isDocumentDirty?: (sourcePath: string) => boolean;
  clearDocumentDirty?: (sourcePath: string) => void;
  buildRenderContext: (
    sourcePath: string,
    ctx: MarkdownPostProcessorContext
  ) => BlockRenderContext;
}

interface LeadingEntry {
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
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
  readonly codeFenceTitles: CodeFenceTitleService;

  constructor(private readonly options: PreviewPipelineOptions) {
    this.codeFenceTitles = new CodeFenceTitleService(
      options.plugin.app,
      options.getDefaultIconMode
    );
  }

  clear(): void {
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

  /** Re-run leading-section renderers (e.g. while preview is visible and the file is edited). */
  refreshLeadingSectionsForFile(sourcePath: string): void {
    for (const [key, entry] of this.leadingSections) {
      if (!key.startsWith(`${sourcePath}::`)) {
        continue;
      }
      if (!entry.el.isConnected) {
        this.leadingSections.delete(key);
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
        delete fresh.el.dataset.plumeBlockKey;
        void this.processSection(fresh.el, fresh.ctx).catch((err) => {
          console.error("[obsidian-plume] leading refresh failed", err);
        });
      });
    }
  }

  async processSection(
    rootElement: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const info = ctx.getSectionInfo(rootElement);
    if (!info) {
      this.unhideSection(rootElement);
      return;
    }

    const docText = this.options.getDocumentText?.(ctx.sourcePath, info.text) ?? info.text;
    const blocks = this.options.getOrParseBlocks(docText, ctx.sourcePath);
    if (blocks.length === 0) {
      this.unhideSection(rootElement);
      this.codeFenceTitles.decorateSection(
        rootElement,
        info.text,
        info.lineStart,
        info.lineEnd
      );
      return;
    }

    const sectionStart = info.lineStart;
    const sectionEnd = info.lineEnd;
    const overlapping = blocks.filter(
      (b) => b.endLine >= sectionStart && b.startLine <= sectionEnd
    );

    if (overlapping.length === 0) {
      this.unhideSection(rootElement);
      this.codeFenceTitles.decorateSection(
        rootElement,
        info.text,
        info.lineStart,
        info.lineEnd
      );
      return;
    }

    const interior = overlapping.find((b) => b.startLine < sectionStart);
    if (interior) {
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
    const snapshotInSync = docText === info.text;
    const isDirty = this.options.isDocumentDirty?.(ctx.sourcePath) ?? false;

    if (
      !isDirty
      && snapshotInSync
      && rootElement.dataset.plumeBlockKey === blockKey
      && rootElement.childElementCount > 0
    ) {
      return;
    }

    rootElement.empty();
    this.unhideSection(rootElement);
    rootElement.dataset.plumeBlockKey = blockKey;
    rootElement.classList.add("plume-has-block");

    const renderCtx = this.options.buildRenderContext(ctx.sourcePath, ctx);

    for (const b of overlapping) {
      if (b.startLine >= sectionStart) {
        const key = `${ctx.sourcePath}::${b.startLine}`;
        this.leadingSections.set(key, { el: rootElement, ctx });
      }
    }

    try {
      await renderInnerMarkdown(rootElement, slice, renderCtx);
      this.options.clearDocumentDirty?.(ctx.sourcePath);
    } catch (err) {
      console.error("[obsidian-plume] section render failed", err);
      const errEl = rootElement.createDiv({ cls: "plume-render-error" });
      errEl.createEl("p", {
        text: "Obsidian Plume: block render failed. See developer console for details."
      });
      errEl.createEl("pre", { text: slice });
    }

    this.scheduleRemeasure(rootElement);
  }

  private scheduleRemeasure(el: HTMLElement): void {
    if (!el.querySelector(".vp-card-masonry, .vp-card-grid")) {
      return;
    }
    requestAnimationFrame(() => {
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
    queueMicrotask(() => {
      this.pendingReRender.delete(key);
      const fresh = this.leadingSections.get(key);
      if (!fresh || !fresh.el.isConnected) {
        return;
      }
      delete fresh.el.dataset.plumeBlockKey;
      void this.processSection(fresh.el, fresh.ctx).catch((err) => {
        console.error("[obsidian-plume] leading re-render failed", err);
      });
    });
  }

  private absorbSection(el: HTMLElement): void {
    el.empty();
    el.classList.add(HIDDEN_SECTION_CLASS);
    el.style.display = "";
    el.style.height = "0";
    el.style.minHeight = "0";
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.overflow = "hidden";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    delete el.dataset.plumeBlockKey;
    el.classList.remove("plume-has-block");
  }

  private unhideSection(el: HTMLElement): void {
    if (el.classList.contains(HIDDEN_SECTION_CLASS)) {
      el.classList.remove(HIDDEN_SECTION_CLASS);
      el.style.display = "";
      el.style.height = "";
      el.style.minHeight = "";
      el.style.margin = "";
      el.style.padding = "";
      el.style.overflow = "";
      el.style.visibility = "";
      el.style.pointerEvents = "";
    }
    delete el.dataset.plumeBlockKey;
    el.classList.remove("plume-has-block");
  }
}
