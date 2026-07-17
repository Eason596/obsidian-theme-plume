export type FileTreeIconMode = "simple" | "colored";

export interface FileTreeNodeProps {
  filename: string;
  filepath?: string;
  comment?: string;
  focus?: boolean;
  expanded?: boolean;
  type: "folder" | "file";
  diff?: "add" | "remove";
  level?: number;
}

export interface FileTreeNode extends FileTreeNodeProps {
  level: number;
  children: FileTreeNode[];
}

export interface FileTreeContainerAttrs {
  title?: string;
  icon?: FileTreeIconMode;
}

export interface CodeTreeContainerAttrs extends FileTreeContainerAttrs {
  height?: string;
  entry?: string;
}

export interface CodeTreeFileItem {
  filepath: string;
  language: string;
  content: string;
  active?: boolean;
}

export interface TabsContainerAttrs {
  id?: string;
}

export interface CodeTabsContainerAttrs {
  id?: string;
}

export interface TabItem {
  title: string;
  value: string;
  content: string;
  active?: boolean;
}

export type PromptContainerType =
  | "note"
  | "info"
  | "tip"
  | "warning"
  | "caution"
  | "danger"
  | "details"
  | "important";

export interface PromptContainerAttrs {
  type: PromptContainerType;
  title?: string;
  /** `::: details … {open}` — open by default (VuePress Plume). */
  open?: boolean;
}

export interface CardContainerAttrs {
  title?: string;
  icon?: string;
}

export interface CardGridContainerAttrs {
  cols?: string;
}

export interface CardMasonryContainerAttrs {
  cols?: string;
  gap?: string;
}

export interface RepoCardContainerAttrs {
  repo: string;
  provider?: "github" | "gitee";
  fullname?: boolean;
}

export interface LinkCardContainerAttrs {
  href: string;
  title?: string;
  icon?: string;
  description?: string;
  target?: string;
  rel?: string;
}

export interface ImageCardContainerAttrs {
  image: string;
  title?: string;
  description?: string;
  href?: string;
  author?: string;
  date?: string;
  width?: string;
  center?: boolean;
}

export interface FieldContainerAttrs {
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  deprecated?: boolean;
  default?: string;
  /** Remaining description after `@tag` lines (VuePress field body). */
  description?: string;
}

// field-group is a structural wrapper; no attributes.
export type FieldGroupContainerAttrs = Record<string, never>;

export interface FlexContainerAttrs {
  align?: "start" | "end" | "center";
  justify?: "between" | "around" | "center";
  column?: boolean;
  wrap?: boolean;
  gap?: string;
}

export type AlignContainerType = "left" | "center" | "right" | "justify";

export interface AlignContainerAttrs {
  align: AlignContainerType;
}

export interface WindowContainerAttrs {
  title?: string;
  height?: string;
  gap?: string;
  noPadding?: boolean;
}

export interface ChatContainerAttrs {
  title?: string;
}

export interface RepoCardInfo {
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

export interface CollapseContainerAttrs {
  accordion?: boolean;
  expand?: boolean;
}

export type TimelinePlacement = "left" | "right" | "between";
export type TimelineLineStyle = "solid" | "dashed" | "dotted";
export type TimelineItemType =
  | "info"
  | "tip"
  | "success"
  | "warning"
  | "danger"
  | "caution"
  | "important";

export interface TimelineContainerAttrs {
  horizontal?: boolean;
  card?: boolean;
  placement?: TimelinePlacement;
  line?: TimelineLineStyle;
}

export interface TimelineItemMeta {
  time?: string;
  type?: string;
  icon?: string;
  color?: string;
  line?: TimelineLineStyle;
  card?: boolean;
  placement?: "left" | "right";
}

export interface TableContainerAttrs {
  title?: string;
  align?: "left" | "center" | "right";
  copy?: false | "all" | "html" | "md";
  maxContent?: boolean;
  fullWidth?: boolean;
  hlRows?: string;
  hlCols?: string;
  hlCells?: string;
}

export interface NpmToContainerAttrs {
  tabs?: string[];
}

export interface QrcodeContainerAttrs {
  text?: string;
  title?: string;
  align?: "left" | "center" | "right";
  mode?: "img" | "card";
  reverse?: boolean;
  width?: number;
  margin?: number;
  level?: "L" | "M" | "Q" | "H";
  light?: string;
  dark?: string;
  logo?: string;
  logoSize?: number;
}

export interface PdfEmbedAttrs {
  src: string;
  page?: number;
  noToolbar?: boolean;
  zoom?: number;
  width?: string;
  height?: string;
  ratio?: string;
  title?: string;
}

export interface BilibiliEmbedAttrs {
  bvid?: string;
  aid?: string;
  cid?: string;
  page?: number;
  autoplay?: boolean;
  time?: number;
  title?: string;
  width?: string;
  height?: string;
  ratio?: string;
}

export interface YoutubeEmbedAttrs {
  id: string;
  autoplay?: boolean;
  loop?: boolean;
  start?: number;
  end?: number;
  title?: string;
  width?: string;
  height?: string;
  ratio?: string;
}

export interface FileTreePluginSettings {
  defaultIconMode: FileTreeIconMode;
  /** Remember selected tab per `::: tabs#id` / `::: code-tabs#id` in localStorage. */
  persistTabSelection: boolean;
  /** Defer collapse panel body render until the panel is opened. */
  collapseLazyBodies: boolean;
  /** Render only the active tab panel; others load on first switch. */
  tabsLazyPanels: boolean;
  /** Log render failures and show debug hints in preview. */
  debugRender: boolean;
  /** Shiki theme when Obsidian is in light mode (bundled theme id). */
  shikiThemeLight: string;
  /** Shiki theme when Obsidian is in dark mode (bundled theme id). */
  shikiThemeDark: string;
}

export const DEFAULT_SETTINGS: FileTreePluginSettings = {
  defaultIconMode: "colored",
  persistTabSelection: true,
  collapseLazyBodies: true,
  tabsLazyPanels: true,
  debugRender: false,
  shikiThemeLight: "vitesse-light",
  shikiThemeDark: "vitesse-dark"
};

export type BlockType =
  | "file-tree"
  | "code-tree"
  | "code-tree-embed"
  | "tabs"
  | "code-tabs"
  | "steps"
  | "prompt"
  | "collapse"
  | "card"
  | "card-grid"
  | "card-masonry"
  | "repo-card"
  | "link-card"
  | "image-card"
  | "field"
  | "field-group"
  | "flex"
  | "window"
  | "chat"
  | "timeline"
  | "align"
  | "table"
  | "npm-to"
  | "qrcode"
  | "qrcode-embed"
  | "pdf-embed"
  | "bilibili-embed"
  | "youtube-embed";

export interface ParsedBlock {
  type: BlockType;
  /** 0-based, inclusive */
  startLine: number;
  /** 0-based, inclusive */
  endLine: number;
  /** raw content lines joined by `\n`, NOT including the open/close markers */
  rawContent: string;
  /** marker length for `:::` (3+) blocks; 0 for embed */
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
    | AlignContainerAttrs
    | WindowContainerAttrs
    | ChatContainerAttrs
    | TimelineContainerAttrs
    | TableContainerAttrs
    | NpmToContainerAttrs
    | QrcodeContainerAttrs
    | PdfEmbedAttrs
    | BilibiliEmbedAttrs
    | YoutubeEmbedAttrs
    | { dirPath: string } & CodeTreeContainerAttrs
    | Record<string, never>;
}
