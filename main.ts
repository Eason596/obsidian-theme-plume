import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  getIconIds,
  normalizePath,
  requestUrl,
  type MarkdownPostProcessorContext
} from "obsidian";
import {
  normalizeCodeTreePath,
  parseAllBlocks,
  parseFileTreeRawContent
} from "./src/parser";
import { renderFileTreeInto, processBadges, processPlots, type BlockRenderContext } from "./src/render";
import { processIconifyIcons, setIconifyRequestUrl } from "./src/render/iconify-online";
import { PreviewPipeline } from "./src/pipeline/preview-pipeline";
import { PreviewDocumentSync } from "./src/pipeline/preview-sync";
import {
  DEFAULT_SETTINGS,
  type CodeTreeFileItem,
  type FileTreePluginSettings,
  type ParsedBlock
} from "./src/types";

const UNSUPPORTED_CODE_TREE_FILE_TYPES = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "avif",
  "webp",
  "mp3",
  "mp4",
  "ogg",
  "m3u8",
  "m3u",
  "flv",
  "webm",
  "wav",
  "flac",
  "aac",
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx"
]);

interface CachedParse {
  text: string;
  blocks: ParsedBlock[];
}

export default class ObsidianPlumePlugin extends Plugin {
  settings: FileTreePluginSettings = { ...DEFAULT_SETTINGS };

  private parseCacheByPath = new Map<string, CachedParse>();
  private readonly previewSync = new PreviewDocumentSync();
  private contentEpochByPath = new Map<string, number>();
  private markdownModeByPath = new Map<string, string>();
  private flushTimer: number | null = null;
  private flushPath: string | null = null;
  private modeSyncTimer: number | null = null;
  private layoutModeScanTimer: number | null = null;
  private pipeline!: PreviewPipeline;

  private static readonly MODE_SYNC_DELAY_MS = 32;
  private static readonly MODE_SYNC_RETRY_MS = 56;
  private static readonly MODE_SYNC_MAX_ATTEMPTS = 4;
  private static readonly LAYOUT_MODE_SCAN_MS = 40;
  private static readonly FLUSH_DEBOUNCE_MS = 120;

