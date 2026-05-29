import { getIconIds, type IconName } from "obsidian";
import { resolveOfflineIconSvg } from "./offlineIconify";
import type { FileTreeIconMode } from "./types";

export interface IconDescriptor {
  icon: IconName;
  offlineSvg?: string;
  colorClass?: string;
}

interface IconStyle {
  icon?: IconName | IconName[];
  colorClass?: string;
}

const DEFAULT_FILE_ICON: IconName = "file";
const DEFAULT_FOLDER_ICON: IconName = "folder";
const DEFAULT_FOLDER_OPEN_ICON: IconName = "folder-open";

const DEFAULT_FILE_COLOR = "ft-color-default";
const DEFAULT_FOLDER_COLOR = "ft-color-folder";

let availableIconSet: Set<string> | null = null;

function ensureIconSet(): Set<string> {
  if (!availableIconSet) {
    availableIconSet = new Set(getIconIds() as string[]);
  }
  return availableIconSet;
}

function safeIcon(icon: IconName | IconName[] | undefined, fallback: IconName): IconName {
  if (!icon) {
    return fallback;
  }

  const iconSet = ensureIconSet();
  if (Array.isArray(icon)) {
    for (const candidate of icon) {
      if (iconSet.has(candidate)) {
        return candidate;
      }
    }
    return fallback;
  }

  return iconSet.has(icon) ? icon : fallback;
}

const CANDIDATES = {
  package: ["package", "archive", "box"] as IconName[],
  lock: ["lock", "shield-lock", "shield"] as IconName[],
  docs: ["book-open", "book-text", "file-text"] as IconName[],
  security: ["shield", "shield-check", "shield-alert"] as IconName[],
  git: ["git-branch", "git-compare", "git-merge"] as IconName[],
  env: ["shield", "key-round", "lock"] as IconName[],
  config: ["settings", "sliders-horizontal", "wrench"] as IconName[],
  codeFile: ["file-code-2", "file-code", "code"] as IconName[],
  jsonFile: ["file-json-2", "file-json", "braces"] as IconName[],
  markdown: ["book-open", "file-text", "notebook-pen"] as IconName[],
  textFile: ["file-text", "file", "notebook-text"] as IconName[],
  style: ["palette", "paintbrush-2", "paintbrush"] as IconName[],
  image: ["image", "image-up", "file-image"] as IconName[],
  video: ["video", "clapperboard", "film"] as IconName[],
  music: ["music", "audio-lines", "audio-waveform"] as IconName[],
  archive: ["archive", "package", "box"] as IconName[],
  database: ["database", "table", "cylinder"] as IconName[],
  terminal: ["terminal", "square-terminal", "command"] as IconName[],
  srcFolder: ["folder-code", "folder-git-2", "folder"] as IconName[],
  docsFolder: ["book-open", "folder", "book-text"] as IconName[],
  testFolder: ["flask-conical", "flask-round", "beaker"] as IconName[],
  publicFolder: ["globe", "globe-2", "folder"] as IconName[],
  assetsFolder: ["image", "folder", "file-image"] as IconName[]
};

