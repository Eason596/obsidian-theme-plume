import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type {
  HighlighterCore,
  LanguageInput,
  ThemedToken,
  ThemeRegistrationAny
} from "@shikijs/types";

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

type LanguageLoader = () => Promise<LanguageInput[]>;
type ThemeLoader = () => Promise<ThemeRegistrationAny>;

/**
 * Explicit loaders keep Shiki on-demand and prevent the full 332-language bundle
 * from entering the plugin. Reading view and Live Preview share this same table.
 */
const LANGUAGE_LOADERS: Record<string, LanguageLoader> = {
  javascript: () => import("@shikijs/langs/javascript").then((m) => m.default),
  typescript: () => import("@shikijs/langs/typescript").then((m) => m.default),
  vue: () => import("@shikijs/langs/vue").then((m) => m.default),
  tsx: () => import("@shikijs/langs/tsx").then((m) => m.default),
  jsx: () => import("@shikijs/langs/jsx").then((m) => m.default),
  python: () => import("@shikijs/langs/python").then((m) => m.default),
  r: () => import("@shikijs/langs/r").then((m) => m.default),
  json: () => import("@shikijs/langs/json").then((m) => m.default),
  jsonc: () => import("@shikijs/langs/jsonc").then((m) => m.default),
  css: () => import("@shikijs/langs/css").then((m) => m.default),
  html: () => import("@shikijs/langs/html").then((m) => m.default),
  xml: () => import("@shikijs/langs/xml").then((m) => m.default),
  markdown: () => import("@shikijs/langs/markdown").then((m) => m.default),
  mdx: () => import("@shikijs/langs/mdx").then((m) => m.default),
  bash: () => import("@shikijs/langs/bash").then((m) => m.default),
  shell: () => import("@shikijs/langs/shell").then((m) => m.default),
  yaml: () => import("@shikijs/langs/yaml").then((m) => m.default),
  toml: () => import("@shikijs/langs/toml").then((m) => m.default),
  ini: () => import("@shikijs/langs/ini").then((m) => m.default),
  go: () => import("@shikijs/langs/go").then((m) => m.default),
  rust: () => import("@shikijs/langs/rust").then((m) => m.default),
  sql: () => import("@shikijs/langs/sql").then((m) => m.default),
  java: () => import("@shikijs/langs/java").then((m) => m.default),
  cpp: () => import("@shikijs/langs/cpp").then((m) => m.default),
  c: () => import("@shikijs/langs/c").then((m) => m.default),
  csharp: () => import("@shikijs/langs/csharp").then((m) => m.default),
  kotlin: () => import("@shikijs/langs/kotlin").then((m) => m.default),
  ruby: () => import("@shikijs/langs/ruby").then((m) => m.default),
  php: () => import("@shikijs/langs/php").then((m) => m.default),
  swift: () => import("@shikijs/langs/swift").then((m) => m.default),
  scss: () => import("@shikijs/langs/scss").then((m) => m.default),
  sass: () => import("@shikijs/langs/sass").then((m) => m.default),
  less: () => import("@shikijs/langs/less").then((m) => m.default),
  diff: () => import("@shikijs/langs/diff").then((m) => m.default),
  "objective-c": () => import("@shikijs/langs/objective-c").then((m) => m.default),
  perl: () => import("@shikijs/langs/perl").then((m) => m.default),
  lua: () => import("@shikijs/langs/lua").then((m) => m.default),
  powershell: () => import("@shikijs/langs/powershell").then((m) => m.default),
  bat: () => import("@shikijs/langs/bat").then((m) => m.default),
  graphql: () => import("@shikijs/langs/graphql").then((m) => m.default),
  dockerfile: () => import("@shikijs/langs/dockerfile").then((m) => m.default),
  cmake: () => import("@shikijs/langs/cmake").then((m) => m.default),
  makefile: () => import("@shikijs/langs/makefile").then((m) => m.default),
  groovy: () => import("@shikijs/langs/groovy").then((m) => m.default),
  scala: () => import("@shikijs/langs/scala").then((m) => m.default),
  clojure: () => import("@shikijs/langs/clojure").then((m) => m.default),
  elixir: () => import("@shikijs/langs/elixir").then((m) => m.default),
  erlang: () => import("@shikijs/langs/erlang").then((m) => m.default),
  haskell: () => import("@shikijs/langs/haskell").then((m) => m.default),
  dart: () => import("@shikijs/langs/dart").then((m) => m.default),
  zig: () => import("@shikijs/langs/zig").then((m) => m.default),
  julia: () => import("@shikijs/langs/julia").then((m) => m.default),
  latex: () => import("@shikijs/langs/latex").then((m) => m.default),
  protobuf: () => import("@shikijs/langs/protobuf").then((m) => m.default),
  solidity: () => import("@shikijs/langs/solidity").then((m) => m.default)
};

