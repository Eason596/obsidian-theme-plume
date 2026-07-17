import {
  bundledLanguages,
  bundledThemes,
  createHighlighter,
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
  type ThemedToken
} from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Syntax highlighting via Shiki — same engine as VuePress Theme Plume.
 * Default themes: `vitesse-light` / `vitesse-dark` (overridable in settings).
 */

export const SHIKI_THEME_LIGHT_DEFAULT = "vitesse-light";
export const SHIKI_THEME_DARK_DEFAULT = "vitesse-dark";

/** @deprecated Use SHIKI_THEME_LIGHT_DEFAULT */
export const SHIKI_THEME_LIGHT = SHIKI_THEME_LIGHT_DEFAULT;
/** @deprecated Use SHIKI_THEME_DARK_DEFAULT */
export const SHIKI_THEME_DARK = SHIKI_THEME_DARK_DEFAULT;

const CORE_LANGS = [
  "javascript",
  "typescript",
  "vue",
  "tsx",
  "jsx",
  "python",
  "r",
  "json",
  "css",
  "html",
  "xml",
  "markdown",
  "bash",
  "shell",
  "yaml",
  "go",
  "rust",
  "sql",
  "java",
  "cpp",
  "c",
  "csharp",
  "kotlin",
  "ruby",
  "php",
  "swift",
  "scss",
  "less",
  "diff",
  "plaintext"
] as const;

/** Extra aliases Obsidian / fences often use. */
const LANG_ALIASES: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  py: "python",
  js: "javascript",
  ts: "typescript",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  plaintext: "plaintext",
  text: "plaintext",
  txt: "plaintext",
  htm: "html",
  objc: "objective-c",
  "objective-c": "objective-c",
  ps1: "powershell",
  psm1: "powershell",
  bat: "bat",
  cmd: "bat",
  vue: "vue"
};

const EXT_TO_LANG: Record<string, string> = {
  vue: "vue",
  html: "html",
  htm: "html",
  xhtml: "xml",
  xml: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  go: "go",
  rs: "rust",
  swift: "swift",
  m: "objective-c",
  py: "python",
  pyw: "python",
  r: "r",
  rmd: "r",
  rb: "ruby",
  php: "php",
  pl: "perl",
  lua: "lua",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  bat: "bat",
  cmd: "bat",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  diff: "diff",
  patch: "diff",
  dockerfile: "dockerfile",
  cmake: "cmake",
  groovy: "groovy",
  gradle: "groovy",
  scala: "scala",
  clj: "clojure",
  ex: "elixir",
  erl: "erlang",
  hs: "haskell",
  dart: "dart",
  zig: "zig",
  jl: "julia",
  tex: "latex",
  proto: "protobuf",
  sol: "solidity"
};

let highlighterPromise: Promise<Highlighter> | null = null;
let themeLight: BundledTheme = SHIKI_THEME_LIGHT_DEFAULT;
let themeDark: BundledTheme = SHIKI_THEME_DARK_DEFAULT;

export function isBundledShikiTheme(id: string): id is BundledTheme {
  return id in bundledThemes;
}

/** Sorted list of Shiki bundled theme ids (for settings UI). */
export function listBundledShikiThemes(): string[] {
  return Object.keys(bundledThemes).sort((a, b) => a.localeCompare(b));
}

/** Apply light/dark theme ids from plugin settings (invalid ids fall back to vitesse). */
export function configureShikiThemes(light: string, dark: string): void {
  themeLight = isBundledShikiTheme(light) ? light : SHIKI_THEME_LIGHT_DEFAULT;
  themeDark = isBundledShikiTheme(dark) ? dark : SHIKI_THEME_DARK_DEFAULT;
}

function resolveShikiTheme(): BundledTheme {
  if (typeof document !== "undefined" && document.body?.classList.contains("theme-dark")) {
    return themeDark;
  }
  return themeLight;
}

/** Active theme id for the current Obsidian appearance (settings + light/dark). */
export function getActiveShikiThemeId(): string {
  return resolveShikiTheme();
}

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    const initial = Array.from(new Set<BundledTheme>([themeLight, themeDark]));
    highlighterPromise = createHighlighter({
      themes: initial,
      langs: [...CORE_LANGS],
      // JS regex engine — no WASM, friendlier for Obsidian / esbuild
      engine: createJavaScriptRegexEngine()
    });
  }
  return highlighterPromise;
}