const NAMED_FILE_STYLES: Record<string, IconStyle> = {
  "package.json": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "pnpm-workspace.yaml": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "pnpm-workspace.yml": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "package-lock.json": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },
  "pnpm-lock.yaml": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },
  "yarn.lock": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },
  "bun.lockb": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },

  "readme": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "readme.md": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "readme.mdx": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "changelog.md": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "contributing.md": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "license": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "license.md": { icon: CANDIDATES.docs, colorClass: "ft-color-doc" },
  "security.md": { icon: CANDIDATES.security, colorClass: "ft-color-security" },

  ".gitignore": { icon: CANDIDATES.git, colorClass: "ft-color-git" },
  ".gitattributes": { icon: CANDIDATES.git, colorClass: "ft-color-git" },
  ".gitmodules": { icon: CANDIDATES.git, colorClass: "ft-color-git" },

  ".env": { icon: CANDIDATES.env, colorClass: "ft-color-env" },
  ".env.local": { icon: CANDIDATES.env, colorClass: "ft-color-env" },
  ".env.development": { icon: CANDIDATES.env, colorClass: "ft-color-env" },
  ".env.production": { icon: CANDIDATES.env, colorClass: "ft-color-env" },
  ".env.example": { icon: CANDIDATES.env, colorClass: "ft-color-env" },

  "dockerfile": { icon: CANDIDATES.package, colorClass: "ft-color-docker" },
  "docker-compose.yml": { icon: CANDIDATES.package, colorClass: "ft-color-docker" },
  "docker-compose.yaml": { icon: CANDIDATES.package, colorClass: "ft-color-docker" },
  ".dockerignore": { icon: CANDIDATES.package, colorClass: "ft-color-docker" },

  "tsconfig.json": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "tsconfig.base.json": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "jsconfig.json": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "vite.config.ts": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "vite.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "webpack.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "rollup.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "eslint.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "eslint.config.mjs": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "prettier.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "stylelint.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "vitest.config.ts": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "jest.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "tailwind.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  "postcss.config.js": { icon: CANDIDATES.config, colorClass: "ft-color-config" },

  "makefile": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  "requirements.txt": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "pyproject.toml": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "poetry.lock": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },
  "go.mod": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "go.sum": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" },
  "cargo.toml": { icon: CANDIDATES.package, colorClass: "ft-color-package" },
  "cargo.lock": { icon: CANDIDATES.lock, colorClass: "ft-color-lock" }
};

