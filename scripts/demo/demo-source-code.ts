import { codeToHtml } from "shiki";

/**
 * Render section source as plain text — never through marked / Plume.
 * Wrapping source in a ``` fence breaks when the sample itself contains fences.
 */
export async function mountPlainSourceCode(
  parent: HTMLElement,
  sourceMd: string
): Promise<void> {
  const pre = document.createElement("pre");
  pre.className = "demo-source-pre";
  pre.dataset.rawSource = sourceMd;

  const code = document.createElement("code");
  code.className = "demo-source-plain language-markdown shiki";
  code.textContent = sourceMd;
  pre.appendChild(code);
  parent.appendChild(pre);

  try {
    const html = await codeToHtml(sourceMd, {
      lang: "markdown",
      themes: { light: "vitesse-light", dark: "vitesse-dark" },
      defaultColor: false
    });
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const inner = tmp.querySelector("code");
    if (inner) {
      code.className = inner.className;
      code.innerHTML = inner.innerHTML;
    }
  } catch {
    /* keep plaintext */
  }
}
