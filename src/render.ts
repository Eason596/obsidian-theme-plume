import { App, Component, MarkdownPostProcessorContext, Notice, requestUrl, setIcon } from "obsidian";
import { renderPlumeMarkdown, type PlumeMarkdownContext } from "./markdown/plume-markdown";
import { resolveNodeIcon } from "./icons";
import { registerBlockRenderer } from "./render/block-registry";
import { renderCollapseBlock } from "./render/blocks/collapse";
import {
  decorateCodeBlockTitles,
  scanCodeFenceTitles,
  scanCodeFences
} from "./render/code-fence";
import {
  type BlockRenderContext,
  type PlumeRenderSettings,
  toBlockRenderContext,
  toPlumeMarkdownContext,
  triggerPreviewReflow
} from "./render/context";
import {
  BLOCK_PLACEHOLDER_ATTR,
  BLOCK_PLACEHOLDER_CLASS,
  contentIsOnlyBlocksAndBlankLines,
  pruneEmptyMarkdownNodes,
  renderInnerMarkdown,
  renderNestedMarkdownContent,
  renderPlumeBlocksInto
} from "./render/pipeline";
import { renderTabbedContainer } from "./render/tabbed-container";
import { renderInlineMarkdownInto } from "./render/inline";
import {
  fileTreeToCMDText,
  normalizeCodeTreePath,
  parseAllBlocks,
  parseCodeTreeFileNodes,
  parseCodeTreeRawContent,
  parseFileTreeRawContent,
  parseStepsRawContent,
  dedentStepBody,
  splitFlexSegments,
  parseTabsRawContent
} from "./parser";
export type { BlockRenderContext, PlumeRenderSettings } from "./render/context";
export {
  renderInnerMarkdown,
  renderNestedMarkdownContent,
  renderPlumeBlocksInto
} from "./render/pipeline";
export {
  scanCodeFenceTitles,
  scanCodeFences,
  decorateCodeBlockTitles,
  decorateSubtreeCodeFences
} from "./render/code-fence";
import type {
  CardContainerAttrs,
  CardGridContainerAttrs,
  CardMasonryContainerAttrs,
  RepoCardContainerAttrs,
  LinkCardContainerAttrs,
  ImageCardContainerAttrs,
  FieldContainerAttrs,
  FlexContainerAttrs,
  WindowContainerAttrs,
  ChatContainerAttrs,
  CollapseContainerAttrs,
  CodeTabsContainerAttrs,
  CodeTreeContainerAttrs,
  CodeTreeFileItem,
  FileTreeContainerAttrs,
  FileTreeIconMode,
  FileTreeNode,
  ParsedBlock,
  PromptContainerAttrs,
  PromptContainerType,
  TabItem,
  TabsContainerAttrs,
  TimelineContainerAttrs,
  TimelineItemMeta,
  TimelineLineStyle,
  TimelinePlacement
} from "./types";

interface RenderTreeOptions {
  nodes: FileTreeNode[];
  attrs: FileTreeContainerAttrs;
  defaultIconMode: FileTreeIconMode;
  markdownContext?: PlumeMarkdownContext;
}

interface RenderCodeTreeOptions {
  files: CodeTreeFileItem[];
  attrs: CodeTreeContainerAttrs;
  defaultIconMode: FileTreeIconMode;
  markdownContext?: RenderTreeOptions["markdownContext"];
}

interface RenderStepsOptions {
  content: string;
  markdownContext?: RenderTreeOptions["markdownContext"];
  defaultIconMode?: FileTreeIconMode;
}

interface RenderPromptContainerOptions {
  attrs: PromptContainerAttrs;
  content: string;
  markdownContext?: RenderTreeOptions["markdownContext"];
}

interface PromptPlaceholderBlock {
  attrs: PromptContainerAttrs;
  content: string;
}

const ELLIPSIS = "\u2026";
let commentRenderToken = 0;
const PROMPT_HEADER_RE = /^(\s*)(:{3,})\s*(note|info|tip|warning|caution|details)\b(.*)$/i;
const PROMPT_PLACEHOLDER_CLASS = "vp-prompt-placeholder";
const PROMPT_PLACEHOLDER_ATTR = "data-vp-prompt-id";
const PROMPT_DEFAULT_TITLES: Record<PromptContainerType, string> = {
  note: "NOTE",
  info: "INFO",
  tip: "TIP",
  warning: "WARNING",
  caution: "CAUTION",
  details: "DETAILS"
};
const PROMPT_TYPE_ICONS: Record<PromptContainerType, string | null> = {
  note: "pencil",
  info: "info",
  tip: "lightbulb",
  warning: "alert-triangle",
  caution: "alert-octagon",
  // details uses the native chevron ::before; skip the icon
  details: null
};

