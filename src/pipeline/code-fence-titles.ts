import { App, MarkdownView, TFile, setIcon } from "obsidian";
import { resolveNodeIcon } from "../icons";
import { scanCodeFences, decorateCodeBlockTitles, decorateCodeBlockFeatures } from "../render";
import type { FileTreeIconMode } from "../types";
import { prepareIconifyIconElement, processIconifyIcons } from "../render/iconify-online";

/**
 * Obsidian treats fenced-code info strings (e.g. title="foo") as cosmetic and
 * does not re-run post-processors when only those change. This service tracks
 * title signatures per file and patches or forces preview rebuilds.
 */
export class CodeFenceTitleService {
  private lastTitleSig = new Map<string, string>();
  private dirtyPreviewFiles = new Set<string>();

  constructor(
    private readonly app: App,
    private getDefaultIconMode: () => FileTreeIconMode
  ) {}

  seedBaseline(file: TFile, text: string): void {
    const sig = this.buildTitleSignature(text);
    if (!this.lastTitleSig.has(file.path)) {
      this.lastTitleSig.set(file.path, sig);
    }
  }

  hasPendingDirty(sourcePath: string): boolean {
    return this.dirtyPreviewFiles.has(sourcePath);
  }

  clearPendingDirty(sourcePath: string): void {
    this.dirtyPreviewFiles.delete(sourcePath);
  }

  reconcileWithText(file: TFile, text: string): void {
    const fences = scanCodeFences(text).filter((f) => !!f.title);
    const sig = JSON.stringify(fences.map((f) => f.title ?? ""));
    const prevSig = this.lastTitleSig.get(file.path);
    const titlesChanged = prevSig !== undefined && prevSig !== sig;
    this.lastTitleSig.set(file.path, sig);

    if (titlesChanged) {
      this.dirtyPreviewFiles.add(file.path);
    }

    if (fences.length === 0) {
      this.stripTitleWrappersForFile(file);
      if (titlesChanged) {
        this.refreshDirtyPreviews();
      }
      return;
    }

    this.patchTitleWrappersForFile(file, fences);
    if (titlesChanged) {
      this.refreshDirtyPreviews();
    }
  }

  decorateSection(
    rootElement: HTMLElement,
    fileText: string,
    lineStart: number,
    lineEnd: number
  ): void {
    const all = scanCodeFences(fileText);
    let fences = all.filter((f) => f.openLine >= lineStart && f.openLine <= lineEnd);
    // When caller passed section-local markdown with absolute lineStart/lineEnd,
    // absolute filter yields nothing — fall back to all fences in the scanned text.
    if (fences.length === 0 && all.length > 0) {
      fences = all;
    }
    if (fences.length > 0) {
      decorateCodeBlockTitles(rootElement, fences, this.getDefaultIconMode());
    }
    // Always decorate with highlight.js (reading + live preview HTML fences)
    decorateCodeBlockFeatures(rootElement, fences);
  }

  refreshDirtyPreviews(): void {
    if (this.dirtyPreviewFiles.size === 0) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        continue;
      }
      const path = view.file?.path;
      if (!path || !this.dirtyPreviewFiles.has(path)) {
        continue;
      }
      if (view.getMode?.() !== "preview") {
        // Keep dirty so entering reading mode can force previewMode.set.
        continue;
      }
      try {
        // Soft invalidate — avoid previewMode.rerender(true) flash on layout-change.
        for (const el of Array.from(
          view.previewMode.containerEl.querySelectorAll<HTMLElement>(
            "[data-plume-block-key], .plume-has-block"
          )
        )) {
          delete el.dataset.plumeBlockKey;
          el.classList.remove("plume-has-block");
        }
        // In-place title patch already ran in reconcileWithText; do not clear
        // dirty here — mode-sync / flush owns clearing after a real sync.
      } catch (err) {
        console.error("[theme-plume] preview invalidate failed", err);
      }
    }
  }

  clear(): void {
    this.lastTitleSig.clear();
    this.dirtyPreviewFiles.clear();
  }

  private buildTitleSignature(text: string): string {
    const fences = scanCodeFences(text).filter((f) => !!f.title);
    return JSON.stringify(fences.map((f) => f.title ?? ""));
  }

  private stripTitleWrappersForFile(file: TFile): void {
    this.forEachPreviewOfFile(file, (preview) => {
      for (const wrapper of Array.from(
        preview.querySelectorAll<HTMLElement>(".vp-code-block-title")
      )) {
        const pre = wrapper.querySelector("pre");
        if (pre) {
          const shell = pre.closest(".vp-code-features") ?? pre;
          wrapper.replaceWith(shell);
          pre.removeAttribute("data-vp-code-title-done");
        }
      }
    });
  }

  private patchTitleWrappersForFile(
    file: TFile,
    fences: ReturnType<typeof scanCodeFences>
  ): void {
    this.forEachPreviewOfFile(file, (preview) => {
      const wrappers = Array.from(
        preview.querySelectorAll<HTMLElement>(".vp-code-block-title")
      );
      // Match by order among titled fences only; allow extra untitled code blocks.
      const titled = fences.filter((f) => !!f.title);
      if (wrappers.length === 0 || titled.length === 0) {
        return;
      }
      const n = Math.min(wrappers.length, titled.length);
      for (let i = 0; i < n; i += 1) {
        const wrapper = wrappers[i];
        const newTitle = titled[i].title as string;
        if (wrapper.dataset.title === newTitle) {
          continue;
        }
        wrapper.dataset.title = newTitle;
        const label = wrapper.querySelector<HTMLElement>(".vp-code-block-title-text");
        if (!label) {
          continue;
        }
        while (label.firstChild) {
          label.removeChild(label.firstChild);
        }
        const iconHost = document.createElement("span");
        iconHost.className = "vp-code-block-title-icon ft-icon";
        const desc = resolveNodeIcon(newTitle, "file", false, this.getDefaultIconMode());
        if (desc.colorClass) {
          iconHost.classList.add(desc.colorClass);
        }
        if (desc.iconifyId) {
          prepareIconifyIconElement(iconHost, desc.iconifyId);
          void processIconifyIcons(iconHost);
        } else {
          setIcon(iconHost, desc.icon);
        }
        label.appendChild(iconHost);
        label.appendChild(document.createTextNode(newTitle));
      }
    });
  }

  private forEachPreviewOfFile(file: TFile, fn: (preview: HTMLElement) => void): void {
    const seen = new Set<HTMLElement>();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        continue;
      }
      if (view.file?.path !== file.path) {
        continue;
      }
      const roots: Array<HTMLElement | undefined | null> = [
        view.previewMode?.containerEl,
        view.contentEl
      ];
      for (const root of roots) {
        if (!root || seen.has(root)) {
          continue;
        }
        seen.add(root);
        fn(root);
      }
    }
  }
}
