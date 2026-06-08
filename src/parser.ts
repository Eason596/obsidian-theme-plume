import type {
  CardContainerAttrs,
  CardGridContainerAttrs,
  CardMasonryContainerAttrs,
  RepoCardContainerAttrs,
  LinkCardContainerAttrs,
  ImageCardContainerAttrs,
  FieldContainerAttrs,
  FieldGroupContainerAttrs,
  FlexContainerAttrs,
  WindowContainerAttrs,
  ChatContainerAttrs,
  CollapseContainerAttrs,
  CodeTreeContainerAttrs,
  CodeTreeFileItem,
  FileTreeContainerAttrs,
  FileTreeIconMode,
  FileTreeNode,
  FileTreeNodeProps,
  ParsedBlock,
  PromptContainerAttrs,
  TabItem,
  TabsContainerAttrs,
  CodeTabsContainerAttrs,
  TimelineContainerAttrs,
  TimelineLineStyle,
  TimelinePlacement,
  AlignContainerType
} from "./types";

const RE_FOCUS = /^\*\*(.*)\*\*(?:$|\s+)/;
const ELLIPSIS = "\u2026";
const RE_CODE_FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const RE_TAB_MARKER = /^\s*@tab(?::active)?\s*(.*)$/i;

function parseAttrValue(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

export function normalizeCodeTreePath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
}

function removeEndingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function parseFileTreeRawContent(content: string): FileTreeNode[] {
  const trimmed = content.trimEnd();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/);
  const root: FileTreeNode = {
    filename: "",
    type: "folder",
    expanded: true,
    level: -1,
    children: []
  };

  const stack: FileTreeNode[] = [root];
  const initialIndent = lines[0]?.match(/^\s*/)?.[0].length ?? 0;

  for (const line of lines) {
    const match = line.match(/^(\s*)-(.*)$/);
    if (!match) {
      continue;
    }

    const level = Math.floor((match[1].length - initialIndent) / 2);
    const info = match[2].trim();

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (!parent) {
      continue;
    }

    const node: FileTreeNode = {
      level,
      children: [],
      ...parseFileTreeNodeInfo(info)
    };

    parent.children.push(node);
    stack.push(node);
  }

  return root.children;
}

export function parseFileTreeNodeInfo(info: string): FileTreeNodeProps {
  let filename = "";
  let comment = "";
  let focus = false;
  let expanded: boolean | undefined = true;
  let type: "folder" | "file" = "file";
  let diff: "add" | "remove" | undefined;

  if (info.startsWith("++")) {
    info = info.slice(2).trim();
    diff = "add";
  } else if (info.startsWith("--")) {
    info = info.slice(2).trim();
    diff = "remove";
  }

  info = info.replace(RE_FOCUS, (_matched, focusName: string) => {
    filename = focusName;
    focus = true;
    return "";
  });

  if (filename === "" && !focus) {
    const commentStart = info.indexOf("#");
    filename = info.slice(0, commentStart === -1 ? info.length : commentStart).trim();
    info = commentStart === -1 ? "" : info.slice(commentStart);
  }

  comment = info.trim();

  if (filename.endsWith("/")) {
    type = "folder";
    expanded = false;
    filename = removeEndingSlash(filename);
  }

  return {
    filename,
    comment,
    focus,
    expanded,
    type,
    diff
  };
}

export function parseContainerHeader(line: string, fallbackIcon: FileTreeIconMode): FileTreeContainerAttrs | null {
  const match = line.trim().match(/^:::\s*file-tree\b(.*)$/i);
  if (!match) {
    return null;
  }

  const tail = match[1] ?? "";
  const attrs: FileTreeContainerAttrs = {
    icon: fallbackIcon
  };

  const attrRegex = /([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = attrRegex.exec(tail)) !== null) {
    const key = attrMatch[1];
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

    if (key === "title") {
      attrs.title = value;
    }

    if (key === "icon" && (value === "simple" || value === "colored")) {
      attrs.icon = value;
    }
  }

  if (tail.includes(":simple-icon")) {
    attrs.icon = "simple";
  }

  if (tail.includes(":colored-icon")) {
    attrs.icon = "colored";
  }

  return attrs;
}