function applyPromptTitleIcon(host: HTMLElement, type: PromptContainerType): void {
  const iconName = PROMPT_TYPE_ICONS[type];
  if (!iconName) return;
  const span = document.createElement("span");
  span.className = "vp-custom-container-icon";
  span.setAttribute("aria-hidden", "true");
  host.prepend(span);
  try {
    setIcon(span, iconName);
  } catch {
    /* setIcon may throw if Lucide name unknown; ignore */
  }
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function createPlaceholderNode(level: number): FileTreeNode {
  return {
    filename: ELLIPSIS,
    type: "file",
    expanded: false,
    level,
    children: []
  };
}

function flattenInlineParagraph(el: HTMLElement): void {
  if (el.children.length !== 1) {
    return;
  }

  const only = el.firstElementChild;
  if (!(only instanceof HTMLElement) || only.tagName !== "P") {
    return;
  }

  while (only.firstChild) {
    el.appendChild(only.firstChild);
  }
  only.remove();
}

function renderCommentMarkdown(
  commentEl: HTMLElement,
  rawComment: string,
  markdownContext?: RenderTreeOptions["markdownContext"]
): void {
  if (!markdownContext) {
    commentEl.textContent = rawComment;
    return;
  }

  const markdown = rawComment.split("#").join("\\#");
  const token = String(++commentRenderToken);
  commentEl.dataset.vpftCommentToken = token;

  void renderPlumeMarkdown(commentEl, markdown, markdownContext)
    .then(() => {
      if (commentEl.dataset.vpftCommentToken !== token || !commentEl.isConnected) {
        return;
      }
      flattenInlineParagraph(commentEl);
    })
    .catch(() => {
      if (commentEl.dataset.vpftCommentToken !== token || !commentEl.isConnected) {
        return;
      }
      commentEl.textContent = rawComment;
    });
}

function parsePromptHeaderLine(
  line: string
): (PromptContainerAttrs & { markerLen: number; indent: string }) | null {
  const match = line.match(PROMPT_HEADER_RE);
  if (!match) {
    return null;
  }

  const indent = match[1] ?? "";
  const markerLen = match[2]?.length ?? 0;
  const type = (match[3] ?? "").toLowerCase() as PromptContainerType;
  const title = (match[4] ?? "").trim() || undefined;

  return {
    type,
    title,
    markerLen,
    indent
  };
}

function collectPromptPlaceholderBlocks(markdown: string): {
  transformedMarkdown: string;
  blocks: Map<string, PromptPlaceholderBlock>;
} {
  const lines = markdown.split(/\r?\n/);
  const transformedLines: string[] = [];
  const blocks = new Map<string, PromptPlaceholderBlock>();

  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const header = parsePromptHeaderLine(line);
    if (!header) {
      transformedLines.push(line);
      lineIndex += 1;
      continue;
    }

    const bodyLines: string[] = [];
    let closeLine = -1;
    let nestedContainerDepth = 0;
    let fenceChar = "";
    let fenceLength = 0;

    for (let cursor = lineIndex + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];

      if (fenceLength > 0) {
        bodyLines.push(current);

        const closeRegex = new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`);
        if (closeRegex.test(current)) {
          fenceChar = "";
          fenceLength = 0;
        }

        continue;
      }

      const fenceMatch = current.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        const fence = fenceMatch[2];
        fenceChar = fence[0];
        fenceLength = fence.length;
        bodyLines.push(current);
        continue;
      }

      const closeMatch = current.match(/^\s*(:{3,})\s*$/);
      if (closeMatch) {
        const markerLen = closeMatch[1]?.length ?? 0;

        if (markerLen >= header.markerLen && nestedContainerDepth === 0) {
          closeLine = cursor;
          break;
        }

        if (nestedContainerDepth > 0) {
          nestedContainerDepth -= 1;
        }

        bodyLines.push(current);
        continue;
      }

      if (/^\s*:{3,}\s*\S+/.test(current)) {
        nestedContainerDepth += 1;
      }

      bodyLines.push(current);
    }

    if (closeLine === -1) {
      transformedLines.push(line);
      lineIndex += 1;
      continue;
    }

    const normalizedBody = bodyLines.map((bodyLine) => {
      if (!bodyLine.trim() || !header.indent) {
        return bodyLine;
      }

      return bodyLine.startsWith(header.indent)
        ? bodyLine.slice(header.indent.length)
        : bodyLine;
    });

    let dedentLength = Number.MAX_SAFE_INTEGER;
    for (const bodyLine of normalizedBody) {
      if (!bodyLine.trim()) {
        continue;
      }

      const indentMatch = bodyLine.match(/^[\t ]*/);
      const lineIndent = indentMatch?.[0].length ?? 0;
      dedentLength = Math.min(dedentLength, lineIndent);
    }

    const finalBody = Number.isFinite(dedentLength) && dedentLength > 0
      ? normalizedBody.map((bodyLine) => {
        if (!bodyLine.trim()) {
          return bodyLine;
        }

        return bodyLine.slice(dedentLength);
      })
      : normalizedBody;

    const id = `vp-prompt-${blocks.size + 1}`;
    blocks.set(id, {
      attrs: {
        type: header.type,
        title: header.title
      },
      content: finalBody.join("\n").replace(/^\n+|\n+$/g, "")
    });

    transformedLines.push(
      `${header.indent}<div class="${PROMPT_PLACEHOLDER_CLASS}" ${PROMPT_PLACEHOLDER_ATTR}="${id}"></div>`
    );

    lineIndex = closeLine + 1;
  }

  return {
    transformedMarkdown: transformedLines.join("\n"),
    blocks
  };
}

function renderMarkdownChunk(
  container: HTMLElement,
  markdown: string,
  markdownContext?: RenderTreeOptions["markdownContext"]
): void {
  if (!markdown.trim()) {
    return;
  }

  if (!markdownContext) {
    container.textContent = markdown;
    return;
  }

  void renderPlumeMarkdown(container, markdown, markdownContext);
}

function renderMarkdownWithPromptContainers(
  container: HTMLElement,
  markdown: string,
  markdownContext?: RenderTreeOptions["markdownContext"]
): void {
  const source = markdown.trim();
  if (!source) {
    return;
  }

  const transformed = collectPromptPlaceholderBlocks(source);
  if (transformed.blocks.size === 0) {
    renderMarkdownChunk(container, markdown, markdownContext);
    return;
  }

  if (!markdownContext) {
    container.textContent = source;
    return;
  }

  void renderPlumeMarkdown(container, transformed.transformedMarkdown, markdownContext)
    .then(() => {
      if (!container.isConnected) {
        return;
      }

      const placeholders = Array.from(
        container.querySelectorAll(`.${PROMPT_PLACEHOLDER_CLASS}[${PROMPT_PLACEHOLDER_ATTR}]`)
      ).filter((node): node is HTMLElement => {
        return node instanceof HTMLElement;
      });

      for (const placeholder of placeholders) {
        const id = placeholder.getAttribute(PROMPT_PLACEHOLDER_ATTR);
        if (!id) {
          continue;
        }

        const block = transformed.blocks.get(id);
        if (!block) {
          continue;
        }

        placeholder.removeAttribute(PROMPT_PLACEHOLDER_ATTR);
        placeholder.classList.remove(PROMPT_PLACEHOLDER_CLASS);
        placeholder.empty();

        renderPromptContainerInto(placeholder, {
          attrs: block.attrs,
          content: block.content,
          markdownContext
        });
      }
    })
    .catch(() => {
      if (!container.isConnected) {
        return;
      }
      container.empty();
      container.textContent = source;
    });
}

export function renderMarkdownWithPromptContainersInto(
  container: HTMLElement,
  markdown: string,
  markdownContext?: RenderTreeOptions["markdownContext"]
): void {
  renderMarkdownWithPromptContainers(container, markdown, markdownContext);
}

export function renderFileTreeInto(container: HTMLElement, options: RenderTreeOptions): void {
  const mode = options.attrs.icon ?? options.defaultIconMode;
  const wrapper = document.createElement("div");
  wrapper.className = "vp-file-tree obsidian-vuepress-file-tree";
  container.appendChild(wrapper);

  if (options.attrs.title) {
    const title = document.createElement("p");
    title.className = "vp-file-tree-title";
    title.textContent = options.attrs.title;
    wrapper.appendChild(title);
  }

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "obsidian-file-tree-copy clickable-icon";
  copyButton.setAttribute("aria-label", "Copy file tree");
  setIcon(copyButton, "copy");
  wrapper.appendChild(copyButton);

  const cmdText = fileTreeToCMDText(options.nodes).trim();
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await copyToClipboard(cmdText);
      copyButton.classList.add("is-copied");
      setIcon(copyButton, "check");
      window.setTimeout(() => {
        copyButton.classList.remove("is-copied");
        setIcon(copyButton, "copy");
      }, 1200);
    } catch {
      new Notice("Failed to copy file tree text.");
    }
  });

  let activeInfoElement: HTMLElement | null = null;

  const renderNodes = (parent: HTMLElement, nodes: FileTreeNode[], parentPath: string): void => {
    for (const node of nodes) {
      const nodeElement = document.createElement("div");
      nodeElement.className = "vp-file-tree-node";
      parent.appendChild(nodeElement);

      const nodeChildren =
        node.type === "folder" && node.children.length === 0
          ? [createPlaceholderNode(node.level + 1)]
          : node.children;

      const nodeType: "folder" | "file" = nodeChildren.length > 0 ? "folder" : node.type;
      const isPlaceholder = node.filename === ELLIPSIS || node.filename === "...";
      const info = document.createElement("p");
      info.classList.add("vp-file-tree-info", nodeType);
      info.style.setProperty("--file-tree-level", String(-node.level));
      nodeElement.appendChild(info);

      if (node.focus) {
        info.classList.add("focus");
      }

      if (node.diff) {
        info.classList.add("diff", node.diff);
      }

      const icon = isPlaceholder ? null : document.createElement("span");
      if (icon) {
        icon.className = "ft-icon";
        info.appendChild(icon);
      }

      let expanded = nodeType === "folder" ? node.expanded !== false : false;

      const group = nodeType === "folder" ? document.createElement("div") : null;
      if (group) {
        group.className = "group";
        nodeElement.appendChild(group);
      }

      const applyIcon = (): void => {
        if (!icon) {
          return;
        }

        const iconDescriptor = resolveNodeIcon(node.filename, nodeType, expanded, mode);
        icon.className = "ft-icon";
        if (iconDescriptor.colorClass) {
          icon.classList.add(iconDescriptor.colorClass);
        }

        if (iconDescriptor.offlineSvg) {
          icon.classList.add("ft-icon-offline");
          icon.innerHTML = iconDescriptor.offlineSvg;
          return;
        }

        icon.classList.remove("ft-icon-offline");
        icon.innerHTML = "";
        setIcon(icon, iconDescriptor.icon);
      };

      const applyFolderState = (): void => {
        if (nodeType !== "folder" || !group) {
          return;
        }

        if (expanded) {
          info.classList.add("expanded");
          group.style.display = "";
        } else {
          info.classList.remove("expanded");
          group.style.display = "none";
        }

        applyIcon();
      };

      applyIcon();

      const name = document.createElement("span");
      name.classList.add("name", nodeType);
      name.textContent = node.filename;
      info.appendChild(name);

      if (node.comment) {
        const comment = document.createElement("span");
        comment.className = "comment";
        renderCommentMarkdown(comment, node.comment, options.markdownContext);
        info.appendChild(comment);
      }

      const nodePath = parentPath ? `${parentPath}/${node.filename}` : node.filename;
      info.dataset.path = nodePath;

      if (group) {
        applyFolderState();
        renderNodes(group, nodeChildren, nodePath);
      }

      info.addEventListener("click", (event: MouseEvent) => {
        if (isPlaceholder) {
          return;
        }

        const target = event.target as HTMLElement;

        if (nodeType === "folder") {
          if (target.closest(".comment")) {
            return;
          }

          expanded = !expanded;
          applyFolderState();
          if (options.markdownContext?.app) {
            triggerPreviewReflow(options.markdownContext.app);
          }
          return;
        }

        if (activeInfoElement && activeInfoElement !== info) {
          activeInfoElement.classList.remove("active");
        }

        info.classList.add("active");
        activeInfoElement = info;
      });
    }
  };

  renderNodes(wrapper, options.nodes, "");
}

function normalizeHeightValue(height: string | undefined): string | undefined {
  if (!height) {
    return undefined;
  }

  const value = height.trim();
  if (!value) {
    return undefined;
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return `${value}px`;
  }

  return value;
}

function renderPlainCodeBlock(container: HTMLElement, language: string, content: string): void {
  const pre = document.createElement("pre");
  pre.className = "vp-code-tree-pre";

  const code = document.createElement("code");
  code.className = `language-${language || "text"}`;
  code.textContent = content;

  pre.appendChild(code);
  container.appendChild(pre);
}

export function renderCodeTreeInto(container: HTMLElement, options: RenderCodeTreeOptions): void {
  const normalizedFiles: CodeTreeFileItem[] = [];
  const fileMap = new Map<string, CodeTreeFileItem>();

  for (const file of options.files) {
    const filepath = normalizeCodeTreePath(file.filepath);
    if (!filepath) {
      continue;
    }

    const existing = fileMap.get(filepath);
    if (existing) {
      if (file.active) {
        existing.active = true;
      }
      continue;
    }

    const normalizedFile: CodeTreeFileItem = {
      ...file,
      filepath,
      language: file.language || "text"
    };

    fileMap.set(filepath, normalizedFile);
    normalizedFiles.push(normalizedFile);
  }

  if (normalizedFiles.length === 0) {
    return;
  }

  const mode = options.attrs.icon ?? options.defaultIconMode;

  const wrapper = document.createElement("div");
  wrapper.className = "vp-code-tree obsidian-vuepress-file-tree obsidian-vuepress-code-tree";
  container.appendChild(wrapper);

  if (options.attrs.title) {
    const title = document.createElement("p");
    title.className = "vp-code-tree-title";
    title.textContent = options.attrs.title;
    wrapper.appendChild(title);
  }

  const normalizedHeight = normalizeHeightValue(options.attrs.height);
  if (normalizedHeight) {
    wrapper.style.setProperty("--vp-code-tree-height", normalizedHeight);
  }

  const body = document.createElement("div");
  body.className = "vp-code-tree-body";
  wrapper.appendChild(body);

  const nav = document.createElement("div");
  nav.className = "vp-code-tree-nav";
  body.appendChild(nav);

  const panel = document.createElement("div");
  panel.className = "vp-code-tree-panel";
  body.appendChild(panel);

  const panelHeader = document.createElement("div");
  panelHeader.className = "vp-code-tree-panel-header";
  panel.appendChild(panelHeader);

  const panelEntry = document.createElement("span");
  panelEntry.className = "vp-code-tree-panel-entry";
  panelHeader.appendChild(panelEntry);

  const panelContent = document.createElement("div");
  panelContent.className = "vp-code-tree-panel-content";
  panel.appendChild(panelContent);

  const explicitEntry = options.attrs.entry ? normalizeCodeTreePath(options.attrs.entry) : "";
  const initialPath =
    (explicitEntry && fileMap.has(explicitEntry) ? explicitEntry : undefined)
    ?? normalizedFiles.find((file) => file.active)?.filepath
    ?? normalizedFiles[0].filepath;

  const treeNodes = parseCodeTreeFileNodes(normalizedFiles);

  let activePath = initialPath;
  let activeInfoElement: HTMLElement | null = null;
  let panelRenderToken = 0;
  const fileInfoMap = new Map<string, HTMLElement>();

  const setActiveInfo = (filepath: string): void => {
    const next = fileInfoMap.get(filepath);
    if (!(next instanceof HTMLElement)) {
      return;
    }

    if (activeInfoElement && activeInfoElement !== next) {
      activeInfoElement.classList.remove("active");
    }

    next.classList.add("active");
    activeInfoElement = next;
  };

  const renderPanel = (filepath: string): void => {
    const file = fileMap.get(filepath);
    if (!file) {
      return;
    }

    panelEntry.textContent = file.filepath;
    panelContent.empty();

    if (!options.markdownContext) {
      renderPlainCodeBlock(panelContent, file.language, file.content);
      return;
    }

    const token = String(++panelRenderToken);
    panelContent.dataset.vpctRenderToken = token;
    const markdown = `\`\`\`${file.language}\n${file.content}\n\`\`\``;

    void renderPlumeMarkdown(panelContent, markdown, options.markdownContext)
      .catch(() => {
        if (panelContent.dataset.vpctRenderToken !== token || !panelContent.isConnected) {
          return;
        }
        panelContent.empty();
        renderPlainCodeBlock(panelContent, file.language, file.content);
      });
  };

  const renderNodes = (parent: HTMLElement, nodes: FileTreeNode[], parentPath: string): void => {
    for (const node of nodes) {
      const nodeElement = document.createElement("div");
      nodeElement.className = "vp-file-tree-node";
      parent.appendChild(nodeElement);

      const hasChildren = node.children.length > 0;
      const nodeType: "folder" | "file" = hasChildren || node.type === "folder" ? "folder" : "file";
      const info = document.createElement("p");
      info.classList.add("vp-file-tree-info", nodeType);
      info.style.setProperty("--file-tree-level", String(-node.level));
      nodeElement.appendChild(info);

      const icon = document.createElement("span");
      icon.className = "ft-icon";
      info.appendChild(icon);

      let expanded = nodeType === "folder" ? node.expanded !== false : false;

      const group = nodeType === "folder" ? document.createElement("div") : null;
      if (group) {
        group.className = "group";
        nodeElement.appendChild(group);
      }

      const applyIcon = (): void => {
        const iconDescriptor = resolveNodeIcon(node.filename, nodeType, expanded, mode);
        icon.className = "ft-icon";
        if (iconDescriptor.colorClass) {
          icon.classList.add(iconDescriptor.colorClass);
        }

        if (iconDescriptor.offlineSvg) {
          icon.classList.add("ft-icon-offline");
          icon.innerHTML = iconDescriptor.offlineSvg;
          return;
        }

        icon.classList.remove("ft-icon-offline");
        icon.innerHTML = "";
        setIcon(icon, iconDescriptor.icon);
      };

      const applyFolderState = (): void => {
        if (nodeType !== "folder" || !group) {
          return;
        }

        if (expanded) {
          info.classList.add("expanded");
          group.style.display = "";
        } else {
          info.classList.remove("expanded");
          group.style.display = "none";
        }

        applyIcon();
      };

      applyIcon();

      const name = document.createElement("span");
      name.classList.add("name", nodeType);
      name.textContent = node.filename;
      info.appendChild(name);

      const currentPath = parentPath ? `${parentPath}/${node.filename}` : node.filename;
      const filepath = normalizeCodeTreePath(node.filepath ?? currentPath);
      info.dataset.path = filepath;

      if (nodeType === "file") {
        fileInfoMap.set(filepath, info);
      }

      if (group) {
        applyFolderState();
        renderNodes(group, node.children, currentPath);
      }

      info.addEventListener("click", () => {
        if (nodeType === "folder") {
          expanded = !expanded;
          applyFolderState();
          return;
        }

        if (!fileMap.has(filepath)) {
          return;
        }

        activePath = filepath;
        setActiveInfo(activePath);
        renderPanel(activePath);
      });
    }
  };

  renderNodes(nav, treeNodes, "");
  setActiveInfo(activePath);
  renderPanel(activePath);
}

export function renderPromptContainerInto(container: HTMLElement, options: RenderPromptContainerOptions): void {
  const type = options.attrs.type;
  const title = options.attrs.title?.trim() || PROMPT_DEFAULT_TITLES[type];
  const content = options.content.trim();

  if (type === "details") {
    const details = document.createElement("details");
    details.className = "vp-custom-container obsidian-vuepress-prompt-container details";
    container.appendChild(details);

    const summary = document.createElement("summary");
    summary.className = "vp-custom-container-title";
    summary.textContent = title;
    applyPromptTitleIcon(summary, type);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "vp-custom-container-content";
    details.appendChild(body);

    renderMarkdownWithPromptContainers(body, content, options.markdownContext);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = `vp-custom-container obsidian-vuepress-prompt-container ${type}`;
  container.appendChild(wrapper);

  const titleElement = document.createElement("p");
  titleElement.className = "vp-custom-container-title";
  titleElement.textContent = title;
  applyPromptTitleIcon(titleElement, type);
  wrapper.appendChild(titleElement);

  const body = document.createElement("div");
  body.className = "vp-custom-container-content";
  wrapper.appendChild(body);

  renderMarkdownWithPromptContainers(body, content, options.markdownContext);
}

export function renderStepsInto(container: HTMLElement, options: RenderStepsOptions): void {
  if (!options.markdownContext) {
    void renderStepsContent(container, options.content);
    return;
  }
  void renderStepsContent(
    container,
    options.content,
    toBlockRenderContext(options.markdownContext, options.defaultIconMode ?? "colored")
  );
}

// ===========================================================================
// Unified block rendering pipeline
// ===========================================================================

async function buildMasonryItems(
  content: string,
  wrapper: HTMLElement,
  ctx: BlockRenderContext
): Promise<HTMLElement[]> {
  const blocks = parseAllBlocks(content, ctx.defaultIconMode);

  if (blocks.length > 0 && contentIsOnlyBlocksAndBlankLines(content, blocks)) {
    const staging = document.createElement("div");
    staging.className = "plume-masonry-staging";
    wrapper.appendChild(staging);
    await renderPlumeBlocksInto(staging, blocks, ctx);
    const items = collectMasonryItems(staging);
    staging.remove();
    return items;
  }

  const staging = document.createElement("div");
  staging.className = "plume-masonry-staging";
  wrapper.appendChild(staging);
  await renderInnerMarkdown(staging, content, ctx);
  const items = collectMasonryItems(staging);
  staging.remove();
  return items;
}

interface NormalizedTabsAttrs extends TabsContainerAttrs {}

function normalizeTabs(rawTabs: TabItem[]): TabItem[] {
  const seen = new Map<string, number>();
  const out: TabItem[] = [];

  for (let i = 0; i < rawTabs.length; i += 1) {
    const t = rawTabs[i];
    const title = t.title || `Tab ${i + 1}`;
    const baseValue = t.value || title;
    const dup = seen.get(baseValue) ?? 0;
    seen.set(baseValue, dup + 1);
    out.push({
      ...t,
      title,
      value: dup === 0 ? baseValue : `${baseValue}-${dup + 1}`
    });
  }

  return out;
}

/**
 * Dispatch a single parsed block to the appropriate renderer.
 * Inner markdown content is rendered recursively via `renderInnerMarkdown`,
 * so nested containers Just Work.
 */
export async function renderBlock(
  container: HTMLElement,
  block: ParsedBlock,
  ctx: BlockRenderContext
): Promise<void> {
  switch (block.type) {
    case "file-tree": {
      const nodes = parseFileTreeRawContent(block.rawContent);
      if (nodes.length === 0) return;
      renderFileTreeInto(container, {
        nodes,
        attrs: block.attrs as FileTreeContainerAttrs,
        defaultIconMode: ctx.defaultIconMode,
        markdownContext: toPlumeMarkdownContext(ctx)
      });
      return;
    }

    case "code-tree": {
      const files = parseCodeTreeRawContent(block.rawContent);
      if (files.length === 0) return;
      renderCodeTreeInto(container, {
        files,
        attrs: block.attrs as CodeTreeContainerAttrs,
        defaultIconMode: ctx.defaultIconMode,
        markdownContext: toPlumeMarkdownContext(ctx)
      });
      return;
    }

    case "code-tree-embed": {
      const attrs = block.attrs as CodeTreeContainerAttrs & { dirPath: string };
      if (!ctx.resolveCodeTreeEmbed) return;
      const files = await ctx.resolveCodeTreeEmbed(ctx.sourcePath, attrs.dirPath);
      if (!files || files.length === 0) return;
      const finalAttrs: CodeTreeContainerAttrs = { ...attrs };
      delete (finalAttrs as Record<string, unknown>).dirPath;
      if (!finalAttrs.entry) {
        finalAttrs.entry = files[0].filepath;
      }
      renderCodeTreeInto(container, {
        files,
        attrs: finalAttrs,
        defaultIconMode: ctx.defaultIconMode,
        markdownContext: toPlumeMarkdownContext(ctx)
      });
      return;
    }

    case "tabs": {
      const tabs = normalizeTabs(parseTabsRawContent(block.rawContent));
      if (tabs.length === 0) return;
      await renderTabsBlock(container, tabs, block.attrs as NormalizedTabsAttrs, ctx);
      return;
    }

    case "code-tabs": {
      const tabs = normalizeTabs(parseTabsRawContent(block.rawContent));
      if (tabs.length === 0) return;
      await renderCodeTabsBlock(container, tabs, block.attrs as CodeTabsContainerAttrs, ctx);
      return;
    }

    case "steps": {
      await renderStepsBlock(container, block.rawContent, ctx);
      return;
    }

    case "prompt": {
      await renderPromptBlock(container, block.rawContent, block.attrs as PromptContainerAttrs, ctx);
      return;
    }

    case "collapse": {
      await renderCollapseBlock(container, block.rawContent, block.attrs as CollapseContainerAttrs, ctx);
      return;
    }

    case "card": {
      await renderCardBlock(container, block.rawContent, block.attrs as CardContainerAttrs, ctx);
      return;
    }

    case "card-grid": {
      await renderCardGridBlock(container, block.rawContent, block.attrs as CardGridContainerAttrs, ctx);
      return;
    }

    case "card-masonry": {
      await renderCardMasonryBlock(container, block.rawContent, block.attrs as CardMasonryContainerAttrs, ctx);
      return;
    }

    case "repo-card": {
      await renderRepoCardBlock(container, block.attrs as RepoCardContainerAttrs);
      return;
    }

    case "link-card": {
      await renderLinkCardBlock(container, block.rawContent, block.attrs as LinkCardContainerAttrs, ctx);
      return;
    }

    case "image-card": {
      await renderImageCardBlock(container, block.rawContent, block.attrs as ImageCardContainerAttrs, ctx);
      return;
    }

    case "field": {
      await renderFieldBlock(container, block.rawContent, block.attrs as FieldContainerAttrs, ctx);
      return;
    }

    case "field-group": {
      await renderFieldGroupBlock(container, block.rawContent, ctx);
      return;
    }

    case "flex": {
      await renderFlexBlock(container, block.rawContent, block.attrs as FlexContainerAttrs, ctx);
      return;
    }

    case "window": {
      await renderWindowBlock(container, block.rawContent, block.attrs as WindowContainerAttrs, ctx);
      return;
    }

    case "chat": {
      await renderChatBlock(container, block.rawContent, block.attrs as ChatContainerAttrs, ctx);
      return;
    }

    case "timeline": {
      await renderTimelineBlock(container, block.rawContent, block.attrs as TimelineContainerAttrs, ctx);
      return;
    }
  }
}

async function renderTabsBlock(
  container: HTMLElement,
  tabs: TabItem[],
  attrs: TabsContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  await renderTabbedContainer(container, {
    variant: "tabs",
    tabs,
    sharedId: attrs.id,
    defaultIconMode: ctx.defaultIconMode,
    persistSelection: ctx.settings?.persistTabSelection !== false,
    lazyPanels: ctx.settings?.tabsLazyPanels !== false,
    contentEpoch: ctx.contentEpoch,
    renderPanel: (panel, markdown) => renderInnerMarkdown(panel, markdown, ctx)
  });
}

async function renderCodeTabsBlock(
  container: HTMLElement,
  tabs: TabItem[],
  attrs: CodeTabsContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  await renderTabbedContainer(container, {
    variant: "code-tabs",
    tabs,
    sharedId: attrs.id,
    defaultIconMode: ctx.defaultIconMode,
    persistSelection: ctx.settings?.persistTabSelection !== false,
    lazyPanels: ctx.settings?.tabsLazyPanels !== false,
    contentEpoch: ctx.contentEpoch,
    renderPanel: (panel, markdown) => renderInnerMarkdown(panel, markdown, ctx)
  });
}

async function renderStepsContent(
  container: HTMLElement,
  rawContent: string,
  ctx?: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");
  if (!content) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "vp-steps obsidian-vuepress-steps";
  container.appendChild(wrapper);

  const items = parseStepsRawContent(content);
  if (items.length === 0) {
    if (ctx) {
      await renderInnerMarkdown(wrapper, content, ctx);
    } else {
      wrapper.textContent = content;
    }
    return;
  }

  const ol = document.createElement("ol");
  wrapper.appendChild(ol);

  for (const item of items) {
    const li = document.createElement("li");
    ol.appendChild(li);
    if (!item.body.trim()) {
      continue;
    }
    if (ctx) {
      const body = dedentStepBody(item.body);
      await renderInnerMarkdown(li, body, ctx);
      pruneEmptyMarkdownNodes(li);
      decorateCodeBlockTitles(li, scanCodeFenceTitles(body), ctx.defaultIconMode);
    } else {
      li.textContent = item.body;
    }
  }
}

async function renderStepsBlock(
  container: HTMLElement,
  rawContent: string,
  ctx: BlockRenderContext
): Promise<void> {
  await renderStepsContent(container, rawContent, ctx);
}

async function renderPromptBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: PromptContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");
  const type = attrs.type;
  const title = attrs.title?.trim() || PROMPT_DEFAULT_TITLES[type];

  if (type === "details") {
    const details = document.createElement("details");
    details.className = "vp-custom-container obsidian-vuepress-prompt-container details";
    container.appendChild(details);

    const summary = document.createElement("summary");
    summary.className = "vp-custom-container-title";
    summary.textContent = title;
    applyPromptTitleIcon(summary, type);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "vp-custom-container-content";
    details.appendChild(body);

    await renderInnerMarkdown(body, content, ctx);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = `vp-custom-container obsidian-vuepress-prompt-container ${type}`;
  container.appendChild(wrapper);

  const titleElement = document.createElement("p");
  titleElement.className = "vp-custom-container-title";
  titleElement.textContent = title;
  applyPromptTitleIcon(titleElement, type);
  wrapper.appendChild(titleElement);

  const body = document.createElement("div");
  body.className = "vp-custom-container-content";
  wrapper.appendChild(body);

  await renderInnerMarkdown(body, content, ctx);
}

async function renderCardBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: CardContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");

  const wrapper = document.createElement("article");
  wrapper.className = "vp-card-wrapper";
  container.appendChild(wrapper);

  const title = attrs.title?.trim();
  const icon = attrs.icon?.trim();
  if (title || icon) {
    const header = document.createElement("header");
    header.className = "title";
    if (icon) {
      applyInlineIcon(header, icon, "vp-card-icon");
    }
    if (title) {
      const titleEl = document.createElement("span");
      titleEl.className = "vp-card-title";
      titleEl.textContent = title;
      header.appendChild(titleEl);
    }
    wrapper.appendChild(header);
  }

  const body = document.createElement("section");
  body.className = "body";
  wrapper.appendChild(body);

  await renderNestedMarkdownContent(body, content, ctx);
}

function parseColsAttr(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

async function renderCardGridBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: CardGridContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");
  if (!content) return;

  const wrapper = document.createElement("div");
  wrapper.className = "vp-card-grid";
  const cols = parseColsAttr(attrs.cols);
  if (cols) {
    wrapper.style.setProperty("--vp-card-grid-cols", String(cols));
  }
  container.appendChild(wrapper);

  const blocks = parseAllBlocks(content, ctx.defaultIconMode);
  if (blocks.length > 0 && contentIsOnlyBlocksAndBlankLines(content, blocks)) {
    await renderPlumeBlocksInto(wrapper, blocks, ctx);
    return;
  }
  await renderInnerMarkdown(wrapper, content, ctx);
}

function collectMasonryItems(staging: HTMLElement): HTMLElement[] {
  const items: HTMLElement[] = [];
  for (const node of Array.from(staging.children)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.classList.contains(BLOCK_PLACEHOLDER_CLASS)) {
      continue;
    }
    if (node.tagName === "P") {
      const text = node.textContent?.replace(/\u00a0/g, "").trim() ?? "";
      if (!text && node.children.length === 0) {
        continue;
      }
    }
    items.push(node);
  }
  return items;
}