  async onload(): Promise<void> {
    await this.loadSettings();
    setIconifyRequestUrl(requestUrl);

    this.pipeline = new PreviewPipeline({
      plugin: this,
      getDefaultIconMode: () => this.settings.defaultIconMode,
      getOrParseBlocks: (text, sourcePath) => this.getOrParseBlocks(text, sourcePath),
      getDocumentText: (sourcePath, snapshot) => this.previewSync.getLiveText(sourcePath, snapshot),
      isDocumentDirty: (sourcePath) => this.previewSync.isDirty(sourcePath),
      clearDocumentDirty: (sourcePath) => this.previewSync.clearDirty(sourcePath),
      buildRenderContext: (sourcePath, ctx) => this.buildRenderContext(sourcePath, ctx)
    });

    this.addSettingTab(new PlumeSettingTab(this.app, this));

    this.addCommand({
      id: "self-check",
      name: "Self Check",
      callback: () => {
        const previewCount = document.querySelectorAll(".markdown-preview-view").length;
        new Notice(
          `Theme Plume v${this.manifest.version} loaded. mode=${this.settings.defaultIconMode}, previews=${previewCount}, icons=${getIconIds().length}`
        );
      }
    });

    this.addCommand({
      id: "force-refresh-preview",
      name: "Force Refresh Current Preview",
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) {
          new Notice("No active markdown view.");
          return;
        }
        this.previewSync.markDirty(view.file.path, view.editor.getValue());
        this.fullRerenderPreviewView(view);
        new Notice("Theme Plume: preview refreshed.");
      }
    });

    this.registerMarkdownPostProcessor(async (rootElement, ctx) => {
      await this.pipeline.processSection(rootElement, ctx);
    });

    this.registerMarkdownPostProcessor(async (rootElement, ctx) => {
      await processBadges(rootElement, {
        app: this.app,
        sourcePath: ctx.sourcePath,
        component: this,
        postProcessorCtx: ctx
      });
      await processIconifyIcons(rootElement);
      processPlots(rootElement);
    });

    const fileTreeBlockProcessor = (source: string, element: HTMLElement): void => {
      const nodes = parseFileTreeRawContent(source);
      if (nodes.length === 0) {
        element.createSpan({ text: source });
        return;
      }
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      element.empty();
      renderFileTreeInto(element, {
        nodes,
        attrs: { icon: this.settings.defaultIconMode },
        defaultIconMode: this.settings.defaultIconMode,
        markdownContext: {
          app: this.app,
          sourcePath,
          component: this
        }
      });
    };

    this.registerMarkdownCodeBlockProcessor("file-tree", fileTreeBlockProcessor);
    this.registerMarkdownCodeBlockProcessor("filetree", fileTreeBlockProcessor);
    this.registerMarkdownCodeBlockProcessor("file_tree", fileTreeBlockProcessor);

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.parseCacheByPath.delete(file.path);
          if (file.extension === "md") {
            this.pipeline.invalidateBlocksForFile(file.path);
          }
        }
        if (file instanceof TFile && file.extension === "md") {
          void this.app.vault.cachedRead(file).then((text) => {
            this.previewSync.markDirty(file.path, text);
            this.bumpContentEpoch(file.path);
            this.pipeline.codeFenceTitles.reconcileWithText(file, text);
            this.scheduleFlushPlumeBlocks(file.path);
          });
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        const file = info?.file ?? this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || file.extension !== "md") {
          return;
        }
        const text = editor.getValue();
        this.previewSync.markDirty(file.path, text);
        this.bumpContentEpoch(file.path);
        this.parseCacheByPath.delete(file.path);
        this.pipeline.codeFenceTitles.reconcileWithText(file, text);
        this.scheduleFlushPlumeBlocks(file.path);
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.pipeline.codeFenceTitles.refreshDirtyPreviews();
        this.queueLayoutModeScan();
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.pipeline.codeFenceTitles.refreshDirtyPreviews();
        this.queueModePreviewSync();
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") {
          return;
        }
        void this.app.vault.cachedRead(file).then((text) => {
          this.previewSync.setLiveText(file.path, text);
          this.parseCacheByPath.delete(file.path);
          this.pipeline.codeFenceTitles.seedBaseline(file, text);
        });
      })
    );

    this.registerDomEvent(document, "scroll", (event) => {
      this.rememberPreviewScrollFromEvent(event);
    }, true);
  }

  onunload(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.modeSyncTimer !== null) {
      window.clearTimeout(this.modeSyncTimer);
      this.modeSyncTimer = null;
    }
    if (this.layoutModeScanTimer !== null) {
      window.clearTimeout(this.layoutModeScanTimer);
      this.layoutModeScanTimer = null;
    }
    this.parseCacheByPath.clear();
    this.contentEpochByPath.clear();
    this.markdownModeByPath.clear();
    this.pipeline?.clear();
  }

  private bumpContentEpoch(sourcePath: string): number {
    const next = (this.contentEpochByPath.get(sourcePath) ?? 0) + 1;
    this.contentEpochByPath.set(sourcePath, next);
    return next;
  }

  /**
   * Soft refresh: invalidate Plume section caches and re-run leading post-processors only.
   * Does not call previewMode.set/rerender — preserves scroll and avoids flicker.
   */
  private flushPlumeBlocks(sourcePath: string): void {
    this.parseCacheByPath.delete(sourcePath);
    this.pipeline.invalidateBlocksForFile(sourcePath);

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.file?.path !== sourcePath) {
        continue;
      }
      if (view.getMode() === "source") {
        continue;
      }
      PreviewDocumentSync.invalidatePreviewDom(view);
      this.pipeline.refreshLeadingSectionsForFile(sourcePath);
    }
  }

  private scheduleFlushPlumeBlocks(sourcePath: string): void {
    this.flushPath = sourcePath;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      const path = this.flushPath;
      if (!path) {
        return;
      }
      this.flushPlumeBlocks(path);
    }, ObsidianPlumePlugin.FLUSH_DEBOUNCE_MS);
  }

  /** Last resort: full Obsidian preview rebuild (command palette / broken state). */
  private fullRerenderPreviewView(view: MarkdownView, restoreScrollY?: number): void {
    const path = view.file?.path;
    if (!path) {
      return;
    }
    const text = view.editor.getValue();
    this.previewSync.setLiveText(path, text);
    this.parseCacheByPath.delete(path);
    this.pipeline.clear();

    const scrollY = restoreScrollY ?? this.previewSync.resolveScrollRestore(view, path);
    PreviewDocumentSync.invalidatePreviewDom(view);
    view.previewMode.set(text, true);
    view.previewMode.rerender(true);
    window.requestAnimationFrame(() => {
      this.previewSync.applyScroll(view, path, scrollY);
    });
  }

  private rememberPreviewScrollFromEvent(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.getMode() !== "preview" || !view.file) {
        continue;
      }
      const container = view.previewMode.containerEl;
      if (target === container || container.contains(target)) {
        try {
          this.previewSync.rememberScroll(view.file.path, view.previewMode.getScroll());
        } catch {
          /* preview detached */
        }
        return;
      }
    }
  }

  /**
   * Ctrl+E toggles source/preview in the same leaf — often no active-leaf-change.
   * Scan all markdown leaves on debounced layout-change for mode transitions.
   */
  private queueLayoutModeScan(): void {
    if (this.layoutModeScanTimer !== null) {
      window.clearTimeout(this.layoutModeScanTimer);
    }
    this.layoutModeScanTimer = window.setTimeout(() => {
      this.layoutModeScanTimer = null;
      this.scanMarkdownModeTransitions();
    }, ObsidianPlumePlugin.LAYOUT_MODE_SCAN_MS);
  }

  private queueModePreviewSync(): void {
    if (this.modeSyncTimer !== null) {
      window.clearTimeout(this.modeSyncTimer);
    }
    this.modeSyncTimer = window.setTimeout(() => {
      this.modeSyncTimer = null;
      this.scanMarkdownModeTransitions();
      this.applyPreviewSyncAfterModeChange(0);
    }, ObsidianPlumePlugin.MODE_SYNC_DELAY_MS);
  }

  private scanMarkdownModeTransitions(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file || view.file.extension !== "md") {
        continue;
      }
      this.syncMarkdownViewMode(view);
    }
  }

  /** Detect source↔preview; on enter preview flush Plume blocks only (no full rerender). */
  private syncMarkdownViewMode(view: MarkdownView): void {
    const file = view.file;
    if (!file) {
      return;
    }

    const path = file.path;
    const mode = view.getMode();
    const prev = this.markdownModeByPath.get(path);
    this.previewSync.setLiveText(path, view.editor.getValue());

    const enteringPreview = mode === "preview" && prev !== "preview";
    const needsFlush = mode === "preview" && (enteringPreview || this.previewSync.isDirty(path));

    if (prev === mode && !needsFlush) {
      return;
    }

    if (prev === "preview" && mode === "source") {
      try {
        this.previewSync.rememberScroll(path, view.previewMode.getScroll());
      } catch {
        /* preview detached */
      }
    } else if (mode === "preview") {
      try {
        this.previewSync.rememberScroll(path, view.previewMode.getScroll());
      } catch {
        /* preview detached */
      }
    }

    this.markdownModeByPath.set(path, mode);

    if (needsFlush) {
      this.bumpContentEpoch(path);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (enteringPreview) {
            const freshView = this.app.workspace.getLeavesOfType("markdown")
              .map((leaf) => leaf.view)
              .find((candidate): candidate is MarkdownView => {
                return candidate instanceof MarkdownView
                  && candidate.file?.path === path
                  && candidate.getMode() === "preview";
              });
            if (freshView) {
              const scrollY = this.previewSync.resolveScrollRestore(freshView, path);
              this.fullRerenderPreviewView(freshView, scrollY);
              return;
            }
          }
          this.flushPlumeBlocks(path);
        });
      });
    }
  }

  /** Retry mode detection when Ctrl+E fires before getMode() becomes preview. */
  private applyPreviewSyncAfterModeChange(attempt: number): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.file.extension !== "md") {
      return;
    }

    this.syncMarkdownViewMode(view);

    if (view.getMode() === "preview" || attempt + 1 >= ObsidianPlumePlugin.MODE_SYNC_MAX_ATTEMPTS) {
      return;
    }

    window.setTimeout(
      () => this.applyPreviewSyncAfterModeChange(attempt + 1),
      ObsidianPlumePlugin.MODE_SYNC_RETRY_MS
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private buildRenderContext(
    sourcePath: string,
    ctx: MarkdownPostProcessorContext
  ): BlockRenderContext {
    return {
      app: this.app,
      sourcePath,
      component: this,
      postProcessorCtx: ctx,
      defaultIconMode: this.settings.defaultIconMode,
      settings: {
        defaultIconMode: this.settings.defaultIconMode,
        persistTabSelection: this.settings.persistTabSelection,
        collapseLazyBodies: this.settings.collapseLazyBodies,
        tabsLazyPanels: this.settings.tabsLazyPanels,
        debugRender: this.settings.debugRender
      },
      contentEpoch: this.contentEpochByPath.get(sourcePath) ?? 0,
      resolveCodeTreeEmbed: (sp, dirPath) => this.collectEmbedFiles(sp, dirPath)
    };
  }

  private getOrParseBlocks(text: string, sourcePath: string): ParsedBlock[] {
    const cached = this.parseCacheByPath.get(sourcePath);
    if (cached && cached.text === text) {
      return cached.blocks;
    }

    const blocks = parseAllBlocks(text, this.settings.defaultIconMode);
    this.parseCacheByPath.set(sourcePath, { text, blocks });
    return blocks;
  }

  private async collectEmbedFiles(
    sourcePath: string,
    dirPath: string
  ): Promise<CodeTreeFileItem[] | null> {
    const resolvedDirPath = this.resolveCodeTreeEmbedDirectory(sourcePath, dirPath);
    if (resolvedDirPath == null) {
      return null;
    }

    const folder = this.resolveCodeTreeEmbedFolder(resolvedDirPath);
    if (!(folder instanceof TFolder)) {
      return null;
    }

    const entries = this.collectCodeTreeDirectoryItems(folder);
    if (entries.length === 0) {
      return null;
    }

    const files: CodeTreeFileItem[] = [];
    for (const entry of entries) {
      const extension = this.getCodeTreeFileExtension(entry.relativePath);
      if (UNSUPPORTED_CODE_TREE_FILE_TYPES.has(extension)) {
        continue;
      }

      try {
        const content = await this.app.vault.cachedRead(entry.file);
        files.push({
          filepath: entry.relativePath,
          language: extension || "txt",
          content
        });
      } catch {
        continue;
      }
    }

    return files.length > 0 ? files : null;
  }

  private getParentDirPath(sourcePath: string): string {
    const normalized = normalizeCodeTreePath(sourcePath);
    if (!normalized) {
      return "";
    }
    const index = normalized.lastIndexOf("/");
    if (index === -1) {
      return "";
    }
    return normalized.slice(0, index);
  }

  private resolveCodeTreeEmbedDirectory(sourcePath: string, dirPath: string): string | null {
    const raw = dirPath.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith("/")) {
      return normalizePath(normalizeCodeTreePath(raw));
    }
    if (raw.startsWith("@source/")) {
      return normalizePath(normalizeCodeTreePath(raw.slice("@source/".length)));
    }
    if (raw.startsWith("./") || raw.startsWith("../")) {
      const baseDir = this.getParentDirPath(sourcePath);
      const joined = baseDir ? `${baseDir}/${raw}` : raw;
      return normalizePath(joined);
    }
    return normalizePath(normalizeCodeTreePath(raw));
  }

  private resolveCodeTreeEmbedFolder(resolvedDirPath: string): TFolder | null {
    const normalized = normalizeCodeTreePath(resolvedDirPath);
    const root = this.app.vault.getRoot();

    if (!normalized || normalized === ".") {
      return root;
    }

    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFolder) {
      return direct;
    }

    const vaultName = normalizeCodeTreePath(this.app.vault.getName());
    if (vaultName && (normalized === vaultName || normalized.startsWith(`${vaultName}/`))) {
      const stripped = normalized === vaultName ? "" : normalized.slice(vaultName.length + 1);
      if (!stripped) {
        return root;
      }
      const fallback = this.app.vault.getAbstractFileByPath(stripped);
      if (fallback instanceof TFolder) {
        return fallback;
      }
    }

    return null;
  }

  private getCodeTreeFileExtension(filepath: string): string {
    const normalized = normalizeCodeTreePath(filepath);
    const filename = normalized.split("/").pop() ?? "";
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex >= filename.length - 1) {
      return "";
    }
    return filename.slice(dotIndex + 1).toLowerCase();
  }

  private collectCodeTreeDirectoryItems(
    folder: TFolder
  ): { file: TFile; relativePath: string }[] {
    const root = normalizePath(folder.path);
    const items: { file: TFile; relativePath: string }[] = [];

    const walk = (current: TFolder): void => {
      for (const child of current.children) {
        if (child instanceof TFolder) {
          if (child.name === "node_modules") {
            continue;
          }
          walk(child);
          continue;
        }
        if (!(child instanceof TFile)) {
          continue;
        }
        if (child.name === ".DS_Store" || child.name === ".gitkeep") {
          continue;
        }

        const relativePath = root
          ? normalizeCodeTreePath(child.path.slice(root.length + 1))
          : normalizeCodeTreePath(child.path);
        if (!relativePath) {
          continue;
        }

        items.push({ file: child, relativePath });
      }
    };

    walk(folder);

    items.sort((a, b) => {
      const depthA = a.relativePath.split("/").length;
      const depthB = b.relativePath.split("/").length;
      if (depthA !== depthB) {
        return depthB - depthA;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });

    return items;
  }
}

