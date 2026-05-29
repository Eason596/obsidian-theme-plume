import { mountPlainSourceCode } from "./demo-source-code";
import type { DemoSection } from "./demo-sections";
import type { BlockRenderContext } from "../../src/render/context";
import { processBadges, renderInnerMarkdown } from "../../src/render";

function renderSourcePanel(parent: HTMLElement, sourceMd: string): void {
  const details = document.createElement("details");
  details.className = "demo-source-panel";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = "Markdown 源码";
  details.appendChild(summary);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "demo-copy-source";
  copyBtn.textContent = "复制";
  summary.appendChild(copyBtn);

  const codeWrap = document.createElement("div");
  codeWrap.className = "demo-source-code";
  mountPlainSourceCode(codeWrap, sourceMd);
  details.appendChild(codeWrap);

  parent.appendChild(details);
}

export async function renderDemoSection(
  container: HTMLElement,
  section: DemoSection,
  ctx: BlockRenderContext
): Promise<void> {
  const sectionEl = document.createElement("section");
  sectionEl.className = "demo-example";
  if (section.id) {
    const anchor = document.createElement("a");
    anchor.id = section.id;
    sectionEl.appendChild(anchor);
  }

  if (section.markdown.trim()) {
    renderSourcePanel(sectionEl, section.markdown);
  }

  const previewLabel = document.createElement("div");
  previewLabel.className = "demo-preview-label";
  previewLabel.textContent = "预览效果";
  sectionEl.appendChild(previewLabel);

  const preview = document.createElement("div");
  preview.className = "demo-preview";

  const previewMd = section.markdown.trim()
    ? `${section.heading}\n\n${section.markdown}`
    : section.heading;

  await renderInnerMarkdown(preview, previewMd, ctx);
  processBadges(preview);
  sectionEl.appendChild(preview);

  container.appendChild(sectionEl);
}

export async function renderDemoIntro(
  container: HTMLElement,
  intro: string,
  ctx: BlockRenderContext
): Promise<void> {
  if (!intro.trim()) {
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "demo-intro";
  await renderInnerMarkdown(wrap, intro, ctx);
  processBadges(wrap);
  container.appendChild(wrap);
}

/** Fallback when the file has no section markers. */
export async function renderFullDocument(
  container: HTMLElement,
  markdown: string,
  ctx: BlockRenderContext
): Promise<void> {
  await renderInnerMarkdown(container, markdown, ctx);
  processBadges(container);
}