async function ensureTheme(highlighter: Highlighter, theme: BundledTheme): Promise<void> {
  if (highlighter.getLoadedThemes().includes(theme)) return;
  if (!(theme in bundledThemes)) return;
  try {
    await highlighter.loadTheme(theme);
  } catch (err) {
    console.error("[theme-plume] Failed to load Shiki theme", theme, err);
  }
}

/** Map common file extensions to Shiki language ids. */
export function languageFromFilename(filename: string | undefined | null): string {
  if (!filename) return "plaintext";
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const lower = base.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === "cmakelists.txt") return "cmake";

  const dot = lower.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  const ext = lower.slice(dot + 1);
  return EXT_TO_LANG[ext] ?? "plaintext";
}

/** Normalize Obsidian / fence language id for Shiki. */
export function normalizeFenceLang(raw: string | undefined | null): string {
  if (!raw) return "plaintext";
  const base = raw.toLowerCase().replace(/[#+].*$/, "").trim();
  if (!base) return "plaintext";
  return LANG_ALIASES[base] ?? base;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tokenStyle(token: ThemedToken): string {
  const parts: string[] = [];
  if (token.color) parts.push(`color:${token.color}`);
  if (token.bgColor) parts.push(`background-color:${token.bgColor}`);
  const fontStyle = token.fontStyle ?? 0;
  // shiki FontStyle bits: italic=1, bold=2, underline=4
  if (fontStyle & 1) parts.push("font-style:italic");
  if (fontStyle & 2) parts.push("font-weight:bold");
  if (fontStyle & 4) parts.push("text-decoration:underline");
  return parts.join(";");
}

function tokensToLineHtml(tokens: ThemedToken[]): string {
  return tokens
    .map((t) => {
      const style = tokenStyle(t);
      const body = escapeHtml(t.content);
      return style ? `<span style="${style}">${body}</span>` : body;
    })
    .join("");
}

async function ensureLanguage(highlighter: Highlighter, lang: string): Promise<string> {
  const normalized = normalizeFenceLang(lang);
  if (normalized === "plaintext" || normalized === "text") return "plaintext";

  const loaded = highlighter.getLoadedLanguages();
  if (loaded.includes(normalized)) return normalized;

  // Dynamic load from Shiki bundled grammars when not in CORE_LANGS
  if (normalized in bundledLanguages) {
    try {
      await highlighter.loadLanguage(normalized as keyof typeof bundledLanguages);
      return normalized;
    } catch {
      /* fall through */
    }
  }

  return "plaintext";
}

/**
 * Highlight source with Shiki; one HTML string per line (inline token colors).
 */
export async function highlightSourceLines(lang: string, source: string): Promise<string[]> {
  const text = source.replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (!text) return [""];

  try {
    const highlighter = await getHighlighter();
    const resolved = await ensureLanguage(highlighter, lang);
    if (resolved === "plaintext") {
      return text.split("\n").map((line) => escapeHtml(line));
    }

    const theme = resolveShikiTheme();
    await ensureTheme(highlighter, theme);
    const result = highlighter.codeToTokens(text, {
      lang: resolved as BundledLanguage,
      theme
    });

    return result.tokens.map((line) => tokensToLineHtml(line) || "\u200b");
  } catch {
    return text.split("\n").map((line) => escapeHtml(line));
  }
}

export function resolveCodeLanguage(codeEl: HTMLElement, preEl?: HTMLElement | null): string {
  const fromCode = codeEl.className.match(/\blanguage-([\w+#-]+)\b/i)?.[1];
  if (fromCode) return normalizeFenceLang(fromCode);
  const fromPre = preEl?.className.match(/\blanguage-([\w+#-]+)\b/i)?.[1];
  if (fromPre) return normalizeFenceLang(fromPre);
  return "plaintext";
}

/** Warm the highlighter (call on plugin load to reduce first-paint lag). */
export function preloadHighlighter(): void {
  void getHighlighter().catch((err) => {
    console.error("[theme-plume] Shiki init failed", err);
  });
}

/** Bundled + currently loaded language ids (diagnostics). */
export async function listRegisteredLanguages(): Promise<string[]> {
  const highlighter = await getHighlighter();
  const bundled = Object.keys(bundledLanguages);
  const loaded = highlighter.getLoadedLanguages();
  return Array.from(new Set([...bundled, ...loaded, "vue"])).sort();
}
