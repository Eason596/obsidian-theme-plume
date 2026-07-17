import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

let registered = false;

function ensureLanguages(): void {
  if (registered) return;
  registered = true;
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("sh", bash);
  hljs.registerLanguage("shell", shell);
  hljs.registerLanguage("c", c);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("c++", cpp);
  hljs.registerLanguage("csharp", csharp);
  hljs.registerLanguage("cs", csharp);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("go", go);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("js", javascript);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("kotlin", kotlin);
  hljs.registerLanguage("kt", kotlin);
  hljs.registerLanguage("markdown", markdown);
  hljs.registerLanguage("md", markdown);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("py", python);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("rs", rust);
  hljs.registerLanguage("sql", sql);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("ts", typescript);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("html", xml);
  hljs.registerLanguage("svg", xml);
  hljs.registerLanguage("yaml", yaml);
  hljs.registerLanguage("yml", yaml);
}

const LANG_ALIASES: Record<string, string> = {
  "c++": "cpp",
  py: "python",
  js: "javascript",
  ts: "typescript",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  plaintext: "text",
  text: "text",
  txt: "text"
};

/** Normalize Obsidian / fence language id for display + highlight.js. */
export function normalizeFenceLang(raw: string | undefined | null): string {
  if (!raw) return "text";
  const base = raw.toLowerCase().replace(/[#+].*$/, "").trim();
  return LANG_ALIASES[base] ?? base;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Split highlight.js HTML into per-line HTML fragments (newlines outside tags). */
export function splitHighlightedHtmlByLines(html: string): string[] {
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) {
        current += html.slice(i);
        break;
      }
      current += html.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  lines.push(current);
  return lines;
}

/**
 * Highlight source with highlight.js and return one HTML string per line.
 * Falls back to escaped plain text when language is unknown.
 */
export function highlightSourceLines(lang: string, source: string): string[] {
  ensureLanguages();
  const normalized = normalizeFenceLang(lang);
  const text = source.replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (!text) return [""];

  try {
    if (normalized && normalized !== "text" && hljs.getLanguage(normalized)) {
      const { value } = hljs.highlight(text, { language: normalized, ignoreIllegals: true });
      return splitHighlightedHtmlByLines(value);
    }
  } catch {
    /* fall through */
  }

  return text.split("\n").map((line) => escapeHtml(line));
}

export function resolveCodeLanguage(codeEl: HTMLElement, preEl?: HTMLElement | null): string {
  const fromCode = codeEl.className.match(/\blanguage-([\w+#-]+)\b/i)?.[1];
  if (fromCode) return normalizeFenceLang(fromCode);
  const fromPre = preEl?.className.match(/\blanguage-([\w+#-]+)\b/i)?.[1];
  if (fromPre) return normalizeFenceLang(fromPre);
  return "text";
}