function measureMasonryItemHeight(item: HTMLElement): number {
  const rect = item.getBoundingClientRect();
  const style = getComputedStyle(item);
  const mt = Number.parseFloat(style.marginTop) || 0;
  const mb = Number.parseFloat(style.marginBottom) || 0;
  return Math.ceil(rect.height + mt + mb);
}

function resolveMasonryColumnCount(wrapperWidth: number, fixedCols?: number): number {
  if (fixedCols) {
    return fixedCols;
  }
  if (wrapperWidth >= 960) {
    return 3;
  }
  if (wrapperWidth >= 640) {
    return 2;
  }
  return 2;
}

function bindMasonryImageLoads(root: HTMLElement, onChange: () => void): void {
  for (const img of Array.from(root.querySelectorAll<HTMLImageElement>("img"))) {
    if (img.dataset.plumeMasonryImgBound === "1") {
      continue;
    }
    img.dataset.plumeMasonryImgBound = "1";
    if (img.complete && img.naturalHeight > 0) {
      continue;
    }
    const onLoad = (): void => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onLoad);
      onChange();
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onLoad);
  }
}

async function renderCardMasonryBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: CardMasonryContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const content = rawContent.replace(/^\n+|\n+$/g, "");
  if (!content) return;

  const fixedCols = parseColsAttr(attrs.cols);
  let gap = 16;
  if (attrs.gap) {
    const g = Number.parseInt(attrs.gap, 10);
    if (Number.isFinite(g) && g >= 0) gap = g;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "vp-card-masonry";
  wrapper.style.setProperty("--vp-card-masonry-gap", `${gap}px`);
  container.appendChild(wrapper);

  const items = await buildMasonryItems(content, wrapper, ctx);
  if (items.length === 0) {
    return;
  }
  for (const item of items) {
    item.classList.add("vp-card-masonry-cell");
  }

  let lastCols = 0;
  let scheduled = false;
  let layouting = false;
  let layoutAttempts = 0;

  const distribute = (N: number): void => {
    layouting = true;
    try {
      for (const item of items) {
        item.remove();
      }
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }

      wrapper.style.setProperty("--vp-card-masonry-cols", String(N));
      wrapper.dataset.cols = String(N);

      const cols: HTMLElement[] = [];
      for (let i = 0; i < N; i += 1) {
        const col = document.createElement("div");
        col.className = "card-masonry-item";
        col.style.gap = `${gap}px`;
        cols.push(col);
        wrapper.appendChild(col);
      }

      for (const item of items) {
        cols[0].appendChild(item);
      }
      const heights = items.map((item) => measureMasonryItemHeight(item));

      for (const col of cols) {
        col.replaceChildren();
      }

      const colHeights = new Array<number>(N).fill(0);
      for (let i = 0; i < items.length; i += 1) {
        let idx = 0;
        let min = colHeights[0];
        for (let k = 1; k < N; k += 1) {
          if (colHeights[k] < min) {
            min = colHeights[k];
            idx = k;
          }
        }
        cols[idx].appendChild(items[i]);
        colHeights[idx] += heights[i] + gap;
      }

      lastCols = N;
      bindMasonryImageLoads(wrapper, schedule);
    } finally {
      layouting = false;
    }
  };

  const layout = (): void => {
    if (!wrapper.isConnected) {
      return;
    }

    const width = wrapper.clientWidth;
    if (width <= 0) {
      layoutAttempts += 1;
      if (layoutAttempts < 40) {
        requestAnimationFrame(layout);
      } else {
        distribute(fixedCols ?? 1);
      }
      return;
    }

    layoutAttempts = 0;
    distribute(resolveMasonryColumnCount(width, fixedCols));
  };

  const schedule = (): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      layout();
    });
  };

  schedule();

  const ro = new ResizeObserver(() => {
    if (layouting) {
      return;
    }
    const width = wrapper.clientWidth;
    if (width <= 0) {
      return;
    }
    const N = resolveMasonryColumnCount(width, fixedCols);
    if (N !== lastCols) {
      schedule();
      return;
    }
    schedule();
  });
  ro.observe(wrapper);
  ctx.component.register(() => ro.disconnect());
}

