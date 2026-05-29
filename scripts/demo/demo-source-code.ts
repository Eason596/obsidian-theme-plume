import hljs from "highlight.js/lib/core";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("markdown", markdown);

/**
 * Render section source as plain text — never through marked / Plume.
 * Wrapping source in a ``` fence breaks when the sample itself contains fences.
 */
export function mountPlainSourceCode(parent: HTMLElement, sourceMd: string): void {
  const pre = document.createElement("pre");
  pre.className = "demo-source-pre";
  pre.dataset.rawSource = sourceMd;

  const code = document.createElement("code");
  code.className = "demo-source-plain language-markdown";

  if (hljs.getLanguage("markdown")) {
    const { value } = hljs.highlight(sourceMd, { language: "markdown" });
    code.innerHTML = value;
    code.classList.add("hljs");
  } else {
    code.textContent = sourceMd;
  }

  pre.appendChild(code);
  parent.appendChild(pre);
}