export function parseCodeTreeContainerHeader(line: string, fallbackIcon: FileTreeIconMode): CodeTreeContainerAttrs | null {
  const match = line.trim().match(/^:::\s*code-tree\b(.*)$/i);
  if (!match) {
    return null;
  }

  const tail = match[1] ?? "";
  const attrs: CodeTreeContainerAttrs = {
    icon: fallbackIcon
  };

  const title = parseAttrValue(tail, "title");
  if (title) {
    attrs.title = title;
  }

  const entry = parseAttrValue(tail, "entry");
  if (entry) {
    attrs.entry = normalizeCodeTreePath(entry);
  }

  const height = parseAttrValue(tail, "height");
  if (height) {
    attrs.height = height;
  }

  const icon = parseAttrValue(tail, "icon");
  if (icon === "simple" || icon === "colored") {
    attrs.icon = icon;
  }

  if (tail.includes(":simple-icon")) {
    attrs.icon = "simple";
  }

  if (tail.includes(":colored-icon")) {
    attrs.icon = "colored";
  }

  return attrs;
}

export function parseTabsContainerHeader(line: string): TabsContainerAttrs | null {
  const match = line.trim().match(/^:::\s*tabs\b(.*)$/i);
  if (!match) {
    return null;
  }

  const tail = (match[1] ?? "").trim();
  const attrs: TabsContainerAttrs = {};

  const idMatch = tail.match(/^#([^\s#]+)/);
  if (idMatch?.[1]) {
    attrs.id = idMatch[1];
  } else {
    const idAttr = parseAttrValue(tail, "id");
    if (idAttr) {
      attrs.id = idAttr;
    }
  }

  return attrs;
}

export function isFileTreeOpenMarker(text: string): boolean {
  return /^:::\s*file-tree\b/i.test(text.trim());
}

export function isCodeTreeOpenMarker(text: string): boolean {
  return /^:::\s*code-tree\b/i.test(text.trim());
}

export function isTabsOpenMarker(text: string): boolean {
  return /^:::\s*tabs\b/i.test(text.trim());
}

export function parseCodeTabsContainerHeader(line: string): CodeTabsContainerAttrs | null {
  const match = line.trim().match(/^:::\s*code-tabs\b(.*)$/i);
  if (!match) {
    return null;
  }
  const rest = (match[1] ?? "").trim();
  const attrs: CodeTabsContainerAttrs = {};

  // Syntax: ::: code-tabs#myid   (hash form, matching original vuepress-theme-plume)
  const hashMatch = rest.match(/^#([\w-]+)/);
  if (hashMatch) {
    attrs.id = hashMatch[1];
  } else {
    // Fallback: id="..." form for parity with other containers.
    const id = parseAttrValue(rest, "id");
    if (id) attrs.id = id;
  }

  return attrs;
}

export function isCodeTabsOpenMarker(text: string): boolean {
  return /^:::\s*code-tabs\b/i.test(text.trim());
}

export function isStepsOpenMarker(text: string): boolean {
  return /^:{3,}\s*steps\b/i.test(text.trim());
}

export interface ParsedStepItem {
  /** Markdown body of the step (title line + content), without the leading `N.` marker */
  body: string;
}

const RE_STEP_LINE = /^\s*\d+[.)]\s+/;

/**
 * Split steps container body into items. VuePress relies on markdown `ol`, but
 * Obsidian breaks lists when `:::` containers appear inside `li` — we render
 * one `<li>` per step and run markdown inside each item instead.
 */
export function parseStepsRawContent(rawContent: string): ParsedStepItem[] {
  const text = rawContent.replace(/^\n+|\n+$/g, "");
  if (!text) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  const pushChunk = (): void => {
    if (current.length === 0) {
      return;
    }
    chunks.push(current.join("\n"));
    current = [];
  };

  for (const line of lines) {
    if (RE_STEP_LINE.test(line)) {
      pushChunk();
      current.push(line);
      continue;
    }
    if (current.length > 0) {
      current.push(line);
    }
  }
  pushChunk();

  const items: ParsedStepItem[] = [];
  for (const chunk of chunks) {
    const chunkLines = chunk.split(/\r?\n/);
    if (chunkLines.length === 0) {
      continue;
    }
    chunkLines[0] = chunkLines[0].replace(/^\s*\d+[.)]\s*/, "");
    const body = chunkLines.join("\n").trim();
    items.push({ body });
  }

  return items;
}

