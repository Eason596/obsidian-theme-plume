import {
  App,
  MarkdownView,
  MarkdownRenderChild,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  getLanguage,
  getIconIds,
  normalizePath,
  requestUrl,
  type Component,
  type MarkdownPostProcessorContext
} from "obsidian";
import {
  normalizeCodeTreePath,
  parseAllBlocks,
  parseFileTreeRawContent
} from "./src/parser";
import {
  renderFileTreeInto,
  refreshDecoratedCodeFences,
  type BlockRenderContext
} from "./src/render";
import { enrichRenderedRoot } from "./src/render/enrichment";
import {
  clearIconifyCache,
  setIconifyRequestUrl
} from "./src/render/iconify-online";
import { clearFaviconCache, clearFaviconRetryTimers } from "./src/render/link-favicons";
import { configureQrcodeLoader } from "./src/render/qrcode-loader";
import { hashString } from "./src/utils/hash";
import { plumeInlineWidgetsExtension } from "./src/editor/inline-widgets";
import { getSettingsMessages } from "./src/settings/i18n";
import { PreviewPipeline } from "./src/pipeline/preview-pipeline";
import {
  PreviewDocumentSync,
  entersPreviewTarget,
  type MarkdownViewState
} from "./src/pipeline/preview-sync";
import {
  DEFAULT_SETTINGS,
  type CodeTreeFileItem,
  type FileTreePluginSettings,
  type ParsedBlock,
  type SettingsLanguage
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

interface CodeTreeDirectoryEntry {
  file: TFile;
  relativePath: string;
}

export default class ObsidianPlumePlugin extends Plugin {
  settings: FileTreePluginSettings = { ...DEFAULT_SETTINGS };

  private parseCacheByPath = new Map<string, CachedParse>();
  /** Nested / card-body parse results keyed by content hash (not file path). */
  private nestedParseCache = new Map<string, ParsedBlock[]>();
  private readonly previewSync = new PreviewDocumentSync();
  private contentEpochByPath = new Map<string, number>();
  private markdownModeByView = new WeakMap<MarkdownView, MarkdownViewState>();
  private flushTimersByPath = new Map<string, number>();
  private codeTreeCache = new Map<string, Promise<CodeTreeFileItem[] | null>>();
  private modeSyncTimer: number | null = null;
  private modeSyncRetryTimer: number | null = null;
  private layoutModeScanTimer: number | null = null;
  private pipeline!: PreviewPipeline;
  /** Last known Obsidian dark mode — ignore startup css-change storms. */
  private lastThemeDark: boolean | null = null;
  private cssChangeTimer: number | null = null;
  private layoutReadyAt = 0;
  /** One-macrotask cache for isRenderTargetCurrent leaf scans. */
  private viewContainmentCache: Array<{ path: string; containers: HTMLElement[] }> | null = null;

  private static readonly MODE_SYNC_DELAY_MS = 32;
  private static readonly MODE_SYNC_RETRY_MS = 56;
  private static readonly MODE_SYNC_MAX_ATTEMPTS = 4;
  private static readonly LAYOUT_MODE_SCAN_MS = 40;
  private static readonly FLUSH_DEBOUNCE_MS = 120;
  private static readonly MAX_PARSE_CACHE_ENTRIES = 128;
  private static readonly MAX_NESTED_PARSE_CACHE_ENTRIES = 64;
  private static readonly MAX_CONTENT_EPOCH_ENTRIES = 256;
  private static readonly MAX_CODE_TREE_CACHE_ENTRIES = 32;
  private static readonly MAX_CODE_TREE_FILES = 200;
  private static readonly MAX_CODE_TREE_FILE_BYTES = 512 * 1024;
  private static readonly MAX_CODE_TREE_TOTAL_BYTES = 5 * 1024 * 1024;
  private static readonly CODE_TREE_READ_CONCURRENCY = 8;

  async onload(): Promise<void> {
    await this.loadSettings();
    setIconifyRequestUrl(requestUrl);
    configureQrcodeLoader(this.app, this.manifest.dir ?? "");
    this.registerEditorExtension(plumeInlineWidgetsExtension);

    this.pipeline = new PreviewPipeline({
      plugin: this,
      getDefaultIconMode: () => this.settings.defaultIconMode,
      getOrParseBlocks: (text, sourcePath) => this.getOrParseBlocks(text, sourcePath),
      getDocumentText: (sourcePath, snapshot) => this.previewSync.getLiveText(sourcePath, snapshot),
      isRenderTargetCurrent: (rootElement, sourcePath) =>
        this.isRenderTargetCurrent(rootElement, sourcePath),
      isDocumentDirty: (sourcePath) => this.previewSync.isDirty(sourcePath),
      clearDocumentDirty: (sourcePath, renderedText) =>
        this.previewSync.clearDirtyIfMatches(sourcePath, renderedText),
      buildRenderContext: (sourcePath, ctx, component) =>
        this.buildRenderContext(sourcePath, ctx, component)
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

    // Reading view and Live Preview share the same on-demand Shiki pipeline.
    this.registerMarkdownPostProcessor(async (rootElement, ctx) => {
      await this.pipeline.processSection(rootElement, ctx);
    });

    this.registerMarkdownPostProcessor(async (rootElement, ctx) => {
      // Leading Plume hosts enrich after async section commit — do not double-apply.
      // Nested MarkdownRenderer roots (inside cards) still need this pass.
      if (
        rootElement.classList.contains("plume-has-block")
        || rootElement.classList.contains("plume-section-absorbed")
      ) {
        return;
      }
      const belongsToCurrentSource = (): boolean => {
        const ownerPath = rootElement.dataset.plumeSourcePath;
        return !ownerPath || ownerPath === ctx.sourcePath;
      };
      if (!belongsToCurrentSource()) return;
      const renderScope = new MarkdownRenderChild(rootElement);
      ctx.addChild(renderScope);
      await enrichRenderedRoot(rootElement, {
        app: this.app,
        sourcePath: ctx.sourcePath,
        component: renderScope,
        postProcessorCtx: ctx,
        sourceText: this.previewSync.getLiveText(ctx.sourcePath, ""),
        isCurrent: belongsToCurrentSource
      });
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
    this.registerMarkdownCodeBlockProcessor("tree", fileTreeBlockProcessor);

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.invalidateCodeTreeCacheForPath(file.path);
          this.parseCacheByPath.delete(file.path);
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
      this.app.vault.on("delete", (file) => {
        this.invalidateCodeTreeCacheForPath(file.path);
        this.forgetPath(file.path);
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.invalidateCodeTreeCacheForPath(oldPath);
        if (file instanceof TFile) {
          this.invalidateCodeTreeCacheForPath(file.path);
        }
        this.forgetPath(oldPath);
        if (file instanceof TFile) {
          this.parseCacheByPath.delete(file.path);
          this.pipeline.invalidateBlocksForFile(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        this.invalidateCodeTreeCacheForPath(file.path);
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
        this.pipeline.codeFenceTitles.scheduleReconcileWithText(file, text);
        this.scheduleFlushPlumeBlocks(file.path);
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.viewContainmentCache = null;
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
          this.queueModePreviewSync();
        });
      })
    );

    this.registerDomEvent(document, "scroll", (event) => {
      this.rememberPreviewScrollFromEvent(event);
    }, true);

    // Only soft-refresh on real light/dark flips (startup css-change is ignored).
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.onCssChange();
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.layoutReadyAt = Date.now();
      this.lastThemeDark = document.body.classList.contains("theme-dark");
    });
  }

  private onCssChange(): void {
    if (this.layoutReadyAt > 0 && Date.now() - this.layoutReadyAt < 3000) {
      this.lastThemeDark = document.body.classList.contains("theme-dark");
      return;
    }

    const dark = document.body.classList.contains("theme-dark");
    if (this.lastThemeDark === null) {
      this.lastThemeDark = dark;
      return;
    }
    if (this.lastThemeDark === dark) {
      return;
    }
    this.lastThemeDark = dark;

    if (this.cssChangeTimer !== null) {
      window.clearTimeout(this.cssChangeTimer);
    }
    this.cssChangeTimer = window.setTimeout(() => {
      this.cssChangeTimer = null;
      // Recolor Reading view and Live Preview from the same Shiki theme.
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        const view = leaf.view;
        if (!(view instanceof MarkdownView) || !view.file) continue;
        this.pipeline.refreshLeadingSectionsForFile(view.file.path);
        void refreshDecoratedCodeFences(view.contentEl);
        if (view.previewMode.containerEl !== view.contentEl) {
          void refreshDecoratedCodeFences(view.previewMode.containerEl);
        }
      }
    }, 200);
  }

  onunload(): void {
    if (this.cssChangeTimer !== null) {
      window.clearTimeout(this.cssChangeTimer);
      this.cssChangeTimer = null;
    }
    for (const timer of this.flushTimersByPath.values()) {
      window.clearTimeout(timer);
    }
    this.flushTimersByPath.clear();
    if (this.modeSyncTimer !== null) {
      window.clearTimeout(this.modeSyncTimer);
      this.modeSyncTimer = null;
    }
    if (this.modeSyncRetryTimer !== null) {
      window.clearTimeout(this.modeSyncRetryTimer);
      this.modeSyncRetryTimer = null;
    }
    if (this.layoutModeScanTimer !== null) {
      window.clearTimeout(this.layoutModeScanTimer);
      this.layoutModeScanTimer = null;
    }
    this.parseCacheByPath.clear();
    this.nestedParseCache.clear();
    this.codeTreeCache.clear();
    this.contentEpochByPath.clear();
    this.markdownModeByView = new WeakMap<MarkdownView, MarkdownViewState>();
    this.previewSync.clear();
    clearIconifyCache();
    clearFaviconCache();
    clearFaviconRetryTimers();
    this.pipeline?.clear();
    void import("./src/render/code-highlight")
      .then(({ disposeHighlighter }) => disposeHighlighter())
      .catch(() => {
        /* highlighter module may never have loaded */
      });
    void import("./src/render/code-fence")
      .then(({ disconnectAllFenceWatchers }) => {
        disconnectAllFenceWatchers();
      })
      .catch(() => {
        /* module may never have loaded */
      });
  }

  private bumpContentEpoch(sourcePath: string): number {
    const next = (this.contentEpochByPath.get(sourcePath) ?? 0) + 1;
    this.contentEpochByPath.delete(sourcePath);
    this.contentEpochByPath.set(sourcePath, next);
    while (this.contentEpochByPath.size > ObsidianPlumePlugin.MAX_CONTENT_EPOCH_ENTRIES) {
      const oldest = this.contentEpochByPath.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.contentEpochByPath.delete(oldest);
    }
    return next;
  }

  /**
   * Soft refresh Plume leading sections. When a Reading view is open and its
   * buffer diverged, also push previewMode.set — soft flush alone cannot update
   * plain markdown, and must not markPreviewSynced without that push.
   */
  private flushPlumeBlocks(sourcePath: string): void {
    this.parseCacheByPath.delete(sourcePath);
    const live = this.previewSync.getLiveText(sourcePath, "");

    // Reading open + stale buffer → real preview push (plain MD + Plume).
    let pushedReading = false;
    if (live) {
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        const view = leaf.view;
        if (!(view instanceof MarkdownView) || view.file?.path !== sourcePath) {
          continue;
        }
        if (view.getMode() !== "preview") {
          continue;
        }
        if (this.previewSync.hasPreviewSourceChanged(sourcePath, live)) {
          this.syncPreviewFromEditor(view, sourcePath, live);
          pushedReading = true;
        }
      }
    }

    // After previewMode.set, Obsidian rebuilds Reading sections — skip re-entering
    // those hosts. Still soft-refresh Live Preview leading sections.
    this.pipeline.refreshLeadingSectionsForFile(sourcePath, {
      excludePreviewRoots: pushedReading
    });
  }

  private scheduleFlushPlumeBlocks(sourcePath: string): void {
    const current = this.flushTimersByPath.get(sourcePath);
    if (current !== undefined) {
      window.clearTimeout(current);
    }
    const timer = window.setTimeout(() => {
      this.flushTimersByPath.delete(sourcePath);
      this.flushPlumeBlocks(sourcePath);
    }, ObsidianPlumePlugin.FLUSH_DEBOUNCE_MS);
    this.flushTimersByPath.set(sourcePath, timer);
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
    this.previewSync.markPreviewSynced(path, text);
    if (scrollY !== null && scrollY > 0) {
      window.requestAnimationFrame(() => {
        this.previewSync.applyScroll(view, path, scrollY);
      });
    }
  }

  /**
   * Push editor buffer into reading preview after LP/source edits.
   * Single `set` only — no rerender + no leading-section wipe (those caused double flash).
   */
  private syncPreviewFromEditor(view: MarkdownView, sourcePath: string, text: string): void {
    // Capture before set(); only restore when we have a real position (never force 0).
    const scrollY =
      this.previewSync.captureScroll(view.previewMode)
      ?? this.previewSync.getRememberedScroll(sourcePath);
    this.parseCacheByPath.delete(sourcePath);
    this.pipeline.invalidateBlocksForFile(sourcePath);

    // One update path: Obsidian rebuilds sections/post-processors from this text.
    view.previewMode.set(text, true);
    this.previewSync.markPreviewSynced(sourcePath, text);

    if (scrollY !== null && scrollY > 0) {
      window.requestAnimationFrame(() => {
        this.previewSync.applyScroll(view, sourcePath, scrollY);
      });
    }
  }

  private rememberPreviewScrollFromEvent(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) {
        continue;
      }
      const path = view.file.path;

      if (view.getMode() === "preview") {
        const container = view.previewMode.containerEl;
        if (target === container || container.contains(target)) {
          const scroll = this.previewSync.captureScroll(view.previewMode);
          if (scroll !== null && scroll > 0) {
            this.previewSync.rememberScroll(path, scroll);
          }
          return;
        }
        continue;
      }

      const scroller = view.contentEl.querySelector(".cm-scroller");
      if (
        scroller instanceof HTMLElement
        && (target === scroller || scroller.contains(target))
      ) {
        const scroll = this.previewSync.captureScroll(view.currentMode);
        if (scroll !== null && scroll > 0) {
          this.previewSync.rememberScroll(path, scroll);
        }
        return;
      }
    }
  }

  /**
   * Obsidian may leave an old section connected while reusing its preview
   * container for another file. DOM connectivity alone is therefore not a
   * sufficient async-render validity check.
   */
  private isRenderTargetCurrent(rootElement: HTMLElement, sourcePath: string): boolean {
    for (const entry of this.getMarkdownViewContainment()) {
      if (!entry.containers.some((container) =>
        container === rootElement || container.contains(rootElement))) {
        continue;
      }
      return entry.path === sourcePath;
    }

    // Detached staging sections are valid. A connected section outside every
    // current MarkdownView is a stale transition node and must not commit.
    return !rootElement.isConnected;
  }

  /** Cache leaf→containers for one macrotask; many async checkpoints hit this. */
  private getMarkdownViewContainment(): Array<{ path: string; containers: HTMLElement[] }> {
    if (this.viewContainmentCache) {
      return this.viewContainmentCache;
    }
    const entries: Array<{ path: string; containers: HTMLElement[] }> = [];
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      const containers = [view.previewMode?.containerEl, view.contentEl].filter(
        (el): el is HTMLElement => !!el
      );
      if (containers.length === 0) continue;
      entries.push({ path: view.file?.path ?? "", containers });
    }
    this.viewContainmentCache = entries;
    window.setTimeout(() => {
      this.viewContainmentCache = null;
    }, 0);
    return entries;
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

  /** Detect source↔preview. Avoid any preview rebuild on clean toggles (no flash). */
  private syncMarkdownViewMode(view: MarkdownView): void {
    const file = view.file;
    if (!file) {
      return;
    }

    const path = file.path;
    const mode = view.getMode();
    const previous = this.markdownModeByView.get(view);
    const text = view.editor.getValue();
    this.previewSync.setLiveText(path, text);

    const currentState: MarkdownViewState = { mode, sourcePath: path };
    const enteringPreview = entersPreviewTarget(previous, currentState);
    const previewTargetChanged = previous?.sourcePath !== path;
    const contentChanged = this.previewSync.hasPreviewSourceChanged(path, text);
    const isDirty = this.previewSync.isDirty(path);
    const titlesDirty = this.pipeline.codeFenceTitles.hasPendingDirty(path);

    // Do not applyScroll on mode toggles — Obsidian syncs reading ↔ source/LP itself.
    // Forcing applyScroll(0) after a late getScroll() was jumping views to the top.

    this.markdownModeByView.set(view, currentState);

    if (mode !== "preview") {
      return;
    }

    // Clean toggle (same text, no pending title patch): keep existing preview DOM.
    if (enteringPreview && !previewTargetChanged && !contentChanged && !isDirty && !titlesDirty) {
      return;
    }

    // Already in preview and nothing changed.
    if (!enteringPreview && !contentChanged && !isDirty && !titlesDirty) {
      return;
    }

    this.bumpContentEpoch(path);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (view.file?.path !== path || view.getMode() !== "preview") {
          return;
        }

        // In-place file switch while already reading: Obsidian replaces preview DOM.
        // Calling previewMode.set again causes a visible flash — only sync when dirty.
        if (enteringPreview && previewTargetChanged) {
          if (contentChanged || isDirty || titlesDirty) {
            this.syncPreviewFromEditor(view, path, text);
          } else {
            this.previewSync.markPreviewSynced(path, text);
          }
          this.pipeline.codeFenceTitles.clearPendingDirty(path);
          return;
        }

        if (enteringPreview && (contentChanged || isDirty || titlesDirty)) {
          // Entering reading from source/LP with pending edits.
          this.syncPreviewFromEditor(view, path, text);
          this.pipeline.codeFenceTitles.clearPendingDirty(path);
          return;
        }

        if (titlesDirty && !enteringPreview) {
          // refreshDirtyPreviews clears dirty only when title bars exist;
          // do not force-clear — missing bars still need a later flush/set.
          this.pipeline.codeFenceTitles.refreshDirtyPreviews();
        }

        // Staying in reading mode with dirty buffer (e.g. external file modify).
        this.flushPlumeBlocks(path);
      });
    });
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

    if (this.modeSyncRetryTimer !== null) {
      window.clearTimeout(this.modeSyncRetryTimer);
    }
    this.modeSyncRetryTimer = window.setTimeout(() => {
      this.modeSyncRetryTimer = null;
      this.applyPreviewSyncAfterModeChange(attempt + 1);
    }, ObsidianPlumePlugin.MODE_SYNC_RETRY_MS);
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<FileTreePluginSettings> | null;
    const storedLanguage = stored?.settingsLanguage;
    const detectedLanguage: SettingsLanguage = getLanguage().toLowerCase().startsWith("zh")
      ? "zh-CN"
      : "en";
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {}, {
      settingsLanguage:
        storedLanguage === "zh-CN" || storedLanguage === "en"
          ? storedLanguage
          : detectedLanguage
    });
    await this.applyShikiThemeSettings();
    // Persist fallbacks if stored theme ids are invalid / missing
    const { isBundledShikiTheme } = await import("./src/render/code-highlight");
    let fixed = false;
    if (!isBundledShikiTheme(this.settings.shikiThemeLight)) {
      this.settings.shikiThemeLight = DEFAULT_SETTINGS.shikiThemeLight;
      fixed = true;
    }
    if (!isBundledShikiTheme(this.settings.shikiThemeDark)) {
      this.settings.shikiThemeDark = DEFAULT_SETTINGS.shikiThemeDark;
      fixed = true;
    }
    if (fixed) {
      await this.saveData(this.settings);
      await this.applyShikiThemeSettings();
    }
  }

  async saveSettings(): Promise<void> {
    this.nestedParseCache.clear();
    this.parseCacheByPath.clear();
    await this.applyShikiThemeSettings();
    await this.saveData(this.settings);
  }

  /** Soft-refresh Plume hosts after settings that affect rendered icons/blocks. */
  softRefreshOpenMarkdownFiles(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file || view.file.extension !== "md") {
        continue;
      }
      this.pipeline.invalidateBlocksForFile(view.file.path);
      this.pipeline.refreshLeadingSectionsForFile(view.file.path);
    }
  }

  private async applyShikiThemeSettings(): Promise<void> {
    try {
      const { configureShikiThemes } = await import("./src/render/code-highlight");
      configureShikiThemes(this.settings.shikiThemeLight, this.settings.shikiThemeDark);
    } catch (err) {
      console.error("[theme-plume] apply Shiki themes failed", err);
    }
  }

  /** Recolor Reading view and Live Preview after a Shiki theme setting change. */
  refreshOpenReadingPreviews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) continue;
      this.pipeline.refreshLeadingSectionsForFile(view.file.path);
      void refreshDecoratedCodeFences(view.contentEl);
      if (view.previewMode.containerEl !== view.contentEl) {
        void refreshDecoratedCodeFences(view.previewMode.containerEl);
      }
    }
  }

  private buildRenderContext(
    sourcePath: string,
    ctx: MarkdownPostProcessorContext,
    component: Component
  ): BlockRenderContext {
    return {
      app: this.app,
      sourcePath,
      component,
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
      parseBlocks: (markdown) => this.getOrParseNestedBlocks(markdown),
      resolveCodeTreeEmbed: (sp, dirPath) => this.collectEmbedFiles(sp, dirPath)
    };
  }

  private getOrParseBlocks(text: string, sourcePath: string): ParsedBlock[] {
    const cached = this.parseCacheByPath.get(sourcePath);
    if (cached && cached.text === text) {
      this.parseCacheByPath.delete(sourcePath);
      this.parseCacheByPath.set(sourcePath, cached);
      return cached.blocks;
    }

    const blocks = parseAllBlocks(text, this.settings.defaultIconMode);
    this.parseCacheByPath.set(sourcePath, { text, blocks });
    while (this.parseCacheByPath.size > ObsidianPlumePlugin.MAX_PARSE_CACHE_ENTRIES) {
      const oldest = this.parseCacheByPath.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.parseCacheByPath.delete(oldest);
    }
    return blocks;
  }

  /** Content-keyed parse cache for nested card/tab/collapse bodies. */
  private getOrParseNestedBlocks(text: string): ParsedBlock[] {
    const key = `${this.settings.defaultIconMode}:${text.length}:${hashString(text)}`;
    const hit = this.nestedParseCache.get(key);
    if (hit) {
      this.nestedParseCache.delete(key);
      this.nestedParseCache.set(key, hit);
      return hit;
    }
    const blocks = parseAllBlocks(text, this.settings.defaultIconMode);
    this.nestedParseCache.set(key, blocks);
    while (this.nestedParseCache.size > ObsidianPlumePlugin.MAX_NESTED_PARSE_CACHE_ENTRIES) {
      const oldest = this.nestedParseCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.nestedParseCache.delete(oldest);
    }
    return blocks;
  }

  /** Drop code-tree directory caches that contain or are under this path. */
  private invalidateCodeTreeCacheForPath(filePath: string): void {
    const normalized = filePath.replace(/\\/g, "/");
    for (const key of Array.from(this.codeTreeCache.keys())) {
      const dir = key.replace(/\\/g, "/");
      if (
        normalized === dir
        || normalized.startsWith(`${dir}/`)
        || dir.startsWith(`${normalized}/`)
      ) {
        this.codeTreeCache.delete(key);
      }
    }
  }

  private async collectEmbedFiles(
    sourcePath: string,
    dirPath: string
  ): Promise<CodeTreeFileItem[] | null> {
    const resolvedDirPath = this.resolveCodeTreeEmbedDirectory(sourcePath, dirPath);
    if (resolvedDirPath == null) {
      return null;
    }

    const cached = this.codeTreeCache.get(resolvedDirPath);
    if (cached) {
      this.codeTreeCache.delete(resolvedDirPath);
      this.codeTreeCache.set(resolvedDirPath, cached);
      return cached;
    }

    const pending = this.loadCodeTreeDirectory(resolvedDirPath);
    this.codeTreeCache.set(resolvedDirPath, pending);
    while (this.codeTreeCache.size > ObsidianPlumePlugin.MAX_CODE_TREE_CACHE_ENTRIES) {
      const oldest = this.codeTreeCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.codeTreeCache.delete(oldest);
    }
    try {
      return await pending;
    } catch (error) {
      if (this.codeTreeCache.get(resolvedDirPath) === pending) {
        this.codeTreeCache.delete(resolvedDirPath);
      }
      throw error;
    }
  }

  private async loadCodeTreeDirectory(
    resolvedDirPath: string
  ): Promise<CodeTreeFileItem[] | null> {
    const folder = this.resolveCodeTreeEmbedFolder(resolvedDirPath);
    if (!(folder instanceof TFolder)) {
      return null;
    }

    const entries = this.collectCodeTreeDirectoryItems(folder)
      .filter((entry) => {
        const extension = this.getCodeTreeFileExtension(entry.relativePath);
        return !UNSUPPORTED_CODE_TREE_FILE_TYPES.has(extension)
          && entry.file.stat.size <= ObsidianPlumePlugin.MAX_CODE_TREE_FILE_BYTES;
      })
      .slice(0, ObsidianPlumePlugin.MAX_CODE_TREE_FILES);
    if (entries.length === 0) {
      return null;
    }

    let totalBytes = 0;
    const selected: CodeTreeDirectoryEntry[] = [];
    for (const entry of entries) {
      if (totalBytes + entry.file.stat.size > ObsidianPlumePlugin.MAX_CODE_TREE_TOTAL_BYTES) {
        continue;
      }
      totalBytes += entry.file.stat.size;
      selected.push(entry);
    }

    const results = new Array<CodeTreeFileItem | null>(selected.length).fill(null);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < selected.length) {
        const index = cursor++;
        const entry = selected[index];
        try {
          const content = await this.app.vault.cachedRead(entry.file);
          const extension = this.getCodeTreeFileExtension(entry.relativePath);
          results[index] = {
            filepath: entry.relativePath,
            language: extension || "txt",
            content
          };
        } catch {
          results[index] = null;
        }
      }
    };
    const concurrency = Math.min(ObsidianPlumePlugin.CODE_TREE_READ_CONCURRENCY, selected.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const files = results.filter((item): item is CodeTreeFileItem => item !== null);
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
  ): CodeTreeDirectoryEntry[] {
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

  private forgetPath(sourcePath: string): void {
    const timer = this.flushTimersByPath.get(sourcePath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.flushTimersByPath.delete(sourcePath);
    }
    this.parseCacheByPath.delete(sourcePath);
    this.contentEpochByPath.delete(sourcePath);
    this.previewSync.deleteLive(sourcePath);
    this.pipeline.forgetFile(sourcePath);
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
    const t = getSettingsMessages(this.plugin.settings.settingsLanguage);

    new Setting(containerEl)
      .setName(t.settingsLanguage)
      .setDesc(t.settingsLanguageDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("zh-CN", t.chinese);
        dropdown.addOption("en", t.english);
        dropdown.setValue(this.plugin.settings.settingsLanguage);
        dropdown.onChange(async (value) => {
          this.plugin.settings.settingsLanguage = value as SettingsLanguage;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl).setName(t.rendering).setHeading();
    containerEl.createEl("p", {
      text: t.renderingDesc
    });

    new Setting(containerEl)
      .setName(t.defaultIconMode)
      .setDesc(t.defaultIconModeDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("colored", t.colored);
        dropdown.addOption("simple", t.simple);
        dropdown.setValue(this.plugin.settings.defaultIconMode);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultIconMode =
            value as FileTreePluginSettings["defaultIconMode"];
          await this.plugin.saveSettings();
          this.plugin.softRefreshOpenMarkdownFiles();
        });
      });

    new Setting(containerEl)
      .setName(t.rememberTabs)
      .setDesc(t.rememberTabsDesc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.persistTabSelection);
        toggle.onChange(async (value) => {
          this.plugin.settings.persistTabSelection = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t.lazyCollapse)
      .setDesc(t.lazyCollapseDesc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.collapseLazyBodies);
        toggle.onChange(async (value) => {
          this.plugin.settings.collapseLazyBodies = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t.lazyTabs)
      .setDesc(t.lazyTabsDesc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.tabsLazyPanels);
        toggle.onChange(async (value) => {
          this.plugin.settings.tabsLazyPanels = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t.debugRender)
      .setDesc(t.debugRenderDesc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.debugRender);
        toggle.onChange(async (value) => {
          this.plugin.settings.debugRender = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName(t.codeHighlighting).setHeading();
    containerEl.createEl("p", {
      text: t.codeHighlightingDesc
    });

    const shikiHost = containerEl.createDiv({ cls: "plume-shiki-theme-settings" });
    shikiHost.createEl("p", { text: t.loadingThemes });
    void this.mountShikiThemeSettings(shikiHost);
  }

  private async mountShikiThemeSettings(host: HTMLElement): Promise<void> {
    try {
      const { listBundledShikiThemes } = await import("./src/render/code-highlight");
      const themeOptions = listBundledShikiThemes();
      if (!host.isConnected) return;
      const t = getSettingsMessages(this.plugin.settings.settingsLanguage);
      host.empty();

      new Setting(host)
        .setName(t.lightTheme)
        .setDesc(t.lightThemeDesc)
        .addDropdown((dropdown) => {
          for (const id of themeOptions) {
            dropdown.addOption(id, id);
          }
          const current = this.plugin.settings.shikiThemeLight;
          dropdown.setValue(themeOptions.includes(current) ? current : "vitesse-light");
          dropdown.onChange(async (value) => {
            this.plugin.settings.shikiThemeLight = value;
            await this.plugin.saveSettings();
            this.plugin.refreshOpenReadingPreviews();
          });
        });

      new Setting(host)
        .setName(t.darkTheme)
        .setDesc(t.darkThemeDesc)
        .addDropdown((dropdown) => {
          for (const id of themeOptions) {
            dropdown.addOption(id, id);
          }
          const current = this.plugin.settings.shikiThemeDark;
          dropdown.setValue(themeOptions.includes(current) ? current : "vitesse-dark");
          dropdown.onChange(async (value) => {
            this.plugin.settings.shikiThemeDark = value;
            await this.plugin.saveSettings();
            this.plugin.refreshOpenReadingPreviews();
          });
        });
    } catch (err) {
      console.error("[theme-plume] failed to load Shiki theme list", err);
      if (!host.isConnected) return;
      const t = getSettingsMessages(this.plugin.settings.settingsLanguage);
      host.empty();
      host.createEl("p", { text: t.themeLoadFailed });
    }
  }
}
