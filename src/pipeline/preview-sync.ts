import type { MarkdownSubView, MarkdownView } from "obsidian";

export interface MarkdownViewState {
  mode: string;
  sourcePath: string;
}

/** Normalize EOLs so Windows `\r\n` vault reads compare equal to Obsidian's `\n` snapshots. */
export function normalizeMarkdownNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** A reading view also "enters" preview when its leaf switches files in-place. */
export function entersPreviewTarget(
  previous: MarkdownViewState | undefined,
  current: MarkdownViewState
): boolean {
  return current.mode === "preview"
    && (previous?.mode !== "preview" || previous.sourcePath !== current.sourcePath);
}

/**
 * Keeps editor buffer + dirty state; refreshes Plume blocks without previewMode.set/rerender.
 * Avoids scroll jumps and flicker from full preview rebuilds.
 *
 * Scroll values use Obsidian MarkdownSubView getScroll/applyScroll (shared line-based
 * units across reading and source/live-preview) — never raw pixel tops.
 */
export class PreviewDocumentSync {
  private static readonly MAX_TRACKED_PATHS = 256;
  private readonly liveText = new Map<string, string>();
  private readonly dirtyPaths = new Set<string>();
  /** Last MarkdownSubView scroll (line-based) per file. */
  private readonly scrollByPath = new Map<string, number>();
  /** Last markdown text successfully pushed into reading-mode preview. */
  private readonly lastSyncedPreviewText = new Map<string, string>();
  private readonly pathOrder = new Map<string, true>();
  private readonly scrollRetryTimers = new Set<number>();

  setLiveText(sourcePath: string, text: string): void {
    this.touch(sourcePath);
    this.liveText.set(sourcePath, normalizeMarkdownNewlines(text));
  }

  markDirty(sourcePath: string, text: string): void {
    this.touch(sourcePath);
    this.liveText.set(sourcePath, normalizeMarkdownNewlines(text));
    this.dirtyPaths.add(sourcePath);
  }

  isDirty(sourcePath: string): boolean {
    return this.dirtyPaths.has(sourcePath);
  }

  clearDirty(sourcePath: string): void {
    this.dirtyPaths.delete(sourcePath);
  }

  /**
   * Clear dirty only when the live buffer still matches `renderedText`.
   * Prevents a slow section commit from wiping dirty for a newer edit.
   */
  clearDirtyIfMatches(sourcePath: string, renderedText: string): void {
    const live = this.liveText.get(sourcePath);
    if (live !== undefined && live !== normalizeMarkdownNewlines(renderedText)) {
      return;
    }
    this.dirtyPaths.delete(sourcePath);
  }

  getLiveText(sourcePath: string, fallback: string): string {
    return this.liveText.get(sourcePath) ?? normalizeMarkdownNewlines(fallback);
  }

  /** True when reading preview has never been synced, or editor text differs. */
  hasPreviewSourceChanged(sourcePath: string, text: string): boolean {
    const last = this.lastSyncedPreviewText.get(sourcePath);
    return last === undefined || last !== normalizeMarkdownNewlines(text);
  }

  markPreviewSynced(sourcePath: string, text: string): void {
    this.touch(sourcePath);
    const normalized = normalizeMarkdownNewlines(text);
    this.lastSyncedPreviewText.set(sourcePath, normalized);
    this.liveText.set(sourcePath, normalized);
    this.dirtyPaths.delete(sourcePath);
  }

  deleteLive(sourcePath: string): void {
    this.liveText.delete(sourcePath);
    this.dirtyPaths.delete(sourcePath);
    this.scrollByPath.delete(sourcePath);
    this.lastSyncedPreviewText.delete(sourcePath);
    this.pathOrder.delete(sourcePath);
  }

  clear(): void {
    this.clearScrollRetryTimers();
    this.liveText.clear();
    this.dirtyPaths.clear();
    this.scrollByPath.clear();
    this.lastSyncedPreviewText.clear();
    this.pathOrder.clear();
  }