/* ===== RepoCard ===== */

interface RepoCardInfo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  archived: boolean;
  visibility: "Private" | "Public";
  template: boolean;
  ownerType: "User" | "Organization";
  license: { name: string; url?: string } | null;
}

const REPO_CARD_CACHE_KEY = "vp-plume-repo-card-cache";
const REPO_CARD_TTL_MS = 24 * 60 * 60 * 1000;

// Inline SVGs lifted from the VuePress RepoCard component so we don't depend
// on Iconify or an external icon font in Obsidian.
const REPO_ICONS = {
  github:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7a.75.75 0 1 1-1.072 1.05A2.5 2.5 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.5 2.5 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>',
  gitee:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="#c71d23" d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.59.59 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296Z"/></svg>',
  star:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M243 96a20.33 20.33 0 0 0-17.74-14l-56.59-4.57l-21.84-52.81a20.36 20.36 0 0 0-37.66 0L87.35 77.44L30.76 82a20.45 20.45 0 0 0-11.66 35.88l43.18 37.24l-13.2 55.7A20.37 20.37 0 0 0 79.57 233L128 203.19L176.43 233a20.39 20.39 0 0 0 30.49-22.15l-13.2-55.7l43.18-37.24A20.43 20.43 0 0 0 243 96m-70.47 45.7a12 12 0 0 0-3.84 11.86L181.58 208l-47.29-29.08a12 12 0 0 0-12.58 0L74.42 208l12.89-54.4a12 12 0 0 0-3.84-11.86l-42.27-36.5l55.4-4.47a12 12 0 0 0 10.13-7.38L128 41.89l21.27 51.5a12 12 0 0 0 10.13 7.38l55.4 4.47Z"/></svg>',
  fork:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M228 64a36 36 0 1 0-48 33.94V112a4 4 0 0 1-4 4H80a4 4 0 0 1-4-4V97.94a36 36 0 1 0-24 0V112a28 28 0 0 0 28 28h36v18.06a36 36 0 1 0 24 0V140h36a28 28 0 0 0 28-28V97.94A36.07 36.07 0 0 0 228 64M64 52a12 12 0 1 1-12 12a12 12 0 0 1 12-12m64 152a12 12 0 1 1 12-12a12 12 0 0 1-12 12m64-128a12 12 0 1 1 12-12a12 12 0 0 1-12 12"/></svg>',
  license:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4.5 13.5h7M8.01 1v12.06M1.5 3.5h3l1.5-1h4l1.5 1h3M.5 10L3 4.48L5.5 10C4 11 2 11 .5 10m10 0L13 4.48L15.5 10c-1.5 1-3.5 1-5 0"/></svg>'
};

