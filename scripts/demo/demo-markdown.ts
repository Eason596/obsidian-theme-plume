import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import http from "highlight.js/lib/languages/http";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("http", http);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);

marked.setOptions({
  gfm: true,
  breaks: true
});

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang ?? "").split(/\s+/)[0] || "plaintext";
      let highlighted = text;
      if (hljs.getLanguage(language)) {
        highlighted = hljs.highlight(text, { language }).value;
      } else {
        highlighted = hljs.highlightAuto(text).value;
      }
      const langClass = language ? ` language-${language}` : "";
      return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`;
    }
  }
});

export async function renderDemoMarkdown(
  container: HTMLElement,
  markdown: string
): Promise<void> {
  const html = await marked.parse(markdown);
  container.innerHTML = typeof html === "string" ? html : String(html);
}