  clearScrollRetryTimers(): void {
    for (const id of this.scrollRetryTimers) {
      window.clearTimeout(id);
    }
    this.scrollRetryTimers.clear();
  }

  /** Capture MarkdownSubView scroll; null if unavailable. */
  captureScroll(mode: MarkdownSubView | null | undefined): number | null {
    if (!mode) {
      return null;
    }
    try {
      const scroll = mode.getScroll();
      if (!Number.isFinite(scroll) || scroll < 0) {
        return null;
      }
      return scroll;
    } catch {
      return null;
    }
  }

  /** Unofficial but stable: MarkdownView.editMode while in reading view. */
  captureEditModeScroll(view: MarkdownView): number | null {
    const editMode = (view as MarkdownView & { editMode?: MarkdownSubView }).editMode;
    return this.captureScroll(editMode);
  }

  rememberScroll(sourcePath: string, scroll: number): void {
    if (!Number.isFinite(scroll) || scroll < 0) {
      return;
    }
    this.touch(sourcePath);
    this.scrollByPath.set(sourcePath, scroll);
  }

  getRememberedScroll(sourcePath: string): number | null {
    const saved = this.scrollByPath.get(sourcePath);
    if (saved === undefined || !Number.isFinite(saved) || saved < 0) {
      return null;
    }
    return saved;
  }

  /**
   * Prefer a previously remembered non-zero scroll, then live subview scroll.
   * Returns null when unknown — callers must not treat that as "go to top".
   */
  resolveScrollRestore(view: MarkdownView, sourcePath: string): number | null {
    const saved = this.getRememberedScroll(sourcePath);
    if (saved !== null && saved > 0) {
      return saved;
    }

    const current = this.captureScroll(view.currentMode);
    if (current !== null && current > 0) {
      return current;
    }

    if (view.getMode() === "preview") {
      const edit = this.captureEditModeScroll(view);
      if (edit !== null && edit > 0) {
        return edit;
      }
    } else {
      const preview = this.captureScroll(view.previewMode);
      if (preview !== null && preview > 0) {
        return preview;
      }
    }

    return null;
  }

  applyScrollToMode(
    mode: MarkdownSubView | null | undefined,
    sourcePath: string,
    scroll: number
  ): void {
    // Never apply 0 — that forces the view to the top and fights Obsidian.
    if (!mode || !Number.isFinite(scroll) || scroll <= 0) {
      return;
    }
    const apply = (): void => {
      try {
        mode.applyScroll(scroll);
        this.scrollByPath.set(sourcePath, scroll);
      } catch {
        /* mode detached */
      }
    };
    apply();
    window.requestAnimationFrame(() => {
      apply();
      window.requestAnimationFrame(apply);
    });
    const schedule = (delayMs: number): void => {
      const id = window.setTimeout(() => {
        this.scrollRetryTimers.delete(id);
        apply();
      }, delayMs);
      this.scrollRetryTimers.add(id);
    };
    schedule(50);
    schedule(150);
    schedule(300);
  }

  /** Restore reading-mode scroll after previewMode.set. */
  applyScroll(view: MarkdownView, sourcePath: string, scrollY: number): void {
    this.applyScrollToMode(view.previewMode, sourcePath, scrollY);
  }

  /** Strip Plume cache attrs so the next section post-process pass rebuilds blocks. */
  static invalidatePreviewDom(view: MarkdownView): void {
    for (const el of Array.from(
      view.previewMode.containerEl.querySelectorAll<HTMLElement>(
        "[data-plume-block-key], .plume-has-block"
      )
    )) {
      delete el.dataset.plumeBlockKey;
      el.classList.remove("plume-has-block");
    }
  }

  private touch(sourcePath: string): void {
    this.pathOrder.delete(sourcePath);
    this.pathOrder.set(sourcePath, true);
    while (this.pathOrder.size > PreviewDocumentSync.MAX_TRACKED_PATHS) {
      const oldest = this.pathOrder.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.deleteLive(oldest);
    }
  }
}
