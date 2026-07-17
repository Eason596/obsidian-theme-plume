import { marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

marked.setOptions({
  gfm: true,
  breaks: true
});

let highlighterPromise: Promise<Highlighter> | null = null;
let rendererReady = false;

async function getDemoHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["vitesse-light", "vitesse-dark"],
      langs: [
        "javascript",
        "typescript",
        "vue",
        "json",
        "css",
        "html",
        "bash",
        "shell",
        "markdown",
        "yaml",
        "python",
        "http",
        "plaintext"
      ],
      engine: createJavaScriptRegexEngine()
    });
  }
  return highlighterPromise;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function ensureMarkedRenderer(): Promise<Highlighter> {
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
