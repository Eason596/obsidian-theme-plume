import type { MarkdownView } from "obsidian";

/**
 * Keeps editor buffer + dirty state; refreshes Plume blocks without previewMode.set/rerender.
 * Avoids scroll jumps and flicker from full preview rebuilds.
 */
export class PreviewDocumentSync {
  private readonly liveText = new Map<string, string>();
  private readonly dirtyPaths = new Set<string>();
  private readonly scrollByPath = new Map<string, number>();

  setLiveText(sourcePath: string, text: string): void {
    this.liveText.set(sourcePath, text);
  }

  markDirty(sourcePath: string, text: string): void {
    this.liveText.set(sourcePath, text);
    this.dirtyPaths.add(sourcePath);
  }

  isDirty(sourcePath: string): boolean {
    return this.dirtyPaths.has(sourcePath);
  }

  clearDirty(sourcePath: string): void {
    this.dirtyPaths.delete(sourcePath);
  }

  getLiveText(sourcePath: string, fallback: string): string {
    return this.liveText.get(sourcePath) ?? fallback;
  }

  deleteLive(sourcePath: string): void {
    this.liveText.delete(sourcePath);
    this.dirtyPaths.delete(sourcePath);
    this.scrollByPath.delete(sourcePath);
  }

  rememberScroll(sourcePath: string, scrollY: number): void {
    if (scrollY > 0) {
      this.scrollByPath.set(sourcePath, scrollY);
    }
  }

  resolveScrollRestore(view: MarkdownView, sourcePath: string): number {
    try {
      const live = view.previewMode.getScroll();
      if (live > 0) {
        return live;
      }
    } catch {
      /* ignore */
    }
    const saved = this.scrollByPath.get(sourcePath);
    if (saved !== undefined && saved > 0) {
      return saved;
    }
    try {
      return view.editor.getScrollInfo().top;
    } catch {
      return 0;
    }
  }

  applyScroll(view: MarkdownView, sourcePath: string, scrollY: number): void {
    if (scrollY <= 0) {
      return;
    }
    const apply = (): void => {
      if (!view.previewMode.containerEl.isConnected) {
        return;
      }
      view.previewMode.applyScroll(scrollY);
      this.scrollByPath.set(sourcePath, scrollY);
    };
    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    window.setTimeout(apply, 50);
    window.setTimeout(apply, 150);
    window.setTimeout(apply, 300);
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
}
