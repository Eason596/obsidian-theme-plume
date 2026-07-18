import { App, MarkdownView, TFile, setIcon, type Component } from "obsidian";
import { resolveNodeIcon } from "../icons";
import {
  scanCodeFences,
  scanCodeFenceTitles,
  decorateCodeBlockTitles,
  decorateCodeBlockFeatures,
  sectionNeedsFenceDecorate
} from "../render";
import type { FileTreeIconMode } from "../types";
import { prepareIconifyIconElement, processIconifyIcons } from "../render/iconify-online";

const RECONCILE_DEBOUNCE_MS = 80;
const MAX_TITLE_SIG_ENTRIES = 128;

/**
 * Obsidian treats fenced-code info strings (e.g. title="foo") as cosmetic and
 * does not re-run post-processors when only those change. This service tracks
 * title signatures per file and patches or forces preview rebuilds.
 */
export class CodeFenceTitleService {
  private lastTitleSig = new Map<string, string>();
  private dirtyPreviewFiles = new Set<string>();
  private reconcileTimers = new Map<string, number>();

  constructor(
    private readonly app: App,
    private getDefaultIconMode: () => FileTreeIconMode
  ) {}

  seedBaseline(file: TFile, text: string): void {
    const sig = this.buildTitleSignature(text);
    if (!this.lastTitleSig.has(file.path)) {
      this.rememberTitleSig(file.path, sig);
    }
  }

  hasPendingDirty(sourcePath: string): boolean {
    return this.dirtyPreviewFiles.has(sourcePath);
  }

  clearPendingDirty(sourcePath: string): void {
    this.dirtyPreviewFiles.delete(sourcePath);
  }

  forgetFile(sourcePath: string): void {
    const timer = this.reconcileTimers.get(sourcePath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.reconcileTimers.delete(sourcePath);
    }
    this.lastTitleSig.delete(sourcePath);
    this.dirtyPreviewFiles.delete(sourcePath);
  }

  /** Debounced title reconcile for high-frequency editor-change. */
  scheduleReconcileWithText(file: TFile, text: string): void {
    const prev = this.reconcileTimers.get(file.path);
    if (prev !== undefined) {
      window.clearTimeout(prev);
    }
    const id = window.setTimeout(() => {
      this.reconcileTimers.delete(file.path);
      this.reconcileWithText(file, text);
    }, RECONCILE_DEBOUNCE_MS);
    this.reconcileTimers.set(file.path, id);
  }

  reconcileWithText(file: TFile, text: string): void {
    const titled = scanCodeFenceTitles(text).filter((f) => !!f.title);
    const sig = JSON.stringify(titled.map((f) => f.title ?? ""));
    const prevSig = this.lastTitleSig.get(file.path);
    const titlesChanged = prevSig !== undefined && prevSig !== sig;
    this.rememberTitleSig(file.path, sig);

    if (titlesChanged) {
      this.dirtyPreviewFiles.add(file.path);
    }

    if (titled.length === 0) {
      this.stripTitleWrappersForFile(file);
      if (titlesChanged) {
        this.dirtyPreviewFiles.delete(file.path);
      }
      return;
    }

    const patched = this.patchTitleWrappersForFile(file, titled);
    if (titlesChanged && patched) {
      // Only clear dirty when labels were updated in place. If no title bars
      // exist yet, keep dirty so mode-sync / flush can force a real rebuild.
      this.dirtyPreviewFiles.delete(file.path);
    }
  }

  decorateSection(
    rootElement: HTMLElement,
    fileText: string,
    lineStart: number,
    lineEnd: number,
    component?: Component
  ): Promise<void> {
    const all = scanCodeFences(fileText);
    const sectionFences = all.filter(
      (f) => f.openLine >= lineStart && f.openLine <= lineEnd
    );
    // Titles must stay section-scoped. Falling back to `all` on empty sections
    // mis-pairs the first titled fence (e.g. hello.js) onto the wrong place and
    // leaves orphan title bars above the document heading.
    decorateCodeBlockTitles(
      rootElement,
      sectionFences,
      this.getDefaultIconMode()
    );
    // Prefer section fences; fall back to full-file only when pairing fails.
    return decorateCodeBlockFeatures(
      rootElement,
      sectionFences,
      component,
      all.length > sectionFences.length ? { fallbackFences: all } : undefined
    );
  }

  /** Whether soft-flush skip path should re-run title/feature decoration. */
  sectionNeedsDecorate(
    rootElement: HTMLElement,
    fileText: string,
    lineStart: number,
    lineEnd: number
  ): boolean {
    const all = scanCodeFences(fileText);
    const sectionFences = all.filter(
      (f) => f.openLine >= lineStart && f.openLine <= lineEnd
    );
    return sectionNeedsFenceDecorate(
      rootElement,
      sectionFences.length > 0 ? sectionFences : all
    );
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
      // Only clear dirty when title bars exist to receive in-place patches.
      // Zero wrappers → keep dirty for the next flush / previewMode.set.
      const hasTitleBars = !!view.previewMode.containerEl.querySelector(
        ".vp-code-block-title"
      );
      if (hasTitleBars) {
        this.dirtyPreviewFiles.delete(path);
      }
    }
  }

  private rememberTitleSig(sourcePath: string, sig: string): void {
    if (this.lastTitleSig.has(sourcePath)) {
      this.lastTitleSig.delete(sourcePath);
    }
    this.lastTitleSig.set(sourcePath, sig);
    while (this.lastTitleSig.size > MAX_TITLE_SIG_ENTRIES) {
      const oldest = this.lastTitleSig.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.lastTitleSig.delete(oldest);
      this.dirtyPreviewFiles.delete(oldest);
    }
  }

  clear(): void {
    for (const id of this.reconcileTimers.values()) {
      window.clearTimeout(id);
    }
    this.reconcileTimers.clear();
    this.lastTitleSig.clear();
    this.dirtyPreviewFiles.clear();
  }

  private buildTitleSignature(text: string): string {
    const fences = scanCodeFenceTitles(text).filter((f) => !!f.title);
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

  /** @returns true when at least one title bar was present to patch. */
  private patchTitleWrappersForFile(
    file: TFile,
    titled: Array<{ title?: string }>
  ): boolean {
    let patchedAny = false;
    this.forEachPreviewOfFile(file, (preview) => {
      const wrappers = Array.from(
        preview.querySelectorAll<HTMLElement>(".vp-code-block-title")
      );
      // Match by order among titled fences only; allow extra untitled code blocks.
      if (wrappers.length === 0 || titled.length === 0) {
        return;
      }
      patchedAny = true;
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
    return patchedAny;
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