/**
 * Remove common list-item indentation so fenced ``` inside steps parse correctly
 * in Obsidian (indented fences are not recognized as code blocks).
 */
export function dedentStepBody(body: string): string {
  const lines = body.split(/\r?\n/);
  const positiveIndents: number[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const len = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (len > 0) {
      positiveIndents.push(len);
    }
  }

  if (positiveIndents.length === 0) {
    return body;
  }

  const min = Math.min(...positiveIndents);
  return lines
    .map((line) => {
      if (!line.trim()) {
        return line;
      }
      const len = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (len >= min) {
        return line.slice(min);
      }
      return line;
    })
    .join("\n");
}

export interface CollapseItem {
  titleLines: string[];
  body: string;
  expand?: boolean;
}

export interface ParsedCollapseContent {
  /** Markdown before the first list item (optional intro). */
  preamble: string;
  items: CollapseItem[];
}

function buildCollapseItem(rawLines: string[]): CollapseItem {
  while (rawLines.length && rawLines[0].trim() === "") rawLines.shift();
  while (rawLines.length && rawLines[rawLines.length - 1].trim() === "") rawLines.pop();

  if (rawLines.length === 0) {
    return { titleLines: [], body: "", expand: undefined };
  }

  const titleLines = [rawLines[0]];
  let bodyStart = 1;
  // 允许空行后正文（正文不缩进也能识别）
  while (bodyStart < rawLines.length && rawLines[bodyStart].trim() === "") {
    bodyStart += 1;
  }
  // 如果正文首行不是新列表项，则全部视为正文
  let bodyRaw = "";
  if (bodyStart < rawLines.length) {
    bodyRaw = rawLines.slice(bodyStart).join("\n");
  }

  let expand: boolean | undefined;
  titleLines[0] = titleLines[0].replace(/^:([+-])\s*/, (_, flag: string) => {
    expand = flag === "+";
    return "";
  });

  return {
    titleLines,
    body: dedentStepBody(bodyRaw),
    expand
  };
}

/**
 * Parse `::: collapse` list body into optional preamble + panel items.
 */