class PlumeSettingTab extends PluginSettingTab {
  plugin: ObsidianPlumePlugin;

  constructor(app: App, plugin: ObsidianPlumePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Theme Plume").setHeading();
    containerEl.createEl("p", {
      text: "VuePress Theme Plume markdown extensions for Obsidian reading view."
    });

    new Setting(containerEl)
      .setName("Default file-tree icon mode")
      .setDesc('Used when ::: file-tree does not set icon="simple" or icon="colored".')
      .addDropdown((dropdown) => {
        dropdown.addOption("colored", "Colored");
        dropdown.addOption("simple", "Simple");
        dropdown.setValue(this.plugin.settings.defaultIconMode);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultIconMode =
            value as FileTreePluginSettings["defaultIconMode"];
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Remember tab selection")
      .setDesc("Persist active tab for ::: tabs#id and ::: code-tabs#id across sessions (localStorage).")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.persistTabSelection);
        toggle.onChange(async (value) => {
          this.plugin.settings.persistTabSelection = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Lazy collapse bodies")
      .setDesc("Defer rendering collapse panel content until the panel is opened.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.collapseLazyBodies);
        toggle.onChange(async (value) => {
          this.plugin.settings.collapseLazyBodies = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Lazy tab panels")
      .setDesc(
        "Render only the active ::: tabs / ::: code-tabs panel; others load when selected. The active panel always renders before the block is shown."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.tabsLazyPanels);
        toggle.onChange(async (value) => {
          this.plugin.settings.tabsLazyPanels = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Debug render errors")
      .setDesc("Show a short error hint in preview when a Plume block fails to render.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.debugRender);
        toggle.onChange(async (value) => {
          this.plugin.settings.debugRender = value;
          await this.plugin.saveSettings();
        });
      });
  }
}
