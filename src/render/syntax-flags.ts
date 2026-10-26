import type { BlockType, ParsedBlock } from "../types";

export interface SyntaxFlags {
  /** ::: containers: cards, tabs, steps, collapse, prompts, and the other shared containers. */
  containers: boolean;
  /** Code trees, file trees, npm-to, and Shiki fence decorations. */
  code: boolean;
  /** PDF, video, and QR embeds. */
  embeds: boolean;
  /** Sub, sup, footnotes, annotations, abbreviations, icons, and badges. */
  inline: boolean;
  /** Trailing `{.class}` on a word. Off unless explicitly enabled. */
  attrs: boolean;
}

const DEFAULT_FLAGS: SyntaxFlags = {
  containers: true,
  code: true,
  embeds: true,
  inline: true,
  attrs: false
};

let flags: SyntaxFlags = { ...DEFAULT_FLAGS };

export function setSyntaxFlags(next: SyntaxFlags): void {
  flags = { ...next };
}

export function getSyntaxFlags(): SyntaxFlags {
  return flags;
}

const CONTAINERS = new Set<BlockType>([
  "prompt",
  "tabs",
  "code-tabs",
  "steps",
  "collapse",
  "card",
  "card-grid",
  "card-masonry",
  "repo-card",
  "link-card",
  "image-card",
  "field",
  "field-group",
  "flex",
  "align",
  "window",
  "chat",
  "timeline",
  "table"
]);

const CODE_BLOCKS = new Set<BlockType>([
  "file-tree",
  "code-tree",
  "code-tree-embed",
  "npm-to"
]);

const EMBEDS = new Set<BlockType>([
  "pdf-embed",
  "bilibili-embed",
  "youtube-embed",
  "qrcode",
  "qrcode-embed"
]);

export function filterBlocks(blocks: ParsedBlock[]): ParsedBlock[] {
  return blocks.filter((block) => {
    if (!flags.containers && CONTAINERS.has(block.type)) return false;
    if (!flags.code && CODE_BLOCKS.has(block.type)) return false;
    if (!flags.embeds && EMBEDS.has(block.type)) return false;
    return true;
  });
}
