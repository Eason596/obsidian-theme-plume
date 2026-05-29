import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { patchDomPolyfills } from "./dom-polyfill";
import { enrichDemoPage } from "./enrich-demo";
import { renderDemoMarkdown } from "./demo-markdown";
import {
  preprocessDemoMarkdown,
  resolveCodeTreeEmbedFromDisk,
  stripFrontmatter
} from "./fs-embed";
import { App, Component } from "./obsidian-shim";
import { processBadges, renderInnerMarkdown } from "../../src/render";
import type { BlockRenderContext } from "../../src/render/context";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const SOURCE_MD = join(REPO_ROOT, "examples", "plume-components.md");
const DOCS_DIR = join(REPO_ROOT, "docs");
const SOURCE_PATH = "examples/plume-components.md";

function buildHtml(bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Obsidian Plume 组件静态预览 — 由 examples/plume-components.md 构建">
  <title>Obsidian Plume — 组件预览</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
  <link rel="stylesheet" href="demo-base.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="demo-header">
    <div class="demo-header-inner">
      <h1>Obsidian Plume</h1>
      <p>静态预览 · 由 <code>examples/plume-components.md</code> 生成 · <a href="https://github.com/Eason596/obsidian-theme-plume">GitHub</a></p>
    </div>
  </header>
  <main class="demo-main markdown-preview-view markdown-rendered plume-demo-content">
${bodyInner}
  </main>
  <footer class="demo-footer">
  <p>在 Obsidian 中体验完整交互请安装插件。重新生成：<code>npm run build:demo</code></p>
  </footer>
  <script src="demo-client.js"></script>
</body>
</html>`;
}

async function main(): Promise<void> {
  const window = new Window({
    url: "https://local/",
    width: 920,
    height: 2400
  });
  const { document } = window;
  globalThis.window = window as unknown as Window & typeof globalThis;
  globalThis.document = document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {
      /* demo */
    }
    observe(): void {
      /* demo */
    }
    unobserve(): void {
      /* demo */
    }
    disconnect(): void {
      /* demo */
    }
  } as typeof ResizeObserver;

  globalThis.getComputedStyle = window.getComputedStyle.bind(window);

  patchDomPolyfills();

  const raw = readFileSync(SOURCE_MD, "utf8");
  const markdown = preprocessDemoMarkdown(stripFrontmatter(raw));

  const app = new App() as unknown as BlockRenderContext["app"];
  const component = new Component() as unknown as BlockRenderContext["component"];

  const ctx: BlockRenderContext = {
    app,
    sourcePath: SOURCE_PATH,
    component,
    defaultIconMode: "colored",
    settings: {
      defaultIconMode: "colored",
      persistTabSelection: false,
      collapseLazyBodies: false,
      tabsLazyPanels: false,
      debugRender: true
    },
    renderMarkdown: renderDemoMarkdown,
    resolveCodeTreeEmbed: (sourcePath, dirPath) =>
      resolveCodeTreeEmbedFromDisk(REPO_ROOT, sourcePath, dirPath)
  };

  const container = document.createElement("div");
  container.className = "plume-demo-article";

  await renderInnerMarkdown(container as unknown as HTMLElement, markdown, ctx);
  processBadges(container as unknown as HTMLElement);

  await enrichDemoPage(
    container as unknown as HTMLElement,
    markdown,
    REPO_ROOT,
    SOURCE_PATH
  );

  mkdirSync(DOCS_DIR, { recursive: true });
  copyFileSync(join(REPO_ROOT, "styles.css"), join(DOCS_DIR, "styles.css"));

  const html = buildHtml(container.innerHTML);
  writeFileSync(join(DOCS_DIR, "index.html"), html, "utf8");

  console.log(`Wrote ${join(DOCS_DIR, "index.html")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
