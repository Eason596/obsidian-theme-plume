import { marked } from "marked";
import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type { HighlighterCore, LanguageInput } from "@shikijs/types";

marked.setOptions({
  gfm: true,
  breaks: true
});

let highlighterPromise: Promise<HighlighterCore> | null = null;
let rendererReady = false;

export async function getDemoHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [vitesseLight, vitesseDark, ...languages] = await Promise.all([
        import("@shikijs/themes/vitesse-light").then((module) => module.default),
        import("@shikijs/themes/vitesse-dark").then((module) => module.default),
        import("@shikijs/langs/javascript").then((module) => module.default),
        import("@shikijs/langs/typescript").then((module) => module.default),
        import("@shikijs/langs/vue").then((module) => module.default),
        import("@shikijs/langs/json").then((module) => module.default),
        import("@shikijs/langs/css").then((module) => module.default),
        import("@shikijs/langs/html").then((module) => module.default),
        import("@shikijs/langs/bash").then((module) => module.default),
        import("@shikijs/langs/shell").then((module) => module.default),
        import("@shikijs/langs/markdown").then((module) => module.default),
        import("@shikijs/langs/yaml").then((module) => module.default),
        import("@shikijs/langs/python").then((module) => module.default),
        import("@shikijs/langs/http").then((module) => module.default)
      ]);
      return createHighlighterCore({
        themes: [vitesseLight, vitesseDark],
        langs: languages.flat() as LanguageInput[],
        engine: createJavaScriptRegexEngine()
      });
    })();
  }
  return highlighterPromise;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function ensureMarkedRenderer(): Promise<HighlighterCore> {
  const highlighter = await getDemoHighlighter();
  if (rendererReady) return highlighter;
  rendererReady = true;

  marked.use({
    renderer: {
      code({ text, lang }) {
        const language = (lang ?? "").split(/\s+/)[0] || "plaintext";
        try {
          return highlighter.codeToHtml(text, {
            lang: language,
            themes: {
              light: "vitesse-light",
              dark: "vitesse-dark"
            },
            defaultColor: false
          });
        } catch {
          return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
        }
      }
    }
  });

  return highlighter;
}

export async function renderDemoMarkdown(
  container: HTMLElement,
  markdown: string
): Promise<void> {
  await ensureMarkedRenderer();
  const html = await marked.parse(markdown);
  container.innerHTML = typeof html === "string" ? html : String(html);
}