const FOLDER_STYLES: Record<string, IconStyle> = {
  src: { icon: CANDIDATES.srcFolder, colorClass: "ft-color-src" },
  source: { icon: CANDIDATES.srcFolder, colorClass: "ft-color-src" },
  docs: { icon: CANDIDATES.docsFolder, colorClass: "ft-color-docs" },
  doc: { icon: CANDIDATES.docsFolder, colorClass: "ft-color-docs" },
  blog: { icon: CANDIDATES.docsFolder, colorClass: "ft-color-docs" },
  test: { icon: CANDIDATES.testFolder, colorClass: "ft-color-tests" },
  tests: { icon: CANDIDATES.testFolder, colorClass: "ft-color-tests" },
  __tests__: { icon: CANDIDATES.testFolder, colorClass: "ft-color-tests" },
  dist: { colorClass: "ft-color-dist" },
  build: { colorClass: "ft-color-dist" },
  out: { colorClass: "ft-color-dist" },
  public: { icon: CANDIDATES.publicFolder, colorClass: "ft-color-public" },
  assets: { icon: CANDIDATES.assetsFolder, colorClass: "ft-color-assets" },
  images: { icon: CANDIDATES.assetsFolder, colorClass: "ft-color-assets" },
  img: { icon: CANDIDATES.assetsFolder, colorClass: "ft-color-assets" },
  scripts: { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  script: { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  config: { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  node_modules: { colorClass: "ft-color-package" },
  types: { colorClass: "ft-color-typescript" },
  style: { colorClass: "ft-color-style" },
  styles: { colorClass: "ft-color-style" },
  database: { icon: CANDIDATES.database, colorClass: "ft-color-database" }
};

const EXTENSION_STYLES: Record<string, IconStyle> = {
  ".d.ts": { icon: CANDIDATES.codeFile, colorClass: "ft-color-typescript" },
  ".ts": { icon: CANDIDATES.codeFile, colorClass: "ft-color-typescript" },
  ".tsx": { icon: CANDIDATES.codeFile, colorClass: "ft-color-typescript" },
  ".mts": { icon: CANDIDATES.codeFile, colorClass: "ft-color-typescript" },
  ".cts": { icon: CANDIDATES.codeFile, colorClass: "ft-color-typescript" },

  ".js": { icon: CANDIDATES.codeFile, colorClass: "ft-color-javascript" },
  ".jsx": { icon: CANDIDATES.codeFile, colorClass: "ft-color-javascript" },
  ".mjs": { icon: CANDIDATES.codeFile, colorClass: "ft-color-javascript" },
  ".cjs": { icon: CANDIDATES.codeFile, colorClass: "ft-color-javascript" },

  ".vue": { icon: CANDIDATES.codeFile, colorClass: "ft-color-vue" },

  ".md": { icon: CANDIDATES.markdown, colorClass: "ft-color-markdown" },
  ".mdx": { icon: CANDIDATES.markdown, colorClass: "ft-color-markdown" },
  ".txt": { icon: CANDIDATES.textFile, colorClass: "ft-color-doc" },
  ".pdf": { icon: CANDIDATES.textFile, colorClass: "ft-color-doc" },

  ".json": { icon: CANDIDATES.jsonFile, colorClass: "ft-color-json" },
  ".jsonc": { icon: CANDIDATES.jsonFile, colorClass: "ft-color-json" },
  ".yaml": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  ".yml": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  ".toml": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  ".ini": { icon: CANDIDATES.config, colorClass: "ft-color-config" },
  ".conf": { icon: CANDIDATES.config, colorClass: "ft-color-config" },

  ".css": { icon: CANDIDATES.style, colorClass: "ft-color-style" },
  ".scss": { icon: CANDIDATES.style, colorClass: "ft-color-style" },
  ".sass": { icon: CANDIDATES.style, colorClass: "ft-color-style" },
  ".less": { icon: CANDIDATES.style, colorClass: "ft-color-style" },
  ".styl": { icon: CANDIDATES.style, colorClass: "ft-color-style" },

  ".html": { icon: CANDIDATES.codeFile, colorClass: "ft-color-markup" },
  ".xml": { icon: CANDIDATES.codeFile, colorClass: "ft-color-markup" },
  ".svg": { icon: CANDIDATES.image, colorClass: "ft-color-image" },

  ".png": { icon: CANDIDATES.image, colorClass: "ft-color-image" },
  ".jpg": { icon: CANDIDATES.image, colorClass: "ft-color-image" },
  ".jpeg": { icon: CANDIDATES.image, colorClass: "ft-color-image" },
  ".gif": { icon: CANDIDATES.image, colorClass: "ft-color-image" },
  ".webp": { icon: CANDIDATES.image, colorClass: "ft-color-image" },
  ".avif": { icon: CANDIDATES.image, colorClass: "ft-color-image" },

  ".mp4": { icon: CANDIDATES.video, colorClass: "ft-color-media" },
  ".mov": { icon: CANDIDATES.video, colorClass: "ft-color-media" },
  ".avi": { icon: CANDIDATES.video, colorClass: "ft-color-media" },
  ".webm": { icon: CANDIDATES.video, colorClass: "ft-color-media" },

  ".mp3": { icon: CANDIDATES.music, colorClass: "ft-color-media" },
  ".wav": { icon: CANDIDATES.music, colorClass: "ft-color-media" },
  ".ogg": { icon: CANDIDATES.music, colorClass: "ft-color-media" },
  ".m4a": { icon: CANDIDATES.music, colorClass: "ft-color-media" },

  ".zip": { icon: CANDIDATES.archive, colorClass: "ft-color-archive" },
  ".rar": { icon: CANDIDATES.archive, colorClass: "ft-color-archive" },
  ".7z": { icon: CANDIDATES.archive, colorClass: "ft-color-archive" },
  ".gz": { icon: CANDIDATES.archive, colorClass: "ft-color-archive" },
  ".tar": { icon: CANDIDATES.archive, colorClass: "ft-color-archive" },

  ".sql": { icon: CANDIDATES.database, colorClass: "ft-color-database" },
  ".sqlite": { icon: CANDIDATES.database, colorClass: "ft-color-database" },
  ".db": { icon: CANDIDATES.database, colorClass: "ft-color-database" },

  ".sh": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  ".bash": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  ".zsh": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  ".ps1": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  ".bat": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" },
  ".cmd": { icon: CANDIDATES.terminal, colorClass: "ft-color-scripts" }
};

const PARTIAL_STYLES: Array<{ include: string; style: IconStyle }> = [
  { include: "test", style: { colorClass: "ft-color-tests" } },
  { include: "spec", style: { colorClass: "ft-color-tests" } },
  { include: "mock", style: { colorClass: "ft-color-tests" } },
  { include: "config", style: { icon: CANDIDATES.config, colorClass: "ft-color-config" } },
  { include: "docker", style: { icon: CANDIDATES.package, colorClass: "ft-color-docker" } },
  { include: "readme", style: { icon: CANDIDATES.docs, colorClass: "ft-color-doc" } },
  { include: "changelog", style: { icon: CANDIDATES.docs, colorClass: "ft-color-doc" } },
  { include: "license", style: { icon: CANDIDATES.docs, colorClass: "ft-color-doc" } },
  { include: "security", style: { icon: CANDIDATES.security, colorClass: "ft-color-security" } },
  { include: ".lock", style: { icon: CANDIDATES.lock, colorClass: "ft-color-lock" } }
];

function applyStyle(baseIcon: IconName, defaultColor: string, style: IconStyle | undefined, offlineSvg?: string): IconDescriptor {
  return {
    icon: safeIcon(style?.icon, baseIcon),
    offlineSvg,
    colorClass: style?.colorClass ?? defaultColor
  };
}

function pickBaseName(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segment = normalized.split("/").pop();
  return segment ?? normalized;
}

function getExtensionCandidates(baseName: string): string[] {
  const candidates: string[] = [];
  let extension = baseName;

  const firstDotIndex = extension.indexOf(".");
  if (firstDotIndex === -1) {
    return candidates;
  }

  extension = extension.slice(firstDotIndex);
  while (extension !== "") {
    candidates.push(extension);
    const nextDotIndex = extension.indexOf(".", 1);
    if (nextDotIndex === -1) {
      break;
    }
    extension = extension.slice(nextDotIndex);
  }

  return candidates;
}

export function resolveNodeIcon(
  fileName: string,
  nodeType: "folder" | "file",
  expanded: boolean,
  mode: FileTreeIconMode
): IconDescriptor {
  const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();
  const baseName = pickBaseName(normalizedPath);
  const offlineSvg = mode === "colored"
    ? resolveOfflineIconSvg(normalizedPath, nodeType, expanded)
    : undefined;

  if (mode === "simple") {
    if (nodeType === "folder") {
      return { icon: expanded ? DEFAULT_FOLDER_OPEN_ICON : DEFAULT_FOLDER_ICON };
    }
    return { icon: DEFAULT_FILE_ICON };
  }

  if (nodeType === "folder") {
    const folderStyle = FOLDER_STYLES[baseName];
    return applyStyle(
      expanded ? DEFAULT_FOLDER_OPEN_ICON : DEFAULT_FOLDER_ICON,
      DEFAULT_FOLDER_COLOR,
      folderStyle,
      offlineSvg
    );
  }

  const namedStyle = NAMED_FILE_STYLES[baseName];
  if (namedStyle) {
    return applyStyle(DEFAULT_FILE_ICON, DEFAULT_FILE_COLOR, namedStyle, offlineSvg);
  }

  const extensionCandidates = getExtensionCandidates(baseName);
  for (const extension of extensionCandidates) {
    const extensionStyle = EXTENSION_STYLES[extension];
    if (extensionStyle) {
      return applyStyle(DEFAULT_FILE_ICON, DEFAULT_FILE_COLOR, extensionStyle, offlineSvg);
    }
  }

  for (const item of PARTIAL_STYLES) {
    if (normalizedPath.includes(item.include)) {
      return applyStyle(DEFAULT_FILE_ICON, DEFAULT_FILE_COLOR, item.style, offlineSvg);
    }
  }

  return applyStyle(DEFAULT_FILE_ICON, DEFAULT_FILE_COLOR, undefined, offlineSvg);
}
