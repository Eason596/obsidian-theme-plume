import { App, MarkdownView, TFile, setIcon } from "obsidian";
import { resolveNodeIcon } from "../icons";
import { scanCodeFences, decorateCodeBlockTitles } from "../render";
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
    const fences = scanCodeFences(fileText).filter(
      (f) => f.openLine >= lineStart && f.openLine <= lineEnd
    );
    if (fences.length === 0) {
      return;
    }
    decorateCodeBlockTitles(rootElement, fences, this.getDefaultIconMode());
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
        continue;
      }
      try {
        view.previewMode.rerender(true);
        this.dirtyPreviewFiles.delete(path);
      } catch (err) {
        console.error("[obsidian-plume] preview rerender failed", err);
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
          wrapper.replaceWith(pre);
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
      if (wrappers.length !== fences.length) {
        return;
      }
      for (let i = 0; i < wrappers.length; i += 1) {
        const wrapper = wrappers[i];
        const newTitle = fences[i].title as string;
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