function loadRepoCardCache(): Record<string, { info: RepoCardInfo; updatedAt: number }> {
  try {
    const raw = window.localStorage.getItem(REPO_CARD_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, { info: RepoCardInfo; updatedAt: number }>;
  } catch {
    return {};
  }
}

function saveRepoCardCache(cache: Record<string, { info: RepoCardInfo; updatedAt: number }>): void {
  try {
    window.localStorage.setItem(REPO_CARD_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage quota / disabled — silently degrade, the next render will refetch.
  }
}

function convertThousand(num: number): number | string {
  if (!Number.isFinite(num)) return 0;
  if (num < 1000) return num;
  return `${(num / 1000).toFixed(1)}k`;
}

async function fetchRepoInfo(provider: "github" | "gitee", owner: string, name: string): Promise<RepoCardInfo | null> {
  const url = `https://api.pengzhanbo.cn/${provider}/repo/${owner}/${name}`;
  try {
    // Obsidian's requestUrl bypasses CORS — required because the upstream
    // proxy doesn't send Access-Control-Allow-Origin for arbitrary apps.
    const res = await requestUrl({ url, method: "GET" });
    if (res.status < 200 || res.status >= 300) return null;
    const json = res.json as RepoCardInfo;
    if (!json || !json.name) return null;
    return json;
  } catch {
    return null;
  }
}

async function renderRepoCardBlock(
  container: HTMLElement,
  attrs: RepoCardContainerAttrs
): Promise<void> {
  const provider = attrs.provider ?? "github";
  const [owner = "", name = ""] = (attrs.repo || "").split("/");
  if (!owner || !name) return;

  const wrapper = container.createDiv({ cls: "vp-repo-card" });
  wrapper.dataset.provider = provider;
  wrapper.dataset.repo = `${owner}/${name}`;

  // Skeleton: show the slug + link immediately so the card has a useful
  // fallback if the API call fails or the user is offline.
  const fallbackUrl =
    provider === "gitee"
      ? `https://gitee.com/${owner}/${name}`
      : `https://github.com/${owner}/${name}`;

  const nameRow = wrapper.createEl("p", { cls: "repo-name" });
  const providerIcon = nameRow.createSpan({ cls: `repo-provider-icon repo-provider-${provider}` });
  providerIcon.innerHTML = REPO_ICONS[provider];
  const linkWrap = nameRow.createSpan({ cls: "repo-link" });
  const link = linkWrap.createEl("a", {
    href: fallbackUrl,
    text: `${owner}/${name}`,
    attr: { target: "_blank", rel: "noopener noreferrer", title: `${owner}/${name}` }
  });
  const visibilityBadge = nameRow.createSpan({ cls: "repo-visibility", text: "Public" });

  const desc = wrapper.createEl("p", { cls: "repo-desc", text: "Loading…" });
  const info = wrapper.createDiv({ cls: "repo-info" });

  const populate = (data: RepoCardInfo): void => {
    link.textContent =
      attrs.fullname || (data.ownerType === "Organization" && attrs.fullname === undefined)
        ? data.fullName
        : data.name;
    link.setAttribute("href", data.url || fallbackUrl);
    link.setAttribute("title", data.fullName);
    visibilityBadge.textContent =
      data.visibility + (data.template ? " Template" : "") + (data.archived ? " archive" : "");
    visibilityBadge.classList.toggle("archived", !!data.archived);
    desc.textContent = data.description || "";
    info.empty();
    if (data.language) {
      const p = info.createEl("p");
      const dot = p.createSpan({ cls: "repo-language" });
      if (data.languageColor) dot.style.backgroundColor = data.languageColor;
      p.createSpan({ text: data.language });
    }
    {
      const p = info.createEl("p", { attr: { title: `Stars: ${data.stars}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      icon.innerHTML = REPO_ICONS.star;
      p.createSpan({ text: String(convertThousand(data.stars)) });
    }
    {
      const p = info.createEl("p", { attr: { title: `Forks: ${data.forks}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      icon.innerHTML = REPO_ICONS.fork;
      p.createSpan({ text: String(convertThousand(data.forks)) });
    }
    if (data.license) {
      const p = info.createEl("p", { attr: { title: `License: ${data.license.name}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      icon.innerHTML = REPO_ICONS.license;
      p.createSpan({ text: data.license.name });
    }
  };

  const cacheKey = `${provider}:${owner}/${name}`;
  const cache = loadRepoCardCache();
  const cached = cache[cacheKey];
  if (cached?.info?.name && Date.now() - cached.updatedAt <= REPO_CARD_TTL_MS) {
    populate(cached.info);
    return;
  }

  const fresh = await fetchRepoInfo(provider, owner, name);
  if (!fresh) {
    desc.textContent = cached?.info?.description ?? "";
    if (cached?.info) populate(cached.info);
    return;
  }
  populate(fresh);
  cache[cacheKey] = { info: fresh, updatedAt: Date.now() };
  saveRepoCardCache(cache);
}

/* ===== LinkCard ===== */

const LINK_CARD_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

async function renderLinkCardBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: LinkCardContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const href = attrs.href.trim();
  if (!href) return;
  const external = isExternalHref(href);

  const wrapper = container.createDiv({ cls: "vp-link-card" });
  const body = wrapper.createSpan({ cls: "body" });

  // The whole card is clickable via an absolutely-positioned link::before
  // overlay (matches VuePress behaviour), so the visible <a> just needs to
  // host the title row.
  const link = body.createEl("a", {
    cls: external ? "link external-link" : "link internal-link",
    href: external ? href : "#",
    text: ""
  });
  if (external) {
    link.setAttribute("target", attrs.target ?? "_blank");
    link.setAttribute("rel", attrs.rel ?? "noopener noreferrer");
  } else {
    // Internal Obsidian note path — hijack click to use workspace opener so
    // hover-preview and tab/split modifiers still work.
    link.setAttribute("data-href", href);
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      const inNewLeaf =
        ev.ctrlKey || ev.metaKey || (ev as MouseEvent).button === 1;
      ctx.app.workspace.openLinkText(href, ctx.sourcePath, inNewLeaf);
    });
  }

  if (attrs.icon) {
    const iconHost = link.createSpan({ cls: "vp-link-card-icon" });
    try {
      setIcon(iconHost, attrs.icon);
    } catch {
      // Unknown icon name — drop the host silently rather than throw.
      iconHost.remove();
    }
  }

  const titleText = attrs.title?.trim() || href;
  link.createSpan({ cls: "text", text: titleText });

  // Description: explicit attr wins; otherwise fall back to container body
  // (rendered as markdown so users can write rich text).
  if (attrs.description) {
    body.createEl("p", { cls: "vp-link-card-desc", text: attrs.description });
  } else {
    const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
    if (bodyMd) {
      const descHost = body.createEl("p", { cls: "vp-link-card-desc" });
      await renderInnerMarkdown(descHost, bodyMd, ctx);
      // Unwrap a single <p> wrapper that MarkdownRenderer adds for short text.
      const onlyP = descHost.children.length === 1 && descHost.firstElementChild?.tagName === "P"
        ? (descHost.firstElementChild as HTMLElement)
        : null;
      if (onlyP) {
        while (onlyP.firstChild) descHost.appendChild(onlyP.firstChild);
        onlyP.remove();
      }
    }
  }

  const arrow = wrapper.createSpan({ cls: "vp-link-card-arrow" });
  arrow.innerHTML = LINK_CARD_ARROW_SVG;
}

/* ===== ImageCard ===== */

function resolveImageSrc(
  raw: string,
  ctx: BlockRenderContext
): string {
  const src = raw.trim();
  if (!src) return "";
  // External / absolute / data URLs — use directly.
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|data:|blob:)/i.test(src)) return src;
  // Vault-relative path — resolve through Obsidian.
  const file = ctx.app.metadataCache.getFirstLinkpathDest(src, ctx.sourcePath);
  if (file) return ctx.app.vault.getResourcePath(file);
  return src;
}

function formatImageCardDate(raw: string | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(d);
  } catch {
    return raw;
  }
}

async function renderImageCardBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: ImageCardContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const imageSrc = resolveImageSrc(attrs.image, ctx);
  if (!imageSrc) return;

  const wrapper = container.createDiv({
    cls: attrs.center ? "vp-image-card center" : "vp-image-card"
  });
  if (attrs.width) {
    const w = /^\d+$/.test(attrs.width.trim()) ? `${attrs.width.trim()}px` : attrs.width;
    wrapper.style.width = w;
  }

  const imgContainer = wrapper.createDiv({ cls: "image-container" });
  const img = imgContainer.createEl("img");
  img.src = imageSrc;
  if (attrs.title) img.alt = attrs.title;
  img.loading = "lazy";

  const dateStr = formatImageCardDate(attrs.date);
  // Fall back to body markdown for description if attribute is not set.
  let descMd = attrs.description ?? "";
  if (!descMd) descMd = rawContent.replace(/^\n+|\n+$/g, "");

  if (!attrs.title && !attrs.author && !dateStr && !descMd) return;

  const info = imgContainer.createDiv({ cls: "image-info" });

  if (attrs.title) {
    const titleEl = info.createEl("h3", { cls: "title" });
    if (attrs.href) {
      const a = titleEl.createEl("a", { cls: "no-icon", href: attrs.href, text: attrs.title });
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      titleEl.createSpan({ text: attrs.title });
    }
  }

  if (attrs.author || dateStr) {
    const cp = info.createEl("p", { cls: "copyright" });
    if (attrs.author) cp.createSpan({ text: attrs.author });
    if (attrs.author && dateStr) cp.createSpan({ text: " | " });
    if (dateStr) cp.createSpan({ text: dateStr });
  }

  if (descMd) {
    const desc = info.createEl("p", { cls: "description" });
    if (attrs.description) {
      desc.setText(attrs.description);
    } else {
      await renderInnerMarkdown(desc, descMd, ctx);
      const onlyP =
        desc.children.length === 1 && desc.firstElementChild?.tagName === "P"
          ? (desc.firstElementChild as HTMLElement)
          : null;
      if (onlyP) {
        while (onlyP.firstChild) desc.appendChild(onlyP.firstChild);
        onlyP.remove();
      }
    }
  }
}

/* ===== Field / FieldGroup ===== */

async function renderFieldBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: FieldContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const cls = ["vp-field"];
  if (attrs.required) cls.push("required");
  if (attrs.optional) cls.push("optional");
  if (attrs.deprecated) cls.push("deprecated");
  const wrapper = container.createDiv({ cls: cls.join(" ") });

  const meta = wrapper.createEl("p", { cls: "field-meta" });
  meta.createSpan({ cls: "name", text: attrs.name });
  if (attrs.required) meta.createSpan({ cls: "required", text: "Required" });
  else if (attrs.optional) meta.createSpan({ cls: "optional", text: "Optional" });
  if (attrs.deprecated) meta.createSpan({ cls: "deprecated", text: "Deprecated" });
  if (attrs.type) {
    const typeSpan = meta.createSpan({ cls: "type" });
    typeSpan.createEl("code", { text: attrs.type });
  }

  if (attrs.default !== undefined) {
    const def = wrapper.createEl("p", { cls: "default-value" });
    def.createEl("code", { text: attrs.default });
  }

  const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
  if (bodyMd) {
    const desc = wrapper.createDiv({ cls: "description" });
    await renderInnerMarkdown(desc, bodyMd, ctx);
  }
}

async function renderFieldGroupBlock(
  container: HTMLElement,
  rawContent: string,
  ctx: BlockRenderContext
): Promise<void> {
  const group = container.createDiv({ cls: "vp-field-group" });
  const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
  if (bodyMd) {
    await renderInnerMarkdown(group, bodyMd, ctx);
  }
}

/* ===== Flex ===== */

function normalizeFlexGap(raw: string | undefined): string {
  if (!raw) return "16px";
  const v = raw.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
  return v;
}

function applyFlexLayoutStyles(wrapper: HTMLElement, attrs: FlexContainerAttrs): void {
  wrapper.style.display = "flex";
  wrapper.style.width = "100%";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.gap = normalizeFlexGap(attrs.gap);

  if (attrs.align === "start") {
    wrapper.style.alignItems = "flex-start";
  } else if (attrs.align === "end") {
    wrapper.style.alignItems = "flex-end";
  } else if (attrs.align === "center") {
    wrapper.style.alignItems = "center";
  }

  if (attrs.justify === "between") {
    wrapper.style.justifyContent = "space-between";
  } else if (attrs.justify === "around") {
    wrapper.style.justifyContent = "space-around";
  } else if (attrs.justify === "center") {
    wrapper.style.justifyContent = "center";
  }

  if (attrs.column) {
    wrapper.style.flexDirection = "column";
  }
  if (attrs.wrap) {
    wrapper.style.flexWrap = "wrap";
  }
}

/** Lift table nodes out of single-child wrappers so flex can size them. */
function hoistFlexTableNodes(root: HTMLElement): void {
  for (const p of Array.from(root.querySelectorAll(":scope > p"))) {
    const tableNode =
      p.querySelector(":scope > .table-wrapper")
      ?? p.querySelector(":scope > table");
    if (!tableNode) {
      continue;
    }
    const text = p.textContent?.replace(/\u00a0/g, "").trim() ?? "";
    if (text === "" || p.childElementCount <= 2) {
      p.replaceWith(tableNode);
    }
  }

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || child.classList.contains("vp-flex-item")) {
      continue;
    }
    if (child.tagName === "TABLE") {
      continue;
    }
    if (child.childElementCount === 1) {
      const only = child.firstElementChild;
      if (
        only instanceof HTMLElement &&
        (only.classList.contains("table-wrapper") || only.tagName === "TABLE")
      ) {
        child.replaceWith(only);
      }
    }
  }
}

/** Assign flex sizing to each direct child (or .vp-flex-item). */
function normalizeFlexChildren(wrapper: HTMLElement, attrs: FlexContainerAttrs): void {
  const isRow = !attrs.column;
  hoistFlexTableNodes(wrapper);

  const children = Array.from(wrapper.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );

  for (const child of children) {
    if (isRow) {
      child.style.flex = "1 1 0";
      child.style.minWidth = "0";
      child.style.maxWidth = "100%";
    } else {
      child.style.flex = "0 0 auto";
      child.style.width = "100%";
      child.style.maxWidth = "100%";
    }
    child.style.margin = "0";
    child.style.boxSizing = "border-box";
  }
}

async function renderFlexBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: FlexContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const wrapper = container.createDiv({ cls: "vp-flex obsidian-vuepress-flex" });
  applyFlexLayoutStyles(wrapper, attrs);

  const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
  if (!bodyMd) {
    return;
  }

  const mdCtx = toPlumeMarkdownContext(ctx);
  const blocks = parseAllBlocks(bodyMd, ctx.defaultIconMode);

  if (blocks.length > 0 && contentIsOnlyBlocksAndBlankLines(bodyMd, blocks)) {
    await renderPlumeBlocksInto(wrapper, blocks, ctx);
  } else {
    const segments = splitFlexSegments(bodyMd);
    if (segments.length <= 1) {
      await renderInnerMarkdown(wrapper, bodyMd, ctx);
      pruneEmptyMarkdownNodes(wrapper);
    } else {
      for (const segment of segments) {
        const item = document.createElement("div");
        item.className = "vp-flex-item";
        wrapper.appendChild(item);
        await renderPlumeMarkdown(item, segment, mdCtx);
        pruneEmptyMarkdownNodes(item);
      }
    }
  }

  normalizeFlexChildren(wrapper, attrs);
}

/* ===== Window ===== */

const WINDOW_ONLY_IMAGE_RE = /^!?\[[^\]]*\]\([^)]+\)$/;

function normalizeWindowSize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
  return v;
}

async function renderWindowBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: WindowContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const bodyMd = rawContent.replace(/^\n+|\n+$/g, "");
  const onlyImg = WINDOW_ONLY_IMAGE_RE.test(bodyMd.trim());

  const article = container.createEl("article", {
    cls: attrs.title ? "window-wrapper has-title" : "window-wrapper"
  });

  const header = article.createEl("header", { cls: "window-header" });
  const left = header.createDiv({ cls: "window-left" });
  left.createEl("i");
  left.createEl("i");
  left.createEl("i");
  if (attrs.title) {
    const center = header.createDiv({ cls: "window-center" });
    const titleEl = center.createEl("h4", { cls: "window-title ignore-header" });
    titleEl.createEl("span", { text: attrs.title });
  }
  header.createDiv({ cls: "window-right" });

  const section = article.createEl("section", { cls: "window-content" });
  const gap = normalizeWindowSize(attrs.gap) ?? ((onlyImg || attrs.noPadding) ? "0" : "20px");
  const height = normalizeWindowSize(attrs.height);
  section.style.setProperty("--window-gap", gap);
  if (height) section.style.setProperty("--window-height", height);

  if (bodyMd) {
    await renderInnerMarkdown(section, bodyMd, ctx);
  }
}

/* ===== Chat ===== */

interface ChatMessage {
  sender: "user" | "self";
  username: string;
  date: string;
  content: string[];
}

function parseChatContent(content: string): ChatMessage[] {
  const lines = content.split("\n");
  const messages: ChatMessage[] = [];
  let currentDate = "";
  let current: ChatMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // {:date} marker
    if (trimmed.startsWith("{:") && trimmed.endsWith("}")) {
      currentDate = trimmed.slice(2, -1).trim();
      continue;
    }
    // {username} or {.} marker
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const username = trimmed.slice(1, -1).trim();
      current = {
        sender: username === "." ? "self" : "user",
        username,
        date: currentDate,
        content: []
      };
      messages.push(current);
      continue;
    }
    if (current) current.content.push(line);
  }
  return messages;
}

async function renderChatBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: ChatContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const wrapper = container.createDiv({ cls: "vp-chat" });
  const header = wrapper.createDiv({ cls: "vp-chat-header" });
  header.createEl("p", { cls: "vp-chat-title", text: attrs.title ?? "Chat" });

  const content = wrapper.createDiv({ cls: "vp-chat-content" });
  const messages = parseChatContent(rawContent.replace(/^\n+|\n+$/g, ""));

  let lastDate = "";
  for (const msg of messages) {
    if (msg.date && msg.date !== lastDate) {
      lastDate = msg.date;
      const dateRow = content.createDiv({ cls: "vp-chat-date" });
      dateRow.createSpan({ text: msg.date });
    }
    const msgEl = content.createDiv({ cls: `vp-chat-message ${msg.sender}` });
    const body = msgEl.createDiv({ cls: "vp-chat-message-body" });
    if (msg.sender === "user") {
      body.createEl("p", { cls: "vp-chat-username", text: msg.username });
    }
    const msgContent = body.createDiv({ cls: "message-content" });
    const bodyMd = msg.content.join("\n").replace(/^\n+|\n+$/g, "");
    if (bodyMd) await renderInnerMarkdown(msgContent, bodyMd, ctx);
  }
}

/* ===== Timeline ===== */

const TIMELINE_ATTR_KEYS = ["time", "type", "icon", "line", "color", "card", "placement"] as const;
type TimelineAttrKey = (typeof TIMELINE_ATTR_KEYS)[number];

const TIMELINE_RE_KEY = /(\w+)=\s*/;
const TIMELINE_RE_SEARCH_KEY = /\s+\w+=\s*|$/;
const TIMELINE_RE_CLEAN_VALUE = /^(["'])(.*)\1$/;

interface RawTimelineItem {
  titleLines: string[];
  attrLine: string | null;
  body: string;
}

function looksLikeTimelineAttrLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const m = trimmed.match(/^([a-zA-Z]\w*)=/);
  if (!m) return false;
  return (TIMELINE_ATTR_KEYS as readonly string[]).includes(m[1].toLowerCase());
}

function parseTimelineAttrLine(raw: string): TimelineItemMeta {
  const meta: TimelineItemMeta = {};
  let buffer = raw.trim();
  while (buffer.length) {
    const keyMatch = buffer.match(TIMELINE_RE_KEY);
    if (!keyMatch) break;
    const key = keyMatch[1].toLowerCase();
    if (!(TIMELINE_ATTR_KEYS as readonly string[]).includes(key)) break;
    buffer = buffer.slice((keyMatch.index ?? 0) + keyMatch[0].length);

    let valueEnd = buffer.search(TIMELINE_RE_SEARCH_KEY);
    if (valueEnd === -1) valueEnd = buffer.length;
    let value = buffer.slice(0, valueEnd).trim();
    const cleaned = value.match(TIMELINE_RE_CLEAN_VALUE);
    if (cleaned) value = cleaned[2];

    switch (key as TimelineAttrKey) {
      case "time":
        meta.time = value;
        break;
      case "type":
        meta.type = value;
        break;
      case "icon":
        meta.icon = value;
        break;
      case "color":
        meta.color = value;
        break;
      case "line":
        if (value === "solid" || value === "dashed" || value === "dotted") {
          meta.line = value;
        }
        break;
      case "card":
        meta.card = value !== "false";
        break;
      case "placement":
        if (value === "left" || value === "right") {
          meta.placement = value;
        }
        break;
    }

    buffer = buffer.slice(valueEnd);
  }
  return meta;
}

function parseTimelineRawContent(rawContent: string): RawTimelineItem[] {
  const lines = rawContent.replace(/\r\n/g, "\n").split("\n");
  const items: RawTimelineItem[] = [];
  let current: { rawLines: string[] } | null = null;

  const isItemStart = (line: string) => /^-\s+/.test(line);

  for (const line of lines) {
    if (isItemStart(line)) {
      if (current) items.push(buildTimelineItem(current.rawLines));
      current = { rawLines: [line.replace(/^-\s+/, "")] };
    } else if (current) {
      // strip the conventional 2-space indent if present
      current.rawLines.push(line.replace(/^ {1,2}/, ""));
    }
    // lines before the first `-` are discarded
  }
  if (current) items.push(buildTimelineItem(current.rawLines));
  return items;
}

function buildTimelineItem(rawLines: string[]): RawTimelineItem {
  // Drop leading/trailing blank lines
  while (rawLines.length && rawLines[0].trim() === "") rawLines.shift();
  while (rawLines.length && rawLines[rawLines.length - 1].trim() === "") rawLines.pop();

  // Split at first blank line: head | body
  const blankIdx = rawLines.findIndex((l) => l.trim() === "");
  const headLines = blankIdx === -1 ? rawLines.slice() : rawLines.slice(0, blankIdx);
  const bodyLines = blankIdx === -1 ? [] : rawLines.slice(blankIdx + 1);

  let attrLine: string | null = null;
  if (headLines.length > 1 && looksLikeTimelineAttrLine(headLines[headLines.length - 1])) {
    attrLine = headLines.pop()!;
  } else if (headLines.length === 1 && looksLikeTimelineAttrLine(headLines[0])) {
    // a single line that is purely attrs (no title) — keep as attr, empty title
    attrLine = headLines.pop()!;
  }

  return {
    titleLines: headLines,
    attrLine,
    body: bodyLines.join("\n")
  };
}

async function renderTimelineBlock(
  container: HTMLElement,
  rawContent: string,
  attrs: TimelineContainerAttrs,
  ctx: BlockRenderContext
): Promise<void> {
  const items = parseTimelineRawContent(rawContent);
  if (items.length === 0) return;

  const wrapper = document.createElement("div");
  wrapper.className = "vp-timeline obsidian-vuepress-timeline";
  if (attrs.horizontal) wrapper.classList.add("horizontal");
  container.appendChild(wrapper);

  const box = document.createElement("div");
  box.className = "vp-timeline-box";
  wrapper.appendChild(box);

  const defaultLine: TimelineLineStyle = attrs.line ?? "solid";
  const defaultPlacement: TimelinePlacement = attrs.placement ?? "left";
  const defaultCard = attrs.card === true;
  const horizontal = attrs.horizontal === true;

  for (const item of items) {
    const meta = item.attrLine ? parseTimelineAttrLine(item.attrLine) : {};

    const type = meta.type || "info";
    const lineStyle: TimelineLineStyle = meta.line || defaultLine;
    const card = meta.card ?? defaultCard;
    const between = defaultPlacement === "between";
    const itemPlacement = between ? "" : defaultPlacement;
    const betweenSide = between ? (meta.placement || "left") : false;

    const itemEl = document.createElement("div");
    itemEl.className = "vp-timeline-item";
    itemEl.classList.add(type);
    itemEl.classList.add(`line-${lineStyle}`);
    if (card) itemEl.classList.add("card");
    if (horizontal) itemEl.classList.add("horizontal");
    if (!horizontal && itemPlacement) itemEl.classList.add(`placement-${itemPlacement}`);
    if (betweenSide) {
      itemEl.classList.add("between");
      itemEl.classList.add(`between-${betweenSide}`);
    }
    if (meta.color) {
      itemEl.style.setProperty("--vp-timeline-c-line", meta.color);
      itemEl.style.setProperty("--vp-timeline-c-point", meta.color);
    }

    const lineEl = document.createElement("div");
    lineEl.className = "vp-timeline-line";
    if (meta.icon) lineEl.classList.add("has-icon");
    const pointEl = document.createElement("span");
    pointEl.className = "vp-timeline-point";
    if (meta.icon) {
      applyInlineIcon(pointEl, meta.icon, "vp-icon");
    }
    lineEl.appendChild(pointEl);
    itemEl.appendChild(lineEl);

    const containerEl = document.createElement("div");
    containerEl.className = "vp-timeline-container";
    const contentEl = document.createElement("div");
    contentEl.className = "vp-timeline-content";

    const titleEl = document.createElement("p");
    titleEl.className = "vp-timeline-title";
    const titleText = item.titleLines.join(" ").trim();
    if (titleText) {
      await renderInlineMarkdownInto(titleEl, titleText, ctx, { phrasingOnly: true });
    }
    contentEl.appendChild(titleEl);

    if (item.body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "vp-timeline-body";
      await renderInnerMarkdown(bodyEl, item.body, ctx);
      contentEl.appendChild(bodyEl);
    }

    containerEl.appendChild(contentEl);

    if (meta.time) {
      const timeEl = document.createElement("p");
      timeEl.className = "vp-timeline-time";
      timeEl.textContent = meta.time;
      containerEl.appendChild(timeEl);
    }

    itemEl.appendChild(containerEl);
    box.appendChild(itemEl);
  }
}

function applyInlineIcon(host: HTMLElement, icon: string, className: string): void {
  const trimmed = icon.trim();
  if (!trimmed) return;
  const isImage =
    /^(https?:)?\/\//i.test(trimmed)
    || trimmed.startsWith("data:")
    || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(trimmed);
  if (isImage) {
    const img = document.createElement("img");
    img.className = className;
    img.src = trimmed;
    img.alt = "";
    img.loading = "lazy";
    host.appendChild(img);
    return;
  }
  const span = document.createElement("span");
  span.className = className;
  span.setAttribute("aria-hidden", "true");
  host.appendChild(span);
  try {
    setIcon(span, trimmed);
  } catch {
    span.textContent = trimmed;
  }
}

// ===========================================================================
// Badge: replace the inline code-span shortcut `` `badge:type:text` `` with a
// styled `.vp-badge` span, mirroring VuePress' VPBadge component. (HTML-style
// `<Badge>` isn't supported because Obsidian's reader strips unknown tags.)
// ===========================================================================

const BADGE_TYPES = new Set(["tip", "info", "warning", "danger", "note", "important"]);
const BADGE_PROCESSED_ATTR = "data-vp-badge-processed";

export function processBadges(rootElement: HTMLElement): void {
  const codes = rootElement.querySelectorAll("code");
  codes.forEach((c) => {
    if (c.hasAttribute(BADGE_PROCESSED_ATTR)) return;
    if (c.parentElement?.tagName === "PRE") return;
    const txt = c.textContent ?? "";
    const m = /^badge[:\s]+([a-z][a-z0-9-]*)(?:[|:](.*))?$/i.exec(txt.trim());
    if (!m) return;
    const span = buildBadgeSpan({ type: m[1], text: m[2] ?? m[1] });
    span.setAttribute(BADGE_PROCESSED_ATTR, "1");
    c.replaceWith(span);
  });
}

function buildBadgeSpan(opts: {
  type: string;
  text: string;
}): HTMLSpanElement {
  const normalized = opts.type.toLowerCase();
  const cls = BADGE_TYPES.has(normalized) ? normalized : "tip";
  const span = document.createElement("span");
  span.className = `vp-badge ${cls}`;
  span.textContent = opts.text;
  return span;
}

registerBlockRenderer(renderBlock);