/** Curated themes keep settings useful without bundling every Shiki theme. */
const THEME_LOADERS = {
  "vitesse-light": () => import("@shikijs/themes/vitesse-light").then((m) => m.default),
  "vitesse-dark": () => import("@shikijs/themes/vitesse-dark").then((m) => m.default),
  "github-light": () => import("@shikijs/themes/github-light").then((m) => m.default),
  "github-dark": () => import("@shikijs/themes/github-dark").then((m) => m.default),
  "light-plus": () => import("@shikijs/themes/light-plus").then((m) => m.default),
  "dark-plus": () => import("@shikijs/themes/dark-plus").then((m) => m.default),
  "one-light": () => import("@shikijs/themes/one-light").then((m) => m.default),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro").then((m) => m.default),
  "catppuccin-latte": () => import("@shikijs/themes/catppuccin-latte").then((m) => m.default),
  "catppuccin-mocha": () => import("@shikijs/themes/catppuccin-mocha").then((m) => m.default),
  nord: () => import("@shikijs/themes/nord").then((m) => m.default),
  dracula: () => import("@shikijs/themes/dracula").then((m) => m.default),
  "tokyo-night": () => import("@shikijs/themes/tokyo-night").then((m) => m.default),
  "material-theme": () => import("@shikijs/themes/material-theme").then((m) => m.default)
} satisfies Record<string, ThemeLoader>;

export type SupportedShikiTheme = keyof typeof THEME_LOADERS;

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

let highlighterPromise: Promise<HighlighterCore> | null = null;
let themeLight: SupportedShikiTheme = SHIKI_THEME_LIGHT_DEFAULT;
let themeDark: SupportedShikiTheme = SHIKI_THEME_DARK_DEFAULT;

export function isBundledShikiTheme(id: string): id is SupportedShikiTheme {
  return id in THEME_LOADERS;
}

/** Sorted list of Shiki bundled theme ids (for settings UI). */
export function listBundledShikiThemes(): string[] {
  return Object.keys(THEME_LOADERS).sort((a, b) => a.localeCompare(b));
}

/** Apply light/dark theme ids from plugin settings (invalid ids fall back to vitesse). */
export function configureShikiThemes(light: string, dark: string): void {
  themeLight = isBundledShikiTheme(light) ? light : SHIKI_THEME_LIGHT_DEFAULT;
  themeDark = isBundledShikiTheme(dark) ? dark : SHIKI_THEME_DARK_DEFAULT;
}

function resolveShikiTheme(): SupportedShikiTheme {
  if (typeof document !== "undefined" && document.body?.classList.contains("theme-dark")) {
    return themeDark;
  }
  return themeLight;
}

/** Active theme id for the current Obsidian appearance (settings + light/dark). */
export function getActiveShikiThemeId(): string {
  return resolveShikiTheme();
}

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [],
      langs: [],
      // JS regex engine: no WASM and no desktop-only dependency.
      engine: createJavaScriptRegexEngine()
    });
  }
  return highlighterPromise;
}

async function ensureTheme(highlighter: HighlighterCore, theme: SupportedShikiTheme): Promise<void> {
  if (highlighter.getLoadedThemes().includes(theme)) return;
  const loader = THEME_LOADERS[theme];
  try {
    await highlighter.loadTheme(await loader());
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

async function ensureLanguage(highlighter: HighlighterCore, lang: string): Promise<string> {
  const normalized = normalizeFenceLang(lang);
  if (normalized === "plaintext" || normalized === "text") return "plaintext";

  const loaded = highlighter.getLoadedLanguages();
  if (loaded.includes(normalized)) return normalized;

  const loader = LANGUAGE_LOADERS[normalized];
  if (loader) {
    try {
      const registrations = await loader();
      await highlighter.loadLanguage(...registrations);
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
      lang: resolved,
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

/** Release grammar/theme state when the plugin unloads. */
export async function disposeHighlighter(): Promise<void> {
  const pending = highlighterPromise;
  highlighterPromise = null;
  if (!pending) return;
  try {
    (await pending).dispose();
  } catch {
    /* initialization may have failed */
  }
}

/** Supported + currently loaded language ids (diagnostics). */
export async function listRegisteredLanguages(): Promise<string[]> {
  const highlighter = await getHighlighter();
  const bundled = Object.keys(LANGUAGE_LOADERS);
  const loaded = highlighter.getLoadedLanguages();
  return Array.from(new Set([...bundled, ...loaded, "vue"])).sort();
}