export function parseCollapseRawContent(rawContent: string): ParsedCollapseContent {
  const lines = rawContent.replace(/\r\n/g, "\n").split("\n");
  const preambleLines: string[] = [];
  const items: CollapseItem[] = [];
  let current: string[] | null = null;
  const itemStart = /^(?:[-*+]\s+|\d+[.)]\s+)/;

  for (const line of lines) {
    if (itemStart.test(line)) {
      if (current) {
        items.push(buildCollapseItem(current));
      }
      current = [line.replace(itemStart, "")];
      continue;
    }

    if (current) {
      current.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (current) {
    items.push(buildCollapseItem(current));
  }

  const filtered = items.filter(
    (item) => item.titleLines.length > 0 || item.body.trim().length > 0
  );

  const preamble = dedentStepBody(preambleLines.join("\n").replace(/^\n+|\n+$/g, ""));

  if (filtered.length > 0) {
    return { preamble, items: filtered };
  }

  const trimmed = rawContent.replace(/^\n+|\n+$/g, "");
  if (!trimmed) {
    return { preamble: "", items: [] };
  }

  return {
    preamble: "",
    items: [{ titleLines: [], body: dedentStepBody(trimmed) }]
  };
}

/** Split flex body into separate block-level segments (e.g. two tables). */
export function splitFlexSegments(rawContent: string): string[] {
  const text = rawContent.replace(/^\n+|\n+$/g, "");
  if (!text) {
    return [];
  }

  const parts = text
    .split(/\n(?:[ \t]*\n)+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [text];
}

/** Parse flex header flags the same way as vuepress-plugin-md-power alignPlugin. */
export function parseFlexContainerAttrs(rest: string): FlexContainerAttrs {
  const attrs: FlexContainerAttrs = {};
  const gap = parseAttrValue(rest, "gap");
  if (gap) {
    attrs.gap = gap;
  }

  const flagSource = rest
    .replace(/gap\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, " ")
    .trim()
    .toLowerCase();
  const flags = flagSource.split(/\s+/).filter(Boolean);

  for (const flag of flags) {
    if (flag === "start") {
      attrs.align = "start";
    } else if (flag === "end") {
      attrs.align = "end";
    } else if (flag === "center") {
      attrs.align = "center";
    } else if (flag === "between") {
      attrs.justify = "between";
    } else if (flag === "around") {
      attrs.justify = "around";
    } else if (flag === "column") {
      attrs.column = true;
    } else if (flag === "wrap") {
      attrs.wrap = true;
    }
  }

  if (flags.includes("center") && !attrs.justify) {
    attrs.justify = "center";
  }

  return attrs;
}

export function parsePromptContainerHeader(line: string): (PromptContainerAttrs & { markerLen: number }) | null {
  const match = line.trim().match(/^(:{3,})\s*(note|info|tip|warning|caution|details|important)\b(.*)$/i);
  if (!match) {
    return null;
  }

  const markerLen = match[1]?.length ?? 0;
  const type = (match[2] ?? "").toLowerCase() as PromptContainerAttrs["type"];
  const title = (match[3] ?? "").trim() || undefined;

  return {
    type,
    title,
    markerLen
  };
}

export function isPromptContainerOpenMarker(text: string): boolean {
  return /^:{3,}\s*(note|info|tip|warning|caution|details|important)\b/i.test(text.trim());
}

export function isFileTreeCloseMarker(text: string): boolean {
  return text.trim() === ":::";
}

export function parseCodeTreeRawContent(content: string): CodeTreeFileItem[] {
  const lines = content.split(/\r?\n/);
  const files: CodeTreeFileItem[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const openMatch = line.match(RE_CODE_FENCE_OPEN);
    if (!openMatch) {
      continue;
    }

    const fence = openMatch[2];
    const markerChar = fence[0];
    const markerLength = fence.length;
    const info = (openMatch[3] ?? "").trim();
    const title = parseAttrValue(info, "title");
    const isActive = /(?:^|\s):active(?:\s|$)/.test(info);
    const languageToken = info.split(/\s+/)[0] ?? "";
    const language = languageToken && !languageToken.startsWith(":") ? languageToken : "text";

    const body: string[] = [];
    let closed = false;

    for (let cursor = lineIndex + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];
      const closeRegex = new RegExp(`^\\s*${markerChar}{${markerLength},}\\s*$`);
      if (closeRegex.test(current)) {
        lineIndex = cursor;
        closed = true;
        break;
      }
      body.push(current);
    }

    if (!closed) {
      break;
    }

    if (!title) {
      continue;
    }

    const filepath = normalizeCodeTreePath(title);
    if (!filepath) {
      continue;
    }

    files.push({
      filepath,
      language,
      content: body.join("\n"),
      active: isActive
    });
  }

  return files;
}

function parseTabMarker(line: string): {
  title: string;
  value: string;
  active: boolean;
} | null {
  const match = line.match(RE_TAB_MARKER);
  if (!match) {
    return null;
  }

  const active = /@tab:active/i.test(line);
  const raw = (match[1] ?? "").trim();
  const hashIndex = raw.indexOf("#");

  let title = raw;
  let value = "";

  if (hashIndex >= 0) {
    title = raw.slice(0, hashIndex).trim();
    value = raw.slice(hashIndex + 1).trim();
  }

  title ||= value;
  value ||= title;

  if (!title && !value) {
    return null;
  }

  return {
    title,
    value,
    active
  };
}

export function parseTabsRawContent(content: string): TabItem[] {
  const lines = content.split(/\r?\n/);
  const tabs: TabItem[] = [];

  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const marker = parseTabMarker(lines[lineIndex]);
    if (!marker) {
      lineIndex += 1;
      continue;
    }

    const body: string[] = [];
    lineIndex += 1;

    let fenceChar = "";
    let fenceLength = 0;

    while (lineIndex < lines.length) {
      const current = lines[lineIndex];

      if (fenceLength > 0) {
        body.push(current);

        const closeRegex = new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`);
        if (closeRegex.test(current)) {
          fenceChar = "";
          fenceLength = 0;
        }

        lineIndex += 1;
        continue;
      }

      const openMatch = current.match(RE_CODE_FENCE_OPEN);
      if (openMatch) {
        const fence = openMatch[2];
        fenceChar = fence[0];
        fenceLength = fence.length;
        body.push(current);
        lineIndex += 1;
        continue;
      }

      if (parseTabMarker(current)) {
        break;
      }

      body.push(current);
      lineIndex += 1;
    }

    tabs.push({
      title: marker.title,
      value: marker.value,
      active: marker.active,
      content: body.join("\n").replace(/^\n+|\n+$/g, "")
    });
  }

  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];

    if (!tab.title) {
      tab.title = `Tab ${index + 1}`;
    }

    if (!tab.value) {
      tab.value = tab.title;
    }
  }

  return tabs;
}

export function parseCodeTreeFileNodes(files: CodeTreeFileItem[]): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];

  for (const file of files) {
    const normalized = normalizeCodeTreePath(file.filepath);
    if (!normalized) {
      continue;
    }

    const parts = normalized.split("/").filter(Boolean);
    let children = nodes;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isFile = index === parts.length - 1;

      let node = children.find((item) => {
        return item.filename === part;
      });

      if (!node) {
        node = {
          filename: part,
          filepath: isFile ? normalized : undefined,
          type: isFile ? "file" : "folder",
          expanded: true,
          level: index,
          children: []
        };
        children.push(node);
      }

      if (isFile) {
        node.type = "file";
        node.filepath = normalized;
        continue;
      }

      node.type = "folder";
      node.expanded = true;
      children = node.children;
    }
  }

  return nodes;
}

function listItemInlineText(item: HTMLLIElement): string {
  const parts: string[] = [];

  for (const node of Array.from(item.childNodes)) {
    if (node instanceof HTMLElement && (node.tagName === "UL" || node.tagName === "OL")) {
      break;
    }

    if (node instanceof HTMLElement && node.tagName === "STRONG") {
      const strongText = (node.textContent ?? "").trim();
      parts.push(`**${strongText}**`);
      continue;
    }

    parts.push(node.textContent ?? "");
  }

  return parts.join("").replace(/\r?\n/g, " ").trim();
}

export function listElementToRawLines(list: HTMLElement, level = 0): string[] {
  const lines: string[] = [];

  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement)) {
      continue;
    }

    const info = listItemInlineText(child);
    if (info) {
      lines.push(`${"  ".repeat(level)}- ${info}`);
    }

    const nestedLists = Array.from(child.children).filter((nested) => {
      return nested.tagName === "UL" || nested.tagName === "OL";
    });

    for (const nestedList of nestedLists) {
      lines.push(...listElementToRawLines(nestedList as HTMLElement, level + 1));
    }
  }

  return lines;
}

export function fileTreeToCMDText(nodes: FileTreeNode[], prefix = ""): string {
  let content = prefix ? "" : ".\n";

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const lead = i === nodes.length - 1 ? "└── " : "├── ";
    content += `${prefix}${lead}${node.filename}\n`;

    const childNodes = node.children.filter((child) => {
      return child.filename !== ELLIPSIS && child.filename !== "...";
    });

    if (childNodes.length > 0) {
      const childPrefix = prefix + (i === nodes.length - 1 ? "    " : "│   ");
      content += fileTreeToCMDText(childNodes, childPrefix);
    }
  }

  return content;
}




// ---------------------------------------------------------------------------
// Unified block scanner
// ---------------------------------------------------------------------------

const RE_FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const RE_DEFAULT_ICON_FALLBACK: FileTreeIconMode = "colored";

const CODE_TREE_EMBED_RE_LINE = /^\s*@\[code-tree([^\]]*)\]\(([^)]*)\)\s*$/i;

interface ContainerHeaderInfo {
  type: "file-tree" | "code-tree" | "tabs" | "code-tabs" | "steps" | "prompt" | "collapse" | "card" | "card-grid" | "card-masonry" | "repo-card" | "link-card" | "image-card" | "field" | "field-group" | "flex" | "window" | "chat" | "timeline";
  markerLen: number;
  attrs:
    | FileTreeContainerAttrs
    | CodeTreeContainerAttrs
    | TabsContainerAttrs
    | CodeTabsContainerAttrs
    | PromptContainerAttrs
    | CollapseContainerAttrs
    | CardContainerAttrs
    | CardGridContainerAttrs
    | CardMasonryContainerAttrs
    | RepoCardContainerAttrs
    | LinkCardContainerAttrs
    | ImageCardContainerAttrs
    | FieldContainerAttrs
    | FieldGroupContainerAttrs
    | FlexContainerAttrs
    | WindowContainerAttrs
    | ChatContainerAttrs
    | TimelineContainerAttrs;
}

function detectContainerOpen(line: string, fallbackIcon: FileTreeIconMode): ContainerHeaderInfo | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(:{3,})\s*([a-zA-Z][\w-]*)\b(.*)$/);
  if (!match) {
    return null;
  }

  const markerLen = match[1].length;
  const keyword = match[2].toLowerCase();
  const rest = match[3] ?? "";

  if (keyword === "file-tree") {
    const attrs = parseContainerHeader(line, fallbackIcon);
    if (!attrs) return null;
    return { type: "file-tree", markerLen, attrs };
  }

  if (keyword === "code-tree") {
    const attrs = parseCodeTreeContainerHeader(line, fallbackIcon);
    if (!attrs) return null;
    return { type: "code-tree", markerLen, attrs };
  }

  if (keyword === "tabs") {
    const attrs = parseTabsContainerHeader(line);
    if (!attrs) return null;
    return { type: "tabs", markerLen, attrs };
  }

  if (keyword === "code-tabs") {
    const attrs = parseCodeTabsContainerHeader(line);
    if (!attrs) return null;
    return { type: "code-tabs", markerLen, attrs };
  }

  if (keyword === "steps") {
    return { type: "steps", markerLen, attrs: {} as TabsContainerAttrs };
  }

  if (keyword === "collapse") {
    const attrs: CollapseContainerAttrs = {};
    if (/(^|\s)accordion(\s|$|=)/i.test(rest)) {
      const accordionVal = parseAttrValue(rest, "accordion");
      attrs.accordion = accordionVal ? accordionVal !== "false" : true;
    }
    if (/(^|\s)expand(\s|$|=)/i.test(rest)) {
      const expandVal = parseAttrValue(rest, "expand");
      attrs.expand = expandVal ? expandVal !== "false" : true;
    }
    return { type: "collapse", markerLen, attrs };
  }

  if (keyword === "card") {
    const attrs: CardContainerAttrs = {};
    const title = parseAttrValue(rest, "title");
    if (title) attrs.title = title;
    const icon = parseAttrValue(rest, "icon");
    if (icon) attrs.icon = icon;
    return { type: "card", markerLen, attrs };
  }

  if (keyword === "card-grid") {
    const attrs: CardGridContainerAttrs = {};
    const cols = parseAttrValue(rest, "cols");
    if (cols) attrs.cols = cols;
    return { type: "card-grid", markerLen, attrs };
  }

  if (keyword === "card-masonry") {
    const attrs: CardMasonryContainerAttrs = {};
    const cols = parseAttrValue(rest, "cols");
    if (cols) attrs.cols = cols;
    const gap = parseAttrValue(rest, "gap");
    if (gap) attrs.gap = gap;
    return { type: "card-masonry", markerLen, attrs };
  }

  if (keyword === "repo-card") {
    // Accept either `repo="owner/name"` or a positional `owner/name` after
    // the keyword (matches the convention used by `prompt` containers).
    let repo = parseAttrValue(rest, "repo") ?? "";
    if (!repo) {
      const positional = rest.trim().split(/\s+/)[0] ?? "";
      if (positional && positional.includes("/") && !positional.includes("=")) {
        repo = positional;
      }
    }
    if (!repo) return null;
    const attrs: RepoCardContainerAttrs = { repo };
    const provider = parseAttrValue(rest, "provider");
    if (provider === "gitee" || provider === "github") attrs.provider = provider;
    if (/(^|\s)fullname(\s|$|=)/i.test(rest)) {
      const v = parseAttrValue(rest, "fullname");
      attrs.fullname = v ? v !== "false" : true;
    }
    return { type: "repo-card", markerLen, attrs };
  }

  if (keyword === "link-card") {
    // href is required and supports either `href="..."` or a positional URL
    // after the keyword (matches the `repo-card` convention).
    let href = parseAttrValue(rest, "href") ?? "";
    if (!href) {
      const positional = rest.trim().split(/\s+/)[0] ?? "";
      if (positional && !positional.includes("=")) href = positional;
    }
    if (!href) return null;
    const attrs: LinkCardContainerAttrs = { href };
    const title = parseAttrValue(rest, "title");
    if (title) attrs.title = title;
    const icon = parseAttrValue(rest, "icon");
    if (icon) attrs.icon = icon;
    const description = parseAttrValue(rest, "description");
    if (description) attrs.description = description;
    const target = parseAttrValue(rest, "target");
    if (target) attrs.target = target;
    const rel = parseAttrValue(rest, "rel");
    if (rel) attrs.rel = rel;
    return { type: "link-card", markerLen, attrs };
  }

  if (keyword === "image-card") {
    // image is required and supports either `image="..."` or a positional URL
    let image = parseAttrValue(rest, "image") ?? "";
    if (!image) {
      const positional = rest.trim().split(/\s+/)[0] ?? "";
      if (positional && !positional.includes("=")) image = positional;
    }
    if (!image) return null;
    const attrs: ImageCardContainerAttrs = { image };
    const title = parseAttrValue(rest, "title");
    if (title) attrs.title = title;
    const description = parseAttrValue(rest, "description");
    if (description) attrs.description = description;
    const href = parseAttrValue(rest, "href");
    if (href) attrs.href = href;
    const author = parseAttrValue(rest, "author");
    if (author) attrs.author = author;
    const date = parseAttrValue(rest, "date");
    if (date) attrs.date = date;
    const width = parseAttrValue(rest, "width");
    if (width) attrs.width = width;
    const center = parseAttrValue(rest, "center");
    if (center !== undefined) attrs.center = center !== "false";
    else if (/(^|\s)center(\s|$)/.test(rest)) attrs.center = true;
    return { type: "image-card", markerLen, attrs };
  }

  if (keyword === "field") {
    const name = parseAttrValue(rest, "name") ?? "";
    if (!name) return null;
    const attrs: FieldContainerAttrs = { name };
    const type = parseAttrValue(rest, "type");
    if (type) attrs.type = type;
    const def = parseAttrValue(rest, "default");
    if (def !== undefined) attrs.default = def;
    if (/(^|\s)required(\s|$)/.test(rest)) attrs.required = true;
    if (/(^|\s)optional(\s|$)/.test(rest)) attrs.optional = true;
    if (/(^|\s)deprecated(\s|$)/.test(rest)) attrs.deprecated = true;
    return { type: "field", markerLen, attrs };
  }

  if (keyword === "field-group") {
    return { type: "field-group", markerLen, attrs: {} as FieldGroupContainerAttrs };
  }

  if (keyword === "flex") {
    return { type: "flex", markerLen, attrs: parseFlexContainerAttrs(rest) };
  }

  if (keyword === "center" || keyword === "right") {
    return { type: "align", markerLen, attrs: { align: keyword as AlignContainerType } };
  }

  if (keyword === "window" || keyword === "demo-wrapper") {
    const attrs: WindowContainerAttrs = {};
    const title = parseAttrValue(rest, "title");
    if (title) attrs.title = title;
    const height = parseAttrValue(rest, "height");
    if (height) attrs.height = height;
    const gap = parseAttrValue(rest, "gap");
    if (gap) attrs.gap = gap;
    if (/(^|\s)no-?padding(\s|$)/i.test(rest)) attrs.noPadding = true;
    return { type: "window", markerLen, attrs };
  }

  if (keyword === "chat") {
    const attrs: ChatContainerAttrs = {};
    const title = parseAttrValue(rest, "title");
    if (title) attrs.title = title;
    return { type: "chat", markerLen, attrs };
  }

  if (keyword === "timeline") {
    const attrs: TimelineContainerAttrs = {};
    if (/(^|\s)horizontal(\s|$|=)/i.test(rest)) {
      const horizontalVal = parseAttrValue(rest, "horizontal");
      attrs.horizontal = horizontalVal ? horizontalVal !== "false" : true;
    }
    if (/(^|\s)card(\s|$|=)/i.test(rest)) {
      const cardVal = parseAttrValue(rest, "card");
      attrs.card = cardVal ? cardVal !== "false" : true;
    }
    const placement = parseAttrValue(rest, "placement");
    if (placement === "left" || placement === "right" || placement === "between") {
      attrs.placement = placement as TimelinePlacement;
    }
    const line = parseAttrValue(rest, "line");
    if (line === "solid" || line === "dashed" || line === "dotted") {
      attrs.line = line as TimelineLineStyle;
    }
    return { type: "timeline", markerLen, attrs };
  }

  if (
    keyword === "note" ||
    keyword === "info" ||
    keyword === "tip" ||
    keyword === "warning" ||
    keyword === "caution" ||
    keyword === "details" ||
    keyword === "important"
  ) {
    const title = rest.trim() || undefined;
    return {
      type: "prompt",
      markerLen,
      attrs: {
        type: keyword,
        title
      }
    };
  }

  return null;
}

/**
 * Scan markdown text and return every top-level block we know how to render.
 * Inner / nested blocks are NOT returned here; they are re-discovered when the
 * outer block content is rendered recursively.
 *
 * Top-level rules:
 *  - `:::` containers respect fenced code blocks (ignore markers inside fences)
 *  - close marker must have marker-length >= open marker-length and appear at
 *    matching nesting depth (where depth counts ANY `:::xxx` headers, regardless of keyword)
 *  - `@[code-tree ...](path)` single-line embeds are detected when they appear
 *    outside any container or fenced code block.
 */
export function parseAllBlocks(
  text: string,
  fallbackIcon: FileTreeIconMode = RE_DEFAULT_ICON_FALLBACK
): ParsedBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];

  let i = 0;
  let fenceChar = "";
  let fenceLen = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Track fenced code blocks at the top level so we don't mis-parse ::: inside them.
    if (fenceLen > 0) {
      const closeRegex = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      if (closeRegex.test(line)) {
        fenceChar = "";
        fenceLen = 0;
      }
      i += 1;
      continue;
    }

    const fenceMatch = line.match(RE_FENCE_OPEN);
    if (fenceMatch) {
      fenceChar = fenceMatch[2][0];
      fenceLen = fenceMatch[2].length;
      i += 1;
      continue;
    }

    const embedMatch = line.match(CODE_TREE_EMBED_RE_LINE);
    if (embedMatch) {
      const info = embedMatch[1] ?? "";
      const dirPath = (embedMatch[2] ?? "").trim();
      if (dirPath) {
        const attrs = parseCodeTreeContainerHeader(`::: code-tree${info}`, fallbackIcon);
        if (attrs) {
          blocks.push({
            type: "code-tree-embed",
            startLine: i,
            endLine: i,
            rawContent: "",
            markerLen: 0,
            attrs: { ...attrs, dirPath } as CodeTreeContainerAttrs & { dirPath: string }
          });
        }
      }
      i += 1;
      continue;
    }

    const header = detectContainerOpen(line, fallbackIcon);
    if (!header) {
      i += 1;
      continue;
    }

    // Scan forward to the matching close marker, tracking nested containers
    // and inner fences. We DO NOT validate inner content here; the dedicated
    // renderer will re-parse it.
    let innerFenceChar = "";
    let innerFenceLen = 0;
    let nestedDepth = 0;
    let closeLine = -1;
    const buf: string[] = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      const cur = lines[j];

      if (innerFenceLen > 0) {
        buf.push(cur);
        const closeRegex = new RegExp(`^\\s*${innerFenceChar}{${innerFenceLen},}\\s*$`);
        if (closeRegex.test(cur)) {
          innerFenceChar = "";
          innerFenceLen = 0;
        }
        continue;
      }

      const innerFenceMatch = cur.match(RE_FENCE_OPEN);
      if (innerFenceMatch) {
        innerFenceChar = innerFenceMatch[2][0];
        innerFenceLen = innerFenceMatch[2].length;
        buf.push(cur);
        continue;
      }

      const closeMatch = cur.match(/^\s*(:{3,})\s*$/);
      if (closeMatch) {
        const ml = closeMatch[1].length;
        if (ml >= header.markerLen && nestedDepth === 0) {
          closeLine = j;
          break;
        }
        if (nestedDepth > 0) {
          nestedDepth -= 1;
        }
        buf.push(cur);
        continue;
      }

      if (/^\s*:{3,}\s*[a-zA-Z]/.test(cur)) {
        nestedDepth += 1;
      }

      buf.push(cur);
    }

    if (closeLine === -1) {
      // Unterminated container �� skip the open marker and continue scanning.
      i += 1;
      continue;
    }

    blocks.push({
      type: header.type,
      startLine: i,
      endLine: closeLine,
      rawContent: buf.join("\n"),
      markerLen: header.markerLen,
      attrs: header.attrs
    });

    i = closeLine + 1;
  }

  return blocks;
}